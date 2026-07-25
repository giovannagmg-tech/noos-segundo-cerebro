// Edge Function: suggest-note-connections
// docs/FUNCTIONS.md — pra uma nota, busca vizinhos por similaridade em
// note_embeddings (mesmo user_id via RPC match_note_embeddings), descarta
// pares já linkados ou já sugeridos, e grava link_suggestions pendentes
// (item B da IA). Nesta versão só roda sob demanda (note_id obrigatório) —
// o modo em lote pra notas recentes fica pro cron da Fase 3.
//
// "reason" é computado (tags em comum / score), não gerado por um segundo
// modelo de linguagem — evita uma chamada extra de IA só pra prosa.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

const DEFAULT_TOP_K = 5
const DEFAULT_MIN_SCORE = 0.5

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return jsonResponse({ error: 'Não autenticado' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError || !user) return jsonResponse({ error: 'Não autenticado' }, 401)

  let body: { note_id?: string; top_k?: number; min_score?: number }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Body inválido' }, 400)
  }
  const noteId = body.note_id
  if (!noteId) return jsonResponse({ error: 'note_id é obrigatório nesta versão' }, 400)
  const topK = body.top_k ?? DEFAULT_TOP_K
  const minScore = body.min_score ?? DEFAULT_MIN_SCORE

  const { data: matches, error: matchError } = await supabase.rpc('match_note_embeddings', {
    p_note_id: noteId,
    p_match_count: topK,
  })
  if (matchError) {
    // Nota ainda sem embedding, por exemplo — não é um erro fatal do fluxo.
    return jsonResponse({ suggestions_created: 0, items: [], reason: matchError.message })
  }

  const candidates = (matches ?? []).filter((m: { score: number }) => m.score >= minScore)
  if (candidates.length === 0) return jsonResponse({ suggestions_created: 0, items: [] })

  const candidateIds = candidates.map((c: { note_id: string }) => c.note_id)

  const [{ data: existingLinks }, { data: existingSuggestions }, { data: sourceTags }, { data: candidateNotes }] =
    await Promise.all([
      supabase
        .from('note_links')
        .select('source_note_id, target_note_id')
        .or(
          `and(source_note_id.eq.${noteId},target_note_id.in.(${candidateIds.join(',')})),` +
            `and(target_note_id.eq.${noteId},source_note_id.in.(${candidateIds.join(',')}))`,
        ),
      supabase
        .from('link_suggestions')
        .select('source_note_id, target_note_id')
        .or(
          `and(source_note_id.eq.${noteId},target_note_id.in.(${candidateIds.join(',')})),` +
            `and(target_note_id.eq.${noteId},source_note_id.in.(${candidateIds.join(',')}))`,
        ),
      supabase.from('note_tags').select('tags(name)').eq('note_id', noteId),
      supabase.from('notes').select('id, title, note_tags(tags(name))').in('id', candidateIds),
    ])

  const linkedIds = new Set(
    (existingLinks ?? []).flatMap((l) => [l.source_note_id, l.target_note_id]),
  )
  const suggestedIds = new Set(
    (existingSuggestions ?? []).flatMap((s) => [s.source_note_id, s.target_note_id]),
  )
  const sourceTagNames = new Set(
    (sourceTags ?? []).map((t) => (t.tags as unknown as { name: string })?.name).filter(Boolean),
  )
  const notesById = new Map((candidateNotes ?? []).map((n) => [n.id, n]))

  const toInsert: {
    user_id: string
    source_note_id: string
    target_note_id: string
    reason: string
    score: number
    status: 'pending'
  }[] = []

  for (const candidate of candidates) {
    if (linkedIds.has(candidate.note_id) || suggestedIds.has(candidate.note_id)) continue
    const candidateNote = notesById.get(candidate.note_id)
    const candidateTagNames: string[] = (
      (candidateNote?.note_tags as unknown as { tags: { name: string } }[]) ?? []
    )
      .map((nt) => nt.tags?.name)
      .filter(Boolean)
    const sharedTags = candidateTagNames.filter((name) => sourceTagNames.has(name))

    const reason =
      sharedTags.length > 0
        ? `Ambas compartilham as tags: ${sharedTags.join(', ')}`
        : `Notas semanticamente próximas (similaridade ${Math.round(candidate.score * 100)}%)`

    toInsert.push({
      user_id: user.id,
      source_note_id: noteId,
      target_note_id: candidate.note_id,
      reason,
      score: candidate.score,
      status: 'pending',
    })
  }

  if (toInsert.length === 0) return jsonResponse({ suggestions_created: 0, items: [] })

  const serviceClient = createClient(supabaseUrl, serviceRoleKey)
  const { error: insertError } = await serviceClient.from('link_suggestions').insert(toInsert)
  if (insertError) {
    console.error('Falha ao gravar sugestões:', insertError)
    return jsonResponse({ error: 'Falha ao gravar sugestões' }, 500)
  }

  return jsonResponse({
    suggestions_created: toInsert.length,
    items: toInsert.map((s) => ({
      target_note_id: s.target_note_id,
      score: s.score,
      reason: s.reason,
    })),
  })
})
