## 1. Requisitos de sistema

Os requisitos abaixo são numerados RS-01, RS-02... e rastreiam os requisitos funcionais (RF) inferidos do PROCESSO e da ESTRUTURA do Noos. Convenção de RFs assumida:

- **RF-01** Autenticação do dono (magic link / email+senha / Google OAuth)
- **RF-02** Criar/editar notas em markdown
- **RF-03** Importar nota do Notion/Obsidian de forma incremental (nota a nota)
- **RF-04** Organizar notas por tags/áreas
- **RF-05** Linkar notas entre si e a referências externas
- **RF-06** Grafo visual das notas e conexões, filtrável por tag
- **RF-07** Busca de notas (full-text + semântica)
- **RF-08** Pomodoro vinculável a uma nota
- **RF-09** Captura rápida mobile (inbox a organizar depois)
- **RF-10** Sugestões automáticas de conexão entre notas (IA — item B)
- **RF-11** Tarefas em lista/kanban/calendário por área e projeto (Fase 2)
- **RF-12** Projetos que agrupam tarefas (Fase 2)
- **RF-13** Matriz de Eisenhower (Fase 2)
- **RF-14** Hábitos por período do dia com streaks (Fase 2)
- **RF-15** Metas de vida por categoria com métricas (Fase 2)
- **RF-16** Recompensas por hábitos/metas/tarefas (Fase 2)
- **RF-17** Integração bidirecional com Google Calendar (Fase 2)
- **RF-18** Agenda do dia inteligente (Fase 2)
- **RF-19** Alertas de prazo (Fase 2)
- **RF-20** Insights/resumos de progresso por IA (item C, Fase 2)
- **RF-21** Métricas consolidadas (Fase 2)

### Fase 1 — Conhecimento

**RS-01:** O login deve aceitar magic link, email+senha e Google OAuth; ao criar um novo `auth.users`, o trigger `handle_new_user` deve inserir automaticamente a linha correspondente em `profiles` com o mesmo `id`.
Rastreia: RF-01

**RS-02:** A criação de nota deve exigir `title` não vazio, aceitar `content` markdown opcional e gravar `user_id = auth.uid()`, `created_at` e `updated_at` automaticamente; toda edição deve atualizar `updated_at`.
Rastreia: RF-02

**RS-03:** A Edge Function `import-note` deve receber conteúdo colado do Notion/Obsidian, criar exatamente 1 nota com `source` ∈ {'notion','obsidian'}, extrair marcações `[[...]]` e materializar as `note_links` correspondentes quando a nota-alvo existir, e enfileirar geração de embedding — sem exigir migração completa em lote.
Rastreia: RF-03, RF-05

**RS-04:** Uma nota deve poder receber N tags via `note_tags`; a criação de tag deve rejeitar nome duplicado por dono (constraint UNIQUE `(user_id, name)`).
Rastreia: RF-04

**RS-05:** A criação de `note_links` deve rejeitar aresta duplicada (UNIQUE `source_note_id, target_note_id`) e impedir link para nota de outro dono; a exclusão de uma nota deve remover em cascata suas arestas e referências (ON DELETE CASCADE).
Rastreia: RF-05

**RS-06:** O RPC `get_knowledge_graph(filter_tag_id)` deve retornar, em um único payload, apenas nós (`notes`) e arestas (`note_links`) do dono autenticado; quando `filter_tag_id` for informado, deve restringir os nós às notas que possuem aquela tag.
Rastreia: RF-06

**RS-07:** O RPC `search_notes(query)` deve buscar via índice GIN full-text em `to_tsvector(title || content)` restrito a `user_id = auth.uid()`, com opção de ranqueamento semântico usando `note_embeddings` (distância cosseno).
Rastreia: RF-07

**RS-08:** O Pomodoro deve criar uma linha em `pomodoro_sessions` com `focus_minutes` default 25, permitir vínculo opcional a uma `note_id`, e ao encerrar gravar `ended_at` e `cycles_completed`.
Rastreia: RF-08

**RS-09:** A página `/capture` deve criar nota com `is_quick_capture = true` e `source = 'mobile_capture'`; a inbox em `/notes` deve listar por `idx_notes_quick_capture` apenas notas pendentes de organização.
Rastreia: RF-09

