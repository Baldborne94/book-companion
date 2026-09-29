# 📖 Book Companion

La tua biblioteca personale, di notte: ePub, PDF e fumetti (CBZ/CBR, manga compresi) in un reader curato, con la musica di sottofondo, le tue saghe in ordine e un Oracolo che ti ricorda la storia fin dove sei arrivato — senza spoiler.

L'app è **local-first**: i libri stanno sul tuo dispositivo (o sul tuo Google Drive), e tutto funziona anche senza account. La sincronizzazione fra dispositivi è facoltativa.

**Apri l'app:** <https://book-companion-ruddy.vercel.app>

---

## Installazione

### Su Android: l'APK

1. Scarica l'ultimo APK dalla pagina **[Releases](https://github.com/Baldborne94/book-companion/releases/latest)** (il file `Grimorio-….apk`).
2. Aprilo dal telefono o dal tablet. Android chiede il permesso di «installare app da origini sconosciute» per il browser o per l'app dei file: concedilo una volta.
3. L'app compare fra le altre come **Grimorio**. Si apre a tutto schermo, e compare anche nel menu «Apri con» dei file `.epub`, `.pdf`, `.cbz` e `.cbr`.

L'APK è un guscio leggero che apre il sito dentro Chrome: gli aggiornamenti dell'app arrivano da soli, senza reinstallare. Serve **Chrome** sul dispositivo. Per costruire un APK tuo, vedi [`docs/TWA.md`](docs/TWA.md).

### Senza APK: l'app dal browser

Apri <https://book-companion-ruddy.vercel.app> in Chrome, poi dal menu ⋮ scegli **«Installa app»** (o «Aggiungi a schermata Home»). Funziona allo stesso modo, anche offline.

---

## Primi passi

1. **Libreria → Importa**: scegli i tuoi ePub, PDF o fumetti. Titolo, autore, copertina e saga si leggono dal file da soli.
2. **Tocca un libro** per la sua scheda (quarta di copertina, voto, cuore dei preferiti, saga e numero di lettura), poi **Apri il libro**.
3. **Impostazioni → Cosa sa fare l'app**: una mappa di tutte le funzioni, divise per luogo.

Tutto il resto è facoltativo e si configura in **Impostazioni**.

---

## Configurazione facoltativa

### Sincronizzazione fra dispositivi (Supabase)

Serve per avere gli stessi libri, punti di lettura, evidenziazioni e preferenze su più dispositivi.

1. Crea un progetto gratuito su <https://supabase.com>.
2. Nel **SQL Editor** del progetto esegui tutto [`supabase/schema.sql`](supabase/schema.sql). Rilancialo anche dopo ogni aggiornamento che aggiunge colonne: l'app te lo dice quando serve.
3. **Authentication → Sign In / Providers → Email**: spegni **«Confirm email»**, così si entra con email e password senza aspettare una mail.
4. **Project Settings → API**: copia «Project URL» e la chiave «anon public» nelle variabili `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (su Vercel: Settings → Environment Variables, poi Redeploy). I dettagli sono in [`.env.example`](.env.example).
5. Nell'app: **Impostazioni → Sincronizzazione**, registrati e entra.

### I file su Google Drive

I file dei libri e delle melodie possono stare sul tuo Google Drive: l'app li legge da lì senza riempire il tablet, e li porta giù solo quando lo chiedi.

1. Su <https://console.cloud.google.com> crea un progetto e abilita **Google Drive API** e **Google Picker API**.
2. **API e servizi → Credenziali → Crea credenziali → ID client OAuth**, tipo «Applicazione web». In «Origini JavaScript autorizzate» aggiungi l'indirizzo dell'app (`https://book-companion-ruddy.vercel.app`).
3. Sempre in Credenziali, crea una **Chiave API** (serve alla finestra «Scegli su Drive»).
4. Nell'app: **pannello della nuvola → Google Drive**, incolla l'ID client e la chiave API (oppure mettili in `VITE_GOOGLE_CLIENT_ID` e `VITE_GOOGLE_API_KEY`) e tocca **Collega Google Drive**.
5. Tieni i libri in una cartella **`book-companion`** sul Drive (con dentro `Libri`, `Fumetti`, `Manga`, `Musica` come preferisci): **Libreria → Scegli su Drive** apre lì.

L'accesso di Google dura un'ora: quando scade, l'app chiede un tocco per rinnovarlo.

### L'Oracolo

«Chi è costui?», «Dove eravamo rimasti», «Prima di cominciare» e la spiegazione dei passaggi usano l'API di Anthropic con **la tua chiave**, che resta sul dispositivo e non passa da nessun nostro server. Si incolla in **Impostazioni → Oracolo**, dove imposti anche il tetto di spesa del mese (5 $ di partenza).

---

## Sviluppo

Serve Node LTS.

```sh
npm install
npm run dev        # server di sviluppo
npm test           # test (Node; il test del tema vuole Playwright + Chromium)
npm run build      # build di produzione in dist/
```

- Codice in `src/`: `lib/` la logica (senza JSX, provata dai test), `components/` le schermate, `data/` le tavole.
- Regole di lavoro per chi scrive codice (persone o agenti): [`CLAUDE.md`](CLAUDE.md). Il perché di ogni scelta: [`docs/STORIA.md`](docs/STORIA.md).
- Il guscio Android: [`docs/TWA.md`](docs/TWA.md).

### Pubblicare un APK nuovo

Lo fa GitHub da solo (`.github/workflows/apk.yml`): a ogni merge su `main` che cambia il guscio (manifest, icone, `assetlinks.json`), o da **Actions → APK → Run workflow**, l'APK si costruisce, si firma con la chiave di sempre e compare fra le **Releases**. La chiave va messa una volta fra i segreti del repository: vedi [`docs/TWA.md`](docs/TWA.md), «L'APK che si pubblica da solo».

---

[Privacy](PRIVACY.md) · [Terze parti](TERZE-PARTI.md) · [Licenza](LICENSE)
