# DE-PARA — Matriz de Rastreabilidade (Noos)

Este documento é o elo entre banco, backend e frontend. Todos os nomes seguem exatamente a ESTRUTURA.md: tabelas e RPCs em `snake_case`, Edge Functions e rotas em `kebab-case`. Serve para conferir que nenhuma tabela, function ou página ficou órfã.

---

## Tabela 1 — Tabela (DB) → Functions/Endpoints → Páginas

| Tabela | Functions/Endpoints que a tocam | Páginas que a usam | Observação |
|---|---|---|---|
| `profiles` | trigger `handle_new_user` (INSERT via service role); `award-reward` (UPDATE `reward_points`); `get_dashboard_metrics` (leitura) | `/settings`, `/rewards`, `/login` | Espelha `auth.users`. INSERT só pelo trigger; DELETE bloqueado. `reward_points` só sobe via `award-reward`. |
| `notes` | `import-note` (INSERT), `generate-note-embedding` (leitura), `suggest-note-connections` (leitura), `get_knowledge_graph` (nós), `search_notes` (busca) | `/notes`, `/notes/:id`, `/graph`, `/capture`, `/pomodoro` | Nó do grafo. `is_quick_capture=true` alimenta a inbox de `/capture`→`/notes`. CRUD direto pelo dono via RLS. |
| `tags` | `get_knowledge_graph` (cor/filtro por tag) | `/tags`, `/notes`, `/notes/:id`, `/graph` | Áreas (marketing, branding, neurociência). UNIQUE (user_id, name). Cor colore nós do grafo. |
| `note_tags` | `get_knowledge_graph` (filtro por tag), `search_notes` (filtro) | `/notes/:id`, `/notes`, `/graph` | N:N nota↔tag. `user_id` desnormalizado para RLS sem join. |
| `note_links` | `import-note` (extrai `[[...]]` → INSERT), `get_knowledge_graph` (arestas) | `/notes/:id`, `/graph` | Arestas dirigidas do grafo. `origin='ai_suggested'` quando vem de sugestão aceita. UNIQUE (source, target). |
| `external_references` | — (CRUD direto pelo dono via RLS) | `/notes/:id` | Referências externas citadas na nota (curso, autor, URL). |
| `link_suggestions` | `suggest-note-connections` (INSERT via service role), aceite gera `note_links` | `/notes/:id` | Sugestões de conexão da IA (item B), status pending/accepted/dismissed. Aceite cria `note_links` com `origin='ai_suggested'`. |
| `note_embeddings` | `generate-note-embedding` (INSERT/UPDATE via service role), `suggest-note-connections` (busca por similaridade), `search_notes` (semântica opcional) | — (uso interno, sem página direta) | Vetor `pgvector(1536)`. Escrito só por Edge Functions de IA; SELECT restrito ao dono. |
| `pomodoro_sessions` | — (CRUD direto pelo dono via RLS); `get_dashboard_metrics` (leitura opcional) | `/pomodoro`, `/metrics` | Registra ciclos de foco, opcionalmente vinculados a uma `note_id`. |
| `life_areas` | `get_daily_agenda` (agrupamento), `get_dashboard_metrics` (agregação) | `/tasks`, `/projects`, `/habits`, `/goals`, `/metrics`, `/settings` | Áreas/listas da vida (Fase 2). UNIQUE (user_id, name). |
| `projects` | `get_dashboard_metrics` (leitura) | `/projects`, `/tasks` | Agrupa tarefas. Vinculado a `life_areas`. |
| `tasks` | `cron_deadline_alerts` (varre `due_date`), `send-deadline-alert`, `award-reward` (task_completed), `get_daily_agenda`, `get_dashboard_metrics` | `/tasks`, `/tasks/eisenhower`, `/projects`, `/agenda`, `/metrics` | Lista/kanban/calendário. `deadline_alert_sent` controla alerta; `eisenhower_quadrant` alimenta a matriz. |
| `habits` | `toggle_habit_log` (recalcula streaks), `get_daily_agenda` (hábitos previstos), `get_dashboard_metrics` | `/habits`, `/agenda`, `/metrics` | Agrupados por `day_period` (manhã/tarde/noite). Streaks atualizados via RPC. |
| `habit_logs` | `toggle_habit_log` (INSERT/DELETE), `generate-progress-insights` (leitura), `get_dashboard_metrics` (taxas) | `/habits`, `/metrics`, `/insights` | UNIQUE (habit_id, log_date). Marca cumprimento diário e gera histórico. |
| `goals` | `cron_deadline_alerts` (varre `due_date`), `send-deadline-alert`, `award-reward` (goal_completed), `generate-progress-insights`, `get_dashboard_metrics` | `/goals`, `/metrics`, `/insights`, `/agenda` | Metas por categoria. `deadline_alert_sent` controla alerta de prazo. |
| `rewards` | `award-reward` (INSERT via service role) | `/rewards` | Concessão automática por streak/conclusão. Dono só faz SELECT. |
| `calendar_connections` | `google-calendar-oauth` (INSERT/UPDATE tokens via service role), `google-calendar-sync` (leitura de tokens) | `/settings` | Tokens OAuth Google. Nunca manipulados pelo frontend; SELECT restrito ao dono. UNIQUE (user_id, provider). |
| `calendar_events` | `google-calendar-sync` (pull/push via service role), `get_daily_agenda` (leitura) | `/calendar`, `/agenda` | Cache local do Google Calendar. `sync_status` controla push de edições locais. UNIQUE (user_id, google_event_id). |
| `ai_insights` | `generate-progress-insights` (INSERT via service role) | `/insights` | Resumos/insights de progresso (item C). Escrito por cron/service role; dono só faz SELECT. |

