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
--   alter table public.prefs add column if not exists racconti jsonb not null default '[]'::jsonb;
--   alter table public.prefs add column if not exists tempo jsonb not null default '{}'::jsonb;      -- tempo di lettura
--   alter table public.prefs add column if not exists obiettivi jsonb not null default '{}'::jsonb;  -- obiettivo dell'anno
--   alter table public.books alter column saga_order type real;  -- numero di collana coi decimali (2.5 = la novella)
--   alter table public.books add column if not exists saga_tolta boolean not null default false;  -- la saga tolta a mano
--   alter table public.books add column if not exists file_tolto boolean not null default false;  -- l'ebook tolto a mano
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
  -- coi decimali: Calibre scrive 2.5 per la novella fra il secondo e il
  -- terzo, e un `int` la rifiuterebbe insieme a tutta la sincronizzazione
  saga_order real,
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
  fav boolean not null default false,
  -- LA SAGA TOLTA A MANO: un libro senza saga perche' il lettore gliel'ha
  -- tolta e uno senza saga perche' nessuno gliel'ha mai data sono lo stesso
  -- record, e le cinque strade della saga guardano proprio quello. Senza
  -- questa colonna l'altro dispositivo la rimette al primo giro.
  saga_tolta boolean not null default false,
  -- L'EBOOK TOLTO A MANO: «tengo la scheda, il file no». Senza questa
  -- colonna l'altro dispositivo rispedirebbe i byte nel secchio al primo
  -- giro, e la nuvoletta tornerebbe a offrire uno scaricamento che il
  -- lettore aveva appena rifiutato.
  file_tolto boolean not null default false
);

-- per i database gia' creati: `create table if not exists` non aggiunge le
-- colonne nuove
alter table public.books add column if not exists impronta text;
alter table public.books add column if not exists fav boolean not null default false;
alter table public.books add column if not exists saga_tolta boolean not null default false;
alter table public.books add column if not exists file_tolto boolean not null default false;
-- e il numero di collana regge i decimali (su una colonna gia' `real` non fa niente)
alter table public.books alter column saga_order type real;

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
  -- i racconti delle antologie che il lettore ha spuntato nel cammino:
  -- non sono file e non hanno uno stato, quindi la spunta e' l'unico
  -- segno che dice «questa l'ho letta» (chiave: titolo__autore)
  racconti jsonb not null default '[]'::jsonb,
  -- il tempo di lettura: dispositivo -> giorno -> secondi. Ogni dispositivo
  -- scrive solo nel suo cassetto, e la fusione e' un'unione
  tempo jsonb not null default '{}'::jsonb,
  -- l'obiettivo di libri per anno: anno -> { n, t }
  obiettivi jsonb not null default '{}'::jsonb,
  last_opened text,
  updated_at bigint not null default 0
);

-- per i database gia' creati: `create table if not exists` non aggiunge le
-- colonne nuove, e senza questa riga le raccolte non salirebbero mai
alter table public.prefs add column if not exists music_lists jsonb not null default '[]'::jsonb;
alter table public.prefs add column if not exists glossari jsonb not null default '{}'::jsonb;
alter table public.prefs add column if not exists racconti jsonb not null default '[]'::jsonb;
alter table public.prefs add column if not exists tempo jsonb not null default '{}'::jsonb;
alter table public.prefs add column if not exists obiettivi jsonb not null default '{}'::jsonb;

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
