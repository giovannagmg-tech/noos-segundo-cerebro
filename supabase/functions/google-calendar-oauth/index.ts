// Edge Function: google-calendar-oauth
// docs/FUNCTIONS.md — troca o code OAuth do Google por tokens e grava em
// calendar_connections (service role — tokens nunca passam pelo frontend
// além do código de autorização em si). Também cuida do "disconnect"
// (não listado como function separada no docs/ESTRUTURA.md — mantive
// dentro desta mesma function pra não inventar uma quarta Edge Function).
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return jsonResponse({ error: 'Não autenticado' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError || !user) return jsonResponse({ error: 'Não autenticado' }, 401)

  let body: { code?: string; redirect_uri?: string; disconnect?: boolean }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Body inválido' }, 400)
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey)

  if (body.disconnect) {
    const { error } = await serviceClient
      .from('calendar_connections')
      .delete()
      .eq('user_id', user.id)
      .eq('provider', 'google')
    if (error) return jsonResponse({ error: 'Falha ao desconectar' }, 500)
    return jsonResponse({ connected: false })
  }

  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
  if (!clientId || !clientSecret) {
    return jsonResponse(
      { error: 'GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET não configurados nos secrets do Supabase' },
      500,
    )
  }
  if (!body.code || !body.redirect_uri) {
    return jsonResponse({ error: 'code e redirect_uri são obrigatórios' }, 400)
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: body.code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: body.redirect_uri,
      grant_type: 'authorization_code',
    }),
  })

  if (!tokenRes.ok) {
    const detail = await tokenRes.text()
    console.error('Google token exchange error:', detail)
    return jsonResponse({ error: 'Falha ao trocar o código de autorização' }, 502)
  }

  const tokenJson = await tokenRes.json()
  const { access_token, refresh_token, expires_in } = tokenJson
  if (!access_token) {
    return jsonResponse({ error: 'Resposta inesperada do Google' }, 502)
  }
  if (!refresh_token) {
    // Acontece quando o Google já tinha emitido um refresh_token antes e o
    // usuário não passou por access_type=offline&prompt=consent de novo.
    return jsonResponse(
      {
        error:
          'Google não retornou refresh_token — revogue o acesso do Noos em myaccount.google.com/permissions e tente conectar de novo.',
      },
      400,
    )
  }

  const tokenExpiresAt = new Date(Date.now() + expires_in * 1000).toISOString()

  const { error: upsertError } = await serviceClient.from('calendar_connections').upsert(
    {
      user_id: user.id,
      provider: 'google',
      access_token,
      refresh_token,
      token_expires_at: tokenExpiresAt,
      calendar_id: 'primary',
    },
    { onConflict: 'user_id,provider' },
  )
  if (upsertError) {
    console.error('Falha ao gravar conexão:', upsertError)
    return jsonResponse({ error: 'Falha ao gravar conexão' }, 500)
  }

  return jsonResponse({ connected: true, calendar_id: 'primary', provider: 'google' })
})
