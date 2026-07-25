## Estrutura Técnica — Noos (Segundo Cérebro)

**Caminho de build escolhido: Lovable + Supabase** (neste repositório, construído via Claude Code seguindo a mesma stack de frontend — React + Tailwind + shadcn/ui — só que escrita em código). No dossiê você se descreve como usuário único que hoje organiza conhecimento em Notion e Obsidian, sem menção a time de TI ou capacidade de codar. Para tirar o Noos do papel pelo caminho mais rápido — do zero ao app no ar — o Lovable (React + Tailwind + shadcn/ui com integração nativa ao Supabase) é o default forte. Mesmo funcionalidades sofisticadas como grafo visual, Pomodoro e IA de sugestões são perfeitamente construíveis nesse caminho, com toda a lógica pesada isolada em Edge Functions do Supabase. O backend é **Supabase** (PostgreSQL + RLS + Auth + Storage + Edge Functions + Realtime + pg_cron), não negociável.

Toda a modelagem já nasce **multi-tenant por `user_id`** — mesmo no uso pessoal inicial. Isso é intencional: você indicou que "poderia evoluir para um produto SaaS no futuro", e ter `user_id` + RLS desde o primeiro dia significa que virar SaaS depois é ligar Auth para novos usuários, sem refazer arquitetura. Fase 1 (notas, grafo, tags, Pomodoro, captura mobile) e Fase 2 (tarefas, projetos, hábitos, metas, agenda, IA) já vêm modeladas.

---

## 1. Modelo de dados

### FASE 1 — Conhecimento

#### `profiles`
Propósito: guarda os dados do dono do segundo cérebro (e futuros assinantes SaaS), espelhando `auth.users`.
- `id` uuid PK (= `auth.users.id`)
- `display_name` text
- `avatar_url` text
- `reward_points` integer NOT NULL default 0 (saldo de recompensas — Fase 2)
- `created_at` timestamptz NOT NULL default now()
- Índices: PK em `id`.

#### `notes`
Propósito: cada anotação de conhecimento (curso, ideia, referência) que vira nó do grafo.
- `id` uuid PK default gen_random_uuid()
- `user_id` uuid NOT NULL FK → profiles(id)
- `title` text NOT NULL
- `content` text (markdown do corpo)
- `source` text (origem: 'notion', 'obsidian', 'noos', 'mobile_capture')
- `is_quick_capture` boolean NOT NULL default false (marca capturas rápidas do mobile a organizar depois)
- `created_at` timestamptz NOT NULL default now()
- `updated_at` timestamptz NOT NULL default now()
- Índices: `idx_notes_user_id` (user_id); `idx_notes_user_updated` (user_id, updated_at desc); `idx_notes_quick_capture` (user_id, is_quick_capture) para a inbox de capturas; índice GIN full-text em `to_tsvector(title || content)` para busca.

#### `tags`
Propósito: rótulos de área (marketing, branding, neurociência etc.) para organizar e filtrar notas e o grafo.
- `id` uuid PK default gen_random_uuid()
- `user_id` uuid NOT NULL FK → profiles(id)
- `name` text NOT NULL
- `color` text (hex para colorir nós do grafo)
- `created_at` timestamptz NOT NULL default now()
- Índices: `idx_tags_user_id` (user_id); UNIQUE (user_id, name) para evitar tag duplicada por dono.

#### `note_tags`
Propósito: relação N:N entre notas e tags (uma nota recebe uma ou mais tags de área).
- `note_id` uuid NOT NULL FK → notes(id) ON DELETE CASCADE
- `tag_id` uuid NOT NULL FK → tags(id) ON DELETE CASCADE
- `user_id` uuid NOT NULL FK → profiles(id) (desnormalizado para RLS simples)
- PK composta (note_id, tag_id)
- Índices: `idx_note_tags_tag_id` (tag_id) para filtrar grafo por tag; `idx_note_tags_note_id` (note_id).

#### `note_links`
Propósito: conexão dirigida entre duas notas (referência cruzada de conhecimento); alimenta as arestas do grafo visual.
- `id` uuid PK default gen_random_uuid()
- `user_id` uuid NOT NULL FK → profiles(id)
- `source_note_id` uuid NOT NULL FK → notes(id) ON DELETE CASCADE
- `target_note_id` uuid NOT NULL FK → notes(id) ON DELETE CASCADE
- `origin` text NOT NULL default 'manual' ('manual' ou 'ai_suggested' quando vem da sugestão da IA aceita)
- `created_at` timestamptz NOT NULL default now()
- Índices: `idx_note_links_source` (source_note_id); `idx_note_links_target` (target_note_id); `idx_note_links_user` (user_id); UNIQUE (source_note_id, target_note_id) para não duplicar aresta.

