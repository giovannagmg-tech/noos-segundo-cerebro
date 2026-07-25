import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { deleteMedia, listMedia } from '@/lib/api/media'
import type { MediaWithContext } from '@/lib/api/types'

export default function Media() {
  const navigate = useNavigate()
  const [items, setItems] = useState<MediaWithContext[] | null>(null)

  async function refresh() {
    try {
      setItems(await listMedia())
    } catch (err) {
      console.error(err)
      toast.error('Falha ao carregar a biblioteca de mídias.')
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function handleDelete(item: MediaWithContext) {
    try {
      await deleteMedia(item)
      setItems((prev) => prev?.filter((i) => i.id !== item.id) ?? null)
      toast.success('Mídia excluída.')
    } catch {
      toast.error('Falha ao excluir mídia.')
    }
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Mídias</h1>
        <p className="text-sm text-muted-foreground">
          Todas as imagens inseridas nas suas notas, com a origem e as tags herdadas.
        </p>
      </div>

      {items === null ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          Nenhuma mídia ainda — cole ou arraste uma imagem dentro de uma nota pra ela aparecer aqui.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {items.map((item) => (
            <figure key={item.id} className="group flex flex-col gap-1.5">
              <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
                <img
                  src={item.public_url}
                  alt={item.file_name}
                  className="size-full object-cover"
                  loading="lazy"
                />
                <button
                  onClick={() => handleDelete(item)}
                  className="absolute right-1.5 top-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  Excluir
                </button>
              </div>
              <div className="flex flex-col gap-1 px-0.5">
                {item.note_id && item.note_title ? (
                  <button
                    onClick={() => navigate(`/notes/${item.note_id}`)}
                    className="truncate text-left text-xs text-muted-foreground hover:text-foreground hover:underline"
                    title={`Abrir nota: ${item.note_title}`}
                  >
                    de "{item.note_title}"
                  </button>
                ) : (
                  <span className="text-xs text-muted-foreground">nota removida</span>
                )}
                {item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {item.tags.map((tag) => (
                      <span
                        key={tag.id}
                        className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                        style={{
                          backgroundColor: `${tag.color ?? '#999'}22`,
                          color: tag.color ?? '#999',
                        }}
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </figure>
          ))}
        </div>
      )}
    </div>
  )
}
