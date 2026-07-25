import { supabase } from '@/lib/supabase'

export type DashboardMetrics = {
  habits: { total: number; completed_today: number; avg_streak: number }
  goals: { total: number; active: number; achieved: number }
  tasks_by_status: Record<string, number>
  tasks_by_quadrant: Record<string, number>
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const { data, error } = await supabase.rpc('get_dashboard_metrics')
  if (error) throw error
  return data as DashboardMetrics
}
