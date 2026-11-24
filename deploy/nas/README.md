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

**Chiavi, Tailscale e dati di Supabase stanno fuori dal codice**, in `/volume1/Docker/book-companion-dati`. Aggiornare il codice sostituisce la sua cartella intera: se i dati fossero lì dentro, sparirebbero con lei.

1. Crea la cartella dei dati e il suo `.env`. Al posto del segnaposto metti la chiave Tailscale, e al posto di `<rete>` il nome della tua rete:

```bash
sudo mkdir -p /volume1/Docker/book-companion-dati && printf '%s\n' DATI=/volume1/Docker/book-companion-dati BIBLIOTECA_PATH=/volume1/Biblioteca TS_HOSTNAME=book-companion TS_AUTHKEY=LA_CHIAVE_TAILSCALE SUPABASE_PUBLIC_URL=https://book-companion.<rete>.ts.net | sudo tee /volume1/Docker/book-companion-dati/.env > /dev/null
```

2. Le chiavi di Supabase si generano una volta sola, dalla cartella `deploy/nas` del codice. **Non rigenerarle**: cambierebbero la password del database già creato.

```bash
sudo docker run --rm -v "$PWD":/w -w /w node:22-alpine node chiavi.mjs | sudo tee -a /volume1/Docker/book-companion-dati/.env > /dev/null
```

3. Avvio. La prima volta impiega qualche minuto. **Ogni comando `docker compose` porta `--env-file`**:

```bash
sudo docker compose --env-file /volume1/Docker/book-companion-dati/.env up -d --build
```

4. Controllo: `schema` deve risultare `Exited (0)`, tutti gli altri `Up`.

```bash
sudo docker compose --env-file /volume1/Docker/book-companion-dati/.env ps -a
```

## Nell'app

1. Apri l'app e tocca la **nuvola** (Sincronizzazione). Tocca **Registrati** con la tua email e una password. Entri subito, senza email di conferma, perché sul NAS non c'è un server di posta.
2. In **Impostazioni → Il NAS** scrivi `book-companion.<rete>.ts.net/libri/`, poi «Salva e prova».
3. Sull'altro dispositivo basta entrare con lo stesso account.
4. Quando tutti i tuoi dispositivi sono entrati, chiudi le registrazioni:

```bash
echo DISABLE_SIGNUP=true | sudo tee -a /volume1/Docker/book-companion-dati/.env && sudo docker compose --env-file /volume1/Docker/book-companion-dati/.env up -d
```

## Password dimenticata

«Password dimenticata?» manda un'email, e sul NAS la posta non c'è. Si cambia da qui, mettendo la tua email e la nuova password:

```bash
sudo docker compose --env-file /volume1/Docker/book-companion-dati/.env exec db psql -U supabase_admin -d postgres -c "update auth.users set encrypted_password = crypt('NUOVA_PASSWORD', gen_salt('bf')) where email = 'TUA@EMAIL'"
```

## Copia di sicurezza

Tutto quello che conta sta in `book-companion-dati`:
- `supabase/dati`: il database;
- `supabase/file`: le copertine;
- `tailscale/`: l'accesso del NAS alla rete;
- `.env`: senza la sua password il database non si apre, quindi va copiato insieme al resto.

Una copia del database, senza fermare niente:

```bash
sudo docker compose --env-file /volume1/Docker/book-companion-dati/.env exec db pg_dump -U supabase_admin -d postgres --schema=public --schema=auth --schema=storage > copia-$(date +%F).sql
```

## Aggiornare

Scarica di nuovo lo ZIP ed estrailo sopra quello vecchio: chiavi e dati stanno in `book-companion-dati` e non si toccano. Poi, dalla cartella `deploy/nas`:

```bash
sudo docker compose --env-file /volume1/Docker/book-companion-dati/.env up -d --build
```

## Ancora da fare

- **Installare l'app su Android.** Chrome fa costruire l'app installata (WebAPK) dai server di Google, che non vedono la rete Tailscale: per ora si usa «Aggiungi a schermata Home → Crea scorciatoia». La strada è Tailscale Funnel con `/libri/` e Supabase riservati a chi arriva da Tailscale, da provare.
- **L'APK** (`scripts/apk.mjs` → `SITO`) è legato a Vercel per lo stesso motivo.
