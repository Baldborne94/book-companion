// UNA SAGA DAL SUO NOME (`components/AggiungiSenzaFile.jsx`,
// `test/saga-da-nome.test.mjs`). Chiesto dal lettore: «quando aggiungo il
// nome di una saga in automatico mi aggiungi nell'ordine corretto i libri
// con copertina di quella saga».
//
// Due strade, nell'ordine in cui ci si puo' fidare:
// 1. LE GUIDE SCRITTE A MANO (`TAVOLE`): l'elenco e' quello, esatto, col
//    numero del cammino. Anche coi nomi in italiano e con «Siege of Terra»,
//    che e' la dodicesima parte dell'Eresia.
// 2. WIKIDATA: la serie col suo nome, e i suoi membri che sono libri col
//    NUMERO nella serie (P179 col qualificatore P1545, intero: «2.5» e' la
//    novella fra due romanzi). Wikidata per la Black Library sa poco (la
//    sezione degli autori e' stata tolta per questo: «Gaunt's Ghosts · 2
//    libri»), quindi l'elenco si MOSTRA prima di scriverlo, e il lettore
//    toglie quel che non vuole: si propone, non si scrive in silenzio.
// Si chiede all'API di Wikidata (`origin=*`), mai al servizio SPARQL.
import { TAVOLE } from "./sagaBooks.js";
import { camminoDellaGuida, guideIntere } from "./cammino.js";
import { vociDallaGuida, giaSulloScaffale } from "./senzaFile.js";

export const API = "https://www.wikidata.org/w/api.php";
// le serie: di libri, di romanzi, di opere, le trilogie
export const SERIE = ["Q277759", "Q1667921", "Q7725310", "Q13593966", "Q53815"];
// i libri: opera letteraria, romanzo, opera scritta, libro
export const LIBRI = ["Q7725634", "Q8261", "Q47461344", "Q571"];
// non volumi della saga: edizioni, racconti, novelle, raccolte
export const NON_VOLUMI = ["Q3331189", "Q49084", "Q149537", "Q1279564", "Q105420", "Q472808"];
const UNIVERSO = "Q559618";

const piano = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/^(the|il|lo|la|i|gli|le|l) /, "")
    .trim();

// I NOMI DELLE GUIDE, anche come li dice il lettore. `parte` restringe la
// guida a un suo capitolo: Siege of Terra e' la parte 12 dell'Eresia
const NOMI = [
  { nomi: ["mondo disco", "discworld"], saga: "Discworld" },
  { nomi: ["eresia di horus", "horus heresy", "eresia"], saga: "The Horus Heresy" },
  { nomi: ["siege of terra", "assedio di terra", "horus heresy siege of terra"], saga: "The Horus Heresy", parte: "Part 12 · The Siege of Terra", nome: "The Siege of Terra" },
  { nomi: ["seconda apocalisse", "second apocalypse"], saga: "The Second Apocalypse" },
  { nomi: ["gaunts ghosts", "gaunt ghosts", "fantasmi di gaunt"], saga: "Gaunt's Ghosts" },
  { nomi: ["eisenhorn"], saga: "Eisenhorn" },
  { nomi: ["ravenor"], saga: "Ravenor" },
  { nomi: ["hellboy"], saga: "Hellboy" },
  { nomi: ["malazan", "malazan book of the fallen", "libro dei caduti di malazan"], saga: "Malazan Book of the Fallen" },
  { nomi: ["stormlight", "stormlight archive", "cronache della folgorluce"], saga: "The Stormlight Archive" },
  { nomi: ["mistborn", "wax and wayne"], saga: "Mistborn" },
  { nomi: ["lockwood", "lockwood co", "lockwood and co"], saga: "Lockwood & Co." },
];

export function guidaDalNome(nome) {
  const k = piano(nome);
  if (!k) return null;
  const n = NOMI.find((x) => x.nomi.some((v) => piano(v) === k)) || null;
  if (n) return n;
  const tav = guideIntere().find((t) => piano(t.saga) === k);
  return tav ? { saga: tav.saga } : null;
}

// I VOLUMI DI UNA GUIDA, tutti, coi tuoi segnati (`gia`)
export function volumiDallaGuida(trovata, libri = [], opzioni = {}) {
  const tav = TAVOLE.find((t) => t.saga === trovata.saga);
  if (!tav) return null;
  const cammino = camminoDellaGuida(tav, libri, opzioni);
  const voci = vociDallaGuida(cammino, libri, opzioni).filter((v) => !trovata.parte || v.capitolo === trovata.parte);
  return { fonte: "guida", nome: trovata.nome || tav.saga, saga: voci[0]?.saga || tav.saga, volumi: voci };
}

// ---- Wikidata -----------------------------------------------------------------

const valore = (c) => c?.mainsnak?.datavalue?.value;
const ids = (claims, p) => (claims?.[p] || []).map((c) => valore(c)?.id).filter(Boolean);
const indirizzo = (p) => `${API}?${new URLSearchParams({ format: "json", origin: "*", ...p })}`;
const etichetta = (e) => e?.labels?.en?.value || e?.labels?.it?.value || "";

