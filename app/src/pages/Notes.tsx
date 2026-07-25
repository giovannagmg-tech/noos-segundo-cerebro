import { Button } from '@/components/ui/button'

export default function Notes() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 py-24 text-center">
      <h1 className="text-xl font-semibold">Suas notas</h1>
      <p className="text-sm text-muted-foreground">
        Crie sua primeira nota ou importe do Notion/Obsidian — a importação é sempre incremental,
        nota a nota (RF-03).
      </p>
      <div className="flex gap-2">
        <Button disabled>+ Nova nota</Button>
        <Button variant="outline" disabled>
          Importar do Notion/Obsidian
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        (Editor, tags, links e busca chegam na Fase 2 — Construção, conforme docs/PLANO.md)
      </p>
    </div>
  )
}