---

## Tabela 2 — Function/Endpoint → Tabelas → Páginas (caminho inverso)

| Function/Endpoint | Tabelas que toca | Página(s) que chama | Observação |
|---|---|---|---|
| `get_knowledge_graph` (RPC) | `notes` (nós), `note_links` (arestas), `tags`, `note_tags` (filtro) | `/graph` | Retorna nós + arestas do dono em um payload; filtro opcional por `filter_tag_id`. |
| `search_notes` (RPC) | `notes` (full-text), `note_embeddings` (semântica opcional), `note_tags` | `/notes` | Busca por texto + semântica opcional restrita ao dono. |
| `toggle_habit_log` (RPC) | `habit_logs` (INSERT/DELETE), `habits` (recalcula streaks) → dispara `award-reward` | `/habits` | Marca/desmarca o dia, recalcula `current_streak`/`best_streak` e concede recompensa em marco. |
| `get_daily_agenda` (RPC) | `calendar_events`, `tasks` (com `due_date` no dia), `habits`, `life_areas` | `/agenda` | Consolida compromissos + tarefas do dia + hábitos previstos. |
| `get_dashboard_metrics` (RPC) | `habit_logs`, `habits`, `goals`, `tasks`, `projects`, `life_areas`, `pomodoro_sessions` | `/metrics` | Taxas de hábitos, progresso de metas e tarefas por status/quadrante. |
| `import-note` (Edge) | `notes` (INSERT), `note_links` (extrai `[[...]]`), enfileira `generate-note-embedding` | `/notes` (importação incremental) | Recebe conteúdo colado do Notion/Obsidian; cria nota, links e agenda embedding. |
| `generate-note-embedding` (Edge) | `notes` (leitura), `note_embeddings` (INSERT/UPDATE) | — (trigger interno após criar/editar nota; backfill) | Gera embedding via OpenAI `text-embedding-3-small` → `vector(1536)`. Service role. |
| `suggest-note-connections` (Edge) | `note_embeddings` (similaridade), `notes` (leitura), `link_suggestions` (INSERT) | `/notes/:id` (ao salvar) + `cron_daily_suggestions` | Busca vizinhos semânticos e grava sugestões pendentes (item B). |
| `generate-progress-insights` (Edge) | `goals`, `habit_logs`, `tasks` (leitura), `ai_insights` (INSERT) | `/insights` (sob demanda) + `cron_weekly_insights` | Resumos e insights de progresso (item C) via Gemini 2.5 Pro / GPT 5.4. |
| `google-calendar-oauth` (Edge) | `calendar_connections` (INSERT/UPDATE tokens) | `/settings` (fluxo de conexão Google) | Troca code OAuth por tokens; service role, tokens fora do frontend. |
| `google-calendar-sync` (Edge) | `calendar_connections` (tokens), `calendar_events` (pull/push) | `/calendar` (editar evento) + `cron_calendar_sync` | Sincronização bidirecional pull/push com Google Calendar. |
| `award-reward` (Edge) | `rewards` (INSERT), `profiles` (soma `reward_points`) | — (invocada por `toggle_habit_log` e triggers de meta/tarefa concluída) | Concede recompensa e atualiza saldo. Resultado exibido em `/rewards`. |
| `send-deadline-alert` (Edge) | `tasks`, `goals` (marca `deadline_alert_sent`) | — (invocada por `cron_deadline_alerts`) | Envia alerta de prazo por email via Resend. |
| `cron_deadline_alerts` (pg_cron, horário) | `tasks`, `goals` (varre `due_date` + `deadline_alert_sent=false`) | — (agendado) | Chama `send-deadline-alert` e marca como enviado. |
| `cron_daily_suggestions` (pg_cron, diário) | via `suggest-note-connections`: `note_embeddings`, `notes`, `link_suggestions` | — (agendado) | Roda sugestões de conexão para notas recentes. |
| `cron_weekly_insights` (pg_cron, semanal) | via `generate-progress-insights`: `goals`, `habit_logs`, `tasks`, `ai_insights` | — (agendado) | Gera insights semanais de progresso. |
| `cron_calendar_sync` (pg_cron, 15 min) | via `google-calendar-sync`: `calendar_connections`, `calendar_events` | — (agendado) | Mantém eventos do Google sincronizados. |
| `handle_new_user` (trigger) | `auth.users` (evento), `profiles` (INSERT) | — (automático no signup) | Cria `profiles` a cada novo `auth.users`; prepara modo SaaS futuro. |
