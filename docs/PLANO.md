## Plano de Desenvolvimento — Noos (Segundo Cérebro)

Este plano leva o **Noos** do zero ao ar em 3 fases, sobre backend **Supabase** (PostgreSQL + RLS + Auth + Storage + Edge Functions + Realtime + pg_cron) e frontend **React + Tailwind + shadcn/ui** (escrito via Claude Code neste repositório). A ordem respeita as dependências: primeiro a **fundação** (banco, auth, layout), depois a **construção** das funcionalidades reais (Fase 1 de conhecimento + Fase 2 de produtividade/IA/calendário) e por fim o **polimento e lançamento**. Toda a modelagem já nasce multi-tenant por `user_id` + RLS, para virar SaaS no futuro sem refazer arquitetura.

---

## Fase 1 — Fundação

**Entregável:** projeto Noos com banco Supabase com todas as tabelas e RLS no ar, autenticação funcionando (magic link / email / Google) e o layout base navegável com as páginas vazias já roteadas.

**Tabelas envolvidas:** todas do `db/schemas.sql` (Fase 1 e Fase 2 já modeladas) — com destaque para `profiles`, `notes`, `tags`, `note_tags`, `note_links`, mais o trigger `handle_new_user`.

**Páginas envolvidas:** `/login`, shell de navegação com rotas placeholder para `/notes`, `/graph`, `/tags`, `/pomodoro`, `/capture`.

**Functions envolvidas:** trigger `handle_new_user`; RLS policies (`user_id = auth.uid()`) em todas as tabelas.

**Checklist:**
- [ ] Rodar `db/schemas.sql` no Supabase (tabelas + índices + extensão pgvector)
- [ ] Ativar RLS em todas as tabelas e criar as policies `user_id = auth.uid()` + trigger `handle_new_user`
- [ ] Configurar Supabase Auth (magic link, email+senha, OAuth Google) e a página `/login`
- [ ] Montar o layout base (menu lateral, header, tema) com rotas placeholder das páginas da Fase 1

---

## Fase 2 — Construção

**Entregável:** o Noos usável de ponta a ponta — notas com tags e links, grafo visual interativo, Pomodoro, captura mobile, e a camada de produtividade (tarefas/kanban/Eisenhower, projetos, hábitos, metas, recompensas), a IA (sugestão de conexões B + insights de progresso C) e a integração com Google Calendar + agenda do dia.

**Tabelas envolvidas:** `notes`, `tags`, `note_tags`, `note_links`, `external_references`, `note_embeddings`, `link_suggestions`, `pomodoro_sessions`, `life_areas`, `projects`, `tasks`, `habits`, `habit_logs`, `goals`, `rewards`, `calendar_connections`, `calendar_events`, `ai_insights`.

**Páginas envolvidas:** `/notes`, `/notes/:id`, `/graph`, `/tags`, `/pomodoro`, `/capture`, `/tasks`, `/tasks/eisenhower`, `/projects`, `/habits`, `/goals`, `/metrics`, `/rewards`, `/agenda`, `/calendar`, `/insights`, `/settings`.

**Functions envolvidas:** RPCs `get_knowledge_graph`, `search_notes`, `toggle_habit_log`, `get_daily_agenda`, `get_dashboard_metrics`; Edge Functions `import-note`, `generate-note-embedding`, `suggest-note-connections`, `generate-progress-insights`, `google-calendar-oauth`, `google-calendar-sync`, `award-reward`.

**Checklist:**
- [ ] Notas + tags + links + referências (`/notes`, `/notes/:id`, `/tags`) com busca via `search_notes`
- [ ] Grafo visual (`/graph`) via `get_knowledge_graph`, Pomodoro (`/pomodoro`) e captura mobile (`/capture`)
- [ ] IA de conhecimento: `import-note`, `generate-note-embedding` e `suggest-note-connections` (item B) no painel da nota
- [ ] Produtividade: `/tasks` (lista/kanban/calendário), `/tasks/eisenhower`, `/projects`, `life_areas`
- [ ] Hábitos, metas e recompensas: `/habits` (`toggle_habit_log`), `/goals`, `/metrics`, `/rewards`, `award-reward`
- [ ] Google Calendar + agenda + insights: `google-calendar-oauth`/`sync`, `/agenda`, `/calendar`, `/insights` (item C)

---

## Fase 3 — Polimento e lançamento

**Entregável:** Noos polido e no ar — estados de vazio/erro/carregamento em todas as telas, layout responsivo (com `/capture` mobile-first), automações recorrentes ligadas (alertas de prazo, sugestões diárias, insights semanais, sync de calendário) e deploy publicado.

**Tabelas envolvidas:** revisão de RLS em `note_embeddings`, `link_suggestions`, `rewards`, `ai_insights`, `calendar_connections` (escrita via service role).

**Páginas envolvidas:** todas — foco em vazio/erro/loading e responsividade; `/settings` finalizado.

**Functions envolvidas:** cron `cron_deadline_alerts`, `cron_daily_suggestions`, `cron_weekly_insights`, `cron_calendar_sync`; Edge Function `send-deadline-alert` (Resend).

**Checklist:**
- [ ] Estados de vazio, carregamento e erro em todas as páginas (especialmente `/notes`, `/graph`, `/habits`)
- [ ] Responsividade geral e `/capture` afinada como mobile-first
- [ ] Ligar os cron jobs (`cron_deadline_alerts`, `cron_daily_suggestions`, `cron_weekly_insights`, `cron_calendar_sync`)
- [ ] Configurar `send-deadline-alert` com Resend e as chaves das APIs de IA/Google nos secrets do Supabase
- [ ] Testar RLS de ponta a ponta e publicar o deploy final
