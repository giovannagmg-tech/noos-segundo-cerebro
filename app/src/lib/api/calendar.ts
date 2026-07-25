import { supabase } from '@/lib/supabase'

export type CalendarEvent = {
  id: string
  user_id: string
  google_event_id: string | null
  title: string
  starts_at: string
  ends_at: string | null
  sync_status: 'synced' | 'pending_push' | 'local_only'
}

// Nunca seleciona access_token/refresh_token — mesmo a RLS permitindo SELECT
// ao dono, essas colunas não devem ir pro navegador (ver docs/ESTRUTURA.md).
export async function getConnectionStatus(): Promise<{ connected: boolean; calendarId?: string }> {
  const { data, error } = await supabase
    .from('calendar_connections')
    .select('calendar_id')
    .eq('provider', 'google')
    .maybeSingle()
  if (error) throw error
  return data ? { connected: true, calendarId: data.calendar_id } : { connected: false }
}

export async function connectGoogleCalendar(code: string, redirectUri: string) {
  const { data, error } = await supabase.functions.invoke('google-calendar-oauth', {
    body: { code, redirect_uri: redirectUri },
  })
  if (error) throw error
  return data as { connected: boolean }
}

export async function disconnectGoogleCalendar() {
  const { data, error } = await supabase.functions.invoke('google-calendar-oauth', {
    body: { disconnect: true },
  })
  if (error) throw error
  return data as { connected: boolean }
}

export async function syncGoogleCalendar(direction: 'both' | 'pull' | 'push' = 'both') {
  const { data, error } = await supabase.functions.invoke('google-calendar-sync', {
    body: { direction },
  })
  if (error) throw error
  return data as { pulled: number; pushed: number; conflicts: number; token_refreshed: boolean }
}

export async function listEventsInRange(startIso: string, endIso: string): Promise<CalendarEvent[]> {
  const { data, error } = await supabase
    .from('calendar_events')
    .select('*')
    .gte('starts_at', startIso)
    .lte('starts_at', endIso)
    .order('starts_at', { ascending: true })
  if (error) throw error
  return data as CalendarEvent[]
}

export async function createLocalEvent(input: { title: string; starts_at: string; ends_at?: string | null }) {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('Não autenticado')
  const { error } = await supabase.from('calendar_events').insert({
    user_id: auth.user.id,
    title: input.title,
    starts_at: input.starts_at,
    ends_at: input.ends_at ?? null,
    sync_status: 'local_only',
  })
  if (error) throw error
}

export async function updateLocalEvent(
  id: string,
  patch: Partial<Pick<CalendarEvent, 'title' | 'starts_at' | 'ends_at'>>,
) {
  const { error } = await supabase
    .from('calendar_events')
    .update({ ...patch, sync_status: 'pending_push' })
    .eq('id', id)
  if (error) throw error
}
