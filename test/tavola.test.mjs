// LE MAPPE SI GUARDANO DA VICINO: quale tocco apre la tavola, e fin dove si
// sposta il foglio. Tutt'e due sbagliano in silenzio — un fregio che si apre
// a tutto schermo al posto delle barre, una mappa trascinata fuori dal
// riquadro — e nessuno dei due alza un errore.
import {
  immagineDaIngrandire,
  limita,
  limitaScala,
  zoomAttorno,
  doppioTocco,
  sceltaDelTocco,
  BORDO_TAVOLA,
  LATO_MINIMO,
  SCALA_MAX,
  SCALA_DOPPIO,
} from "../src/lib/tavola.js";

// un elemento finto quanto basta: tag, attributi, misura sullo schermo e i
// due passi dell'albero che la funzione fa (`closest`, `querySelector`)
function el(tag, { attr = {}, w = 400, h = 300, props = {}, padri = [], figli = [] } = {}) {
  const nodo = {
    tagName: tag.toUpperCase(),
    ...props,
    getAttribute: (k) => (k in attr ? attr[k] : null),
    getAttributeNS: () => null,
    getBoundingClientRect: () => ({ width: w, height: h }),
    closest(sel) {
      const tags = sel.split(",").map((x) => x.trim());
      for (const n of [nodo, ...padri]) if (tags.includes(n.tagName.toLowerCase())) return n;
      return null;
    },
    querySelector(sel) {
      return figli.find((f) => f.tagName.toLowerCase() === sel) || null;
    },
  };
  return nodo;
}

const BASE = "https://libro.example/OEBPS/testo/cap1.xhtml";
const FOGLIO = { w: 400, h: 300 };
const RIQUADRO = { w: 800, h: 600 };

