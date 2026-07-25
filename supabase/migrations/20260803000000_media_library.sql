-- Noos — Biblioteca de mídias (imagens inseridas nas notas via editor)
--
-- Toda imagem colada/arrastada no editor de uma nota vira um arquivo no
-- Storage (bucket note-media) + uma linha em media, herdando o note_id de
-- origem (link bidirecional) e as tags que a nota tinha NO MOMENTO do
-- upload (snapshot em media_tags — não é um vínculo ao vivo com note_tags;
-- se a nota ganhar/perder tags depois, as mídias já existentes não mudam).
--
-- Modelo de segurança do bucket: PÚBLICO pra leitura (decisão deliberada,
-- não um descuido). Path = "{user_id}/{note_id}/{uuid}.ext" — imprevisível
-- o bastante pro uso pessoal, e evita ter que re-assinar URL toda vez que a
-- nota é aberta (bucket privado exigiria isso, já que o conteúdo da nota
-- guarda a URL da imagem em Markdown puro). Escrita (insert/update/delete)
-- continua restrita ao dono via policy no storage.objects.

-- ---------------------------------------------------------------------------
-- media
-- ---------------------------------------------------------------------------
create table public.media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  note_id uuid references public.notes(id) on delete set null,
  storage_path text not null unique,
  public_url text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create index idx_media_user on public.media (user_id);
create index idx_media_note on public.media (note_id);

alter table public.media enable row level security;

create policy "media_select_own" on public.media
  for select to authenticated using (user_id = auth.uid());
create policy "media_insert_own" on public.media
  for insert to authenticated with check (user_id = auth.uid());
create policy "media_update_own" on public.media
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "media_delete_own" on public.media
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- media_tags (herança de tags — snapshot no upload, igual note_tags)
-- ---------------------------------------------------------------------------
create table public.media_tags (
  media_id uuid not null references public.media(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (media_id, tag_id)
);

create index idx_media_tags_tag_id on public.media_tags (tag_id);

alter table public.media_tags enable row level security;

create policy "media_tags_select_own" on public.media_tags
  for select to authenticated using (user_id = auth.uid());
create policy "media_tags_insert_own" on public.media_tags
  for insert to authenticated with check (user_id = auth.uid());
create policy "media_tags_delete_own" on public.media_tags
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Storage: bucket note-media (leitura pública, escrita só do dono)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('note-media', 'note-media', true, 15728640) -- 15MB
on conflict (id) do nothing;

create policy "note_media_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'note-media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "note_media_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'note-media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "note_media_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'note-media' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'note-media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "note_media_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'note-media' and (storage.foldername(name))[1] = auth.uid()::text);
