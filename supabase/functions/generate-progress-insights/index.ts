// Edge Function: generate-progress-insights
// docs/FUNCTIONS.md — analisa goals, habit_logs e tasks do período e grava
// um resumo em ai_insights via Gemini 2.5 Pro. Chamada sob demanda (página
// /insights, usuário logado) ou por cron_weekly_insights (service role,
// user_id no body).
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { resolveAuth } from '../_shared/auth.ts'

type InsightType = 'goal_progress' | 'habit_summary' | 'weekly_review'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const geminiKey = Deno.env.get('GEMINI_API_KEY')
  if (!geminiKey) {
    return jsonResponse({ error: 'GEMINI_API_KEY não configurada nos secrets do Supabase' }, 500)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  let body: {
    user_id?: string
    period_start?: string
    period_end?: string
    insight_type?: InsightType
  }
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const auth = await resolveAuth(req, { supabaseUrl, anonKey, serviceRoleKey, body })
  if (!auth) return jsonResponse({ error: 'Não autenticado' }, 401)

  const insightType: InsightType = body.insight_type ?? 'weekly_review'
  const periodEnd = body.period_end ?? new Date().toISOString().slice(0, 10)
  const periodStart =
    body.period_start ?? new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10)

  const serviceClient = createClient(supabaseUrl, serviceRoleKey)

  const [{ data: goals }, { data: habitLogs }, { data: habits }, { data: tasks }] = await Promise.all([
    serviceClient
      .from('goals')
      .select('title, category, current_value, target_value, unit, status')
      .eq('user_id', auth.userId),
    serviceClient
      .from('habit_logs')
      .select('habit_id, log_date, completed')
      .eq('user_id', auth.userId)
      .gte('log_date', periodStart)
      .lte('log_date', periodEnd),
    serviceClient
      .from('habits')
      .select('id, name, current_streak, best_streak')
      .eq('user_id', auth.userId)
      .eq('is_active', true),
    serviceClient
      .from('tasks')
      .select('title, status, due_date, eisenhower_quadrant')
      .eq('user_id', auth.userId)
      .gte('due_date', periodStart)
      .lte('due_date', periodEnd),
  ])

  const completions = (habitLogs ?? []).filter((l) => l.completed).length
  const habitSummary = (habits ?? [])
    .map((h) => `- ${h.name}: sequência atual ${h.current_streak} dias (recorde ${h.best_streak})`)
    .join('\n')
  const goalSummary = (goals ?? [])
    .map((g) => {
      const progress =
        g.target_value && g.target_value > 0
          ? `${Math.round((g.current_value / g.target_value) * 100)}%`
          : g.status
      return `- ${g.title} (${g.category ?? 'sem categoria'}): ${progress}`
    })
    .join('\n')
  const taskSummary = (tasks ?? [])
    .map((t) => `- ${t.title}: ${t.status}${t.eisenhower_quadrant ? ` (${t.eisenhower_quadrant})` : ''}`)
    .join('\n')

  const prompt = `Você é um assistente de produtividade pessoal. Escreva um resumo curto (máximo 150
palavras), em português, tom encorajador mas direto, sobre o progresso do usuário entre
${periodStart} e ${periodEnd}. Destaque 1-2 pontos positivos e 1 sugestão prática. Não invente
dados fora do fornecido.

Hábitos ativos (${completions} marcações no período):
${habitSummary || '(nenhum hábito ativo)'}

Metas:
${goalSummary || '(nenhuma meta registrada)'}

Tarefas com prazo no período:
${taskSummary || '(nenhuma tarefa com prazo neste período)'}`

  const geminiRes = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent',
    {
      method: 'POST',
      headers: { 'x-goog-api-key': geminiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    },
  )

  if (!geminiRes.ok) {
    const detail = await geminiRes.text()
    console.error('Gemini generateContent error:', detail)
    return jsonResponse({ error: 'Falha ao gerar o insight' }, 502)
  }

  const geminiJson = await geminiRes.json()
  const content: string | undefined = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text
  if (!content) {
    return jsonResponse({ error: 'Resposta inesperada da IA' }, 502)
  }

  const { data: insight, error: insertError } = await serviceClient
    .from('ai_insights')
    .insert({
      user_id: auth.userId,
      insight_type: insightType,
      content: content.trim(),
      period_start: periodStart,
      period_end: periodEnd,
    })
    .select()
    .single()
  if (insertError || !insight) {
    console.error('Falha ao gravar insight:', insertError)
    return jsonResponse({ error: 'Falha ao gravar insight' }, 500)
  }

  return jsonResponse({ insight_id: insight.id, insight_type: insightType, content: content.trim() })
})
