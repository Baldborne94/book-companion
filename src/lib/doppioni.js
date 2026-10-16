// I DOPPIONI DEI FUMETTI (segnalato dal lettore davanti alla raccolta di
// Walking Dead: «non mi pare giusto che si veda così» — il Vol. 01 tre
// volte, schede «CBR» senza copertina accanto alle stesse in CBZ). Sono
// nati prima che l'importazione da Drive saltasse i gemelli di Colab: la
// cartella entrava con il CBR e il suo CBZ, due schede per volume. Il
// riconoscimento per impronta («Riconosci i doppioni») non li vede: un CBR
// e il suo CBZ hanno byte diversi. Qui si riconoscono dal TITOLO, solo fra
// i fumetti, e di ogni gruppo si tiene la scheda che conta di piu'.
//
// E POI ANCHE I LIBRI (segnalato dal lettore coi Dragonriders of Pern:
// «Dragonflight» due volte, una col file su Drive e una col triangolo «né
// qui né nel cloud»). Per un romanzo il titolo da solo e' troppo poco —
// «Racconti» di due autori sono due libri — e quindi vogliono lo stesso
// titolo, lo STESSO AUTORE (scritto, non vuoto) e lo stesso formato.

const EST = /\.(cbz|cbr|zip|rar)$/i;
export const chiaveVolume = (b) =>
  String(b?.title || "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(EST, "")
    .trim()
    .toLowerCase();

const eFumetto = (b) => b?.fileType === "cbz" || b?.fileType === "cbr";
const chiaveAutore = (a) =>
  String(a || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
// LO STESSO VOLUME SCRITTO IN DUE MODI (segnalato dal lettore: «Kill Six
// Billion Demons v05 - Breaker of Infinities-0021» accanto a «… - Book 05 -
// Breaker of Infinities (2026) (digital) (Son of Ultron-Empire)», tutt'e
// due col 5, e la Manutenzione taceva). Fra i fumetti, la stessa saga, lo
// stesso numero e lo stesso titolo VERO: quel che resta togliendo la saga, i
// numeri (anche la copia di Drive, «-0021») e le etichette fra parentesi. Un
// titolo vero vuoto non basta: «Saga v01» e «Saga Vol. 1» possono essere
// due edizioni diverse, e nel dubbio niente.
const NUMERO = /^(v|vol|volume|book|tomo|tome|part|parte|n|no)?\d+$/;
const ANNUNCIA = new Set(["v", "vol", "volume", "book", "tomo", "tome", "part", "parte", "libro"]);
const IN_LETTERE = new Set("one two three four five six seven eight nine ten eleven twelve uno due tre quattro cinque sei sette otto nove dieci undici dodici".split(" "));
export function titoloVero(b) {
  const saga = new Set(chiaveAutore(b?.saga).split(" ").filter(Boolean));
  const parole = chiaveAutore(String(b?.title || "").replace(EST, "").replace(/[([][^)\]]*[)\]]/g, " ")).split(" ").filter(Boolean);
  return parole.filter((w, i) => !saga.has(w) && !NUMERO.test(w) && !ANNUNCIA.has(w) && !(IN_LETTERE.has(w) && ANNUNCIA.has(parole[i - 1]))).join(" ");
}
const chiaveVera = (b) => {
  if (!eFumetto(b) || !b.saga || !(Number(b.sagaOrder) > 0)) return "";
  const t = titoloVero(b);
  return t ? `vero|${chiaveAutore(b.saga)}|${Number(b.sagaOrder)}|${t}` : "";
};
const chiaveGruppo = (b) => {
  const t = chiaveVolume(b);
  if (!t) return "";
  if (eFumetto(b)) return `fumetto|${t}`;
  const a = chiaveAutore(b.author);
  return a ? `${b.fileType}|${t}|${a}` : "";
};

// Quale tenere, in quest'ordine: quella che ha il FILE (una scheda senza
// file non si apre: tenerla e buttare l'altra lascerebbe il libro muto),
// quella che stai leggendo (piu' avanti vince), quella coi segnalibri, il
// CBZ sul CBR (si legge a pezzi), quella con la copertina, e a parita' la
// piu' vecchia (la scheda di sempre).
function peso(b, { progresso, stato, segni, copertina, conFile }) {
  const p = Number(progresso(b.id)) || 0;
  const s = stato(b.id);
  return [conFile(b.id) ? 1 : 0, s === "read" || s === "reading" || p > 0 ? 1 : 0, p, segni(b.id), b.fileType === "cbz" ? 1 : 0, copertina(b.id) ? 1 : 0, -(Number(b.addedAt) || 0)];
}
const prima = (a, b) => {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return b[i] - a[i];
  return 0;
};

export function doppioniInBiblioteca(libri, { progresso = () => 0, stato = () => "unread", segni = () => 0, copertina = () => false, conFile = () => true } = {}) {
  // due chiavi, e un libro che ne condivide una con un altro sta nel suo
  // gruppo: le due strade si uniscono (chi e' doppione per titolo e chi lo
  // e' per titolo vero)
  const capo = new Map();
  const su = (x) => (capo.get(x) === x ? x : capo.set(x, su(capo.get(x))).get(x));
  const primoDi = new Map();
  const tutti = (libri || []).filter((b) => b?.id);
  for (const b of tutti) capo.set(b.id, b.id);
  for (const b of tutti)
    for (const k of [chiaveGruppo(b), chiaveVera(b)]) {
      if (!k) continue;
      if (!primoDi.has(k)) primoDi.set(k, b.id);
      else capo.set(su(b.id), su(primoDi.get(k)));
    }
  const gruppi = new Map();
  for (const b of tutti) {
    const r = su(b.id);
    if (!gruppi.has(r)) gruppi.set(r, []);
    gruppi.get(r).push(b);
  }
  const out = [];
  for (const g of gruppi.values()) {
    if (g.length < 2) continue;
    const pesati = g.map((b) => ({ b, p: peso(b, { progresso, stato, segni, copertina, conFile }) })).sort((x, y) => prima(x.p, y.p));
    out.push({ titolo: pesati[0].b.title, tieni: pesati[0].b.id, via: pesati.slice(1).map((x) => x.b.id) });
  }
  return out.sort((a, b) => a.titolo.localeCompare(b.titolo, "it", { numeric: true }));
}
