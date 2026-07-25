# docs/FUNCTIONS.md — Noos (Segundo Cérebro)

Este documento detalha **todas as functions/endpoints** do backend Supabase do Noos, cobrindo Edge Functions (Deno), Postgres RPCs, triggers de tabela e Cron Jobs (pg_cron). Os nomes seguem exatamente os definidos em `docs/ESTRUTURA.md`. Onde uma regra de negócio do `docs/PROCESSO.md` exigiu uma function não detalhada explicitamente na ESTRUTURA, ela foi **adicionada e sinalizada como extensão**.

**Convenções gerais de autenticação**
- **Usuário logado:** a Edge Function/RPC roda no contexto do JWT do Supabase Auth; RLS garante `user_id = auth.uid()`. É o padrão para tudo que o dono aciona pela UI.
- **Service role:** funções que escrevem em tabelas restritas (`note_embeddings`, `link_suggestions`, `ai_insights`, `rewards`, `calendar_events`, `calendar_connections`) usam a `service_role key` internamente, mas **sempre validam o `user_id` do dono** antes de gravar.
- **Cron:** funções disparadas por pg_cron rodam com privilégios elevados no banco e, quando chamam Edge Functions, usam a service role.
- Chaves de APIs externas (OpenAI, Gemini, Google, Resend) **nunca ficam no frontend** — só nas Edge Functions (secrets do Supabase).

---

## Edge Functions

### `import-note`
- **Propósito:** importa incrementalmente uma anotação colada do Notion/Obsidian, criando a nota, extraindo links `[[...]]` e enfileirando o embedding.
- **Input (body):**
  ```json
  {
    "title": "string (obrigatório)",
    "content": "string markdown (obrigatório)",
    "source": "notion | obsidian | noos | mobile_capture",
    "tag_ids": ["uuid", "..."],
    "external_references": [
      { "label": "string", "url": "string", "ref_type": "course|author|article|other" }
    ]
  }
  ```
- **Output:**
  ```json
  {
    "note_id": "uuid",
    "created_links": 3,
    "unresolved_links": ["Título não encontrado"],
    "embedding_queued": true
  }
  ```
- **Regras de negócio/validações:**
  - `title` e `content` obrigatórios; `source` default `noos`.
  - Cria a linha em `notes` com `user_id = auth.uid()`.
  - Faz parsing de wikilinks `[[Título da Nota]]` no conteúdo; para cada alvo existente do mesmo dono, cria uma aresta em `note_links` com `origin = 'manual'` (respeitando o UNIQUE `source/target`). Alvos não encontrados retornam em `unresolved_links` (não bloqueiam).
  - Associa `tag_ids` em `note_tags` (preenchendo o `user_id` desnormalizado); ignora tags que não pertencem ao dono.
  - Grava `external_references` vinculadas à nota.
  - Ao final, dispara/enfileira `generate-note-embedding` para a nota criada.
  - Importação é **nota a nota** (nunca migração em massa) — conforme regra do PROCESSO.
- **Autenticação:** usuário logado.

---

### `generate-note-embedding`
- **Propósito:** gera o vetor de embedding do conteúdo de uma nota e grava/atualiza em `note_embeddings`.
- **Input (body):**
  ```json
  { "note_id": "uuid (obrigatório)" }
  ```
- **Output:**
  ```json
  { "note_id": "uuid", "status": "embedded", "dimensions": 1536 }
  ```
- **Regras de negócio/validações:**
  - Carrega `title || content` da nota, valida que a nota pertence ao `user_id` esperado.
  - Chama **OpenAI `text-embedding-3-small`** → `vector(1536)`.
  - Faz UPSERT em `note_embeddings` (PK `note_id`), atualizando `updated_at` e preenchendo `user_id`.
  - Escreve via **service role** (tabela `note_embeddings` só aceita INSERT/UPDATE por service role), mas preserva o `user_id` real da nota.
  - Idempotente: reprocessar a mesma nota apenas sobrescreve o vetor. Suporta modo **backfill** (lote de `note_id`s).
- **Autenticação:** usuário logado (chamada direta pela UI ao salvar) **ou** invocação interna via service role (trigger/backfill).

---

### `suggest-note-connections`
- **Propósito:** encontra notas semanticamente próximas ainda não linkadas e grava sugestões de conexão pendentes (item B da IA).
- **Input (body):**
  ```json
  {
    "note_id": "uuid",
    "top_k": 5
  }
  ```
- **Output:**
  ```json
  {
    "suggestions_created": 4,
    "items": [
      { "target_note_id": "uuid", "score": 0.89, "reason": "Ambas tratam de gatilhos de memória / neuromarketing" }
    ]
  }
  ```
