// WIKTIONARY INGLESE SUL DISPOSITIVO.
//
// Chiesto dal lettore, con la foto del dizionario nelle Impostazioni: «non
// voglio solo il dizionario inglese italiano ma anche il dizionario solo
// inglese che mi da' il significato delle parole». I significati inglesi
// c'erano gia' — WordNet — ma corti, senza esempi, e senza le parole rare e
// arcaiche che un romanzo usa davvero. Scelto da lui fra le proposte: un
// dizionario inglese PIU' RICCO, da scaricare.
//
// La fonte e' Wiktionary inglese, la stessa che la scheda interroga in rete,
// estratta da wiktextract (kaikki.org) e ridotta da
// `scripts/dizionarioWiktionary.mjs` — che gira nella CI, perche' kaikki.org
// da qui non si raggiunge (`.github/workflows/dizionario-wiktionary.yml`).
// Sul dispositivo prende IL POSTO della rete, nello stesso punto
// (`fetchSenses` in `dictionary.js`): le forme flesse («plural of…»), i
// rimandi alle derivate e i modi di dire passano dalle stesse regole, e
// senza rete la scheda e' quella di sempre.
//
// SACCHI DI TRE LETTERE, non due come il dizionario di WordNet: le voci
// sono cinque volte tante, e «co», «re», «un» da soli sarebbero sacchi da
// megabyte da leggere a ogni tocco. I FILE invece sono per iniziale: ogni
// sacco sta per intero in un file solo, quindi un file riscritto copre i
// suoi sacchi senza resti, e lo scaricamento si riprende file per file.
import { getAux, putAux, putAuxMolti, removeAux, removeAuxPrefisso } from "./bookStore.js";
import { apri, raccogli } from "./dizionarioOffline.js";

const DEPOSITO = {
  leggi: getAux,
  scrivi: putAux,
  scriviMolti: putAuxMolti,
  togli: removeAux,
  togliPrefisso: removeAuxPrefisso,
};

export const CARTELLA = "/dizionario/wikt";
const PREFISSO = "wik:";
const META = "wik_meta";
const GIRO = "wik_giro";

const pulita = (s) => s.replace(/[^a-z0-9]/g, "_");
export function saccoWikt(parola) {
  const p = String(parola || "").toLowerCase();
  if (!p) return null;
  return PREFISSO + pulita(p.slice(0, 3));
}
// il file che porta un sacco: l'iniziale, o «_» per cifre e segni
export const fileDi = (parola) => {
  const c = String(parola || "").toLowerCase()[0] || "";
  return /[a-z]/.test(c) ? c : "_";
};

// ---------------------------------------------------------------------------
// DA WIKTEXTRACT ALLA VOCE (usato da chi costruisce, provato in Node)

// le categorie di wiktextract → una lettera nel file. Fuori i nomi propri
// (sono quelli del mondo reale, e in un romanzo di saga i nomi li spiegano
// il glossario e Lexicanum), i pezzi di parola e i simboli.
export const POS_KAIKKI = {
  noun: "n",
  verb: "v",
  adj: "a",
  adv: "r",
  pron: "o",
  prep: "p",
  prep_phrase: "x",
  phrase: "x",
  conj: "c",
  intj: "i",
  det: "d",
  num: "u",
  proverb: "k",
  abbrev: "b",
  article: "t",
  particle: "z",
  contraction: "e",
};
// e dalla lettera al nome inglese che `dictionary.js` sa gia' tradurre
export const POS_WIKT = {
  n: "noun",
  v: "verb",
  a: "adjective",
  r: "adverb",
  o: "pronoun",
  p: "preposition",
  x: "phrase",
  c: "conjunction",
  i: "interjection",
  d: "determiner",
  u: "numeral",
  k: "proverb",
  b: "abbreviation",
  t: "article",
  z: "particle",
  e: "contraction",
};

