// LA RICUCITURA COME STANDARD: le decisioni pure, senza IndexedDB.
//
// Il verdetto sulla spezzatura vive su disco con la misura del file come
// impronta, e la parte che si sbaglia in silenzio è QUANDO fidarsi del
// verdetto vecchio e quando ricucire.
import { saluteValida, daRicucire, VERSIONE_SALUTE } from "../src/lib/ricuci.js";
import { GIUNTURE_TANTE } from "../src/lib/visita.js";

export default async function (t) {
  // ---- quando il verdetto vecchio vale ----------------------------------
  t.c("stessa misura = verdetto buono", saluteValida({ size: 1000, v: VERSIONE_SALUTE, monconi: 0 }, 1000));
  // la diagnosi di prima leggeva male gli indici in una cartella a parte:
  // i suoi verdetti si riguardano una volta
  t.c("un verdetto della diagnosi di prima si riguarda", !saluteValida({ size: 1000, monconi: 0, giunture: 5 }, 1000));
  t.c("misura diversa = si riguarda (i byte sono cambiati)", !saluteValida({ size: 1000 }, 1001));
  t.c("senza verdetto si riguarda", !saluteValida(null, 1000));
  t.c("e senza niente pure", !saluteValida(undefined, undefined));

  // ---- quando si ricuce -------------------------------------------------
  t.c("un taglio a metà frase basta", daRicucire({ monconi: 1, giunture: 0 }));
  t.c("tanti pezzi corti bastano", daRicucire({ monconi: 0, giunture: GIUNTURE_TANTE }));
  t.c("pochi pezzi corti no: frontespizio e colophon sono normali", !daRicucire({ monconi: 0, giunture: 3 }));
  t.c("il libro sano resta sano", !daRicucire({ monconi: 0, giunture: 0 }));
  t.c("il niente non esplode", !daRicucire(null));
  // la cura ci è già passata e non ha trovato niente: il banner non torna
  t.c("dopo una cura a vuoto non si offre più", !daRicucire({ monconi: 1, giunture: GIUNTURE_TANTE, vano: true }));
}
