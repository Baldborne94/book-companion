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

export function avanzoRicordato(id, chiave, storage = globalThis.localStorage) {
  try {
    const r = JSON.parse(storage?.getItem(chiaveRicordo(id)) || "null");
    if (!r || r.chiave !== chiave) return null;
    const n = Number(r.resto);
    return Number.isFinite(n) && n >= 0 ? n : null;
  } catch {
    return null;
  }
}

export function ricordaAvanzo(id, chiave, resto, storage = globalThis.localStorage) {
  const n = Number(resto);
  if (!id || !Number.isFinite(n) || n < 0) return;
  try {
    storage?.setItem(chiaveRicordo(id), JSON.stringify({ chiave, resto: n }));
  } catch {
    /* senza memoria si rimisura: costa e non rompe */
  }
}
