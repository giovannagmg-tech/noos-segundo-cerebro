// Edge Function: generate-note-embedding
// docs/FUNCTIONS.md — gera o embedding (Gemini gemini-embedding-001,
// truncado pra 768 dim) do título+conteúdo de uma nota e grava em
// note_embeddings. note_embeddings só aceita INSERT/UPDATE via service role
// (RLS só libera SELECT ao dono) — por isso dois clientes: um escopado ao
// usuário pra validar que a nota é dele, outro service role só pro upsert.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

const EMBEDDING_MODEL = 'gemini-embedding-001'
const EMBEDDING_DIMENSIONS = 768

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return jsonResponse({ error: 'Não autenticado' }, 401)

  const geminiKey = Deno.env.get('GEMINI_API_KEY')
  if (!geminiKey) {
    return jsonResponse(
      { error: 'GEMINI_API_KEY não configurada nos secrets do Supabase' },
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

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent`,
    {
      method: 'POST',
      headers: {
        'x-goog-api-key': geminiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: { parts: [{ text }] },
        embedContentConfig: {
          taskType: 'SEMANTIC_SIMILARITY',
          outputDimensionality: EMBEDDING_DIMENSIONS,
        },
      }),
    },
  )

  if (!geminiRes.ok) {
    const detail = await geminiRes.text()
    console.error('Gemini embeddings error:', detail)
    return jsonResponse({ error: 'Falha ao gerar embedding' }, 502)
  }

  const geminiJson = await geminiRes.json()
  const rawValues: number[] | undefined = geminiJson.embedding?.values
  if (!Array.isArray(rawValues) || rawValues.length !== EMBEDDING_DIMENSIONS) {
    console.error('Resposta inesperada da Gemini:', geminiJson)
    return jsonResponse({ error: 'Resposta inesperada da API de embeddings' }, 502)
  }

  // gemini-embedding-001 só vem normalizado (norma L2 = 1) na dimensão nativa
  // (3072). Truncando pra 768 via outputDimensionality, a normalização deixa
  // de ser garantida — refazemos manualmente, senão a similaridade de
  // cosseno da RPC match_note_embeddings fica distorcida.
  const norm = Math.sqrt(rawValues.reduce((sum, v) => sum + v * v, 0))
  const embedding = norm > 0 ? rawValues.map((v) => v / norm) : rawValues

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
