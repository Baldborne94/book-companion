// I PDF nascono per la carta: un A4 si porta dentro due o tre centimetri di
// bianco per lato, che sul tablet non servono a nessuno e si mangiano un
// quinto del vetro. Qui si misura dove sta davvero l'inchiostro, e si tiene
// solo quello: a parita' di schermo il testo cresce di un buon terzo senza
// toccare lo zoom.
//
// LA MISURA SI FA UNA VOLTA PER LIBRO, su poche pagine sparse, e vale per
// tutte. Non e' pigrizia: un ritaglio diverso pagina per pagina farebbe
// cambiare misura al foglio a ogni voltata, e il testo ballerebbe sotto gli
// occhi. Un libro impaginato ha un margine solo, non uno per pagina.
//
// Il ritaglio non tocca MAI le evidenziazioni salvate: quelle restano
// frazioni della pagina intera e il reader le appende a una cornice piena
// che scorre sotto la finestra ritagliata. Rimisurare o spegnere il
// ritaglio non deve spostare di un pelo quello che avevi segnato.

const KEY = (id) => `bc_pdfcrop_${id}`;

export const TUTTA = { l: 0, t: 0, r: 1, b: 1 };

// Oltre questo non si taglia mai. Se la misura chiede di piu' e' la misura
// ad aver sbagliato — una pagina quasi vuota finita nel campione — non il
// libro ad avere margini smisurati.
const MAX_LATO = 0.18;
// un filo di bianco attorno al testo: incollato al bordo si legge peggio
const RESPIRO = 0.012;
// piu' larga di cosi' la misura non serve: si cercano i bordi, non i
// dettagli, e ogni pagina in piu' e' tempo tolto all'apertura del libro
const LARGHEZZA = 180;
// pagine sparse: mai la prima ne' l'ultima, che sono frontespizi e colophon
// e non raccontano l'impaginato del libro
const CAMPIONI = [0.14, 0.32, 0.5, 0.68, 0.86];

const round = (n) => Math.round(n * 10000) / 10000;

export const vuoto = (c) => !c || (c.l <= 0.002 && c.t <= 0.002 && c.r >= 0.998 && c.b >= 0.998);

export function getCrop(bookId) {
  try {
    const v = JSON.parse(localStorage.getItem(KEY(bookId)));
    if (!v || ![v.l, v.t, v.r, v.b].every((n) => Number.isFinite(n))) return null;
    return v.r > v.l && v.b > v.t ? v : null;
  } catch {
    return null;
  }
}

export const saveCrop = (bookId, crop) => localStorage.setItem(KEY(bookId), JSON.stringify(crop));
export const dropCrop = (bookId) => localStorage.removeItem(KEY(bookId));

// Il rettangolo dell'inchiostro su una pagina gia' disegnata. Lo sfondo lo
// dettano i quattro angoli invece di darlo per bianco: le scansioni virano
// al crema e una pagina color pergamena sarebbe tutta "inchiostro".
export function misuraInchiostro({ data, width, height }) {
  const at = (x, y) => (y * width + x) * 4;
  const angoli = [at(0, 0), at(width - 1, 0), at(0, height - 1), at(width - 1, height - 1)];
  const sfondo = [0, 1, 2].map((k) => angoli.reduce((s, i) => s + data[i + k], 0) / angoli.length);
  const scritto = (i) =>
    Math.abs(data[i] - sfondo[0]) + Math.abs(data[i + 1] - sfondo[1]) + Math.abs(data[i + 2] - sfondo[2]) > 60;

  let l = width;
  let t = height;
  let r = -1;
  let b = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!scritto(at(x, y))) continue;
      if (x < l) l = x;
      if (x > r) r = x;
      if (y < t) t = y;
      if (y > b) b = y;
    }
  }
  // pagina bianca: non ha niente da dire sul margine, e presa sul serio
  // direbbe di ritagliare tutto
  if (r < 0) return null;
  return { l: l / width, t: t / height, r: (r + 1) / width, b: (b + 1) / height };
}

export const unisci = (a, b) =>
  !a ? b : { l: Math.min(a.l, b.l), t: Math.min(a.t, b.t), r: Math.max(a.r, b.r), b: Math.max(a.b, b.b) };

export function rifinisci(box) {
  if (!box) return TUTTA;
  return {
    l: round(Math.min(MAX_LATO, Math.max(0, box.l - RESPIRO))),
    t: round(Math.min(MAX_LATO, Math.max(0, box.t - RESPIRO))),
    r: round(Math.max(1 - MAX_LATO, Math.min(1, box.r + RESPIRO))),
    b: round(Math.max(1 - MAX_LATO, Math.min(1, box.b + RESPIRO))),
  };
}

export const pagineDaMisurare = (n) => [
  ...new Set(CAMPIONI.map((f) => Math.max(1, Math.min(n, Math.round(f * n))))),
];

export async function misuraLibro(pdf) {
  const tela = document.createElement("canvas");
  const ctx = tela.getContext("2d", { willReadFrequently: true });
  let box = null;
  for (const num of pagineDaMisurare(pdf.numPages)) {
    try {
      const p = await pdf.getPage(num);
      const base = p.getViewport({ scale: 1 });
      const viewport = p.getViewport({ scale: LARGHEZZA / base.width });
      tela.width = Math.ceil(viewport.width);
      tela.height = Math.ceil(viewport.height);
      // pdf.js disegna su fondo trasparente: senza il bianco sotto, gli
      // angoli non saprebbero dire qual e' lo sfondo della pagina
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, tela.width, tela.height);
      await p.render({ canvas: tela, canvasContext: ctx, viewport }).promise;
      const uno = misuraInchiostro(ctx.getImageData(0, 0, tela.width, tela.height));
      if (uno) box = unisci(box, uno);
    } catch {
      /* una pagina che non si disegna: bastano le altre */
    }
  }
  return rifinisci(box);
}
