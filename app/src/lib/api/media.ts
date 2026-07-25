import { supabase } from '@/lib/supabase'
import type { Media, MediaWithContext, Tag } from './types'

const BUCKET = 'note-media'
const MAX_SIZE_BYTES = 15 * 1024 * 1024

// Sobe uma imagem colada/arrastada no editor de uma nota: grava no Storage,
// cria a linha em media (com o note_id de origem) e herda as tags que a
// nota tem NESTE momento (snapshot, não um vínculo ao vivo — ver migration).
export async function uploadNoteImage(noteId: string, file: File): Promise<Media> {
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error('Imagem maior que 15MB — reduza o tamanho antes de enviar.')
  }
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('Não autenticado')

  const ext = file.name.includes('.') ? file.name.split('.').pop() : 'png'
  const path = `${auth.user.id}/${noteId}/${crypto.randomUUID()}.${ext}`

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  })
  if (uploadError) throw uploadError

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path)

  const { data: media, error: insertError } = await supabase
    .from('media')
    .insert({
      user_id: auth.user.id,
      note_id: noteId,
      storage_path: path,
      public_url: publicUrl,
      file_name: file.name,
      mime_type: file.type || null,
      size_bytes: file.size,
    })
    .select()
    .single()
  if (insertError) {
    await supabase.storage.from(BUCKET).remove([path])
    throw insertError
  }

  const { data: noteTags } = await supabase.from('note_tags').select('tag_id').eq('note_id', noteId)
  if (noteTags?.length) {
    await supabase
      .from('media_tags')
      .insert(noteTags.map((nt) => ({ media_id: media.id, tag_id: nt.tag_id, user_id: auth.user!.id })))
  }

  return media as Media
}

export async function listMedia(): Promise<MediaWithContext[]> {
  const { data, error } = await supabase
    .from('media')
    .select('*, notes(title), media_tags(tags(*))')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (
    data as unknown as (Media & {
      notes: { title: string } | null
      media_tags: { tags: Tag | null }[]
    })[]
  ).map((row) => ({
    ...row,
    note_title: row.notes?.title ?? null,
    tags: row.media_tags.map((mt) => mt.tags).filter((t): t is Tag => t !== null),
  }))
}

export async function deleteMedia(media: Pick<Media, 'id' | 'storage_path'>) {
  const { error } = await supabase.from('media').delete().eq('id', media.id)
  if (error) throw error
  await supabase.storage.from(BUCKET).remove([media.storage_path])
}