#### `external_references`
Propósito: referências externas de uma nota (curso, autor, fonte, URL) citadas no texto.
- `id` uuid PK default gen_random_uuid()
- `user_id` uuid NOT NULL FK → profiles(id)
- `note_id` uuid NOT NULL FK → notes(id) ON DELETE CASCADE
- `label` text NOT NULL
- `url` text
- `ref_type` text ('course','author','article','other')
- `created_at` timestamptz NOT NULL default now()
- Índices: `idx_external_references_note` (note_id); `idx_external_references_user` (user_id).

#### `link_suggestions`
Propósito: sugestões automáticas de conexão entre notas geradas pela IA (item B), pendentes de aceite do dono.
- `id` uuid PK default gen_random_uuid()
- `user_id` uuid NOT NULL FK → profiles(id)
- `source_note_id` uuid NOT NULL FK → notes(id) ON DELETE CASCADE
- `target_note_id` uuid NOT NULL FK → notes(id) ON DELETE CASCADE
- `reason` text (justificativa da IA para a conexão)
- `score` numeric (similaridade)
- `status` text NOT NULL default 'pending' ('pending','accepted','dismissed')
- `created_at` timestamptz NOT NULL default now()
- Índices: `idx_link_suggestions_user_status` (user_id, status); `idx_link_suggestions_source` (source_note_id).

#### `note_embeddings`
Propósito: guarda o vetor de embedding de cada nota para busca semântica e sugestão de conexões (usa extensão `pgvector`).
- `note_id` uuid PK FK → notes(id) ON DELETE CASCADE
- `user_id` uuid NOT NULL FK → profiles(id)
- `embedding` vector(768) — gemini-embedding-001 truncado (Matryoshka) de 3072 pra 768 dim
- `updated_at` timestamptz NOT NULL default now()
- Índices: índice `ivfflat`/`hnsw` em `embedding` (vector_cosine_ops); `idx_note_embeddings_user` (user_id).

#### `pomodoro_sessions`
Propósito: registra cada sessão/ciclo de Pomodoro executado durante estudo ou revisão.
- `id` uuid PK default gen_random_uuid()
- `user_id` uuid NOT NULL FK → profiles(id)
- `note_id` uuid FK → notes(id) ON DELETE SET NULL (nota em foco, opcional)
- `started_at` timestamptz NOT NULL default now()
- `ended_at` timestamptz
- `focus_minutes` integer NOT NULL default 25
- `cycles_completed` integer NOT NULL default 0
- Índices: `idx_pomodoro_user` (user_id); `idx_pomodoro_user_started` (user_id, started_at desc).

### FASE 2 — Produtividade e Vida

#### `life_areas`
Propósito: áreas da vida / listas que agrupam tarefas, metas e hábitos (ex: Carreira, Saúde, Estudos).
- `id` uuid PK default gen_random_uuid()
- `user_id` uuid NOT NULL FK → profiles(id)
- `name` text NOT NULL
- `color` text
- `created_at` timestamptz NOT NULL default now()
- Índices: `idx_life_areas_user` (user_id); UNIQUE (user_id, name).

#### `projects`
Propósito: projeto que agrupa várias tarefas e acompanha andamento.
- `id` uuid PK default gen_random_uuid()
- `user_id` uuid NOT NULL FK → profiles(id)
- `area_id` uuid FK → life_areas(id) ON DELETE SET NULL
- `name` text NOT NULL
- `description` text
- `status` text NOT NULL default 'active' ('active','completed','archived')
- `created_at` timestamptz NOT NULL default now()
- Índices: `idx_projects_user` (user_id); `idx_projects_area` (area_id).

#### `tasks`
Propósito: tarefa pertencente a uma área/lista, opcionalmente vinculada a um projeto, com quadrante de Eisenhower e prazo.
- `id` uuid PK default gen_random_uuid()
- `user_id` uuid NOT NULL FK → profiles(id)
- `area_id` uuid FK → life_areas(id) ON DELETE SET NULL
- `project_id` uuid FK → projects(id) ON DELETE SET NULL
- `title` text NOT NULL
- `description` text
- `status` text NOT NULL default 'todo' ('todo','doing','done')
- `kanban_order` integer (posição na coluna kanban)
- `eisenhower_quadrant` text ('urgent_important','not_urgent_important','urgent_not_important','not_urgent_not_important')
- `due_date` timestamptz (usado por alertas de prazo e visão calendário)
- `deadline_alert_sent` boolean NOT NULL default false
- `completed_at` timestamptz
- `created_at` timestamptz NOT NULL default now()
- Índices: `idx_tasks_user` (user_id); `idx_tasks_project` (project_id); `idx_tasks_area` (area_id); `idx_tasks_user_due` (user_id, due_date); `idx_tasks_user_status` (user_id, status).

