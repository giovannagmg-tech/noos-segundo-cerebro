import { Button } from '@/components/ui/button'

export default function Pomodoro() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-24 text-center">
      <span className="font-mono text-6xl tabular-nums">25:00</span>
      <p className="text-sm text-muted-foreground">
        Você ainda não fez nenhuma sessão de foco — inicie seu primeiro Pomodoro.
      </p>
      <Button disabled>Iniciar</Button>
    </div>
  )
}
