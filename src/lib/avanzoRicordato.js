// L'AVANZO DI RIGA SI RICORDA, cosi' il libro si apre gia' della misura
// giusta (chiesto dal lettore fra le cose da rendere piu' veloci: «fai l'1»,
// l'apertura di un libro).
//
// Misurato su un romanzo da 150 mila parole col processore rallentato
// quattro volte: il testo del capitolo e' pronto ~500 ms dopo il tocco, la
// candela si spegne dopo ~1200. I 700 in mezzo sono il giro dell'avanzo —
// 350 ms perche' epub.js finisca di impaginare, la misura, il ritaglio che
// reimpagina, altri 300 — rifatto identico a OGNI apertura, perche' l'avanzo
// nasceva a zero con ogni reader. Ma l'avanzo e' una funzione della
// geometria: altezza della colonna e interlinea in pixel. Con la stessa
// finestra e le stesse impostazioni e' lo stesso numero di ieri.
//
// Quindi si tiene per libro, con la CHIAVE di quel che lo determina, e il
// reader nasce col ritaglio gia' applicato: la misura si fa lo stesso,
// subito, e conferma — se non conferma, si ritaglia come prima sotto la
// candela, e non si e' perso niente. Il libro sta nella chiave perche' il
// suo foglio di stile puo' vincere sull'interlinea (una classe batte un
// tag), e la finestra perche' ruotando il tablet la colonna cambia.
//
// Sta sul dispositivo (`localStorage`): dice quanto e' alta la colonna di
// QUESTO schermo, e su un altro sarebbe un numero sbagliato.

export const chiaveRicordo = (id) => `bc_avanzo_${id}`;

export function chiaveAvanzo({ larghezza, altezza, settings = {} } = {}) {
  const s = settings || {};
  return [
    Math.round(Number(larghezza) || 0),
    Math.round(Number(altezza) || 0),
    s.fontSize ?? "",
    s.lineHeight ?? "",
    s.font ?? "",
    s.flow ?? "",
  ].join("|");
}

// PIU' GEOMETRIE PER LIBRO (il rapporto del lettore: un'apertura con
// 5,3 s di «pagina pronta»; riprodotto alla misura del tablet col
// processore rallentato sei volte: 8,2 s alla prima apertura contro 4,0
// alla seconda, e la differenza e' il ritaglio che reimpagina il capitolo
// sotto la candela). Si teneva UNA geometria per libro: girando il tablet
// la misura sdraiata cancellava quella in piedi, e il lettore che legge in
// tutt'e due i versi ripagava il ritaglio a ogni giro. Adesso le ultime
// `GEOMETRIE_PER_LIBRO`, la piu' recente in testa. La forma di prima
// (`{ chiave, resto }`) si legge ancora
export const GEOMETRIE_PER_LIBRO = 4;
const voci = (r) => {
  if (Array.isArray(r?.voci)) return r.voci.filter((v) => Array.isArray(v) && v.length === 2);
  if (r && typeof r.chiave === "string") return [[r.chiave, r.resto]];
  return [];
};
const buono = (n) => (Number.isFinite(Number(n)) && Number(n) >= 0 ? Number(n) : null);
const leggiJson = (storage, k) => {
  try {
    return JSON.parse(storage?.getItem(k) || "null");
  } catch {
    return null;
  }
};

export function avanzoRicordato(id, chiave, storage = globalThis.localStorage) {
  const v = voci(leggiJson(storage, chiaveRicordo(id))).find(([k]) => k === chiave);
  return v ? buono(v[1]) : null;
}

// E UN LIBRO NUOVO PARTE DA QUEL CHE SI SA DELLO SCHERMO: l'avanzo e' una
// funzione della colonna e dell'interlinea, e con la stessa finestra e le
// stesse impostazioni l'ultimo libro aperto ha quasi sempre lo stesso
// numero (la tipografia la mette il reader). E' un'IPOTESI, non un ricordo:
// il reader misura comunque, e se il foglio di stile del libro vince
// sull'interlinea si ritaglia come prima — non si perde niente, ed e' per
// questo che il libro resta fuori dalla chiave qui e dentro in
// `avanzoRicordato`
export const CHIAVE_SCHERMO = "bc_avanzo_schermo";
export const GEOMETRIE_SCHERMO = 8;
export function avanzoDaAltri(chiave, storage = globalThis.localStorage) {
  const v = voci(leggiJson(storage, CHIAVE_SCHERMO)).find(([k]) => k === chiave);
  return v ? buono(v[1]) : null;
}

const metti = (lista, chiave, n, tetto) => [[chiave, n], ...lista.filter(([k]) => k !== chiave)].slice(0, tetto);

export function ricordaAvanzo(id, chiave, resto, storage = globalThis.localStorage) {
  const n = Number(resto);
  if (!id || !Number.isFinite(n) || n < 0) return;
  try {
    storage?.setItem(chiaveRicordo(id), JSON.stringify({ voci: metti(voci(leggiJson(storage, chiaveRicordo(id))), chiave, n, GEOMETRIE_PER_LIBRO) }));
    storage?.setItem(CHIAVE_SCHERMO, JSON.stringify({ voci: metti(voci(leggiJson(storage, CHIAVE_SCHERMO)), chiave, n, GEOMETRIE_SCHERMO) }));
  } catch {
    /* senza memoria si rimisura: costa e non rompe */
  }
}
