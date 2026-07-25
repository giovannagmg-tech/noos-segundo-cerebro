import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
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
import { listAreas, type Area } from '@/lib/api/areas'
import { createGoal, listGoals, updateGoal, type GoalWithArea } from '@/lib/api/goals'
import { awardReward } from '@/lib/api/rewards'

export default function Goals() {
  const [goals, setGoals] = useState<GoalWithArea[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [areaId, setAreaId] = useState('none')
  const [targetValue, setTargetValue] = useState('')
  const [unit, setUnit] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)

  async function refresh() {
    setLoading(true)
    try {
      const [g, a] = await Promise.all([listGoals(), listAreas()])
      setGoals(g)
      setAreas(a)
    } catch (err) {
      console.error(err)
      toast.error('Falha ao carregar suas metas. Tentar novamente.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const grouped = useMemo(() => {
    const map = new Map<string, GoalWithArea[]>()
    for (const g of goals) {
      const key = g.category || 'Sem categoria'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(g)
    }
    return [...map.entries()]
  }, [goals])

  async function handleCreate() {
    if (!title.trim()) return
    setSaving(true)
    try {
      await createGoal({
        title: title.trim(),
        category: category.trim() || undefined,
        area_id: areaId === 'none' ? null : areaId,
        target_value: targetValue ? Number(targetValue) : null,
        unit: unit.trim() || undefined,
        due_date: dueDate || null,
      })
      setDialogOpen(false)
      setTitle('')
      setCategory('')
      setAreaId('none')
      setTargetValue('')
      setUnit('')
      setDueDate('')
      refresh()
    } catch {
      toast.error('Falha ao criar meta.')
    } finally {
      setSaving(false)
    }
  }

  async function handleProgressChange(goal: GoalWithArea, value: number) {
    setGoals((prev) => prev.map((g) => (g.id === goal.id ? { ...g, current_value: value } : g)))
    try {
      await updateGoal(goal.id, { current_value: value })
    } catch {
      toast.error('Falha ao atualizar progresso.')
      refresh()
    }
  }

  async function handleMarkAchieved(goal: GoalWithArea) {
    setGoals((prev) => prev.map((g) => (g.id === goal.id ? { ...g, status: 'achieved' } : g)))
    try {
      await updateGoal(goal.id, { status: 'achieved' })
      const result = await awardReward({
        trigger_type: 'goal_completed',
        source_id: goal.id,
        title: `Meta alcançada — ${goal.title}`,
        points: 20,
      })
      if (!result.already_awarded) {
        toast.success(`🎉 Meta alcançada! +${result.points_awarded} pontos`)
      }
    } catch {
      toast.error('Falha ao marcar meta como alcançada.')
      refresh()
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Metas de vida</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>+ Nova meta</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova meta</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="grid gap-2">
                <Label htmlFor="goal-title">Título</Label>
                <Input id="goal-title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="goal-category">Categoria</Label>
                  <Input
                    id="goal-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="ex: Saúde"
                  />
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
              <div className="grid grid-cols-3 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="goal-target">Valor alvo</Label>
                  <Input
                    id="goal-target"
                    type="number"
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="goal-unit">Unidade</Label>
                  <Input
                    id="goal-unit"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="ex: livros"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="goal-due">Prazo</Label>
                  <Input
                    id="goal-due"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={saving || !title.trim()}>
                {saving ? 'Criando...' : 'Criar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : goals.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          Nenhuma meta definida — crie metas de vida por categoria.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {grouped.map(([category, items]) => (
            <section key={category} className="flex flex-col gap-2">
              <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                {category}
              </h2>
              <ul className="flex flex-col gap-3">
                {items.map((goal) => {
                  const hasTarget = goal.target_value !== null && goal.target_value > 0
                  const pct = hasTarget
                    ? Math.min(100, Math.round((goal.current_value / goal.target_value!) * 100))
                    : 0
                  const achieved = goal.status === 'achieved'
                  return (
                    <li key={goal.id} className="flex flex-col gap-2 rounded-lg border p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{goal.title}</span>
                        {achieved && <span className="text-sm">Meta alcançada 🎉</span>}
                      </div>
                      {hasTarget ? (
                        <div className="flex items-center gap-2">
                          <Progress value={pct} className="h-1.5 flex-1" />
                          <span className="text-xs text-muted-foreground">
                            {goal.current_value}/{goal.target_value} {goal.unit ?? ''}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sem valor-alvo definido</span>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        {goal.area && <AreaBadge area={goal.area} />}
                        {goal.due_date && (
                          <span className="text-xs text-muted-foreground">
                            Prazo:{' '}
                            {new Date(goal.due_date).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: 'short',
                            })}
                          </span>
                        )}
                        {!achieved && hasTarget && (
                          <Input
                            type="number"
                            defaultValue={goal.current_value}
                            className="h-7 w-20 text-xs"
                            onBlur={(e) => handleProgressChange(goal, Number(e.target.value))}
                          />
                        )}
                        {!achieved && (
                          <Button size="sm" variant="outline" onClick={() => handleMarkAchieved(goal)}>
                            Marcar como alcançada
                          </Button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
