import { getFile } from "./bookStore.js";
import { loadBooks, getProgress, getStatus } from "./library.js";

const safeName = (s) =>
  (s || "senza-titolo").replace(/[^\p{L}\p{N} _-]/gu, "").trim().slice(0, 60) || "senza-titolo";

export async function exportLibrary() {
  const { default: JSZip } = await import("jszip");
  const books = loadBooks();
  const zip = new JSZip();
  zip.file(
    "biblioteca.json",
    JSON.stringify(
      {
        app: "book-companion",
        exportedAt: new Date().toISOString(),
        books: books.map((b) => ({ ...b, progress: getProgress(b.id), status: getStatus(b.id) })),
      },
      null,
      2
    )
  );
  for (const b of books) {
    const blob = await getFile(b.id);
    if (blob) zip.file(`libri/${safeName(b.title)}-${b.id.slice(0, 8)}.${b.fileType}`, blob);
  }
  const out = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(out);
  const a = document.createElement("a");
  a.href = url;
  a.download = `book-companion-backup-${new Date().toISOString().slice(0, 10)}.zip`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return books.length;
}