**RS-10:** A Edge Function `generate-note-embedding` deve gerar embedding via Gemini `gemini-embedding-001` (`outputDimensionality: 768`, renormalizado por norma L2 após o truncamento) e fazer upsert em `note_embeddings` usando service role; deve ser disparada após criar/editar nota e em backfill.
Rastreia: RF-07, RF-10

**RS-11:** A Edge Function `suggest-note-connections` deve, para uma nota, buscar vizinhos por similaridade cosseno em `note_embeddings` (mesmo `user_id`), gravar `link_suggestions` com `status = 'pending'`, `reason` e `score`, ignorando pares que já possuam `note_link`; o aceite pelo dono deve criar `note_link` com `origin = 'ai_suggested'`.
Rastreia: RF-10

### Fase 2 — Produtividade e Vida

**RS-12:** A criação de tarefa deve gravar `user_id = auth.uid()`, aceitar `area_id` e `project_id` opcionais e expor as três visões (lista, kanban por `kanban_order`, calendário por `due_date`) sem perder os vínculos de área/projeto.
Rastreia: RF-11, RF-12

**RS-13:** A classificação de Eisenhower deve aceitar apenas os quatro valores válidos em `eisenhower_quadrant`; valores fora do conjunto devem ser rejeitados (CHECK constraint).
Rastreia: RF-13

**RS-14:** O RPC `toggle_habit_log(habit_id, log_date)` deve inserir/remover o `habit_log` do dia (UNIQUE `habit_id, log_date`), recalcular `current_streak`/`best_streak` e disparar `award-reward` ao atingir o marco de sequência.
Rastreia: RF-14, RF-16

**RS-15:** A criação de meta deve aceitar `category`, `target_value`, `current_value` e `unit`; o progresso exibido deve ser `current_value / target_value` limitado a 100%.
Rastreia: RF-15, RF-21

**RS-16:** A Edge Function `award-reward` deve conceder recompensa e somar `reward_points` em `profiles` conforme `trigger_type` ∈ {'habit_streak','goal_completed','task_completed'}, executando apenas via service role.
Rastreia: RF-16

**RS-17:** A Edge Function `google-calendar-oauth` deve trocar o code OAuth por tokens e gravá-los em `calendar_connections` via service role; os tokens nunca devem ser expostos ao frontend (SELECT do frontend não retorna `access_token`/`refresh_token`).
Rastreia: RF-17

**RS-18:** A Edge Function `google-calendar-sync` deve executar pull (Google → `calendar_events`) e push das edições locais com `sync_status = 'pending_push'`, respeitando UNIQUE `(user_id, google_event_id)` para deduplicação, e ser acionada pelo cron `cron_calendar_sync` a cada 15 min.
Rastreia: RF-17

**RS-19:** O RPC `get_daily_agenda(target_date)` deve consolidar, para o dono, os `calendar_events`, as `tasks` com `due_date` no dia e os `habits` previstos naquele período em um único payload ordenado por horário.
Rastreia: RF-18

**RS-20:** O cron `cron_deadline_alerts` (a cada hora) deve selecionar `tasks` e `goals` com `due_date` próxima e `deadline_alert_sent = false`, disparar `send-deadline-alert` (Resend) e marcar `deadline_alert_sent = true` para não reenviar.
Rastreia: RF-19

**RS-21:** A Edge Function `generate-progress-insights` deve analisar `goals`, `habit_logs` e `tasks` do período e gravar `ai_insights` (`insight_type` ∈ {'goal_progress','habit_summary','weekly_review'}) via service role, acionada pelo cron semanal e sob demanda.
Rastreia: RF-20

**RS-22:** O RPC `get_dashboard_metrics()` deve retornar taxas de cumprimento de hábitos, progresso agregado de metas e contagem de tarefas por status/quadrante, restrito ao dono.
Rastreia: RF-21

## 2. Arquitetura

O Noos é uma aplicação web (com telas mobile-first para captura) sobre backend gerenciado Supabase. Toda lógica de IA, OAuth e sincronização roda em Edge Functions; nada de chaves no frontend.

