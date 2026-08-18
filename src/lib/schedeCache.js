import { getAux, putAux } from "./bookStore.js";

// LE SCHEDE DELL'ORACOLO NON DEVONO MORIRE COL LIBRO CHIUSO.
//
// La cache stava in un `useRef`: viveva quanto il libro restava aperto.
// Sopra ci avevamo pero' costruito la regola che il lettore aveva chiesto
// — «Chi è costui?» non si rifà a ogni pagina, si rifà solo se di lui è
// successo qualcosa di nuovo — e quella regola funzionava SOLO dentro una
// sessione. Chiudevi il libro, lo riaprivi la sera, ritoccavi lo stesso
// nome: niente con cui confrontare, e la scheda si rifaceva da zero. Su
// una saga lunga vuol dire ricollezionare cento passaggi e ripagare la
// chiamata per una risposta identica a quella di ieri.
//
// Qui le voci si posano su IndexedDB, come la cache del vocabolario
// (`dict_cache`): una scatola per libro, e quel che c'è dentro basta a se'
// stesso — la scheda si rilegge anche senza rete e senza chiave.

// Quante tenerne per libro. Sono prosa più i passaggi che le fanno da
// prova, quindi non sono leggere: oltre questa soglia si butta la meno
// usata di recente.
export const MAX_SCHEDE = 8;

const CHIAVE = (bookId) => `schede_${bookId}`;

// SOLO LE SCHEDE-PERSONAGGIO. «Dove eravamo rimasti» si rifà per
// definizione a ogni richiesta — il suo senso è «fin dove sono ADESSO» — e
// scriverla su disco vorrebbe dire pagare una scrittura per una voce che
// il giro dopo viene buttata via.
export const daTenere = (chiave) => String(chiave || "").startsWith("chi:");

export const trova = (voci = [], chiave) => voci.find((v) => v?.chiave === chiave) || null;

// Si posa in fondo e si butta la MENO USATA DI RECENTE, non la più
// vecchia: una cache che vive fra una sessione e l'altra vede lo stesso
// personaggio tornare a distanza di giorni, e buttarlo perché lo avevi
// conosciuto per primo è esattamente il contrario di quello che serve.
export function riponi(voci = [], voce, ora = Date.now(), max = MAX_SCHEDE) {
  if (!voce?.chiave || !voce?.dato) return voci;
  const resto = voci.filter((v) => v?.chiave !== voce.chiave);
  const next = [...resto, { ...voce, usata: ora }];
  if (next.length <= max) return next;
  return [...next].sort((a, b) => (a.usata || 0) - (b.usata || 0)).slice(next.length - max);
}

// La lettura conta come uso: senza, una scheda riusata per settimane
// resterebbe la prima candidata a essere buttata.
export function tocca(voci = [], chiave, ora = Date.now()) {
  return voci.map((v) => (v?.chiave === chiave ? { ...v, usata: ora } : v));
}

export async function leggiSchede(bookId) {
  if (!bookId) return [];
  try {
    const v = await getAux(CHIAVE(bookId));
    return Array.isArray(v?.voci) ? v.voci.filter((e) => e?.chiave && e?.dato) : [];
  } catch {
    // senza cache la scheda si rifà: costa, ma non rompe niente
    return [];
  }
}

export async function scriviSchede(bookId, voci) {
  if (!bookId) return;
  try {
    await putAux(CHIAVE(bookId), { v: 1, voci });
  } catch {
    /* niente spazio o niente store: la scheda resta buona per questa sessione */
  }
}

export const chiaveSchede = CHIAVE;
