import { supabase } from '@/lib/supabase'

export type GraphNode = {
  id: string
  title: string
  is_quick_capture: boolean
  tags: { id: string; name: string; color: string | null }[]
}

export type GraphEdge = {
  id: string
  source_note_id: string
  target_note_id: string
  origin: string
}

export type GraphData = { nodes: GraphNode[]; edges: GraphEdge[] }

export async function getKnowledgeGraph(filterTagId?: string | null): Promise<GraphData> {
  const { data, error } = await supabase.rpc('get_knowledge_graph', {
    filter_tag_id: filterTagId ?? null,
  })
  if (error) throw error
  return data as GraphData
}
