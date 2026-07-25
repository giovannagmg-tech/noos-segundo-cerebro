## 1. Contexto

O **Noos** nasce para resolver a fragmentação do conhecimento pessoal do seu dono, que hoje mantém anotações de cursos de marketing, branding e neurociência espalhadas entre Notion e Obsidian, além de gerir produtividade em ferramentas separadas como TickTick e Capacities. O cenário de uso principal é a **web** (revisão, linkagem e navegação profunda do conhecimento), com apoio **mobile** para captura rápida entre reuniões. Inicialmente o Noos é de **uso estritamente pessoal** (um único dono), mas já é modelado para eventualmente virar um produto SaaS onde cada pessoa tem seu próprio segundo cérebro isolado. A construção segue em duas fases: primeiro o núcleo de conhecimento (notas, grafo, tags, Pomodoro, captura mobile) e depois a camada de produtividade e vida (tarefas, projetos, hábitos, metas, agenda e IA de apoio).

## 2. Problema

O conhecimento acumulado em cursos está hoje **fragmentado entre Notion e Obsidian**, sem um lugar único para revisar, consultar e — sobretudo — **linkar conhecimentos e referências entre áreas distintas** (como marketing conversando com neurociência). Além da dispersão de anotações, a rotina de produtividade também vive espalhada: tarefas, hábitos, metas e agenda em aplicativos separados (TickTick, calendário, etc.), obrigando a alternar entre ferramentas para ter uma visão do dia. Falta um repertório que **evolua ao longo do tempo**, que revele conexões que ainda não foram percebidas, e que una estudo e execução num só painel. O Noos ataca exatamente essa dor: consolidar o acervo intelectual num grafo navegável e, na sequência, unificar a vida prática ao redor dele.

## 3. Objetivos

1. **Centralizar 100% do acervo de conhecimento** em um único app, permitindo importar incrementalmente (nota a nota) o conteúdo hoje preso no Notion e Obsidian — meta de acervo na casa das centenas de notas.
2. **Tornar as conexões entre áreas visíveis e navegáveis** via grafo visual, com no mínimo 1 grafo filtrável por tag/área e navegação nó-a-nota funcionando desde a Fase 1.
3. **Apoiar o estudo focado** com Pomodoro vinculável a notas, registrando ao menos 100% das sessões de foco iniciadas para histórico de revisão.
4. **(Fase 2) Unificar produtividade e vida** em um só painel — tarefas (lista/kanban/calendário), projetos, hábitos por período do dia, metas por categoria e agenda integrada ao Google Calendar.
5. **(Fase 2) Gerar valor com IA** entregando sugestões automáticas de conexões entre notas (item B) e resumos/insights de progresso de metas e hábitos (item C).

## 4. Personas

### Persona 1 — Rafael, o dono do segundo cérebro (usuário único, foco atual)
- **Papel:** Único dono e operador do Noos na fase inicial; cria e conecta notas, organiza por tags, estuda com Pomodoro e, na Fase 2, gerencia tarefas, projetos, hábitos, metas e recebe apoio da IA.
- **Dor:** "Meu conhecimento de cursos está quebrado entre Notion e Obsidian e não consigo ver como uma área conversa com a outra."
- **Objetivo:** Ter um repertório único, conectado e em evolução constante, que sirva tanto para revisar conhecimento quanto para organizar a vida.
- **Citação representativa:** *"Quero juntar todas as anotações de cursos que já fiz de todas as áreas e ter tudo em um lugar só para revisar, consultar, linkar conhecimentos e ir evoluindo esse banco de conhecimento."*

### Persona 2 — Marina, a futura assinante SaaS (papel futuro)
- **Papel:** Pessoa que, numa evolução futura do Noos como produto, terá seu próprio segundo cérebro isolado, com dados privados só dela — mesma jornada de Rafael.
- **Dor:** Também sofre com conhecimento e rotina espalhados em várias ferramentas e busca uma solução única.
- **Objetivo:** Ter seu acervo e sua produtividade num único app privado, sem enxergar dados de outros usuários.
- **Citação representativa:** *"Poderia evoluir para um produto SaaS no futuro sim, mas inicialmente é para uso pessoal meu."*