#### `habits`
Propósito: hábito recorrente agrupado por período do dia, exibido no dashboard estilo TickTick.
- `id` uuid PK default gen_random_uuid()
- `user_id` uuid NOT NULL FK → profiles(id)
- `area_id` uuid FK → life_areas(id) ON DELETE SET NULL
- `name` text NOT NULL
- `day_period` text NOT NULL ('morning','afternoon','evening')
- `target_days` text[] (dias da semana previstos)
- `current_streak` integer NOT NULL default 0
- `best_streak` integer NOT NULL default 0
- `is_active` boolean NOT NULL default true
- `created_at` timestamptz NOT NULL default now()
- Índices: `idx_habits_user` (user_id); `idx_habits_user_period` (user_id, day_period).

#### `habit_logs`
Propósito: registro diário de cumprimento de um hábito (gera histórico e sequências).
- `id` uuid PK default gen_random_uuid()
- `user_id` uuid NOT NULL FK → profiles(id)
- `habit_id` uuid NOT NULL FK → habits(id) ON DELETE CASCADE
- `log_date` date NOT NULL
- `completed` boolean NOT NULL default true
- `created_at` timestamptz NOT NULL default now()
- Índices: `idx_habit_logs_habit_date` (habit_id, log_date); UNIQUE (habit_id, log_date); `idx_habit_logs_user_date` (user_id, log_date).

#### `goals`
Propósito: meta de vida organizada por categoria, acompanhada por métricas de progresso.
- `id` uuid PK default gen_random_uuid()
- `user_id` uuid NOT NULL FK → profiles(id)
- `area_id` uuid FK → life_areas(id) ON DELETE SET NULL
- `title` text NOT NULL
- `category` text
- `target_value` numeric
- `current_value` numeric NOT NULL default 0
- `unit` text
- `due_date` date (usado por alertas de prazo)
- `deadline_alert_sent` boolean NOT NULL default false
- `status` text NOT NULL default 'active' ('active','achieved','abandoned')
- `created_at` timestamptz NOT NULL default now()
- Índices: `idx_goals_user` (user_id); `idx_goals_area` (area_id); `idx_goals_user_due` (user_id, due_date).

#### `rewards`
Propósito: recompensa concedida ao dono por sequência de hábitos ou conclusão de metas/tarefas.
- `id` uuid PK default gen_random_uuid()
- `user_id` uuid NOT NULL FK → profiles(id)
- `title` text NOT NULL
- `points` integer NOT NULL default 0
- `trigger_type` text ('habit_streak','goal_completed','task_completed')
- `source_id` uuid (id do hábito/meta/tarefa que disparou)
- `awarded_at` timestamptz NOT NULL default now()
- Índices: `idx_rewards_user` (user_id); `idx_rewards_user_awarded` (user_id, awarded_at desc).

#### `calendar_connections`
Propósito: guarda os tokens OAuth da conta Google Calendar vinculada para sincronização bidirecional.
- `id` uuid PK default gen_random_uuid()
- `user_id` uuid NOT NULL FK → profiles(id)
- `provider` text NOT NULL default 'google'
- `access_token` text NOT NULL
- `refresh_token` text NOT NULL
- `token_expires_at` timestamptz
- `calendar_id` text
- `created_at` timestamptz NOT NULL default now()
- Índices: `idx_calendar_connections_user` (user_id); UNIQUE (user_id, provider).

#### `calendar_events`
Propósito: cache local dos eventos do Google Calendar para exibir e editar dentro do Noos e compor a agenda do dia.
- `id` uuid PK default gen_random_uuid()
- `user_id` uuid NOT NULL FK → profiles(id)
- `google_event_id` text
- `title` text NOT NULL
- `starts_at` timestamptz NOT NULL
- `ends_at` timestamptz
- `sync_status` text NOT NULL default 'synced' ('synced','pending_push','local_only')
- `updated_at` timestamptz NOT NULL default now()
- Índices: `idx_calendar_events_user_start` (user_id, starts_at); UNIQUE (user_id, google_event_id).

#### `ai_insights`
Propósito: resumos e insights de progresso sobre metas e hábitos gerados pela IA (item C).
- `id` uuid PK default gen_random_uuid()
- `user_id` uuid NOT NULL FK → profiles(id)
- `insight_type` text NOT NULL ('goal_progress','habit_summary','weekly_review')
- `content` text NOT NULL
- `period_start` date
- `period_end` date
- `created_at` timestamptz NOT NULL default now()
- Índices: `idx_ai_insights_user_created` (user_id, created_at desc).

