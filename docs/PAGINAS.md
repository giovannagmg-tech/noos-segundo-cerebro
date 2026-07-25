# Documentação de Páginas — Noos (Segundo Cérebro)

Este documento detalha cada página do frontend do **Noos**, construído em **React + Tailwind + shadcn/ui** sobre **Supabase**. As páginas seguem exatamente a estrutura definida em `docs/ESTRUTURA.md`, organizadas em **Fase 1 (Conhecimento)** e **Fase 2 (Produtividade e Vida)**.

**Papéis de usuário** (do PROCESSO): **Você (dono do segundo cérebro / usuário único)** é o único papel ativo na fase inicial. O **(Futuro) Assinante SaaS** só entra em cena se/quando o Noos virar produto — nesse caso, cada assinante enxerga exatamente as mesmas telas, mas restrito aos próprios dados via RLS (`user_id = auth.uid()`). Como a arquitetura já nasce multi-tenant, **nenhuma tela precisa mudar** para suportar o modo SaaS — apenas o cadastro de novos usuários é liberado. Onde não há distinção de papéis, considere que a página é acessível ao dono autenticado e, no futuro, a cada assinante sobre seus próprios dados.

---

## FASE 1 — Conhecimento

### /login

**Rota:** `/login`

**Propósito:** Autenticar o dono do Noos (e futuros assinantes) para acessar o segundo cérebro.

**Seções da tela:**
- Logo/nome "Noos" e frase de posicionamento ("seu segundo cérebro").
- Campo de e-mail para **magic link** (login sem senha, padrão para dono único).
- Opção alternativa de **e-mail + senha**.
- Botão **"Entrar com Google"** (OAuth — também necessário depois para o Google Calendar).
- Link de ajuda / "verifique seu e-mail" após enviar magic link.

**Estados:**
- **Vazio/inicial:** formulário limpo pronto para digitar o e-mail.
- **Carregando:** botão com spinner ao enviar magic link ou autenticar; mensagem "Enviando link de acesso...".
- **Sucesso (magic link):** aviso "Enviamos um link para seu e-mail — confira sua caixa de entrada".
- **Erro:** mensagem clara ("E-mail inválido", "Falha ao autenticar, tente novamente", "Link expirado").

**Permissões:** Pública (não autenticada). Qualquer visitante acessa. Após login, redireciona para `/notes`. No modo SaaS futuro, é aqui que novos assinantes se cadastram.

---

### /notes

**Rota:** `/notes`

**Propósito:** Listar, buscar e organizar todas as notas de conhecimento, incluindo a inbox de capturas rápidas a organizar.

**Seções da tela:**
- Barra de **busca por texto** (full-text via `search_notes`).
- **Filtro por tag/área** (marketing, branding, neurociência etc.).
- **Inbox de capturas rápidas** — destaque para notas com `is_quick_capture = true` vindas do mobile, aguardando organização.
- **Lista/grade de notas** com título, prévia do conteúdo, tags coloridas e data de atualização.
- Botão **"+ Nova nota"** e botão **"Importar do Notion/Obsidian"** (abre fluxo de colar conteúdo).
- Indicador de origem da nota (Notion, Obsidian, Noos, captura mobile).

**Estados:**
- **Vazio (sem notas):** ilustração e CTA "Crie sua primeira nota ou importe do Notion/Obsidian" — reflete o começo do acervo do zero/incremental.
- **Inbox vazia:** seção de capturas rápidas oculta ou com "Nenhuma captura pendente".
- **Carregando:** skeletons de cards de nota.
- **Busca sem resultados:** "Nenhuma nota encontrada para '<termo>'".
- **Erro:** "Não foi possível carregar suas notas. Tentar novamente."

**Permissões:** Dono autenticado (vê apenas as próprias notas via RLS). No SaaS futuro, cada assinante vê só o próprio acervo — tela idêntica.

---

### /notes/:id

