import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type Status = 'idle' | 'sending' | 'sent' | 'error'
type Mode = 'magic' | 'password'
type PasswordAction = 'signin' | 'signup'

export default function Login() {
  const { session, loading } = useAuth()
  const [mode, setMode] = useState<Mode>('magic')
  const [passwordAction, setPasswordAction] = useState<PasswordAction>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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

  async function handlePassword(e: FormEvent) {
    e.preventDefault()
    if (!email || !password) return
    setStatus('sending')
    setErrorMessage('')
    const { error } =
      passwordAction === 'signin'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password })
    if (error) {
      setStatus('error')
      setErrorMessage(error.message)
    } else if (passwordAction === 'signup') {
      setStatus('sent')
    } else {
      setStatus('idle')
    }
  }

  async function handleGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' })
    if (error) {
      setStatus('error')
      setErrorMessage(error.message)
    }
  }

  function switchMode(next: Mode) {
    setMode(next)
    setStatus('idle')
    setErrorMessage('')
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
              {mode === 'magic'
                ? <>Enviamos um link para <strong>{email}</strong> — confira sua caixa de entrada.</>
                : <>Conta criada — confira <strong>{email}</strong> para confirmar antes de entrar.</>}
            </p>
          ) : mode === 'magic' ? (
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
              <button
                type="button"
                className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                onClick={() => switchMode('password')}
              >
                Prefiro entrar com e-mail e senha
              </button>
            </form>
          ) : (
            <form onSubmit={handlePassword} className="flex flex-col gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email-pw">E-mail</Label>
                <Input
                  id="email-pw"
                  type="email"
                  placeholder="voce@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              {status === 'error' && <p className="text-sm text-destructive">{errorMessage}</p>}
              <Button type="submit" disabled={status === 'sending'}>
                {status === 'sending'
                  ? 'Aguarde...'
                  : passwordAction === 'signin'
                    ? 'Entrar'
                    : 'Criar conta'}
              </Button>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <button
                  type="button"
                  className="underline-offset-2 hover:underline"
                  onClick={() =>
                    setPasswordAction((a) => (a === 'signin' ? 'signup' : 'signin'))
                  }
                >
                  {passwordAction === 'signin' ? 'Criar uma conta' : 'Já tenho conta'}
                </button>
                <button
                  type="button"
                  className="underline-offset-2 hover:underline"
                  onClick={() => switchMode('magic')}
                >
                  Usar link mágico
                </button>
              </div>
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
