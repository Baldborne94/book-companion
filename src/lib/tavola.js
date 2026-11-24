// LE MAPPE SI GUARDANO DA VICINO (la tavola a tutto schermo in
// `components/Tavola.jsx`, aperta dal tocco in `Reader.jsx`).
//
// Nei romanzi del lettore — Malazan, la Ruota del Tempo, la Seconda
// Apocalisse — la mappa sta in testa al libro, e su una facciata di tablet
// i nomi dei luoghi sono puntini: toccarla non faceva niente. Qui dentro
// stanno le due decisioni che sbagliano in silenzio, fuori dal componente
// perche' un test in Node non importa un `.jsx`: QUALE tocco e' per
// un'immagine, e dove finisce il foglio quando lo si ingrandisce.

// Sotto questo lato (in px sullo schermo) un'immagine non e' una tavola: e'
// un fregio, un capolettera disegnato, il segno di scena. Aprirli a tutto
// schermo trasformerebbe un tocco per le barre in una sorpresa. Si guarda il
// lato CORTO: un fregio largo quanto la colonna e alto un dito resta un
// fregio.
export const LATO_MINIMO = 100;

// Sopra un'immagine le fasce della voltata si stringono a questa frazione
// dello schermo, per lato. Misurato al banco in doppia pagina: la mappa della
// facciata sinistra sta fra il 7% e il 46% dello schermo, e con le fasce
// normali (28%) il suo centro cadeva nella voltata indietro — toccavi la
// mappa e tornavi di una pagina. A pagina singola una mappa a tutta pagina
// copre anche le fasce, e i bordi stretti restano l'unico modo di passare
// oltre: per questo si stringono e non spariscono.
export const BORDO_TAVOLA = 0.12;

// Cosa fa un tocco breve, detto da dove cade (`rel`, frazione della
// larghezza dello schermo; `null` dove le fasce non esistono — col mouse o
// in scorrimento) e se sotto c'e' un'immagine da aprire.
export function sceltaDelTocco(rel, suImmagine, prev, next) {
  // `null` va detto a mano: in un confronto vale zero, e sarebbe «prev». Un
  // NaN invece non passa nessun confronto e arriva da se' in fondo.
  if (rel == null) return suImmagine ? "tavola" : "barre";
  const sx = suImmagine ? BORDO_TAVOLA : prev;
  const dx = suImmagine ? 1 - BORDO_TAVOLA : next;
  if (rel < sx) return "prev";
  if (rel > dx) return "next";
  return suImmagine ? "tavola" : "barre";
}

export const SCALA_MAX = 5;
export const SCALA_DOPPIO = 2.5;

// Dal bersaglio del tocco alla tavola da aprire, o `null` se il tocco non e'
// per un'immagine. Due forme vere: `<img>`, e l'`<image>` dentro un SVG a
// tutta pagina — che e' come moltissimi ePub mettono copertina e mappe. Il
// tocco sul trasparente di quell'SVG arriva all'`<svg>`, non all'`<image>`,
// e va preso lo stesso.
export function immagineDaIngrandire(bersaglio, base) {
  let im = bersaglio?.closest?.("img, image") || null;
  if (!im) im = bersaglio?.closest?.("svg")?.querySelector?.("image") || null;
  if (!im) return null;

  const r = im.getBoundingClientRect?.();
  if (!r || Math.min(r.width || 0, r.height || 0) < LATO_MINIMO) return null;

  const tag = String(im.tagName || "").toLowerCase();
  const grezzo =
    tag === "img"
      ? im.currentSrc || im.src || im.getAttribute?.("src")
      : im.getAttribute?.("href") || im.getAttribute?.("xlink:href") ||
        im.getAttributeNS?.("http://www.w3.org/1999/xlink", "href");
  if (!grezzo) return null;
  let src;
  try {
    src = new URL(grezzo, base || undefined).href;
  } catch {
    return null;
  }

  const didascalia = im.closest?.("figure")?.querySelector?.("figcaption")?.textContent;
  const alt = pulito(im.getAttribute?.("alt")) || pulito(didascalia) || "";
  return { src, alt };
}

function pulito(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

export function limitaScala(s) {
  if (!Number.isFinite(s)) return 1;
  return Math.min(SCALA_MAX, Math.max(1, s));
}

// Lo stato e' `translate(x, y) scale(s)` con l'origine al CENTRO del
// riquadro, e `foglio` e `riquadro` sono le misure a scala uno. Il foglio
// non si stacca mai dai bordi: se e' piu' largo del riquadro lo si sposta
// fino a filo e non oltre, se e' piu' stretto sta in mezzo. Senza questo
// la mappa si trascina via e resta una striscia nera con un angolo di carta.
export function limita(st, foglio, riquadro) {
  const s = limitaScala(st.s);
  const lx = Math.max(0, (foglio.w * s - riquadro.w) / 2);
  const ly = Math.max(0, (foglio.h * s - riquadro.h) / 2);
  return {
    s,
    x: Math.min(lx, Math.max(-lx, Number(st.x) || 0)),
    y: Math.min(ly, Math.max(-ly, Number(st.y) || 0)),
  };
}

// Si ingrandisce ATTORNO al punto (coordinate dal centro del riquadro): il
// posto della mappa sotto le dita resta sotto le dita. Ingrandire attorno al
// centro sarebbe piu' semplice, e manderebbe il nome che stavi cercando
// fuori dallo schermo a ogni gesto.
export function zoomAttorno(st, scala, px, py, foglio, riquadro) {
  const s2 = limitaScala(scala);
  const k = s2 / st.s;
  return limita({ s: s2, x: px - (px - st.x) * k, y: py - (py - st.y) * k }, foglio, riquadro);
}

// Il doppio tocco: da intera si avvicina al punto toccato, da vicino torna
// intera — qualunque sia la scala, non solo quella del doppio tocco, o dopo
// un pizzico il doppio tocco ingrandirebbe ancora invece di tornare indietro.
export function doppioTocco(st, px, py, foglio, riquadro) {
  if (st.s > 1.01) return { s: 1, x: 0, y: 0 };
  return zoomAttorno(st, SCALA_DOPPIO, px, py, foglio, riquadro);
}