**Rota:** `/notes/:id`

**Propósito:** Editar uma nota específica — conteúdo, tags, links entre notas, referências externas — e revisar sugestões de conexão da IA.

**Seções da tela:**
- Campo de **título** editável.
- **Editor de conteúdo em markdown** (corpo da nota).
- Seletor/exibição de **tags de área** aplicadas.
- Painel de **links para outras notas** (referências cruzadas, incluindo sintaxe `[[...]]`).
- Lista de **referências externas** (curso, autor, artigo, URL) com tipo.
- **Painel de sugestões da IA** (`link_suggestions`) — cada sugestão com nota alvo, justificativa (`reason`), score e botões **Aceitar** / **Descartar**.
- Botão para **iniciar Pomodoro** vinculado a esta nota.
- Metadados: origem, data de criação/atualização.

**Estados:**
- **Nota nova/vazia:** editor em branco com placeholder "Comece a escrever ou cole do Notion/Obsidian".
- **Sem sugestões da IA:** painel mostra "Nenhuma conexão sugerida ainda — sugestões aparecem conforme seu acervo cresce".
- **Carregando:** skeleton do editor e do painel lateral.
- **Salvando:** indicador "Salvando..." / "Salvo" (autosave).
- **Erro:** "Falha ao salvar a nota" com opção de tentar novamente; "Nota não encontrada" se o `:id` for inválido.

**Permissões:** Dono autenticado (só acessa notas onde `user_id = auth.uid()`). Tentativa de abrir nota de outro usuário retorna "não encontrada". SaaS futuro: idêntico por assinante.

---

### /graph

**Rota:** `/graph`

**Propósito:** Visualizar o grafo interativo de notas e suas conexões, estilo Capacities/Obsidian, para enxergar como as áreas de conhecimento se conectam.

**Seções da tela:**
- **Canvas do grafo** — nós (notas) e arestas (links), com nós coloridos pela tag/área.
- **Filtro por tag/área** para focar num domínio (via `get_knowledge_graph(filter_tag_id)`).
- **Legenda de cores** por tag.
- Controles de **zoom, pan e reorganização** do grafo.
- Ao clicar num nó: mini-preview da nota + botão "Abrir nota" (leva a `/notes/:id`).
- Contadores (nº de notas, nº de conexões).

**Estados:**
- **Vazio (sem notas/links):** mensagem "Seu grafo aparece aqui conforme você cria notas e as conecta" com CTA para criar/linkar notas.
- **Poucas notas sem links:** nós soltos com dica "Conecte suas notas para ver o conhecimento se entrelaçar".
- **Carregando:** placeholder/spinner enquanto o payload do grafo é montado.
- **Erro:** "Não foi possível carregar o grafo. Tentar novamente."

**Permissões:** Dono autenticado — grafo exibe apenas suas notas e conexões. SaaS futuro: cada assinante vê seu próprio grafo isolado.

---

### /tags

**Rota:** `/tags`

**Propósito:** Gerenciar as tags de área (marketing, branding, neurociência etc.) e suas cores, que organizam notas e colorem o grafo.

**Seções da tela:**
- **Lista de tags** com nome, cor e contagem de notas associadas.
- Formulário/inline para **criar nova tag** (nome + seletor de cor hex).
- Ações de **editar** (renomear, trocar cor) e **excluir** cada tag.
- Aviso de unicidade (não permite tag duplicada por dono).

**Estados:**
- **Vazio:** "Nenhuma tag criada ainda — crie tags de área para organizar suas notas".
- **Carregando:** skeleton da lista.
- **Erro de duplicidade:** "Já existe uma tag com esse nome".
- **Erro:** "Falha ao salvar tag. Tentar novamente."

**Permissões:** Dono autenticado (só suas tags via RLS). SaaS futuro: idêntico por assinante.

---

### /pomodoro

**Rota:** `/pomodoro`

