import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getDailyAgenda, type DailyAgenda } from '@/lib/api/agenda'
import { getConnectionStatus } from '@/lib/api/calendar'

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10)
}

export default function Agenda() {
  const navigate = useNavigate()
  const [date, setDate] = useState(new Date())
  const [agenda, setAgenda] = useState<DailyAgenda | null>(null)
  const [connected, setConnected] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [data, status] = await Promise.all([
        getDailyAgenda(toISODate(date)),
        getConnectionStatus(),
      ])
      setAgenda(data)
      setConnected(status.connected)
    } catch (err) {
      console.error(err)
      toast.error('Não foi possível montar sua agenda. Tentar novamente.')
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => {
    load()
  }, [load])

  function shiftDay(delta: number) {
    setDate((d) => {
      const next = new Date(d)
      next.setDate(d.getDate() + delta)
      return next
    })
  }

  const isEmpty =
    agenda && agenda.events.length === 0 && agenda.tasks.length === 0 && agenda.habits.length === 0

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Agenda</h1>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => shiftDay(-1)}>
            ←
          </Button>
          <span className="min-w-32 text-center text-sm capitalize">
            {date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'short' })}
          </span>
          <Button variant="ghost" size="sm" onClick={() => shiftDay(1)}>
            →
          </Button>
        </div>
      </div>

      {connected === false && (
        <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
          Conecte seu Google Calendar em{' '}
          <Link to="/settings" className="underline">
            Configurações
          </Link>{' '}
          para ver compromissos aqui.
        </p>
      )}

      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : isEmpty ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          Nada agendado para hoje — aproveite ou planeje seu dia.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {agenda!.events.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-medium text-muted-foreground">Compromissos</h2>
              <ul className="flex flex-col divide-y rounded-lg border">
                {agenda!.events.map((e) => (
                  <li key={e.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span>{e.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(e.starts_at).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {agenda!.tasks.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-medium text-muted-foreground">Tarefas com prazo hoje</h2>
              <ul className="flex flex-col divide-y rounded-lg border">
                {agenda!.tasks.map((t) => (
                  <li
                    key={t.id}
                    onClick={() => navigate('/tasks')}
                    className="cursor-pointer px-4 py-2.5 text-sm hover:bg-muted/50"
                  >
                    <span className={t.status === 'done' ? 'text-muted-foreground line-through' : ''}>
                      {t.title}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {agenda!.habits.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-medium text-muted-foreground">Hábitos previstos</h2>
              <ul className="flex flex-wrap gap-2">
                {agenda!.habits.map((h) => (
                  <li
                    key={h.id}
                    onClick={() => navigate('/habits')}
                    className="cursor-pointer rounded-full border px-3 py-1 text-xs hover:bg-muted/50"
                  >
                    {h.name} · 🔥{h.current_streak}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
