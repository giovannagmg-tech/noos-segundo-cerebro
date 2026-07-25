import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { generateInsight, listInsights, type AiInsight } from '@/lib/api/insights'

const TYPE_LABEL: Record<string, string> = {
  goal_progress: 'Progresso de metas',
  habit_summary: 'Resumo de hábitos',
  weekly_review: 'Revisão semanal',
}

export default function Insights() {
  const [insights, setInsights] = useState<AiInsight[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  async function refresh() {
    setLoading(true)
    try {
      setInsights(await listInsights())
    } catch (err) {
      console.error(err)
      toast.error('Falha ao carregar seus insights.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function handleGenerate() {
    setGenerating(true)
    try {
      await generateInsight()
      toast.success('Insight gerado!')
      refresh()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Não foi possível gerar o insight.'
      toast.error(message)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Insights</h1>
        <Button onClick={handleGenerate} disabled={generating}>
          {generating ? 'A IA está analisando seu progresso...' : 'Gerar insight agora'}
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-32 w-full" />
        </div>
      ) : insights.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          Seus insights de progresso aparecem aqui — gere o primeiro ou aguarde a revisão semanal.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {insights.map((insight, i) => (
            <li key={insight.id} className="flex flex-col gap-2 rounded-lg border p-4">
              <div className="flex items-center justify-between gap-2">
                <Badge variant={i === 0 ? 'default' : 'secondary'}>
                  {TYPE_LABEL[insight.insight_type] ?? insight.insight_type}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(insight.created_at).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'short',
                  })}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm">{insight.content}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
