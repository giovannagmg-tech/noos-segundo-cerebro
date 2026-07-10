-- Noos — schema inicial (Fase 1)
-- Implementa o modelo de dados do plano de arquitetura (Artifact b6ace5e8-7cd7-4bb2-a7a6-3f0623c8ce5d, v0.3):
-- Area como taxonomia unica compartilhada por Note/List/Habit; List absorve o conceito de Projeto
-- (vira projeto quando goal/status/due_date sao preenchidos); PARA e uma view computada, nao uma tabela.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- trigger utilitário para updated_at
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------------
-- area — taxonomia única compartilhada por Note, List e Habit
-- ---------------------------------------------------------------------------
create table area (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  color text,
  hub_note_id uuid, -- FK para note(id) adicionada depois de note existir (referência circular)
  created_at timestamptz not null default now(),
  unique (user_id, label)
);

-- ---------------------------------------------------------------------------
-- type — o que uma nota "é" (Curso, Idioma, Livro, Nota, Pessoa…), eixo
-- ortogonal a Area. Native types podem ser semeados por usuário; customizados
-- também vivem aqui (is_native = false).
-- ---------------------------------------------------------------------------
create table type (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  icon text,
  is_native boolean not null default false,
  properties_schema jsonb not null default '{}'::jsonb,
  layout text,
  card_view text,
  dashboard_view text,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- ---------------------------------------------------------------------------
-- note — entidade central. status='inbox' para captura rápida sem área
-- definida; vira 'permanent' na revisão semanal (fluxo Zettelkasten).
-- ---------------------------------------------------------------------------
create table note (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  type_id uuid references type(id) on delete set null,
  area_id uuid references area(id) on delete set null,
  content jsonb not null default '[]'::jsonb,
  status text not null default 'inbox' check (status in ('inbox', 'permanent')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger note_set_updated_at
  before update on note
  for each row execute function set_updated_at();

-- agora que note existe, fecha a referência circular de area.hub_note_id
alter table area
  add constraint area_hub_note_fk foreign key (hub_note_id) references note(id) on delete set null;

-- ---------------------------------------------------------------------------
-- link — backlinks entre notas. Aponta por id (não por texto do título),
-- então renomear uma nota nunca quebra o link — lição direta da doc do Notion.
-- ---------------------------------------------------------------------------
create table link (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_note_id uuid not null references note(id) on delete cascade,
  target_note_id uuid not null references note(id) on delete cascade,
  context text,
  created_at timestamptz not null default now(),
  unique (source_note_id, target_note_id),
  check (source_note_id <> target_note_id)
);

-- ---------------------------------------------------------------------------
-- tag — cruza qualquer Type ou Area (ao contrário de Collection, que é
-- sempre dentro do mesmo Type)
-- ---------------------------------------------------------------------------
create table tag (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text,
  scope text not null default 'note' check (scope in ('note', 'inline')),
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table note_tag (
  user_id uuid not null references auth.users(id) on delete cascade,
  note_id uuid not null references note(id) on delete cascade,
  tag_id uuid not null references tag(id) on delete cascade,
  primary key (note_id, tag_id)
);

-- ---------------------------------------------------------------------------
-- collection — subgrupo dentro do MESMO type (mais fino que Area)
-- ---------------------------------------------------------------------------
create table collection (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type_id uuid not null references type(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table collection_note (
  user_id uuid not null references auth.users(id) on delete cascade,
  collection_id uuid not null references collection(id) on delete cascade,
  note_id uuid not null references note(id) on delete cascade,
  primary key (collection_id, note_id)
);

-- ---------------------------------------------------------------------------
-- daily_note — uma por dia por usuário. As notas criadas naquele dia não
-- precisam de uma tabela de junção: é só note.created_at::date = daily_note.date
-- (mantém o schema enxuto, no espírito de "PARA como lente computada").
-- ---------------------------------------------------------------------------
create table daily_note (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  content jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

-- ---------------------------------------------------------------------------
-- list — dupla função: lista simples de tarefas OU Projeto, quando goal/
-- status/due_date são preenchidos. parent_list_id dá sublistas (1 nível na v1,
-- mas suporta profundidade arbitrária sem migration futura).
-- ---------------------------------------------------------------------------
create table list (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  color text,
  area_id uuid references area(id) on delete set null,
  parent_list_id uuid references list(id) on delete cascade,
  goal text,
  status text check (status in ('planejado', 'ativo', 'concluido')),
  due_date date,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- task
-- ---------------------------------------------------------------------------
create table task (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  list_id uuid not null references list(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  priority smallint not null default 1 check (priority in (0, 1, 3, 5)), -- schema TickTick: nenhuma/baixa/média/alta
  due_date date,
  quadrant smallint check (quadrant between 1 and 4), -- matriz de Eisenhower
  repeat_rule text, -- RRULE (iCalendar)
  reminders jsonb not null default '[]'::jsonb, -- formato iCal (TRIGGER:P0DT9H0M0S)
  checklist jsonb not null default '[]'::jsonb, -- items[] leve, não é subtarefa "de verdade"
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger task_set_updated_at
  before update on task
  for each row execute function set_updated_at();

create table task_note (
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null references task(id) on delete cascade,
  note_id uuid not null references note(id) on delete cascade,
  primary key (task_id, note_id)
);

-- ---------------------------------------------------------------------------
-- habit — pode sustentar um Projeto específico (list_id), além de pertencer
-- a uma Area
-- ---------------------------------------------------------------------------
create table habit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  icon text,
  frequency text not null default 'daily' check (frequency in ('daily', 'weekly')),
  period text check (period in ('manha', 'tarde', 'noite')),
  target integer,
  area_id uuid references area(id) on delete set null,
  list_id uuid references list(id) on delete set null,
  created_at timestamptz not null default now()
);

create table habit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  habit_id uuid not null references habit(id) on delete cascade,
  date date not null,
  completed boolean not null default false,
  value numeric,
  unique (habit_id, date)
);

-- ---------------------------------------------------------------------------
-- language — Idioma é uma Area especializada: area_id liga ao registro
-- unificado de área, e esta tabela só guarda os campos extras específicos.
-- ---------------------------------------------------------------------------
create table language (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  area_id uuid not null references area(id) on delete cascade,
  name text not null,
  level text,
  created_at timestamptz not null default now(),
  unique (area_id)
);

create table vocab_entry (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  language_id uuid not null references language(id) on delete cascade,
  term text not null,
  translation text,
  example text,
  srs_due date not null default current_date,
  srs_interval integer not null default 1,
  srs_ease numeric not null default 2.5, -- SM-2
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- índices — todo FK usado em filtro/join frequente
-- ---------------------------------------------------------------------------
create index note_user_area_idx on note (user_id, area_id);
create index note_user_type_idx on note (user_id, type_id);
create index note_user_status_idx on note (user_id, status);
create index link_source_idx on link (source_note_id);
create index link_target_idx on link (target_note_id);
create index list_user_area_idx on list (user_id, area_id);
create index list_parent_idx on list (parent_list_id);
create index task_list_idx on task (list_id);
create index task_user_due_idx on task (user_id, due_date);
create index habit_user_area_idx on habit (user_id, area_id);
create index habit_list_idx on habit (list_id);
create index habit_log_habit_date_idx on habit_log (habit_id, date);
create index vocab_entry_language_due_idx on vocab_entry (language_id, srs_due);

-- ---------------------------------------------------------------------------
-- Row Level Security — cada tabela só é visível/editável pelo dono (user_id).
-- Ligado desde a primeira migration, como decidido no plano de arquitetura.
-- ---------------------------------------------------------------------------
alter table area enable row level security;
alter table type enable row level security;
alter table note enable row level security;
alter table link enable row level security;
alter table tag enable row level security;
alter table note_tag enable row level security;
alter table collection enable row level security;
alter table collection_note enable row level security;
alter table daily_note enable row level security;
alter table list enable row level security;
alter table task enable row level security;
alter table task_note enable row level security;
alter table habit enable row level security;
alter table habit_log enable row level security;
alter table language enable row level security;
alter table vocab_entry enable row level security;

-- política padrão idêntica em toda tabela: o dono vê e mexe no que é dele.
-- (gerada por tabela em vez de um loop dinâmico, pra ficar explícito e
-- auditável linha a linha)
create policy "area_owner" on area for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "type_owner" on type for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "note_owner" on note for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "link_owner" on link for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "tag_owner" on tag for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "note_tag_owner" on note_tag for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "collection_owner" on collection for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "collection_note_owner" on collection_note for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "daily_note_owner" on daily_note for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "list_owner" on list for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "task_owner" on task for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "task_note_owner" on task_note for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "habit_owner" on habit for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "habit_log_owner" on habit_log for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "language_owner" on language for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "vocab_entry_owner" on vocab_entry for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
