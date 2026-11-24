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
// l'apostrofo non divide: «JOJOS» (il titolo italiano) e' «JoJo's»
const parole = (s) => piega(s).replace(/['’]/g, "").match(/[\p{L}\p{N}]+/gu) || [];

const EDIZIONE = /(?<![\p{L}\p{N}])(kanzenban|aizoban|bunkoban|wideban|omnibus|deluxe|perfect|ultimate|box|set|edition|edizione|[eé]dition|edici[oó]n|ausgabe|integral|int[eé]grale|artbook)(?![\p{L}\p{N}])/iu;
const DOPO_PAROLA = /(?:(?<![\p{L}])(?:vol(?:ume)?|tome|band|libro|book|n[º°o])\.?|#)\s*0*(\d{1,3})(?!\d)/iu;
// «02/09», «2 di 9»: il volume di un'edizione numerata a parte; e «Vol. 6-
// Vol. 10», «Vol.18 - Vol.29 Set»: un cofanetto, non il primo dei suoi
const DI_TANTI = /\d\s*(?:\/|di|of|sur|de|[-–]\s*(?:vol(?:ume)?\.?\s*)?)\s*\d/iu;
const IN_CODA = /(?:,|\s)\s*0*(\d{1,3})\s*$/u;

// «( Japanese Edition )» dice la lingua, non un'edizione grande
const LINGUA = /[\[(]\s*japanese\s+edition\s*[\])]/giu;
const pulito = (t) => String(t || "").replace(LINGUA, " ");

// il numero del volume nel titolo, se il titolo ha tutte le parole del nome
// (o di uno dei nomi: quello del lettore e l'originale, `nomeOriginale`)
export function numeroNelTitolo(titolo, nome) {
  const t = pulito(titolo);
  const nel = new Set(parole(t));
  const nomi = (Array.isArray(nome) ? nome : [nome]).map(parole).filter((n) => n.length);
  if (!nomi.some((suo) => suo.every((p) => nel.has(p)))) return null;
  if (EDIZIONE.test(t) || DI_TANTI.test(t)) return null;
  const m = t.match(DOPO_PAROLA) || t.match(IN_CODA);
  return m ? Number(m[1]) : null;
}

// la forma del titolo: le sue parole senza il numero
const formaDi = (titolo, n) =>
  parole(pulito(titolo))
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

// i titoli delle edizioni vengono con l'opera: dicono il nome di una serie
// che l'opera scrive nella sua lingua (`nomeOriginale`)
export const PAGINE_MAX = 3;
export function domandaSerie(nome, autore, { serie = "", originale = "", pagina = 1 } = {}) {
  const q = new URLSearchParams({ fields: "key,title,author_name,cover_i,editions,editions.title", limit: "100" });
  if (pagina > 1) q.set("page", String(pagina));
  const a = autorePerIlCatalogo(autore);
  if (originale) q.set("q", originale);
  else if (serie) q.set("q", `${nome} ${serie}`);
  else if (a) {
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
export function copertinePerVolume(docs = [], { nome, libri = [], serie = null, alias = [] } = {}) {
  const nomi = [nome, ...alias].filter(Boolean);
  const voluti = new Map();
  for (const b of libri) {
    const n = numeroDi(b);
    if (n != null) voluti.set(n, [...(voluti.get(n) || []), b]);
  }
  const forme = new Map();
  docs.forEach((d) => {
    const copertina = copertinaDi(d);
    // in una raccolta numerata per parte il titolo deve dire la parte, e il
    // suo numero non e' quello del volume
    const titolo = serie ? serieNelTitolo(d.title, serie) : d.title;
    const numero = copertina && titolo ? numeroNelTitolo(titolo, nomi) : null;
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
  // e una forma che e' solo il nome (o l'originale) col suo numero: lo
  // Shueisha «JOJO'S BIZARRE ADVENTURE Vol.2» accanto a «ジョジョの奇妙な冒険 2»
  const soloIlNome = (f) => {
    const sue = f.forma.split(" ").filter((p) => p && !VOLUME.has(p));
    return nomi.some((n) => {
      const w = parole(n);
      return w.length === sue.length && w.every((p, i) => p === sue[i]);
    });
  };
  const ordinate = tutte.filter((f) => {
    if (f === prima || [...f.autori].some((a) => prima.autori.has(a)) || soloIlNome(f)) return true;
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
    proposte: numeri.filter((n) => scelte.has(n)).flatMap((n) => voluti.get(n).map((libro) => ({ ...scelte.get(n), opere: opere.get(n), libro, etichetta: serie ? `${serie} · ${n}` : String(n) }))),
    mancano: numeri.filter((n) => !scelte.has(n)).map((n) => (serie ? `${serie} · ${n}` : n)),
  };
}

// la domanda al catalogo; con l'autore e niente trovato, si riprova senza.
// Un buco di rete ESPLODE (si dice, non e' «non ce l'ha»).
// UNA RACCOLTA NUMERATA PER PARTE (segnalato dal lettore con l'elenco di
// JoJo: in ogni volume 2 la stessa copertina, «come mai non le trova?»). Le
// sue schede ripartono da uno a ogni parte (la serie, «Parte 5»), e il
// catalogo numera JoJo come in Giappone, da 1 a 131 di fila: il «Vol.2» di
// Shueisha non e' il secondo di ogni parte. Quando lo stesso numero sta in
// due serie diverse si cerca una parte alla volta, e un titolo vale solo se
// dice la parte («Parte 7», «Part 7») o tutte le parole della serie.
export function numerataPerParte(libri = []) {
  const serieDi = new Map();
  for (const b of libri) {
    const n = numeroDi(b);
    const s = piega(String(b?.series || "").trim());
    if (n == null || !s) continue;
    if (!serieDi.has(n)) serieDi.set(n, new Set());
    serieDi.get(n).add(s);
  }
  return [...serieDi.values()].some((v) => v.size > 1);
}

const PARTE = /^(?:part|parte)\s*0*(\d{1,2})$/i;
// il titolo senza la parte, se la dice; null se non la dice
export function serieNelTitolo(titolo, serie) {
  const t = String(titolo || "");
  const m = String(serie || "").trim().match(PARTE);
  if (m) {
    const re = new RegExp(`(?<![\\p{L}\\p{N}])(?:part|parte)\\s*0*${Number(m[1])}(?!\\d)`, "iu");
    return re.test(t) ? t.replace(re, " ") : null;
  }
  const sue = parole(serie);
  const nel = new Set(parole(t));
  return sue.length && sue.every((p) => nel.has(p)) ? t : null;
}

export async function cercaCopertineSerie({ nome, libri = [] }, { fetcher = fetch } = {}) {
  if (numerataPerParte(libri)) {
    const parti = new Map();
    const senza = [];
    for (const b of libri) {
      const s = String(b?.series || "").trim();
      if (!s) senza.push(b);
      else {
        const k = piega(s);
        if (!parti.has(k)) parti.set(k, { serie: s, libri: [] });
        parti.get(k).libri.push(b);
      }
    }
    const tutte = { proposte: [], mancano: [] };
    for (const { serie, libri: suoi } of [...parti.values()].sort((a, b) => a.serie.localeCompare(b.serie, "it", { numeric: true }))) {
      const r = await fetcher(domandaSerie(nome, "", { serie }));
      if (!r?.ok) throw new Error(`catalogo ${r?.status || "?"}`);
      const esito = copertinePerVolume((await r.json())?.docs || [], { nome, libri: suoi, serie });
      tutte.proposte.push(...esito.proposte);
      tutte.mancano.push(...esito.mancano);
    }
    // senza la parte il numero non dice quale volume e': non si cerca
    tutte.mancano.push(...senza.filter((b) => numeroDi(b) != null).map((b) => b.title));
    return tutte;
  }
  const autore = autoreDellaRaccolta(libri);
  const leggi = async (url) => {
    const r = await fetcher(url);
    if (!r?.ok) throw new Error(`catalogo ${r?.status || "?"}`);
    const j = await r.json();
    return { docs: j?.docs || [], quanti: Number(j?.numFound) || 0 };
  };
  // (le risposte si tengono tutte: il nome originale puo' stare nella prima)
  const { docs } = await leggi(domandaSerie(nome, autore));
  let esito = copertinePerVolume(docs, { nome, libri });
  if (!esito.proposte.length && autorePerIlCatalogo(autore)) {
    docs.push(...(await leggi(domandaSerie(nome, ""))).docs);
    esito = copertinePerVolume(docs, { nome, libri });
  }
  // IL NOME ORIGINALE: se il catalogo scrive la serie nella sua lingua, la
  // si cerca anche cosi', fino a `PAGINE_MAX` pagine
  const originale = esito.mancano.length ? nomeOriginale(docs, nome) : null;
  if (!originale) return esito;
  // (un'opera gia' vista torna e basta: un volume tiene la prima della sua forma)
  for (let pagina = 1; pagina <= PAGINE_MAX; pagina++) {
    const { docs: altri, quanti } = await leggi(domandaSerie(nome, "", { originale, pagina }));
    docs.push(...altri);
    if (altri.length < 100 || pagina * 100 >= quanti) break;
  }
  return copertinePerVolume(docs, { nome, libri, alias: [originale] });
}

// IL NOME DELLA SERIE NELLA SUA LINGUA (segnalato dal lettore con la sua
// raccolta di JoJo numerata come in Giappone, 108 volumi e tre copertine:
// «come mai alcune copertine non me le trovi mai?»). Il catalogo tiene i
// volumi giapponesi col titolo giapponese, «ジョジョの奇妙な冒険 20», e la
// ricerca col nome del lettore li trova solo perche' una loro edizione si
// chiama «JoJo's Bizarre Adventure Vol. 8» (che e' Viz, numerata per parte:
// il suo numero non e' quello del volume). Il nome si impara da li': le
// opere scritte in un altro alfabeto che col nome del lettore hanno a che
// fare (nel titolo o in un'edizione), e del titolo quel che viene prima del
// numero; vince il piu' frequente.
const ALTRO_ALFABETO = /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}ー・]+/u;
export function nomeOriginale(docs = [], nome) {
  const suo = parole(nome);
  if (!suo.length) return null;
  const dice = (t) => {
    const nel = new Set(parole(t));
    return suo.every((p) => nel.has(p));
  };
  const conti = new Map();
  for (const d of docs) {
    const m = String(d?.title || "").match(ALTRO_ALFABETO);
    if (!m) continue;
    const resto = String(d.title).slice(m[0].length);
    if (!/^\s*\d/.test(resto)) continue;
    if (!dice(d.title) && !(d.editions?.docs || []).some((e) => dice(e?.title))) continue;
    conti.set(m[0], (conti.get(m[0]) || 0) + 1);
  }
  return [...conti].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
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
      if (n) fuori.push({ copertina: n, editore: editoreLeggibile(e.publishers) });
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

// IL NOME DELL'EDITORE COME LO LEGGE UNA PERSONA (l'elenco di JoJo diceva
// «ToÌ„kyoÌ„ : ShuÌ„eisha, 2000.»: il catalogo ha preso i byte UTF-8 di
// «Tōkyō» per lettere di Windows, e ci ha messo la citta' e l'anno). Fra i
// nomi di un'edizione si preferisce uno pulito («Shueisha» sta accanto); se
// no si rimettono a posto i byte, poi via la citta' prima dei due punti e
// l'anno in coda.
const WINDOWS = { 0x20ac: 0x80, 0x201a: 0x82, 0x192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x2c6: 0x88, 0x2030: 0x89, 0x160: 0x8a, 0x2039: 0x8b, 0x152: 0x8c, 0x17d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x2dc: 0x98, 0x2122: 0x99, 0x161: 0x9a, 0x203a: 0x9b, 0x153: 0x9c, 0x17e: 0x9e, 0x178: 0x9f };
const STORPIATO = /[ÃÂÅÌÍÄ][\u0080-\u00bf\u0152-\u2122"]/u;
export function aggiustaByte(s) {
  const t = String(s || "");
  const byte = [];
  for (const ch of t) {
    const c = ch.codePointAt(0);
    if (c < 256) byte.push(c);
    else if (WINDOWS[c] != null) byte.push(WINDOWS[c]);
    else return t.replace(new RegExp(STORPIATO.source, "gu"), "");
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(byte)).normalize("NFC");
  } catch {
    // byte persi per strada (le virgolette al posto del segno): via i resti
    return t.replace(new RegExp(STORPIATO.source, "gu"), "");
  }
}
export function editoreLeggibile(editori = []) {
  const tutti = (Array.isArray(editori) ? editori : [editori]).map((e) => String(e || "").trim()).filter(Boolean);
  const scelto = tutti.find((e) => !STORPIATO.test(e)) || tutti[0];
  if (!scelto) return null;
  const nome = aggiustaByte(scelto)
    .replace(/^.*\s:\s*/, "")
    .replace(/[,;]?\s*\[?c?\d{4}\]?\.?\s*$/, "")
    .replace(/[\s.,;:]+$/, "")
    .trim();
  return nome || null;
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