```
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND — React + Tailwind + shadcn/ui                     │
│  Fase 1: /login /notes /notes/:id /graph /tags                │
│          /pomodoro /capture (mobile)                          │
│  Fase 2: /tasks /tasks/eisenhower /projects /habits            │
│          /goals /metrics /rewards /agenda /calendar            │
│          /insights /settings                                   │
└───────────────┬──────────────────────────┬────────────────────┘
      supabase-js (RLS por user_id)         │ chamadas a RPC/Edge Fn
                │                            │
┌───────────────┼────────────────────────────┼────────────────────┐
│  BACKEND — SUPABASE                                              │
│  ┌────────────┐  ┌───────────────┐  ┌─────────────────┐         │
│  │ PostgreSQL │  │ Auth (magic   │  │ Storage         │         │
│  │ + RLS      │  │ link/senha/   │  │ (avatars/anexos)│         │
│  │ + pgvector │  │ Google OAuth) │  └─────────────────┘         │
│  └────────────┘  └───────────────┘                              │
│  RPCs: get_knowledge_graph, search_notes, toggle_habit_log        │
│        get_daily_agenda, get_dashboard_metrics                    │
│  Edge Functions (Deno): import-note, generate-note-               │
│    embedding, suggest-note-connections, generate-progress-        │
│    insights, google-calendar-oauth, google-calendar-sync,         │
│    award-reward, send-deadline-alert                              │
│  Cron (pg_cron): deadline_alerts(1h), daily_suggestions,          │
│    weekly_insights, calendar_sync(15min)                           │
│  Realtime: atualização do grafo/inbox/dashboard                   │
└───────────────┬──────────────────────────┬────────────────────┘
                │                            │
        ┌───────┴───────┐            ┌───────┴───────────────┐
        │ APIs de IA    │            │ Google Calendar API    │
        │ Gemini (emb)  │            │ (OAuth 2.0, sync)      │
        │ Gemini 2.5    │            ├────────────────────────┤
        │ Pro (insights)│            │ Resend (email alertas) │
        └───────────────┘            └────────────────────────┘
```

Fluxos-chave: (1) importar/editar nota → embedding → sugestão de conexões (B); (2) marcar hábito → recalcular streak → recompensa; (3) cron a cada 15 min sincroniza Google Calendar → agenda do dia; (4) cron semanal gera insights (C). Toda leitura/escrita do frontend passa por RLS `user_id = auth.uid()`.

## 3. Stack tecnológica

**Backend — Supabase (não negociável):**
- **PostgreSQL** com RLS, extensão **pgvector** (embeddings 768, gemini-embedding-001 truncado) e índices GIN full-text.
- **Auth**: magic link (ideal para dono único), email+senha e Google OAuth (também exigido para o Google Calendar).
- **Storage**: avatares e eventuais anexos de notas.
- **Edge Functions (Deno)**: toda integração externa (Gemini, Google Calendar, Resend) e lógica sensível.
- **Realtime**: refresh do grafo, inbox de capturas e dashboards.
- **Cron (pg_cron)**: alertas de prazo, sugestões diárias, insights semanais e sync do calendário.

**Frontend — React + Tailwind + shadcn/ui:**
O caminho de build recomendado no dossiê original é o **Lovable**, porque você se descreve como usuário único sem time de TI ou capacidade de codar — o Lovable leva o Noos do zero ao ar pelo caminho mais rápido, com integração nativa ao Supabase e deploy com preview. Neste repositório específico, a mesma stack de frontend (React + Tailwind + shadcn/ui) é escrita via Claude Code em vez de gerada pela UI do Lovable — as convenções de nomenclatura, schema e Edge Functions permanecem idênticas. Recursos sofisticados — **grafo visual estilo Capacities/Obsidian, Pomodoro e IA de sugestões** — são plenamente construíveis nesse caminho, porque toda a lógica pesada (embeddings, sugestões, OAuth, sync) fica isolada em Edge Functions. As telas mobile-first (`/capture`) atendem seu uso de "captura rápida no celular, organização na web".

**Integrações:** Gemini (`gemini-embedding-001`, tier gratuito) para embeddings, Gemini 2.5 Pro (insights de progresso, contexto longo e custo baixo), Google Calendar API e Resend — todas via Edge Functions.

**Custo pessoal estimado:** Lovable Free/Pro (R$95/mês, se optar por usar a plataforma), Supabase Free no início (Pro R$125/mês quando o acervo crescer), embeddings no tier gratuito do Gemini (sem cartão de crédito), insights (Gemini 2.5 Pro) pague-por-uso (poucos dólares/mês para centenas de notas), Resend Free (100 emails/dia), Google Calendar API gratuita.