- **Regras de negócio/validações:**
  - Usa o vetor da nota em `note_embeddings` e busca vizinhos por `vector_cosine_ops` **apenas dentro do mesmo `user_id`** (isolamento por dono).
  - Descarta pares que **já existem** em `note_links` (não sugere o que já está conectado).
  - Descarta sugestões já com status `accepted`/`dismissed` para o mesmo par (não repropõe).
  - Aplica limiar mínimo de `score`; grava as aprovadas em `link_suggestions` com `status = 'pending'`, `reason` e `score`.
  - Grava via **service role** (respeitando RLS de leitura do dono).
  - Valoriza conexões **entre áreas distintas** (ex.: marketing ↔ neurociência), conforme intenção do PROCESSO.
- **Autenticação:** usuário logado (ao salvar nota) **ou** cron via service role (`cron_daily_suggestions`).

---

### `generate-progress-insights`
- **Propósito:** analisa metas, hábitos e tarefas do período e gera resumos/insights de progresso (item C da IA).
- **Input (body):**
  ```json
  {
    "period_start": "date",
    "period_end": "date",
    "insight_type": "goal_progress | habit_summary | weekly_review"
  }
  ```
- **Output:**
  ```json
  {
    "insight_id": "uuid",
    "insight_type": "weekly_review",
    "content": "Resumo textual + direcionamentos gerados pela IA"
  }
  ```
- **Regras de negócio/validações:**
  - Consolida `goals` (progresso `current_value`/`target_value`), `habit_logs` (taxas de cumprimento e streaks) e `tasks` (concluídas/pendentes por status/quadrante) do dono no período.
  - Chama a **API de IA** — **Gemini 2.5 Pro** (contexto longo, custo baixo) para digerir muito histórico de uma vez; **GPT 5.4** como alternativa mainstream.
  - Grava o resultado em `ai_insights` com `insight_type`, `content`, `period_start`, `period_end` via **service role**.
  - A IA atua **exclusivamente sobre o conteúdo do próprio dono** (regra do PROCESSO). O dono só faz SELECT sobre `ai_insights`.
- **Autenticação:** usuário logado (sob demanda pela página `/insights`) **ou** cron semanal via service role (`cron_weekly_insights`).

---

### `google-calendar-oauth`
- **Propósito:** troca o `code` do fluxo OAuth do Google pelos tokens de acesso/refresh e persiste a conexão do calendário.
- **Input (body):**
  ```json
  {
    "code": "string (authorization code do Google)",
    "redirect_uri": "string"
  }
  ```
- **Output:**
  ```json
  { "connected": true, "calendar_id": "primary", "provider": "google" }
  ```
- **Regras de negócio/validações:**
  - Faz a troca `code → tokens` no endpoint OAuth do Google (client_id/secret nos secrets da função).
  - Grava/atualiza `calendar_connections` (`access_token`, `refresh_token`, `token_expires_at`, `calendar_id`) via **service role** — tokens **nunca** transitam pelo frontend.
  - Respeita o UNIQUE `(user_id, provider)` (uma conexão Google por dono — UPSERT).
  - Valida que o `state` do OAuth corresponde ao usuário logado (proteção CSRF).
- **Autenticação:** usuário logado (inicia o fluxo em `/settings`).

---

### `google-calendar-sync`
- **Propósito:** sincroniza eventos bidirecionalmente entre Google Calendar e `calendar_events` (pull do Google + push de edições locais).
- **Input (body):**
  ```json
  {
    "user_id": "uuid",
    "direction": "both | pull | push"
  }
  ```
- **Output:**
  ```json
  { "pulled": 12, "pushed": 3, "conflicts": 0, "token_refreshed": false }
  ```
- **Regras de negócio/validações:**
  - Lê `calendar_connections`; se `token_expires_at` expirou, usa o `refresh_token` para renovar e atualiza a conexão.
  - **Pull:** busca eventos do Google e faz UPSERT em `calendar_events` (UNIQUE `user_id, google_event_id`), marcando `sync_status = 'synced'`.
  - **Push:** envia ao Google os eventos com `sync_status = 'pending_push'` (edições locais) e `local_only` (criados no Noos), atualizando `google_event_id` e status para `synced`.
  - Resolve conflitos por `updated_at` mais recente (last-write-wins).
  - Escreve `calendar_events` via **service role**; SELECT/edição local continuam do dono.
- **Autenticação:** usuário logado (ao editar um evento no Noos) **ou** cron a cada 15 min via service role (`cron_calendar_sync`).

---

