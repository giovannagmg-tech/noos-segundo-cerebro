## Convenções

Este é o guia operacional para construir o **Noos** — o segundo cérebro pessoal que une conhecimento (notas conectadas com grafo, estilo Obsidian/Capacities) e produtividade (tarefas, hábitos, metas, agenda), com camada de IA para sugestão de conexões e insights de progresso.

**Stack fixa (não negociável):**
- **Backend: SEMPRE Supabase** — PostgreSQL + RLS + Auth + Storage + Edge Functions (Deno) + Realtime + Cron (pg_cron). Nunca introduza Firebase, MongoDB, Prisma com outro banco, nem qualquer backend paralelo.
- **Caminho de build: Lovable + Supabase** — React + Tailwind + shadcn/ui gerados pelo Lovable, com integração nativa ao Supabase. Escolhido porque o dono do Noos vai operar sozinho, sem time técnico, e quer o caminho mais rápido do zero ao ar. **NÃO** troque para Next.js/Vue/Angular; o frontend é o React que o Lovable gera. *(Nota deste repositório: construído via Claude Code seguindo a seção "Primeiros passos no Claude Code" do README — mesmo backend Supabase, mesma stack de frontend React + Tailwind + shadcn/ui, mas escrita em código em vez de gerada pela UI do Lovable.)*

**Nomenclatura (obedecer sempre, conforme docs/ESTRUTURA.md e docs/DEPARA.md):**
- **Banco (tabelas, colunas, RPCs): inglês, `snake_case`** — ex: `notes`, `note_links`, `user_id`, `reward_points`, `get_dashboard_metrics`.
- **Edge Functions e rotas do frontend: `kebab-case`** — ex: `award-reward`, `suggest-note-links`, `sync-google-calendar`, rota `/knowledge-graph`.
- **Toda tabela nasce multi-tenant por `user_id`** com RLS ligado, mesmo o Noos sendo hoje de uso pessoal (um único dono). Isso prepara a evolução para SaaS sem refazer arquitetura — é decisão explícita do PRD, não over-engineering.

**Fases (respeitar):** Fase 1 = Conhecimento (notas, tags, links, grafo, busca, Pomodoro, importação Notion/Obsidian). Fase 2 = Produtividade e Vida (tarefas kanban/lista/calendário, projetos, Eisenhower, hábitos, metas, métricas, agenda inteligente, alertas, recompensas, IA de conexões e insights, sync Google Calendar). Não puxe funcionalidade de Fase 2 antes da Fase 1 estar sólida.

## Ordem de implementação recomendada

Siga a sequência das 3 fases de **docs/PLANO.md**, respeitando dependências:

1. **Fundação** — Aplicar `db/schemas.sql` das tabelas de Fase 1 (`profiles`, `notes`, `tags`, `note_tags`, `note_links`), com RLS ligado em cada uma. Configurar Auth (magic link + email/senha + Google OAuth, conforme RF-01). Criar o layout base (shell, navegação, tema) no Lovable. Trigger `handle_new_user` para popular `profiles`.
2. **Fase 1 — Conhecimento (o coração do Noos):**
   - Páginas de notas: editor markdown, lista, visualização (RF-02).
   - Tags/áreas e vínculos entre notas + referências externas (RF-04, RF-05).
   - Busca full-text (RF-07).
   - Grafo visual filtrável por tag (RF-06) — validar com dados reais.
   - Importação incremental Notion/Obsidian (RF-03) via Edge Function — o dono vai colar/exportar nota a nota, centenas no total.
   - Pomodoro.
3. **Fase 2 — Produtividade, Vida e IA:** Aplicar tabelas de Fase 2 (tarefas, projetos, hábitos, metas, métricas, recompensas). Construir páginas na ordem tarefas → projetos → Eisenhower → hábitos → metas → dashboard/métricas → agenda. Depois as Edge Functions de IA (`suggest-note-links`, insights de progresso) e o sync bidirecional com Google Calendar.
4. **Integrações externas** (sempre via Edge Functions): modelo de IA para sugestões/insights; Google Calendar OAuth + sync. Cron Jobs (pg_cron) para alertas de prazo e agregações de métricas/hábitos.
5. **Polimento e lançamento:** estados vazio/erro/loading em todas as páginas, responsividade mobile (captura rápida), performance do grafo com centenas de notas, revisão de RLS, deploy.

Regra prática por feature: **schema (RLS) → função/RPC → página → integração → estados/polimento**.

## Como usar cada documento durante o desenvolvimento

