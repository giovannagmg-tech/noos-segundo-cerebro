import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function Capture() {
  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4 py-12">
      <h1 className="text-lg font-semibold">O que você quer capturar?</h1>
      <div className="grid gap-2">
        <Label htmlFor="capture-title">Título (opcional)</Label>
        <Input id="capture-title" disabled />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="capture-content">Conteúdo</Label>
        <textarea
          id="capture-content"
          disabled
          rows={8}
          className="rounded-md border bg-transparent px-3 py-2 text-sm"
        />
      </div>
      <Button disabled>Salvar captura</Button>
    </div>
  )
}
