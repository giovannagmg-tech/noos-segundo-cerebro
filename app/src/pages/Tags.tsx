import { Button } from '@/components/ui/button'

export default function Tags() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-24 text-center">
      <h1 className="text-xl font-semibold">Tags de área</h1>
      <p className="text-sm text-muted-foreground">
        Nenhuma tag criada ainda — crie tags de área (marketing, branding, neurociência...) para
        organizar suas notas.
      </p>
      <Button disabled>+ Nova tag</Button>
    </div>
  )
}
