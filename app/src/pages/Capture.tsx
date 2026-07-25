import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/hooks/use-auth'
import { useTheme } from '@/hooks/use-theme'
import { createNote } from '@/lib/api/notes'
import { Logo } from '@/components/Logo'

// Rota standalone, fora do AppShell de propósito — captura rápida é
// "mobile-first" de verdade só sem sidebar/header/nav por cima.
export default function Capture() {
  const { session, loading: authLoading } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedPulse, setSavedPulse] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  if (authLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
        Carregando…
      </div>
    )
  }
  if (!session) return <Navigate to="/login" replace />

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    if (!content.trim()) return
    if (!online) {
      toast.error('Sem conexão — tente novamente quando estiver online.')
      return
    }
    setSaving(true)
    try {
      await createNote({
        title: title.trim() || 'Captura sem título',
        content: content.trim(),
        source: 'mobile_capture',
        is_quick_capture: true,
      })
      setTitle('')
      setContent('')
      setSavedPulse(true)
      toast.success('Captura salva — organize depois na web.')
      setTimeout(() => setSavedPulse(false), 1500)
    } catch (err) {
      console.error(err)
      toast.error('Falha ao salvar, tentar novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <Link to="/notes">
          <Logo size={20} />
        </Link>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Alternar tema">
            {theme === 'dark' ? '☀️' : '🌙'}
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/notes">Notas</Link>
          </Button>
        </div>
      </header>

      {!online && (
        <div className="bg-amber-100 px-4 py-1.5 text-center text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Sem conexão — sua captura será enviada quando você voltar online.
        </div>
      )}

      <form onSubmit={handleSave} className="flex flex-1 flex-col gap-3 p-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título (opcional)"
          className="w-full border-none bg-transparent text-xl font-semibold outline-none placeholder:text-muted-foreground/60"
        />
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="O que você quer capturar?"
          autoFocus
          className="min-h-0 flex-1 resize-none border-none p-0 text-base shadow-none focus-visible:ring-0"
        />
        <Button
          type="submit"
          size="lg"
          className="h-14 w-full text-base"
          disabled={saving || !content.trim() || !online}
        >
          {saving ? 'Salvando...' : savedPulse ? 'Salvo ✓' : 'Salvar captura'}
        </Button>
      </form>
    </div>
  )
}
