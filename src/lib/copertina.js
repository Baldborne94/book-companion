// LA COPERTINA SI PUO' METTERE A MANO. Titolo, autore, saga e genere si
// correggono nella scheda del libro; la copertina no — e se l'ePub non ne
// aveva una, quel dorso restava muto sullo scaffale per sempre.
//
// Una foto scelta dal rullino pero' e' un file da qualche megabyte, e una
// copertina si guarda grande sei centimetri: metterla dentro com'e'
// vorrebbe dire spendere in una miniatura piu' spazio che in un romanzo, e
// portarsela dietro in ogni archivio e in ogni sincronizzazione.

// il lato lungo di una copertina utile: sul tablet la scheda la mostra a
// 150px e la libreria molto meno, quindi 800 basta anche per uno schermo
// a densita' tripla
export const LATO = 800;

// La misura si tiene in un posto suo perche' e' l'unico pezzo che si puo'
// provare senza un canvas. Le proporzioni non si toccano MAI: una
// copertina schiacciata si nota subito, ed e' peggio di nessuna copertina.
// Un'immagine gia' piccola non si ingrandisce — ingrandirla non aggiunge
// dettaglio, aggiunge solo byte.
export function misura(w, h, max = LATO) {
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  const lato = Math.max(w, h);
  if (!Number.isFinite(max) || max <= 0 || lato <= max) return { w: Math.round(w), h: Math.round(h) };
  const k = max / lato;
  // mai zero: un lato arrotondato a zero darebbe un canvas che non disegna
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

// TORNARE INDIETRO VUOL DIRE RIMETTERE QUELLA DEL LIBRO, non restare senza.
//
// Cancellare la copertina scelta a mano lasciava il dorso disegnato anche
// sui libri che una copertina ce l'avevano: l'unica strada per riaverla era
// reimportare il romanzo. Ma quella copertina sta ancora dentro il file, e
// tirarla fuori e' lo stesso giro che fa l'import.
//
// Torna il blob, o `null` se il libro una copertina non ce l'ha davvero —
// e allora il dorso disegnato E' lo stato di partenza. Chi chiama deve
// pero' avere i byte in mano: senza file non si guarda, e cancellare la
// copertina buona per un libro rimasto nel cloud sarebbe il danno peggiore.
export async function copertinaOriginale(book, bytes) {
  if (!bytes) return null;
  try {
    const buf = await bytes.arrayBuffer();
    if (book?.fileType === "pdf") {
      const { renderPdfThumb } = await import("./pdfThumb.js");
      return (await renderPdfThumb(buf)) || null;
    }
    const { default: ePub } = await import("epubjs");
    const eb = ePub(buf);
    try {
      const percorso = await eb.loaded.cover;
      if (percorso && eb.archive) {
        const b = await eb.archive.getBlob(percorso);
        if (b) return b;
      }
      const url = await eb.coverUrl();
      return url ? await (await fetch(url)).blob() : null;
    } finally {
      eb.destroy();
    }
  } catch {
    return null;
  }
}

const IMMAGINE = /^image\//;

// Torna il blob da salvare. Se qualcosa non funziona — formato che il
// browser non decodifica, canvas negato — si tiene il file ORIGINALE:
// una copertina pesante e' meglio di nessuna copertina, che e' il difetto
// che stiamo curando.
export async function preparaCopertina(file, max = LATO) {
  if (!file) return null;
  if (!IMMAGINE.test(file.type || "")) return null;
  try {
    const bitmap = await createImageBitmap(file);
    const m = misura(bitmap.width, bitmap.height, max);
    if (!m) return file;
    if (m.w === bitmap.width && m.h === bitmap.height && file.size < 400 * 1024) {
      bitmap.close?.();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = m.w;
    canvas.height = m.h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0, m.w, m.h);
    bitmap.close?.();
    const blob = await new Promise((ok) => canvas.toBlob(ok, "image/jpeg", 0.85));
    return blob || file;
  } catch {
    return file;
  }
}
