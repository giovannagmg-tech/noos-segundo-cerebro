import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { createTag, deleteTag, listTags, updateTag, type TagWithCount } from '@/lib/api/tags'
import { TAG_COLORS, nextTagColor } from '@/lib/tag-colors'

const SUGGESTED = ['Marketing', 'Branding', 'Neurociência', 'Nutrição', 'IA', 'Liderança']

export default function Tags() {
  const [tags, setTags] = useState<TagWithCount[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<TagWithCount | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState<string>(TAG_COLORS[0].value)

  async function refresh() {
    setLoading(true)
    try {
      setTags(await listTags())
    } catch (err) {
      toast.error('Não foi possível carregar suas tags.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  function openCreate() {
    setEditing(null)
    setName('')
    setColor(nextTagColor(tags.length))
    setDialogOpen(true)
  }

  function openEdit(tag: TagWithCount) {
    setEditing(tag)
    setName(tag.name)
    setColor(tag.color ?? TAG_COLORS[0].value)
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!name.trim()) return
    try {
      if (editing) {
        await updateTag(editing.id, { name: name.trim(), color })
      } else {
        await createTag(name.trim(), color)
      }
      setDialogOpen(false)
      await refresh()
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === '23505'
          ? 'Já existe uma tag com esse nome.'
          : 'Falha ao salvar tag. Tentar novamente.'
      toast.error(message)
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteTag(id)
      await refresh()
    } catch {
      toast.error('Falha ao excluir tag.')
    }
  }

  async function handleQuickAdd(label: string) {
    try {
      await createTag(label, nextTagColor(tags.length))
      await refresh()
    } catch {
      toast.error('Falha ao criar tag.')
    }
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Tags de área</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>+ Nova tag</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? 'Editar tag' : 'Nova tag'}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="grid gap-2">
                <Label htmlFor="tag-name">Nome</Label>
                <Input
                  id="tag-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ex: Neurociência"
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
                      className="size-7 rounded-full ring-offset-2 ring-offset-background transition"
                      style={{
                        backgroundColor: c.value,
                        boxShadow: color === c.value ? `0 0 0 2px ${c.value}` : undefined,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleSave}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : tags.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhuma tag criada ainda — crie tags de área para organizar suas notas.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {SUGGESTED.map((label) => (
              <Button key={label} variant="outline" size="sm" onClick={() => handleQuickAdd(label)}>
                + {label}
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border">
          {tags.map((tag) => (
            <li key={tag.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <button
                className="flex flex-1 items-center gap-2 text-left"
                onClick={() => openEdit(tag)}
              >
                <span className="size-2.5 rounded-full" style={{ backgroundColor: tag.color ?? '#999' }} />
                <span className="font-medium">{tag.name}</span>
                <span className="text-xs text-muted-foreground">
                  {tag.note_count} {tag.note_count === 1 ? 'nota' : 'notas'}
                </span>
              </button>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(tag.id)}>
                Excluir
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
