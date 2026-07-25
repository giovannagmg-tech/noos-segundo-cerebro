import { supabase } from '@/lib/supabase'

export type PomodoroSession = {
  id: string
  user_id: string
  note_id: string | null
  started_at: string
  ended_at: string | null
  focus_minutes: number
  cycles_completed: number
}

export type PomodoroSessionWithNote = PomodoroSession & { note: { title: string } | null }

export async function startSession(noteId: string | null): Promise<PomodoroSession> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('Não autenticado')
  const { data, error } = await supabase
    .from('pomodoro_sessions')
    .insert({ user_id: auth.user.id, note_id: noteId, focus_minutes: 25 })
    .select()
    .single()
  if (error) throw error
  return data as PomodoroSession
}

export async function updateCycles(id: string, cycles: number) {
  const { error } = await supabase
    .from('pomodoro_sessions')
    .update({ cycles_completed: cycles })
    .eq('id', id)
  if (error) throw error
}

export async function endSession(id: string, cycles: number) {
  const { error } = await supabase
    .from('pomodoro_sessions')
    .update({ ended_at: new Date().toISOString(), cycles_completed: cycles })
    .eq('id', id)
  if (error) throw error
}

export async function listRecentSessions(limit = 10): Promise<PomodoroSessionWithNote[]> {
  const { data, error } = await supabase
    .from('pomodoro_sessions')
    .select('*, note:notes(title)')
    .order('started_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data as unknown as PomodoroSessionWithNote[]
}
