-- =====================================================================
-- Noos — Segundo Cérebro | db/schemas.sql
-- Backend: Supabase (PostgreSQL + RLS + pgvector)
-- =====================================================================

-- Extensões necessárias
create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- =====================================================================
-- Function + trigger reutilizável de updated_at
-- =====================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =====================================================================
-- Trigger handle_new_user: cria profile ao criar auth.users
-- =====================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

-- =====================================================================
-- FASE 1 — CONHECIMENTO
-- =====================================================================

-- ---------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  reward_points integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid());
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Trigger de criação de profile (após tabela existir)
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- notes
-- ---------------------------------------------------------------------
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  content text,
  source text,
  is_quick_capture boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_notes_user_id on public.notes (user_id);
create index idx_notes_user_updated on public.notes (user_id, updated_at desc);
create index idx_notes_quick_capture on public.notes (user_id, is_quick_capture);
create index idx_notes_fts on public.notes
  using gin (to_tsvector('portuguese', coalesce(title,'') || ' ' || coalesce(content,'')));

create trigger trg_notes_updated_at
  before update on public.notes
  for each row execute function public.set_updated_at();

alter table public.notes enable row level security;

create policy "notes_select_own" on public.notes
  for select using (user_id = auth.uid());
create policy "notes_insert_own" on public.notes
  for insert with check (user_id = auth.uid());
create policy "notes_update_own" on public.notes
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notes_delete_own" on public.notes
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- tags
-- ---------------------------------------------------------------------
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create index idx_tags_user_id on public.tags (user_id);

create trigger trg_tags_updated_at
  before update on public.tags
  for each row execute function public.set_updated_at();

alter table public.tags enable row level security;

create policy "tags_select_own" on public.tags
  for select using (user_id = auth.uid());
create policy "tags_insert_own" on public.tags
  for insert with check (user_id = auth.uid());
create policy "tags_update_own" on public.tags
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "tags_delete_own" on public.tags
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- note_tags (N:N notes x tags)
-- ---------------------------------------------------------------------
create table public.note_tags (
  note_id uuid not null references public.notes(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (note_id, tag_id)
);

create index idx_note_tags_tag_id on public.note_tags (tag_id);
create index idx_note_tags_note_id on public.note_tags (note_id);
create index idx_note_tags_user_id on public.note_tags (user_id);

create trigger trg_note_tags_updated_at
  before update on public.note_tags
  for each row execute function public.set_updated_at();

alter table public.note_tags enable row level security;

create policy "note_tags_select_own" on public.note_tags
  for select using (user_id = auth.uid());
create policy "note_tags_insert_own" on public.note_tags
  for insert with check (user_id = auth.uid());
create policy "note_tags_update_own" on public.note_tags
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "note_tags_delete_own" on public.note_tags
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- note_links (arestas do grafo)
-- ---------------------------------------------------------------------
create table public.note_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source_note_id uuid not null references public.notes(id) on delete cascade,
  target_note_id uuid not null references public.notes(id) on delete cascade,
  origin text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_note_id, target_note_id)
);

create index idx_note_links_source on public.note_links (source_note_id);
create index idx_note_links_target on public.note_links (target_note_id);
create index idx_note_links_user on public.note_links (user_id);

create trigger trg_note_links_updated_at
  before update on public.note_links
  for each row execute function public.set_updated_at();

alter table public.note_links enable row level security;

create policy "note_links_select_own" on public.note_links
  for select using (user_id = auth.uid());
create policy "note_links_insert_own" on public.note_links
  for insert with check (user_id = auth.uid());
