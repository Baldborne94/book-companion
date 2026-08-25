-- Book Companion — schema per la sincronizzazione multi-dispositivo.
-- Esegui questo file una volta sola nel SQL Editor del tuo progetto Supabase.
--
-- GIA' INSTALLATO? Aggiornalo con queste due righe:
--   alter table public.books
--     add column if not exists genre text not null default '',
--     add column if not exists saga  text not null default '',
--     add column if not exists saga_order int;
--   alter table public.books alter column rating type real;   -- mezze stelle
--   alter table public.books
--     add column if not exists started_at  bigint not null default 0,
--     add column if not exists finished_at bigint not null default 0;
--   alter table public.books add column if not exists impronta text;  -- doppioni
--   alter table public.books add column if not exists fav boolean not null default false;  -- cuore dei preferiti
--   alter table public.prefs add column if not exists glossari jsonb not null default '{}'::jsonb;
-- Senza, l'app sincronizza comunque tutto il resto: rinuncia solo al
-- campo mancante e lo tiene in locale. Dopo la migrazione i libri gia'
-- salvati si ricaricano da soli alla prima sincronizzazione.

create table if not exists public.books (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  author text not null default '',
  series text not null default '',
  genre text not null default '',
  saga text not null default '',
  saga_order int,
  file_type text not null default 'epub',
  added_at bigint not null default 0,
  rating real not null default 0,
  notes text not null default '',
  status text not null default 'unread',
  started_at bigint not null default 0,
  finished_at bigint not null default 0,
  progress double precision not null default 0,
  cfi text,
  marks jsonb not null default '[]'::jsonb,
  highlights jsonb not null default '[]'::jsonb,
  music jsonb,
  file_ext text,
  deleted boolean not null default false,
  updated_at bigint not null default 0,
  -- l'impronta SHA-256 dei byte del file: e' quella che riconosce lo stesso
  -- file importato due volte. Senza questa colonna il doppione fra due
  -- dispositivi si puo' solo segnalare per titolo e autore, non saltare.
  impronta text,
  -- il cuore dei preferiti: una scelta del lettore, non una soglia di stelle
  fav boolean not null default false
);

-- per i database gia' creati: `create table if not exists` non aggiunge le
-- colonne nuove
alter table public.books add column if not exists impronta text;
alter table public.books add column if not exists fav boolean not null default false;

create index if not exists books_user_idx on public.books(user_id);
alter table public.books enable row level security;

drop policy if exists "books sono solo miei" on public.books;
create policy "books sono solo miei" on public.books
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reader jsonb,
  music_favs jsonb not null default '[]'::jsonb,
  music_lists jsonb not null default '[]'::jsonb,
  -- i termini che il lettore ha scritto nel suo glossario, raccolti per
  -- saga: la chiave e' la saga, non il singolo volume, quindi stanno qui
  -- e non con i libri
  glossari jsonb not null default '{}'::jsonb,
  last_opened text,
  updated_at bigint not null default 0
);

-- per i database gia' creati: `create table if not exists` non aggiunge le
-- colonne nuove, e senza questa riga le raccolte non salirebbero mai
alter table public.prefs add column if not exists music_lists jsonb not null default '[]'::jsonb;
alter table public.prefs add column if not exists glossari jsonb not null default '{}'::jsonb;

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