### `award-reward`
- **Propósito:** concede uma recompensa e credita pontos ao dono por streak de hábito ou conclusão de meta/tarefa.
- **Input (body):**
  ```json
  {
    "user_id": "uuid",
    "trigger_type": "habit_streak | goal_completed | task_completed",
    "source_id": "uuid",
    "title": "string",
    "points": 10
  }
  ```
- **Output:**
  ```json
  { "reward_id": "uuid", "points_awarded": 10, "new_balance": 120 }
  ```
- **Regras de negócio/validações:**
  - Insere em `rewards` (`trigger_type`, `source_id`, `points`, `awarded_at`) e incrementa `profiles.reward_points` de forma atômica, via **service role** (concessão automática — o dono só faz SELECT).
  - **Idempotência:** evita conceder a mesma recompensa duas vezes para o mesmo `(trigger_type, source_id)` marco (ex.: não recompensa o mesmo streak repetidamente).
  - Critérios de pontuação por streak/conclusão conforme SUPOSIÇÃO do PROCESSO (sequência de hábitos e conclusão de metas/tarefas).
  - Chamada por `toggle_habit_log` (marco de streak) e pelos triggers de meta/tarefa concluída.
- **Autenticação:** invocação interna (service role) a partir de RPC/trigger; não é endpoint público.

---

### `send-deadline-alert`
- **Propósito:** envia por email o alerta de prazo de uma tarefa ou meta próxima do vencimento.
- **Input (body):**
  ```json
  {
    "user_id": "uuid",
    "entity_type": "task | goal",
    "entity_id": "uuid",
    "title": "string",
    "due_date": "timestamptz"
  }
  ```
- **Output:**
  ```json
  { "sent": true, "provider": "resend", "message_id": "..." }
  ```
- **Regras de negócio/validações:**
  - Resolve o email do dono (via `auth.users`) e envia através do **Resend** (free tier 100/dia cobre o uso pessoal).
  - Após envio bem-sucedido, marca `deadline_alert_sent = true` na `task`/`goal` correspondente (via service role) para não reenviar.
  - Alerta disparado somente para itens com `due_date` próxima e `deadline_alert_sent = false` (filtro feito por `cron_deadline_alerts`).
- **Autenticação:** invocação interna via cron/service role; não é endpoint público.

---

## Postgres Functions (RPC/triggers)

### `get_knowledge_graph(filter_tag_id uuid default null)`
- **Tipo:** RPC chamável pelo client.
- **Propósito:** retorna, em um único payload, os nós (`notes`) e arestas (`note_links`) do dono para renderizar o grafo visual.
- **Input:** `filter_tag_id` (opcional) para restringir a uma tag/área.
- **Output:** JSON com `nodes` (`id`, `title`, cores das tags) e `edges` (`source_note_id`, `target_note_id`, `origin`).
- **Regras que aplica:**
  - Filtra tudo por `user_id = auth.uid()` (grafo mostra só as notas/conexões do dono — regra do PROCESSO).
  - Se `filter_tag_id` informado, retorna apenas notas com aquela tag (via `note_tags`) e as arestas entre elas.
  - Anexa cores das tags (`tags.color`) aos nós para colorir o grafo.
- **Quando dispara:** via RPC HTTP ao abrir a página `/graph`.

---

### `search_notes(query text)`
- **Tipo:** RPC chamável pelo client.
- **Propósito:** busca notas do dono por texto (full-text) e, opcionalmente, por similaridade semântica.
- **Input:** `query` (texto de busca).
- **Output:** lista de notas (`id`, `title`, trecho/highlight, `updated_at`) ordenadas por relevância.
- **Regras que aplica:**
  - Restringe a `user_id = auth.uid()`.
  - Usa o índice GIN full-text sobre `to_tsvector(title || content)`.
  - Pode combinar ranking full-text com vizinhança semântica de `note_embeddings` (busca híbrida) quando disponível.
- **Quando dispara:** via RPC HTTP na barra de busca de `/notes`.

---

### `toggle_habit_log(habit_id uuid, log_date date)`
- **Tipo:** RPC chamável pelo client.
- **Propósito:** marca/desmarca o cumprimento de um hábito no dia, recalcula sequências e dispara recompensa em marcos.
- **Input:** `habit_id`, `log_date`.
- **Output:** JSON com estado atualizado (`completed`, `current_streak`, `best_streak`, `reward_awarded`).
- **Regras que aplica:**
  - Valida que o hábito pertence a `auth.uid()`.
  - Faz UPSERT/DELETE em `habit_logs` respeitando o UNIQUE `(habit_id, log_date)` (um registro por dia).
  - Recalcula `current_streak` e atualiza `best_streak` em `habits`.
  - Ao atingir marco de sequência, invoca `award-reward` (`trigger_type = 'habit_streak'`).
