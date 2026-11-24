import { eFumetto, tipoImmagine } from "./fumetto.js";
import { segnaposto } from "./segnaposto.js";
import { NITIDA, RITAGLIATA, chiaveNitida } from "./miniature.js";
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

// UNA COPERTINA SI RIDUCE CON LA QUALITA' ALTA (segnalato dal lettore:
// «a me sembra che alcune copertine siano sgranate»). Il canvas di Chrome
// riduce di serie col filtro veloce, e da 1600×2400 a 800 una linea sottile
// si spezza a scalini: misurato contro la media esatta dei pixel, 23 dB
// col filtro di serie e 27 con «high», e la miniatura che ne nasce 24,6
// contro 28,2. Ogni tela che rimpicciolisce una copertina passa da qui.
// l'etichetta: chi scrive la copertina ne lascia il segno (`putCover`)
const nitida = (blob) => {
  try {
    blob[NITIDA] = true;
  } catch {
    /* un oggetto che non si lascia etichettare resta senza segno: si rifara' */
  }
  return blob;
};

// LE COPERTINE DEI FUMETTI DA RIFARE (chiesto dal lettore: «sì, fai il
// tasto per rifare le copertine dei fumetti»). Quella di un fumetto e' la
// prima pagina ridotta a 800, e prima di `pennelloFine` si riduceva col
// filtro veloce: grana nella copertina, non solo nella miniatura. Si rifa'
// dal file chi lo ha qui, con una copertina senza il segno della nitida
// (`chiaveNitida` col suo peso), e mai una messa a mano. L'ePub no: la sua
// copertina si salva intera, com'e' nel file.
export function copertineDaRifare(libri, { qui, misure, nitide, aMano = () => false } = {}) {
  return (libri || []).filter(
    (b) => b?.id && eFumetto(b) && qui?.has(b.id) && misure?.has(b.id) && !aMano(b.id) && !nitide?.has(chiaveNitida(b.id, misure.get(b.id)))
  );
}

// LA SOVRACCOPERTA APERTA NON E' LA COPERTINA (segnalato dal lettore con lo
// scaffale di Kingdom: dal volume 10 in poi il dorso e il codice a barre al
// posto del disegno). Le scansioni giapponesi cominciano dalla sovraccoperta
// intera, fronte, dorso e retro in una pagina sola, 800×543: la copertina
// e' il fronte, alto quanto la pagina e largo quanto un volume (0,64
// dell'altezza, misurato sulla foto del lettore: fronte 345 su 543). In un
// manga, che si legge da destra, il fronte sta a sinistra del dorso; in un
// fumetto occidentale a destra. Una pagina poco piu' larga che alta e' una
// copertina e basta.
export const SOVRACCOPERTA = 1.2;
export const FRONTE = 0.64;
export function fronteDellaSovraccoperta(w, h, verso) {
  if (!(w > 0) || !(h > 0) || w / h < SOVRACCOPERTA) return null;
  const largo = Math.min(w, Math.round(h * FRONTE));
  return { x: verso === "rtl" ? 0 : w - largo, w: largo };
}

// IL FRONTE SI RITAGLIA QUANDO SI MOSTRA, MAI QUANDO SI SALVA: all'import
// la saga non e' ancora scritta, e un manga preso per un fumetto
// occidentale mostrerebbe il retro. Quando si mostra, il tipo e' quello
// della biblioteca (`versoDelLibro`). La copertina salvata resta la pagina
// com'e', e questa torna lei stessa se non e' una sovraccoperta.
export async function fronteDaMostrare(blob, verso, max = LATO) {
  if (!blob || !verso || !IMMAGINE.test(blob.type || "")) return blob || null;
  try {
    const b = await createImageBitmap(blob);
    const fronte = fronteDellaSovraccoperta(b.width, b.height, verso);
    b.close?.();
    if (!fronte) return blob;
    return (await preparaCopertina(blob, max, { verso })) || blob;
  } catch {
    return blob;
  }
}

