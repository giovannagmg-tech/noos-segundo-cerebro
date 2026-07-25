-- Noos — troca de provedor de embeddings: OpenAI (text-embedding-3-small,
-- 1536 dim) → Gemini (gemini-embedding-001, truncado pra 768 dim conforme
-- recomendação da própria Google — 0.26% de perda de qualidade vs. os 3072
-- nativos, por 1/4 do espaço). Tabela ainda vazia (nenhuma Edge Function
-- de embedding tinha sido deployada com sucesso até agora), então é seguro
-- alterar o tipo da coluna direto, sem migração de dado.

drop index if exists idx_note_embeddings_vector;

alter table public.note_embeddings
  alter column embedding type vector(768);

create index idx_note_embeddings_vector on public.note_embeddings
  using hnsw (embedding vector_cosine_ops);
