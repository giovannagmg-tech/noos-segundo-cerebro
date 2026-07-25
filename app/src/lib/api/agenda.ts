import { supabase } from '@/lib/supabase'

export type DailyAgenda = {
  events: { id: string; title: string; starts_at: string; ends_at: string | null; sync_status: string }[]
  tasks: { id: string; title: string; status: string; due_date: string; eisenhower_quadrant: string | null }[]
  habits: { id: string; name: string; day_period: string; current_streak: number }[]
}

export async function getDailyAgenda(targetDate: string): Promise<DailyAgenda> {
  const { data, error } = await supabase.rpc('get_daily_agenda', { target_date: targetDate })
  if (error) throw error
  return data as DailyAgenda
}