create policy "note_links_update_own" on public.note_links
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "note_links_delete_own" on public.note_links
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- external_references
-- ---------------------------------------------------------------------
create table public.external_references (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  note_id uuid not null references public.notes(id) on delete cascade,
  label text not null,
  url text,
  ref_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_external_references_note on public.external_references (note_id);
create index idx_external_references_user on public.external_references (user_id);

create trigger trg_external_references_updated_at
  before update on public.external_references
  for each row execute function public.set_updated_at();

alter table public.external_references enable row level security;

create policy "external_references_select_own" on public.external_references
  for select using (user_id = auth.uid());
create policy "external_references_insert_own" on public.external_references
  for insert with check (user_id = auth.uid());
create policy "external_references_update_own" on public.external_references
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "external_references_delete_own" on public.external_references
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- link_suggestions (IA — item B) | escrita via service role
-- ---------------------------------------------------------------------
create table public.link_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source_note_id uuid not null references public.notes(id) on delete cascade,
  target_note_id uuid not null references public.notes(id) on delete cascade,
  reason text,
  score numeric,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_link_suggestions_user_status on public.link_suggestions (user_id, status);
create index idx_link_suggestions_source on public.link_suggestions (source_note_id);

create trigger trg_link_suggestions_updated_at
  before update on public.link_suggestions
  for each row execute function public.set_updated_at();

alter table public.link_suggestions enable row level security;

-- SELECT e UPDATE (aceitar/dispensar) pelo dono; INSERT/DELETE ficam a cargo do service role
create policy "link_suggestions_select_own" on public.link_suggestions
  for select using (user_id = auth.uid());
create policy "link_suggestions_update_own" on public.link_suggestions
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- note_embeddings (pgvector) | escrita via service role
-- ---------------------------------------------------------------------
create table public.note_embeddings (
  note_id uuid primary key references public.notes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  embedding vector(1536),
  updated_at timestamptz not null default now()
);

create index idx_note_embeddings_user on public.note_embeddings (user_id);
create index idx_note_embeddings_vector on public.note_embeddings
  using hnsw (embedding vector_cosine_ops);

create trigger trg_note_embeddings_updated_at
  before update on public.note_embeddings
  for each row execute function public.set_updated_at();

alter table public.note_embeddings enable row level security;

-- Somente SELECT ao dono; INSERT/UPDATE via service role (Edge Functions de IA)
create policy "note_embeddings_select_own" on public.note_embeddings
  for select using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- pomodoro_sessions
-- ---------------------------------------------------------------------
create table public.pomodoro_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  note_id uuid references public.notes(id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  focus_minutes integer not null default 25,
  cycles_completed integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_pomodoro_user on public.pomodoro_sessions (user_id);
create index idx_pomodoro_user_started on public.pomodoro_sessions (user_id, started_at desc);
create index idx_pomodoro_note on public.pomodoro_sessions (note_id);

create trigger trg_pomodoro_sessions_updated_at
  before update on public.pomodoro_sessions
  for each row execute function public.set_updated_at();

alter table public.pomodoro_sessions enable row level security;

create policy "pomodoro_sessions_select_own" on public.pomodoro_sessions
  for select using (user_id = auth.uid());
create policy "pomodoro_sessions_insert_own" on public.pomodoro_sessions
  for insert with check (user_id = auth.uid());
create policy "pomodoro_sessions_update_own" on public.pomodoro_sessions
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "pomodoro_sessions_delete_own" on public.pomodoro_sessions
  for delete using (user_id = auth.uid());

-- =====================================================================
-- FASE 2 — PRODUTIVIDADE E VIDA
-- =====================================================================

-- ---------------------------------------------------------------------
-- life_areas
-- ---------------------------------------------------------------------
create table public.life_areas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create index idx_life_areas_user on public.life_areas (user_id);

create trigger trg_life_areas_updated_at
  before update on public.life_areas
  for each row execute function public.set_updated_at();

alter table public.life_areas enable row level security;

create policy "life_areas_select_own" on public.life_areas
  for select using (user_id = auth.uid());
create policy "life_areas_insert_own" on public.life_areas
  for insert with check (user_id = auth.uid());
create policy "life_areas_update_own" on public.life_areas
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "life_areas_delete_own" on public.life_areas
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  area_id uuid references public.life_areas(id) on delete set null,
  name text not null,
  description text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_projects_user on public.projects (user_id);
create index idx_projects_area on public.projects (area_id);

create trigger trg_projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

alter table public.projects enable row level security;

create policy "projects_select_own" on public.projects
  for select using (user_id = auth.uid());
create policy "projects_insert_own" on public.projects
  for insert with check (user_id = auth.uid());
create policy "projects_update_own" on public.projects
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "projects_delete_own" on public.projects
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  area_id uuid references public.life_areas(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'todo',
  kanban_order integer,
  eisenhower_quadrant text,
  due_date timestamptz,
  deadline_alert_sent boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_tasks_user on public.tasks (user_id);
create index idx_tasks_project on public.tasks (project_id);
create index idx_tasks_area on public.tasks (area_id);
create index idx_tasks_user_due on public.tasks (user_id, due_date);
create index idx_tasks_user_status on public.tasks (user_id, status);

create trigger trg_tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

alter table public.tasks enable row level security;

create policy "tasks_select_own" on public.tasks
  for select using (user_id = auth.uid());
create policy "tasks_insert_own" on public.tasks
  for insert with check (user_id = auth.uid());
create policy "tasks_update_own" on public.tasks
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "tasks_delete_own" on public.tasks
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- habits
-- ---------------------------------------------------------------------
create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  area_id uuid references public.life_areas(id) on delete set null,
  name text not null,
  day_period text not null,
  target_days text[],
  current_streak integer not null default 0,
  best_streak integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_habits_user on public.habits (user_id);
create index idx_habits_user_period on public.habits (user_id, day_period);
create index idx_habits_area on public.habits (area_id);

create trigger trg_habits_updated_at
  before update on public.habits
  for each row execute function public.set_updated_at();

alter table public.habits enable row level security;

create policy "habits_select_own" on public.habits
  for select using (user_id = auth.uid());
create policy "habits_insert_own" on public.habits
  for insert with check (user_id = auth.uid());
create policy "habits_update_own" on public.habits
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "habits_delete_own" on public.habits
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- habit_logs
-- ---------------------------------------------------------------------
create table public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  habit_id uuid not null references public.habits(id) on delete cascade,
  log_date date not null,
  completed boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (habit_id, log_date)
);

create index idx_habit_logs_habit_date on public.habit_logs (habit_id, log_date);
create index idx_habit_logs_user_date on public.habit_logs (user_id, log_date);

create trigger trg_habit_logs_updated_at
  before update on public.habit_logs
  for each row execute function public.set_updated_at();

alter table public.habit_logs enable row level security;

create policy "habit_logs_select_own" on public.habit_logs
  for select using (user_id = auth.uid());
create policy "habit_logs_insert_own" on public.habit_logs
  for insert with check (user_id = auth.uid());
create policy "habit_logs_update_own" on public.habit_logs
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "habit_logs_delete_own" on public.habit_logs
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- goals
-- ---------------------------------------------------------------------
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  area_id uuid references public.life_areas(id) on delete set null,
  title text not null,
  category text,
  target_value numeric,
  current_value numeric not null default 0,
  unit text,
  due_date date,
  deadline_alert_sent boolean not null default false,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_goals_user on public.goals (user_id);
create index idx_goals_area on public.goals (area_id);
create index idx_goals_user_due on public.goals (user_id, due_date);

create trigger trg_goals_updated_at
  before update on public.goals
  for each row execute function public.set_updated_at();

alter table public.goals enable row level security;

create policy "goals_select_own" on public.goals
  for select using (user_id = auth.uid());
create policy "goals_insert_own" on public.goals
  for insert with check (user_id = auth.uid());
create policy "goals_update_own" on public.goals
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "goals_delete_own" on public.goals
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- rewards | escrita via service role (concessão automática)
-- ---------------------------------------------------------------------
create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  points integer not null default 0,
  trigger_type text,
  source_id uuid,
  awarded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_rewards_user on public.rewards (user_id);
create index idx_rewards_user_awarded on public.rewards (user_id, awarded_at desc);

create trigger trg_rewards_updated_at
  before update on public.rewards
  for each row execute function public.set_updated_at();

alter table public.rewards enable row level security;

-- Somente SELECT ao dono; INSERT via service role (award-reward)
create policy "rewards_select_own" on public.rewards
  for select using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- calendar_connections | tokens só via service role
-- ---------------------------------------------------------------------
create table public.calendar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null default 'google',
  access_token text not null,
  refresh_token text not null,
  token_expires_at timestamptz,
  calendar_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create index idx_calendar_connections_user on public.calendar_connections (user_id);

create trigger trg_calendar_connections_updated_at
  before update on public.calendar_connections
  for each row execute function public.set_updated_at();

alter table public.calendar_connections enable row level security;

-- Somente SELECT ao dono; INSERT/UPDATE/DELETE de tokens via service role (OAuth)
create policy "calendar_connections_select_own" on public.calendar_connections
  for select using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- calendar_events (cache local do Google Calendar)
-- ---------------------------------------------------------------------
create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  google_event_id text,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  sync_status text not null default 'synced',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, google_event_id)
);

