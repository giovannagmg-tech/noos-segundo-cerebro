import { Badge } from '@/components/ui/badge'
import type { Tag } from '@/lib/api/types'

export function TagPill({ tag, onRemove }: { tag: Tag; onRemove?: () => void }) {
  return (
    <Badge variant="secondary" className="gap-1.5 font-normal">
      <span className="size-2 rounded-full" style={{ backgroundColor: tag.color ?? '#999' }} />
      {tag.name}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 text-muted-foreground hover:text-foreground"
          aria-label={`Remover tag ${tag.name}`}
        >
          ×
        </button>
      )}
    </Badge>
  )
}
