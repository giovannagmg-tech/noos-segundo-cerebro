export type Note = {
  id: string
  user_id: string
  title: string
  content: string | null
  source: string | null
  is_quick_capture: boolean
  created_at: string
  updated_at: string
}

export type Tag = {
  id: string
  user_id: string
  name: string
  color: string | null
  created_at: string
}

export type NoteLink = {
  id: string
  user_id: string
  source_note_id: string
  target_note_id: string
  origin: string
  created_at: string
}

export type ExternalReference = {
  id: string
  user_id: string
  note_id: string
  label: string
  url: string | null
  ref_type: string | null
  created_at: string
}

export type NoteWithTags = Note & { tags: Tag[] }

export type Media = {
  id: string
  user_id: string
  note_id: string | null
  storage_path: string
  public_url: string
  file_name: string
  mime_type: string | null
  size_bytes: number | null
  created_at: string
}

export type MediaWithContext = Media & { note_title: string | null; tags: Tag[] }

export type SearchResult = {
  id: string
  title: string
  snippet: string
  updated_at: string
}