## 4. Segurança

**RLS por tabela (ligado em todas):** Toda tabela carrega `user_id` e a política padrão é `user_id = auth.uid()` para SELECT/INSERT/UPDATE/DELETE, garantindo isolamento total por dono desde o uso pessoal — e transição direta para SaaS sem refazer arquitetura.
- `profiles`: SELECT/UPDATE só onde `id = auth.uid()`; INSERT via trigger (service role); DELETE bloqueado.
- `note_tags`: usa `user_id` desnormalizado para checagem direta sem join.
- `note_embeddings`, `link_suggestions`, `rewards`, `ai_insights`: INSERT/UPDATE apenas via **service role** (Edge Functions/cron); dono só faz SELECT.
- `calendar_connections`: SELECT restrito ao dono, mas colunas de token nunca retornadas ao frontend; INSERT/UPDATE/DELETE de tokens apenas via service role.
- `calendar_events`: escrito pela função de sync (service role) e pelo dono (edições locais → push).

**Autenticação:** Supabase Auth com magic link, email+senha e Google OAuth. O trigger `handle_new_user` provisiona `profiles` a cada novo usuário, já preparando o modo SaaS.

**Segredos e API keys:** chaves da Gemini, Google OAuth (client secret) e Resend ficam **exclusivamente em variáveis de ambiente das Edge Functions** (Supabase secrets), nunca no código do frontend nem versionadas. Tokens do Google Calendar (`access_token`/`refresh_token`) são gravados só via service role e nunca trafegam para o cliente.

**LGPD / dados sensíveis:** o acervo do Noos é conhecimento pessoal e privado; RLS garante que ninguém além do dono acesse. Como titular único você tem direito de exportar (o próprio conteúdo já vem do Notion/Obsidian) e excluir dados — a exclusão de nota cascateia links, tags, referências e embeddings. Se/quando virar SaaS, deve-se adicionar política de retenção, consentimento e rota de exportação/eliminação por assinante. Comunicação com APIs de IA e Google trafega sobre HTTPS/TLS.

## 5. Performance

**Carga/volume esperado (ancorado nas respostas):** uso **estritamente pessoal** inicial, importação **incremental** ("aos poucos") a partir de Notion/Obsidian, com **centenas de notas** no total. É um volume baixo — o **Supabase Free** (500MB, 50K auth, 500K edge invocations) cobre com folga o início; migrar para Pro R$125/mês só quando o acervo crescer. Uso principal na web, mobile apenas para captura rápida.

**Índices críticos:**
- `idx_notes_user_updated (user_id, updated_at desc)` — listagem de notas recentes.
- Índice **GIN full-text** em `to_tsvector(title || content)` — busca textual (RS-07).
- Índice **ivfflat/hnsw** em `note_embeddings.embedding` (vector_cosine_ops) — busca semântica e sugestões (RS-10, RS-11).
- `idx_note_tags_tag_id` e `idx_note_links_source/target` — montagem eficiente do grafo (RS-06).
- `idx_tasks_user_due` e `idx_goals_user_due` — varredura de alertas de prazo (RS-20).
- `idx_calendar_events_user_start` — agenda do dia (RS-19).
- UNIQUE `(habit_id, log_date)` — integridade e velocidade do toggle de hábito (RS-14).

**Limites conhecidos e mitigação:**
- **Edge Function timeout (~60s):** geração de embeddings e insights deve ser feita por nota/período e de forma assíncrona (fila + cron), evitando processar todo o acervo numa única invocação — daí `cron_daily_suggestions` e `cron_weekly_insights` operarem em lotes pequenos.
- **Tamanho de payload:** o grafo é servido por `get_knowledge_graph` em payload único; para centenas de nós é tranquilo, mas o filtro por tag mantém o payload enxuto em áreas grandes.
- **Rate limit das APIs de IA:** embeddings gerados de forma incremental (após criar/editar nota) diluem o consumo; backfill inicial roda em lotes.
- **Google Calendar sync a cada 15 min:** evita rajadas e mantém a agenda do dia atualizada sem estourar quotas.
- **pgvector ivfflat:** exige rebuild/ajuste de `lists` conforme o volume cresce; em centenas de notas o custo de busca é irrelevante.
