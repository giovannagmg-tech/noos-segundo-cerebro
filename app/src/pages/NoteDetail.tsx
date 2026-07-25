import { useParams } from 'react-router-dom'

export default function NoteDetail() {
  const { id } = useParams()

  return (
    <div className="mx-auto max-w-2xl py-24 text-center text-sm text-muted-foreground">
      Editor da nota <code className="rounded bg-muted px-1 py-0.5">{id}</code> chega na Fase 2 —
      Construção (título, markdown, tags, links, referências externas e sugestões da IA).
    </div>
  )
}
