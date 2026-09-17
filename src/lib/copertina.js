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

// LE COPERTINE CHE MANCANO SI RITROVANO NEL FILE CHE HAI GIA'.
//
// Segnalato con lo scaffale in mano: «perche' da tablet non vedo le
// copertine». Un dorso disegnato vuol dire una cosa sola — in IndexedDB
// quell'immagine non c'e' — e le strade per cui e' sparita sono tre, che
// portano tutte allo stesso posto: l'estrazione all'import non l'ha
// trovata, la memoria del browser e' stata sfrattata, o non e' mai tornata
// giu' dal cloud perche' scendeva solo dentro `pull`. E lassu' spesso non
// c'e' nemmeno: il giro delle copertine sta DOPO quello dei file, e il
// `throw` del tomo troppo grande lo uccideva prima che ci arrivasse.
//
// Ma il file ce l'hai qui, e la copertina sta dentro di lui: e' lo stesso
// giro del tasto ↺ della scheda, fatto su tutta la biblioteca invece che
// un libro per volta.
//
// `conCopertina` arriva da fuori come un INSIEME e non come una domanda
// per libro: le copertine di casa si chiedono in un colpo solo
// (`listCoverIds`), o sarebbe una transazione IndexedDB per ogni tomo.
// `giaGuardati` sono i tomi che abbiamo gia' aperto e che dentro
// un'immagine non ce l'hanno: senza quella memoria il tasto continuerebbe a
// offrire «ritrova una copertina» per sempre su un libro che non ce l'ha —
// cioe' un tasto che promette quel che non puo' dare, che e' lo stesso
// difetto di «Porta qui i tomi» con dentro i perduti.
//
// Limite dichiarato: il segno e' per ID, non per byte. Sostituito il file a
// mano, il tasto non lo ripropone — ma il ↺ della scheda c'e' sempre, e un
// file che entra dall'import la copertina se la fa estrarre da solo.
export const senzaCopertina = (libri, conCopertina, giaGuardati) =>
  (libri || []).filter(
    (b) => b?.id && !(conCopertina && conCopertina.has(b.id)) && !(giaGuardati && giaGuardati.has(b.id))
  );

export async function ritrovaCopertine(libri, { leggiByte, estrai, posa, segnaGuardato, onProgress, vivo } = {}) {
  const attivo = vivo || (() => true);
  const esito = { ritrovate: 0, senzaByte: 0, senzaImmagine: 0, fermato: false };
  const da = libri || [];
  for (const [i, b] of da.entries()) {
    if (!attivo()) {
      esito.fermato = true;
      break;
    }
    onProgress?.({ i, totale: da.length, titolo: b.title });
    // UN TOMO RIMASTO NEL CLOUD NON E' UN GUASTO, ed e' un conto a parte:
    // non c'e' niente da guardare, quindi dire «non ha una copertina nel
    // file» sarebbe una risposta data senza aver aperto niente. Il
    // `Promise.resolve().then` e' la lezione di `ripassaImpronte`: un
    // `leggiByte` che esplode SUBITO scavalcherebbe il `catch` e si
    // porterebbe via il giro con tutte le copertine gia' ritrovate.
    const file = await Promise.resolve()
      .then(() => leggiByte?.(b.id))
      .catch(() => null);
    if (!file) {
      esito.senzaByte += 1;
      continue;
    }
    const cover = await Promise.resolve()
      .then(() => estrai?.(b, file))
      .catch(() => null);
    if (!cover) {
      // guardato dentro, e l'immagine non c'e' (o il file non si e'
      // lasciato aprire): in tutt'e due i casi la strada e' la stessa,
      // mettercela a mano dalla scheda. Si segna, o il tasto lo
      // riproporrebbe a ogni apertura della Libreria.
      esito.senzaImmagine += 1;
      await Promise.resolve().then(() => segnaGuardato?.(b.id)).catch(() => {});
      continue;
    }
    try {
      await posa(b.id, cover);
      esito.ritrovate += 1;
    } catch {
      // una copertina che non si scrive non ferma il giro: le altre valgono
      esito.senzaImmagine += 1;
    }
  }
  return esito;
}

// E il giro dice cosa ha fatto, con le stesse regole di ogni resoconto:
// gli zeri non si dicono, e la voce su cui il lettore ha qualcosa da fare
// si porta dietro la strada.
export function resocontoCopertine(esito = {}) {
  const { ritrovate = 0, senzaByte = 0, senzaImmagine = 0, fermato = false } = esito;
  const parti = [];
  if (ritrovate)
    parti.push(ritrovate === 1 ? "una copertina ritrovata 🖼" : `${ritrovate} copertine ritrovate 🖼`);
  if (senzaImmagine)
    parti.push(
      senzaImmagine === 1
        ? "un tomo non ce l'ha nel file — puoi mettergliela tu dalla scheda"
        : `${senzaImmagine} tomi non ce l'hanno nel file — puoi mettergliele tu dalla scheda`
    );
  if (senzaByte)
    parti.push(`${senzaByte} ${senzaByte === 1 ? "non è" : "non sono"} su questo dispositivo`);
  if (!parti.length) return "Le copertine erano già tutte al loro posto";
  return `${parti.join(", ")}${fermato ? " — giro fermato" : ""}`;
}
