// Edge Function: send-deadline-alert
// docs/FUNCTIONS.md — envia por email (Resend) o alerta de prazo de uma
// tarefa ou meta, e marca deadline_alert_sent = true só depois do envio ter
// sido confirmado (evita marcar como enviado e o email na verdade falhar).
// Invocação interna via cron_deadline_alerts (service role) — não é endpoint
// público: exige Authorization == Bearer <service_role_key> exatamente,
// nunca aceita um JWT de usuário comum (nem precisa — ninguém aciona isso
// pela UI).
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

type EntityType = 'task' | 'goal'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const resendKey = Deno.env.get('RESEND_API_KEY')

  const authHeader = req.headers.get('Authorization')
  if (authHeader !== `Bearer ${serviceRoleKey}`) {
    return jsonResponse({ error: 'Não autorizado — function interna (cron/service role)' }, 401)
  }
  if (!resendKey) {
    return jsonResponse({ error: 'RESEND_API_KEY não configurada nos secrets do Supabase' }, 500)
  }

  let body: {
    user_id?: string
    entity_type?: EntityType
    entity_id?: string
    title?: string
    due_date?: string
  }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Body inválido' }, 400)
  }

  const { user_id, entity_type, entity_id, title, due_date } = body
  if (!user_id || !entity_type || !entity_id || !title || !due_date) {
    return jsonResponse(
      { error: 'user_id, entity_type, entity_id, title e due_date são obrigatórios' },
      400,
    )
  }
  if (entity_type !== 'task' && entity_type !== 'goal') {
    return jsonResponse({ error: "entity_type precisa ser 'task' ou 'goal'" }, 400)
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey)

  const { data: userResult, error: userError } = await serviceClient.auth.admin.getUserById(user_id)
  const toEmail = userResult?.user?.email
  if (userError || !toEmail) {
    console.error('Falha ao resolver email do dono:', userError)
    return jsonResponse({ error: 'Não foi possível resolver o email do usuário' }, 404)
  }

  const dueDateLabel = new Date(due_date).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: entity_type === 'task' ? 'short' : undefined,
  })
  const entityLabel = entity_type === 'task' ? 'Tarefa' : 'Meta'

  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Noos <onboarding@resend.dev>',
      to: [toEmail],
      subject: `⏰ ${entityLabel} com prazo próximo: ${title}`,
      html: `<p><strong>${entityLabel}:</strong> ${title}</p><p><strong>Prazo:</strong> ${dueDateLabel}</p><p>Este é um alerta automático do Noos.</p>`,
    }),
  })

  if (!emailRes.ok) {
    const detail = await emailRes.text()
    console.error('Falha ao enviar email via Resend:', detail)
    return jsonResponse({ error: 'Falha ao enviar o email' }, 502)
  }

  const emailJson = await emailRes.json()

  const table = entity_type === 'task' ? 'tasks' : 'goals'
  const { error: updateError } = await serviceClient
    .from(table)
    .update({ deadline_alert_sent: true })
    .eq('id', entity_id)
    .eq('user_id', user_id)
  if (updateError) {
    console.error(`Falha ao marcar deadline_alert_sent em ${table}:`, updateError)
  }

  return jsonResponse({ sent: true, provider: 'resend', message_id: emailJson.id })
})
