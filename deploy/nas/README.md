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

## Come si aggiorna: da solo

Le immagini dell'app e del database le costruisce **GitHub** a ogni cambio su `main` (`.github/workflows/nas.yml`) e le pubblica su GHCR, senza chiavi dentro: l'app legge indirizzo e chiave di Supabase all'avvio dal `.env` del NAS (`config.sh` → `/config.js`). Sul NAS l'**aggiornatore**, ogni ora:
1. riprende `docker-compose.yml` e `serve.json` da `main`, ma solo se `docker compose` li legge senza errori, altrimenti tiene quelli di prima;
2. scarica le immagini nuove;
3. riavvia solo i servizi cambiati. Se stesso non lo ricrea.

Niente ZIP né SSH: fai il merge su GitHub, e entro un'ora il NAS è aggiornato.

## Prima volta

Tutto sta in **`/volume1/Docker/book-companion-dati`**: chiavi, Tailscale, database, copertine e anche la configurazione. Il codice sul NAS non serve più.

1. Una volta sola, su GitHub: **Packages → `book-companion-app` e `book-companion-db` → Package settings → Change visibility → Public.** Così il NAS le scarica senza password. Non contengono chiavi.
2. Il `.env`, con la chiave Tailscale e il nome della rete al posto dei segnaposto:

```bash
sudo mkdir -p /volume1/Docker/book-companion-dati && printf '%s\n' DATI=/volume1/Docker/book-companion-dati BIBLIOTECA_PATH=/volume1/book-companion TS_HOSTNAME=book-companion TS_AUTHKEY=LA_CHIAVE_TAILSCALE SUPABASE_PUBLIC_URL=https://book-companion.<rete>.ts.net | sudo tee /volume1/Docker/book-companion-dati/.env > /dev/null
```

3. Le chiavi di Supabase, **una volta sola**: rigenerarle cambierebbe la password del database già creato.

```bash
sudo docker run --rm node:22-alpine node --input-type=module -e "$(curl -fsSL https://raw.githubusercontent.com/Baldborne94/book-companion/main/deploy/nas/chiavi.mjs)" | sudo tee -a /volume1/Docker/book-companion-dati/.env > /dev/null
```

4. La configurazione e l'avvio. Dopo questo, ci pensa l'aggiornatore:

```bash
cd /volume1/Docker/book-companion-dati && sudo curl -fsSLO https://raw.githubusercontent.com/Baldborne94/book-companion/main/deploy/nas/docker-compose.yml && sudo curl -fsSLO https://raw.githubusercontent.com/Baldborne94/book-companion/main/deploy/nas/serve.json
```

```bash
cd /volume1/Docker/book-companion-dati && sudo docker compose up -d
```

5. Controllo: `schema` deve risultare `Exited (0)`, tutti gli altri `Up`:

```bash
cd /volume1/Docker/book-companion-dati && sudo docker compose ps -a
```

D'ora in poi ogni comando `docker compose` si dà **da dentro `book-companion-dati`**.

## Nell'app

1. Apri l'app e tocca la **nuvola** (Sincronizzazione). Tocca **Registrati** con la tua email e una password. Entri subito, senza email di conferma, perché sul NAS non c'è un server di posta.
2. In **Impostazioni → Il NAS** scrivi `book-companion.<rete>.ts.net/libri/`, poi «Salva e prova».
3. Sull'altro dispositivo basta entrare con lo stesso account.
4. Quando tutti i tuoi dispositivi sono entrati, chiudi le registrazioni:

```bash
cd /volume1/Docker/book-companion-dati && echo DISABLE_SIGNUP=true | sudo tee -a .env && sudo docker compose up -d
```

## Password dimenticata

«Password dimenticata?» manda un'email, e sul NAS la posta non c'è. Si cambia da qui, mettendo la tua email e la nuova password:

```bash
cd /volume1/Docker/book-companion-dati && sudo docker compose exec db psql -U supabase_admin -d postgres -c "update auth.users set encrypted_password = crypt('NUOVA_PASSWORD', gen_salt('bf')) where email = 'TUA@EMAIL'"
```

## Copia di sicurezza

Tutto quello che conta sta in `book-companion-dati`:
- `supabase/dati`: il database;
- `supabase/file`: le copertine;
- `tailscale/`: l'accesso del NAS alla rete;
- `.env`: senza la sua password il database non si apre, quindi va copiato insieme al resto.

Una copia del database, senza fermare niente:

```bash
cd /volume1/Docker/book-companion-dati && sudo docker compose exec db pg_dump -U supabase_admin -d postgres --schema=public --schema=auth --schema=storage > copia-$(date +%F).sql
```

## Aggiornare

Non serve: lo fa l'aggiornatore. Per non aspettare l'ora:

```bash
cd /volume1/Docker/book-companion-dati && sudo docker compose pull && sudo docker compose up -d
```

Per costruire le immagini dal codice invece di scaricarle (prove, o prima che GitHub le pubblichi), dalla cartella `deploy/nas` del codice:

```bash
sudo docker compose -f docker-compose.yml -f docker-compose.costruisci.yml --env-file /volume1/Docker/book-companion-dati/.env up -d --build
```

## Ancora da fare

- **Installare l'app su Android.** Chrome fa costruire l'app installata (WebAPK) dai server di Google, che non vedono la rete Tailscale: per ora si usa «Aggiungi a schermata Home → Crea scorciatoia». La strada è Tailscale Funnel con `/libri/` e Supabase riservati a chi arriva da Tailscale, da provare.
- **L'APK** (`scripts/apk.mjs` → `SITO`) è legato a Vercel per lo stesso motivo.
