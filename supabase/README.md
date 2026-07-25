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

Três funções em `functions/`, todas em Deno/TypeScript:

- **`import-note`** — importação incremental (Notion/Obsidian): cria a nota,
  extrai `[[wikilinks]]` do conteúdo virando `note_links`, aplica tags e
  referências externas, e dispara `generate-note-embedding`.
- **`generate-note-embedding`** — gera o embedding (OpenAI
  `text-embedding-3-small`) do título+conteúdo e grava em `note_embeddings`
  (via service role — RLS dessa tabela só libera SELECT ao dono).
- **`suggest-note-connections`** — usa a RPC `match_note_embeddings` pra achar
  vizinhos semânticos e grava `link_suggestions` pendentes (ignora pares já
  linkados ou já sugeridos).

### O que só você consegue fazer

**1. Configurar a chave da OpenAI como secret** (nunca no código/frontend):
```bash
npx supabase secrets set OPENAI_API_KEY=sk-...
```
Pegue a chave em [platform.openai.com/api-keys](https://platform.openai.com/api-keys).

**2. Deployar as três funções** (exige `login`/`link` já feitos, acima):
```bash
npx supabase functions deploy import-note
npx supabase functions deploy generate-note-embedding
npx supabase functions deploy suggest-note-connections
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` já ficam
disponíveis automaticamente dentro de toda Edge Function — não precisa
configurar esses três.

### Conferir

- **Authentication → Policies**: cada tabela com RLS habilitado e as policies
  esperadas (ver `docs/ESTRUTURA.md` §2 para as exceções de `note_embeddings`,
  `link_suggestions`, `rewards`, `ai_insights`, `calendar_connections`).
- **Edge Functions** no painel: as três aparecendo como deployadas, com log
  de invocação depois do primeiro teste (importar uma nota ou salvar uma nota
  em `/notes/:id` no app).
