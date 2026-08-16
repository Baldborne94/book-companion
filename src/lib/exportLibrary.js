import { getFile, getCover } from "./bookStore.js";
import { loadBooks, getProgress, getStatus, getStarted, getFinished } from "./library.js";
import { getCfi, getMarks, getHighlights } from "./annotations.js";
import { getBookMusic, getFavoritesRaw, getListsRaw, isFile, loadTrack } from "./music.js";

// v1 conteneva solo metadati e file: un ripristino avrebbe perso segnalibri,
// evidenziazioni e punto di lettura. Da v2 l'archivio si basta da solo.
// Da v3 porta anche le melodie: da quando la musica di sottofondo puo'
// essere un file tuo, quei byte esistono solo qui dentro e in IndexedDB —
// un archivio che li lasciasse fuori non sarebbe piu' un archivio completo.
export const ARCHIVE_VERSION = 3;

// DA QUANTO NON FAI UN ARCHIVIO.
//
// L'avviso sulla persistenza dice uno STATO («il browser può liberare
// questi dati»); non dice da quanto tempo non c'e' una copia al sicuro. Se
// il browser ha negato la persistenza e il tuo ultimo zip e' di marzo,
// l'app lo sa e non te lo diceva. Qui il conto si tiene, e la riga esce
// accanto al tasto che risolve — che e' «Esporta biblioteca».
const ULTIMO_KEY = "bc_last_export";
const GIORNO = 86400000;

export function ultimoArchivio() {
  const v = parseInt(localStorage.getItem(ULTIMO_KEY), 10);
  return Number.isFinite(v) ? v : 0;
}

// «4 mesi fa» dice quello che «118 giorni fa» non dice: che e' tanto.
export function daQuanto(giorni) {
  if (giorni < 14) return `${Math.floor(giorni)} giorni fa`;
  if (giorni < 30) return `${Math.floor(giorni / 7)} settimane fa`;
  const mesi = Math.floor(giorni / 30.4);
  if (mesi <= 1) return "un mese fa";
  if (mesi < 12) return `${mesi} mesi fa`;
  const anni = Math.floor(giorni / 365);
  return anni <= 1 ? "più di un anno fa" : `più di ${anni} anni fa`;
}

// Il promemoria non e' un assillo: sotto la soglia tace del tutto. La
// soglia pero' e' DUE, e la seconda e' la ragione per cui tutto questo
// esiste — a persistenza negata i byte stanno in una memoria che il
// browser puo' sfrattare, e un mese di silenzio e' troppo.
export function promemoriaArchivio({ ultimo = 0, ora = Date.now(), roba = 0, persistenza = "sconosciuta" } = {}) {
  // una biblioteca vuota non ha niente da perdere
  if (!roba) return null;
  if (!ultimo) return "Non hai mai fatto un archivio di questa biblioteca.";
  const giorni = (ora - ultimo) / GIORNO;
  if (giorni < (persistenza === "negata" ? 7 : 30)) return null;
  return `L'ultimo archivio è di ${daQuanto(giorni)}.`;
}

const safeName = (s) =>
  (s || "senza-titolo").replace(/[^\p{L}\p{N} _-]/gu, "").trim().slice(0, 60) || "senza-titolo";

export async function exportLibrary() {
  const { default: JSZip } = await import("jszip");
  const books = loadBooks();
  const zip = new JSZip();
  const manifest = [];

  for (const b of books) {
    const entry = {
      ...b,
      progress: getProgress(b.id),
      status: getStatus(b.id),
      started: getStarted(b.id),
      finished: getFinished(b.id),
      cfi: getCfi(b.id),
      marks: getMarks(b.id),
      highlights: getHighlights(b.id),
      music: getBookMusic(b.id),
    };
    const blob = await getFile(b.id);
    if (blob) {
      entry.file = `libri/${safeName(b.title)}-${b.id.slice(0, 8)}.${b.fileType}`;
      zip.file(entry.file, blob);
    }
    const cover = await getCover(b.id);
    if (cover) {
      entry.cover = `copertine/${b.id}.bin`;
      zip.file(entry.cover, cover);
    }
    manifest.push(entry);
  }

  const melodie = [];
  let melodieConByte = 0;
  for (const f of getFavoritesRaw()) {
    const voce = { ...f };
    if (isFile(f) && !f.deleted) {
      const blob = await loadTrack(f.trackId).catch(() => null);
      if (blob) {
        voce.track = `melodie/${f.trackId}.bin`;
        zip.file(voce.track, blob);
        melodieConByte++;
      }
    }
    melodie.push(voce);
  }

  zip.file(
    "biblioteca.json",
    JSON.stringify(
      {
        app: "book-companion",
        version: ARCHIVE_VERSION,
        exportedAt: new Date().toISOString(),
        books: manifest,
        melodie,
        raccolte: getListsRaw(),
      },
      null,
      2
    )
  );

  const out = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(out);
  const a = document.createElement("a");
  a.href = url;
  a.download = `book-companion-backup-${new Date().toISOString().slice(0, 10)}.zip`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  // La data si segna qui, che e' il piu' in la' dove arriviamo: dove il
  // file sia andato a finire dopo il click il browser non ce lo dice, e
  // fingere di saperlo sarebbe peggio che segnare il tentativo.
  localStorage.setItem(ULTIMO_KEY, String(Date.now()));
  return { libri: books.length, melodie: melodieConByte };
}
