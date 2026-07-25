import { supabase } from '@/lib/supabase'
import type { Area } from './areas'
import type { Project } from './projects'

export type TaskStatus = 'todo' | 'doing' | 'done'
export type EisenhowerQuadrant =
  | 'urgent_important'
  | 'not_urgent_important'
  | 'urgent_not_important'
  | 'not_urgent_not_important'

export type Task = {
  id: string
  user_id: string
  area_id: string | null
  project_id: string | null
  title: string
  description: string | null
  status: TaskStatus
  kanban_order: number | null
  eisenhower_quadrant: EisenhowerQuadrant | null
  due_date: string | null
  deadline_alert_sent: boolean
  completed_at: string | null
  created_at: string
  updated_at: string
}

export type TaskWithRelations = Task & { area: Area | null; project: Project | null }

type TaskRow = Task & { life_areas: Area | null; projects: Project | null }

function withRelations(row: TaskRow): TaskWithRelations {
  const { life_areas, projects, ...task } = row
  return { ...task, area: life_areas, project: projects }
}

export async function listTasks(filter?: {
  areaId?: string | null
  projectId?: string | null
}): Promise<TaskWithRelations[]> {
  let query = supabase
    .from('tasks')
    .select('*, life_areas(*), projects(*)')
    .order('kanban_order', { ascending: true, nullsFirst: false })
  if (filter?.areaId) query = query.eq('area_id', filter.areaId)
  if (filter?.projectId) query = query.eq('project_id', filter.projectId)
  const { data, error } = await query
  if (error) throw error
  return (data as unknown as TaskRow[]).map(withRelations)
}

export async function listTasksByProject(projectId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data as Task[]
}

export async function createTask(input: {
  title: string
  description?: string
  area_id?: string | null
  project_id?: string | null
  due_date?: string | null
  eisenhower_quadrant?: EisenhowerQuadrant | null
  kanban_order?: number
}): Promise<Task> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('Não autenticado')
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      user_id: auth.user.id,
      title: input.title,
      description: input.description || null,
      area_id: input.area_id || null,
      project_id: input.project_id || null,
      due_date: input.due_date || null,
      eisenhower_quadrant: input.eisenhower_quadrant || null,
      kanban_order: input.kanban_order ?? 0,
    })
    .select()
    .single()
  if (error) throw error
  return data as Task
}

export async function updateTask(
  id: string,
  patch: Partial<
    Pick<
      Task,
      | 'title'
      | 'description'
      | 'area_id'
      | 'project_id'
      | 'due_date'
      | 'eisenhower_quadrant'
      | 'status'
      | 'kanban_order'
    >
  >,
) {
  const finalPatch: Record<string, unknown> = { ...patch }
  if (patch.status === 'done') finalPatch.completed_at = new Date().toISOString()
  if (patch.status && patch.status !== 'done') finalPatch.completed_at = null
  const { error } = await supabase.from('tasks').update(finalPatch).eq('id', id)
  if (error) throw error
}

export async function deleteTask(id: string) {
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) throw error
}

// Reordena uma coluna do kanban (ou grupo qualquer) sequencialmente após um
// drag-and-drop — mais simples que manter índice fracionário.
export async function reorderTasks(orderedIds: string[]) {
  await Promise.all(
    orderedIds.map((id, index) => supabase.from('tasks').update({ kanban_order: index }).eq('id', id)),
  )
}
