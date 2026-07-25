-- Noos — Cron Jobs (pg_cron + pg_net) | docs/ESTRUTURA.md §3, docs/FUNCTIONS.md
--
-- Os 4 jobs chamam Edge Functions via HTTP (pg_net) autenticando com a
-- service_role key. Essa chave NUNCA fica em texto no SQL (não seria seguro
-- num arquivo versionado no git) — fica só no Supabase Vault, referenciada
-- aqui só pelo NOME do secret ('project_url' / 'service_role_key'). Antes de
-- aplicar esta migration, rode uma vez no SQL Editor (com seus valores reais,
-- NUNCA cole a service_role key no chat comigo):
--
--   select vault.create_secret('https://SEU-PROJECT-REF.supabase.co', 'project_url');
--   select vault.create_secret('SUA-SERVICE-ROLE-KEY', 'service_role_key');
--
-- (Settings → API → Project URL / service_role secret, no painel do Supabase.)

-- Se estas duas linhas derem erro de permissão/schema, habilite pg_cron e
-- pg_net manualmente em Database → Extensions no painel do Supabase e rode
-- a migration de novo — o resto do arquivo independe de qual schema elas
-- foram instaladas, porque toda chamada abaixo já vem qualificada
-- (cron.schedule, net.http_post, vault.decrypted_secrets).
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Schema não exposto pela Data API (supabase/config.toml só expõe
-- public/graphql_public) — as funções de cron ficam aqui, nunca em public,
-- pra não virarem RPC pública chamável por anon/authenticated.
create schema if not exists private;

-- ---------------------------------------------------------------------------
-- private.invoke_edge_function: helper que dispara uma Edge Function via
-- pg_net, autenticando como service role (lido do Vault, nunca hardcoded).
-- ---------------------------------------------------------------------------
create or replace function private.invoke_edge_function(function_name text, payload jsonb)
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_project_url text;
  v_service_key text;
  v_request_id bigint;