// la serie fra le candidate: la prima che E' una serie e non un universo
export function sceltaSerie(candidati = [], entita = {}) {
  for (const q of candidati) {
    const tipi = ids(entita[q]?.claims, "P31");
    if (tipi.includes(UNIVERSO)) continue;
    if (tipi.some((t) => SERIE.includes(t))) return q;
  }
  return null;
}

// un membro → un volume col suo numero in QUESTA serie, o niente
export function volumeDa(e, serie) {
  const c = e?.claims || {};
  const titolo = etichetta(e);
  if (!titolo) return null;
  const tipi = [...ids(c, "P31"), ...ids(c, "P7937")];
  if (!tipi.some((t) => LIBRI.includes(t)) || tipi.some((t) => NON_VOLUMI.includes(t))) return null;
  const legame = (c.P179 || []).find((x) => valore(x)?.id === serie);
  const grezzo = legame?.qualifiers?.P1545?.[0]?.datavalue?.value;
  const numero = grezzo != null && /^\d+$/.test(String(grezzo).trim()) ? Number(grezzo) : null;
  const tempo = String(valore((c.P577 || [])[0])?.time || "");
  return { titolo, numero, anno: Number(tempo.slice(1, 5)) || null, autoreId: ids(c, "P50")[0] || null };
}

// L'ORDINE: col numero, i volumi numerati e basta (uno senza numero in una
// saga numerata e' quasi sempre una novella o un'edizione); se nessuno ha
// il numero, i libri per anno, e lo si dice (`perAnno`)
export function inOrdine(volumi = []) {
  const numerati = volumi.filter((v) => v.numero != null);
  const visti = new Set();
  const unici = (l) => l.filter((v) => (visti.has(piano(v.titolo)) ? false : visti.add(piano(v.titolo))));
  if (numerati.length) return { perAnno: false, volumi: unici(numerati.sort((a, b) => a.numero - b.numero || (a.anno || 0) - (b.anno || 0))) };
  return { perAnno: true, volumi: unici(volumi.filter((v) => v.anno).sort((a, b) => a.anno - b.anno)).map((v, i) => ({ ...v, numero: i + 1 })) };
}

// Sei domande al piu': la ricerca, i tipi delle candidate, i membri, le
// loro schede (a cinquanta), i nomi degli autori. `prendi(url)` da' il JSON.
export async function sagaDaWikidata(nome, prendi) {
  const s = await prendi(indirizzo({ action: "wbsearchentities", search: nome, language: "en", uselang: "it", type: "item", limit: "7" }));
  const candidati = (s?.search || []).map((x) => x.id).filter(Boolean);
  if (!candidati.length) return null;
  const e = await prendi(indirizzo({ action: "wbgetentities", ids: candidati.join("|"), props: "labels|claims", languages: "en|it" }));
  const q = sceltaSerie(candidati, e?.entities || {});
  if (!q) return null;
  const m = await prendi(indirizzo({ action: "query", list: "search", srsearch: `haswbstatement:P179=${q}`, srlimit: "200", srnamespace: "0" }));
  const membri = (m?.query?.search || []).map((x) => x.title).filter((x) => /^Q\d+$/.test(x));
  const entita = {};
  for (let i = 0; i < membri.length; i += 50) {
    const r = await prendi(indirizzo({ action: "wbgetentities", ids: membri.slice(i, i + 50).join("|"), props: "labels|claims", languages: "en|it" }));
    Object.assign(entita, r?.entities || {});
  }
  const { perAnno, volumi } = inOrdine(Object.values(entita).map((x) => volumeDa(x, q)).filter(Boolean));
  const autori = [...new Set(volumi.map((v) => v.autoreId).filter(Boolean))];
  const nomi = {};
  if (autori.length) {
    const r = await prendi(indirizzo({ action: "wbgetentities", ids: autori.slice(0, 50).join("|"), props: "labels", languages: "en|it" }));
    for (const [k, v] of Object.entries(r?.entities || {})) nomi[k] = etichetta(v);
  }
  const titolo = etichetta(e.entities[q]) || nome;
  return {
    fonte: "wikidata",
    nome: titolo,
    saga: titolo,
    perAnno,
    volumi: volumi.map((v) => ({ titolo: v.titolo, autore: nomi[v.autoreId] || "", saga: titolo, serie: "", numero: v.numero, anno: v.anno })),
  };
}

// La strada intera: prima le guide, poi Wikidata
export async function sagaDalNome(nome, { libri = [], prendi } = {}) {
  const g = guidaDalNome(nome);
  if (g) return volumiDallaGuida(g, libri);
  if (!prendi) return null;
  const w = await sagaDaWikidata(nome, prendi);
  return w ? { ...w, volumi: w.volumi.map((v) => ({ ...v, gia: giaSulloScaffale(v, libri) })) } : null;
}
