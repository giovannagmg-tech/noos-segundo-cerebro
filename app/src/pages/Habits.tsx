import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AreaBadge } from '@/components/AreaBadge'
import { AreaManagerDialog } from '@/components/AreaManagerDialog'
import { listAreas, type Area } from '@/lib/api/areas'
import {
  createHabit,
  getTodayCompletions,
  listHabits,
  toggleHabitLog,
  type DayPeriod,
  type HabitWithArea,
} from '@/lib/api/habits'
import { awardReward } from '@/lib/api/rewards'

const PERIODS: { id: DayPeriod; label: string }[] = [
  { id: 'morning', label: 'Manhã' },
  { id: 'afternoon', label: 'Tarde' },
  { id: 'evening', label: 'Noite' },
]

const WEEKDAYS: { id: string; label: string }[] = [
  { id: 'mon', label: 'Seg' },
  { id: 'tue', label: 'Ter' },
  { id: 'wed', label: 'Qua' },
  { id: 'thu', label: 'Qui' },
  { id: 'fri', label: 'Sex' },
  { id: 'sat', label: 'Sáb' },
  { id: 'sun', label: 'Dom' },
]

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export default function Habits() {
  const [habits, setHabits] = useState<HabitWithArea[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [completedToday, setCompletedToday] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [name, setName] = useState('')
  const [period, setPeriod] = useState<DayPeriod>('morning')
  const [areaId, setAreaId] = useState('none')
  const [targetDays, setTargetDays] = useState<string[]>(WEEKDAYS.map((d) => d.id))
  const [saving, setSaving] = useState(false)

  async function refresh() {
    setLoading(true)
    try {
      const [h, a, c] = await Promise.all([listHabits(), listAreas(), getTodayCompletions()])
      setHabits(h)
      setAreas(a)
      setCompletedToday(c)
    } catch (err) {
      console.error(err)
      toast.error('Não foi possível carregar seus hábitos. Tentar novamente.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function handleToggle(habit: HabitWithArea) {
    const wasCompleted = completedToday.has(habit.id)
    // feedback imediato
    setCompletedToday((prev) => {
      const next = new Set(prev)
      if (wasCompleted) next.delete(habit.id)
      else next.add(habit.id)
      return next
    })

    try {
      const result = await toggleHabitLog(habit.id, todayISO())
      setHabits((prev) =>
        prev.map((h) =>
          h.id === habit.id
            ? { ...h, current_streak: result.current_streak, best_streak: result.best_streak }
            : h,
        ),
      )
      if (result.milestone_reached) {
        try {
          await awardReward({
            trigger_type: 'habit_streak',
            source_id: habit.id,
            title: `Sequência de ${result.current_streak} dias — ${habit.name}`,
            points: result.milestone_points,
          })
          toast.success(
            `🔥 ${result.current_streak} dias seguidos em "${habit.name}" — +${result.milestone_points} pontos!`,
          )
        } catch (err) {
          console.error('Falha ao conceder recompensa:', err)
        }
      }
    } catch (err) {
      console.error(err)
      toast.error('Não foi possível registrar o hábito. Tentar novamente.')
      refresh()
    }
  }

  async function handleCreate() {
    if (!name.trim()) return
    setSaving(true)
    try {
      await createHabit({
        name: name.trim(),
        day_period: period,
        area_id: areaId === 'none' ? null : areaId,
        target_days: targetDays,
      })
      setDialogOpen(false)
      setName('')
      setPeriod('morning')
      setAreaId('none')
      setTargetDays(WEEKDAYS.map((d) => d.id))
      refresh()
    } catch {
      toast.error('Falha ao criar hábito.')
    } finally {
      setSaving(false)
    }
  }

  function toggleWeekday(id: string) {
    setTargetDays((prev) => (prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]))
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Hábito</h1>
        <div className="flex gap-2">
          <AreaManagerDialog onChanged={() => listAreas().then(setAreas)} />
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>+ Novo hábito</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo hábito</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="habit-name">Nome</Label>
                  <Input id="habit-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Período do dia</Label>
                    <Select value={period} onValueChange={(v) => setPeriod(v as DayPeriod)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PERIODS.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Área</Label>
                    <Select value={areaId} onValueChange={setAreaId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Nenhuma" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma</SelectItem>
                        {areas.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Dias previstos</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {WEEKDAYS.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => toggleWeekday(d.id)}
                        className={`rounded-full border px-2.5 py-1 text-xs ${
                          targetDays.includes(d.id) ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreate} disabled={saving || !name.trim()}>
                  {saving ? 'Criando...' : 'Criar'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : habits.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          Nenhum hábito ainda — crie hábitos e agrupe por período do dia.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {PERIODS.map((p) => {
            const items = habits.filter((h) => h.day_period === p.id)
            if (items.length === 0) return null
            return (
              <section key={p.id} className="flex flex-col gap-2">
                <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                  {p.label}
                </h2>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {items.map((habit) => {
                    const done = completedToday.has(habit.id)
                    return (
                      <div
                        key={habit.id}
                        className="flex items-center justify-between gap-3 rounded-lg border p-3"
                      >
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-medium">{habit.name}</span>
                          <span className="text-xs text-muted-foreground">
                            🔥 {habit.current_streak} dia{habit.current_streak !== 1 ? 's' : ''} seguido
                            {habit.current_streak !== 1 ? 's' : ''}
                          </span>
                          {habit.area && <AreaBadge area={habit.area} />}
                        </div>
                        <button
                          onClick={() => handleToggle(habit)}
                          aria-label={done ? 'Desmarcar hábito de hoje' : 'Marcar hábito de hoje'}
                          className={`flex size-9 shrink-0 items-center justify-center rounded-full border-2 text-sm transition ${
                            done
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-muted-foreground/30'
                          }`}
                        >
                          {done ? '✓' : ''}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
