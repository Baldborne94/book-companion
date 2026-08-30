// IL RITAGLIO DEI MARGINI, MISURATO SU IMMAGINI FINTE.
//
// `pdfCrop` decide quanto bianco togliere da OGNI pagina di un PDF, e lo
// decide una volta sola per libro. Un errore qui non si vede come un
// errore: si vede come un libro impaginato male — testo incollato al
// bordo, o mezza pagina tagliata via — e non c'e' niente sullo schermo
// che dica di dove viene. Era senza un solo controllo.
//
// Le funzioni che contano non toccano il DOM: vogliono un rettangolo di
// pixel, cioe' `{ data, width, height }` come lo torna `getImageData`. Si
// puo' costruire a mano, ed e' quello che si fa qui — niente canvas,
// niente pdf.js, niente browser.
import {
  misuraInchiostro,
  unisci,
  rifinisci,
  pagineDaMisurare,
  vuoto,
  TUTTA,
} from "../src/lib/pdfCrop.js";

// una pagina finta: fondo pieno, e sopra un rettangolo d'inchiostro
function pagina({ w, h, fondo = [255, 255, 255], inchiostro = [10, 10, 10], box = null, angoli = null }) {
  const data = new Uint8ClampedArray(w * h * 4);
  const metti = (x, y, [r, g, b]) => {
    const i = (y * w + x) * 4;
    data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) metti(x, y, fondo);
  if (box) {
    for (let y = box.t; y <= box.b; y++) for (let x = box.l; x <= box.r; x++) metti(x, y, inchiostro);
  }
  // per provare la scansione con gli angoli sporchi
  if (angoli) {
    metti(0, 0, angoli); metti(w - 1, 0, angoli);
    metti(0, h - 1, angoli); metti(w - 1, h - 1, angoli);
  }
  return { data, width: w, height: h };
}

const q = (n) => Math.round(n * 1000) / 1000;

