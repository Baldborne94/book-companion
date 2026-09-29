// IL NASTRO DEI FUMETTI (`altezzeNastro`, `cimeNastro`, `paginaAlPunto`
// in `lib/fumetto.js`): le pagine una sotto l'altra, larghe quanto lo
// schermo. Sbaglia in silenzio: una pagina contata male e' un contatore
// che dice 12 mentre guardi la 13, e un segnalibro salvato un po' piu' in la'.
import { altezzeNastro, cimeNastro, paginaAlPunto, PROPORZIONE_TIPICA } from "../src/lib/fumetto.js";

export default async function (t) {
  // in quest'ordine la pagina di mezzo NON e' la mediana: la mediana vuole
  // le proporzioni ordinate
  const nats = { 1: { w: 1000, h: 1400 }, 2: { w: 1000, h: 1500 }, 4: { w: 2000, h: 1500 } };
  const h = altezzeNastro({ totale: 5, nats, larghezza: 800 });
  t.eq("una pagina misurata e' alta quanto viene larga quanto lo schermo", h[1], 1200);
  t.eq("…ognuna la sua", h[0], 1120);
  t.eq("una tavola larga e' piu' bassa", h[3], 600);
  // la mediana di 1,5 · 1,4 · 0,75 e' 1,4: le pagine nuove valgono quelle viste
  t.eq("una pagina non ancora aperta vale la proporzione mediana di quelle viste", h[2], 1120);
  t.eq("…anche l'ultima", h[4], 1120);
  t.eq("senza nessuna misura, la proporzione di una pagina di fumetto", altezzeNastro({ totale: 2, larghezza: 100 })[0], 100 * PROPORZIONE_TIPICA);
  t.eq("i bordi tolti uguali sui quattro lati lasciano la proporzione", altezzeNastro({ totale: 1, nats, larghezza: 800, bordi: { l: 0.1, t: 0.1, r: 0.9, b: 0.9 } })[0], 1120);
  t.eq("…e la tavola stretta di bordi e' piu' corta se i bordi non sono uguali",
    altezzeNastro({ totale: 1, nats, larghezza: 800, bordi: { l: 0, t: 0.1, r: 1, b: 0.9 } })[0], 896);
  t.eq("senza larghezza non c'e' nastro", altezzeNastro({ totale: 3, nats, larghezza: 0 }).join(","), "0,0,0");

  const cime = cimeNastro([100, 200, 300]);
  t.eq("dove comincia ogni pagina, e dove finisce l'ultima", cime.join(","), "0,100,300,600");
  t.eq("in cima si e' alla prima", paginaAlPunto(cime, 0), 1);
  t.eq("dentro la prima", paginaAlPunto(cime, 99), 1);
  t.eq("sul confine comincia la seconda", paginaAlPunto(cime, 100), 2);
  t.eq("dentro la terza", paginaAlPunto(cime, 450), 3);
  t.eq("oltre la fine resta l'ultima", paginaAlPunto(cime, 9999), 3);
  t.eq("prima dell'inizio resta la prima", paginaAlPunto(cime, -5), 1);
  t.eq("nastro vuoto: la prima", paginaAlPunto([0], 10), 1);
  const lungo = cimeNastro(new Array(500).fill(10));
  t.eq("anche in un volume lungo", paginaAlPunto(lungo, 4321), 433);
}
