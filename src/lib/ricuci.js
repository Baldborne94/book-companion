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
import { daButtareRicucendo } from "./misuraSalvata.js";

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

// LA RICUCITURA IN MEMORIA, per il libro che sta su Drive e qui non c'e':
// gli stessi pezzi uniti allo stesso modo, ma niente scritto su disco —
// scriverlo farebbe del tablet la copia «diversa» da Drive che «Libera
// spazio» deve poi spiegare. E' deterministica: lo stesso file da' lo
// stesso ricucito a ogni apertura, quindi i CFI dei segni presi su una
// lettura valgono sulla prossima. Le locations cachate si buttano lo
// stesso: sono del file com'era.
// E IL RICUCITO SI RICORDA, legato al file da cui viene (una `WeakMap`
// sul Blob): il file scaricato resta in memoria per la sessione
// (`lib/ultimiLontani.js`) e riaprendolo e' lo STESSO oggetto, quindi non
// si ricuce di nuovo — misurato ~2 s a ogni riapertura col processore
// rallentato quattro volte. Quando il file esce da quella memoria, esce
// anche il suo ricucito.
//
// E LA MISURA DELLE PAGINE NON SI BUTTA PIU' A OGNI APERTURA: porta la
// grandezza del file misurato (`lib/misuraSalvata.js`) e si scarta da se'
// se non e' di questo. Si butta solo quella scritta prima, che non dice di
// chi e'.
const CUCITI = new WeakMap();
export function ricuciInMemoria(id, blob, opzioni = {}) {
  // si ricorda anche la ricucitura IN CORSO, non solo quella finita: chiuso
  // il libro a meta' cura e riaperto subito, la seconda apertura aspetta
  // quella invece di ricominciarne un'altra
  const tienila = blob && typeof blob === "object";
  if (tienila && CUCITI.has(blob)) return CUCITI.get(blob);
  const p = ricuci(id, blob, opzioni).catch((e) => {
    if (tienila) CUCITI.delete(blob);
    throw e;
  });
  if (tienila) CUCITI.set(blob, p);
  return p;
}

async function ricuci(id, blob, { leggiMisura = (k) => getAux(k), scriviMisura = (k, v) => putAux(k, v), unisci } = {}) {
  const cuci = unisci || (await import("./unisciEpub.js")).unisciPezzi;
  const cucito = await cuci(blob);
  if (!cucito?.blob || !cucito.cuciti) return null;
  try {
    if (daButtareRicucendo(await leggiMisura(`loc_${id}`))) await scriviMisura(`loc_${id}`, null);
  } catch {
    /* la cache sbagliata cadra' al prossimo confronto di misura */
  }
  cucito.blob.lontano = true;
  // IL RICUCITO NON SI VISITA: il verdetto «spezzato» e' del file vero, e
  // un controllo sul ricucito scriverebbe «sano» con la sua grandezza al
  // posto di quello. All'apertura dopo il verdetto non combacerebbe piu',
  // il libro si mostrerebbe spezzato e si ricucirebbe sotto gli occhi —
  // una volta si' e una no (misurato, ed era cosi' anche prima di questa
  // memoria)
  cucito.blob.ricucito = true;
  return { blob: cucito.blob, cuciti: cucito.cuciti };
}

// La ricucitura vera: riscrive i byte e butta le locations cachate — sono del libro vecchio, e
// tenerle vorrebbe dire percentuali sballate per sempre.
export async function ricuciLibro(id, blob) {
  const { unisciPezzi } = await import("./unisciEpub.js");
  const cucito = await unisciPezzi(blob);
  if (!cucito?.blob || !cucito.cuciti) return null;
  await putFile(id, cucito.blob);
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
