# Book Companion sul NAS

L'app e la cartella `Biblioteca` servite dallo **stesso indirizzo HTTPS**:

```
https://biblioteca.<tua-tailnet>.ts.net/              → l'app (PWA installabile)
https://biblioteca.<tua-tailnet>.ts.net/biblioteca/   → Fumetti / Libri / Manga, sola lettura
```

Stessa origine, quindi niente CORS né mixed content. L'HTTPS con certificato valido lo fornisce Tailscale, ed è obbligatorio perché la PWA si installi e il service worker parta. Il NAS non apre porte sul router: lo raggiungono solo i tuoi dispositivi collegati a Tailscale, sia a casa sia fuori.

Due container:
- `tailscale`: mette il NAS nella tailnet con il nome `biblioteca` e termina l'HTTPS.
- `app`: Caddy, che serve la build Vite e monta `Biblioteca` in **sola lettura**.

Per le altre app basta lo stesso schema: una cartella, un `TS_HOSTNAME` diverso e un'altra coppia di container.

## Una tantum: Tailscale

1. Crea un account su https://tailscale.com (gratuito) e installa l'app **Tailscale sul tablet**, con lo stesso account.
2. Nella console admin → **DNS**: attiva **MagicDNS** e **HTTPS Certificates**.
3. **Settings → Keys → Generate auth key** (non reusable, non ephemeral). La copierai in `.env`.

## Sul NAS (UGOS)

1. **App Center** → installa **Docker**.
2. **Pannello di controllo → Terminale** → attiva **SSH**.
3. Scopri il percorso reale di `Biblioteca`: in Docker, quando aggiungi un volume, il selettore cartelle mostra il percorso assoluto (di solito `/volume1/Biblioteca`).
4. Porta il codice sul NAS, in una cartella tipo `docker/book-companion`:
   - con SSH e git: `git clone https://github.com/Baldborne94/book-companion.git`
   - oppure: scarica lo ZIP da GitHub (Code → Download ZIP) e caricalo/estrailo con l'app File.
5. Via SSH:

```bash
cd docker/book-companion/deploy/nas
```

```bash
cp .env.example .env && nano .env
```

```bash
sudo docker compose up -d --build
```

Dopo circa un minuto la macchina `biblioteca` compare nella console Tailscale. Dal tablet, con Tailscale acceso, apri `https://biblioteca.<tailnet>.ts.net` in Chrome → menu → **Installa app**.

Verifica rapida della libreria:

```bash
curl -H "Accept: application/json" https://biblioteca.<tailnet>.ts.net/biblioteca/
```

## Aggiornare l'app

```bash
cd docker/book-companion && git pull && cd deploy/nas && sudo docker compose up -d --build
```

La PWA mostra il banner "nuova versione" come su Vercel, mai mentre stai leggendo.

## Note

- **I dati di lettura non migrano da soli.** IndexedDB e localStorage sono legati all'indirizzo, quindi la versione NAS parte vuota. Per portarli: Esporta dalla versione Vercel e Ripristina da archivio sulla versione NAS. In alternativa, con le chiavi Supabase in `.env`, la sync ripopola tutto.
- La sezione per sfogliare `/biblioteca/` dall'app arriva nel prossimo PR. Questo PR prepara solo l'hosting.
- Con Supabase: aggiungi `https://biblioteca.<tailnet>.ts.net` tra i **Redirect URLs** (Authentication → URL Configuration), altrimenti il magic link riporta su Vercel.