**Propósito:** Executar sessões de Pomodoro (blocos de foco) durante estudo/revisão, opcionalmente vinculadas a uma nota, registrando `pomodoro_sessions`.

**Seções da tela:**
- **Timer central** com tempo de foco (default 25 min) e controles Iniciar/Pausar/Encerrar.
- Seletor opcional de **nota em foco** (vincula à sessão).
- Contador de **ciclos completados** na sessão.
- **Histórico recente** de sessões (data, minutos, ciclos, nota associada).
- Ajuste do tempo de foco por sessão.

**Estados:**
- **Vazio (sem histórico):** "Você ainda não fez nenhuma sessão de foco — inicie seu primeiro Pomodoro".
- **Em execução:** timer contando, botões de pausar/encerrar ativos.
- **Carregando:** skeleton do histórico.
- **Erro:** "Não foi possível registrar a sessão" (o timer continua funcionando localmente).

**Permissões:** Dono autenticado (sessões próprias via RLS). SaaS futuro: idêntico por assinante.

---

### /capture

**Rota:** `/capture`

**Propósito:** Captura rápida de nota mobile-first (título + conteúdo) para registrar ideias fora da mesa, a organizar depois na web.

**Seções da tela:**
- Layout **enxuto e mobile-first** com foco imediato no campo de escrita.
- Campo de **título** (opcional) e campo de **conteúdo** amplo.
- Botão único e grande **"Salvar captura"** (marca `is_quick_capture = true`, `source = mobile_capture`).
- Confirmação rápida "Salvo na sua inbox" após salvar.
- Atalho para acessar `/notes` (organizar depois).

**Estados:**
- **Vazio/inicial:** campos limpos com placeholder "O que você quer capturar?".
- **Salvando:** botão com spinner "Salvando...".
- **Sucesso:** toast "Captura salva — organize depois na web" e campos limpos para nova captura.
- **Offline/erro:** aviso "Sem conexão — sua captura será enviada quando voltar online" (ou "Falha ao salvar, tentar novamente").

**Permissões:** Dono autenticado. Otimizada para uso no celular, coerente com o uso "mais na web, mobile para captura rápida". SaaS futuro: idêntico por assinante.

---

## FASE 2 — Produtividade e Vida

### /tasks

**Rota:** `/tasks`

**Propósito:** Gerenciar tarefas em três visões (lista, kanban e calendário), filtradas por área/lista e com vínculo a projeto.

**Seções da tela:**
- **Alternador de visão:** Lista | Kanban | Calendário.
- **Filtro por área da vida / lista** e por projeto.
- **Visão Lista:** tarefas com título, status, prazo, área e projeto.
- **Visão Kanban:** colunas `todo` / `doing` / `done` com arrastar-e-soltar (usa `kanban_order`).
- **Visão Calendário:** tarefas posicionadas por `due_date`.
- Botão **"+ Nova tarefa"** e modal de criação/edição (título, descrição, área, projeto, prazo, quadrante Eisenhower).
- Indicador visual de tarefas com prazo próximo (alertas).

**Estados:**
- **Vazio:** "Nenhuma tarefa ainda — crie sua primeira tarefa e organize por área".
- **Filtro sem resultados:** "Nenhuma tarefa nesta área/projeto".
- **Carregando:** skeletons por coluna/lista.
- **Erro:** "Não foi possível carregar suas tarefas. Tentar novamente."

**Permissões:** Dono autenticado (só suas tarefas via RLS). SaaS futuro: idêntico por assinante.

---

### /tasks/eisenhower

**Rota:** `/tasks/eisenhower`

**Propósito:** Classificar e priorizar tarefas na Matriz de Eisenhower por quadrante urgente/importante.

