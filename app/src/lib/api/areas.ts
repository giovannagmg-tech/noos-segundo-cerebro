import { supabase } from '@/lib/supabase'

export type Area = {
  id: string
  user_id: string
  name: string
  color: string | null
  created_at: string
}

export async function listAreas(): Promise<Area[]> {
  const { data, error } = await supabase.from('life_areas').select('*').order('name')
  if (error) throw error
  return data as Area[]
}

export async function createArea(name: string, color: string): Promise<Area> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('Não autenticado')
  const { data, error } = await supabase
    .from('life_areas')
    .insert({ user_id: auth.user.id, name, color })
    .select()
    .single()
  if (error) throw error
  return data as Area
}

export async function updateArea(id: string, patch: Partial<Pick<Area, 'name' | 'color'>>) {
  const { error } = await supabase.from('life_areas').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteArea(id: string) {
  const { error } = await supabase.from('life_areas').delete().eq('id', id)
  if (error) throw error
}
