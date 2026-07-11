export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center bg-bg p-8">
      <div className="max-w-md rounded-[var(--radius-card)] bg-surface p-8 text-center shadow-sm">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">
          noos
        </h1>
        <p className="mt-3 font-display text-sm font-medium text-ink-muted">
          Scaffold pronto — tokens de marca carregados, Supabase conectado.
          As telas reais (Notas, Tarefas, Hábitos, Pomodoro) entram na Fase 1.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <span className="rounded-[var(--radius-pill)] bg-cat-notas-bg px-3 py-1 font-display text-xs font-semibold text-cat-notas-text">
            Notas
          </span>
          <span className="rounded-[var(--radius-pill)] bg-cat-tarefas-bg px-3 py-1 font-display text-xs font-semibold text-cat-tarefas-text">
            Tarefas
          </span>
          <span className="rounded-[var(--radius-pill)] bg-cat-habitos-bg px-3 py-1 font-display text-xs font-semibold text-cat-habitos-text">
            Hábitos
          </span>
          <span className="rounded-[var(--radius-pill)] bg-cat-idiomas-bg px-3 py-1 font-display text-xs font-semibold text-cat-idiomas-text">
            Idiomas
          </span>
        </div>
      </div>
    </div>
  );
}
