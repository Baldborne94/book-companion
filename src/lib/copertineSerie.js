// LE COPERTINE DI UNA SERIE DAL CATALOGO (`CopertineDalCatalogo` nella
// raccolta aperta; `test/copertine-serie.test.mjs`).
//
// Chiesto dal lettore con la foto della raccolta di Monster: «per Monster
// riesci a recuperarmi le copertine?». Il primo volume aveva la copertina
// dell'edizione inglese di Viz, gli altri diciassette quella giapponese
// rifatta dal gruppo della scansione, tutte uguali fra loro. Open Library ha
// la serie di Viz intera, un'opera per volume, «Naoki Urasawa's Monster,
// Vol. 2», con la sua copertina.
//
// Una domanda sola per la raccolta (il nome e l'autore scritto nei volumi,
// se c'e'; se no il nome con «vol»), poi per ogni volume col suo numero
// l'opera che porta lo stesso nome e quel numero. Le regole che sbagliano
// in silenzio:
// - IL NOME A PAROLE INTERE: «My Favorite Thing Is Monsters, vol 1» non e'
//   Monster;
// - LE EDIZIONI NON SONO IL VOLUME: «Monster Kanzenban nº 02/09» e' il
//   secondo di nove dell'edizione grande, non il secondo volume;
// - UNA FORMA SOLA PER LA SERIE: i titoli di una stessa edizione si scrivono
//   uguali tranne il numero («naoki urasawa s monster vol»), e vince la
//   forma che copre piu' volumi della raccolta; un volume che lei non ha si
//   prende da un'altra forma, e il lettore lo vede nell'elenco.
// Si propone e basta: l'elenco mostra la copertina di adesso accanto a
// quella del catalogo, e si mette solo quel che il lettore lascia spuntato.
import { autorePerIlCatalogo } from "./retroInRete.js";
import { copertinaDi, urlCopertina } from "./consigliLiberi.js";
import { operaConCopertina } from "./copertineRete.js";

const piega = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
const parole = (s) => piega(s).match(/[\p{L}\p{N}]+/gu) || [];

