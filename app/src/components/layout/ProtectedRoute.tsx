import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { AppShell } from './AppShell'

export function ProtectedRoute() {
  const { session, loading } = useAuth()

  if (loading) {
    return <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">Carregando…</div>
  }

  if (!session) return <Navigate to="/login" replace />

  return <AppShell />
}
