import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AreaBadge } from '@/components/AreaBadge'
import { TaskFormDialog } from '@/components/TaskFormDialog'
import { listAreas, type Area } from '@/lib/api/areas'
import { listProjects, type ProjectWithProgress } from '@/lib/api/projects'
import { listTasks, updateTask, type EisenhowerQuadrant, type TaskWithRelations } from '@/lib/api/tasks'

// Cores validadas com o skill dataviz (validate_palette.js — CVD/contraste
// OK nas duas superfícies) em vez de classes Tailwind escolhidas de olho.
export const QUADRANTS: { id: EisenhowerQuadrant; roman: string; label: string; color: string }[] = [
  { id: 'urgent_important', roman: 'I', label: 'Urgente e importante', color: 'var(--eq-q1)' },
  { id: 'not_urgent_important', roman: 'II', label: 'Não urgente e importante', color: 'var(--eq-q2)' },
  { id: 'urgent_not_important', roman: 'III', label: 'Urgente e não importante', color: 'var(--eq-q3)' },
  {
    id: 'not_urgent_not_important',
    roman: 'IV',
    label: 'Não urgente e não importante',
    color: 'var(--eq-q4)',
  },
]

const UNCLASSIFIED = 'unclassified'

export default function TasksEisenhower() {
  const [areas, setAreas] = useState<Area[]>([])
  const [projects, setProjects] = useState<ProjectWithProgress[]>([])
  const [tasks, setTasks] = useState<TaskWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [areaFilter, setAreaFilter] = useState('all')
  const [projectFilter, setProjectFilter] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<TaskWithRelations | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const loadTasks = useCallback(async () => {
    try {
      const data = await listTasks({
        areaId: areaFilter === 'all' ? undefined : areaFilter,
        projectId: projectFilter === 'all' ? undefined : projectFilter,
      })
      setTasks(data)
    } catch (err) {
      console.error(err)
      toast.error('Falha ao carregar a matriz. Tentar novamente.')
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

  const unclassified = useMemo(() => tasks.filter((t) => !t.eisenhower_quadrant), [tasks])

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return
    const task = tasks.find((t) => t.id === active.id)
    if (!task) return
    const destId = String(over.id)
    const quadrant = destId === UNCLASSIFIED ? null : (destId as EisenhowerQuadrant)
    if (quadrant === task.eisenhower_quadrant) return

    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, eisenhower_quadrant: quadrant } : t)))
    try {
      await updateTask(task.id, { eisenhower_quadrant: quadrant })
    } catch {
      toast.error('Falha ao classificar tarefa.')
      loadTasks()
    }
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Matriz de Eisenhower</h1>
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
      </div>

      {loading ? (
        <Skeleton className="h-96 w-full" />
      ) : tasks.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          Nenhuma tarefa ainda — crie tarefas em /tasks pra priorizar aqui.
        </p>
      ) : (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          {unclassified.length > 0 && (
            <UnclassifiedZone
              tasks={unclassified}
              onOpen={(t) => {
                setEditingTask(t)
                setFormOpen(true)
              }}
            />
          )}
          <p className="text-xs text-muted-foreground">
            Arraste tarefas para priorizar por urgência e importância.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {QUADRANTS.map((q) => (
              <QuadrantZone
                key={q.id}
                quadrant={q}
                tasks={tasks.filter((t) => t.eisenhower_quadrant === q.id)}
                onOpen={(t) => {
                  setEditingTask(t)
                  setFormOpen(true)
                }}
              />
            ))}
          </div>
        </DndContext>
      )}

      <TaskFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        task={editingTask}
        areas={areas}
        projects={projects}
        onSaved={loadTasks}
      />
    </div>
  )
}

function UnclassifiedZone({
  tasks,
  onOpen,
}: {
  tasks: TaskWithRelations[]
  onOpen: (t: TaskWithRelations) => void
}) {
  const { setNodeRef } = useDroppable({ id: UNCLASSIFIED })
  return (
    <div ref={setNodeRef} className="flex flex-col gap-2 rounded-lg border border-dashed p-3">
      <h3 className="text-sm font-medium text-muted-foreground">
        Não classificadas ({tasks.length})
      </h3>
      <div className="flex flex-wrap gap-2">
        {tasks.map((t) => (
          <DraggableTaskChip key={t.id} task={t} onClick={() => onOpen(t)} />
        ))}
      </div>
    </div>
  )
}

function QuadrantZone({
  quadrant,
  tasks,
  onOpen,
}: {
  quadrant: (typeof QUADRANTS)[number]
  tasks: TaskWithRelations[]
  onOpen: (t: TaskWithRelations) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: quadrant.id })
  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-40 flex-col gap-2 rounded-lg border p-3 ${isOver ? 'bg-muted/50' : ''}`}
    >
      <div className="flex items-center gap-2">
        <span
          className="flex size-5 items-center justify-center rounded-full text-xs font-bold"
          style={{ color: quadrant.color }}
        >
          {quadrant.roman}
        </span>
        <h3 className="text-sm font-medium" style={{ color: quadrant.color }}>
          {quadrant.label}
        </h3>
        <span className="ml-auto text-xs text-muted-foreground">{tasks.length}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {tasks.map((t) => (
          <DraggableTaskCard key={t.id} task={t} onClick={() => onOpen(t)} />
        ))}
      </div>
    </div>
  )
}

function DraggableTaskCard({ task, onClick }: { task: TaskWithRelations; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id })
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, opacity: isDragging ? 0.5 : 1 }
    : undefined
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="flex cursor-grab flex-col gap-1 rounded-md border bg-background p-2 text-sm active:cursor-grabbing"
    >
      {task.title}
      {task.area && (
        <div>
          <AreaBadge area={task.area} />
        </div>
      )}
    </div>
  )
}

function DraggableTaskChip({ task, onClick }: { task: TaskWithRelations; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id })
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, opacity: isDragging ? 0.5 : 1 }
    : undefined
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="cursor-grab rounded-full border bg-background px-3 py-1 text-xs active:cursor-grabbing"
    >
      {task.title}
    </div>
  )
}