export const LIMITI = {
  parole: 4, // una voce di piu' parole e' un modo di dire; oltre, e' una frase
  lettere: 40,
  sensiPerVoce: 10,
  sensiPerCategoria: 6,
  forme: 2, // «plural of…» basta dirlo una volta o due
  esempi: 4, // gli esempi solo sui primi sensi: sono quelli che si leggono
  esempio: 180,
  glossa: 280,
};

const taglia = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const spazi = (s) => String(s || "").replace(/\s+/g, " ").trim();

// La chiave di una voce: minuscola, e solo se e' una parola che si puo'
// toccare in un libro — niente voci di sei parole, niente alfabeti che un
// romanzo inglese non usa.
export function chiaveKaikki(parola) {
  const w = spazi(parola).toLowerCase();
  if (!w || w.length > LIMITI.lettere) return null;
  if (w.split(" ").length > LIMITI.parole) return null;
  if (!/^[\p{Script=Latin}0-9' .-]+$/u.test(w)) return null;
  return w;
}

// Una riga di wiktextract → i sensi da aggiungere alla sua voce:
// `[lettera, glossa, esempio?]`. La glossa e' quella «raw», con le
// etichette davanti — «(archaic, transitive) To …» — com'e' scritta sul
// wiki: dicono proprio quel che serve a chi legge un romanzo.
export function sensiDaKaikki(riga) {
  if (!riga || riga.lang_code !== "en") return [];
  const lettera = POS_KAIKKI[riga.pos];
  if (!lettera) return [];
  const out = [];
  let forme = 0;
  for (const s of riga.senses || []) {
    if ((s.tags || []).includes("misspelling")) continue;
    const glossa = spazi((s.raw_glosses || s.glosses || []).at(-1));
    if (!glossa) continue;
    const forma = !!(s.form_of?.length || s.alt_of?.length);
    if (forma && ++forme > LIMITI.forme) continue;
    const ex = (s.examples || []).find((e) => e?.text && !e.ref && e.type !== "quotation" && spazi(e.text).length <= LIMITI.esempio);
    const senso = [lettera, taglia(glossa, LIMITI.glossa)];
    if (ex) senso.push(spazi(ex.text));
    out.push(senso);
    if (out.length >= LIMITI.sensiPerCategoria) break;
  }
  return out;
}

// I sensi nuovi si accodano a quelli che la voce ha gia' (le righe di
// wiktextract arrivano una per categoria e per etimologia, nell'ordine
// della pagina — che e' anche quello d'importanza). Gli esempi restano
// solo sui primi sensi della VOCE, non di ogni categoria.
export function accoda(voce = [], nuovi = []) {
  for (const s of nuovi) {
    if (voce.length >= LIMITI.sensiPerVoce) break;
    if (voce.some((v) => v[1] === s[1])) continue;
    voce.push(voce.length < LIMITI.esempi ? s : s.slice(0, 2));
  }
  return voce;
}

// ---------------------------------------------------------------------------
// LO SCARICAMENTO

export async function cartellinoWikt(fetcher) {
  try {
    const r = await (fetcher || fetch)(`${CARTELLA}/meta.json`);
    if (!r.ok) return null;
    const j = await r.json();
    return j?.voci && Array.isArray(j.file) ? j : null;
  } catch {
    return null;
  }
}

// FILE PER FILE, E SI RIPRENDE. Dopo ogni file si scrivono prima i suoi
// sacchi e poi il segno «fatto»; il cartellino `wik_meta` solo alla fine,
// come nel dizionario di WordNet: finche' manca, il dizionario non si
// dichiara sul dispositivo. Se intanto il dizionario sul sito e' stato
// rifatto (un'altra `versione`), la ripresa riparte da capo: mescolare
// file di due versioni darebbe sacchi di un'altra annata.
export async function scaricaWiktionary({ fetcher = fetch, deposito = DEPOSITO, onProgress, fermo = () => false } = {}) {
  const cartellino = await cartellinoWikt(fetcher);
  if (!cartellino) throw new Error("il dizionario Wiktionary non si trova sul sito: riprova più tardi");
  let giro = await deposito.leggi(GIRO);
  if (!giro || giro.versione !== cartellino.quando) giro = { versione: cartellino.quando, fatti: [], byte: 0 };
  const totale = cartellino.file.reduce((n, f) => n + (f.byte || 0), 0);
  const avanti = (extra = 0) =>
    onProgress?.({ fatti: giro.fatti.length, file: cartellino.file.length, scaricati: giro.byte + extra, totale });
  avanti();
  for (const f of cartellino.file) {
    if (giro.fatti.includes(f.n)) continue;
    if (fermo()) return { ...giro, fermato: true, file: cartellino.file.length };
    const res = await fetcher(`${CARTELLA}/${f.n}.json.gz`);
    if (!res.ok) throw new Error(`il dizionario non si scarica (${res.status})`);
    const byte = await raccogli(res, (p) => avanti(p.scaricati));
    const sacchi = JSON.parse(await apri(byte));
    await deposito.scriviMolti(Object.entries(sacchi));
    giro = { ...giro, fatti: [...giro.fatti, f.n], byte: giro.byte + byte.length };
    await deposito.scrivi(GIRO, giro);
    avanti();
  }
  APERTI.clear();
  installato = null;
  const meta = { voci: cartellino.voci, byte: giro.byte, versione: cartellino.quando, quando: Date.now() };
  await deposito.scrivi(META, meta);
  await deposito.togli(GIRO).catch(() => {});
  return meta;
}

export async function statoWiktionary(deposito = DEPOSITO) {
  try {
    const m = await deposito.leggi(META);
    return m?.voci ? m : null;
  } catch {
    return null;
  }
}

export async function giroWiktionary(deposito = DEPOSITO) {
  try {
    const g = await deposito.leggi(GIRO);
    return g?.fatti?.length ? g : null;
  } catch {
    return null;
  }
}

export async function rimuoviWiktionary(deposito = DEPOSITO) {
  APERTI.clear();
  installato = null;
  await deposito.togli(META).catch(() => {});
  await deposito.togli(GIRO).catch(() => {});
  await deposito.togliPrefisso(PREFISSO);
}

// ---------------------------------------------------------------------------
// LA RICERCA

const APERTI = new Map();
const APERTI_MAX = 12;
let installato = null;
async function leggiSacco(s, deposito) {
  if (deposito !== DEPOSITO) return deposito.leggi(s);
  if (APERTI.has(s)) {
    const v = APERTI.get(s);
    APERTI.delete(s);
    APERTI.set(s, v);
    return v;
  }
  const v = (await deposito.leggi(s)) || null;
  APERTI.set(s, v);
  if (APERTI.size > APERTI_MAX) APERTI.delete(APERTI.keys().next().value);
  return v;
}

// Torna `[[nome inglese della categoria, glossa, esempio?], …]`, vuoto se il
// dizionario non c'e' o non conosce la parola. Il cartellino si guarda una
// volta per sessione: senza dizionario, ogni ricerca non deve costare una
// lettura di sacco a vuoto.
export const dimenticaStato = () => {
  installato = null;
};
export async function sensiWikt(parola, deposito = DEPOSITO) {
  const p = String(parola || "").toLowerCase().trim();
  const s = saccoWikt(p);
  if (!s) return [];
  try {
    if (deposito === DEPOSITO) {
      if (installato === null) installato = !!(await statoWiktionary(deposito));
      if (!installato) return [];
    }
    const dentro = await leggiSacco(s, deposito);
    return (dentro?.[p] || []).map(([l, glossa, esempio]) => [POS_WIKT[l] || l, glossa, esempio]);
  } catch {
    return [];
  }
}

// La riga del lavoro: quanti file e quanti mega
export function fraseWiktionary(p) {
  if (!p) return "";
  const mb = (n) => `${(n / 1048576).toFixed(0)} MB`;
  const peso = p.totale >= 1048576 ? ` · ${mb(p.scaricati || 0)} di ${mb(p.totale)}` : "";
  return `${p.fatti} di ${p.file} parti${peso}`;
}
