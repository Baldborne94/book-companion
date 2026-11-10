// LE SERIE DA HARDCOVER (hardcover.app), accanto alle guide e a Wikidata.
//
// Chiesto dal lettore: «siti affidabili dove vedere la lista completa delle
// serie ce l'abbiamo? ogni volta mi sembra manchi qualcosa», e poi «sì,
// aggiungi hardcover». Wikidata per le serie recenti, autopubblicate o della
// Black Library sa poco (The Bound and the Broken: niente; Nico di Angelo:
// due romanzi senza data ne' numero). Hardcover, provato il 10 novembre 2026
// sulle serie del lettore, le ha quasi tutte, con la POSIZIONE di ogni libro
// e le novelle a numeri frazionari (0.5, 2.5).
//
// La chiave e' del lettore (`bc_hardcover_key`, un «API key» di
// hardcover.app col solo permesso `read:catalog`) e non lascia mai il
// dispositivo: la domanda parte dal browser dritta verso Hardcover, che
// risponde a ogni origine. Senza chiave, Wikidata come prima.
//
// IL RUMORE, misurato su Rick Riordan: ventidue serie, fra cui le traduzioni
// come serie a se' («Magnus Chase ve Asgard Tanrıları», con 0 lettori), i
// fumetti e l'universo che contiene le altre («Camp Half-Blood Chronicles»).
// E in ogni serie le traduzioni stanno alla stessa posizione dell'originale
// («Z krwi i ognia», il cui primo nome e' il traduttore). Quindi:
// - di ogni posizione INTERA si tiene un libro solo, il piu' letto;
// - le posizioni frazionarie (le novelle) e lo zero restano fuori: i soli
//   romanzi, come in ogni guida;
// - un libro che non e' ancora uscito si dice (`annunciato`);
// - fra le serie di un autore, una serie quasi senza lettori (`LETTORI_MIN`)
//   e' una traduzione, e una che condivide libri con due o piu' altre e' un
//   universo: restano fuori, come gli universi di Wikidata.

import { chiaveSaga } from "./sagaBooks.js";
import { eLAutore, variantiDelNome } from "./sagaDaNome.js";

export const HARDCOVER = "https://api.hardcover.app/v1/graphql";
const KEY = "bc_hardcover_key";
export const LETTORI_MIN = 10;

// la chiave si incolla com'e', anche col «Bearer » che la pagina mostra
export const chiaveNuda = (k) => String(k || "").trim().replace(/^bearer\s+/i, "");

export function chiaveHardcover(st = globalThis.localStorage) {
  try {
    return chiaveNuda(st?.getItem(KEY));
  } catch {
    return "";
  }
}

export function salvaChiaveHardcover(k, st = globalThis.localStorage) {
  try {
    const v = chiaveNuda(k);
    if (v) st.setItem(KEY, v);
    else st.removeItem(KEY);
  } catch {
    /* storage indisponibile: si richiedera' la chiave */
  }
}

// una chiave rifiutata si dice per quel che e', non come un guasto della rete
export class ChiaveRifiutata extends Error {}

