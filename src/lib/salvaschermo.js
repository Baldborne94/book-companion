// IL SALVASCHERMO CON LA COPERTINA, come il Kindle.
//
// Chiesto dal lettore: «molte copertine sono proprio artistiche, e averle
// tipo salvaschermo sarebbe figo». E c'è un motivo che va oltre la bellezza:
// l'app tiene lo schermo acceso finché è davanti (Wake Lock in `App.jsx`), e
// chi si addormenta col libro aperto ritrova il tablet acceso al mattino.
// Dopo un po' senza tocchi la copertina prende lo schermo; dopo un altro po'
// la presa si lascia, e il tablet si spegne coi suoi tempi.
//
// Qui solo le decisioni, provate in Node; il conto del tempo e la presa
// stanno in `App.jsx`, la copertina in `components/Salvaschermo.jsx`.

const CHIAVE = "bc_salvaschermo";

// in minuti; 0 vuol dire «mai». Con la copertina a «mai» il salvaschermo
// è spento del tutto, e lo schermo resta acceso come prima: il «poi» si
// conta dalla copertina, e senza copertina non c'è un poi.
export const SCELTE_COPERTINA = [3, 5, 10, 15, 0];
export const SCELTE_SPEGNI = [5, 10, 30, 0];
// cinque minuti e non tre: una pagina fitta letta piano non deve sfumare
// sotto gli occhi di chi la sta leggendo
export const PREDEFINITO = { copertina: 5, spegni: 10 };

const minuti = (v, ripiego) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : ripiego);

// le preferenze salvate SOPRA il predefinito, mai il contrario (lezione 9)
export function leggiSalvaschermo(storage = globalThis.localStorage) {
  let salvate = {};
  try {
    salvate = JSON.parse(storage?.getItem(CHIAVE) || "{}") || {};
  } catch {
    salvate = {};
  }
  return {
    copertina: minuti(salvate.copertina, PREDEFINITO.copertina),
    spegni: minuti(salvate.spegni, PREDEFINITO.spegni),
  };
}

export function scriviSalvaschermo(cambi, storage = globalThis.localStorage) {
  const v = { ...leggiSalvaschermo(storage), ...cambi };
  try {
    storage?.setItem(CHIAVE, JSON.stringify(v));
  } catch {
    /* memoria piena o negata: resta quel che c'era */
  }
  return v;
}

const MIN = 60000;

// Dove siamo dopo `fermo` millisecondi senza segni di vita. Un lavoro lungo
// (CBR, wiki, dizionario, disco) tiene sveglio tutto: la sua barra deve
// restare in vista e il tablet acceso, o il lavoro si ferma col sonno.
export function fase({ fermo = 0, copertina = 0, spegni = 0, lavoroLungo = false } = {}) {
  if (lavoroLungo || !(copertina > 0)) return "sveglio";
  if (fermo < copertina * MIN) return "sveglio";
  if (spegni > 0 && fermo >= (copertina + spegni) * MIN) return "spento";
  return "copertina";
}

// Fra quanto la fase cambia, per un solo timer invece di un orologio che
// ticchetta. `null` = non cambierà da sola. Durante un lavoro lungo si
// riguarda ogni minuto: il lavoro finisce senza che nessuno tocchi niente.
export function prossimoCambio({ fermo = 0, copertina = 0, spegni = 0, lavoroLungo = false } = {}) {
  if (lavoroLungo) return MIN;
  if (!(copertina > 0)) return null;
  const a = copertina * MIN - fermo;
  if (a > 0) return a;
  // con «poi mai» il conto qui sotto e' gia' passato: torna da se' `null`
  const b = (copertina + spegni) * MIN - fermo;
  return b > 0 ? b : null;
}

export const fraseMinuti = (m) => (m > 0 ? `${m} min` : "Mai");