export function pennelloFine(tela) {
  const g = tela.getContext("2d");
  g.imageSmoothingQuality = "high";
  return g;
}

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
// `max` e' il lato lungo: di norma `LATO`, la misura delle copertine
// salvate; la copertina grande per lo schermo intero (`copertinaGrande.js`)
// ne chiede uno quanto lo schermo, e l'ePub arriva com'e' nel file
export async function copertinaOriginale(book, bytes, max = LATO) {
  if (!bytes) return null;
  try {
    // un CBR che sta su Drive: la prima pagina e basta (`primaPaginaRar`),
    // non l'archivio intero — da li' sarebbe un viaggio in rete per pagina
    if (book?.fileType === "cbr" && bytes.daLontano) {
      const { primaPaginaRar } = await import("./fumetto.js");
      const p = await primaPaginaRar(bytes);
      if (!p?.bytes) return null;
      return (await preparaCopertina(new Blob([p.bytes], { type: tipoImmagine(p.nome) || "image/jpeg" }), max)) || null;
    }
    // un fumetto: la prima pagina, rimpicciolita come una copertina messa
    // a mano — PRIMA di `arrayBuffer`, che su un CBZ da un giga caricherebbe
    // in memoria tutto il volume per guardarne una pagina
    if (eFumetto(book)) {
      const { apriFumetto } = await import("./archivioFumetto.js");
      const a = await apriFumetto(bytes);
      if (!a.pagine.length) return null;
      const blob = new Blob([await a.leggi(0)], { type: tipoImmagine(a.pagine[0]) || "image/jpeg" });
      return (await preparaCopertina(blob, max)) || null;
    }
    const buf = await bytes.arrayBuffer();
    if (book?.fileType === "pdf") {
      const { renderPdfThumb } = await import("./pdfThumb.js");
      // la miniatura di sempre e' larga 320; per lo schermo intero una
      // pagina in piedi larga i sette decimi del lato lungo ci sta tutta
      return (await renderPdfThumb(buf, max > LATO ? Math.round(max * 0.7) : 320)) || null;
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
// `verso`: solo per la prima pagina di un fumetto, dove una sovraccoperta
// aperta si ritaglia al suo fronte (`fronteDellaSovraccoperta`)
export async function preparaCopertina(file, max = LATO, { verso = null } = {}) {
  if (!file) return null;
  if (!IMMAGINE.test(file.type || "")) return null;
  try {
    const bitmap = await createImageBitmap(file);
    const fronte = verso ? fronteDellaSovraccoperta(bitmap.width, bitmap.height, verso) : null;
    const sx = fronte ? fronte.x : 0;
    const sw = fronte ? fronte.w : bitmap.width;
    const m = misura(sw, bitmap.height, max);
    if (!m) return file;
    if (!fronte && m.w === bitmap.width && m.h === bitmap.height && file.size < 400 * 1024) {
      bitmap.close?.();
      return nitida(file);
    }
    const canvas = document.createElement("canvas");
    canvas.width = m.w;
    canvas.height = m.h;
    const ctx = pennelloFine(canvas);
    ctx.drawImage(bitmap, sx, 0, sw, bitmap.height, 0, 0, m.w, m.h);
    bitmap.close?.();
    const blob = await new Promise((ok) => canvas.toBlob(ok, "image/jpeg", 0.85));
    if (blob && fronte) blob[RITAGLIATA] = true;
    return blob ? nitida(blob) : file;
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

// E DOVE STA IL FILE DI CHI NON CE L'HA (segnalato dal lettore sul PC:
// «Ritrova 183 copertine», e al tocco «183 non sono su questo dispositivo»).
// Il tasto contava tutta la biblioteca e poteva leggere solo i file di qui:
// una promessa che non poteva mantenere. Il tasto conta `qui`; il resto si
// dice per strada, perche' la strada e' diversa: il disco le legge da
// «Controlla il disco», l'altro dispositivo le ritrova dal suo tasto (e la
// copertina viaggia), una scheda senza ebook non ha un file da aprire.
export function copertineDaDove(libri, { conCopertina, guardati, qui, sulDisco, altrove } = {}) {
  const out = { qui: [], disco: [], altrove: [], senzaFile: [], persi: [] };
  for (const b of senzaCopertina(libri, conCopertina, guardati)) {
    if (qui?.has(b.id)) out.qui.push(b);
    else if (sulDisco?.has(b.id)) out.disco.push(b);
    else if (altrove?.has(b.id)) out.altrove.push(b);
    else if (segnaposto(b)) out.senzaFile.push(b);
    else out.persi.push(b);
  }
  return out;
}

export function fraseCopertineAltrove({ disco = [], altrove = [], senzaFile = [], persi = [] } = {}) {
  const tutte = disco.length + altrove.length + senzaFile.length + persi.length;
  if (!tutte) return "";
  const parti = [];
  const uno = (k, a, b) => (k === 1 ? a : b);
  if (disco.length) parti.push(`${disco.length} ${uno(disco.length, "ha", "hanno")} il file sul disco (le legge «Controlla il disco»)`);
  if (altrove.length) parti.push(`${altrove.length} su un altro dispositivo (${uno(altrove.length, "ritrovala da lì, poi arriva", "ritrovale da lì, poi arrivano")} anche qui)`);
  if (senzaFile.length) parti.push(`${senzaFile.length} ${uno(senzaFile.length, "è una scheda", "sono schede")} senza ebook (la copertina si mette dalla scheda)`);
  if (persi.length) parti.push(`${persi.length} ${uno(persi.length, "ha", "hanno")} un file che non so dove sia`);
  return `${tutte === 1 ? "Una copertina che manca non si ritrova" : `${tutte} copertine che mancano non si ritrovano`} da qui: ${parti.join(", ")}.`;
}

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
export function resocontoCopertine(esito = {}, { rifatte = false } = {}) {
  const { ritrovate = 0, senzaByte = 0, senzaImmagine = 0, fermato = false } = esito;
  const parti = [];
  const fatta = rifatte ? ["rifatta", "rifatte"] : ["ritrovata", "ritrovate"];
  if (ritrovate)
    parti.push(ritrovate === 1 ? `una copertina ${fatta[0]} 🖼` : `${ritrovate} copertine ${fatta[1]} 🖼`);
  // rifacendo, un file che non si apre lascia la copertina di prima: niente da mettere a mano
  if (senzaImmagine && rifatte)
    parti.push(`${senzaImmagine === 1 ? "un fumetto non si è lasciato aprire" : `${senzaImmagine} fumetti non si sono lasciati aprire`}: resta la copertina di prima`);
  else if (senzaImmagine)
    parti.push(
      senzaImmagine === 1
        ? "un tomo non ce l'ha nel file — puoi mettergliela tu dalla scheda"
        : `${senzaImmagine} tomi non ce l'hanno nel file — puoi mettergliele tu dalla scheda`
    );
  if (senzaByte)
    parti.push(`${senzaByte} ${senzaByte === 1 ? "non è" : "non sono"} su questo dispositivo`);
  if (!parti.length) return rifatte ? "Le copertine dei fumetti erano già nitide" : "Le copertine erano già tutte al loro posto";
  return `${parti.join(", ")}${fermato ? " — giro fermato" : ""}`;
}
