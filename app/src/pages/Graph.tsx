import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ForceGraph2D, { type NodeObject } from 'react-force-graph-2d'
import { toast } from 'sonner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { getKnowledgeGraph, type GraphData, type GraphNode } from '@/lib/api/graph'
import { listTags, type TagWithCount } from '@/lib/api/tags'
import { useElementSize } from '@/hooks/use-element-size'
import { useTheme } from '@/hooks/use-theme'

const DEFAULT_COLOR = '#8a8f98'

export default function Graph() {
  const navigate = useNavigate()
  const { theme } = useTheme()
  const labelColor = theme === 'dark' ? '#e5e7eb' : '#111827'
  const [tags, setTags] = useState<TagWithCount[]>([])
  const [selectedTag, setSelectedTag] = useState<string>('all')
  const [graph, setGraph] = useState<GraphData | null>(null)
  const [loading, setLoading] = useState(true)
  const { ref, width, height } = useElementSize<HTMLDivElement>()

  useEffect(() => {
    listTags().then(setTags).catch(() => {})
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getKnowledgeGraph(selectedTag === 'all' ? null : selectedTag)
      setGraph(data)
    } catch (err) {
      console.error(err)
      toast.error('Não foi possível carregar o grafo. Tentar novamente.')
    } finally {
      setLoading(false)
    }
  }, [selectedTag])

  useEffect(() => {
    load()
  }, [load])

  const legend = useMemo(() => {
    if (!graph) return []
    const seen = new Map<string, string>()
    for (const node of graph.nodes) {
      for (const tag of node.tags) {
        if (!seen.has(tag.name)) seen.set(tag.name, tag.color ?? DEFAULT_COLOR)
      }
    }
    return [...seen.entries()]
  }, [graph])

  const graphData = useMemo(() => {
    if (!graph) return { nodes: [], links: [] }
    return {
      nodes: graph.nodes,
      links: graph.edges.map((e) => ({ ...e, source: e.source_note_id, target: e.target_note_id })),
    }
  }, [graph])

  return (
    <div className="mx-auto flex h-full max-w-4xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Grafo de conhecimento</h1>
        <Select value={selectedTag} onValueChange={setSelectedTag}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Todas as tags" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as tags</SelectItem>
            {tags.map((tag) => (
              <SelectItem key={tag.id} value={tag.id}>
                {tag.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <Skeleton className="h-[60vh] w-full" />
      ) : !graph || graph.nodes.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-24 text-center">
          <p className="text-sm text-muted-foreground">
            Seu grafo aparece aqui conforme você cria notas e as conecta.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span>{graph.nodes.length} notas</span>
            <span>{graph.edges.length} conexões</span>
            {legend.map(([name, color]) => (
              <span key={name} className="flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
                {name}
              </span>
            ))}
          </div>

          {graph.edges.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Conecte suas notas para ver o conhecimento se entrelaçar — use [[ ]] no texto de uma
              nota ou o botão + Link.
            </p>
          )}

          <div ref={ref} className="min-h-[60vh] flex-1 overflow-hidden rounded-lg border">
            {width > 0 && (
              <ForceGraph2D
                graphData={graphData}
                width={width}
                height={height || 480}
                nodeId="id"
                nodeLabel={(n) => (n as GraphNode).title || 'Sem título'}
                nodeColor={(n) => (n as GraphNode).tags[0]?.color ?? DEFAULT_COLOR}
                nodeRelSize={5}
                linkDirectionalArrowLength={3}
                linkDirectionalArrowRelPos={1}
                linkColor={() => 'rgba(140,140,150,0.5)'}
                onNodeClick={(n) => navigate(`/notes/${(n as NodeObject).id}`)}
                nodeCanvasObject={(n, ctx, globalScale) => {
                  const node = n as GraphNode & { x?: number; y?: number }
                  if (typeof node.x !== 'number' || typeof node.y !== 'number') return
                  const label = node.title || 'Sem título'
                  const fontSize = 12 / globalScale
                  ctx.beginPath()
                  ctx.arc(node.x, node.y, 4, 0, 2 * Math.PI)
                  ctx.fillStyle = node.tags[0]?.color ?? DEFAULT_COLOR
                  ctx.fill()
                  ctx.font = `${fontSize}px sans-serif`
                  ctx.textAlign = 'center'
                  ctx.textBaseline = 'top'
                  ctx.fillStyle = labelColor
                  ctx.fillText(label, node.x, node.y + 6)
                }}
              />
            )}
          </div>
        </>
      )}
    </div>
  )
}