## 5. Requisitos funcionais

**Fase 1 — Conhecimento**
- **RF-01:** O sistema deve permitir que o dono se autentique via magic link, email+senha ou OAuth Google.
- **RF-02:** O sistema deve permitir que o dono crie uma nova nota com título e conteúdo em markdown diretamente no Noos.
- **RF-03:** O sistema deve permitir que o dono importe/cole o conteúdo de uma nota existente do Notion ou Obsidian de forma incremental (uma nota por vez), sem exigir migração completa.
- **RF-04:** O sistema deve permitir que o dono classifique cada nota com uma ou mais tags de área (ex.: marketing, branding, neurociência) e defina cores para essas tags.
- **RF-05:** O sistema deve permitir que o dono crie links entre notas (referências cruzadas de conhecimento) dentro do texto ou pela interface da nota.
- **RF-06:** O sistema deve permitir que o dono associe referências externas (cursos, autores, artigos, URLs) a uma nota.
- **RF-07:** O sistema deve permitir que o dono visualize todas as suas notas e conexões em um grafo visual interativo, exibindo apenas os dados do próprio dono.
- **RF-08:** O sistema deve permitir que o dono filtre o grafo e as buscas por tag/área para focar num domínio durante a revisão.
- **RF-09:** O sistema deve permitir que o dono clique em qualquer nó do grafo para abrir a nota correspondente e continuar navegando.
- **RF-10:** O sistema deve permitir que o dono busque notas por texto (busca full-text sobre título e conteúdo).
- **RF-11:** O sistema deve permitir que o dono inicie, encerre e registre sessões de Pomodoro em blocos de foco, opcionalmente vinculadas a uma nota.
- **RF-12:** O sistema deve permitir que o dono faça uma captura rápida de nota pela versão mobile (título + conteúdo), que fica marcada como captura rápida para organização posterior na web.
- **RF-13:** O sistema deve permitir que o dono acesse uma inbox de capturas rápidas na web para organizar (tags, links, grafo) as notas capturadas no mobile.

**Fase 2 — Produtividade e Vida**
- **RF-14:** O sistema deve permitir que o dono crie tarefas e as organize por áreas da vida ou listas.
- **RF-15:** O sistema deve permitir que o dono visualize tarefas em lista, kanban ou calendário sem perder os vínculos de área e projeto.
- **RF-16:** O sistema deve permitir que o dono crie projetos e conecte tarefas a eles, acompanhando o andamento.
- **RF-17:** O sistema deve permitir que o dono classifique tarefas na Matriz de Eisenhower por quadrante urgente/importante.
- **RF-18:** O sistema deve permitir que o dono registre hábitos em um dashboard agrupado por período do dia (manhã/tarde/noite) e os marque como cumpridos, gerando histórico e sequências (streaks).
- **RF-19:** O sistema deve permitir que o dono defina metas de vida por categoria e acompanhe o progresso por métricas.
- **RF-20:** O sistema deve conceder recompensas ao dono conforme sequências de hábitos e conclusão de metas/tarefas, acumulando pontos.
- **RF-21:** O sistema deve permitir que o dono vincule sua conta do Google Calendar para visualizar e editar compromissos dentro do Noos (sincronização bidirecional).
- **RF-22:** O sistema deve permitir que o dono consulte uma agenda do dia inteligente que reúne compromissos do calendário, tarefas com data no dia e hábitos previstos.
- **RF-23:** O sistema deve enviar alertas de prazo ao dono quando uma tarefa ou meta se aproxima do vencimento.
- **RF-24:** O sistema deve sugerir automaticamente conexões entre notas relacionadas ainda não linkadas (item B), permitindo que o dono aceite ou dispense cada sugestão.
- **RF-25:** O sistema deve gerar resumos e insights de progresso sobre metas e hábitos (item C) para o dono consultar e se autodirecionar.
- **RF-26:** O sistema deve exibir métricas consolidadas de cumprimento de hábitos, progresso de metas e status/quadrante de tarefas.
- **RF-27:** O sistema deve permitir que o dono gerencie seu perfil e a conexão da conta Google Calendar em uma página de configurações.

