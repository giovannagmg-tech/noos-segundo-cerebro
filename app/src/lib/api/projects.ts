import { supabase } from '@/lib/supabase'
import type { Area } from './areas'

export type Project = {
  id: string
  user_id: string
  area_id: string | null
  name: string
  description: string | null
  status: string
  created_at: string
  updated_at: string
}

export type ProjectWithProgress = Project & {
  area: Area | null
  taskCount: number
  doneCount: number
}

type ProjectRow = Project & { life_areas: Area | null; tasks: { status: string }[] }

function withProgress(row: ProjectRow): ProjectWithProgress {
  const { life_areas, tasks, ...project } = row
  return {
    ...project,
    area: life_areas,
    taskCount: tasks.length,
    doneCount: tasks.filter((t) => t.status === 'done').length,
  }
}

export async function listProjects(): Promise<ProjectWithProgress[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*, life_areas(*), tasks(status)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as unknown as ProjectRow[]).map(withProgress)
}

export async function getProject(id: string): Promise<ProjectWithProgress | null> {
  const { data, error } = await supabase
    .from('projects')
    .select('*, life_areas(*), tasks(status)')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ? withProgress(data as unknown as ProjectRow) : null
}

export async function createProject(input: {
  name: string
  description?: string
  area_id?: string | null
}): Promise<Project> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('Não autenticado')
  const { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: auth.user.id,
      name: input.name,
      description: input.description || null,
      area_id: input.area_id || null,
    })
    .select()
    .single()
  if (error) throw error
  return data as Project
}

export async function updateProject(
  id: string,
  patch: Partial<Pick<Project, 'name' | 'description' | 'area_id' | 'status'>>,
) {
  const { error } = await supabase.from('projects').update(patch).eq('id', id)
  if (error) throw error
}
