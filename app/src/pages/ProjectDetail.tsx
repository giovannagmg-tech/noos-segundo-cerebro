import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
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
import { getProject, updateProject, type ProjectWithProgress } from '@/lib/api/projects'
import { listTasks, updateTask, type TaskWithRelations } from '@/lib/api/tasks'

const STATUS_LABEL: Record<string, string> = {
  active: 'Ativo',
  completed: 'Concluído',
  archived: 'Arquivado',
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const [project, setProject] = useState<ProjectWithProgress | null>(null)
  const [tasks, setTasks] = useState<TaskWithRelations[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<TaskWithRelations | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [p, t, a] = await Promise.all([getProject(id), listTasks({ projectId: id }), listAreas()])
      if (!p) {
        setNotFound(true)
        return
      }
      setProject(p)
      setTasks(t)
      setAreas(a)
    } catch (err) {
      console.error(err)
      toast.error('Não foi possível carregar os projetos. Tentar novamente.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  async function handleStatusChange(status: string) {
    if (!id) return
    try {
      await updateProject(id, { status })
      setProject((p) => (p ? { ...p, status } : p))
    } catch {
      toast.error('Falha ao atualizar status.')
    }
  }

  async function toggleTaskDone(task: TaskWithRelations) {
    const nextStatus = task.status === 'done' ? 'todo' : 'done'
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t)))
    try {
      await updateTask(task.id, { status: nextStatus })
      setProject((p) =>
        p
          ? { ...p, doneCount: p.doneCount + (nextStatus === 'done' ? 1 : -1) }
          : p,
      )
    } catch {
      toast.error('Falha ao atualizar tarefa.')
      load()
    }
  }

  if (loading) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (notFound || !project) {
    return (
      <div className="mx-auto max-w-md py-24 text-center text-sm text-muted-foreground">
        Projeto não encontrado.
      </div>
    )
  }

  const pct = project.taskCount > 0 ? Math.round((project.doneCount / project.taskCount) * 100) : 0

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold">{project.name}</h1>
          <Select value={project.status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_LABEL).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {project.description && <p className="text-sm text-muted-foreground">{project.description}</p>}
        {project.area && <AreaBadge area={project.area} />}
        <div className="flex items-center gap-2">
          <Progress value={pct} className="h-2 flex-1" />
          <span className="text-xs text-muted-foreground">
            {project.doneCount}/{project.taskCount} tarefas
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">Tarefas</h2>
          <Button
            size="sm"
            onClick={() => {
              setEditingTask(null)
              setFormOpen(true)
            }}
          >
            + Nova tarefa
          </Button>
        </div>
        {tasks.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Este projeto ainda não tem tarefas — adicione a primeira.
          </p>
        ) : (
          <ul className="flex flex-col divide-y rounded-lg border">
            {tasks.map((task) => (
              <li key={task.id} className="flex items-center gap-3 px-4 py-3">
                <Checkbox checked={task.status === 'done'} onCheckedChange={() => toggleTaskDone(task)} />
                <button
                  onClick={() => {
                    setEditingTask(task)
                    setFormOpen(true)
                  }}
                  className={`flex-1 text-left text-sm ${
                    task.status === 'done' ? 'text-muted-foreground line-through' : ''
                  }`}
                >
                  {task.title}
                </button>
                {task.due_date && (
                  <span className="text-xs text-muted-foreground">
                    {new Date(task.due_date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <TaskFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        task={editingTask}
        areas={areas}
        projects={project ? [project] : []}
        defaultProjectId={id}
        onSaved={load}
      />
    </div>
  )
}
