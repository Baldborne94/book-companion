// LA COPERTINA GRANDE, PER LO SCHERMO INTERO. Chiesto dal lettore, davanti
// alla schermata di blocco: «riesci a rendermi l'immagine full HD?».
//
// Le copertine salvate (`bookStore`, store `covers`) sono al massimo 800
// pixel di lato (`LATO` in `copertina.js`): bastano alla scheda e allo
// scaffale, e si portano dietro in ogni sincronizzazione. Sul tablet la
// schermata di blocco e il salvaschermo sono 1200×2000 pixel veri: la
// copertina da 800 ci arriva ingrandita due volte e mezza, cioe' morbida.
// Ma la copertina vera sta nel file del libro, alla sua misura: si riestrae
// da li' (`copertinaOriginale`, lo stesso giro del tasto ↺ della scheda),
// con un tetto grande quanto lo schermo, e si ricade su quella salvata se
// il file non e' qui o non ha una copertina dentro.
//
// UNA COPERTINA MESSA A MANO RESTA QUELLA: chi ha scelto una foto per un
// libro la vuole anche a tutto schermo. La scheda segna la scelta
// (`segnaAMano`) e il tasto ↺ la toglie; solo su questo dispositivo, che e'
// dove la mano ha scelto.
//
// Le decisioni stanno qui, con i lettori iniettati, e si provano in Node.
import { LATO, fronteDaMostrare } from "./copertina.js";

export const LATO_GRANDE = 2400;
export const CHIAVE_MANO = (id) => `bc_cov_mano_${id}`;
// quante si tengono in memoria: quella in mano e l'ultima prima di lei
export const TENUTE = 2;

export function aMano(id, st = globalThis.localStorage) {
  try {
    return !!id && st?.getItem(CHIAVE_MANO(id)) === "1";
  } catch {
    return false;
  }
}
export function segnaAMano(id, si, st = globalThis.localStorage) {
  try {
    if (si) st?.setItem(CHIAVE_MANO(id), "1");
    else st?.removeItem(CHIAVE_MANO(id));
  } catch {
    /* senza memoria la scelta vale solo adesso */
  }
}

const memoria = new Map();

export function dimenticaGrande(id) {
  if (id == null) memoria.clear();
  else memoria.delete(id);
}

// `leggiFile(id)` → i byte del libro o null, `leggiCover(id)` → la
// copertina salvata o null, `estrai(libro, byte, max)` → la copertina dal
// file alla misura `max` o null. Torna un Blob o null. `verso` e' quello
// del fumetto (`versoDelLibro`): una sovraccoperta aperta mostra il fronte.
export function copertinaGrande(libro, { leggiFile, leggiCover, estrai, max = LATO_GRANDE, mano = aMano, verso = null, ritaglia = fronteDaMostrare } = {}) {
  const id = libro?.id;
  if (!id) return Promise.resolve(null);
  if (memoria.has(id)) return memoria.get(id);
  const p = (async () => {
    const b = await laCopertina();
    // una copertina messa a mano resta quella, anche larga
    return b && verso && !mano(id) ? ritaglia(b, verso, max) : b;
  })();
  async function laCopertina() {
    let grande = null;
    if (!mano(id) && max > LATO) {
      try {
        const bytes = await leggiFile?.(id);
        grande = bytes ? await estrai?.(libro, bytes, max) : null;
      } catch {
        grande = null;
      }
    }
    if (grande) return grande;
    try {
      return (await leggiCover?.(id)) || null;
    } catch {
      return null;
    }
  }
  memoria.set(id, p);
  while (memoria.size > TENUTE) memoria.delete(memoria.keys().next().value);
  return p;
}
