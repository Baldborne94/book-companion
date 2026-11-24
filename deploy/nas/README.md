# Book Companion ospitata sul NAS

Chiesto dal lettore: le app girano direttamente sul NAS (UGREEN DXP2800), non più su Vercel.

```
https://book-companion.<rete>.ts.net/        → l'app (PWA)
https://book-companion.<rete>.ts.net/libri/  → la cartella Biblioteca (Libri, Fumetti, Manga), sola lettura
```

- **nginx** serve la build e le cartelle nel formato che `lib/nas.js` già legge. È la stessa ricetta di `docs/NAS.md`, ma dallo stesso indirizzo dell'app: niente CORS, niente permesso della rete locale di Chrome.
- **Tailscale** dà l'HTTPS con un certificato valido e la strada da fuori casa, senza aprire porte. Sul tablet l'app Tailscale va tenuta accesa.
- La cartella condivisa `Biblioteca` si monta come `/libri/book-companion`: nessun file da spostare.

**Non ancora provato su un NAS vero.** Il primo avvio fa da collaudo.

## Una tantum: Tailscale

1. Crea un account su tailscale.com e installa l'app **Tailscale sul tablet**, con lo stesso account.
2. Nella console, sotto **DNS**, accendi **MagicDNS** e **HTTPS Certificates**.
3. Sempre nella console, **Settings → Keys → Generate auth key**: Reusable off, Ephemeral off, Tags off.

## Sul NAS (UGOS)

1. Da **App Center** installa Docker. Da **Pannello di controllo → Terminale** attiva SSH.
2. Scarica lo ZIP del codice, caricalo con l'app File in una cartella condivisa `docker` ed estrailo.
3. Da PowerShell sul PC:

```bash
ssh UTENTE@IP_DEL_NAS
```

```bash
ls /volume1/Biblioteca
```

Devono comparire Fumetti, Libri e Manga. Entra nella cartella `deploy/nas` del codice estratto e crea il file `.env`, mettendo i valori veri al posto dei segnaposto:

```bash
cat > .env <<'EOF'
BIBLIOTECA_PATH=/volume1/Biblioteca
TS_HOSTNAME=book-companion
TS_AUTHKEY=LA_CHIAVE_TAILSCALE
VITE_SUPABASE_URL=URL_DA_VERCEL
VITE_SUPABASE_ANON_KEY=CHIAVE_ANON_DA_VERCEL
EOF
```

```bash
sudo docker compose up -d --build
```

4. Nella console Tailscale, sotto **Machines**, apri il menu `…` di `book-companion` e scegli **Disable key expiry**. Se non lo fai, fra 180 giorni l'app non si raggiunge più.

## Nell'app

1. Dal tablet, con Tailscale acceso, apri `https://book-companion.<rete>.ts.net` in Chrome e scegli **Installa app**.
2. Entra in Supabase come sempre: schede, letture e segnalibri tornano dalla sincronizzazione. Se entri con Google, prima aggiungi il nuovo indirizzo fra i **Redirect URLs** di Supabase (`docs/ACCESSO.md`).
3. In **Impostazioni → Il NAS** scrivi `book-companion.<rete>.ts.net/libri/`, poi tocca «Salva e prova» e «🔍 Guarda cosa c'è sul NAS».
4. Le impostazioni che vivono solo sul dispositivo non passano da sole: Esporta dalla vecchia app, poi Ripristina sulla nuova.

## Aggiornare

Scarica di nuovo lo ZIP e sostituisci la cartella, tenendo `.env` e `tailscale/`. Poi:

```bash
sudo docker compose up -d --build
```

## Ancora da fare: l'APK

Il guscio Android è legato a `book-companion-ruddy.vercel.app` (`scripts/apk.mjs` → `SITO`), e il giro della CI scarica manifest e icone dal sito. Spostarlo sul NAS è un passo a parte:

- la CI di GitHub non raggiunge un indirizzo della rete Tailscale, quindi il giro va cambiato per leggere icone e manifest dal repository;
- **da provare sul tablet**: un guscio TWA si fida del sito leggendo `/.well-known/assetlinks.json`. Se quella verifica passa dai server di Google, che non vedono la rete Tailscale, il guscio partirebbe con la barra di Chrome in cima.

Finché questo non è provato, l'APK resta su Vercel e la PWA del NAS si usa installata da Chrome.
