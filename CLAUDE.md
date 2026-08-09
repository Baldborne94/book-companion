# Book Companion

App PWA local-first per la biblioteca personale: EPUB/PDF caricati dall'utente, reader curato, musica YouTube di sottofondo. Tema "Biblioteca Magica" (notte, candele, pergamena). Dispositivo principale: tablet Android (PWA installata, niente APK).

**Il piano operativo completo è in `docs/PIANO.md` — leggilo prima di scrivere codice.** Lo stato delle fasi è in fondo a quel file.

## Architettura

- React 18 + Vite 5 SPA. Niente router: sezione attiva via `useState` in `App.jsx`.
- Stili 100% inline JSX; `src/index.css` contiene solo reset, font Google, keyframes globali e le regole `.textLayer` di pdf.js (span generati dalla libreria, non stilabili inline).
- Nessuna libreria UI. Stato locale `useState`/`useEffect`.
- Palette e costanti condivise in `src/data/constants.js` (oggetto `C`).
- UI in italiano. Niente commenti nel codice salvo WHY non ovvi.
- Storage: bytes dei libri in IndexedDB, metadati/progressi in localStorage (prefisso `bc_`). Progresso sempre frazione 0–1.
- `src/lib/`: moduli senza JSX (bookStore = IndexedDB con store files/covers/aux/tracks, library = localStorage, importBook, exportLibrary/restoreLibrary, pdfThumb, saga, diary, viewport/greeting, readerSettings, annotations, epubSearch, pdfSearch, pdfHighlights, glossary, sagaBooks = riconosce saga e numero d'ordine dal titolo/filename all'import, oracle = spiegazione contestuale via API Anthropic con chiave utente in `bc_ai_key`, mai su un nostro server). `src/components/`: sezioni e overlay UI. `epubjs`/`pdfjs-dist`/`jszip` importati solo lazy (chunk separati). Worker pdf.js via `?url` in `pdfThumb.js`.
- Musica: `MusicPlayer.jsx` sempre montato in App (`forwardRef` play/pause/resume/stop/setSleep, mini-player); UI sezione in `MusicRoom.jsx`; preferiti/legame libro in `lib/music.js` (`bc_music_favs`, `bc_music_<bookId>`). **Due sorgenti in un solo elenco, e la riga che le divide e' CHI SUONA**: `trackId` = file dell'utente (byte nello store `tracks`), suonato da un `<audio>` in cima alla pagina; `url` = YouTube, iframe youtube-nocookie invisibile. Solo il file regge lo schermo spento, e non e' un limite della PWA: il lettore di YouTube si mette in pausa da solo in secondo piano e non e' nostro (e non lo sarebbe nemmeno dentro un guscio Android, dove a schermo spento la pagina e' in secondo piano lo stesso). Le tracce entrano nell'archivio (`ARCHIVE_VERSION` 3, cartella `melodie/`): quei byte non stanno da nessun'altra parte. **Raccolte** in `bc_music_lists`: nome piu' elenco di ID di melodie, mai le melodie stesse (`braniDi` salta gli id spariti); stessa forma dei preferiti, quindi la sincronizzazione le fonde con `mergeFavorites` e viaggiano nella colonna `music_lists` di `prefs`. **Volume in app** in `bc_music_vol` (0–1, default 1): sta fuori dalle preferenze sincronizzate perche' e' del dispositivo, e si applica a tutt'e due le sorgenti da un solo punto (`applicaVolume`: `<audio>.volume` 0–1, YouTube `setVolume` 0–100). Timer del sonno sempre sull'orologio da muro, mai su `setTimeout` (in background i browser lo congelano): una sola ronda a ritmo variabile (15 s da lontano, 400 ms negli ultimi 30 s) ferma la musica e ne cura la **dissolvenza** finale. Il volume vero e' `scelto × dissolvenza`, due valori distinti che si moltiplicano — se la dissolvenza riscrivesse il volume scelto, allo scadere del timer resterebbe salvato zero.
- Reader: `components/Reader.jsx` (EPUB) e `components/PdfReader.jsx` (PDF con livello testo pdf.js: selezione, dizionario, evidenziazioni, ricerca nel testo, segnalibri per pagina, indice del documento; progresso = pagina/totale in `bc_cfi_<id>` come numero). Scheda dizionario (`components/DictionaryCard.jsx`) ed elenco evidenziazioni (`components/HighlightList.jsx`) condivisi fra i due reader, lazy, montati SOLO in App.jsx (position:fixed z-45). CFI in `bc_cfi_<id>`, segnalibri `bc_marks_<id>`, evidenziazioni `bc_hl_<id>` (nei PDF il `cfi` è il numero di pagina e i `rects` sono frazioni 0–1 della pagina, così reggono zoom e schermi diversi), locations epub.js cachate in IndexedDB aux (`loc_<id>`). Impostazioni condivise in `bc_reader` via `readerSettings.js` (default derivati dal device fusi SOTTO le preferenze). Glossario di saga (`lib/glossary.js`): i termini si segnano con le **annotazioni** di epub.js, mai avvolgendo il testo in `<span>` (cambierebbe i percorsi dei CFI e sposterebbe segnalibri ed evidenziazioni salvati); il tocco però riconosce la parola sotto il dito con `caretRangeFromPoint`, e il callback dell'annotazione resta vuoto — col dito epub.js lo chiama al `touchstart` e il `click` che segue richiuderebbe subito la scheda appena aperta. **La misura del riquadro di lettura non cambia mai a runtime**: le barre compaiono sopra i margini `HEAD`/`FOOT` riservati (EPUB) e sopra la fascia libera del contenitore (PDF). Restringere il libro fa reimpaginare epub.js, e ogni reimpaginazione sposta il testo sotto le dita. Se un ricalcolo serve davvero (cambio margine), passa il CFI dell'ultima pagina scelta dal lettore a `rendition.resize(w, h, cfi)`: col CFI corrente si arretra di mezza pagina a ogni giro.

- Sync (opzionale): Supabase local-first — client lazy in `lib/supabase.js` (attivo solo con `VITE_SUPABASE_*`), motore in `lib/sync.js`, logica pura di merge in `lib/syncCore.js` (last-write-wins via `bc_upd_<id>`, lapidi `bc_tombs`, prefs `bc_prefs_upd`). File nel bucket privato `books`, download on-demand via `ensureLocalFile` nei reader. Schema/RLS in `supabase/schema.sql`. Senza chiavi l'app resta identica al local-first.
- PWA: `vite-plugin-pwa` in modalità `prompt` (mai autoUpdate), `skipWaiting`/`clientsClaim` false, precache di tutti i chunk (limite 4 MiB per il worker pdf.js), runtime cache per i Google Fonts. Banner "nuova versione" MAI a reader aperto; update auto al passaggio in background solo se non si sta leggendo (`registerSW` in App.jsx).

## Convenzioni di lavoro

- `npm run build` sempre verde prima di ogni commit.
- Branch `claude/*` → PR draft → squash merge su `main`; dopo lo squash, `git rebase origin/main` prima del push successivo.
- Un PR per fase del piano.

## Lezioni da wh-companion (vincolanti — NON re-impararle)

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
