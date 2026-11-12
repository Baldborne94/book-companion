# Il NAS di casa

Chiesto dal lettore per un **UGREEN NASync DXP2800** (Intel N100, 8 GB, 2,5 GbE, Docker): «il nas proprio come nas locale», «vorrei leggere anche fuori casa».

**Nessuno dei passi qui sotto è stato provato su un NAS vero: si scrivono adesso e si correggono quando il NAS c'è.** Quel che è provato è la parte dell'app (`lib/nas.js`, `test/nas.test.mjs`, e la scena «il NAS» di `npm run e2e`), contro un NAS finto che risponde come il nginx descritto sotto (`e2e/nasFinto.mjs`).

## Com'è fatto

- **L'app resta su Vercel** (`https://book-companion-ruddy.vercel.app`). Se la pubblicasse il NAS, avrebbe un altro indirizzo: un'altra memoria del browser (schede, letture, file già scaricati) e un APK che non la apre (il guscio è legato a quell'indirizzo, `assetlinks.json`).
- **Il NAS fa da server dei file**: un **nginx** in Docker che:
  - elenca le cartelle in JSON (`autoindex_format json`);
  - serve i file anche a pezzi (Range);
  - lascia entrare **solo** la nostra app (CORS e la rete privata).
- **Tailscale** dà al NAS un indirizzo HTTPS col suo certificato (`nas.<rete>.ts.net`) e la strada da fuori casa, senza aprire porte sul router. Sul tablet l'app Tailscale va tenuta accesa.
- **Le cartelle sono quelle del disco del computer**: `book-companion/Libri|Fumetti|Manga/<saga>/…` (`casaDelVolume`). L'app le abbina alle schede con le regole di «🔍 Controlla il disco».
- **Supabase resta com'è**: schede, letture e segnalibri viaggiano lì.

## Nell'app

1. Impostazioni → **Il NAS**: l'indirizzo della cartella che contiene `book-companion` (per esempio `nas.tuarete.ts.net/libri`), poi «Salva e prova».
2. «🔍 Guarda cosa c'è sul NAS»: dice quali libri della biblioteca hanno il file sul NAS e lo ricorda su questo dispositivo. Va rifatto quando sul NAS arrivano libri nuovi.
3. Su un libro che qui non ha il file, «Apri» (o «📂 Scegli il file») lo **prende dal NAS**: entra dalla porta di sempre, nella sua scheda, e si apre. Da quel momento è sul dispositivo, anche senza rete.

## Sul NAS (da provare)

### 1. Le cartelle

Una cartella condivisa, per esempio `/volume1/libri`, con dentro `book-companion/` copiata dal disco del computer.

### 2. nginx

`/volume1/docker/libri/nginx.conf`:

```nginx
map $http_origin $app {
  default "";
  "https://book-companion-ruddy.vercel.app" $http_origin;
}

server {
  listen 8080;
  charset utf-8;

  location /libri/ {
    alias /libri/;
    autoindex on;
    autoindex_format json;

    add_header Access-Control-Allow-Origin $app always;
    add_header Vary Origin always;
    add_header Access-Control-Allow-Headers "Range, Accept" always;
    add_header Access-Control-Expose-Headers "Content-Length, Content-Range, Accept-Ranges" always;
    add_header Access-Control-Allow-Private-Network "true" always;

    if ($request_method = OPTIONS) {
      add_header Access-Control-Allow-Origin $app always;
      add_header Access-Control-Allow-Headers "Range, Accept" always;
      add_header Access-Control-Allow-Private-Network "true" always;
      return 204;
    }
  }
}
```

### 3. Docker Compose (Tailscale e nginx insieme)

`/volume1/docker/libri/compose.yaml`:

```yaml
services:
  tailscale:
    image: tailscale/tailscale:stable
    hostname: nas
    environment:
      - TS_AUTHKEY=${TS_AUTHKEY}      # una chiave da tailscale.com, nel file .env accanto, mai qui
      - TS_STATE_DIR=/var/lib/tailscale
      - TS_SERVE_CONFIG=/config/serve.json
    volumes:
      - ./tailscale:/var/lib/tailscale
      - ./serve.json:/config/serve.json:ro
    restart: unless-stopped

  libri:
    image: nginx:stable-alpine
    network_mode: service:tailscale
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - /volume1/libri:/libri:ro
    restart: unless-stopped
```

`/volume1/docker/libri/serve.json` (Tailscale pubblica nginx in HTTPS sul suo indirizzo):

```json
{
  "TCP": { "443": { "HTTPS": true } },
  "Web": {
    "${TS_CERT_DOMAIN}:443": {
      "Handlers": { "/": { "Proxy": "http://127.0.0.1:8080" } }
    }
  }
}
```

Nella console di Tailscale vanno accesi **MagicDNS** e **HTTPS Certificates**. L'indirizzo da scrivere nell'app sarà `https://nas.<rete>.ts.net/libri/`.

## Da guardare quando il NAS c'è

- **La rete privata di Chrome.** L'app è un sito pubblico, e Chrome chiede un permesso, o una risposta speciale (`Access-Control-Allow-Private-Network`), per parlare con un indirizzo di casa o di Tailscale (100.x). Se il tablet mostra una richiesta di permesso, va accettata. Se la prova fallisce senza dire niente, il rapporto dei guasti e la console di Chrome diranno perché.
- **I tempi.** Quanto ci mette «Guarda cosa c'è sul NAS» sui volumi veri, e quanto scende un fumetto da un giga fuori casa: si misura, e solo dopo si decide se leggere i fumetti a pezzi dal NAS invece di scaricarli interi.
- **Solo lettura.** Il NAS per ora si legge e basta: «Riordina» e le copie della biblioteca restano del disco del computer.
