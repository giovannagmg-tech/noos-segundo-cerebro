# Noos — banco de dados e Edge Functions

Projeto Supabase local (`npx supabase init`). O schema vive em `db/schemas.sql`
(fonte da verdade, conforme `SKILL.md`) e é aplicado via as migrations em
`migrations/`, na ordem:

1. `20260709000000_initial_schema.sql` — schema v1 (histórico, já substituído).
2. `20260725000000_replace_schema_noos_v2.sql` — derruba o v1 e cria o schema
   atual: `profiles`, `notes`, `tags`, `note_tags`, `note_links`,
   `external_references`, `link_suggestions`, `note_embeddings`,
   `pomodoro_sessions`, `life_areas`, `projects`, `tasks`, `habits`,
   `habit_logs`, `goals`, `rewards`, `calendar_connections`,
   `calendar_events`, `ai_insights`.
3. `20260726000000_search_notes_rpc.sql` — RPC `search_notes` (busca full-text).
4. `20260727000000_knowledge_graph_rpc.sql` — RPC `get_knowledge_graph`.
5. `20260728000000_match_note_embeddings_rpc.sql` — RPC auxiliar de
   similaridade vetorial, usada por `suggest-note-connections`.
6. `20260729000000_gemini_embeddings_768.sql` — troca `note_embeddings.embedding`
   de `vector(1536)` (OpenAI) pra `vector(768)` (Gemini `gemini-embedding-001`
   truncado via Matryoshka).
7. `20260730000000_habits_metrics_rpcs.sql` — RPCs `toggle_habit_log` e
   `get_dashboard_metrics`.
8. `20260731000000_daily_agenda_rpc.sql` — RPC `get_daily_agenda`.
9. `20260801000000_cron_jobs.sql` — habilita `pg_cron`/`pg_net`, cria os 4
   cron jobs (`cron_deadline_alerts`, `cron_daily_suggestions`,
   `cron_weekly_insights`, `cron_calendar_sync`) e a RPC de apoio
   `match_note_embeddings_for_user` (variante service-role de
   `match_note_embeddings`, usada só pelo modo cron).
10. `20260802000000_rls_hardening.sql` — checagem final de RLS: restringe
    toda policy a `TO authenticated` (defesa em profundidade) e revoga
    EXECUTE público de `handle_new_user()`.

**Antes de aplicar a migration 9**, configure os secrets do Vault (só uma
vez, direto no SQL Editor — nunca cole a service_role key aqui no chat):
```sql
select vault.create_secret('https://szaqbacpousjlxsttetj.supabase.co', 'project_url');
select vault.create_secret('SUA-SERVICE-ROLE-KEY-AQUI', 'service_role_key');
```
Pegue a service_role key em **Settings → API → Project API keys → service_role**
(o painel avisa que é secreta — é exatamente essa).

## Aplicar uma migration nova

Sempre que eu adicionar um arquivo novo em `migrations/`, aplique assim:

**Opção A — SQL Editor (mais simples)**
Abra o arquivo da migration mais recente, copie o conteúdo inteiro (`Ctrl+A`,
`Ctrl+C` no VSCode — nunca cole o caminho/nome do arquivo), cole no
**SQL Editor** do painel do Supabase e rode.

**Opção B — CLI**
```bash
npx supabase login
npx supabase link --project-ref szaqbacpousjlxsttetj
npx supabase db push
```

## Edge Functions

Sete funções em `functions/`, todas em Deno/TypeScript:

- **`import-note`** — importação incremental (Notion/Obsidian): cria a nota,
  extrai `[[wikilinks]]` do conteúdo virando `note_links`, aplica tags e
  referências externas, e dispara `generate-note-embedding`.
- **`generate-note-embedding`** — gera o embedding (Gemini
  `gemini-embedding-001`, truncado pra 768 dim + renormalizado por norma L2)
  do título+conteúdo e grava em `note_embeddings` (via service role).
- **`suggest-note-connections`** — usa a RPC `match_note_embeddings` pra achar
  vizinhos semânticos e grava `link_suggestions` pendentes.
