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
  return { libri: books.length, melodie: melodieConByte };
}
