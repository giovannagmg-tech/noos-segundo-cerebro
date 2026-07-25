import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/lib/supabase'
import {
  connectGoogleCalendar,
  disconnectGoogleCalendar,
  getConnectionStatus,
} from '@/lib/api/calendar'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar'

function redirectUri() {
  return `${window.location.origin}/settings`
}

export default function Settings() {
  const { session } = useAuth()
  const [connected, setConnected] = useState<boolean | null>(null)
  const [connecting, setConnecting] = useState(false)

  async function refreshStatus() {
    try {
      const status = await getConnectionStatus()
      setConnected(status.connected)
    } catch (err) {
      console.error(err)
      toast.error('Falha ao carregar status da conexão.')
    }
  }

  useEffect(() => {
    refreshStatus()
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    if (!code) return
    window.history.replaceState({}, '', '/settings')
    setConnecting(true)
    connectGoogleCalendar(code, redirectUri())
      .then(() => {
        toast.success('Google Calendar conectado!')
        refreshStatus()
      })
      .catch((err) => {
        console.error(err)
        toast.error(err?.message || 'Falha ao conectar o Google Calendar.')
      })
      .finally(() => setConnecting(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleConnect() {
    if (!GOOGLE_CLIENT_ID) {
      toast.error('VITE_GOOGLE_CLIENT_ID não configurado no .env do app.')
      return
    }
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    url.searchParams.set('client_id', GOOGLE_CLIENT_ID)
    url.searchParams.set('redirect_uri', redirectUri())
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', CALENDAR_SCOPE)
    url.searchParams.set('access_type', 'offline')
    url.searchParams.set('prompt', 'consent')
    window.location.href = url.toString()
  }

  async function handleDisconnect() {
    try {
      await disconnectGoogleCalendar()
      setConnected(false)
      toast.success('Google Calendar desconectado.')
    } catch {
      toast.error('Falha ao desconectar.')
    }
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-8">
      <h1 className="text-xl font-semibold">Configurações</h1>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">Perfil</h2>
        <div className="rounded-lg border p-4 text-sm">{session?.user.email}</div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">Google Calendar</h2>
        <div className="flex items-center justify-between rounded-lg border p-4">
          {connected === null || connecting ? (
            <Skeleton className="h-5 w-40" />
          ) : connected ? (
            <>
              <span className="text-sm">✅ Conectado</span>
              <Button variant="outline" size="sm" onClick={handleDisconnect}>
                Desconectar
              </Button>
            </>
          ) : (
            <>
              <span className="text-sm text-muted-foreground">Não conectado</span>
              <Button size="sm" onClick={handleConnect}>
                Conectar
              </Button>
            </>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Conectar libera a visualização/edição de eventos em /calendar e a agenda do dia em /agenda.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">Conta</h2>
        <Button variant="outline" onClick={() => supabase.auth.signOut()} className="w-fit">
          Sair
        </Button>
      </section>
    </div>
  )
}
