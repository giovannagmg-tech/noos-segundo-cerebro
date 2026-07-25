// Edge Function: import-note
// docs/FUNCTIONS.md — importa incrementalmente uma nota colada do Notion/Obsidian:
// cria a nota, extrai wikilinks [[...]] materializando note_links, associa tags
// e referências externas, e dispara a geração de embedding (chamada síncrona
// a generate-note-embedding — sem infra de fila/cron nesta versão).
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

type ImportNoteBody = {
  title: string
  content: string
  source?: 'notion' | 'obsidian' | 'noos' | 'mobile_capture'
  tag_ids?: string[]
  external_references?: { label: string; url?: string; ref_type?: string }[]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return jsonResponse({ error: 'Não autenticado' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  // Cliente escopado ao usuário (JWT do caller) — RLS aplica normalmente.
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError || !user) return jsonResponse({ error: 'Não autenticado' }, 401)

  let body: ImportNoteBody
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Body inválido' }, 400)
  }

  const { title, content, source = 'noos', tag_ids = [], external_references = [] } = body
  if (!title?.trim() || !content?.trim()) {
    return jsonResponse({ error: 'title e content são obrigatórios' }, 400)
  }

  // 1) Cria a nota
  const { data: note, error: noteError } = await supabase
    .from('notes')
    .insert({ user_id: user.id, title: title.trim(), content, source })
    .select()
    .single()
  if (noteError || !note) {
    return jsonResponse({ error: noteError?.message ?? 'Falha ao criar nota' }, 500)
  }

  // 2) Extrai [[Título da Nota]] e materializa note_links pra alvos existentes
  const wikilinkMatches = [...content.matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1].trim())
  const uniqueTitles = [...new Set(wikilinkMatches)]
  const createdLinks: string[] = []
  const unresolvedLinks: string[] = []

  if (uniqueTitles.length > 0) {
    const { data: candidateNotes } = await supabase
      .from('notes')
      .select('id, title')
      .neq('id', note.id)

    const byTitle = new Map(
      (candidateNotes ?? []).map((n) => [n.title.trim().toLowerCase(), n.id]),
    )

    for (const wikiTitle of uniqueTitles) {
      const targetId = byTitle.get(wikiTitle.toLowerCase())
      if (!targetId) {
        unresolvedLinks.push(wikiTitle)
        continue
      }
      const { error: linkError } = await supabase.from('note_links').insert({
        user_id: user.id,
        source_note_id: note.id,
        target_note_id: targetId,
        origin: 'manual',
      })
      // 23505 = violação de UNIQUE (link já existe) — não é erro real
      if (!linkError || linkError.code === '23505') createdLinks.push(wikiTitle)
    }
  }

  // 3) Tags — só aplica as que pertencem ao dono (docs/FUNCTIONS.md: "ignora
  // tags que não pertencem ao dono")
  if (tag_ids.length > 0) {
    const { data: ownTags } = await supabase.from('tags').select('id').in('id', tag_ids)
    const ownTagIds = (ownTags ?? []).map((t) => t.id)
    if (ownTagIds.length > 0) {
      await supabase
        .from('note_tags')
        .insert(ownTagIds.map((tagId) => ({ note_id: note.id, tag_id: tagId, user_id: user.id })))
    }
  }

  // 4) Referências externas
  if (external_references.length > 0) {
    await supabase.from('external_references').insert(
      external_references.map((ref) => ({
        user_id: user.id,
        note_id: note.id,
        label: ref.label,
        url: ref.url ?? null,
        ref_type: ref.ref_type ?? null,
      })),
    )
  }

  // 5) Dispara o embedding (síncrono nesta versão — sem fila/cron ainda).
  // Falha em gerar embedding não deve derrubar a importação da nota.
  let embeddingQueued = false
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/generate-note-embedding`, {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ note_id: note.id }),
    })
    embeddingQueued = res.ok
  } catch (err) {
    console.error('Falha ao enfileirar embedding:', err)
  }

  return jsonResponse({
    note_id: note.id,
    created_links: createdLinks.length,
    unresolved_links: unresolvedLinks,
    embedding_queued: embeddingQueued,
  })
})
