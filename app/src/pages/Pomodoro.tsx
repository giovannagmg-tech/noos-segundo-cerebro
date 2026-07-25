import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { listNotes } from '@/lib/api/notes'
import {
  endSession,
  listRecentSessions,
  startSession,
  updateCycles,
  type PomodoroSessionWithNote,
} from '@/lib/api/pomodoro'
import type { Note } from '@/lib/api/types'

const FOCUS_SECONDS = 25 * 60
type Status = 'idle' | 'running' | 'paused'

function formatTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function Pomodoro() {
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedNoteId, setSelectedNoteId] = useState<string>('none')
  const [status, setStatus] = useState<Status>('idle')
  const [secondsLeft, setSecondsLeft] = useState(FOCUS_SECONDS)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [cycles, setCycles] = useState(0)
  const [history, setHistory] = useState<PomodoroSessionWithNote[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)

  useEffect(() => {
    listNotes()
      .then(setNotes)
      .catch(() => {})
    refreshHistory()
  }, [])

  async function refreshHistory() {
    setHistoryLoading(true)
    try {
      setHistory(await listRecentSessions())
    } catch {
      toast.error('Falha ao carregar o histórico.')
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    if (status !== 'running') return
    const interval = setInterval(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearInterval(interval)
  }, [status])

  useEffect(() => {
    if (status !== 'running' || secondsLeft > 0) return
    handleCycleComplete()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft])

  async function handleCycleComplete() {
    const nextCycles = cycles + 1
    setCycles(nextCycles)
    setStatus('paused')
    setSecondsLeft(FOCUS_SECONDS)
    toast.success('Ciclo de foco concluído! 🎉')
    if (sessionId) {
      try {
        await updateCycles(sessionId, nextCycles)
      } catch {
        toast.error('Não foi possível registrar a sessão.')
      }
    }
  }

  async function handleStart() {
    if (!sessionId) {
      try {
        const noteId = selectedNoteId === 'none' ? null : selectedNoteId
        const session = await startSession(noteId)
        setSessionId(session.id)
      } catch {
        toast.error('Não foi possível iniciar a sessão — o timer continua funcionando localmente.')
      }
    }
    setStatus('running')
  }

  function handlePause() {
    setStatus('paused')
  }

  async function handleStop() {
    if (sessionId) {
      try {
        await endSession(sessionId, cycles)
      } catch {
        toast.error('Falha ao encerrar a sessão.')
      }
    }
    setStatus('idle')
    setSecondsLeft(FOCUS_SECONDS)
    setSessionId(null)
    setCycles(0)
    refreshHistory()
  }

  const progress = 1 - secondsLeft / FOCUS_SECONDS

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 py-8">
      {status === 'idle' && (
        <Select value={selectedNoteId} onValueChange={setSelectedNoteId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Nenhuma nota" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Nenhuma nota</SelectItem>
            {notes.map((n) => (
              <SelectItem key={n.id} value={n.id}>
                {n.title || 'Sem título'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <div className="relative flex size-56 items-center justify-center">
        <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
          <circle cx="50" cy="50" r="46" fill="none" stroke="var(--border)" strokeWidth="4" />
          <circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke="var(--primary)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 46}
            strokeDashoffset={2 * Math.PI * 46 * (1 - progress)}
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>
        <span className="font-mono text-5xl tabular-nums">{formatTime(secondsLeft)}</span>
      </div>

      <p className="text-sm text-muted-foreground">
        {cycles > 0 ? `${cycles} ciclo${cycles > 1 ? 's' : ''} concluído${cycles > 1 ? 's' : ''}` : 'Bloco de foco de 25 minutos'}
      </p>

      <div className="flex gap-2">
        {status === 'running' ? (
          <Button variant="outline" onClick={handlePause}>
            Pausar
          </Button>
        ) : (
          <Button onClick={handleStart}>{status === 'paused' ? 'Retomar' : 'Iniciar'}</Button>
        )}
        {status !== 'idle' && (
          <Button variant="ghost" onClick={handleStop}>
            Encerrar
          </Button>
        )}
      </div>

      <section className="flex w-full flex-col gap-2 pt-6">
        <h2 className="text-sm font-medium text-muted-foreground">Histórico recente</h2>
        {historyLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : history.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Você ainda não fez nenhuma sessão de foco — inicie seu primeiro Pomodoro.
          </p>
        ) : (
          <ul className="flex flex-col divide-y rounded-lg border">
            {history.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <div className="flex flex-col">
                  <span>{s.note?.title ?? 'Sem nota vinculada'}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(s.started_at).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {s.cycles_completed} ciclo{s.cycles_completed !== 1 ? 's' : ''} · {s.focus_minutes}min
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
