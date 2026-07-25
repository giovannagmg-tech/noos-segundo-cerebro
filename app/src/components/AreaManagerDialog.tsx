import { useCallback, useEffect, useState } from 'react'
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
import { createArea, deleteArea, listAreas, updateArea, type Area } from '@/lib/api/areas'
import { TAG_COLORS, nextTagColor } from '@/lib/tag-colors'

export function AreaManagerDialog({ onChanged }: { onChanged?: () => void }) {
  const [open, setOpen] = useState(false)
  const [areas, setAreas] = useState<Area[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Area | 'new' | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState<string>(TAG_COLORS[0].value)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setAreas(await listAreas())
    } catch {
      toast.error('Falha ao carregar áreas.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) refresh()
  }, [open, refresh])

  function startCreate() {
    setEditing('new')
    setName('')
    setColor(nextTagColor(areas.length))
  }

  function startEdit(a: Area) {
    setEditing(a)
    setName(a.name)
    setColor(a.color ?? TAG_COLORS[0].value)
  }

  async function handleSave() {
    if (!name.trim()) return
    try {
      if (editing === 'new') {
        await createArea(name.trim(), color)
      } else if (editing) {
        await updateArea(editing.id, { name: name.trim(), color })
      }
      setEditing(null)
      await refresh()
      onChanged?.()
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === '23505'
          ? 'Já existe uma área com esse nome.'
          : 'Falha ao salvar área.'
      toast.error(message)
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteArea(id)
      await refresh()
      onChanged?.()
    } catch {
      toast.error('Falha ao excluir área.')
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setEditing(null)
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Gerenciar áreas
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Áreas da vida</DialogTitle>
        </DialogHeader>
        {editing ? (
          <div className="flex flex-col gap-4">
            <div className="grid gap-2">
              <Label htmlFor="area-name">Nome</Label>
              <Input
                id="area-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ex: Saúde"
              />
            </div>
            <div className="grid gap-2">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2">
                {TAG_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    aria-label={c.name}
                    onClick={() => setColor(c.value)}
                    className="size-7 rounded-full"
                    style={{
                      backgroundColor: c.value,
                      boxShadow: color === c.value ? `0 0 0 2px ${c.value}` : undefined,
                    }}
                  />
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
              <Button onClick={handleSave}>Salvar</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {loading ? (
              <Skeleton className="h-24 w-full" />
            ) : areas.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma área ainda — crie a primeira (ex: Carreira, Saúde, Estudos).
              </p>
            ) : (
              <ul className="flex flex-col divide-y rounded-lg border">
                {areas.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <button
                      className="flex flex-1 items-center gap-2 text-left"
                      onClick={() => startEdit(a)}
                    >
                      <span
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: a.color ?? '#999' }}
                      />
                      <span className="text-sm">{a.name}</span>
                    </button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(a.id)}>
                      Excluir
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <Button variant="outline" onClick={startCreate}>
              + Nova área
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
