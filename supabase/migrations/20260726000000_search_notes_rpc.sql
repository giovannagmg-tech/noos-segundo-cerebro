-- Noos — RPC search_notes (RS-07 / docs/FUNCTIONS.md)
-- Busca full-text (título + conteúdo) restrita ao dono autenticado.
-- Ranqueamento semântico via note_embeddings fica para a fase de IA (Fase 2 — item B/C).

create or replace function public.search_notes(query text)
returns table (
  id uuid,
  title text,
  snippet text,
  updated_at timestamptz
)
language sql
stable
security invoker
as $$
  select
    n.id,
    n.title,
    ts_headline(
      'portuguese',
      coalesce(n.content, ''),
      plainto_tsquery('portuguese', query),
      'MaxFragments=1,MaxWords=25,MinWords=10,ShortWord=3'
    ) as snippet,
    n.updated_at
  from public.notes n
  where n.user_id = auth.uid()
    and to_tsvector('portuguese', coalesce(n.title, '') || ' ' || coalesce(n.content, ''))
        @@ plainto_tsquery('portuguese', query)
  order by ts_rank(
    to_tsvector('portuguese', coalesce(n.title, '') || ' ' || coalesce(n.content, '')),
    plainto_tsquery('portuguese', query)
  ) desc;
$$;

grant execute on function public.search_notes(text) to authenticated;
