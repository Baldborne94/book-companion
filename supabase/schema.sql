-- Book Companion — schema per la sincronizzazione multi-dispositivo.
-- Esegui questo file una volta sola nel SQL Editor del tuo progetto Supabase.

create table if not exists public.books (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  author text not null default '',
  series text not null default '',
  file_type text not null default 'epub',
  added_at bigint not null default 0,
  rating int not null default 0,
  notes text not null default '',
  status text not null default 'unread',
  progress double precision not null default 0,
  cfi text,
  marks jsonb not null default '[]'::jsonb,
  highlights jsonb not null default '[]'::jsonb,
  music jsonb,
  file_ext text,
  deleted boolean not null default false,
  updated_at bigint not null default 0
);

create index if not exists books_user_idx on public.books(user_id);
alter table public.books enable row level security;

drop policy if exists "books sono solo miei" on public.books;
create policy "books sono solo miei" on public.books
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reader jsonb,
  music_favs jsonb not null default '[]'::jsonb,
  last_opened text,
  updated_at bigint not null default 0
);

alter table public.prefs enable row level security;

drop policy if exists "prefs sono solo mie" on public.prefs;
create policy "prefs sono solo mie" on public.prefs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('books', 'books', false)
on conflict (id) do nothing;

drop policy if exists "file miei: leggo" on storage.objects;
create policy "file miei: leggo" on storage.objects
  for select using (bucket_id = 'books' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "file miei: carico" on storage.objects;
create policy "file miei: carico" on storage.objects
  for insert with check (bucket_id = 'books' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "file miei: aggiorno" on storage.objects;
create policy "file miei: aggiorno" on storage.objects
  for update using (bucket_id = 'books' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "file miei: elimino" on storage.objects;
create policy "file miei: elimino" on storage.objects
  for delete using (bucket_id = 'books' and (storage.foldername(name))[1] = auth.uid()::text);