- **docs/PRD.md** — Leia antes de começar qualquer fase para não perder o "porquê". Consulte quando tiver dúvida se algo é Fase 1 ou Fase 2, ou sobre o escopo de IA (foco inicial em **B: sugestão de conexões** e **C: resumos/insights de progresso** — chat sobre notas fica para depois).
- **docs/PRS.md** — Fonte dos requisitos de sistema (RS) e funcionais (RF). Antes de implementar uma feature, localize o RF correspondente para saber exatamente o comportamento esperado (ex: RF-03 é importação **incremental**, nota a nota — não um importador em massa).
- **db/schemas.sql** — Fonte única da verdade do banco. **Nunca crie tabela ou coluna que não esteja aqui.** Se precisar de algo novo, primeiro adicione ao schema (com `user_id` + RLS) e só então use. Confira tipos e FKs antes de escrever qualquer query.
- **docs/DEPARA.md** — Consulte **antes de criar qualquer tabela, function ou página**, para não duplicar algo que já existe e para garantir que os nomes batem exatamente. É a matriz que liga tabela → function → página; use-a para rastrear o impacto de qualquer mudança.
- **docs/FUNCTIONS.md** — Releia a spec da function/RPC/trigger/cron **antes de codá-la**. Traz contrato de auth, entradas/saídas e regras. Respeite os nomes exatos (`award-reward`, `get_dashboard_metrics`, etc.) e o contexto de execução (JWT do usuário com RLS vs. service role).
- **docs/PAGINAS.md** — Releia a seção da página específica **antes de construí-la**: layout, componentes, quais tabelas/functions consome, papéis de usuário e estados. Garante que a UI reflete o modelo real.
- **docs/PLANO.md** — Seu roteiro macro. Consulte ao iniciar cada fase e para confirmar dependências e sequência.
- **docs/PROCESSO.md / docs/ESTRUTURA.md** — Fonte das regras de negócio e da nomenclatura/papéis. Consulte ao implementar qualquer lógica (ex: como pontos de recompensa são creditados, como a matriz de Eisenhower classifica) e sempre que precisar confirmar um nome ou o papel de usuário ativo.

## Gates de qualidade

Antes de considerar uma etapa "pronta", verifique:

- [ ] **RLS habilitado** em toda tabela nova, com policy garantindo `user_id = auth.uid()`. Sem exceção, mesmo em uso pessoal.
- [ ] **Nomenclatura confere** com docs/DEPARA.md e docs/ESTRUTURA.md (banco `snake_case` em inglês; Edge Functions e rotas `kebab-case`).
- [ ] **Nada fora do schema:** toda tabela/coluna usada existe em `db/schemas.sql`.
- [ ] **Estados implementados** em cada página: vazio (ex: nenhuma nota importada ainda), loading e erro.
- [ ] **Regra de negócio aplicada de verdade** conforme docs/PROCESSO.md (não só a "casca" visual) — ex: alertas de prazo disparando via cron, pontos de recompensa creditados no `profiles.reward_points`.
- [ ] **Contrato da function** bate com docs/FUNCTIONS.md (auth, payload, retorno).
- [ ] **Integrações via Edge Function**, nunca com chave de API exposta no frontend (IA e Google Calendar).
- [ ] **Grafo e busca testados com volume realista** (centenas de notas) — performance aceitável.
- [ ] **Mobile:** fluxo de captura rápida de nota utilizável no celular.
- [ ] **Fase respeitada:** não misturou Fase 2 dentro da entrega de Fase 1.

## O que NÃO fazer

- **Não** trocar ou adicionar outro banco (Firebase, MongoDB, Supabase + Prisma-em-outro-DB). O backend é **exclusivamente Supabase**.
- **Não** trocar o caminho de build: nada de Next.js/Vue/Angular. O frontend é o **React** (gerado pelo Lovable, ou escrito à mão seguindo a mesma stack, conforme este repositório).
- **Não** criar tabela, coluna, function ou página que não exista em `db/schemas.sql` / docs/DEPARA.md sem antes atualizar o documento-fonte.
- **Não** pular RLS "por enquanto porque é só eu". O Noos nasce multi-tenant por `user_id` — pular isso quebra a evolução para SaaS e cria dívida de segurança.
- **Não** expor chaves de IA ou credenciais do Google Calendar no cliente. Toda chamada a API externa passa por **Edge Function**.
- **Não** usar N8N nem Zapier para automação. Use **Make** (no-code simples) ou **Edge Functions + pg_cron** para alertas de prazo, métricas e sync.
- **Não** implementar o chat "pergunte às suas notas" (opção A da IA) agora — o escopo inicial é sugestão de conexões (B) e insights de progresso (C). Não inflar escopo.
- **Não** construir importação em massa do Notion/Obsidian — o fluxo é **incremental**, nota a nota, como o dono descreveu.
- **Não** transformar o Noos em calendário isolado: a agenda deve **sincronizar com o Google Calendar** (bidirecional), não substituí-lo silenciosamente.
- **Não** conectar hábitos/tarefas a ferramentas externas — o dono foi explícito que isso não é necessário.
- **Não** misturar papéis de usuário: hoje só existe o papel **dono (usuário único)**; o "(Futuro) Assinante SaaS" não deve gerar telas ou lógica ativa agora, apenas a modelagem multi-tenant já prevista.
