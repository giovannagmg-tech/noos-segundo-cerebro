// Helper de autenticação compartilhado: resolve o user_id da chamada, cobrindo
// os dois jeitos que essas functions são chamadas (docs/FUNCTIONS.md):
//   1. Usuário logado — Authorization: Bearer <JWT do usuário> (dono aciona
//      pela UI). user_id vem do próprio JWT (auth.getUser()), nunca do body.
//   2. Invocação de serviço — pg_cron/pg_net chama com Authorization: Bearer
//      <service_role key>. Nesse caso não existe sessão de usuário real, então
//      o user_id vem do body — só é aceito porque o Authorization bate
//      exatamente com a service_role key, um segredo que só o próprio banco
//      (Vault) e o painel do Supabase conhecem, nunca o frontend.
import { createClient } from 'npm:@supabase/supabase-js@2'

export type AuthContext = {
  userId: string
  isServiceInvocation: boolean
}

export async function resolveAuth(
  req: Request,
  opts: {
    supabaseUrl: string
    anonKey: string
    serviceRoleKey: string
    body: { user_id?: string }
  },
): Promise<AuthContext | null> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return null

  if (authHeader === `Bearer ${opts.serviceRoleKey}`) {
    if (!opts.body.user_id) return null
    return { userId: opts.body.user_id, isServiceInvocation: true }
  }

  const supabase = createClient(opts.supabaseUrl, opts.anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) return null
  return { userId: user.id, isServiceInvocation: false }
}