export default async function (t) {
  // ---- dove sta l'inchiostro -------------------------------------------
  {
    // 20x20 bianca, testo dal pixel 4 al 15 in orizzontale e dal 6 al 13 in
    // verticale. I bordi tornano come FRAZIONI, e il lato destro/basso e'
    // esclusivo (r = (15+1)/20), o l'ultima colonna scritta verrebbe tagliata
    const m = misuraInchiostro(pagina({ w: 20, h: 20, box: { l: 4, t: 6, r: 15, b: 13 } }));
    t.eq("il bordo sinistro dell'inchiostro", q(m.l), 0.2);
    t.eq("quello alto", q(m.t), 0.3);
    t.eq("il destro comprende l'ultima colonna scritta", q(m.r), 0.8);
    t.eq("e il basso l'ultima riga", q(m.b), 0.7);
  }
  {
    // UNA PAGINA COLOR PERGAMENA NON E' TUTTA INCHIOSTRO, ed e' la ragione
    // per cui lo sfondo si chiede ai quattro angoli invece di darlo per
    // bianco: le scansioni virano al crema, e prendendo «chiaro = carta» un
    // libro scansionato non verrebbe ritagliato per niente.
    const m = misuraInchiostro(pagina({ w: 20, h: 20, fondo: [242, 228, 200], box: { l: 4, t: 4, r: 15, b: 15 } }));
    t.c("il crema resta carta, e il testo si trova lo stesso", m && q(m.l) === 0.2 && q(m.r) === 0.8);
  }
  {
    // una pagina bianca non ha niente da dire sul margine: `null`, non un
    // rettangolo vuoto. Presa sul serio direbbe di ritagliare TUTTO.
    t.eq("una pagina senza inchiostro non misura niente", misuraInchiostro(pagina({ w: 10, h: 10 })), null);
  }
  {
    // un pixel solo e' inchiostro quanto una pagina piena: il ritaglio si
    // allarga fin li' e non lo perde
    const m = misuraInchiostro(pagina({ w: 10, h: 10, box: { l: 7, t: 2, r: 7, b: 2 } }));
    t.eq("un pixel solo basta a spostare il bordo", `${q(m.l)}/${q(m.r)}`, "0.7/0.8");
  }
  {
    // LIMITE DICHIARATO: se gli angoli sono sporchi — una scansione con
    // l'ombra della rilegatura, un bordo nero — lo sfondo che ne esce e'
    // scuro e la carta diventa «inchiostro». Il ritaglio risultante e'
    // TUTTA la pagina, cioe' non ritaglia: sbaglia per prudenza, che e' il
    // verso giusto in cui sbagliare.
    const m = misuraInchiostro(pagina({ w: 20, h: 20, box: { l: 4, t: 4, r: 15, b: 15 }, angoli: [20, 20, 20] }));
    t.c("con gli angoli sporchi la misura si allarga invece di stringere", !m || (m.l <= 0.2 && m.r >= 0.8));
  }

  // ---- mettere insieme le pagine ----------------------------------------
  {
    const a = { l: 0.1, t: 0.1, r: 0.9, b: 0.9 };
    const b = { l: 0.05, t: 0.2, r: 0.8, b: 0.95 };
    // l'unione tiene il rettangolo PIU' LARGO, non la media: basta una
    // pagina con una nota a margine perche' quel margine serva a tutte
    t.eq("l'unione allarga, non media", JSON.stringify(unisci(a, b)), JSON.stringify({ l: 0.05, t: 0.1, r: 0.9, b: 0.95 }));
    t.eq("la prima pagina passa intera", unisci(null, b), b);
    // e una pagina che non ha misura non deve poter rovinare quella di
    // prima: senza questa riga il risultato sarebbe pieno di NaN, e un NaN
    // nel ritaglio non torna piu' indietro
    t.eq("una pagina senza misura lascia le cose come stanno", unisci(a, null), a);
  }

  // ---- la rifinitura, che è dove si sbaglia per davvero ------------------
  {
    const r = rifinisci({ l: 0.1, t: 0.1, r: 0.9, b: 0.9 });
    // il respiro: un filo di bianco attorno al testo, o incollato al bordo
    // si legge peggio. Va tolto da sinistra e AGGIUNTO a destra
    t.eq("il respiro allarga a sinistra", r.l, 0.088);
    t.eq("e allarga anche a destra", r.r, 0.912);
  }
  {
    // IL TETTO E' LA RETE DI SICUREZZA: se la misura chiede di tagliare
    // mezza pagina ha sbagliato la misura — una pagina quasi vuota finita
    // nel campione — non il libro ad avere margini smisurati.
    const r = rifinisci({ l: 0.4, t: 0.45, r: 0.6, b: 0.55 });
    t.eq("da sinistra non si toglie mai piu' del tetto", r.l, 0.18);
    t.eq("ne' dall'alto", r.t, 0.18);
    t.eq("e il bordo destro non scende sotto il suo", r.r, 0.82);
    t.eq("ne' quello di sotto", r.b, 0.82);
    t.c("quindi resta comunque una finestra sensata", r.r > r.l && r.b > r.t);
  }
  {
    // niente da misurare (tutte le pagine bianche, o un PDF che non si
    // disegna): si tiene la pagina intera, che e' non ritagliare
    t.eq("senza misura si tiene tutta la pagina", JSON.stringify(rifinisci(null)), JSON.stringify(TUTTA));
    t.c("e «tutta la pagina» vale come «nessun ritaglio»", vuoto(TUTTA));
    t.c("mentre un ritaglio vero non e' vuoto", !vuoto({ l: 0.09, t: 0.05, r: 0.91, b: 0.95 }));
  }
  {
    // un inchiostro che tocca gia' il bordo non deve uscire dalla pagina
    const r = rifinisci({ l: 0, t: 0, r: 1, b: 1 });
    t.eq("il ritaglio non esce mai dalla pagina", `${r.l}/${r.t}/${r.r}/${r.b}`, "0/0/1/1");
  }

  // ---- quali pagine si guardano -----------------------------------------
  {
    const p = pagineDaMisurare(100);
    t.eq("su cento pagine se ne guardano cinque, sparse", p.join(","), "14,32,50,68,86");
    t.c("mai la prima ne' l'ultima, su un libro vero", !p.includes(1) && !p.includes(100));
  }
  {
    // i libri corti: quel che conta e' non chiedere pagine che non esistono
    // e non chiedere la pagina zero, che manderebbe in errore pdf.js
    for (const n of [1, 2, 3, 5, 10, 40]) {
      const p = pagineDaMisurare(n);
      t.c(`con ${n} pagine si resta dentro il libro`, p.every((x) => x >= 1 && x <= n));
      t.c(`e non si chiede mai la stessa due volte (${n})`, new Set(p).size === p.length);
    }
    t.eq("un PDF di una pagina sola guarda quella", pagineDaMisurare(1).join(","), "1");
  }
  {
    // LIMITE DICHIARATO, e il commento del modulo dice il contrario: su un
    // libro corto il campione PRENDE la prima pagina — 0.14 × 10 arrotonda
    // a 1 — cioe' proprio il frontespizio che diceva di evitare. Non fa
    // danno, perche' l'unione puo' solo ALLARGARE il ritaglio e un
    // frontespizio ha margini larghi: si ritaglia di meno, non di piu'.
    // Sta scritto qui perche' chi legge quel commento non si fidi.
    t.c("sotto le dieci pagine il frontespizio entra nel campione", pagineDaMisurare(10).includes(1));
  }
}
