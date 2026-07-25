import { supabase } from '@/lib/supabase'
import type { Area } from './areas'

export type DayPeriod = 'morning' | 'afternoon' | 'evening'

export type Habit = {
  id: string
  user_id: string
  area_id: string | null
  name: string
  day_period: DayPeriod
  target_days: string[] | null
  current_streak: number
  best_streak: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export type HabitWithArea = Habit & { area: Area | null }

type HabitRow = Habit & { life_areas: Area | null }

export async function listHabits(): Promise<HabitWithArea[]> {
  const { data, error } = await supabase
    .from('habits')
    .select('*, life_areas(*)')
    .eq('is_active', true)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data as unknown as HabitRow[]).map(({ life_areas, ...h }) => ({ ...h, area: life_areas }))
}

export async function getTodayCompletions(): Promise<Set<string>> {
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('habit_logs')
    .select('habit_id')
    .eq('log_date', today)
    .eq('completed', true)
  if (error) throw error
  return new Set((data ?? []).map((r) => r.habit_id))
}

export async function createHabit(input: {
  name: string
  day_period: DayPeriod
  area_id?: string | null
  target_days?: string[]
}): Promise<Habit> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('Não autenticado')
  const { data, error } = await supabase
    .from('habits')
    .insert({
      user_id: auth.user.id,
      name: input.name,
      day_period: input.day_period,
      area_id: input.area_id || null,
      target_days: input.target_days ?? ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
    })
    .select()
    .single()
  if (error) throw error
  return data as Habit
}

export type ToggleHabitLogResult = {
  completed: boolean
  current_streak: number
  best_streak: number
  milestone_reached: boolean
  milestone_points: number
}

export async function toggleHabitLog(habitId: string, logDate: string): Promise<ToggleHabitLogResult> {
  const { data, error } = await supabase.rpc('toggle_habit_log', {
    p_habit_id: habitId,
    p_log_date: logDate,
  })
  if (error) throw error
  return data as ToggleHabitLogResult
}
