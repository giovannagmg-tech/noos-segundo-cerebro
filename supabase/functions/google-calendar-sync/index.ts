// Edge Function: google-calendar-sync
// docs/FUNCTIONS.md — pull (Google → calendar_events) e push (edições locais
// pending_push/local_only → Google), renovando o access_token via
// refresh_token quando expirado. Chamada sob demanda pelo próprio dono ou por
// cron_calendar_sync (service role, user_id no body, uma vez por conexão).
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { resolveAuth } from '../_shared/auth.ts'

type CalendarConnection = {
  access_token: string
  refresh_token: string
  token_expires_at: string
  calendar_id: string
}

type CalendarEventRow = {
  id: string
  google_event_id: string | null
  title: string
  starts_at: string
  ends_at: string | null
  sync_status: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')

  let body: { user_id?: string; direction?: 'both' | 'pull' | 'push' }
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const auth = await resolveAuth(req, { supabaseUrl, anonKey, serviceRoleKey, body })
  if (!auth) return jsonResponse({ error: 'Não autenticado' }, 401)

  const direction = body.direction ?? 'both'
  const userId = auth.userId

  const serviceClient = createClient(supabaseUrl, serviceRoleKey)

  const { data: conn } = await serviceClient
    .from('calendar_connections')
    .select('access_token, refresh_token, token_expires_at, calendar_id')
    .eq('user_id', userId)
    .eq('provider', 'google')
    .maybeSingle<CalendarConnection>()

  if (!conn) {
    return jsonResponse({ error: 'Nenhuma conexão com o Google Calendar. Conecte em Configurações.' }, 400)
  }
  if (!clientId || !clientSecret) {
    return jsonResponse({ error: 'GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET não configurados' }, 500)
  }

  let accessToken = conn.access_token
  let tokenRefreshed = false

  if (new Date(conn.token_expires_at) <= new Date()) {
    const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: conn.refresh_token,
        grant_type: 'refresh_token',
      }),
    })
    if (!refreshRes.ok) {
      return jsonResponse(
        { error: 'Falha ao renovar o token — reconecte o Google Calendar em Configurações.' },
        401,
      )
    }
    const refreshJson = await refreshRes.json()
    accessToken = refreshJson.access_token
    tokenRefreshed = true
    await serviceClient
      .from('calendar_connections')
      .update({
        access_token: accessToken,
        token_expires_at: new Date(Date.now() + refreshJson.expires_in * 1000).toISOString(),
      })
      .eq('user_id', userId)
      .eq('provider', 'google')
  }

  let pulled = 0
  let pushed = 0

  if (direction === 'both' || direction === 'pull') {
    const timeMin = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
    const timeMax = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString()
    const listUrl = new URL(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(conn.calendar_id)}/events`,
    )
    listUrl.searchParams.set('timeMin', timeMin)
    listUrl.searchParams.set('timeMax', timeMax)
    listUrl.searchParams.set('singleEvents', 'true')
    listUrl.searchParams.set('orderBy', 'startTime')

    const listRes = await fetch(listUrl, { headers: { Authorization: `Bearer ${accessToken}` } })
    if (listRes.ok) {
      const listJson = await listRes.json()
      for (const item of listJson.items ?? []) {
        if (!item.start || item.status === 'cancelled') continue
        const startsAt = item.start.dateTime ?? item.start.date
        const endsAt = item.end?.dateTime ?? item.end?.date ?? null
        const { error } = await serviceClient.from('calendar_events').upsert(
          {
            user_id: userId,
            google_event_id: item.id,
            title: item.summary ?? '(sem título)',
            starts_at: new Date(startsAt).toISOString(),
            ends_at: endsAt ? new Date(endsAt).toISOString() : null,
            sync_status: 'synced',
          },
          { onConflict: 'user_id,google_event_id' },
        )
        if (!error) pulled++
      }
    } else {
      console.error('Falha ao listar eventos do Google:', await listRes.text())
    }
  }

  if (direction === 'both' || direction === 'push') {
    const { data: pendingEvents } = await serviceClient
      .from('calendar_events')
      .select('id, google_event_id, title, starts_at, ends_at, sync_status')
      .eq('user_id', userId)
      .in('sync_status', ['pending_push', 'local_only'])
      .returns<CalendarEventRow[]>()

    for (const ev of pendingEvents ?? []) {
      const payload = {
        summary: ev.title,
        start: { dateTime: ev.starts_at },
        end: { dateTime: ev.ends_at ?? ev.starts_at },
      }
      const isUpdate = Boolean(ev.google_event_id)
      const url = isUpdate
        ? `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(conn.calendar_id)}/events/${ev.google_event_id}`
        : `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(conn.calendar_id)}/events`

      const res = await fetch(url, {
        method: isUpdate ? 'PATCH' : 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        const resJson = await res.json()
        await serviceClient
          .from('calendar_events')
          .update({ google_event_id: resJson.id, sync_status: 'synced' })
          .eq('id', ev.id)
        pushed++
      } else {
        console.error('Falha ao enviar evento pro Google:', await res.text())
      }
    }
  }

  return jsonResponse({ pulled, pushed, conflicts: 0, token_refreshed: tokenRefreshed })
})
