import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getRewardPoints, listRewards, type Reward } from '@/lib/api/rewards'

const TRIGGER_LABEL: Record<string, string> = {
  habit_streak: 'Sequência de hábito',
  goal_completed: 'Meta concluída',
  task_completed: 'Tarefa concluída',
}

export default function Rewards() {
  const [rewards, setRewards] = useState<Reward[]>([])
  const [points, setPoints] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    Promise.all([listRewards(), getRewardPoints()])
      .then(([r, p]) => {
        setRewards(r)
        setPoints(p)
      })
      .catch((err) => {
        console.error(err)
        toast.error('Não foi possível carregar suas recompensas. Tentar novamente.')
      })
      .finally(() => setLoading(false))
  }, [])

  const filtered = filter === 'all' ? rewards : rewards.filter((r) => r.trigger_type === filter)

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <h1 className="text-xl font-semibold">Recompensas</h1>

      <div className="flex flex-col items-center gap-1 rounded-lg border p-6">
        <span className="text-xs text-muted-foreground">Saldo de pontos</span>
        <span className="text-4xl font-semibold tabular-nums">{points}</span>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : rewards.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          Nenhuma recompensa ainda — mantenha hábitos e conclua metas para ganhar pontos.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os gatilhos</SelectItem>
              {Object.entries(TRIGGER_LABEL).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ul className="flex flex-col divide-y rounded-lg border">
            {filtered.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 px-4 py-3">
                <div className="flex flex-col">
                  <span className="text-sm">{r.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {r.trigger_type ? TRIGGER_LABEL[r.trigger_type] ?? r.trigger_type : ''} ·{' '}
                    {new Date(r.awarded_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                  </span>
                </div>
                <span className="text-sm font-medium tabular-nums">+{r.points}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
