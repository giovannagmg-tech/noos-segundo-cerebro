import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  createLocalEvent,
  getConnectionStatus,
  listEventsInRange,
  syncGoogleCalendar,
  updateLocalEvent,
  type CalendarEvent,
} from '@/lib/api/calendar'

const SYNC_LABEL: Record<string, string> = {
  synced: 'Sincronizado',
  pending_push: 'Pendente',
  local_only: 'Só local',
}

function isSameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString()
}

function toLocalInput(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function CalendarPage() {
  const [connected, setConnected] = useState<boolean | null>(null)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<CalendarEvent | null>(null)
  const [title, setTitle] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')

  const days = useMemo(() => {
    const today = new Date()
    const dow = (today.getDay() + 6) % 7
    const monday = new Date(today)
    monday.setDate(today.getDate() - dow)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      return d
    })
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const status = await getConnectionStatus()
      setConnected(status.connected)
      const start = days[0]
      const end = new Date(days[6])
      end.setHours(23, 59, 59)
      const data = await listEventsInRange(start.toISOString(), end.toISOString())
      setEvents(data)
    } catch (err) {
      console.error(err)
      toast.error('Não foi possível carregar sua agenda. Tentar novamente.')
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => {
    load()
  }, [load])

  async function handleSync() {
    setSyncing(true)
    try {
      const result = await syncGoogleCalendar('both')
      toast.success(`Sincronizado — ${result.pulled} recebido(s), ${result.pushed} enviado(s)`)
      load()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Falha na sincronização — tentaremos novamente.'
      toast.error(message)
    } finally {
      setSyncing(false)
    }
  }

  function openCreate(day?: Date) {
    setEditing(null)
    setTitle('')
    const base = day ?? new Date()
    base.setHours(9, 0, 0, 0)
    setStartsAt(toLocalInput(base.toISOString()))
    setEndsAt('')
    setDialogOpen(true)
  }

  function openEdit(ev: CalendarEvent) {
    setEditing(ev)
    setTitle(ev.title)
    setStartsAt(toLocalInput(ev.starts_at))
    setEndsAt(ev.ends_at ? toLocalInput(ev.ends_at) : '')
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!title.trim() || !startsAt) return
    try {
      const startIso = new Date(startsAt).toISOString()
      const endIso = endsAt ? new Date(endsAt).toISOString() : null
      if (editing) {
        await updateLocalEvent(editing.id, { title: title.trim(), starts_at: startIso, ends_at: endIso })
      } else {
        await createLocalEvent({ title: title.trim(), starts_at: startIso, ends_at: endIso })
      }
      setDialogOpen(false)
      load()
    } catch {
      toast.error('Falha ao salvar evento.')
    }
  }

  if (loading) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!connected) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-24 text-center">
        <h1 className="text-lg font-semibold">Calendário</h1>
        <p className="text-sm text-muted-foreground">
          Conecte sua conta do Google Calendar para ver e editar eventos aqui.
        </p>
        <Button asChild>
          <Link to="/settings">Conectar Google Calendar</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Calendário</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSync} disabled={syncing}>
            {syncing ? 'Sincronizando...' : 'Sincronizar agora'}
          </Button>
          <Button onClick={() => openCreate()}>+ Novo evento</Button>
        </div>
      </div>

      {events.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">Nenhum evento neste período.</p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-7">
          {days.map((day) => {
            const dayEvents = events.filter((e) => isSameDay(new Date(e.starts_at), day))
            const today = isSameDay(day, new Date())
            return (
              <div
                key={day.toISOString()}
                className={`flex flex-col gap-2 rounded-lg border p-2 ${today ? 'border-primary' : ''}`}
              >
                <button
                  onClick={() => openCreate(new Date(day))}
                  className="text-left text-xs font-medium capitalize text-muted-foreground hover:text-foreground"
                >
                  {day.toLocaleDateString('pt-BR', { weekday: 'short' })} {day.getDate()}
                </button>
                <div className="flex flex-col gap-1.5">
                  {dayEvents.map((ev) => (
                    <button
                      key={ev.id}
                      onClick={() => openEdit(ev)}
                      className="flex flex-col gap-1 rounded border bg-background p-1.5 text-left text-xs hover:bg-muted/50"
                    >
                      <span>{ev.title}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(ev.starts_at).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {ev.sync_status !== 'synced' && (
                        <Badge variant="outline" className="w-fit text-[9px]">
                          {SYNC_LABEL[ev.sync_status]}
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar evento' : 'Novo evento'}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="grid gap-2">
              <Label htmlFor="event-title">Título</Label>
              <Input id="event-title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="event-start">Início</Label>
                <Input
                  id="event-start"
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="event-end">Fim</Label>
                <Input
                  id="event-end"
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave} disabled={!title.trim() || !startsAt}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
