// GLI ALTRI LIBRI DEGLI AUTORI CHE SEGUI, PER SAGA (`components/AltriDellAutore.jsx`
// in fondo alla raccolta seguita, `test/altri-dell-autore.test.mjs`).
//
// Chiesto dal lettore: «una sezione dedicata ai libri o saghe che
// quell'autore che sto seguendo ha pubblicato, che non ho». La prima forma
// prendeva le opere da Open Library ed e' stata bocciata con una foto: «mi
// stai spammando libri di qualsiasi lingua… io voglio i libri originali,
// col titolo in inglese, e a quale saga fanno riferimento; se è già nella
// raccolta me lo specifichi». Open Library tiene ogni traduzione come
// un'opera a se' (Lockwood in polacco, olandese, tedesco), gli omonimi
// (l'apicoltura di un altro Jonathan Stroud), i cofanetti, e non dice la
// saga.
//
// Ora le opere vengono da WIKIDATA: chi ne e' l'autore (P50), il titolo
// inglese, la serie (P179) col numero (qualificatore P1545), l'anno (P577).
// Si tengono solo i libri (opera letteraria, romanzo, opera scritta): non le
// edizioni, non le serie stesse, non i fumetti numero per numero. E si
// raggruppa per saga: «Lockwood & Co. · 5 libri — te ne mancano 2», poi i
// libri che Wikidata non lega a una saga. Misurato: Stroud ha Bartimaeus
// #1–4 e Lockwood #1–5; di Abnett Wikidata ha quasi tutti i romanzi ma ne
// lega a una saga pochi, e gli altri stanno in fondo, detti per quel che sono.
import { formeDelTitolo } from "./serieWikidata.js";
import { chiaveAutore } from "./sagaBooks.js";
import { idTitolo } from "./daPrendere.js";

export const API = "https://www.wikidata.org/w/api.php";
export const IN_VISTA = 5;
export const SCADENZA = 7 * 24 * 60 * 60 * 1000;
const CHIAVE = "bc_altri_autore";
const TENUTI = 30;

// i libri: opera letteraria, romanzo, opera scritta, novella, raccolta di racconti
export const LIBRI = ["Q7725634", "Q8261", "Q47461344", "Q149537", "Q1279564"];
// chi scrive: scrittore, romanziere, autore, fumettista-scrittore, poeta, autore per ragazzi
export const SCRITTORI = ["Q36180", "Q6625963", "Q482980", "Q15949613", "Q49757", "Q4853732", "Q18844224"];

const valore = (c) => c?.mainsnak?.datavalue?.value;
const ids = (claims, p) => (claims?.[p] || []).map((c) => valore(c)?.id).filter(Boolean);
const indirizzo = (p) => `${API}?${new URLSearchParams({ format: "json", origin: "*", ...p })}`;

// l'autore giusto fra quelli col suo nome: il primo che di mestiere scrive
export function sceltaAutore(candidati = [], entita = {}) {
  for (const c of candidati) if (ids(entita[c]?.claims, "P106").some((m) => SCRITTORI.includes(m))) return c;
  return null;
}

// un'entita' di Wikidata → un libro, o niente
export function libroDa(e, nomiSerie = {}) {
  const c = e?.claims || {};
  const titolo = e?.labels?.en?.value;
  if (!titolo || !ids(c, "P31").some((t) => LIBRI.includes(t))) return null;
  const s = (c.P179 || [])[0];
  const sagaId = valore(s)?.id || null;
  const numero = s?.qualifiers?.P1545?.[0]?.datavalue?.value ?? null;
  const tempo = String(valore((c.P577 || [])[0])?.time || "");
  const nomi = [
    ...Object.values(e.labels || {}).map((l) => l?.value),
    ...Object.values(e.aliases || {}).flatMap((l) => (l || []).map((a) => a?.value)),
  ].filter(Boolean);
  return {
    titolo,
    anno: Number(tempo.slice(1, 5)) || null,
    saga: sagaId ? nomiSerie[sagaId] || null : null,
    sagaId,
    numero: numero != null && /^\d+(\.\d+)?$/.test(String(numero)) ? Number(numero) : null,
    nomi,
  };
}

// ce l'hai: uno dei suoi nomi (inglese, italiano, alias) combacia con un tuo titolo
export function ceLHai(libro, books = []) {
  const forme = new Set(libro.nomi.flatMap(formeDelTitolo));
  return books.some((b) => formeDelTitolo(b?.title).some((f) => forme.has(f)));
}

