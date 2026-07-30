# 📖✨ Book Companion — Piano di lavoro "Biblioteca Magica"

> **Per la sessione Claude Code che riceve questo file**: questo è il piano operativo del progetto `Baldborne94/book-companion`. Leggilo per intero prima di scrivere codice. Segui le fasi in ordine; ogni fase è un PR autonomo. Le sezioni "Lezioni da wh-companion" e "Convenzioni" sono vincolanti.

---

## 1. Contesto e obiettivo

App PWA per la biblioteca personale dell'utente: carica i **suoi** EPUB/PDF, li ritrova in una libreria con copertine, li legge in un reader curato ("meglio del Kindle"), con musica YouTube di sottofondo che continua mentre legge.

È il progetto gemello di `Baldborne94/wh-companion` (stessa architettura: React 18 + Vite 5 SPA, stili inline, niente router, niente librerie UI). Differenza chiave: **nessun catalogo predefinito** — i libri esistono solo quando l'utente li carica, e i metadati (titolo, autore, copertina) si estraggono dal file.

**Scope di questa milestone (deciso dall'utente):** Libreria + Reader + Player **solo YouTube**. Niente Spotify (vedi §6), niente Supabase/login per ora: tutto **local-first** (IndexedDB + localStorage). Sync cloud, statistiche e i18n verranno dopo.

**Dispositivo principale dell'utente: tablet Android.** La strada scelta è PWA installata da Chrome (niente APK per ora): su Android una PWA installata ha schermo intero, storage persistente e offline completo. Se un domani servissero vantaggi nativi (audio a schermo spento, "Apri con" per gli EPUB), si aggiunge una fase dedicata TWA/Capacitor **senza riscrivere nulla** — la decisione non è irreversibile.

## 2. Stato del repo

Scaffold Fase 0 completato (shell con nav Ingresso/Libreria/Musica, `src/data/constants.js`, manifest PWA, UI in italiano). Struttura: `src/lib/` per storage/import/export (senza JSX, testabile), `src/components/` per le sezioni UI, import lazy di `epubjs`/`pdfjs-dist`/`jszip` (chunk separati). Le sessioni successive partono dalla prima fase non spuntata in fondo a questo file.

## 3. Direzione visiva — "Biblioteca Magica" 🕯️

L'app deve **rilassare** e far sentire in un regno magico: una biblioteca antica di notte, candele, legno scuro, pergamena, un accenno di magia. Calma, mai carnevalesca: la magia è nella luce e nei dettagli, non negli effetti vistosi.

### Palette (in `src/data/constants.js`)

```js
export const C = {
  bg:      "#0f0d1a",  // notte profonda, blu-viola quasi nero
  surface: "#151226",  // pannelli
  card:    "#1c1730",  // card libri
  border:  "#332a4f",  // bordi violacei tenui
  accent:  "#d9a94e",  // oro di candela — CTA, titoli, stati attivi
  arcane:  "#9b7fd4",  // viola arcano — dettagli magici, badge, glow
  text:    "#e2dac9",  // pergamena chiara
  muted:   "#948aad",  // testo secondario, lavanda spenta
  dim:     "#3a3354",
  green:   "#5fae7e",  // "letto"
  red:     "#b25050",
};
```

### Tipografia

- Titoli/header: **Cormorant Garamond** (600/700) — elegante, da tomo antico.
- UI e corpo: **EB Garamond**, Georgia di sistema come fallback.
- Google Fonts importati una volta in `index.css`. NB: questi font valgono per la **UI**; dentro il reader l'utente sceglie i suoi (vedi Fase C).

### Motivi e atmosfera

- **Header**: titolo con leggero `text-shadow` dorato (bagliore di candela), icona 🕯️ con flicker lento.
- **Sfondo**: gradiente radiale molto tenue (violaceo che si scurisce verso i bordi, come luce di lanterna al centro).
- **Polvere di stelle**: ~20 particelle ✦ minuscole che salgono lentissime con opacità 0→0.5→0 (CSS keyframes, `position:fixed`, `pointer-events:none`).
- **Card libri**: copertina con bordo dorato sottile al hover/focus + glow `box-shadow` arcano leggero; transizioni 200–300ms `ease-out`.
- **Scaffale**: le copertine poggiano su una sottile "mensola" (bordo inferiore sfumato legno/oro) — la libreria deve sembrare uno scaffale, non una griglia di e-commerce.
- **Empty state** evocativi (🔮/📜, "Il tuo grimorio è ancora vuoto…").
- **Rispetta `prefers-reduced-motion`**: con motion ridotta, niente particelle né animazioni, solo dissolvenze.
- Tutte le animazioni su `opacity`/`transform` soltanto (mai layout), come da lezione wh-companion sul flicker.

## 4. Fasi

### Fase A — Tema "Biblioteca Magica" (PR piccolo) ✅

Applicata la direzione visiva di §3 a tutta la shell: palette in `constants.js`, font, gradiente di sfondo, particelle, header con flicker di candela, empty state evocativi nelle tre sezioni, `prefers-reduced-motion` rispettato. `npm run build` verde.

### Fase B — La Libreria (il cuore local-first) ✅

Dipendenze: `epubjs` (metadati + reader poi), `pdfjs-dist` (thumbnail + reader poi).

1. **Storage** (`src/lib/`):
   - `bookStore.js` — IndexedDB (due object store: `files` per i bytes, chiave = id libro; `meta` opzionale se non si usa localStorage). Id libro: `crypto.randomUUID()`.
   - Metadati in localStorage (`bc_books`): `{ id, title, author, series?, fileType: "epub"|"pdf", addedAt, rating?, notes? }`.
   - Progresso/stato separati per libro (`bc_prog_<id>`, `bc_status_<id>`) — progresso **sempre frazione 0–1**.
   - **Protezione dati (vincolante)**: all'avvio chiamare `navigator.storage.persist()` (chiede al browser di non evacuare mai IndexedDB); mostrare lo spazio usato via `navigator.storage.estimate()` nella Libreria; bottone **"Esporta biblioteca"** che scarica un backup (i file + JSON con metadati, note, valutazioni, progressi). Finché non c'è Supabase, l'export è l'unica assicurazione contro la perdita della biblioteca.
2. **Import**: file picker (`accept=".epub,.pdf"`, **`multiple`** — la migrazione della collezione esistente non va fatta un libro alla volta) + drag&drop su desktop. All'import:
   - EPUB → `ePub(arrayBuffer)` → `book.loaded.metadata` (titolo, autore) + `book.coverUrl()` → copertina salvata come **blob in IndexedDB** (mai object URL persistito).
   - PDF → prima pagina renderizzata su canvas via pdf.js → thumbnail JPEG in IndexedDB; titolo dal filename, modificabile. ⚠️ Con Vite il worker di pdf.js va importato con `pdfjs-dist/build/pdf.worker.min.mjs?url` e assegnato a `GlobalWorkerOptions.workerSrc`, o il rendering fallisce silenziosamente in build.
   - Fallimento estrazione → il libro si aggiunge comunque col filename come titolo.
3. **UI Libreria**: scaffale con copertine (§3), ricerca per titolo/autore, filtro stato (Tutti / Da leggere / In lettura / Letti), badge % sui libri in lettura, ordinamento (aggiunto di recente / titolo / autore).
4. **Scheda libro** (tap sulla copertina): copertina grande, titolo/autore/serie **modificabili**, valutazione ★, note personali, stato, bottone dorato "Apri il libro", elimina (con conferma — cancella anche i bytes da IndexedDB).
5. **Home**: "Continua a leggere" (ultimo libro aperto, % e bottone riprendi) + "Aggiunti di recente". Se vuoto → empty state evocativo che porta alla Libreria.

Criteri: import di un EPUB reale mostra copertina e metadati corretti; ricarico la pagina e c'è ancora tutto; funziona offline; `navigator.storage.persist()` richiesto; export scarica un backup completo.

### Fase C — Il Reader (EPUB ✅, PDF ☐)

Reader **montato in App.jsx sopra tutto** (position:fixed, z-index alto), lazy-loaded, mai dentro la Libreria (lezione wh-companion: un solo mount point). Il player musica resta montato sotto.

**EPUB (epub.js):**
- Temi pagina: Notte (default, coerente col tema app), Seppia/pergamena, Carta chiara, Nero OLED.
- Tipografia: famiglia font (3–4 scelte + "originale del libro"), dimensione, interlinea, margini. ⚠️ Applicare agli **elementi** (`p`, `div`, ecc. via `Contents.addStylesheetCss`), NON solo a `body` — i CSS del libro vincono sull'ereditarietà (lezione imparata due volte su wh-companion).
- Paginato ↔ scorrimento; **due pagine** su schermi larghi: la decisione la prende SOLO l'evento `layout` di epub.js (`divisor > 1`), mai misure proprie.
- Riprendi posizione: CFI in localStorage, scrittura debounced 1500ms **con flush sincrono alla chiusura**, retry del display dopo `book.ready`.
- Segnalibri multipli (pannello 📑 + "Salva qui"), TOC, ricerca nel libro, evidenziazioni con colori.
- Chrome immersivo: tap al centro mostra/nasconde header/footer; su touch si parte immersivi; margini laterali = zone di cambio pagina.
- Filtro notte caldo (`mix-blend-mode: multiply`) + slider luminosità.
- Auto-segna "letto": `onFinish` a fine libro + soglia ≥97% alla chiusura (endmatter).
- Tocco magico: transizione di apertura dolce (dissolvenza dorata breve) — mai animazioni durante la lettura.
- Default da dispositivo: telefono → pagina singola (short side < ~520px), preferenze salvate SEMPRE sopra i default derivati. Defaults/persistenza in `src/lib/readerSettings.js` (testabile senza epub.js).

**PDF (pdf.js):** visualizzazione pagina, contatore "n / tot", zoom, progresso = `page/total` (frazione!), filtro notte condiviso.

Criteri: chiudo a pagina X → riapro esattamente a pagina X; le impostazioni sopravvivono al riavvio; un EPUB con CSS propri rispetta il font scelto.

### Fase C3 — Il giardino delle citazioni (PR piccolo, dopo C-EPUB) ✅

Vista che raccoglie **tutte le evidenziazioni di tutti i libri** in un unico posto: il "libro dei libri", su tema pergamena, raggruppato per libro, con salto al punto esatto nel reader. È la risposta ai clippings scomodi del Kindle. Dati già presenti dalla Fase C (evidenziazioni per libro): questa fase è solo la vista aggregata + navigazione.

### Fase D — Il Player (solo YouTube) ✅

Modello wh-companion, già collaudato:
- `MusicPlayer.jsx` **sempre montato** in App (mai smontato o la musica si ferma; z-index sotto al contenuto, sopra solo nella sezione Musica), `forwardRef` con `stop()/pause()/resume()`.
- Embed `youtube-nocookie.com` con `?autoplay=1&enablejsapi=1`; pausa/ripresa via `postMessage`.
- Sezione Musica: incolla link YouTube (video o playlist) → play; **preferiti** salvati in localStorage con nome personalizzato ("Pioggia e camino", "Arpa celtica"...) resi come card a tema magico.
- **Mini-player** nella barra quando si naviga altrove; **controlli nel header del reader** (⏸/▶ e ✕) — leggere con musica è il caso d'uso principale.
- **Legame libro↔musica**: ricordare per ogni libro l'ultima musica ascoltata (`bc_music_<id>` in localStorage); all'apertura del libro, proporre "Riprendi *Pioggia e camino*?". Una riga di storage, il tocco più magico dell'app.
- **Sleep timer**: spegni la musica tra 15/30/60 minuti (leggere a letto è il caso d'uso reale).
- Niente OAuth/API key per ora: solo embed → zero configurazione.
- **Aspettativa onesta (Android)**: l'embed suona finché l'app è aperta e lo schermo acceso; a schermo bloccato o app in background l'audio può fermarsi — limite degli iframe, non un bug. Il caso d'uso principale (musica mentre leggi nell'app) funziona.

Criteri: la musica non si interrompe navigando tra sezioni né aprendo/chiudendo il reader; pausa dal reader funziona; riaprendo un libro viene proposta la sua musica.

### Fase E — PWA + deploy

- `vite-plugin-pwa` in modalità **`prompt`** (MAI autoUpdate: ricarica la pagina mentre leggi), `skipWaiting`/`clientsClaim` **false**, precache di **tutti** i chunk JS, toast "nuova versione" mai mostrato a reader aperto, update applicato al passaggio in background.
- Icone PWA a tema (libro + stella, sfondo `#0f0d1a`), installabile su telefono/tablet.
- Deploy su Vercel, auto-deploy su `main`.
- **Priorità alta per l'utente**: il tablet Android è il dispositivo principale — installare presto la PWA è anche il test reale dell'app (e su Android l'installazione garantisce lo storage persistente).

### Dopo (fuori scope, non iniziare): Supabase sync multi-dispositivo, statistiche di lettura, obiettivi, i18n EN, suite E2E Playwright (riusare l'harness di wh-companion), eventuale wrap TWA/Capacitor per APK (audio a schermo spento, "Apri con" per EPUB).

## 5. Ordine e granularità

A → B → C(EPUB) → C3 → D → C(PDF) → E. Un PR per fase (C può dividersi in C1 EPUB / C2 PDF). Dopo B l'app è già utile; dopo C-EPUB è già "la mia app di lettura"; D la rende speciale.

## 6. Nota Spotify (decisione: escluso)

Su wh-companion l'embed Spotify dava problemi: il controllo `postMessage` dell'iframe è inaffidabile (pausa che non risponde) e l'embed riproduce comunque solo anteprime/shuffle limitato senza sessione premium attiva nel contesto giusto. La soluzione "vera" esiste ma è costosa: **Spotify Web Playback SDK** — richiede account **Premium**, OAuth con refresh token, e DRM del browser (niente iOS/PWA affidabile). Verdetto: non vale la complessità ora. YouTube copre tutto (playlist ambience, ore di musica da lettura). Se un domani servisse, si aggiunge come fase dedicata dietro flag.

## 7. Lezioni da wh-companion (vincolanti — NON re-impararle)

1. Tipografia reader sugli **elementi** del capitolo, mai solo su `body`.
2. Doppia pagina: unica fonte di verità = evento `layout` di epub.js. Mai misurare da soli.
3. Progresso **sempre 0–1**. Mai scrivere 0–100 nello stesso store.
4. `MusicPlayer` mai smontato. Reader sopra, player sotto.
5. `navigator.onLine` mente (true su LAN senza internet) → sempre fallback su cache/IndexedDB.
6. Service worker `prompt`, mai reload automatico durante la lettura.
7. CFI: flush sincrono alla chiusura o la posizione si perde nel debounce.
8. Default derivati dal dispositivo si fondono **sotto** le preferenze salvate, mai sopra.
9. Animazioni solo `opacity`/`transform` (lo scale/layout fa flickerare).
10. Blob/copertine: persistere i **bytes**, mai gli object URL.

## 8. Convenzioni

- `npm run build` **sempre verde prima di ogni commit**.
- Branch `claude/*` → PR draft → **squash merge** su `main`; dopo lo squash, `git rebase origin/main` prima del push successivo.
- Stili 100% inline JSX (le keyframes CSS globali in `index.css` sono l'unica eccezione). Nessuna libreria UI. Stato locale `useState`/`useEffect`.
- UI in **italiano**. Niente commenti nel codice salvo WHY non ovvi.
- Aggiorna `CLAUDE.md` del repo quando una fase introduce architettura nuova (il file tramanda le lezioni di §7 — se manca, crealo con quel contenuto).

## 9. Come usare questo file

A ogni fase completata, spunta qui lo stato (✅) così le sessioni successive sanno dove siamo.

Stato fasi: A ✅ · B ✅ · C-EPUB ✅ · C3 ✅ · C-PDF ☐ · D ✅ · E ☐
