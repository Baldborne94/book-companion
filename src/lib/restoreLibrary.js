import { putFile, putCover, listFileIds } from "./bookStore.js";
import { loadBooks, saveBooks, setProgress, setStatus, touchBook, clearTombstones, setDates } from "./library.js";
import { setCfi, saveMarks, saveHighlights } from "./annotations.js";
import { setBookMusic } from "./music.js";

// Ripristinare non e' sovrascrivere: quello che c'e' gia' sul dispositivo
// e' presumibilmente piu' fresco dell'archivio e resta com'e'. Dall'archivio
// si prende cio' che manca — i libri spariti e i file mai scaricati.
export function planRestore({ archiveBooks = [], localBooks = [], localFileIds = new Set() }) {
  const known = new Set(localBooks.map((b) => b.id));
  const add = [];
  const fill = [];
  const kept = [];
  for (const b of archiveBooks) {
    if (!b?.id) continue;
    if (!known.has(b.id)) add.push(b);
    else {
      kept.push(b);
      if (!localFileIds.has(b.id)) fill.push(b);
    }
  }
  return { add, fill, kept };
}

const stripState = (b) => {
  const { progress, status, started, finished, cfi, marks, highlights, music, file, cover, ...meta } = b;
  return meta;
};

// gli archivi v1 non dichiaravano il percorso: si riconosce dal suffisso
const findFile = (zip, book) => {
  if (book.file && zip.file(book.file)) return zip.file(book.file);
  const tail = `-${book.id.slice(0, 8)}.${book.fileType || "epub"}`;
  return zip.file(new RegExp(`^libri/.*${tail.replace(/\./g, "\\.")}$`))[0] || null;
};

export async function restoreLibrary(archive, { onProgress } = {}) {
  const { default: JSZip } = await import("jszip");
  const say = (m) => onProgress?.(m);

  say("Apro l'archivio…");
  const zip = await JSZip.loadAsync(archive);
  const manifest = zip.file("biblioteca.json");
  if (!manifest) throw new Error("Non sembra un archivio di Book Companion");
  let data;
  try {
    data = JSON.parse(await manifest.async("string"));
  } catch {
    throw new Error("L'indice dell'archivio è illeggibile");
  }
  if (data?.app !== "book-companion" || !Array.isArray(data.books)) {
    throw new Error("Non sembra un archivio di Book Companion");
  }

  const localBooks = loadBooks();
  const localFileIds = new Set(await listFileIds().catch(() => []));
  const { add, fill, kept } = planRestore({ archiveBooks: data.books, localBooks, localFileIds });

  let restoredFiles = 0;
  const next = [...localBooks];

  for (const b of [...add, ...fill]) {
    say(`Ripristino «${b.title || "senza titolo"}»…`);
    const entry = findFile(zip, b);
    if (entry) {
      await putFile(b.id, await entry.async("blob"));
      restoredFiles++;
    }
    if (b.cover && zip.file(b.cover)) {
      await putCover(b.id, await zip.file(b.cover).async("blob"));
    }
  }

  for (const b of add) {
    next.push(stripState(b));
    setProgress(b.id, b.progress || 0);
    setStatus(b.id, b.status || "unread");
    if (b.started || b.finished) setDates(b.id, { started: b.started, finished: b.finished });
    if (b.cfi) setCfi(b.id, b.cfi);
    if (Array.isArray(b.marks) && b.marks.length) saveMarks(b.id, b.marks);
    if (Array.isArray(b.highlights) && b.highlights.length) saveHighlights(b.id, b.highlights);
    if (b.music) setBookMusic(b.id, b.music);
    touchBook(b.id);
  }

  if (add.length) saveBooks(next);
  // un libro cancellato ha lasciato una lapide: senza toglierla, la prima
  // sincronizzazione lo cancellerebbe di nuovo
  if (add.length) clearTombstones(add.map((b) => b.id));

  return {
    added: add.length,
    kept: kept.length,
    files: restoredFiles,
    books: loadBooks(),
    partial: data.version !== 2,
  };
}
