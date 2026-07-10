# Noos — banco de dados (Fase 1, passo 1)

Este diretório é o projeto Supabase local, criado com `npx supabase init`. A
migration em `migrations/20260709000000_initial_schema.sql` implementa o
modelo de dados completo do plano de arquitetura (Noos v0.3): `area`,
`type`, `note`, `link`, `tag`, `note_tag`, `collection`, `collection_note`,
`daily_note`, `list`, `task`, `task_note`, `habit`, `habit_log`, `language`,
`vocab_entry` — todas com `user_id` e Row Level Security desde o início.

## O que eu não consigo fazer por você

Criar o projeto Supabase de fato exige login na sua conta — isso só você pode
fazer. Depois disso, aplicar a migration é rápido.

### 1. Criar o projeto (uma vez)

1. Acesse [supabase.com/dashboard](https://supabase.com/dashboard) e crie um
   projeto novo (nome sugerido: `noos`, região mais próxima de você).
2. Guarde a **senha do banco** que você definir na criação — vai precisar
   dela pra linkar o projeto local.
3. Em **Project Settings → API**, anote:
   - `Project URL`
   - `anon public key`
   (vamos usar essas duas no `.env.local` quando o Next.js for criado no
   próximo passo — não precisa fazer nada com elas ainda.)

### 2. Aplicar a migration

Duas formas — escolha a que for mais rápida pra você agora:

**Opção A — colar no SQL Editor do dashboard (mais simples, sem instalar nada)**
Abra `migrations/20260709000000_initial_schema.sql` neste projeto, copie o
conteúdo inteiro, cole no **SQL Editor** do painel do Supabase e rode.

**Opção B — via CLI (melhor se formos criar mais migrations depois)**
```bash
npx supabase login
npx supabase link --project-ref szaqbacpousjlxsttetj
npx supabase db push
```
(`login` e `link` são interativos — pedem autenticação no navegador e a senha
do banco que você definiu na criação do projeto — por isso rodam no seu
terminal, não por aqui.)

### 3. Conferir

No painel do Supabase, em **Table Editor**, as 16 tabelas devem aparecer, e
em **Authentication → Policies** cada uma deve mostrar 1 policy (`*_owner`)
com RLS habilitado.

## Por que o schema é assim

- **`area`** é a taxonomia única compartilhada por notas, listas e hábitos —
  ver seção "Modelo de dados" do plano de arquitetura.
- **`list` faz dupla função** de lista simples e Projeto: quando `goal`,
  `status` e `due_date` estão preenchidos, é um Projeto; senão, é só uma
  lista de tarefas. Progresso é sempre calculado a partir de `task`, nunca
  armazenado.
- **PARA (Projetos/Áreas/Recursos/Arquivos) não tem tabela própria** — é uma
  view computada sobre `list.status`, `area` e `note.area_id`.
- **`note.status = 'inbox'`** é onde toda captura rápida nasce (sem área
  definida); a revisão semanal (ainda não construída) é o que promove pra
  `'permanent'` — fluxo Zettelkasten fleeting → permanent note.
- Todo `link` aponta por `note_id`, nunca por título — renomear uma nota
  nunca quebra um backlink (aprendizado direto da doc do Notion).
