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

### O que só você consegue fazer

**1. Secret do Gemini** (se ainda não tiver feito, da Fase 2 — reaproveitado
aqui por `generate-progress-insights`):
```bash
npx supabase secrets set GEMINI_API_KEY=sua-chave-aqui
```
Pegue em [aistudio.google.com/apikey](https://aistudio.google.com/apikey).

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

**5. Deployar as functions novas:**
```bash
npx supabase functions deploy award-reward
npx supabase functions deploy google-calendar-oauth
npx supabase functions deploy google-calendar-sync
npx supabase functions deploy generate-progress-insights
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` já ficam
disponíveis automaticamente dentro de toda Edge Function — não precisa
configurar esses três.

### Conferir

- **Authentication → Policies**: cada tabela com RLS habilitado e as policies
  esperadas (ver `docs/ESTRUTURA.md` §2).
- **Edge Functions** no painel: as sete aparecendo como deployadas.
- Em `/settings` no app, clique **Conectar** — deve abrir a tela de
  consentimento do Google (com aviso de "app não verificado", normal
  enquanto está em modo de teste — clique em "Avançado → Acessar Noos
  (não seguro)") e voltar pra `/settings` já mostrando "Conectado".
