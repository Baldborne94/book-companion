import { putFile, putCover } from "./bookStore.js";

export async function importFiles(fileList) {
  const added = [];
  const errors = [];
  for (const file of Array.from(fileList)) {
    const lower = file.name.toLowerCase();
    const fileType = lower.endsWith(".epub") ? "epub" : lower.endsWith(".pdf") ? "pdf" : null;
    if (!fileType) {
      errors.push({ name: file.name, reason: "formato non supportato" });
      continue;
    }
    const id = crypto.randomUUID();
    try {
      await putFile(id, file);
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
      if (fileType === "epub") await enrichEpub(meta, file);
      else await enrichPdf(meta, file);
    } catch {
      /* estrazione fallita: il libro resta col filename come titolo */
    }
    added.push(meta);
  }
  return { added, errors };
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
