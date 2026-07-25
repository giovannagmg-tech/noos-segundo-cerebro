import { supabase } from '@/lib/supabase'
import type { Area } from './areas'

export type Goal = {
  id: string
  user_id: string
  area_id: string | null
  title: string
  category: string | null
  target_value: number | null
  current_value: number
  unit: string | null
  due_date: string | null
  deadline_alert_sent: boolean
  status: string
  created_at: string
  updated_at: string
}

export type GoalWithArea = Goal & { area: Area | null }

type GoalRow = Goal & { life_areas: Area | null }

export async function listGoals(): Promise<GoalWithArea[]> {
  const { data, error } = await supabase
    .from('goals')
    .select('*, life_areas(*)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as unknown as GoalRow[]).map(({ life_areas, ...g }) => ({ ...g, area: life_areas }))
}

export async function createGoal(input: {
  title: string
  category?: string
  area_id?: string | null
  target_value?: number | null
  unit?: string
  due_date?: string | null
}): Promise<Goal> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('Não autenticado')
  const { data, error } = await supabase
    .from('goals')
    .insert({
      user_id: auth.user.id,
      title: input.title,
      category: input.category || null,
      area_id: input.area_id || null,
      target_value: input.target_value ?? null,
      unit: input.unit || null,
      due_date: input.due_date || null,
    })
    .select()
    .single()
  if (error) throw error
  return data as Goal
}

export async function updateGoal(
  id: string,
  patch: Partial<Pick<Goal, 'current_value' | 'status' | 'title' | 'target_value' | 'unit'>>,
) {
  const { error } = await supabase.from('goals').update(patch).eq('id', id)
  if (error) throw error
}