export default async function (t) {
  // ---- quale tocco e' per un'immagine -----------------------------------
  const img = el("img", { props: { currentSrc: "blob:https://app/abc" }, attr: { alt: "Mappa di Genabackis" } });
  const a = immagineDaIngrandire(img, BASE);
  t.eq("un <img> grande si apre", a?.src, "blob:https://app/abc");
  t.eq("l'alt diventa la didascalia", a?.alt, "Mappa di Genabackis");

  t.eq(
    "senza currentSrc si prende l'attributo, risolto sulla pagina",
    immagineDaIngrandire(el("img", { attr: { src: "../img/mappa.jpg" } }), BASE)?.src,
    "https://libro.example/OEBPS/img/mappa.jpg"
  );

  // l'<image> dentro un SVG a tutta pagina: e' come moltissimi ePub mettono
  // le mappe, e il tocco sul trasparente arriva all'<svg>
  const image = el("image", { attr: { "xlink:href": "mappa.png" } });
  const svg = el("svg", { figli: [image] });
  t.eq("tocco sull'<svg> → la sua <image>", immagineDaIngrandire(svg, BASE)?.src, "https://libro.example/OEBPS/testo/mappa.png");
  t.eq(
    "l'<image> col solo href moderno",
    immagineDaIngrandire(el("image", { attr: { href: "m.png" } }), BASE)?.src,
    "https://libro.example/OEBPS/testo/m.png"
  );

  // un fregio largo quanto la colonna e alto un dito resta un fregio: si
  // guarda il lato CORTO, o si aprirebbe a tutto schermo al posto delle barre
  t.eq("il fregio basso non si apre", immagineDaIngrandire(el("img", { props: { src: "x.png" }, w: 500, h: 40 }), BASE), null);
  t.c(
    "al lato minimo esatto si apre",
    immagineDaIngrandire(el("img", { props: { src: "x.png" }, w: LATO_MINIMO, h: LATO_MINIMO }), BASE) !== null
  );
  t.eq(
    "un pixel sotto il minimo no",
    immagineDaIngrandire(el("img", { props: { src: "x.png" }, w: LATO_MINIMO - 1, h: 900 }), BASE),
    null
  );

  t.eq("il testo non e' un'immagine", immagineDaIngrandire(el("p"), BASE), null);
  t.eq("un <svg> senza <image> e' un disegno, non una tavola", immagineDaIngrandire(el("svg"), BASE), null);
  t.eq("niente bersaglio, niente tavola", immagineDaIngrandire(null, BASE), null);
  t.eq("un'immagine senza sorgente non si apre", immagineDaIngrandire(el("img"), BASE), null);

  // la didascalia della figura quando l'alt manca
  const cap = { tagName: "FIGCAPTION", textContent: "  La mappa   del Mondo Disco \n" };
  const fig = el("figure", { figli: [cap] });
  const inFig = el("img", { props: { src: "d.png" }, padri: [fig] });
  t.eq("senza alt vale la didascalia, ripulita", immagineDaIngrandire(inFig, BASE)?.alt, "La mappa del Mondo Disco");
  t.eq(
    "l'alt vince sulla didascalia",
    immagineDaIngrandire(el("img", { props: { src: "d.png" }, attr: { alt: "Ankh-Morpork" }, padri: [fig] }), BASE)?.alt,
    "Ankh-Morpork"
  );
  t.eq("senza alt ne' didascalia, stringa vuota", immagineDaIngrandire(el("img", { props: { src: "d.png" } }), BASE)?.alt, "");

  // ---- cosa fa il tocco, da dove cade -----------------------------------
  const P = 0.28, N = 0.72;
  // il caso misurato al banco: in doppia pagina il centro della mappa della
  // facciata sinistra sta al 27% dello schermo, dentro la fascia normale
  t.eq("il centro della mappa sulla facciata sinistra la apre", sceltaDelTocco(0.27, true, P, N), "tavola");
  t.eq("lo stesso punto senza immagine volta indietro", sceltaDelTocco(0.27, false, P, N), "prev");
  t.eq("sul bordo esterno sinistro la mappa volta ancora", sceltaDelTocco(BORDO_TAVOLA - 0.01, true, P, N), "prev");
  t.eq("sul bordo esterno destro la mappa volta ancora", sceltaDelTocco(1 - BORDO_TAVOLA + 0.01, true, P, N), "next");
  t.eq("la mappa sulla facciata destra la apre anche nella fascia normale", sceltaDelTocco(0.8, true, P, N), "tavola");
  t.eq("al centro della mappa a tutta pagina: la tavola", sceltaDelTocco(0.5, true, P, N), "tavola");
  t.eq("al centro del testo: le barre", sceltaDelTocco(0.5, false, P, N), "barre");
  t.eq("fascia destra del testo: avanti", sceltaDelTocco(0.8, false, P, N), "next");
  t.eq("senza fasce (mouse, scorrimento) l'immagine si apre", sceltaDelTocco(null, true, P, N), "tavola");
  t.eq("senza fasce il testo tocca le barre", sceltaDelTocco(null, false, P, N), "barre");
  t.eq("una misura rotta vale «senza fasce»", sceltaDelTocco(NaN, true, P, N), "tavola");

  // ---- la scala ---------------------------------------------------------
  t.eq("sotto uno non si scende", limitaScala(0.3), 1);
  t.eq("oltre il tetto non si sale", limitaScala(99), SCALA_MAX);
  t.eq("un NaN vale uno, non NaN", limitaScala(NaN), 1);

  // ---- il foglio non si stacca dai bordi --------------------------------
  const intero = limita({ s: 1, x: 200, y: -90 }, FOGLIO, RIQUADRO);
  t.c("a scala uno il foglio sta in mezzo", intero.x === 0 && intero.y === 0, JSON.stringify(intero));

  // a scala 4 il foglio e' 1600×1200: si sposta fino a filo, (1600-800)/2
  const lontano = limita({ s: 4, x: 5000, y: -5000 }, FOGLIO, RIQUADRO);
  t.eq("a destra fino a filo e non oltre", lontano.x, 400);
  t.eq("in alto fino a filo e non oltre", lontano.y, -300);
  const dentro = limita({ s: 4, x: 120, y: -40 }, FOGLIO, RIQUADRO);
  t.c("dentro i bordi non si tocca niente", dentro.x === 120 && dentro.y === -40);

  // a scala 2 il foglio e' 800×600: largo quanto il riquadro, quindi fermo
  const pari = limita({ s: 2, x: 50, y: 50 }, FOGLIO, RIQUADRO);
  t.c("largo quanto il riquadro: niente da spostare", pari.x === 0 && pari.y === 0);

  // ---- si ingrandisce attorno alle dita ---------------------------------
  // il punto sotto le dita resta sotto le dita: x + s*p resta uguale
  const prima = { s: 1, x: 0, y: 0 };
  const px = 100, py = -60;
  const dopo = zoomAttorno(prima, 3, px, py, FOGLIO, RIQUADRO);
  const pLocale = { x: (px - prima.x) / prima.s, y: (py - prima.y) / prima.s };
  t.vicino("il punto toccato resta fermo (x)", dopo.x + dopo.s * pLocale.x, px, 0.001);
  t.vicino("il punto toccato resta fermo (y)", dopo.y + dopo.s * pLocale.y, py, 0.001);
  t.eq("la scala richiesta arriva", dopo.s, 3);

  const troppo = zoomAttorno(prima, 40, 0, 0, FOGLIO, RIQUADRO);
  t.eq("anche il pizzico ha un tetto", troppo.s, SCALA_MAX);

  // ---- il doppio tocco --------------------------------------------------
  const vicino = doppioTocco({ s: 1, x: 0, y: 0 }, 50, 20, FOGLIO, RIQUADRO);
  t.eq("da intera si avvicina", vicino.s, SCALA_DOPPIO);
  const indietro = doppioTocco({ s: 3.7, x: 80, y: -30 }, 50, 20, FOGLIO, RIQUADRO);
  t.c(
    "da vicino torna intera, qualunque sia la scala",
    indietro.s === 1 && indietro.x === 0 && indietro.y === 0,
    JSON.stringify(indietro)
  );
  // dopo un pizzico leggero, sotto la scala del doppio tocco: tornare
  // intera, non avvicinarsi ancora — o il gesto per uscire non esisterebbe
  const leggero = doppioTocco({ s: 1.6, x: 0, y: 0 }, 50, 20, FOGLIO, RIQUADRO);
  t.eq("anche da un pizzico leggero torna intera", leggero.s, 1);
}
