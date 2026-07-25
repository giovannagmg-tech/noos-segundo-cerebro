import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Area } from '@/lib/api/areas'
import type { Project } from '@/lib/api/projects'
import { createTask, updateTask, type EisenhowerQuadrant, type TaskWithRelations } from '@/lib/api/tasks'

const QUADRANT_LABELS: Record<EisenhowerQuadrant, string> = {
  urgent_important: 'I — Urgente e importante',
  not_urgent_important: 'II — Não urgente e importante',
  urgent_not_important: 'III — Urgente e não importante',
  not_urgent_not_important: 'IV — Não urgente e não importante',
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  task?: TaskWithRelations | null
  areas: Area[]
  projects: Project[]
  defaultAreaId?: string | null
  defaultProjectId?: string | null
  onSaved: () => void
}

export function TaskFormDialog({
  open,
  onOpenChange,
  task,
  areas,
  projects,
  defaultAreaId,
  defaultProjectId,
  onSaved,
}: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [areaId, setAreaId] = useState<string>('none')
  const [projectId, setProjectId] = useState<string>('none')
  const [dueDate, setDueDate] = useState('')
  const [quadrant, setQuadrant] = useState<string>('none')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setTitle(task?.title ?? '')
    setDescription(task?.description ?? '')
    setAreaId(task?.area_id ?? defaultAreaId ?? 'none')
    setProjectId(task?.project_id ?? defaultProjectId ?? 'none')
    setDueDate(task?.due_date ? task.due_date.slice(0, 10) : '')
    setQuadrant(task?.eisenhower_quadrant ?? 'none')
  }, [open, task, defaultAreaId, defaultProjectId])

  async function handleSave() {
    if (!title.trim()) return
    setSaving(true)
    const payload = {
      title: title.trim(),
      description: description.trim() || undefined,
      area_id: areaId === 'none' ? null : areaId,
      project_id: projectId === 'none' ? null : projectId,
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
      eisenhower_quadrant: quadrant === 'none' ? null : (quadrant as EisenhowerQuadrant),
    }
    try {
      if (task) {
        await updateTask(task.id, payload)
      } else {
        await createTask(payload)
      }
      onOpenChange(false)
      onSaved()
    } catch {
      toast.error('Falha ao salvar tarefa.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{task ? 'Editar tarefa' : 'Nova tarefa'}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="task-title">Título</Label>
            <Input id="task-title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="task-description">Descrição</Label>
            <Textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
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
            <div className="grid gap-2">
              <Label>Projeto</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="task-due">Prazo</Label>
              <Input
                id="task-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Quadrante Eisenhower</Label>
              <Select value={quadrant} onValueChange={setQuadrant}>
                <SelectTrigger>
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {Object.entries(QUADRANT_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={saving || !title.trim()}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { QUADRANT_LABELS }