// `chiedi(query, variabili)` → i dati. La rete si inietta (`fetcher`).
// Troppe domande insieme (429) si aspetta e si riprova, due volte al piu'.
export const RIPROVE = 2;
export function domandaHardcover(chiave, fetcher = globalThis.fetch, { aspetta = (ms) => new Promise((ok) => setTimeout(ok, ms)) } = {}) {
  return async (query, variables = {}) => {
    let r;
    for (let i = 0; ; i++) {
      r = await fetcher(HARDCOVER, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${chiaveNuda(chiave)}` },
        body: JSON.stringify({ query, variables }),
      });
      if (r.status !== 429 || i >= RIPROVE) break;
      await aspetta(Math.min(10, Number(r.headers?.get?.("retry-after")) || 2) * 1000);
    }
    const j = await r.json().catch(() => null);
    if (r.status === 401 || r.status === 403 || /token|authoriz/i.test(`${j?.error || ""} ${j?.error_description || ""}`)) throw new ChiaveRifiutata(j?.error_description || `Hardcover ${r.status}`);
    if (!r.ok || !j?.data) throw new Error(`Hardcover ${r.status}${j?.errors?.[0]?.message ? `: ${j.errors[0].message}` : ""}`);
    return j.data;
  };
}

const LIBRI_DELLA_SERIE = `book_series(where: {position: {_gt: 0}, book: {compilation: {_eq: false}}}) {
  position
  book {
    id title release_year release_date users_count contributions(limit: 1) { author { name } }
    default_physical_edition { language { code3 } } default_ebook_edition { language { code3 } }
  }
}`;

const nomeDi = (s) => String(s || "").replace(/\s+/g, " ").trim();
// la lingua dell'edizione principale (cartacea, se no ebook); vuota = non si sa
const linguaDi = (b) => b?.default_physical_edition?.language?.code3 || b?.default_ebook_edition?.language?.code3 || "";
const straniero = (lingua) => !!lingua && lingua !== "eng";

// I VOLUMI DI UNA SERIE: una posizione intera, un libro (il piu' letto), in
// ordine; un libro con la data dopo oggi, o senza data, e' annunciato
export function volumiDaHardcover(legami = [], { oggi = new Date().toISOString().slice(0, 10) } = {}) {
  const per = new Map();
  for (const l of legami) {
    const p = Number(l?.position);
    const b = l?.book;
    if (!b?.title || !Number.isInteger(p) || p < 1) continue;
    const c = per.get(p);
    // l'inglese prima della traduzione, poi il piu' letto
    const meglio = !c || straniero(linguaDi(c)) - straniero(linguaDi(b)) > 0 || (straniero(linguaDi(c)) === straniero(linguaDi(b)) && (b.users_count || 0) > (c.users_count || 0));
    if (meglio) per.set(p, b);
  }
  return [...per.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([numero, b]) => ({
      id: b.id,
      titolo: nomeDi(b.title),
      autore: nomeDi(b.contributions?.[0]?.author?.name),
      numero,
      anno: b.release_year || null,
      annunciato: !b.release_date || b.release_date > oggi,
      lettori: b.users_count || 0,
      lingua: linguaDi(b),
    }));
}

// la serie cercata per nome: una di quelle col nome (com'e' o senza le
// parole generiche), la piu' letta; nessuna col nome, nessuna serie
// (se nessuna si chiama cosi', una che ha nel nome tutte le parole cercate:
// «Magnus Chase» e' «Magnus Chase and the Gods of Asgard»)
const parole = (s) => chiaveSaga(s).split(" ").filter(Boolean);
export function sceltaSerieHC(hits = [], nome = "") {
  const chiavi = new Set(variantiDelNome(nome).map(chiaveSaga));
  const docs = hits.map((h) => h?.document || h).filter((d) => d?.id && d.name);
  const piuLetta = (l) => l.sort((a, b) => (b.readers_count || 0) - (a.readers_count || 0))[0] || null;
  const uguali = docs.filter((d) => variantiDelNome(d.name).some((v) => chiavi.has(chiaveSaga(v))));
  if (uguali.length) return piuLetta(uguali);
  const cercate = parole(nome);
  return cercate.length ? piuLetta(docs.filter((d) => { const sue = new Set(parole(d.name)); return cercate.every((p) => sue.has(p)); })) : null;
}

// l'autore cercato: uno che si chiama cosi' (anche il solo cognome), quello
// con piu' libri
export function sceltaAutoreHC(hits = [], nome = "") {
  const col = hits.map((h) => h?.document || h).filter((d) => d?.id && eLAutore(nome, nomeDi(d.name)));
  return col.sort((a, b) => (b.books_count || 0) - (a.books_count || 0))[0] || null;
}

// LE SERIE DI UN AUTORE CHE VALGONO: non le traduzioni (quasi nessun
// lettore), non gli universi (libri in comune con due o piu' altre serie),
// non quelle senza romanzi, non le edizioni spezzate, gli adattamenti e le
// traduzioni. Se nessuna ha lettori, la piu' letta resta.
// Un universo: libri in comune con due o piu' altre serie, per meta' o piu'
// dei suoi, ed e' piu' grande di ognuna di loro.
// Un'edizione spezzata o un adattamento si dicono nel nome («The Tawny Man
// (French Split)», «Words of Radiance (Dramatized Adaptation)», «… The
// Graphic Novels»), una traduzione nella lingua dei suoi volumi («Les cités
// des Anciens»: per meta' o piu' in un'altra lingua).
const NON_ROMANZI = /\b(split|editions?|adaptations?|dramati[sz]ed|single issues|graphic novels?|comics?|manga)\b/i;
export function serieCheValgono(serie = []) {
  const con = serie
    .map((s) => ({ ...s, lettori: s.volumi.reduce((n, v) => n + v.lettori, 0) }))
    .filter((s) => s.volumi.length && !NON_ROMANZI.test(s.nome) && s.volumi.filter((v) => straniero(v.lingua)).length * 2 < s.volumi.length);
  const libriDi = new Map(con.map((s) => [s.q, new Set(s.volumi.map((v) => v.id))]));
  const universo = (s) => {
    const miei = libriDi.get(s.q);
    const altre = con.filter((o) => o.q !== s.q && [...libriDi.get(o.q)].some((id) => miei.has(id)));
    const inAltre = [...miei].filter((id) => altre.some((o) => libriDi.get(o.q).has(id))).length;
    // ed e' la piu' grande di quelle con cui li divide: Percy Jackson divide
    // i suoi con l'universo e coi suoi seguiti, ma l'universo e' lui
    return altre.length >= 2 && inAltre * 2 >= miei.size && altre.every((o) => libriDi.get(o.q).size < miei.size);
  };
  const buone = con.filter((s) => !universo(s));
  const lette = buone.filter((s) => s.lettori >= LETTORI_MIN);
  const scelte = lette.length ? lette : buone.sort((a, b) => b.lettori - a.lettori).slice(0, 1);
  return scelte.sort((a, b) => b.lettori - a.lettori);
}

const perElenco = (nome, volumi) => volumi.map(({ titolo, autore, numero, anno, annunciato }) => ({ titolo, autore, saga: nome, serie: "", numero, anno, annunciato }));

// UNA SERIE DAL SUO NOME: due domande, la ricerca e la serie coi suoi libri
export async function serieHardcover(nome, chiedi) {
  const s = await chiedi(`query($q: String!) { search(query: $q, query_type: "Series", per_page: 8) { results } }`, { q: String(nome || "").trim() });
  const scelta = sceltaSerieHC(s?.search?.results?.hits || [], nome);
  if (!scelta) return null;
  const d = await chiedi(`query($id: Int!) { series_by_pk(id: $id) { id name ${LIBRI_DELLA_SERIE} } }`, { id: Number(scelta.id) });
  const serie = d?.series_by_pk;
  if (!serie) return null;
  const nomeSerie = nomeDi(serie.name);
  return { fonte: "hardcover", q: serie.id, nome: nomeSerie, saga: nomeSerie, perAnno: false, volumi: perElenco(nomeSerie, volumiDaHardcover(serie.book_series)) };
}

// LE SERIE DI UN AUTORE: due domande, la ricerca e le sue serie coi loro libri
export async function serieDellAutoreHC(nome, chiedi) {
  const s = await chiedi(`query($q: String!) { search(query: $q, query_type: "Author", per_page: 6) { results } }`, { q: String(nome || "").trim() });
  const chi = sceltaAutoreHC(s?.search?.results?.hits || [], nome);
  if (!chi) return null;
  const d = await chiedi(`query($id: Int!) { series(where: {author_id: {_eq: $id}, primary_books_count: {_gt: 0}}, limit: 60) { id name ${LIBRI_DELLA_SERIE} } }`, { id: Number(chi.id) });
  const serie = (d?.series || []).map((x) => ({ q: x.id, nome: nomeDi(x.name), volumi: volumiDaHardcover(x.book_series) }));
  return {
    autore: nomeDi(chi.name),
    serie: serieCheValgono(serie).map((x) => ({ fonte: "hardcover", q: x.q, nome: x.nome, quanti: x.volumi.length, volumi: perElenco(x.nome, x.volumi) })),
  };
}

// la riga che lo dice, accanto ai risultati: una chiave rifiutata si
// sistema nelle Impostazioni, un Hardcover muto passa da solo
export function fraseHardcover(avviso) {
  if (avviso === "chiave") return "Hardcover non accetta la chiave salvata: controllala nelle Impostazioni («Le serie da Hardcover»). Intanto ho cercato su Wikidata.";
  if (avviso === "guasto") return "Hardcover non risponde adesso: ho cercato su Wikidata.";
  return null;
}