- **`award-reward`** — concede pontos por streak de hábito ou meta/tarefa
  concluída, idempotente por `(dono, gatilho, origem, título)`, credita
  `profiles.reward_points` via service role.
- **`google-calendar-oauth`** — troca o code OAuth por tokens (e também cuida
  do disconnect) e grava em `calendar_connections` via service role.
- **`google-calendar-sync`** — pull (Google → `calendar_events`) e push
  (edições locais → Google), renovando o token quando expira.
- **`generate-progress-insights`** — analisa metas/hábitos/tarefas do
  período via Gemini 2.5 Pro e grava um resumo em `ai_insights`.
- **`send-deadline-alert`** — envia por email (Resend) o alerta de prazo de
  uma tarefa/meta e marca `deadline_alert_sent = true` só depois do envio
  confirmado. Só aceita chamadas com Authorization = service_role key (não é
  endpoint público — quem aciona é `cron_deadline_alerts`).

`suggest-note-connections`, `generate-progress-insights` e
`google-calendar-sync` agora aceitam **dois jeitos de chamada** (ver
`_shared/auth.ts`): usuário logado (Authorization = JWT do dono, como antes)
ou invocação interna dos cron jobs (Authorization = service_role key +
`user_id` no body). Isso não muda nada pra quem já usa a UI — é só o que
permite os crons rodarem em nome de qualquer dono, sem expor nada novo.

### O que só você consegue fazer

