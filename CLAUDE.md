# Book Companion

App PWA local-first per la biblioteca personale: EPUB/PDF caricati dall'utente, reader curato, musica YouTube di sottofondo. Tema "Biblioteca Magica" (notte, candele, pergamena). Dispositivo principale: tablet Android (PWA installata, niente APK).

**Il piano operativo completo è in `docs/PIANO.md` — leggilo prima di scrivere codice.** Lo stato delle fasi è in fondo a quel file.

## Architettura

- React 18 + Vite 5 SPA. Niente router: sezione attiva via `useState` in `App.jsx`.
- Stili 100% inline JSX; `src/index.css` contiene solo reset, font Google e keyframes globali.
- Nessuna libreria UI. Stato locale `useState`/`useEffect`.
- Palette e costanti condivise in `src/data/constants.js` (oggetto `C`).
- UI in italiano. Niente commenti nel codice salvo WHY non ovvi.
- Storage: bytes dei libri in IndexedDB, metadati/progressi in localStorage (prefisso `bc_`). Progresso sempre frazione 0–1.
- `src/lib/`: moduli senza JSX (bookStore = IndexedDB con store files/covers/aux, library = localStorage, importBook, exportLibrary, pdfThumb, readerSettings, annotations, epubSearch). `src/components/`: sezioni e overlay UI. `epubjs`/`pdfjs-dist`/`jszip` importati solo lazy (chunk separati). Worker pdf.js via `?url` in `pdfThumb.js`.
- Musica: `MusicPlayer.jsx` sempre montato in App (iframe youtube-nocookie invisibile + mini-player, `forwardRef` play/pause/resume/stop/setSleep); UI sezione in `MusicRoom.jsx`; parsing/preferiti/legame libro in `lib/music.js` (`bc_music_favs`, `bc_music_<bookId>`).
- Reader: `components/Reader.jsx` (EPUB) e `components/PdfReader.jsx` (PDF, progresso = pagina/totale in `bc_cfi_<id>` come numero), lazy, montati SOLO in App.jsx (position:fixed z-45). CFI in `bc_cfi_<id>`, segnalibri `bc_marks_<id>`, evidenziazioni `bc_hl_<id>`, locations epub.js cachate in IndexedDB aux (`loc_<id>`). Impostazioni condivise in `bc_reader` via `readerSettings.js` (default derivati dal device fusi SOTTO le preferenze).

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
