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

// LA PRIMA IMMAGINE DI UNA PAGINA. Serve alla terza strada, e sta fuori
// da tutto perche' e' l'unico pezzo che si puo' provare senza epub.js.
// `<img src>` degli XHTML normali, `<image xlink:href>` degli ePub che la
// copertina la mettono in un SVG a tutta pagina — e sono tanti.
export function primaImmagine(html) {
  const testo = String(html || "");
  const img = /<img\b[^>]*?\ssrc\s*=\s*["']([^"']+)["']/i.exec(testo);
  if (img) return img[1];
  const svg = /<image\b[^>]*?\s(?:xlink:)?href\s*=\s*["']([^"']+)["']/i.exec(testo);
  return svg ? svg[1] : null;
}

// Il percorso dell'immagine e' relativo al documento che la contiene.
export function risolviAccanto(percorsoDoc, rel) {
  const r = String(rel || "").trim();
  if (!r || /^(https?:|data:)/i.test(r)) return null;
  if (r.startsWith("/")) return r;
  const parti = String(percorsoDoc || "").split("/").slice(0, -1);
  for (const pezzo of r.split("/")) {
    if (pezzo === "." || pezzo === "") continue;
    if (pezzo === "..") parti.pop();
    else parti.push(pezzo);
  }
  return parti.join("/");
}

// quante pagine guardare in testa al libro: la copertina, se c'e', e' la
// prima o quasi. Piu' in la' si comincia a rischiare il logo dell'editore.
const IN_TESTA = 3;

// LA TERZA STRADA: LA PAGINA DI COPERTINA.
//
// Misurato in un browser vero su due ePub costruiti apposta: se il file
// non DICHIARA la copertina nei metadati, `loaded.cover` non torna niente
// e `coverUrl()` torna null — tutt'e due le strade di prima falliscono, e
// il libro entra col titolo giusto e nessuna copertina. Ma l'immagine c'e'
// eccome: sta nella prima pagina della spina, che e' proprio la copertina.
async function dallaPagina(eb) {
  await eb.loaded?.spine;
  const voci = (eb.spine?.items || []).slice(0, IN_TESTA);
  // chi si chiama «cover» ha la precedenza: e' la stessa pagina, ma detta
  const ordinate = [...voci].sort(
    (a, b) => Number(/cover|copert/i.test(b.href || "")) - Number(/cover|copert/i.test(a.href || ""))
  );
  for (const it of ordinate) {
    const percorso = it.canonical || it.url || it.href;
    if (!percorso || !eb.archive?.getText) continue;
    const html = await eb.archive.getText(percorso).catch(() => null);
    const src = primaImmagine(html);
    const dove = src && risolviAccanto(percorso, src);
    if (!dove) continue;
    const blob = await eb.archive.getBlob(dove).catch(() => null);
    if (blob) return blob;
  }
  return null;
}

// TRE STRADE PER UNA COPERTINA, e si provano in ordine. Ognuna nel suo
// `try`: prima stavano tutte insieme, e un errore nella prima si portava
// via anche le altre — in silenzio, lasciando il libro col titolo giusto e
// il dorso disegnato. E' quello che il lettore ha visto sull'Eresia.
//
// Sta staccata da epub.js apposta: prende un libro GIA' APERTO, quindi un
// test la chiama con un finto invece di tirarsi dietro un ePub vero.
export async function trovaCopertina(eb) {
  if (!eb) return null;
  // 1. i metadati la dichiarano: e' il caso normale
  try {
    const percorso = await eb.loaded?.cover;
    if (percorso && eb.archive) {
      const b = await eb.archive.getBlob(percorso);
      if (b) return b;
    }
  } catch {
    /* un archivio che tace non deve bloccare le altre strade */
  }
  // 2. il ripiego di epub.js, per chi la dichiara solo nel foglio
  try {
    const url = await eb.coverUrl?.();
    if (url) return await (await fetch(url)).blob();
  } catch {
    /* idem */
  }
  // 3. la pagina di copertina, per chi non la dichiara affatto
  try {
    return await dallaPagina(eb);
  } catch {
    return null;
  }
}

// Come sopra, ma chiude il libro: un ePub aperto e non chiuso resta in
// memoria anche quando la copertina non c'era.
export async function copertinaDaEpub(eb) {
  if (!eb) return null;
  try {
    return await trovaCopertina(eb);
  } finally {
    eb.destroy?.();
  }
}

// TORNARE INDIETRO VUOL DIRE RIMETTERE QUELLA DEL LIBRO, non restare senza.
//
// Cancellare la copertina scelta a mano lasciava il dorso disegnato anche
// sui libri che una copertina ce l'avevano: l'unica strada per riaverla era
// reimportare il romanzo. Ma quella copertina sta ancora dentro il file, e
// tirarla fuori e' lo stesso giro che fa l'import — e da quando e' lo
// STESSO giro (`trovaCopertina`), il tasto ↺ ritrova anche le copertine
// che solo la terza strada sa vedere.
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
    return await copertinaDaEpub(ePub(buf));
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