- **Quando dispara:** via RPC HTTP ao clicar num hábito no dashboard `/habits`.

---

### `get_daily_agenda(target_date date)`
- **Tipo:** RPC chamável pelo client.
- **Propósito:** consolida a agenda do dia inteligente (compromissos + tarefas do dia + hábitos previstos).
- **Input:** `target_date`.
- **Output:** JSON com `events` (de `calendar_events`), `tasks` (com `due_date` no dia) e `habits` previstos, agrupados por período do dia.
- **Regras que aplica:**
  - Restringe a `user_id = auth.uid()`.
  - Reúne `calendar_events` do dia, `tasks` com `due_date` naquela data e hábitos cujos `target_days` incluem o dia da semana, agrupando por `day_period` (manhã/tarde/noite — SUPOSIÇÃO do PROCESSO).
- **Quando dispara:** via RPC HTTP ao abrir `/agenda`.

---

### `get_dashboard_metrics()`
- **Tipo:** RPC chamável pelo client.
- **Propósito:** retorna métricas consolidadas de hábitos, metas e tarefas.
- **Input:** nenhum (usa `auth.uid()`).
- **Output:** JSON com taxas de cumprimento de hábitos, progresso de metas (`current_value`/`target_value`) e contagem de tarefas por `status` e por `eisenhower_quadrant`.
- **Regras que aplica:**
  - Restringe a `user_id = auth.uid()`.
  - Agrega `habit_logs`, `goals` e `tasks` do dono (métricas = progresso de metas + cumprimento de hábitos/tarefas — SUPOSIÇÃO do PROCESSO).
- **Quando dispara:** via RPC HTTP ao abrir `/metrics`.

---

### `handle_new_user()`
- **Tipo:** trigger de tabela (AFTER INSERT em `auth.users`).
- **Propósito:** cria automaticamente a linha em `profiles` para cada novo usuário autenticado (prepara o modo SaaS futuro).
- **Input/Output:** trigger (sem retorno ao client); usa `NEW` de `auth.users`.
- **Regras que aplica:**
  - Insere `profiles(id, display_name, avatar_url, reward_points=0)` usando dados do `auth.users`.
  - Roda com privilégio de service role (INSERT em `profiles` não é feito pelo frontend).
- **Quando dispara:** INSERT em `auth.users` (novo cadastro/login inicial).

---

### `set_updated_at()` — *extensão*
- **Tipo:** trigger de tabela (BEFORE UPDATE).
- **Propósito:** mantém a coluna `updated_at` sempre coerente ao editar registros.
- **Input/Output:** trigger; seta `NEW.updated_at = now()`.
- **Regras que aplica:** atualiza `updated_at` no update; em `notes`, a mudança de conteúdo também sinaliza necessidade de re-embedding (ver `queue_note_embedding`).
- **Quando dispara:** BEFORE UPDATE em todas as tabelas que têm `updated_at`.

---

### `queue_note_embedding()` — *extensão*
- **Tipo:** trigger de tabela (AFTER INSERT OR UPDATE de `title`/`content` em `notes`).
- **Propósito:** invoca `generate-note-embedding` quando uma nota é criada ou tem o texto alterado.
- **Input/Output:** trigger; usa `NEW.id`.
- **Regras que aplica:**
  - Dispara apenas quando `title` ou `content` mudam (evita chamadas desnecessárias).
  - Chama a Edge Function `generate-note-embedding` (via `pg_net`/webhook interno) com service role.
- **Quando dispara:** INSERT ou UPDATE (de texto) na tabela `notes`.

---

### `award_on_goal_completed()` — *extensão*
- **Tipo:** trigger de tabela (AFTER UPDATE em `goals`).
- **Propósito:** concede recompensa quando uma meta muda para `status = 'achieved'`.
- **Input/Output:** trigger; usa `OLD`/`NEW` de `goals`.
- **Regras que aplica:**
  - Dispara `award-reward` (`trigger_type='goal_completed'`, `source_id=NEW.id`) apenas na transição para `achieved` (não em updates repetidos).
- **Quando dispara:** UPDATE em `goals` com mudança de `status` para `achieved`.

---

### `award_on_task_completed()` — *extensão*
- **Tipo:** trigger de tabela (AFTER UPDATE em `tasks`).
- **Propósito:** concede recompensa quando uma tarefa é concluída.
- **Input/Output:** trigger; usa `OLD`/`NEW` de `tasks`.
- **Regras que aplica:**
  - Ao mudar `status` para `done`, seta `completed_at = now()` e dispara `award-reward` (`trigger_type='task_completed'`, `source_id=NEW.id`), uma única vez por conclusão.
