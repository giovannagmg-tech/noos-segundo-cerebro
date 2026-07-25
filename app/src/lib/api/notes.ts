import { supabase } from '@/lib/supabase'
import type { ExternalReference, Note, NoteLink, NoteWithTags, SearchResult, Tag } from './types'

type NoteTagRow = { tags: Tag | null }
type NoteRow = Note & { note_tags: NoteTagRow[] }

function flattenTags(row: NoteRow): NoteWithTags {
  const { note_tags, ...note } = row
  return { ...note, tags: note_tags.map((nt) => nt.tags).filter((t): t is Tag => t !== null) }
}

export async function listNotes(): Promise<NoteWithTags[]> {
  const { data, error } = await supabase
    .from('notes')
    .select('*, note_tags(tags(*))')
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data as unknown as NoteRow[]).map(flattenTags)
}

export async function listNotesByTag(tagId: string): Promise<NoteWithTags[]> {
  const { data, error } = await supabase
    .from('notes')
    .select('*, note_tags!inner(tags(*))')
    .eq('note_tags.tag_id', tagId)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data as unknown as NoteRow[]).map(flattenTags)
}

export async function searchNotes(query: string): Promise<SearchResult[]> {
  const { data, error } = await supabase.rpc('search_notes', { query })
  if (error) throw error
  return data as SearchResult[]
}

export async function getNote(id: string): Promise<NoteWithTags | null> {
  const { data, error } = await supabase
    .from('notes')
    .select('*, note_tags(tags(*))')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ? flattenTags(data as unknown as NoteRow) : null
}

export async function createNote(input: {
  title: string
  content?: string
  source?: string
  is_quick_capture?: boolean
}): Promise<Note> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('Não autenticado')

  const { data, error } = await supabase
    .from('notes')
    .insert({
      user_id: auth.user.id,
      title: input.title,
      content: input.content ?? '',
      source: input.source ?? 'noos',
      is_quick_capture: input.is_quick_capture ?? false,
    })
    .select()
    .single()
  if (error) throw error
  return data as Note
}

export async function updateNote(id: string, patch: Partial<Pick<Note, 'title' | 'content'>>) {
  const { error } = await supabase.from('notes').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteNote(id: string) {
  const { error } = await supabase.from('notes').delete().eq('id', id)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Tags aplicadas a uma nota
// ---------------------------------------------------------------------------
export async function addTagToNote(noteId: string, tagId: string) {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('Não autenticado')
  const { error } = await supabase
    .from('note_tags')
    .insert({ note_id: noteId, tag_id: tagId, user_id: auth.user.id })
  if (error) throw error
}

export async function removeTagFromNote(noteId: string, tagId: string) {
  const { error } = await supabase
    .from('note_tags')
    .delete()
    .eq('note_id', noteId)
    .eq('tag_id', tagId)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Links entre notas (note_links) — arestas do grafo
// ---------------------------------------------------------------------------
export async function listLinksForNote(noteId: string): Promise<{
  outgoing: (NoteLink & { target: Note })[]
  incoming: (NoteLink & { source: Note })[]
}> {
  const [{ data: outgoing, error: e1 }, { data: incoming, error: e2 }] = await Promise.all([
    supabase.from('note_links').select('*, target:notes!note_links_target_note_id_fkey(*)').eq('source_note_id', noteId),
    supabase.from('note_links').select('*, source:notes!note_links_source_note_id_fkey(*)').eq('target_note_id', noteId),
  ])
  if (e1) throw e1
  if (e2) throw e2
  return {
    outgoing: (outgoing ?? []) as unknown as (NoteLink & { target: Note })[],
    incoming: (incoming ?? []) as unknown as (NoteLink & { source: Note })[],
  }
}

export async function createNoteLink(sourceNoteId: string, targetNoteId: string) {
  if (sourceNoteId === targetNoteId) throw new Error('Uma nota não pode linkar pra ela mesma')
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('Não autenticado')
  const { error } = await supabase.from('note_links').insert({
    user_id: auth.user.id,
    source_note_id: sourceNoteId,
    target_note_id: targetNoteId,
    origin: 'manual',
  })
  if (error && error.code !== '23505') throw error // ignora link duplicado (UNIQUE)
}

export async function deleteNoteLink(id: string) {
  const { error } = await supabase.from('note_links').delete().eq('id', id)
  if (error) throw error
}

// Extrai [[Título da Nota]] do conteúdo e cria note_links pra títulos que existem
export async function syncWikilinks(noteId: string, content: string, allNotes: Note[]) {
  const matches = [...content.matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1].trim().toLowerCase())
  if (!matches.length) return
  const byTitle = new Map(allNotes.map((n) => [n.title.trim().toLowerCase(), n]))
  for (const title of new Set(matches)) {
    const target = byTitle.get(title)
    if (target && target.id !== noteId) {
      await createNoteLink(noteId, target.id)
    }
  }
}

// ---------------------------------------------------------------------------
// Referências externas
// ---------------------------------------------------------------------------
export async function listExternalReferences(noteId: string): Promise<ExternalReference[]> {
  const { data, error } = await supabase
    .from('external_references')
    .select('*')
    .eq('note_id', noteId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data as ExternalReference[]
}

export async function createExternalReference(input: {
  noteId: string
  label: string
  url?: string
  refType?: string
}) {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('Não autenticado')
  const { error } = await supabase.from('external_references').insert({
    user_id: auth.user.id,
    note_id: input.noteId,
    label: input.label,
    url: input.url || null,
    ref_type: input.refType || null,
  })
  if (error) throw error
}

export async function deleteExternalReference(id: string) {
  const { error } = await supabase.from('external_references').delete().eq('id', id)
  if (error) throw error
}
