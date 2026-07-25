import { supabase } from '@/lib/supabase'

export type AiInsight = {
  id: string
  user_id: string
  insight_type: string
  content: string
  period_start: string | null
  period_end: string | null
  created_at: string
}

export async function listInsights(): Promise<AiInsight[]> {
  const { data, error } = await supabase
    .from('ai_insights')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as AiInsight[]
}

export async function generateInsight(): Promise<{ insight_id: string; insight_type: string; content: string }> {
  const { data, error } = await supabase.functions.invoke('generate-progress-insights', { body: {} })
  if (error) throw error
  return data
}