**Seções da tela:**
- **Matriz 2x2** com os quadrantes: Urgente+Importante, Não urgente+Importante, Urgente+Não importante, Não urgente+Não importante.
- **Cards de tarefa** distribuídos por `eisenhower_quadrant`, arrastáveis entre quadrantes.
- Contador de tarefas por quadrante.
- Filtro por área/projeto (opcional) para focar a priorização.

**Estados:**
- **Vazio:** matriz com quadrantes vazios e dica "Arraste tarefas para priorizar por urgência e importância".
- **Tarefas não classificadas:** área/lista lateral com tarefas ainda sem quadrante para arrastar.
- **Carregando:** skeletons nos quadrantes.
- **Erro:** "Falha ao carregar a matriz. Tentar novamente."

**Permissões:** Dono autenticado (só suas tarefas). SaaS futuro: idêntico por assinante.

---

### /projects

**Rota:** `/projects`

**Propósito:** Listar projetos e ver o detalhe de cada um com as tarefas vinculadas e seu andamento.

**Seções da tela:**
- **Lista de projetos** com nome, área associada, status (active/completed/archived) e progresso.
- Botão **"+ Novo projeto"** (nome, descrição, área).
- **Detalhe do projeto:** descrição, tarefas vinculadas (lista/kanban embutido) e indicador de andamento (concluídas vs. totais).
- Ações de **arquivar/concluir** projeto.

**Estados:**
- **Vazio:** "Nenhum projeto ainda — crie um projeto e conecte tarefas a ele".
- **Projeto sem tarefas:** "Este projeto ainda não tem tarefas — adicione a primeira".
- **Carregando:** skeleton da lista/detalhe.
- **Erro:** "Não foi possível carregar os projetos. Tentar novamente."

**Permissões:** Dono autenticado (só seus projetos via RLS). SaaS futuro: idêntico por assinante.

---

### /habits

**Rota:** `/habits`

**Propósito:** Dashboard de hábitos agrupado por período do dia (manhã/tarde/noite), com marcação diária e acompanhamento de sequências (streaks), estilo TickTick.

**Seções da tela:**
- **Grupos por período do dia:** Manhã, Tarde, Noite.
- **Cards de hábito** com nome, área, dias previstos, `current_streak` e `best_streak`.
- **Checkbox/toggle de cumprimento do dia** (chama `toggle_habit_log`, pode disparar recompensa).
- Botão **"+ Novo hábito"** (nome, área, período do dia, dias-alvo).
- Indicador visual de sequência ativa (fogo/streak).

**Estados:**
- **Vazio:** "Nenhum hábito ainda — crie hábitos e agrupe por período do dia".
- **Período sem hábitos:** o grupo (ex: Tarde) mostra "Nenhum hábito neste período".
- **Carregando:** skeletons dos cards.
- **Marcando:** feedback imediato ao togglar; toast de recompensa quando um marco é atingido.
- **Erro:** "Não foi possível registrar o hábito. Tentar novamente."

**Permissões:** Dono autenticado (só seus hábitos via RLS). SaaS futuro: idêntico por assinante.

---

### /goals

**Rota:** `/goals`

**Propósito:** Definir e acompanhar metas de vida por categoria, com barras de progresso por métrica.

**Seções da tela:**
- **Lista de metas agrupadas por categoria**, cada uma com área, valor atual/alvo, unidade e prazo.
- **Barra de progresso** (`current_value` / `target_value`).
- Botão **"+ Nova meta"** (título, categoria, área, valor alvo, unidade, prazo).
- Status da meta (active / achieved / abandoned) e indicador de prazo próximo.
- Ação de atualizar progresso.

**Estados:**
- **Vazio:** "Nenhuma meta definida — crie metas de vida por categoria".
- **Sem prazo/valor:** exibe progresso simples sem barra numérica.
- **Carregando:** skeletons das metas.
- **Meta concluída:** destaque visual "Meta alcançada 🎉".
- **Erro:** "Falha ao carregar suas metas. Tentar novamente."

