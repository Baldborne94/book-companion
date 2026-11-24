# Book Companion sul NAS, tutto compreso

Chiesto dal lettore: «voglio che sia tutto sul nas». App, libri e sincronizzazione stanno sul NAS (UGREEN DXP2800). Niente Vercel, niente Supabase nel cloud.

```
https://book-companion.<rete>.ts.net/            → l'app
https://book-companion.<rete>.ts.net/libri/      → Biblioteca (Libri, Fumetti, Manga), sola lettura
https://book-companion.<rete>.ts.net/auth/v1/    ┐
https://book-companion.<rete>.ts.net/rest/v1/    ├ il Supabase del NAS
https://book-companion.<rete>.ts.net/storage/v1/ ┘
```

- **nginx** serve l'app e le cartelle e fa da porta per Supabase, tutto dallo stesso indirizzo.
- **Supabase self-hosted**, solo i pezzi che l'app usa:
  - Postgres;
  - GoTrue, per entrare con email e password;
  - PostgREST;
  - Storage, per le copertine.

  Immagini e impostazioni vengono dal self-hosting ufficiale (`supabase/docker`). Lo schema dell'app (`supabase/schema.sql`) si riapplica a ogni avvio, ed è rieseguibile.
- **Tailscale** dà l'HTTPS e la strada da fuori casa. Sul tablet l'app Tailscale va tenuta accesa.

Provato in Docker, con Tailscale sostituito da una porta locale:
- registrazione e accesso, schede e prefs, copertine in Storage;
- ogni utente vede solo le sue righe;
- l'app vera entra dal pannello e scarica la scheda.

## Prima volta

Dalla cartella `deploy/nas`, collegati via SSH.

1. Il file `.env` con indirizzo, cartella e chiave Tailscale:

```bash
cat > .env <<'EOF'
BIBLIOTECA_PATH=/volume1/Biblioteca
TS_HOSTNAME=book-companion
TS_AUTHKEY=LA_CHIAVE_TAILSCALE
SUPABASE_PUBLIC_URL=https://book-companion.<rete>.ts.net
EOF
```

2. Le chiavi di Supabase si generano una volta sola e si aggiungono in fondo a `.env`. **Non rigenerarle**: cambierebbero la password del database già creato.

```bash
sudo docker run --rm -v "$PWD":/w -w /w node:22-alpine node chiavi.mjs >> .env
```

3. Avvio. La prima volta impiega qualche minuto:

```bash
sudo docker compose up -d --build
```

4. Controllo: `schema` deve risultare `Exited (0)`, tutti gli altri `Up`:

```bash
sudo docker compose ps -a
```

## Nell'app

1. Apri l'app e tocca la **nuvola** (Sincronizzazione). Tocca **Registrati** con la tua email e una password: entri subito, senza email di conferma, perché sul NAS non c'è un server di posta.
2. Porta dentro la biblioteca: dalla **vecchia app** «📦 Esporta biblioteca», in quella del NAS **↩ Ripristina**. La sincronizzazione la carica sul NAS. Sull'altro dispositivo basta entrare con lo stesso account.
3. In **Impostazioni → Il NAS** scrivi `book-companion.<rete>.ts.net/libri/`, poi «Salva e prova».
4. Quando tutti i tuoi dispositivi sono entrati, chiudi le registrazioni:

```bash
echo "DISABLE_SIGNUP=true" >> .env && sudo docker compose up -d
```

## Password dimenticata

«Password dimenticata?» manda un'email, e sul NAS la posta non c'è. Si cambia da qui, mettendo la tua email e la nuova password:

```bash
sudo docker compose exec db psql -U supabase_admin -d postgres -c "update auth.users set encrypted_password = crypt('NUOVA_PASSWORD', gen_salt('bf')) where email = 'TUA@EMAIL'"
```

## Copia di sicurezza

I dati di Supabase stanno in `deploy/nas/supabase/dati` (database) e `deploy/nas/supabase/file` (copertine). Una copia del database, senza fermare niente:

```bash
sudo docker compose exec db pg_dump -U supabase_admin -d postgres --schema=public --schema=auth --schema=storage > copia-$(date +%F).sql
```

## Aggiornare

Scarica di nuovo lo ZIP e sostituisci il codice, tenendo `.env`, `tailscale/` e `supabase/dati` e `supabase/file`. Poi:

```bash
sudo docker compose up -d --build
```

## Ancora da fare

- **Installare l'app su Android.** Chrome fa costruire l'app installata (WebAPK) dai server di Google, che non vedono la rete Tailscale: per ora si usa «Aggiungi a schermata Home → Crea scorciatoia». La strada è Tailscale Funnel con `/libri/` e Supabase riservati a chi arriva da Tailscale, da provare.
- **L'APK** (`scripts/apk.mjs` → `SITO`) è legato a Vercel per lo stesso motivo.
