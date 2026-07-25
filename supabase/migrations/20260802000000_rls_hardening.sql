-- Noos — Checagem final de RLS (docs/ESTRUTURA.md §2, README.md)
--
-- Auditoria: todas as 19 tabelas de public têm RLS habilitado (confirmado em
-- db/schemas.sql) e toda policy usa `user_id = auth.uid()` (nunca
-- auth.role() nem user_metadata) com USING + WITH CHECK em todo UPDATE.
-- Nenhuma tabela ficou sem RLS e nenhuma policy libera dado de outro dono —
-- não há gap funcional. Duas melhorias de defesa em profundidade, nenhuma
-- delas corrige um vazamento real hoje (auth.uid() já é NULL pra anon, então
-- a policy já nega por padrão), mas fecham a lacuna de forma explícita:
--
-- 1) Nenhuma policy tinha `TO authenticated` — ficavam implicitamente
--    abertas a PUBLIC (inclui `anon`). Hoje isso não vaza nada porque
--    `user_id = auth.uid()` nunca casa com NULL, mas depender disso
--    implicitamente é frágil (ex.: se anonymous sign-ins forem habilitados
--    no futuro, um usuário anônimo carrega o role `authenticated` e passaria
--    a colidir com essa checagem — ver skill de segurança do Supabase).
--    Fix: restringe explicitamente o role de cada policy.
-- 2) `handle_new_user()` é SECURITY DEFINER dentro de `public` — Postgres
--    concede EXECUTE a PUBLIC por padrão em toda function nova. Não é
--    explorável (é uma trigger function, só roda em contexto de trigger,
--    chamar direto via RPC dá erro), mas revogamos o EXECUTE mesmo assim.

-- ---------------------------------------------------------------------------
-- 1) Restringe toda policy a `authenticated`
-- ---------------------------------------------------------------------------
alter policy "profiles_select_own" on public.profiles to authenticated;
alter policy "profiles_update_own" on public.profiles to authenticated;

alter policy "notes_select_own" on public.notes to authenticated;
alter policy "notes_insert_own" on public.notes to authenticated;
alter policy "notes_update_own" on public.notes to authenticated;
alter policy "notes_delete_own" on public.notes to authenticated;

alter policy "tags_select_own" on public.tags to authenticated;
alter policy "tags_insert_own" on public.tags to authenticated;
alter policy "tags_update_own" on public.tags to authenticated;
alter policy "tags_delete_own" on public.tags to authenticated;

alter policy "note_tags_select_own" on public.note_tags to authenticated;
alter policy "note_tags_insert_own" on public.note_tags to authenticated;
alter policy "note_tags_update_own" on public.note_tags to authenticated;
alter policy "note_tags_delete_own" on public.note_tags to authenticated;

alter policy "note_links_select_own" on public.note_links to authenticated;
alter policy "note_links_insert_own" on public.note_links to authenticated;
alter policy "note_links_update_own" on public.note_links to authenticated;
alter policy "note_links_delete_own" on public.note_links to authenticated;

alter policy "external_references_select_own" on public.external_references to authenticated;
alter policy "external_references_insert_own" on public.external_references to authenticated;
alter policy "external_references_update_own" on public.external_references to authenticated;
alter policy "external_references_delete_own" on public.external_references to authenticated;

alter policy "link_suggestions_select_own" on public.link_suggestions to authenticated;
alter policy "link_suggestions_update_own" on public.link_suggestions to authenticated;

alter policy "note_embeddings_select_own" on public.note_embeddings to authenticated;

alter policy "pomodoro_sessions_select_own" on public.pomodoro_sessions to authenticated;
alter policy "pomodoro_sessions_insert_own" on public.pomodoro_sessions to authenticated;
alter policy "pomodoro_sessions_update_own" on public.pomodoro_sessions to authenticated;
alter policy "pomodoro_sessions_delete_own" on public.pomodoro_sessions to authenticated;

alter policy "life_areas_select_own" on public.life_areas to authenticated;
alter policy "life_areas_insert_own" on public.life_areas to authenticated;
alter policy "life_areas_update_own" on public.life_areas to authenticated;
alter policy "life_areas_delete_own" on public.life_areas to authenticated;

alter policy "projects_select_own" on public.projects to authenticated;
alter policy "projects_insert_own" on public.projects to authenticated;
alter policy "projects_update_own" on public.projects to authenticated;
alter policy "projects_delete_own" on public.projects to authenticated;

alter policy "tasks_select_own" on public.tasks to authenticated;
alter policy "tasks_insert_own" on public.tasks to authenticated;
alter policy "tasks_update_own" on public.tasks to authenticated;
alter policy "tasks_delete_own" on public.tasks to authenticated;

alter policy "habits_select_own" on public.habits to authenticated;
alter policy "habits_insert_own" on public.habits to authenticated;
alter policy "habits_update_own" on public.habits to authenticated;
alter policy "habits_delete_own" on public.habits to authenticated;

alter policy "habit_logs_select_own" on public.habit_logs to authenticated;
alter policy "habit_logs_insert_own" on public.habit_logs to authenticated;
alter policy "habit_logs_update_own" on public.habit_logs to authenticated;
alter policy "habit_logs_delete_own" on public.habit_logs to authenticated;

alter policy "goals_select_own" on public.goals to authenticated;
alter policy "goals_insert_own" on public.goals to authenticated;
alter policy "goals_update_own" on public.goals to authenticated;
alter policy "goals_delete_own" on public.goals to authenticated;

alter policy "rewards_select_own" on public.rewards to authenticated;

alter policy "calendar_connections_select_own" on public.calendar_connections to authenticated;

alter policy "calendar_events_select_own" on public.calendar_events to authenticated;
alter policy "calendar_events_insert_own" on public.calendar_events to authenticated;
alter policy "calendar_events_update_own" on public.calendar_events to authenticated;
alter policy "calendar_events_delete_own" on public.calendar_events to authenticated;

alter policy "ai_insights_select_own" on public.ai_insights to authenticated;
alter policy "ai_insights_delete_own" on public.ai_insights to authenticated;

-- ---------------------------------------------------------------------------
-- 2) Revoga EXECUTE público da trigger function SECURITY DEFINER
-- ---------------------------------------------------------------------------
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) private não é schema exposto pela Data API (config.toml só expõe
--    public/graphql_public) e novas schemas não recebem USAGE de PUBLIC por
--    padrão — mesmo assim, deixa explícito.
-- ---------------------------------------------------------------------------
revoke usage on schema private from public;
