import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AreaBadge } from '@/components/AreaBadge'
import { AreaManagerDialog } from '@/components/AreaManagerDialog'
import { TaskFormDialog } from '@/components/TaskFormDialog'
import { listAreas, type Area } from '@/lib/api/areas'
import { listProjects, type ProjectWithProgress } from '@/lib/api/projects'
import {
  listTasks,
  reorderTasks,
  updateTask,
  type TaskStatus,
  type TaskWithRelations,
} from '@/lib/api/tasks'

type ViewMode = 'lista' | 'kanban' | 'calendario'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function isOverdue(iso: string) {
  const due = new Date(iso)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return due < today
}

export default function Tasks() {
  const [view, setView] = useState<ViewMode>('lista')
  const [areas, setAreas] = useState<Area[]>([])
  const [projects, setProjects] = useState<ProjectWithProgress[]>([])
  const [tasks, setTasks] = useState<TaskWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [areaFilter, setAreaFilter] = useState('all')
  const [projectFilter, setProjectFilter] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<TaskWithRelations | null>(null)

  const loadTasks = useCallback(async () => {
    try {
      const data = await listTasks({
        areaId: areaFilter === 'all' ? undefined : areaFilter,
        projectId: projectFilter === 'all' ? undefined : projectFilter,
      })
      setTasks(data)
    } catch (err) {
      console.error(err)
      toast.error('Não foi possível carregar suas tarefas. Tentar novamente.')
    }
  }, [areaFilter, projectFilter])

  useEffect(() => {
    setLoading(true)
    Promise.all([listAreas(), listProjects(), loadTasks()])
      .then(([a, p]) => {
        setAreas(a)
        setProjects(p)
      })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areaFilter, projectFilter])

  function openNewTask() {
    setEditingTask(null)
    setFormOpen(true)
  }

  function openEditTask(task: TaskWithRelations) {
    setEditingTask(task)
    setFormOpen(true)
  }

  async function toggleDone(task: TaskWithRelations) {
    const nextStatus: TaskStatus = task.status === 'done' ? 'todo' : 'done'
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t)))
    try {
      await updateTask(task.id, { status: nextStatus })
    } catch {
      toast.error('Falha ao atualizar tarefa.')
      loadTasks()
    }
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">O que fazer</h1>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border p-0.5">
            {(['lista', 'kanban', 'calendario'] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`rounded px-3 py-1 text-sm capitalize ${
                  view === v ? 'bg-muted font-medium' : 'text-muted-foreground'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <Button onClick={openNewTask}>+ Nova tarefa</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={areaFilter} onValueChange={setAreaFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Todas as áreas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as áreas</SelectItem>
            {areas.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Todos os projetos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os projetos</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <AreaManagerDialog onChanged={() => listAreas().then(setAreas)} />
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : tasks.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          Nenhuma tarefa ainda — crie sua primeira tarefa e organize por área.
        </p>
      ) : view === 'lista' ? (
        <ListView tasks={tasks} onToggleDone={toggleDone} onOpen={openEditTask} />
      ) : view === 'kanban' ? (
        <KanbanView tasks={tasks} onReload={loadTasks} onOpen={openEditTask} />
      ) : (
        <CalendarView tasks={tasks} onOpen={openEditTask} />
      )}

      <TaskFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        task={editingTask}
        areas={areas}
        projects={projects}
        defaultAreaId={areaFilter === 'all' ? null : areaFilter}
        defaultProjectId={projectFilter === 'all' ? null : projectFilter}
        onSaved={loadTasks}
      />
    </div>
  )
}

function TaskMeta({ task }: { task: TaskWithRelations }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {task.due_date && (
        <span
          className={`text-xs ${
            task.status !== 'done' && isOverdue(task.due_date)
              ? 'font-medium text-destructive'
              : 'text-muted-foreground'
          }`}
        >
          {formatDate(task.due_date)}
        </span>
      )}
      {task.area && <AreaBadge area={task.area} />}
      {task.project && (
        <span className="text-xs text-muted-foreground">📁 {task.project.name}</span>
      )}
    </div>
  )
}

function ListView({
  tasks,
  onToggleDone,
  onOpen,
}: {
  tasks: TaskWithRelations[]
  onToggleDone: (t: TaskWithRelations) => void
  onOpen: (t: TaskWithRelations) => void
}) {
  const sorted = useMemo(
    () =>
      [...tasks].sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0
        if (!a.due_date) return 1
        if (!b.due_date) return -1
        return a.due_date < b.due_date ? -1 : 1
      }),
    [tasks],
  )

  return (
    <ul className="flex flex-col divide-y rounded-lg border">
      {sorted.map((task) => (
        <li key={task.id} className="flex items-center gap-3 px-4 py-3">
          <Checkbox checked={task.status === 'done'} onCheckedChange={() => onToggleDone(task)} />
          <button
            onClick={() => onOpen(task)}
            className="flex flex-1 flex-col items-start gap-1 text-left"
          >
            <span
              className={
                task.status === 'done' ? 'text-sm text-muted-foreground line-through' : 'text-sm'
              }
            >
              {task.title}
            </span>
            <TaskMeta task={task} />
          </button>
        </li>
      ))}
    </ul>
  )
}

const COLUMN_DEFS: { id: TaskStatus; label: string }[] = [
  { id: 'todo', label: 'A Fazer' },
  { id: 'doing', label: 'Fazendo' },
  { id: 'done', label: 'Feito' },
]

function KanbanView({
  tasks,
  onReload,
  onOpen,
}: {
  tasks: TaskWithRelations[]
  onReload: () => void
  onOpen: (t: TaskWithRelations) => void
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const columns = useMemo(() => {
    const grouped: Record<TaskStatus, TaskWithRelations[]> = { todo: [], doing: [], done: [] }
    for (const t of tasks) grouped[t.status]?.push(t)
    for (const status of Object.keys(grouped) as TaskStatus[]) {
      grouped[status].sort((a, b) => (a.kanban_order ?? 0) - (b.kanban_order ?? 0))
    }
    return grouped
  }, [tasks])

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return
    const activeTask = tasks.find((t) => t.id === active.id)
    if (!activeTask) return

    const overId = String(over.id)
    const isColumnId = COLUMN_DEFS.some((c) => c.id === overId)
    const destStatus: TaskStatus = isColumnId
      ? (overId as TaskStatus)
      : (tasks.find((t) => t.id === overId)?.status ?? activeTask.status)

    const destColumn = columns[destStatus].filter((t) => t.id !== activeTask.id)
    let insertIndex = destColumn.length
    if (!isColumnId) {
      const idx = destColumn.findIndex((t) => t.id === overId)
      if (idx !== -1) insertIndex = idx
    }
    destColumn.splice(insertIndex, 0, activeTask)

    if (destStatus !== activeTask.status) {
      try {
        await updateTask(activeTask.id, { status: destStatus })
      } catch {
        toast.error('Falha ao mover tarefa.')
      }
    }
    try {
      await reorderTasks(destColumn.map((t) => t.id))
    } catch {
      // ordem é só um detalhe visual — falha aqui não é crítica
    }
    onReload()
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {COLUMN_DEFS.map((col) => (
          <KanbanColumn key={col.id} id={col.id} title={col.label} tasks={columns[col.id]} onOpen={onOpen} />
        ))}
      </div>
    </DndContext>
  )
}

function KanbanColumn({
  id,
  title,
  tasks,
  onOpen,
}: {
  id: TaskStatus
  title: string
  tasks: TaskWithRelations[]
  onOpen: (t: TaskWithRelations) => void
}) {
  const { setNodeRef } = useDroppable({ id })
  return (
    <div ref={setNodeRef} className="flex flex-col gap-2 rounded-lg bg-muted/40 p-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-medium">{title}</h3>
        <span className="text-xs text-muted-foreground">{tasks.length}</span>
      </div>
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex min-h-10 flex-col gap-2">
          {tasks.map((task) => (
            <SortableTaskCard key={task.id} task={task} onClick={() => onOpen(task)} />
          ))}
        </div>
      </SortableContext>
    </div>
  )
}

function SortableTaskCard({ task, onClick }: { task: TaskWithRelations; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="flex cursor-grab flex-col gap-1.5 rounded-md border bg-background p-2.5 active:cursor-grabbing"
    >
      <span className="text-sm">{task.title}</span>
      <TaskMeta task={task} />
    </div>
  )
}

function isSameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString()
}

function CalendarView({
  tasks,
  onOpen,
}: {
  tasks: TaskWithRelations[]
  onOpen: (t: TaskWithRelations) => void
}) {
  const days = useMemo(() => {
    const today = new Date()
    const dow = (today.getDay() + 6) % 7 // 0 = segunda
    const monday = new Date(today)
    monday.setDate(today.getDate() - dow)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      return d
    })
  }, [])

  const noDue = tasks.filter((t) => !t.due_date)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-7">
        {days.map((day) => {
          const dayTasks = tasks.filter((t) => t.due_date && isSameDay(new Date(t.due_date), day))
          const today = isSameDay(day, new Date())
          return (
            <div
              key={day.toISOString()}
              className={`flex flex-col gap-2 rounded-lg border p-2 ${today ? 'border-primary' : ''}`}
            >
              <div className="text-xs font-medium capitalize text-muted-foreground">
                {day.toLocaleDateString('pt-BR', { weekday: 'short' })} {day.getDate()}
              </div>
              <div className="flex flex-col gap-1.5">
                {dayTasks.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => onOpen(t)}
                    className="rounded border bg-background p-1.5 text-left text-xs hover:bg-muted/50"
                  >
                    {t.title}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      {noDue.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">Sem prazo</h3>
          <div className="flex flex-wrap gap-2">
            {noDue.map((t) => (
              <button
                key={t.id}
                onClick={() => onOpen(t)}
                className="rounded border bg-background px-2.5 py-1.5 text-left text-xs hover:bg-muted/50"
              >
                {t.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
