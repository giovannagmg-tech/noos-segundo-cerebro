import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { createNote } from '@/lib/api/notes'

export default function Capture() {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    if (!content.trim()) return
    setSaving(true)
    try {
      await createNote({
        title: title.trim() || 'Captura sem título',
        content: content.trim(),
        source: 'mobile_capture',
        is_quick_capture: true,
      })
      toast.success('Captura salva — organize depois na web.')
      setTitle('')
      setContent('')
    } catch (err) {
      console.error(err)
      toast.error('Falha ao salvar, tentar novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4 py-6">
      <h1 className="text-lg font-semibold">O que você quer capturar?</h1>
      <form onSubmit={handleSave} className="flex flex-col gap-4">
        <div className="grid gap-2">
          <Label htmlFor="capture-title">Título (opcional)</Label>
          <Input
            id="capture-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="capture-content">Conteúdo</Label>
          <Textarea
            id="capture-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={10}
            required
          />
        </div>
        <Button type="submit" size="lg" disabled={saving || !content.trim()}>
          {saving ? 'Salvando...' : 'Salvar captura'}
        </Button>
      </form>
      <Link to="/notes" className="text-center text-sm text-muted-foreground underline-offset-2 hover:underline">
        Organizar notas na web →
      </Link>
    </div>
  )
}