create index idx_calendar_events_user_start on public.calendar_events (user_id, starts_at);

create trigger trg_calendar_events_updated_at
  before update on public.calendar_events
  for each row execute function public.set_updated_at();

alter table public.calendar_events enable row level security;

-- Dono lê e edita (edições locais viram pending_push); sync via service role também escreve
create policy "calendar_events_select_own" on public.calendar_events
  for select using (user_id = auth.uid());
create policy "calendar_events_insert_own" on public.calendar_events
  for insert with check (user_id = auth.uid());
create policy "calendar_events_update_own" on public.calendar_events
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "calendar_events_delete_own" on public.calendar_events
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- ai_insights (IA — item C) | escrita via service role/cron
-- ---------------------------------------------------------------------
create table public.ai_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  insight_type text not null,
  content text not null,
  period_start date,
  period_end date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_ai_insights_user_created on public.ai_insights (user_id, created_at desc);

create trigger trg_ai_insights_updated_at
  before update on public.ai_insights
  for each row execute function public.set_updated_at();

alter table public.ai_insights enable row level security;

-- Somente SELECT ao dono; INSERT via service role (generate-progress-insights)
create policy "ai_insights_select_own" on public.ai_insights
  for select using (user_id = auth.uid());
create policy "ai_insights_delete_own" on public.ai_insights
  for delete using (user_id = auth.uid());