---

## 2. RLS e autenticação

**Autenticação:** Supabase Auth. No uso pessoal inicial, entra por **magic link** (sem senha, ideal para dono único) e/ou **email+senha**. Já deixamos habilitado **OAuth Google** — necessário de qualquer forma para a integração com Google Calendar (Fase 2) e útil como login. Um trigger `handle_new_user` cria a linha em `profiles` a cada novo `auth.users` (prepara o terreno para o modo SaaS futuro).

**Princípio geral:** RLS **ligado em todas as tabelas**. Toda tabela tem `user_id` e a política padrão é `user_id = auth.uid()` para as quatro operações. Isso garante isolamento total por dono desde já — quando virar SaaS, cada assinante enxerga só o próprio segundo cérebro sem mudança de código.

- **profiles**: SELECT/UPDATE apenas onde `id = auth.uid()`. INSERT feito pelo trigger (service role). DELETE bloqueado (só via admin).
- **notes, tags, note_tags, note_links, external_references, link_suggestions, note_embeddings, pomodoro_sessions**: SELECT/INSERT/UPDATE/DELETE somente onde `user_id = auth.uid()`. Em `note_tags` o `user_id` desnormalizado permite a checagem direta sem join. `note_embeddings` e `link_suggestions` só recebem INSERT/UPDATE via **service role** (Edge Functions de IA), mas SELECT continua restrito ao dono.
- **life_areas, projects, tasks, habits, habit_logs, goals, rewards, calendar_events, ai_insights**: SELECT/INSERT/UPDATE/DELETE somente onde `user_id = auth.uid()`. `rewards` e `ai_insights` são escritos por Edge Functions/cron via service role (concessão automática); o dono só faz SELECT. `calendar_events` é escrito pela função de sync (service role) e pelo dono (edições locais → push).
- **calendar_connections**: SELECT restrito ao dono; INSERT/UPDATE/DELETE de tokens apenas via **service role** (Edge Function de OAuth) — tokens nunca são manipulados direto pelo frontend.

---

## 3. Functions/endpoints

### Postgres RPCs
- `get_knowledge_graph(filter_tag_id uuid default null)` — retorna nós (`notes`) e arestas (`note_links`) do dono, opcionalmente filtrados por tag/área, em um único payload para o grafo. Chamada ao abrir a página do grafo.
- `search_notes(query text)` — busca full-text + (opcional) semântica nas notas do dono. Chamada na busca da UI.
- `toggle_habit_log(habit_id uuid, log_date date)` — marca/desmarca cumprimento do dia, recalcula `current_streak`/`best_streak` e dispara recompensa se atingir marco. Chamada ao clicar num hábito no dashboard.
- `get_daily_agenda(target_date date)` — consolida `calendar_events`, `tasks` com `due_date` no dia e hábitos previstos naquele período; alimenta a agenda do dia inteligente.
- `get_dashboard_metrics()` — taxas de cumprimento de hábitos, progresso de metas e contagem de tarefas por status/quadrante. Alimenta a página de métricas.

### Supabase Edge Functions (Deno)
- `import-note` — recebe conteúdo colado do Notion/Obsidian, cria a nota, extrai links `[[...]]` e monta `note_links`, e enfileira geração de embedding. Chamada na importação incremental.
- `generate-note-embedding` — gera embedding da nota via API de IA e grava em `note_embeddings`. Chamada por trigger após criar/editar nota (webhook interno) e em backfill.
- `suggest-note-connections` — para uma nota, busca vizinhos por similaridade em `note_embeddings` e grava `link_suggestions` pendentes (item B). Chamada ao salvar nota e por cron diário.
- `generate-progress-insights` — analisa `goals`, `habit_logs` e `tasks` do período e grava `ai_insights` (item C). Chamada por cron semanal e sob demanda.
- `google-calendar-oauth` — troca o code OAuth por tokens e grava em `calendar_connections`. Chamada no fluxo de conexão da conta Google.
- `google-calendar-sync` — puxa eventos do Google (pull) para `calendar_events` e envia edições locais `pending_push` (push) — sincronização bidirecional. Chamada por cron periódico e ao editar um evento no Noos.
- `award-reward` — concede recompensa e soma `reward_points` em `profiles` conforme streak/conclusão. Chamada por `toggle_habit_log` e por triggers de meta/tarefa concluída.