## 6. Requisitos não-funcionais

- **Arquitetura multi-tenant desde o dia 1:** toda tabela carrega `user_id` e nasce preparada para o modo SaaS futuro, mesmo no uso pessoal — sem refazer arquitetura ao evoluir.
- **Segurança e isolamento (RLS):** Row Level Security ligado em todas as tabelas com política padrão `user_id = auth.uid()`, garantindo que cada dono enxergue apenas o próprio segundo cérebro. Tokens OAuth do Google Calendar e escrita de embeddings/insights ocorrem apenas via Edge Functions com service role — chaves e tokens nunca ficam no frontend.
- **Performance:** grafo e listas com índices dedicados (incluindo GIN full-text para busca e ivfflat/hnsw pgvector para similaridade), respondendo consultas típicas do acervo pessoal (centenas de notas) de forma fluida (< 1s no carregamento do grafo).
- **Disponibilidade:** backend gerenciado no Supabase (PostgreSQL + Auth + Storage + Edge Functions + Realtime + pg_cron); deploy do frontend com preview via Lovable.
- **Mobile:** experiência mobile-first para a captura rápida, sem exigir o fluxo completo de grafo/linkagem no celular.
- **LGPD / dados pessoais:** todo o conteúdo é de dados pessoais do próprio dono; o isolamento por RLS assegura privacidade. Tokens do Google Calendar armazenados de forma restrita (acesso só por service role) e sujeitos a revogação. Ao evoluir para SaaS, cada assinante mantém dados privados isolados por RLS.
- **Uso responsável de IA:** as APIs de IA (embeddings e insights) são acionadas exclusivamente sobre o conteúdo do próprio dono, via Edge Functions, com custo pague-por-uso adequado ao volume pessoal.

## 7. Métricas de sucesso

1. **Consolidação do acervo:** 100% das notas de cursos que o dono decidir migrar do Notion/Obsidian importadas e disponíveis no Noos ao longo do processo incremental.
2. **Densidade de conexões:** média de ao menos 2 links por nota no grafo, evidenciando que o conhecimento está de fato interligado (e não apenas armazenado).
3. **Adoção do foco:** 100% das sessões de Pomodoro iniciadas registradas com histórico, permitindo acompanhar tempo de estudo/revisão.
4. **(Fase 2) Aderência a hábitos:** taxa de cumprimento de hábitos visível e streaks calculados corretamente para 100% dos hábitos ativos.
5. **(Fase 2) Valor da IA:** ao menos 60% das sugestões de conexão apresentadas resultam em ação do dono (aceitar ou dispensar), e insights de progresso gerados semanalmente sem intervenção manual.

## 8. Fora de escopo

- **Chat com IA sobre as próprias notas (item A):** explicitamente adiado para uma fase posterior, conforme priorização do dono (foco inicial em B e C).
- **Migração automática em massa do Notion/Obsidian:** a importação é incremental, nota a nota; não há conector de sincronização automática completa nesta versão.
- **Aplicativo mobile nativo completo:** o mobile cobre apenas captura rápida; a organização plena (grafo, links, tags) acontece na web.
- **Integração de hábitos e tarefas com ferramentas externas:** conforme indicado, hábitos e tarefas não se conectam a nenhuma ferramenta externa — apenas a agenda integra com Google Calendar.
- **Modo SaaS multiusuário em produção:** a arquitetura já é multi-tenant, mas o onboarding público de assinantes, cobrança e planos não fazem parte desta primeira versão pessoal.
- **Colaboração / compartilhamento entre usuários:** notas, grafo e produtividade são privados do dono; não há compartilhamento nesta versão.
