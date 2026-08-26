// LA RICUCITURA COME STANDARD: le decisioni pure, senza IndexedDB.
//
// Il verdetto sulla spezzatura vive su disco con la misura del file come
// impronta, e la parte che si sbaglia in silenzio è QUANDO fidarsi del
// verdetto vecchio e quando ricucire.
import { saluteValida, daRicucire } from "../src/lib/ricuci.js";
import { GIUNTURE_TANTE } from "../src/lib/visita.js";

export default async function (t) {
  // ---- quando il verdetto vecchio vale ----------------------------------
  t.c("stessa misura = verdetto buono", saluteValida({ size: 1000, monconi: 0 }, 1000));
  t.c("misura diversa = si riguarda (i byte sono cambiati)", !saluteValida({ size: 1000 }, 1001));
  t.c("senza verdetto si riguarda", !saluteValida(null, 1000));
  t.c("e senza niente pure", !saluteValida(undefined, undefined));

  // ---- quando si ricuce -------------------------------------------------
  t.c("un taglio a metà frase basta", daRicucire({ monconi: 1, giunture: 0 }));
  t.c("tanti pezzi corti bastano", daRicucire({ monconi: 0, giunture: GIUNTURE_TANTE }));
  t.c("pochi pezzi corti no: frontespizio e colophon sono normali", !daRicucire({ monconi: 0, giunture: 3 }));
  t.c("il libro sano resta sano", !daRicucire({ monconi: 0, giunture: 0 }));
  t.c("il niente non esplode", !daRicucire(null));
}