- **Quando dispara:** UPDATE em `tasks` com transição de `status` para `done`.

---

### `cron_deadline_alerts` (Cron Job)
- **Tipo:** função de cron (pg_cron), **frequência: a cada hora**.
- **Propósito:** varrer tarefas e metas com prazo próximo e disparar alertas de prazo.
- **Regras que aplica:**
  - Seleciona `tasks` e `goals` com `due_date` dentro da janela de proximidade e `deadline_alert_sent = false`.
  - Para cada item, invoca a Edge Function `send-deadline-alert`; esta marca `deadline_alert_sent = true` após envio (evita duplicidade).
  - Respeita a segmentação por `user_id` de cada registro.
- **Quando dispara:** agendamento pg_cron horário.

---

### `cron_daily_suggestions` (Cron Job)
- **Tipo:** função de cron (pg_cron), **frequência: diária**.
- **Propósito:** gerar sugestões de conexão para notas recentes (item B).
- **Regras que aplica:**
  - Invoca `suggest-note-connections` para as notas recém-criadas/editadas de cada dono.
  - Grava novas `link_suggestions` pendentes (sem duplicar pares já conectados/decididos).
- **Quando dispara:** agendamento pg_cron diário.

---

### `cron_weekly_insights` (Cron Job)
- **Tipo:** função de cron (pg_cron), **frequência: semanal**.
- **Propósito:** gerar resumos e insights de progresso (item C).
- **Regras que aplica:**
  - Invoca `generate-progress-insights` (tipo `weekly_review`) para o dono, cobrindo o período da última semana.
  - Grava um novo `ai_insights` por período.
- **Quando dispara:** agendamento pg_cron semanal.

---

### `cron_calendar_sync` (Cron Job)
- **Tipo:** função de cron (pg_cron), **frequência: a cada 15 minutos**.
- **Propósito:** manter `calendar_events` sincronizado bidirecionalmente com o Google Calendar.
- **Regras que aplica:**
  - Para cada `calendar_connections` ativa, invoca `google-calendar-sync` (`direction = both`).
  - Renova tokens expirados e propaga edições locais `pending_push`/`local_only`.
- **Quando dispara:** agendamento pg_cron a cada 15 min.

---

## Resumo de cobertura

| Function/endpoint | Tipo | Auth |
|---|---|---|
| `import-note` | Edge | Usuário logado |
| `generate-note-embedding` | Edge | Logado / service role |
| `suggest-note-connections` | Edge | Logado / cron |
| `generate-progress-insights` | Edge | Logado / cron |
| `google-calendar-oauth` | Edge | Usuário logado |
| `google-calendar-sync` | Edge | Logado / cron |
| `award-reward` | Edge | Service role (interna) |
| `send-deadline-alert` | Edge | Cron / service role (interna) |
| `get_knowledge_graph` | RPC | Usuário logado (RLS) |
| `search_notes` | RPC | Usuário logado (RLS) |
| `toggle_habit_log` | RPC | Usuário logado (RLS) |
| `get_daily_agenda` | RPC | Usuário logado (RLS) |
| `get_dashboard_metrics` | RPC | Usuário logado (RLS) |
| `handle_new_user` | Trigger (auth.users) | Service role |
| `set_updated_at` *(ext.)* | Trigger | — |
| `queue_note_embedding` *(ext.)* | Trigger | Service role |
| `award_on_goal_completed` *(ext.)* | Trigger | Service role |
| `award_on_task_completed` *(ext.)* | Trigger | Service role |
| `cron_deadline_alerts` | Cron (1h) | pg_cron |
| `cron_daily_suggestions` | Cron (diário) | pg_cron |
| `cron_weekly_insights` | Cron (semanal) | pg_cron |
| `cron_calendar_sync` | Cron (15 min) | pg_cron |

**Extensões sinalizadas:** `set_updated_at`, `queue_note_embedding`, `award_on_goal_completed` e `award_on_task_completed` são adições que materializam regras de negócio que a ESTRUTURA descreve (re-embedding automático em edição de nota, atualização de `updated_at`, e concessão de recompensa por conclusão de meta/tarefa) mas não detalhou como functions próprias. `set_updated_at` já está implementada em `db/schemas.sql`; as demais (`queue_note_embedding`, `award_on_goal_completed`, `award_on_task_completed`) e as Edge Functions/RPCs ainda serão construídas na Fase 2, conforme `docs/PLANO.md`.
