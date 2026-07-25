-- Noos — RPC get_knowledge_graph (docs/FUNCTIONS.md)
-- Retorna nós (notes) e arestas (note_links) do dono num único payload JSON,
-- opcionalmente restrito a uma tag/área. Cada nó já vem com suas tags (id,
-- name, color) pra colorir o grafo sem uma segunda ida ao banco.

create or replace function public.get_knowledge_graph(filter_tag_id uuid default null)
returns json
language sql
stable
security invoker
as $$
  with note_ids as (
    select n.id
    from public.notes n
    where n.user_id = auth.uid()
      and (
        filter_tag_id is null
        or exists (
          select 1 from public.note_tags nt
          where nt.note_id = n.id and nt.tag_id = filter_tag_id
        )
      )
  ),
  nodes as (
    select
      n.id,
      n.title,
      n.is_quick_capture,
      coalesce(
        (
          select json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color))
          from public.note_tags nt
          join public.tags t on t.id = nt.tag_id
          where nt.note_id = n.id
        ),
        '[]'::json
      ) as tags
    from public.notes n
    where n.id in (select id from note_ids)
  ),
  edges as (
    select nl.id, nl.source_note_id, nl.target_note_id, nl.origin
    from public.note_links nl
    where nl.user_id = auth.uid()
      and nl.source_note_id in (select id from note_ids)
      and nl.target_note_id in (select id from note_ids)
  )
  select json_build_object(
    'nodes', coalesce((select json_agg(row_to_json(nodes)) from nodes), '[]'::json),
    'edges', coalesce((select json_agg(row_to_json(edges)) from edges), '[]'::json)
  );
$$;

grant execute on function public.get_knowledge_graph(uuid) to authenticated;
