// La ricerca nel libro non deve essere alla lettera: chi cerca «muscle in»
// vuole trovare anche «muscling in», e chi cerca «muscling» vuole trovare
// «muscle». Da ogni parola della domanda si generano le flessioni regolari
// inglesi (avanti) e le possibili basi (indietro), e si cercano tutte: una
// forma che non esiste non compare nel testo e non costa niente.

const doppia = (s) => /(.)\1$/.test(s);

function flessioni(w) {
  const out = new Set();
  if (w.length < 3) return out;
  out.add(`${w}s`);
  out.add(`${w}es`);
  if (w.endsWith("e")) {
    out.add(`${w}d`);
    out.add(`${w.slice(0, -1)}ing`);
    out.add(`${w.slice(0, -1)}ed`);
  } else {
    out.add(`${w}ed`);
    out.add(`${w}ing`);
  }
  if (w.endsWith("y")) {
    out.add(`${w.slice(0, -1)}ies`);
    out.add(`${w.slice(0, -1)}ied`);
  }
  if (/[aeiou][bcdfgklmnprstvz]$/.test(w)) {
    out.add(`${w}${w[w.length - 1]}ed`);
    out.add(`${w}${w[w.length - 1]}ing`);
  }
  return out;
}

function basi(w) {
  const out = new Set();
  if (w.endsWith("ing") && w.length > 4) {
    const stem = w.slice(0, -3);
    out.add(stem);
    out.add(`${stem}e`);
    if (doppia(stem)) out.add(stem.slice(0, -1));
  } else if (w.endsWith("ied") && w.length > 4) {
    out.add(`${w.slice(0, -3)}y`);
  } else if (w.endsWith("ed") && w.length > 3) {
    const stem = w.slice(0, -2);
    out.add(stem);
    out.add(`${stem}e`);
    if (doppia(stem)) out.add(stem.slice(0, -1));
  } else if (w.endsWith("ies") && w.length > 4) {
    out.add(`${w.slice(0, -3)}y`);
  } else if (w.endsWith("es") && w.length > 3) {
    out.add(w.slice(0, -1));
    out.add(w.slice(0, -2));
  } else if (w.endsWith("s") && w.length > 3) {
    out.add(w.slice(0, -1));
  }
  out.delete(w);
  return out;
}

export function varianti(word) {
  const w = String(word || "").toLowerCase();
  const out = new Set([w]);
  for (const f of flessioni(w)) out.add(f);
  for (const b of basi(w)) {
    out.add(b);
    for (const f of flessioni(b)) out.add(f);
  }
  return out;
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Una sola espressione per tutta la domanda: ogni parola diventa il ventaglio
// delle sue forme (le lunghe per prime), le parole corte restano esatte per
// non prendere lucciole per lanterne, e fra una parola e l'altra va bene
// qualsiasi separatore. Confini di parola veri ai due capi.
export function queryRegex(query) {
  const words = String(query || "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}']+/u)
    .filter(Boolean);
  if (!words.length) return null;
  const parts = words.map((w) =>
    w.length >= 3
      ? `(?:${[...varianti(w)].sort((a, b) => b.length - a.length).map(esc).join("|")})`
      : esc(w)
  );
  return new RegExp(
    `(?<![\\p{L}\\p{N}])${parts.join("[^\\p{L}\\p{N}]+")}(?![\\p{L}\\p{N}])`,
    "giu"
  );
}
