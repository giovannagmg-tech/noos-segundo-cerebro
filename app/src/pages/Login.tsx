import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type Status = 'idle' | 'sending' | 'sent' | 'error'

export default function Login() {
  const { session, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  if (!loading && session) return <Navigate to="/notes" replace />

  async function handleMagicLink(e: FormEvent) {
    e.preventDefault()
    if (!email) return
    setStatus('sending')
    setErrorMessage('')
    const { error } = await supabase.auth.signInWithOtp({ email })
    if (error) {
      setStatus('error')
      setErrorMessage(error.message)
    } else {
      setStatus('sent')
    }
  }

  async function handleGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' })
    if (error) {
      setStatus('error')
      setErrorMessage(error.message)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Noos</CardTitle>
          <CardDescription>Seu segundo cérebro pessoal.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {status === 'sent' ? (
            <p className="text-sm text-muted-foreground">
              Enviamos um link para <strong>{email}</strong> — confira sua caixa de entrada.
            </p>
          ) : (
            <form onSubmit={handleMagicLink} className="flex flex-col gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="voce@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              {status === 'error' && <p className="text-sm text-destructive">{errorMessage}</p>}
              <Button type="submit" disabled={status === 'sending'}>
                {status === 'sending' ? 'Enviando link de acesso...' : 'Entrar com link mágico'}
              </Button>
            </form>
          )}

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            ou
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button variant="outline" onClick={handleGoogle}>
            Entrar com Google
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
