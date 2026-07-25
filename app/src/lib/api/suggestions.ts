import { supabase } from '@/lib/supabase'

export type PendingSuggestion = {
  id: string
  source_note_id: string
  target_note_id: string
  reason: string | null
  score: number | null
  otherNoteId: string
  otherNoteTitle: string
}

export async function listSuggestionsForNote(noteId: string): Promise<PendingSuggestion[]> {
  const { data, error } = await supabase
    .from('link_suggestions')
    .select('id, source_note_id, target_note_id, reason, score')
    .or(`source_note_id.eq.${noteId},target_note_id.eq.${noteId}`)
    .eq('status', 'pending')
  if (error) throw error

  const rows = data ?? []
  const otherIds = rows.map((r) => (r.source_note_id === noteId ? r.target_note_id : r.source_note_id))
  if (otherIds.length === 0) return []

  const { data: notes, error: notesError } = await supabase
    .from('notes')
    .select('id, title')
    .in('id', otherIds)
  if (notesError) throw notesError
  const titleById = new Map((notes ?? []).map((n) => [n.id, n.title]))

  return rows.map((r) => {
    const otherId = r.source_note_id === noteId ? r.target_note_id : r.source_note_id
    return {
      id: r.id,
      source_note_id: r.source_note_id,
      target_note_id: r.target_note_id,
      reason: r.reason,
      score: r.score,
      otherNoteId: otherId,
      otherNoteTitle: titleById.get(otherId) ?? 'Sem título',
    }
  })
}

export async function acceptSuggestion(s: PendingSuggestion) {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('Não autenticado')

  const { error: updateError } = await supabase
    .from('link_suggestions')
    .update({ status: 'accepted' })
    .eq('id', s.id)
  if (updateError) throw updateError

  const { error: linkError } = await supabase.from('note_links').insert({
    user_id: auth.user.id,
    source_note_id: s.source_note_id,
    target_note_id: s.target_note_id,
    origin: 'ai_suggested',
  })
  if (linkError && linkError.code !== '23505') throw linkError
}

export async function dismissSuggestion(id: string) {
  const { error } = await supabase.from('link_suggestions').update({ status: 'dismissed' }).eq('id', id)
  if (error) throw error
}

// Roda a IA de conhecimento pra uma nota: gera o embedding e, em seguida,
// busca sugestões de conexão. Best-effort — chamado depois de salvar uma
// nota; se as Edge Functions ainda não estiverem deployadas/configuradas
// (sem OPENAI_API_KEY nos secrets, por exemplo), falha em silêncio.
export async function generateEmbeddingAndSuggestions(noteId: string) {
  const { error: embedError } = await supabase.functions.invoke('generate-note-embedding', {
    body: { note_id: noteId },
  })
  if (embedError) throw embedError
  await supabase.functions.invoke('suggest-note-connections', { body: { note_id: noteId } })
}

export type ImportNoteResult = {
  note_id: string
  created_links: number
  unresolved_links: string[]
  embedding_queued: boolean
}

export async function importNote(payload: {
  title: string
  content: string
  source: 'notion' | 'obsidian'
}): Promise<ImportNoteResult> {
  const { data, error } = await supabase.functions.invoke('import-note', { body: payload })
  if (error) throw error
  return data as ImportNoteResult
}