**Permissões:** Dono autenticado (só suas metas via RLS). SaaS futuro: idêntico por assinante.

---

### /metrics

**Rota:** `/metrics`

**Propósito:** Visão consolidada de métricas de hábitos, metas e tarefas (via `get_dashboard_metrics`).

**Seções da tela:**
- **Cartões-resumo:** taxa de cumprimento de hábitos, nº de metas ativas/alcançadas, tarefas por status.
- **Gráfico de tarefas por status** (todo/doing/done) e **por quadrante Eisenhower**.
- **Gráfico de cumprimento de hábitos** ao longo do tempo.
- **Progresso agregado de metas** por categoria.

**Estados:**
- **Vazio (sem dados de Fase 2):** "Suas métricas aparecem conforme você registra hábitos, metas e tarefas".
- **Carregando:** skeletons de cartões e gráficos.
- **Erro:** "Não foi possível calcular as métricas. Tentar novamente."

**Permissões:** Dono autenticado (métricas calculadas sobre os próprios dados via RLS/RPC). SaaS futuro: idêntico por assinante.

---

### /rewards

**Rota:** `/rewards`

**Propósito:** Exibir o histórico de recompensas conquistadas e o saldo de pontos (`reward_points`).

**Seções da tela:**
- **Saldo de pontos** em destaque (`profiles.reward_points`).
- **Histórico de recompensas** com título, pontos, tipo de gatilho (habit_streak / goal_completed / task_completed) e data.
- Filtro por tipo de gatilho (opcional).

**Estados:**
- **Vazio:** "Nenhuma recompensa ainda — mantenha hábitos e conclua metas para ganhar pontos".
- **Carregando:** skeleton da lista e do saldo.
- **Erro:** "Não foi possível carregar suas recompensas. Tentar novamente."

**Permissões:** Dono autenticado — recompensas são concedidas por Edge Functions/cron (service role) e o dono apenas visualiza (SELECT). SaaS futuro: idêntico por assinante.

---

### /agenda

**Rota:** `/agenda`

**Propósito:** Agenda do dia inteligente, que consolida compromissos do calendário, tarefas do dia e hábitos previstos naquele período (via `get_daily_agenda`).

**Seções da tela:**
- **Seletor de dia** (hoje por padrão).
- **Linha do tempo do dia** com compromissos do Google Calendar (`calendar_events`).
- **Tarefas com prazo no dia** (`tasks.due_date`).
- **Hábitos previstos** para o dia, agrupados por período (manhã/tarde/noite).
- Indicadores de prazo próximo / alertas.

**Estados:**
- **Vazio:** "Nada agendado para hoje — aproveite ou planeje seu dia".
- **Sem calendário conectado:** aviso "Conecte seu Google Calendar em Configurações para ver compromissos aqui".
- **Carregando:** skeleton da linha do tempo.
- **Erro:** "Não foi possível montar sua agenda. Tentar novamente."

**Permissões:** Dono autenticado (consolida apenas os próprios eventos, tarefas e hábitos). SaaS futuro: idêntico por assinante.

---

### /calendar

**Rota:** `/calendar`

**Propósito:** Visão de calendário integrada ao Google Calendar para visualizar e editar eventos dentro do próprio Noos (sincronização bidirecional).

**Seções da tela:**
- **Visão de calendário** (mês/semana/dia) com os `calendar_events` sincronizados.
- Botão **"+ Novo evento"** e edição de evento (título, início, fim) — mudanças ficam `pending_push` até o próximo sync.
- Indicador de **status de sincronização** por evento (synced / pending_push / local_only).
- Botão/estado de **"Conectar Google Calendar"** quando não há conta vinculada.
- Indicador do último sync (`google-calendar-sync` roda a cada 15 min).