begin
  select decrypted_secret into v_project_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_service_key from vault.decrypted_secrets where name = 'service_role_key';

  if v_project_url is null or v_service_key is null then
    raise exception 'Secrets project_url/service_role_key não configurados no Vault — veja o topo desta migration.';
  end if;

  select net.http_post(
    url := v_project_url || '/functions/v1/' || function_name,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key,
      'apikey', v_service_key
    ),
    body := payload
  ) into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function private.invoke_edge_function(text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- private.run_deadline_alerts — cron_deadline_alerts (a cada hora)
-- Varre tasks/goals com due_date próxima (próximas 48h, ou até 24h em
-- atraso — SUPOSIÇÃO de janela, o PROCESSO não define o limiar exato) e
-- deadline_alert_sent = false; dispara send-deadline-alert por item. Quem
-- marca deadline_alert_sent = true é a própria Edge Function, só após
-- confirmar o envio do email (evita marcar como enviado e o email falhar).
-- ---------------------------------------------------------------------------
create or replace function private.run_deadline_alerts()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  r record;
begin
  for r in
    select t.id, t.user_id, t.title, t.due_date
    from public.tasks t
    where t.deadline_alert_sent = false
      and t.due_date is not null
      and t.due_date <= now() + interval '48 hours'
      and t.due_date >= now() - interval '24 hours'
      and t.status <> 'done'
  loop
    perform private.invoke_edge_function('send-deadline-alert', jsonb_build_object(
      'user_id', r.user_id,
      'entity_type', 'task',
      'entity_id', r.id,
      'title', r.title,
      'due_date', r.due_date
    ));
  end loop;

  for r in
    select g.id, g.user_id, g.title, g.due_date
    from public.goals g
    where g.deadline_alert_sent = false
      and g.due_date is not null
      and g.due_date <= (now() + interval '48 hours')::date
      and g.due_date >= (now() - interval '24 hours')::date
      and g.status = 'active'
  loop
    perform private.invoke_edge_function('send-deadline-alert', jsonb_build_object(
      'user_id', r.user_id,
      'entity_type', 'goal',
      'entity_id', r.id,
      'title', r.title,
      'due_date', r.due_date
    ));
  end loop;
end;
$$;

revoke all on function private.run_deadline_alerts() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- private.run_daily_suggestions — cron_daily_suggestions (diário)
-- Roda suggest-note-connections pras notas criadas/editadas nas últimas 24h.
-- ---------------------------------------------------------------------------
create or replace function private.run_daily_suggestions()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  r record;
begin
  for r in
    select id, user_id
    from public.notes
    where updated_at >= now() - interval '24 hours'
  loop
    perform private.invoke_edge_function('suggest-note-connections', jsonb_build_object(
      'note_id', r.id,
      'user_id', r.user_id,
      'top_k', 5
    ));
  end loop;
end;
$$;

revoke all on function private.run_daily_suggestions() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- private.run_weekly_insights — cron_weekly_insights (semanal)
-- Roda generate-progress-insights (weekly_review) uma vez por dono que tenha
-- pelo menos goal/habit/task ativo — não gera insight vazio pra dono sem uso.
-- ---------------------------------------------------------------------------
create or replace function private.run_weekly_insights()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  r record;
begin
  for r in
    select p.id as user_id
    from public.profiles p
    where exists (select 1 from public.goals g where g.user_id = p.id)
       or exists (select 1 from public.habits h where h.user_id = p.id and h.is_active)
       or exists (select 1 from public.tasks t where t.user_id = p.id)
  loop
    perform private.invoke_edge_function('generate-progress-insights', jsonb_build_object(
      'user_id', r.user_id,
      'insight_type', 'weekly_review',
      'period_start', (current_date - interval '7 days')::date,
      'period_end', current_date
    ));
  end loop;
end;
$$;

revoke all on function private.run_weekly_insights() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- private.run_calendar_sync — cron_calendar_sync (a cada 15 min)
-- Roda google-calendar-sync (direction=both) pra cada conta conectada.
-- ---------------------------------------------------------------------------
create or replace function private.run_calendar_sync()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  r record;
begin
  for r in
    select user_id from public.calendar_connections where provider = 'google'
  loop
    perform private.invoke_edge_function('google-calendar-sync', jsonb_build_object(
      'user_id', r.user_id,
      'direction', 'both'
    ));
  end loop;
end;
$$;

revoke all on function private.run_calendar_sync() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Agendamentos
-- ---------------------------------------------------------------------------
select cron.schedule('cron_deadline_alerts', '0 * * * *', $$select private.run_deadline_alerts();$$);
select cron.schedule('cron_daily_suggestions', '0 3 * * *', $$select private.run_daily_suggestions();$$);
select cron.schedule('cron_weekly_insights', '0 4 * * 1', $$select private.run_weekly_insights();$$);
select cron.schedule('cron_calendar_sync', '*/15 * * * *', $$select private.run_calendar_sync();$$);

-- ---------------------------------------------------------------------------
-- RPC de apoio pro modo cron de suggest-note-connections: mesma lógica de
-- match_note_embeddings, mas recebendo p_user_id explícito em vez de ler
-- auth.uid() (que é NULL numa chamada autenticada via service role). SECURITY
-- DEFINER pra poder ler note_embeddings de qualquer dono, mas só concedida ao
-- service_role — nunca a anon/authenticated — então não é uma porta lateral
-- pra ler embedding de outro usuário via RPC pública.
-- ---------------------------------------------------------------------------
create or replace function public.match_note_embeddings_for_user(
  p_note_id uuid,
  p_user_id uuid,
  p_match_count int default 5
)
returns table (note_id uuid, score float)
language sql
stable
security definer
set search_path = public
as $$
  select
    ne2.note_id,
    1 - (ne1.embedding <=> ne2.embedding) as score
  from public.note_embeddings ne1
  join public.note_embeddings ne2
    on ne2.user_id = ne1.user_id
   and ne2.note_id <> ne1.note_id
  where ne1.note_id = p_note_id
    and ne1.user_id = p_user_id
  order by ne1.embedding <=> ne2.embedding
  limit p_match_count;
$$;

revoke all on function public.match_note_embeddings_for_user(uuid, uuid, int) from public, anon, authenticated;
grant execute on function public.match_note_embeddings_for_user(uuid, uuid, int) to service_role;