### Cron Jobs (pg_cron)
- `cron_deadline_alerts` (a cada hora) — varre `tasks` e `goals` com `due_date` próxima e `deadline_alert_sent = false`, dispara alertas via `send-deadline-alert` e marca como enviado.
- `cron_daily_suggestions` (diário) — roda `suggest-note-connections` para notas recentes.
- `cron_weekly_insights` (semanal) — roda `generate-progress-insights`.
- `cron_calendar_sync` (a cada 15 min) — roda `google-calendar-sync` para contas conectadas.
- `send-deadline-alert` (Edge Function) — envia o alerta de prazo por email (Resend).

---

## 4. Páginas do frontend

### Fase 1
- `/login` — autenticação por magic link / email / Google.
- `/notes` — lista e inbox de notas, incluindo capturas rápidas (`is_quick_capture`) a organizar; busca por texto e filtro por tag.
- `/notes/:id` — editor da nota: título, conteúdo markdown, tags, links para outras notas, referências externas e painel de sugestões da IA (`link_suggestions`).
- `/graph` — grafo visual interativo das notas e conexões; filtro por tag/área; clique no nó abre a nota.
- `/tags` — gestão das tags de área (marketing, branding, neurociência) e suas cores.
- `/pomodoro` — timer Pomodoro vinculável a uma nota, registrando `pomodoro_sessions`.
- `/capture` — página enxuta mobile-first para captura rápida de nota (título + conteúdo), a organizar depois na web.

### Fase 2
- `/tasks` — tarefas em três visões (lista, kanban, calendário) filtradas por área/lista, com vínculo a projeto.
- `/tasks/eisenhower` — matriz de Eisenhower classificando tarefas por quadrante urgente/importante.
- `/projects` — lista de projetos e detalhe com tarefas vinculadas e andamento.
- `/habits` — dashboard de hábitos agrupado por período do dia (manhã/tarde/noite) com marcação e streaks.
- `/goals` — metas de vida por categoria com barras de progresso por métrica.
- `/metrics` — métricas consolidadas de hábitos, metas e tarefas (via `get_dashboard_metrics`).
- `/rewards` — histórico de recompensas e saldo de `reward_points`.
- `/agenda` — agenda do dia inteligente (compromissos + tarefas do dia + hábitos previstos).
- `/calendar` — visão de calendário integrada ao Google Calendar (visualizar/editar eventos).
- `/insights` — resumos e insights de progresso gerados pela IA (`ai_insights`).
- `/settings` — perfil, conexão da conta Google Calendar e preferências.

---

## 5. Integrações externas

Todas chamadas **exclusivamente via Supabase Edge Functions** (chaves e tokens nunca ficam no frontend).

- **API de IA — embeddings + sugestões (item B):** Gemini (`gemini-embedding-001`, truncado via Matryoshka pra `vector(768)`) para gerar `note_embeddings` e alimentar `suggest-note-connections`. Trocado de OpenAI pra Gemini a pedido do dono — tier gratuito de verdade (sem cartão de crédito) via chave do Google AI Studio, suficiente pro volume pessoal (centenas de notas). Motivo: encontrar notas semanticamente próximas que você ainda não linkou, mesmo entre áreas distintas (marketing ↔ neurociência).
- **API de IA — resumos e insights (item C):** para `generate-progress-insights`, recomendo **Gemini 2.5 Pro** (contexto de até 1M tokens, custo baixo) por lidar bem com muito histórico de hábitos/metas de uma vez; alternativa **GPT 5.4** como default mainstream de ótimo custo/qualidade. Motivo: gerar resumos e direcionamento sobre seu progresso. Como o volume é pessoal (centenas de notas), o custo por uso é baixo.
- **Google Calendar API (OAuth 2.0):** via `google-calendar-oauth` e `google-calendar-sync` para leitura e escrita bidirecional de eventos dentro do Noos. Motivo: você pediu explicitamente visualizar e editar seus compromissos dentro do app.
- **Resend (email):** para `send-deadline-alert` (alertas de prazo de tarefas e metas). Motivo: notificar vencimentos. O free tier (100 emails/dia) cobre folgado o uso pessoal.

### Custo estimado (uso pessoal, centenas de notas)
- **Lovable:** Free ou Pro R$95/mês quando precisar de mais projetos/deploy.
- **Supabase:** Free cobre 500MB, 50K auth e 500K edge invocations — suficiente no início; migrar para Pro R$125/mês só quando o acervo/uso crescer.
- **APIs de IA:** embeddings no tier gratuito do Gemini (`gemini-embedding-001`, sem cartão de crédito); insights (Gemini 2.5 Pro) pague-por-uso, poucos dólares/mês nesse volume.
- **Resend:** Free.
- **Google Calendar API:** gratuita.
