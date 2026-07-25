import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { getDashboardMetrics, type DashboardMetrics } from '@/lib/api/metrics'
import { QUADRANTS } from './TasksEisenhower'

const STATUS_DEFS: { id: string; label: string; color: string }[] = [
  { id: 'todo', label: 'A Fazer', color: 'var(--muted-foreground)' },
  { id: 'doing', label: 'Fazendo', color: 'var(--eq-q1)' },
  { id: 'done', label: 'Feito', color: 'var(--status-good)' },
]

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border p-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  )
}

export default function Metrics() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDashboardMetrics()
      .then(setMetrics)
      .catch((err) => {
        console.error(err)
        toast.error('Não foi possível calcular as métricas. Tentar novamente.')
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (!metrics) {
    return (
      <div className="mx-auto max-w-md py-24 text-center text-sm text-muted-foreground">
        Suas métricas aparecem conforme você registra hábitos, metas e tarefas.
      </div>
    )
  }

  const statusTotal = Object.values(metrics.tasks_by_status).reduce((a, b) => a + b, 0)
  const quadrantTotal = Object.values(metrics.tasks_by_quadrant).reduce((a, b) => a + b, 0)

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <h1 className="text-xl font-semibold">Métricas</h1>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Hábitos hoje"
          value={`${metrics.habits.completed_today}/${metrics.habits.total}`}
        />
        <StatCard label="Streak médio" value={`${metrics.habits.avg_streak}`} sub="dias" />
        <StatCard label="Metas ativas" value={`${metrics.goals.active}`} />
        <StatCard label="Metas alcançadas" value={`${metrics.goals.achieved}`} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">Tarefas por status</h2>
        {statusTotal === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma tarefa ainda.</p>
        ) : (
          <>
            <div className="flex h-2 overflow-hidden rounded-full bg-muted">
              {STATUS_DEFS.map((s) => {
                const count = metrics.tasks_by_status[s.id] ?? 0
                if (count === 0) return null
                return (
                  <div
                    key={s.id}
                    style={{ width: `${(count / statusTotal) * 100}%`, backgroundColor: s.color }}
                  />
                )
              })}
            </div>
            <div className="flex flex-wrap gap-4">
              {STATUS_DEFS.map((s) => (
                <div key={s.id} className="flex items-center gap-1.5 text-sm">
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-muted-foreground">{s.label}</span>
                  <span className="font-medium tabular-nums">{metrics.tasks_by_status[s.id] ?? 0}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">Tarefas por quadrante (Eisenhower)</h2>
        {quadrantTotal === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma tarefa classificada ainda.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {QUADRANTS.map((q) => (
              <div key={q.id} className="flex flex-col gap-1 rounded-lg border p-3">
                <span className="text-xs font-medium" style={{ color: q.color }}>
                  {q.roman}
                </span>
                <span className="text-lg font-semibold tabular-nums">
                  {metrics.tasks_by_quadrant[q.id] ?? 0}
                </span>
                <span className="text-xs text-muted-foreground">{q.label}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
