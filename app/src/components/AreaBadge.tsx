import { Badge } from '@/components/ui/badge'
import type { Area } from '@/lib/api/areas'

export function AreaBadge({ area }: { area: Area }) {
  return (
    <Badge variant="secondary" className="gap-1.5 font-normal">
      <span className="size-2 rounded-full" style={{ backgroundColor: area.color ?? '#999' }} />
      {area.name}
    </Badge>
  )
}
