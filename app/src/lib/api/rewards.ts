import { supabase } from '@/lib/supabase'

export type Reward = {
  id: string
  user_id: string
  title: string
  points: number
  trigger_type: string | null
  source_id: string | null
  awarded_at: string
}

export async function listRewards(): Promise<Reward[]> {
  const { data, error } = await supabase
    .from('rewards')
    .select('*')
    .order('awarded_at', { ascending: false })
  if (error) throw error
  return data as Reward[]
}

export async function getRewardPoints(): Promise<number> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('Não autenticado')
  const { data, error } = await supabase
    .from('profiles')
    .select('reward_points')
    .eq('id', auth.user.id)
    .single()
  if (error) throw error
  return data.reward_points as number
}

export async function awardReward(input: {
  trigger_type: 'habit_streak' | 'goal_completed' | 'task_completed'
  source_id: string
  title: string
  points: number
}): Promise<{ reward_id: string; points_awarded: number; new_balance: number; already_awarded?: boolean }> {
  const { data, error } = await supabase.functions.invoke('award-reward', { body: input })
  if (error) throw error
  return data
}
