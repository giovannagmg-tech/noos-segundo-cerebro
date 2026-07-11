# Noos

Segundo cérebro pessoal: notas conectadas, projetos/tarefas e hábitos sob uma
taxonomia única de Áreas, com um módulo dedicado ao aprendizado de idiomas.

## Estrutura do repositório

- **`web/`** — o app Next.js (TypeScript + Tailwind v4 + App Router). É aqui
  que a aplicação de verdade é construída.
- **`supabase/`** — schema do banco (migrations SQL) e config do projeto
  Supabase local. Ver `supabase/README.md` para como criar o projeto e
  aplicar as migrations.
- **`brand/`** — identidade visual finalizada (logo, paleta OKLCH,
  tipografia). Fonte de verdade pros tokens usados em `web/`.

## Rodando localmente

```bash
cd web
cp .env.local.example .env.local   # preencher com Project URL + anon key do Supabase
npm install
npm run dev
```

## Documentação de arquitetura

O plano de arquitetura completo (pilares, modelo de dados, roadmap por
fases) e os wireframes interativos das telas centrais vivem como Artifacts
do Claude Code — não neste repositório.