**Estados:**
- **Sem conta conectada:** CTA central "Conecte sua conta do Google Calendar para ver e editar eventos aqui".
- **Vazio (conectado, sem eventos):** calendário limpo "Nenhum evento neste período".
- **Carregando/sincronizando:** indicador "Sincronizando com o Google...".
- **Erro de sync:** "Falha na sincronização — tentaremos novamente" com opção de re-sync manual; erro de token expirado orienta reconectar em `/settings`.

**Permissões:** Dono autenticado. Os tokens OAuth ficam em `calendar_connections`, manipulados apenas por Edge Functions (service role) — nunca no frontend. SaaS futuro: cada assinante conecta seu próprio Google Calendar.

---

### /insights

**Rota:** `/insights`

**Propósito:** Exibir resumos e insights de progresso sobre metas e hábitos gerados pela IA (item C), para autodirecionamento.

**Seções da tela:**
- **Lista de insights** (`ai_insights`) por tipo: progresso de metas, resumo de hábitos, revisão semanal — com conteúdo e período coberto.
- Card do **insight mais recente** em destaque (ex: revisão da semana).
- Botão **"Gerar insight agora"** (dispara `generate-progress-insights` sob demanda).
- Indicação de quando o próximo insight automático (cron semanal) será gerado.

**Estados:**
- **Vazio:** "Seus insights de progresso aparecem aqui — gere o primeiro ou aguarde a revisão semanal".
- **Gerando:** indicador "A IA está analisando seu progresso...".
- **Sem dados suficientes:** "Registre alguns hábitos e metas para a IA gerar insights úteis".
- **Erro:** "Não foi possível gerar o insight. Tentar novamente."

**Permissões:** Dono autenticado — insights são gerados por Edge Function/cron (service role, Gemini 2.5 Pro / GPT 5.4) sobre os próprios dados; o dono apenas visualiza e dispara sob demanda. SaaS futuro: idêntico por assinante.

---

### /settings

**Rota:** `/settings`

**Propósito:** Gerenciar perfil, conexão da conta Google Calendar e preferências do Noos.

**Seções da tela:**
- **Perfil:** nome de exibição (`display_name`), avatar, e-mail da conta.
- **Conexão Google Calendar:** botão "Conectar" / status "Conectado" com opção de desconectar (dispara `google-calendar-oauth`); qual calendário está vinculado.
- **Preferências:** tempo padrão de Pomodoro, rótulos de período do dia, preferências de alertas de prazo (e-mail via Resend).
- **Conta:** sair (logout); informações da assinatura (relevante no modo SaaS futuro).

**Estados:**
- **Inicial:** dados do perfil carregados; Google Calendar mostrando "Não conectado".
- **Carregando:** skeleton das seções.
- **Salvando:** "Salvando preferências..." / "Salvo".
- **Erro:** "Falha ao salvar. Tentar novamente."; erro de reconexão do Google orienta refazer o OAuth.

**Permissões:** Dono autenticado (edita apenas o próprio perfil e a própria conexão de calendário). Tokens gerenciados por Edge Function via service role. SaaS futuro: cada assinante gerencia seu próprio perfil, conexão e, eventualmente, plano.

---

## Observações transversais

- **Autenticação obrigatória:** todas as páginas exceto `/login` exigem sessão ativa; sem sessão, redirecionam para `/login`.
- **Isolamento por dono (RLS):** toda tela lê e escreve apenas dados onde `user_id = auth.uid()`. Isso vale hoje (dono único) e garante que o modo SaaS futuro funcione sem mudança de telas.
- **Progressividade de fases:** as páginas de Fase 2 (`/tasks`, `/tasks/eisenhower`, `/projects`, `/habits`, `/goals`, `/metrics`, `/rewards`, `/agenda`, `/calendar`, `/insights`) podem ser liberadas na navegação após a Fase 1 estar estável, sem alterar as telas de conhecimento.
- **Mobile:** a experiência web é a principal; `/capture` é a tela otimizada para o celular, coerente com o uso descrito ("mais na web, mobile para captura rápida").