// I GRUPPI: una saga alla volta, nell'ordine in cui sono cominciate, i libri
// nel loro ordine; in fondo quelli senza saga. Per ogni gruppo quanti sono,
// quanti ne hai, e quelli che mancano.
export function perSaga(libri = [], books = [], lista = [], autore = "") {
  const nella = new Set((lista || []).filter((v) => v && !v.deleted && !v.scartata).map((v) => v.id));
  const gruppi = new Map();
  const visti = new Set();
  for (const l of libri) {
    const k = formeDelTitolo(l.titolo)[0] || l.titolo;
    if (visti.has(k)) continue;
    visti.add(k);
    const g = l.saga || "";
    if (!gruppi.has(g)) gruppi.set(g, []);
    gruppi.get(g).push(l);
  }
  const ordine = (a, b) => (a.numero ?? 999) - (b.numero ?? 999) || (a.anno || 9999) - (b.anno || 9999) || a.titolo.localeCompare(b.titolo);
  const fuori = [...gruppi.entries()].map(([saga, voci]) => {
    const tutti = [...voci].sort(ordine);
    const mancano = tutti.filter((l) => !ceLHai(l, books)).map((l) => ({ ...l, gia: nella.has(idDaPrendere(l, autore)) }));
    return { saga: saga || null, totale: tutti.length, hai: tutti.length - mancano.length, mancano, inizio: Math.min(...tutti.map((l) => l.anno || 9999)) };
  });
  return fuori.sort((a, b) => Number(!a.saga) - Number(!b.saga) || a.inizio - b.inizio || String(a.saga).localeCompare(String(b.saga)));
}

// la voce di «Da prendere»: titolo e autore come le altre
export const idDaPrendere = (l, autore = "") => idTitolo(l.titolo, autore);

// la riga accanto al nome della saga
export function fraseGruppo(g) {
  if (!g.mancano.length) return g.totale === 1 ? "✓ ce l'hai" : "✓ li hai tutti";
  if (!g.hai) return g.totale === 1 ? "non ce l'hai" : "non ne hai nessuno";
  return g.mancano.length === 1 ? "te ne manca 1" : `te ne mancano ${g.mancano.length}`;
}

// ---- dalla rete -----------------------------------------------------------------

// Le opere di un autore su Wikidata: `prendi(url)` da' il JSON (iniettata,
// cosi' si prova in Node). Torna i libri, gia' coi nomi delle saghe.
export async function opereDaWikidata(autore, prendi) {
  const s = await prendi(indirizzo({ action: "wbsearchentities", search: autore, language: "en", uselang: "en", type: "item", limit: "5" }));
  const candidati = (s?.search || []).map((x) => x.id).filter(Boolean);
  if (!candidati.length) return [];
  const e = await prendi(indirizzo({ action: "wbgetentities", ids: candidati.join("|"), props: "claims" }));
  const q = sceltaAutore(candidati, e?.entities || {});
  if (!q) return [];
  const m = await prendi(indirizzo({ action: "query", list: "search", srsearch: `haswbstatement:P50=${q}`, srlimit: "500", srnamespace: "0" }));
  const opere = (m?.query?.search || []).map((x) => x.title).filter((x) => /^Q\d+$/.test(x));
  const entita = {};
  for (let i = 0; i < opere.length; i += 50) {
    const r = await prendi(indirizzo({ action: "wbgetentities", ids: opere.slice(i, i + 50).join("|"), props: "labels|aliases|claims", languages: "en|it" }));
    Object.assign(entita, r?.entities || {});
  }
  const serie = [...new Set(Object.values(entita).flatMap((x) => ids(x?.claims, "P179")))];
  const nomiSerie = {};
  for (let i = 0; i < serie.length; i += 50) {
    const r = await prendi(indirizzo({ action: "wbgetentities", ids: serie.slice(i, i + 50).join("|"), props: "labels", languages: "en" }));
    for (const [k, v] of Object.entries(r?.entities || {})) nomiSerie[k] = v?.labels?.en?.value || null;
  }
  return Object.values(entita).map((x) => libroDa(x, nomiSerie)).filter(Boolean);
}

// ---- la memoria (del dispositivo) ----------------------------------------------

const leggi = (st) => {
  try {
    const v = JSON.parse(st?.getItem(CHIAVE) || "{}");
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
};

export function opereRicordate(autore, { st = globalThis.localStorage, ora = Date.now() } = {}) {
  const v = leggi(st)[chiaveAutore(autore)];
  // la memoria della versione di Open Library non ha `libri`: si richiede
  return v && ora - v.quando < SCADENZA ? v.libri || null : null;
}

export function ricordaOpere(autore, libri, { st = globalThis.localStorage, ora = Date.now() } = {}) {
  const m = leggi(st);
  m[chiaveAutore(autore)] = { quando: ora, libri };
  const tenuti = Object.entries(m).sort((a, b) => b[1].quando - a[1].quando).slice(0, TENUTI);
  try {
    st?.setItem(CHIAVE, JSON.stringify(Object.fromEntries(tenuti)));
  } catch {
    /* senza memoria si richiede la prossima volta */
  }
}

export async function opereDi(autore, prendi, opzioni = {}) {
  const ricordate = opereRicordate(autore, opzioni);
  if (ricordate) return ricordate;
  const libri = await opereDaWikidata(autore, prendi);
  ricordaOpere(autore, libri, opzioni);
  return libri;
}