**1. Secret do Gemini** (se ainda não tiver feito, da Fase 2 — reaproveitado
aqui por `generate-progress-insights` e por `generate-note-embedding`):
```bash
npx supabase secrets set GEMINI_API_KEY=sua-chave-aqui
```
Pegue em [aistudio.google.com/apikey](https://aistudio.google.com/apikey).

> **Nota:** o `docs/ESTRUTURA.md` original cogitava OpenAI pros embeddings e
> Gemini 2.5 Pro **ou** GPT 5.4 pros insights — já trocamos tudo pra Gemini
> na Fase 2 (tier gratuito, sem cartão). `GEMINI_API_KEY` acima cobre as
> duas coisas; não precisa configurar `OPENAI_API_KEY`.

**2. Criar as credenciais OAuth do Google Calendar** (novo — exige um projeto
no Google Cloud, feito só uma vez):
1. Acesse [console.cloud.google.com](https://console.cloud.google.com), crie
   um projeto (ou reaproveite um existente).
2. **APIs e serviços → Biblioteca** → ative a **Google Calendar API**.
3. **APIs e serviços → Tela de consentimento OAuth** → tipo "Externo" →
   preencha nome do app ("Noos") e seu e-mail → em "Escopos" adicione
   `https://www.googleapis.com/auth/calendar` → em "Usuários de teste"
   adicione seu próprio e-mail (enquanto o app não é publicado, só esses
   e-mails conseguem autorizar).
4. **APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth**:
   - Tipo de aplicativo: **Aplicativo da Web**.
   - **URIs de redirecionamento autorizados**: adicione exatamente
     `http://localhost:5173/settings` (a porta padrão do `npm run dev` — se
     você rodar em outra porta, adicione essa também; ao publicar em produção,
     adicione a URL real, ex: `https://seu-dominio.com/settings`).
5. Copie o **Client ID** e o **Client secret** gerados.

**3. Configurar os secrets do Google:**
```bash
npx supabase secrets set GOOGLE_CLIENT_ID=seu-client-id
npx supabase secrets set GOOGLE_CLIENT_SECRET=seu-client-secret
```

**4. Configurar o Client ID no frontend** (não é segredo — é o identificador
público do app OAuth): copie `app/.env.example` → `app/.env` já deve existir;
adicione a linha:
```
VITE_GOOGLE_CLIENT_ID=seu-client-id
```
(o mesmo Client ID do passo 2 — reinicie o `npm run dev` depois de editar `.env`).

**5. Conta no Resend e secret do email de alerta** (novo — free tier, 100
emails/dia):
1. Crie conta em [resend.com](https://resend.com) e gere uma API key em
   **API Keys → Create API Key**.
2. Configure o secret:
   ```bash
   npx supabase secrets set RESEND_API_KEY=sua-chave-aqui
   ```
3. **Limitação do sandbox do Resend**: sem verificar um domínio próprio, o
   Resend só permite enviar `from: onboarding@resend.dev` **para o email da
   sua própria conta Resend** (o mesmo com que você criou a conta). Pra
   testar com outro destinatário, verifique um domínio em **Domains** no
   painel do Resend — não obrigatório pro uso pessoal.

**6. Habilitar as extensões do cron** (se `create extension` na migration 9
der erro de permissão): **Database → Extensions** no painel do Supabase →
habilite `pg_cron` e `pg_net` manualmente, depois rode a migration de novo.

**7. Deployar as functions novas/alteradas:**
```bash
npx supabase functions deploy award-reward
npx supabase functions deploy google-calendar-oauth
npx supabase functions deploy google-calendar-sync
npx supabase functions deploy generate-progress-insights
npx supabase functions deploy suggest-note-connections
npx supabase functions deploy send-deadline-alert
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` já ficam
disponíveis automaticamente dentro de toda Edge Function — não precisa
configurar esses três.

### Conferir

- **Authentication → Policies**: cada tabela com RLS habilitado e as policies
  esperadas (ver `docs/ESTRUTURA.md` §2) — depois da migration 10, toda
  policy deve aparecer restrita ao role `authenticated`.
- **Edge Functions** no painel: as oito aparecendo como deployadas.
- Em `/settings` no app, clique **Conectar** — deve abrir a tela de
  consentimento do Google (com aviso de "app não verificado", normal
  enquanto está em modo de teste — clique em "Avançado → Acessar Noos
  (não seguro)") e voltar pra `/settings` já mostrando "Conectado".

### Conferir os cron jobs

No **SQL Editor**, rode:
```sql
select jobid, jobname, schedule, active from cron.job order by jobname;
```
Deve listar as 4 linhas (`cron_deadline_alerts` a cada hora, `cron_daily_suggestions`
diário às 3h, `cron_weekly_insights` toda segunda às 4h, `cron_calendar_sync`
a cada 15 min), todas com `active = true`.

Pra ver se um job de fato rodou (e se falhou ou não), depois de esperar a
primeira execução:
```sql
select j.jobname, r.status, r.return_message, r.start_time
from cron.job_run_details r
join cron.job j on j.jobid = r.jobid
order by r.start_time desc
limit 20;
```
`status = succeeded` é o esperado; `failed` costuma indicar secret do Vault
não configurado (`project_url`/`service_role_key`) ou function não deployada.

### Testar o send-deadline-alert manualmente

Sem esperar o cron, dá pra invocar direto (troque `SEU-SERVICE-ROLE-KEY` pela
sua chave — rode isso no seu terminal, nunca cole a chave aqui no chat):
```bash
curl -X POST https://szaqbacpousjlxsttetj.supabase.co/functions/v1/send-deadline-alert \
  -H "Authorization: Bearer SEU-SERVICE-ROLE-KEY" \
  -H "apikey: SEU-SERVICE-ROLE-KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "SEU-USER-ID-AQUI",
    "entity_type": "task",
    "entity_id": "00000000-0000-0000-0000-000000000000",
    "title": "Teste de alerta de prazo",
    "due_date": "2026-08-01T12:00:00Z"
  }'
```
- `user_id`: pegue o seu em **Authentication → Users** no painel (é o email
  desse usuário que recebe o email — lembre da limitação do sandbox do
  Resend acima).
- `entity_id`: use um `id` real de uma tarefa sua se quiser conferir que
  `deadline_alert_sent` vira `true` depois; um UUID qualquer funciona só pro
  teste de envio (o update de `deadline_alert_sent` silenciosamente não
  encontra a linha e é ignorado).
- Resposta esperada: `{"sent":true,"provider":"resend","message_id":"..."}`.
