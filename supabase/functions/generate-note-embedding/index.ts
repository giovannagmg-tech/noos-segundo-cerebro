// Edge Function: generate-note-embedding
// docs/FUNCTIONS.md — gera o embedding (OpenAI text-embedding-3-small,
// 1536 dim) do título+conteúdo de uma nota e grava em note_embeddings.
// note_embeddings só aceita INSERT/UPDATE via service role (RLS só libera
// SELECT ao dono) — por isso dois clientes: um escopado ao usuário pra
// validar que a nota é dele, outro service role só pro upsert final.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

const EMBEDDING_MODEL = 'text-embedding-3-small'
const EMBEDDING_DIMENSIONS = 1536

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return jsonResponse({ error: 'Não autenticado' }, 401)

  const openaiKey = Deno.env.get('OPENAI_API_KEY')
  if (!openaiKey) {
    return jsonResponse(
      { error: 'OPENAI_API_KEY não configurada nos secrets do Supabase' },
      500,
    )
  }

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

  let body: { note_id?: string }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Body inválido' }, 400)
  }
  if (!body.note_id) return jsonResponse({ error: 'note_id é obrigatório' }, 400)

  // Valida que a nota existe e pertence ao caller (via RLS do cliente escopado)
  const { data: note, error: noteError } = await supabase
    .from('notes')
    .select('id, title, content')
    .eq('id', body.note_id)
    .maybeSingle()
  if (noteError || !note) return jsonResponse({ error: 'Nota não encontrada' }, 404)

  const text = `${note.title}\n\n${note.content ?? ''}`.trim().slice(0, 8000)
  if (!text) return jsonResponse({ error: 'Nota sem conteúdo pra gerar embedding' }, 400)

  const openaiRes = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: text }),
  })

  if (!openaiRes.ok) {
    const detail = await openaiRes.text()
    console.error('OpenAI embeddings error:', detail)
    return jsonResponse({ error: 'Falha ao gerar embedding' }, 502)
  }

  const openaiJson = await openaiRes.json()
  const embedding: number[] = openaiJson.data?.[0]?.embedding
  if (!Array.isArray(embedding)) {
    return jsonResponse({ error: 'Resposta inesperada da API de embeddings' }, 502)
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey)
  const { error: upsertError } = await serviceClient
    .from('note_embeddings')
    .upsert({ note_id: note.id, user_id: user.id, embedding, updated_at: new Date().toISOString() })
  if (upsertError) {
    console.error('Falha ao gravar embedding:', upsertError)
    return jsonResponse({ error: 'Falha ao gravar embedding' }, 500)
  }

  return jsonResponse({ note_id: note.id, status: 'embedded', dimensions: EMBEDDING_DIMENSIONS })
})