const EDIZIONE = /(?<![\p{L}\p{N}])(kanzenban|aizoban|bunkoban|wideban|omnibus|deluxe|perfect|ultimate|box|set|edition|edizione|[eé]dition|edici[oó]n|ausgabe|integral|int[eé]grale|artbook)(?![\p{L}\p{N}])/iu;
const DOPO_PAROLA = /(?:(?<![\p{L}])(?:vol(?:ume)?|tome|band|libro|book|n[º°o])\.?|#)\s*0*(\d{1,3})(?!\d)/iu;
// «02/09», «2 di 9»: il volume di un'edizione numerata a parte
const DI_TANTI = /\d\s*(?:\/|di|of|sur|de)\s*\d/iu;
const IN_CODA = /(?:,|\s)\s*0*(\d{1,3})\s*$/u;

// il numero del volume nel titolo, se il titolo ha tutte le parole del nome
export function numeroNelTitolo(titolo, nome) {
  const t = String(titolo || "");
  const nel = new Set(parole(t));
  const suo = parole(nome);
  if (!suo.length || !suo.every((p) => nel.has(p))) return null;
  if (EDIZIONE.test(t) || DI_TANTI.test(t)) return null;
  const m = t.match(DOPO_PAROLA) || t.match(IN_CODA);
  return m ? Number(m[1]) : null;
}

// la forma del titolo: le sue parole senza il numero
const formaDi = (titolo, n) =>
  parole(titolo)
    .filter((p) => Number(p) !== n)
    .join(" ");

const numeroDi = (b) => {
  const n = Number(b?.sagaOrder);
  return Number.isInteger(n) && n > 0 ? n : null;
};

// l'autore che i volumi scrivono di piu' (nessuno: si cerca senza)
export function autoreDellaRaccolta(libri = []) {
  const conti = new Map();
  for (const b of libri) {
    const a = String(b?.author || "").trim();
    if (a) conti.set(a, (conti.get(a) || 0) + 1);
  }
  return [...conti].sort((x, y) => y[1] - x[1])[0]?.[0] || "";
}

export function domandaSerie(nome, autore) {
  const q = new URLSearchParams({ fields: "key,title,author_name,cover_i", limit: "100" });
  const a = autorePerIlCatalogo(autore);
  if (a) {
    q.set("title", nome);
    q.set("author", a);
  } else q.set("q", `${nome} vol`);
  return `https://openlibrary.org/search.json?${q}`;
}

// docs del catalogo → una proposta per volume della raccolta:
// { proposte: [{ libro, numero, copertina, titolo, opere }], mancano: [numeri] };
// `opere` sono tutte le opere del catalogo per quel volume, di ogni forma,
// la forma che vince per prima (le loro edizioni: `scelteDelVolume`).
// Due schede con lo stesso numero (un doppione) hanno la proposta tutt'e due
export function copertinePerVolume(docs = [], { nome, libri = [] } = {}) {
  const voluti = new Map();
  for (const b of libri) {
    const n = numeroDi(b);
    if (n != null) voluti.set(n, [...(voluti.get(n) || []), b]);
  }
  const forme = new Map();
  docs.forEach((d) => {
    const copertina = copertinaDi(d);
    const numero = copertina ? numeroNelTitolo(d.title, nome) : null;
    if (numero == null || !voluti.has(numero)) return;
    const f = formaDi(d.title, numero);
    if (!forme.has(f)) forme.set(f, { forma: f, per: new Map(), autori: new Set() });
    for (const a of d.author_name || []) forme.get(f).autori.add(parole(a).join(" "));
    const per = forme.get(f).per;
    if (!per.has(numero)) per.set(numero, { numero, copertina, titolo: d.title, chiave: d.key || null });
  });
  // a pari volumi, quella che il catalogo mette prima (l'ordinamento e' stabile);
  // le altre forme solo con un autore in comune con lei («First Love Monster,
  // Vol. 7» e «Monster Soul 2» sono altre serie, il «#13» di Shogakukan no)
  const tutte = [...forme.values()].sort((a, b) => b.per.size - a.per.size);
  const prima = tutte[0];
  // (il catalogo scrive editore e anno al posto del suo autore, ma il titolo
  // ha tutte le parole della forma che vince, «naoki urasawa s monster»,
  // quando quella dice piu' del solo nome)
  const VOLUME = new Set(["vol", "volume", "tome", "band", "libro", "book", "no", "n"]);
  const suaForma = prima ? prima.forma.split(" ").filter((p) => p && !VOLUME.has(p)) : [];
  const piuDelNome = suaForma.length > parole(nome).length;
  const ordinate = tutte.filter((f) => {
    if (f === prima || [...f.autori].some((a) => prima.autori.has(a))) return true;
    const sue = new Set(f.forma.split(" "));
    return piuDelNome && suaForma.every((p) => sue.has(p));
  });
  const scelte = new Map();
  const opere = new Map();
  for (const f of ordinate)
    for (const [n, p] of f.per) {
      if (!scelte.has(n)) scelte.set(n, p);
      opere.set(n, [...(opere.get(n) || []), { chiave: p.chiave, copertina: p.copertina, titolo: p.titolo }]);
    }
  const numeri = [...voluti.keys()].sort((a, b) => a - b);
  return {
    proposte: numeri.filter((n) => scelte.has(n)).flatMap((n) => voluti.get(n).map((libro) => ({ ...scelte.get(n), opere: opere.get(n), libro }))),
    mancano: numeri.filter((n) => !scelte.has(n)),
  };
}

// la domanda al catalogo; con l'autore e niente trovato, si riprova senza.
// Un buco di rete ESPLODE (si dice, non e' «non ce l'ha»).
export async function cercaCopertineSerie({ nome, libri = [] }, { fetcher = fetch } = {}) {
  const autore = autoreDellaRaccolta(libri);
  const chiedi = async (a) => {
    const r = await fetcher(domandaSerie(nome, a));
    if (!r?.ok) throw new Error(`catalogo ${r?.status || "?"}`);
    return copertinePerVolume((await r.json())?.docs || [], { nome, libri });
  };
  const prima = await chiedi(autore);
  if (prima.proposte.length || !autorePerIlCatalogo(autore)) return prima;
  return chiedi("");
}

// l'immagine grande; null se non arriva o non e' una copertina
export async function scaricaCopertina(numero, { fetcher = fetch } = {}) {
  const url = urlCopertina(numero, "L");
  if (!url) return null;
  const r = await fetcher(`${url}?default=false`).catch(() => null);
  if (!r?.ok) return null;
  const blob = await r.blob().catch(() => null);
  return blob && /^image\//.test(blob.type || "image/jpeg") && blob.size > 1000 ? blob : null;
}

// ---- DALLA MANUTENZIONE: UNA RACCOLTA O UN LIBRO ---------------------------------
// Chiesto dal lettore dopo Monster: «nella manutenzione un tasto in cui
// scelgo la raccolta o il libro e gli chiedo di mettermi la copertina
// corretta». Si scrive un pezzo del nome e si tocca quel che si vuole: le
// raccolte (le saghe, col numero dei volumi) prima, poi i libri.

export const SCELTE_IN_VISTA = 8;

// ogni parola cercata, in qualunque ordine, senza accenti
export function sceltePerCopertina(libri = [], cercato = "", quante = SCELTE_IN_VISTA) {
  const voluto = parole(cercato);
  if (!voluto.length) return [];
  const dice = (testo) => {
    const sue = parole(testo);
    return voluto.every((v) => sue.some((p) => p.startsWith(v)));
  };
  const saghe = new Map();
  for (const b of libri) {
    // senza saga il nome e' vuoto, e nessuna parola cercata lo trova
    const s = String(b?.saga || "").trim();
    const k = piega(s);
    if (!saghe.has(k)) saghe.set(k, { tipo: "raccolta", nome: s, libri: [] });
    saghe.get(k).libri.push(b);
  }
  const raccolte = [...saghe.values()].filter((r) => dice(r.nome)).sort((a, b) => a.nome.localeCompare(b.nome, "it"));
  const singoli = libri
    .filter((b) => b?.title && dice(`${b.title} ${b.author || ""}`))
    .sort((a, b) => String(a.title).localeCompare(String(b.title), "it", { numeric: true }))
    .map((libro) => ({ tipo: "libro", libro }));
  return [...raccolte, ...singoli].slice(0, quante);
}

// UN LIBRO SOLO: se ha la saga e il suo numero si cerca come volume della
// serie (il titolo del file, «Monster - Volume_02_[Mangascreener]», al
// catalogo non dice niente); se no, o se la serie non lo trova, per titolo e
// autore (`cercaCopertina`, la scelta d'opera del catalogo delle saghe).
export async function cercaCopertinaDelLibro(libro, { fetcher = fetch, perTitolo = operaConCopertina } = {}) {
  if (numeroDi(libro) != null && String(libro.saga || "").trim()) {
    const serie = await cercaCopertineSerie({ nome: libro.saga, libri: [libro] }, { fetcher });
    if (serie.proposte.length) return serie;
  }
  const opera = await perTitolo({ titolo: libro.title, autore: libro.author }, fetcher);
  if (!opera?.copertina) return { proposte: [], mancano: [] };
  const sua = { chiave: opera.chiave || null, copertina: opera.copertina, titolo: libro.title };
  return { proposte: [{ libro, numero: null, copertina: opera.copertina, titolo: libro.title, opere: [sua] }], mancano: [] };
}

// ---- QUALUNQUE EDIZIONE (chiesto dal lettore davanti all'elenco di Monster:
// «sì, qualunque edizione dove c'è l'immagine») --------------------------------
// Le sue copertine erano gia' quelle di Viz, le stesse del catalogo; le altre
// stanno nelle EDIZIONI di ogni opera (la francese di Kana per i primi nove,
// la giapponese di Shogakukan, Dargaud ed Egmont per il 12 e il 13): una
// domanda per opera, `/works/…/editions.json`, misurato il 13 novembre 2026
// su tutti e diciotto i volumi.

export const EDIZIONI_MAX = 50;

export function domandaEdizioni(chiave) {
  return /^\/works\/OL\d+W$/.test(String(chiave || "")) ? `https://openlibrary.org${chiave}/editions.json?limit=${EDIZIONI_MAX}&fields=covers,publishers` : null;
}

// le copertine delle edizioni di un'opera: [{ copertina, editore }]; un buco
// di rete ESPLODE (l'elenco resta quel che e', e si dice)
export async function edizioniDellOpera(chiave, { fetcher = fetch } = {}) {
  const url = domandaEdizioni(chiave);
  if (!url) return [];
  const r = await fetcher(url);
  if (!r?.ok) throw new Error(`catalogo ${r?.status || "?"}`);
  const fuori = [];
  for (const e of (await r.json())?.entries || [])
    for (const c of e?.covers || []) {
      const n = copertinaDi({ cover_i: c });
      if (n) fuori.push({ copertina: n, editore: String(e.publishers?.[0] || "").trim() || null });
    }
  return fuori;
}

// le chiavi delle opere da chiedere per tutte le proposte, una volta sola
export function opereDaChiedere(proposte = []) {
  const k = new Set();
  for (const p of proposte) for (const o of p.opere || []) if (domandaEdizioni(o.chiave)) k.add(o.chiave);
  return [...k];
}

// tutte le copertine di un volume, senza doppioni: per ogni opera la sua (col
// nome dell'editore, se un'edizione lo dice) e poi quelle delle sue edizioni
export function scelteDelVolume(proposta, edizioni = new Map()) {
  const viste = new Map();
  const metti = (copertina, editore) => {
    if (!copertina) return;
    if (!viste.has(copertina)) viste.set(copertina, { copertina, editore: editore || null });
  };
  for (const o of proposta?.opere || [{ copertina: proposta?.copertina }]) {
    const sue = edizioni.get(o.chiave) || [];
    metti(o.copertina, sue.find((e) => e.copertina === o.copertina)?.editore);
    for (const e of sue) metti(e.copertina, e.editore);
  }
  return [...viste.values()];
}

// lo stesso editore scritto in tre modi («VIZ Media LLC», «Viz Media») e'
// uno: la sua prima parola
export const chiaveEditore = (editore) => parole(editore)[0] || null;

// «Tutte di Kana»: gli editori che hanno copertine per piu' volumi, col
// conto, il piu' presente prima. `scelte` e' [{ libro, copertine }].
export function editoriDelleScelte(scelte = []) {
  const conti = new Map();
  for (const { copertine = [] } of scelte) {
    const qui = new Set();
    for (const c of copertine) {
      const k = chiaveEditore(c.editore);
      if (!k || qui.has(k)) continue;
      qui.add(k);
      const e = conti.get(k) || { chiave: k, nome: c.editore, quanti: 0 };
      e.quanti++;
      conti.set(k, e);
    }
  }
  return [...conti.values()].filter((e) => e.quanti > 1).sort((a, b) => b.quanti - a.quanti);
}

// la copertina di quell'editore per ogni volume che ce l'ha (la prima)
export function tutteDellEditore(scelte = [], chiave) {
  const fuori = new Map();
  for (const { libro, copertine = [] } of scelte) {
    const c = copertine.find((x) => chiaveEditore(x.editore) === chiave);
    if (c) fuori.set(libro.id, c.copertina);
  }
  return fuori;
}
