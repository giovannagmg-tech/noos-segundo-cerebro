# Noos — Segundo Cérebro

## Sobre o projeto

O **Noos** é o seu segundo cérebro pessoal: um único lugar para unir as anotações de cursos de marketing, branding e neurociência que hoje vivem espalhadas entre Notion e Obsidian, conectá-las em um **grafo visual** filtrável por tags, linkar conhecimentos e referências, e ir evoluindo esse repertório ao longo do tempo. Na Fase 1 o foco é o **conhecimento** (notas em markdown, links, grafo, busca full-text, importação incremental do Notion/Obsidian e Pomodoro); na Fase 2 entram **produtividade e vida** (tarefas em lista/kanban/calendário por área, projetos, Matriz de Eisenhower, dashboard de hábitos por período do dia, metas de vida, métricas, agenda inteligente com sync do Google Calendar, alertas de prazo, sistema de recompensas e IA que sugere conexões entre notas e resume seu progresso). O Noos nasce de **uso estritamente pessoal** (um único dono), mas já é modelado multi-tenant por `user_id` + RLS para virar um produto SaaS no futuro sem refazer a arquitetura.

**Nota sobre a stack deste repositório:** o pacote de documentação (`SKILL.md`, `docs/`) recomenda o caminho **Lovable + Supabase** para quem opera sozinho sem time técnico. Este repositório específico segue a seção "Primeiros passos no Claude Code" do `SKILL.md`: mesmo backend Supabase, mesma stack de frontend (React + Tailwind + shadcn/ui), mas escrita em código via Claude Code em vez de gerada pela UI do Lovable.

## Antes de tudo

> ⚠️ **LEIA O `SKILL.md` ANTES DE ESCREVER QUALQUER LINHA DE CÓDIGO OU CRIAR QUALQUER TABELA.**
>
> O `SKILL.md` é o guia operacional específico de como construir o Noos: convenções, ordem de execução, decisões de arquitetura, armadilhas e o "jeito certo" de montar este sistema em particular. Nenhum atalho: abra o `SKILL.md`, entenda o fluxo completo e só depois toque no banco ou no frontend. Todos os outros documentos deste pacote assumem que você já leu o `SKILL.md`.

## Mapa de arquivos

| Arquivo | O que contém | Quando consultar |
|---|---|---|
| **SKILL.md** | Guia operacional mestre de como construir o Noos: convenções, ordem, decisões e armadilhas. | **PRIMEIRO, sempre.** Antes de qualquer código ou tabela. |
| **docs/PROCESSO.md** | Os fluxos de negócio e papéis do Noos (Você / dono; Futuro Assinante SaaS): como o conhecimento é capturado, linkado, revisado e como a produtividade flui. | Ao entender o "porquê" de cada regra antes de implementar. |
| **docs/ESTRUTURA.md** | Fonte canônica de nomes: tabelas e RPCs em `snake_case`, Edge Functions e rotas em `kebab-case`, e a organização por Fase 1/Fase 2. | Sempre que precisar nomear qualquer coisa (tabela, função, rota, página). |
| **docs/PRD.md** | Contexto, visão, escopo por fase e objetivos do produto Noos. | No início, para alinhar escopo e prioridades (Fase 1 primeiro). |
| **docs/PRS.md** | Requisitos de sistema (RS-01, RS-02...) rastreando os requisitos funcionais (RF-01...) inferidos. | Ao implementar uma funcionalidade, para conferir os critérios. |
| **db/schemas.sql** | Todas as tabelas PostgreSQL (Supabase), multi-tenant por `user_id`, com RLS ligado em todas — Fase 1 (conhecimento) e Fase 2 (produtividade/vida). | Fonte de verdade do schema — já aplicada via `supabase/migrations/`. |
| **docs/PLANO.md** | Plano de desenvolvimento em 3 fases (fundação → construção → polimento/lançamento). | Para saber a ordem exata de construção e as dependências. |
| **docs/FUNCTIONS.md** | Todas as functions do backend: Edge Functions (Deno), RPCs Postgres, triggers e Cron Jobs (pg_cron), com autenticação e regras. | Ao construir a lógica server-side, webhooks e automações. |
| **docs/PAGINAS.md** | Cada página do frontend, organizada por Fase 1/Fase 2, com componentes e dados que consome. | Ao construir a interface, tela por tela. |
| **docs/DEPARA.md** | Matriz de rastreabilidade: Tabela → Functions/Endpoints → Páginas, garantindo que nada fique órfão. | Para validar que banco, backend e frontend estão conectados. |

## Estrutura do repositório

- **`app/`** — o frontend (Vite + React + TypeScript + Tailwind + shadcn/ui), construído seguindo `docs/PAGINAS.md` fase a fase.
- **`supabase/`** — config do projeto Supabase local e `migrations/` (histórico de execução real no banco). A migration `20260725000000_replace_schema_noos_v2.sql` aplica o schema descrito em `db/schemas.sql`.
- **`db/schemas.sql`** — fonte única da verdade do schema (conforme `SKILL.md`).
- **`docs/`** — pacote de especificação completo (ver mapa de arquivos acima).
- **`brand/`** — identidade visual (logo, paleta, tipografia) de uma iteração anterior deste projeto — reaproveitar como ponto de partida de tokens visuais é opcional, não obrigatório pelo `SKILL.md`.

## Rodando localmente

```bash
cd app
cp .env.example .env   # preencher com Project URL + anon key do Supabase
npm install
npm run dev
```

## Setup do banco (Supabase)

1. Projeto Supabase já criado (ver `supabase/README.md` para o project ref e instruções de link via CLI).
2. Aplicar a migration mais recente em `supabase/migrations/` — cole o conteúdo no **SQL Editor** do painel do Supabase, ou via CLI (`npx supabase db push`, após `npx supabase link`).
3. Conferir no **Table Editor** que as tabelas de `db/schemas.sql` existem e que RLS está ativo em todas (Authentication → Policies).
4. Habilitar os provedores de Auth (magic link / email+senha / Google OAuth) em Authentication → Providers.
