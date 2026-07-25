-- Noos — RPC auxiliar match_note_embeddings
-- Usado pela Edge Function suggest-note-connections: dado o embedding já
-- gravado de uma nota, acha os vizinhos mais próximos (similaridade de
-- cosseno) do MESMO dono. security invoker: continua sob RLS de
-- note_embeddings (SELECT liberado ao dono, ver docs/ESTRUTURA.md §2).

create or replace function public.match_note_embeddings(p_note_id uuid, p_match_count int default 5)
returns table (note_id uuid, score float)
language sql
stable
security invoker
as $$
  select
    ne2.note_id,
    1 - (ne1.embedding <=> ne2.embedding) as score
  from public.note_embeddings ne1
  join public.note_embeddings ne2
    on ne2.user_id = ne1.user_id
   and ne2.note_id <> ne1.note_id
  where ne1.note_id = p_note_id
    and ne1.user_id = auth.uid()
  order by ne1.embedding <=> ne2.embedding
  limit p_match_count;
$$;

grant execute on function public.match_note_embeddings(uuid, int) to authenticated;
