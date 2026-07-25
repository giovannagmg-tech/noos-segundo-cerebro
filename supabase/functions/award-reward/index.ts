// Edge Function: award-reward
// docs/FUNCTIONS.md — concede uma recompensa e credita profiles.reward_points.
// Chamada pelo frontend após toggle_habit_log sinalizar milestone_reached, ou
// ao marcar uma meta como alcançada. user_id vem do JWT (auth.getUser), nunca
// do body — evita que alguém peça recompensa em nome de outro usuário.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

type TriggerType = 'habit_streak' | 'goal_completed' | 'task_completed'

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

  let body: {
    trigger_type?: TriggerType
    source_id?: string
    title?: string
    points?: number
  }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Body inválido' }, 400)
  }

  const { trigger_type, source_id, title, points } = body
  if (!trigger_type || !source_id || !title || !points) {
    return jsonResponse({ error: 'trigger_type, source_id, title e points são obrigatórios' }, 400)
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey)

  // Idempotência: mesmo (dono, gatilho, origem, título) não gera duas
  // recompensas — título carrega o marco específico (ex.: "Sequência de 7
  // dias — Busuu"), então marcos diferentes do mesmo hábito continuam
  // premiando normalmente.
  const { data: existing, error: existingError } = await serviceClient
    .from('rewards')
    .select('id, points')
    .eq('user_id', user.id)
    .eq('trigger_type', trigger_type)
    .eq('source_id', source_id)
    .eq('title', title)
    .maybeSingle()
  if (existingError) {
    console.error('Falha ao checar idempotência:', existingError)
    return jsonResponse({ error: 'Falha ao conceder recompensa' }, 500)
  }
  if (existing) {
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('reward_points')
      .eq('id', user.id)
      .single()
    return jsonResponse({
      reward_id: existing.id,
      points_awarded: 0,
      new_balance: profile?.reward_points ?? 0,
      already_awarded: true,
    })
  }

  const { data: reward, error: rewardError } = await serviceClient
    .from('rewards')
    .insert({
      user_id: user.id,
      title,
      points,
      trigger_type,
      source_id,
    })
    .select()
    .single()
  if (rewardError || !reward) {
    console.error('Falha ao gravar recompensa:', rewardError)
    return jsonResponse({ error: 'Falha ao conceder recompensa' }, 500)
  }

  const { data: profile, error: profileError } = await serviceClient
    .from('profiles')
    .select('reward_points')
    .eq('id', user.id)
    .single()
  if (profileError || !profile) {
    return jsonResponse({ error: 'Falha ao ler saldo de pontos' }, 500)
  }

  const newBalance = (profile.reward_points ?? 0) + points
  const { error: updateError } = await serviceClient
    .from('profiles')
    .update({ reward_points: newBalance })
    .eq('id', user.id)
  if (updateError) {
    console.error('Falha ao atualizar saldo:', updateError)
    return jsonResponse({ error: 'Falha ao atualizar saldo' }, 500)
  }

  return jsonResponse({ reward_id: reward.id, points_awarded: points, new_balance: newBalance })
})
