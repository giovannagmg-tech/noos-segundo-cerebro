import { supabase } from '@/lib/supabase'
import type { Tag } from './types'

export type TagWithCount = Tag & { note_count: number }

export async function listTags(): Promise<TagWithCount[]> {
  const { data, error } = await supabase
    .from('tags')
    .select('*, note_tags(count)')
    .order('name', { ascending: true })
  if (error) throw error
  return (data as unknown as (Tag & { note_tags: { count: number }[] })[]).map((t) => ({
    ...t,
    note_count: t.note_tags?.[0]?.count ?? 0,
  }))
}

export async function createTag(name: string, color: string): Promise<Tag> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('Não autenticado')
  const { data, error } = await supabase
    .from('tags')
    .insert({ user_id: auth.user.id, name, color })
    .select()
    .single()
  if (error) throw error
  return data as Tag
}

export async function updateTag(id: string, patch: Partial<Pick<Tag, 'name' | 'color'>>) {
  const { error } = await supabase.from('tags').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteTag(id: string) {
  const { error } = await supabase.from('tags').delete().eq('id', id)
  if (error) throw error
}
