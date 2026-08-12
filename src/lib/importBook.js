import { putFile, putCover } from "./bookStore.js";
import { riconosci } from "./sagaBooks.js";

// oltre questa taglia il libro non si ricuce: tenere in memoria due
// copie dell'archivio, su un tablet, vale piu' di qualche pagina bianca
const TROPPO_GROSSO = 80 * 1024 * 1024;

export async function importFiles(fileList) {
  const added = [];
  const errors = [];
  let cuciti = 0;
  for (const file of Array.from(fileList)) {
    const lower = file.name.toLowerCase();
    const fileType = lower.endsWith(".epub") ? "epub" : lower.endsWith(".pdf") ? "pdf" : null;
    if (!fileType) {
      errors.push({ name: file.name, reason: "formato non supportato" });
      continue;
    }
    const id = crypto.randomUUID();
    // I PEZZI SI RICUCIONO ALL'INGRESSO. Un ePub spezzato in piu'
    // documenti lascia una facciata bianca a ogni giuntura, in mezzo a
    // una scena: qui il libro entra gia' intero. Si fa SOLO ora, perche'
    // cambia i CFI e su un libro gia' letto sposterebbe segnalibri,
    // evidenziazioni e punto di lettura.
    let daSalvare = file;
    if (fileType === "epub" && file.size <= TROPPO_GROSSO) {
      try {
        const { unisciPezzi } = await import("./unisciEpub.js");
        const cucito = await unisciPezzi(file);
        if (cucito?.blob) {
          daSalvare = cucito.blob;
          cuciti += cucito.cuciti;
        }
      } catch {
        /* libro che non si lascia ricucire: entra com'e', con le sue giunture */
      }
    }
    try {
      await putFile(id, daSalvare);
    } catch {
      errors.push({ name: file.name, reason: "salvataggio fallito" });
      continue;
    }
    const meta = {
      id,
      title: file.name.replace(/\.(epub|pdf)$/i, ""),
      author: "",
      series: "",
      fileType,
      addedAt: Date.now(),
      rating: 0,
      notes: "",
    };
    try {
      if (fileType === "epub") await enrichEpub(meta, daSalvare);
      else await enrichPdf(meta, file);
    } catch {
      /* estrazione fallita: il libro resta col filename come titolo */
    }
    // saga e numero d'ordine dal titolo, senza chiederli a mano: e' quello
    // che accende il glossario e fa funzionare il «prossimo della saga»
    const saga = riconosci({ title: meta.title, author: meta.author, fileName: file.name });
    if (saga) {
      meta.saga = saga.saga;
      if (saga.sagaOrder != null) meta.sagaOrder = saga.sagaOrder;
    }
    added.push(meta);
  }
  return { added, errors, cuciti };
}

async function enrichEpub(meta, file) {
  const { default: ePub } = await import("epubjs");
  const book = ePub(await file.arrayBuffer());
  try {
    const md = await book.loaded.metadata;
    if (md?.title?.trim()) meta.title = md.title.trim();
    if (md?.creator?.trim()) meta.author = md.creator.trim();
    let cover = null;
    const coverPath = await book.loaded.cover;
    if (coverPath && book.archive) cover = await book.archive.getBlob(coverPath);
    if (!cover) {
      const url = await book.coverUrl();
      if (url) cover = await (await fetch(url)).blob();
    }
    if (cover) await putCover(meta.id, cover);
  } finally {
    book.destroy();
  }
}

async function enrichPdf(meta, file) {
  const { renderPdfThumb } = await import("./pdfThumb.js");
  const thumb = await renderPdfThumb(await file.arrayBuffer());
  if (thumb) await putCover(meta.id, thumb);
}
