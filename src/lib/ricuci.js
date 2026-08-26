// LA RICUCITURA COME STANDARD DELLA LETTURA.
//
// Che il testo copra bene la pagina non è una cura da andare a cercare in
// un referto: è lo standard, per tutti i libri (chiesto dal lettore: «io
// voglio che sia uno standard della lettura, non solo per Eric»). Le tre
// porte sono: l'import, che ricuce i libri nuovi; la visita, che ricuce i
// tomi chiusi; e il READER, che alla prima apertura di ogni libro guarda
// una volta sola se è spezzato — e se non lo stai leggendo lo ricuce da
// sé, se lo stai leggendo te lo dice lì, col tasto.
//
// Il verdetto si scrive su disco (`salute_<id>` nello store aux, con la
// misura del file come impronta): la spezzatura si guarda UNA volta per
// libro, non a ogni apertura — aprire tutti i documenti della spina costa
// quanto generare le locations, e una volta basta.
import { getAux, putAux, putFile } from "./bookStore.js";
import { fattiDaEpub, GIUNTURE_TANTE } from "./visita.js";

const chiave = (id) => `salute_${id}`;

// il verdetto vale finché i byte sono quelli: cambia il file (una
// ricucitura, un reimport), cambia la misura, e si riguarda
export const saluteValida = (salute, size) => !!salute && salute.size === size;

// spezzato = tanti pezzi corti fuori indice, o anche UN taglio a metà frase
export const daRicucire = (salute) =>
  (salute?.monconi || 0) >= 1 || (salute?.giunture || 0) >= GIUNTURE_TANTE;

// il verdetto già scritto, se vale ancora: è la strada gratis, e chi
// chiama può risparmiarsi di aprire una seconda copia del libro
export async function saluteInCache(id, size) {
  try {
    const s = await getAux(chiave(id));
    return saluteValida(s, size) ? s : null;
  } catch {
    return null;
  }
}

export async function controllaSpezzatura(id, eb, size) {
  const inCache = await saluteInCache(id, size);
  if (inCache) return inCache;
  const fatti = await fattiDaEpub(eb);
  const nuovo = { size, monconi: fatti.monconi || 0, giunture: fatti.giunture || 0 };
  try {
    await putAux(chiave(id), nuovo);
  } catch {
    /* senza cache si riguarderà: costa, non rompe */
  }
  return nuovo;
}

// «Più tardi» si rispetta: il banner non torna a ogni apertura — la cura
// resta comunque nella visita, per quando il lettore cambia idea
export async function taci(id) {
  try {
    const s = (await getAux(chiave(id))) || {};
    await putAux(chiave(id), { ...s, taciuto: true });
  } catch {
    /* al massimo lo ridirà */
  }
}

// La ricucitura vera: riscrive i byte, rimette il libro in coda per il
// cloud, e butta le locations cachate — sono del libro vecchio, e
// tenerle vorrebbe dire percentuali sballate per sempre.
export async function ricuciLibro(id, blob) {
  const { unisciPezzi } = await import("./unisciEpub.js");
  const cucito = await unisciPezzi(blob);
  if (!cucito?.blob || !cucito.cuciti) return null;
  await putFile(id, cucito.blob);
  const { daRicaricare } = await import("./sync.js");
  daRicaricare(id);
  try {
    await putAux(`loc_${id}`, null);
    await putAux(chiave(id), null);
  } catch {
    /* la cache sbagliata cadrà al prossimo confronto di misura */
  }
  return { blob: cucito.blob, cuciti: cucito.cuciti };
}

// il libro è «in lettura» se ha un segno qualunque da proteggere: punto,
// segnalibri o evidenziazioni — la stessa regola della visita
export function conSegni(id) {
  const pieno = (k) => {
    try {
      const v = JSON.parse(localStorage.getItem(k) || "[]");
      return Array.isArray(v) && v.length > 0;
    } catch {
      return false;
    }
  };
  let progresso = 0;
  try {
    progresso = parseFloat(localStorage.getItem(`bc_prog_${id}`)) || 0;
  } catch {
    progresso = 0;
  }
  return (
    progresso > 0 ||
    !!localStorage.getItem(`bc_cfi_${id}`) ||
    pieno(`bc_marks_${id}`) ||
    pieno(`bc_hl_${id}`)
  );
}
