import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
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
import { createProject, listProjects, type ProjectWithProgress } from '@/lib/api/projects'

const STATUS_LABEL: Record<string, string> = {
  active: 'Ativo',
  completed: 'Concluído',
  archived: 'Arquivado',
}

export default function Projects() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<ProjectWithProgress[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [areaId, setAreaId] = useState<string>('none')
  const [saving, setSaving] = useState(false)

  async function refresh() {
    setLoading(true)
    try {
      const [p, a] = await Promise.all([listProjects(), listAreas()])
      setProjects(p)
      setAreas(a)
    } catch (err) {
      console.error(err)
      toast.error('Não foi possível carregar os projetos. Tentar novamente.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function handleCreate() {
    if (!name.trim()) return
    setSaving(true)
    try {
      const project = await createProject({
        name: name.trim(),
        description: description.trim(),
        area_id: areaId === 'none' ? null : areaId,
      })
      setDialogOpen(false)
      setName('')
      setDescription('')
      setAreaId('none')
      navigate(`/projects/${project.id}`)
    } catch {
      toast.error('Falha ao criar projeto.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Projetos</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>+ Novo projeto</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo projeto</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="grid gap-2">
                <Label htmlFor="project-name">Nome</Label>
                <Input id="project-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="project-description">Descrição</Label>
                <Textarea
                  id="project-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
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
            <DialogFooter>
              <Button onClick={handleCreate} disabled={saving || !name.trim()}>
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
      ) : projects.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          Nenhum projeto ainda — crie um projeto e conecte tarefas a ele.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {projects.map((p) => {
            const pct = p.taskCount > 0 ? Math.round((p.doneCount / p.taskCount) * 100) : 0
            return (
              <li key={p.id}>
                <button
                  onClick={() => navigate(`/projects/${p.id}`)}
                  className="flex w-full flex-col gap-2 rounded-lg border p-4 text-left hover:bg-muted/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{p.name}</span>
                    <Badge variant={p.status === 'active' ? 'default' : 'secondary'}>
                      {STATUS_LABEL[p.status] ?? p.status}
                    </Badge>
                  </div>
                  {p.description && (
                    <p className="line-clamp-1 text-sm text-muted-foreground">{p.description}</p>
                  )}
                  <div className="flex items-center gap-2">
                    <Progress value={pct} className="h-1.5 flex-1" />
                    <span className="text-xs text-muted-foreground">
                      {p.doneCount}/{p.taskCount}
                    </span>
                  </div>
                  {p.area && <AreaBadge area={p.area} />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
