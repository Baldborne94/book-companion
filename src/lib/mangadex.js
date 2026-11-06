// LE SERIE SEGUITE SU MANGADEX. Chiesto dal lettore: «come fa Mihon,
// collegarsi a dei server per avere sempre il fumetto aggiornato, scaricarlo
// sul tablet e leggerlo offline». Mihon ha estensioni che grattano i siti;
// l'app gira nel browser, senza un server nostro, e dal browser si leggono
// solo le fonti con un'API aperta alle altre origini. MangaDex e' l'unica
// che risponde all'app (provato: ricerca, capitoli, pagine, copertine, col
// permesso CORS per la nostra origine). Ha un buco: i manga con licenza
// inglese (One Piece, Kingdom, Gachiakuta…) non ci stanno, e i loro
// capitoli nuovi sono solo RIMANDI a MangaPlus o a K Manga, senza pagine.
// Berserk invece c'e' tutto. Un capitolo scaricato diventa un CBZ nella
// biblioteca, con ComicInfo.xml (serie, numero, verso): lo legge il lettore
// dei fumetti di sempre, con segno, doppia pagina e Oracolo.
//
// Le decisioni stanno qui, con la rete iniettata (`fetch`): si provano in
// Node con risposte nella forma vera dell'API.
import { nuovoZip } from "./zipScritto.js";

export const BASE = "https://api.mangadex.org";
export const COPERTINE = "https://uploads.mangadex.org";
export const SITO = "https://mangadex.org";
// dove si dice a MangaDex se una pagina e' arrivata (lo chiedono ai client
// per la salute dei loro nodi): solo per i nodi, mai per il loro deposito
export const RAPPORTO = "https://api.mangadex.network/report";
export const LINGUE = ["en", "it"];
export const NOME_LINGUA = { en: "inglese", it: "italiano" };
export const CHIAVE_SERIE = "bc_serie";
// MangaDex lascia cinque richieste al secondo: una ogni 250 ms, in fila
export const INTERVALLO = 250;
export const PAGINA_FEED = 500;
export const PAGINE_FEED_MAX = 20;
// i capitoli in vista in una serie, gli altri dietro un tasto
export const IN_VISTA = 30;
const CONTENUTI = ["safe", "suggestive", "erotica", "pornographic"];

// UNA RICHIESTA ALLA VOLTA, A RITMO: chi chiama passa da qui, e due
// chiamate vicine si distanziano di `intervallo`
export function nuovoRitmo({ intervallo = INTERVALLO, adesso = Date.now, dormi = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  let ultima = null;
  let coda = Promise.resolve();
  return (fn) => {
    const mia = coda.then(async () => {
      const attesa = ultima == null ? 0 : ultima + intervallo - adesso();
      if (attesa > 0) await dormi(attesa);
      ultima = adesso();
      return fn();
    });
    coda = mia.catch(() => {});
    return mia;
  };
}

// LA SFIDA ANTI-BOT DI MANGADEX: l'API risponde «Bot challenge not passed»
// (403, o un rimando alla sfida che una richiesta da un'altra origine non
// puo' seguire: «Failed to fetch») a qualunque pagina web, perche' davanti
// ci sta una prova di lavoro che solo il loro sito aperto a tutto schermo
// supera. Dal tablet del lettore la stanza diceva «la rete non risponde»,
// che e' falso: si dice cos'e'. Le app con un nome loro (non un browser)
// passano: e' la strada del guscio Android.
export const SFIDA = "MangaDex non risponde alle pagine web: davanti alla sua API c'è una sfida anti-bot che lascia passare solo le app, non i siti. Nel browser questa stanza non può leggerlo; nell'app Android (l'APK più recente) le richieste passano dal guscio";
// UN RITMO SOLO PER TUTTA L'APP: la stanza che cerca e il lavoro che scarica
// stanno nella stessa fila, o insieme sforerebbero le cinque al secondo
export const ritmoComune = nuovoRitmo();

export function spiega(e, inRete = typeof navigator === "undefined" || navigator.onLine !== false) {
  const m = String(e?.message || e || "");
  if (/429/.test(m)) return "MangaDex chiede di aspettare un momento (troppe richieste)";
  if (/Bot challenge|\b403\b/i.test(m)) return SFIDA;
  if (/\b5\d\d\b/.test(m)) return "MangaDex non risponde in questo momento";
  if (/Failed to fetch|NetworkError|network/i.test(m)) return inRete ? SFIDA : "la rete non risponde";
  return m || "guasto sconosciuto";
}

async function chiedi(url, { fetch, ritmo = (f) => f(), tentativi = 2 } = {}) {
  let r = await ritmo(() => fetch(url));
  if (r.status === 429 && tentativi > 0) {
    const dopo = Math.min(10, Number(r.headers?.get?.("retry-after")) || 2);
    await new Promise((ok) => setTimeout(ok, dopo * 1000));
    return chiedi(url, { fetch, ritmo, tentativi: tentativi - 1 });
  }
  if (!r.ok) throw new Error(`MangaDex: ${r.status}`);
  const json = await r.json();
  if (json?.result === "error") throw new Error(json.errors?.[0]?.detail || "MangaDex: errore");
  return json;
}

const conParametri = (via, coppie) => {
  const q = new URLSearchParams();
  for (const [k, v] of coppie) for (const x of Array.isArray(v) ? v : [v]) q.append(k, x);
  return `${via}?${q}`;
};

// il titolo: inglese, poi la traslitterazione del giapponese, poi il primo
export function titoloDi(titolo = {}, alternativi = []) {
  const t = titolo || {};
  if (t.en) return t.en;
  const alt = (alternativi || []).find((a) => a && a.en)?.en;
  if (t["ja-ro"]) return t["ja-ro"];
  return alt || Object.values(t)[0] || "";
}

export const copertinaUrl = (id, file, lato = 256) => (id && file ? `${COPERTINE}/covers/${id}/${file}.${lato}.jpg` : null);

const relazione = (m, tipo) => (m.relationships || []).find((r) => r.type === tipo);

export function daRicerca(json) {
  return (json?.data || []).map((m) => {
    const a = m.attributes || {};
    const lingue = LINGUE.filter((l) => (a.availableTranslatedLanguages || []).includes(l));
    return {
      id: m.id,
      titolo: titoloDi(a.title, a.altTitles),
      anno: a.year || null,
      stato: a.status || null,
      originale: a.originalLanguage || null,
      lingue,
      autore: relazione(m, "author")?.attributes?.name || "",
      copertina: copertinaUrl(m.id, relazione(m, "cover_art")?.attributes?.fileName),
    };
  });
}

export async function cerca(testo, { fetch, ritmo, base = BASE, limite = 10, lingue = LINGUE } = {}) {
  const t = String(testo || "").trim();
  if (!t) return [];
  const url = conParametri(`${base}/manga`, [
    ["title", t],
    ["limit", String(limite)],
    ["order[relevance]", "desc"],
    ["includes[]", ["cover_art", "author"]],
    ["availableTranslatedLanguage[]", lingue],
  ]);
  return daRicerca(await chiedi(url, { fetch, ritmo }));
}

// I CAPITOLI DEL FEED: numero, titolo, pagine, e il rimando se il capitolo
// sta altrove (`externalUrl`: MangaPlus, K Manga… senza pagine qui)
export function daFeed(json) {
  return (json?.data || []).map((c) => {
    const a = c.attributes || {};
    const n = parseFloat(String(a.chapter ?? "").replace(",", "."));
    return {
      id: c.id,
      numero: Number.isFinite(n) ? n : null,
      volume: a.volume || null,
      titolo: a.title || "",
      pagine: Number(a.pages) || 0,
      esterno: a.externalUrl || null,
      gruppo: relazione(c, "scanlation_group")?.attributes?.name || "",
      data: a.readableAt || a.publishAt || null,
      lingua: a.translatedLanguage || null,
    };
  });
}

// UN CAPITOLO PER NUMERO: piu' gruppi traducono lo stesso capitolo, e si
// tiene quello OSPITATO con piu' pagine; un numero che ha solo rimandi
// tiene il rimando (si sa che e' uscito, si legge dove sta)
export function scegliCapitoli(lista) {
  const perNumero = new Map();
  for (const c of lista) {
    const k = c.numero == null ? `id:${c.id}` : String(c.numero);
    const ospitato = !c.esterno && c.pagine > 0;
    const g = perNumero.get(k);
    if (!g) perNumero.set(k, c);
    else {
      const gOspitato = !g.esterno && g.pagine > 0;
      if ((ospitato && !gOspitato) || (ospitato === gOspitato && c.pagine > g.pagine)) perNumero.set(k, c);
    }
  }
  return [...perNumero.values()].sort((a, b) => {
    if (a.numero == null && b.numero == null) return String(b.data || "").localeCompare(String(a.data || ""));
    if (a.numero == null) return 1;
    if (b.numero == null) return -1;
    return b.numero - a.numero;
  });
}

export async function capitoli(id, { fetch, ritmo, base = BASE, lingua = "en" } = {}) {
  const tutti = [];
  let offset = 0;
  for (let pagina = 0; pagina < PAGINE_FEED_MAX; pagina++) {
    const url = conParametri(`${base}/manga/${id}/feed`, [
      ["translatedLanguage[]", lingua],
      ["order[chapter]", "desc"],
      ["limit", String(PAGINA_FEED)],
      ["offset", String(offset)],
      ["includes[]", "scanlation_group"],
      ["contentRating[]", CONTENUTI],
    ]);
    const json = await chiedi(url, { fetch, ritmo });
    tutti.push(...daFeed(json));
    offset += PAGINA_FEED;
    if (offset >= (Number(json.total) || 0) || !(json.data || []).length) break;
  }
  return scegliCapitoli(tutti);
}

// LE PAGINE DI UN CAPITOLO: MangaDex assegna un nodo («at-home») e un hash,
// e gli indirizzi si compongono da li'. `base` e' il nodo, che va segnalato
export async function pagine(idCapitolo, { fetch, ritmo, base = BASE } = {}) {
  const json = await chiedi(`${base}/at-home/server/${idCapitolo}`, { fetch, ritmo });
  const c = json.chapter || {};
  const nodo = String(json.baseUrl || "").replace(/\/+$/, "");
  const file = Array.isArray(c.data) ? c.data : [];
  if (!nodo || !c.hash || !file.length) throw new Error("il capitolo non ha pagine qui");
  return { nodo, hash: c.hash, file, url: file.map((f) => `${nodo}/data/${c.hash}/${f}`) };
}

// LA SCHEDA DENTRO IL CBZ, come la legge `leggiComicInfo`: serie e numero
// fanno la saga e il posto, «Manga» il tipo e il verso (giapponese: da
// destra; coreano e cinese: manga senza verso detto)
const xml = (s) => String(s ?? "").replace(/[<>&"']/g, (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[ch]);
export function comicInfo({ serie, numero, titolo, autore, originale, lingua, idCapitolo } = {}) {
  const manga = originale === "ja" ? "YesAndRightToLeft" : originale ? "Yes" : "";
  const righe = [
    ["Title", titolo || (numero != null ? `Capitolo ${numero}` : serie)],
    ["Series", serie],
    ["Number", numero != null ? String(numero) : ""],
    ["Writer", autore],
    ["LanguageISO", lingua],
    ["Manga", manga],
    ["Web", idCapitolo ? `${SITO}/chapter/${idCapitolo}` : ""],
    ["Notes", "Scaricato da MangaDex con Book Companion"],
  ].filter(([, v]) => v);
  return `<?xml version="1.0" encoding="utf-8"?>\n<ComicInfo>\n${righe.map(([k, v]) => `  <${k}>${xml(v)}</${k}>`).join("\n")}\n</ComicInfo>\n`;
}

const pulito = (s) => String(s || "").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
export const numeroScritto = (n) => (n == null ? "" : Number.isInteger(n) ? String(n).padStart(3, "0") : String(n).padStart(5, "0"));
export const nomeFile = (serie, cap) => `${pulito(serie.titolo) || "Capitolo"}${cap.numero != null ? ` ${numeroScritto(cap.numero)}` : ""}.cbz`;
export const nomeCapitolo = (serie, cap) => `${serie.titolo} ${cap.numero != null ? cap.numero : cap.titolo || ""}`.trim();

// UN CAPITOLO SCARICATO E' UN CBZ: la scheda, poi le pagine nell'ordine di
// MangaDex con nomi in fila (001, 002…), una richiesta alla volta. Ogni
// pagina si segnala al nodo che l'ha data, come MangaDex chiede; il loro
// deposito (`uploads.mangadex.org`) non si segnala.
export async function scaricaCapitolo(serie, cap, { fetch, ritmo, base = BASE, onProgress, vivo = () => true, zip = nuovoZip, segnala = segnalaPagina } = {}) {
  const p = await pagine(cap.id, { fetch, ritmo, base });
  const z = zip({ tipo: "application/vnd.comicbook+zip" });
  z.aggiungi("ComicInfo.xml", new TextEncoder().encode(comicInfo({ serie: serie.titolo, numero: cap.numero, titolo: cap.titolo, autore: serie.autore, originale: serie.originale, lingua: cap.lingua || serie.lingua, idCapitolo: cap.id })));
  for (let i = 0; i < p.url.length; i++) {
    if (!vivo()) throw new Error("fermato");
    onProgress?.({ pagina: i, pagine: p.url.length });
    const partenza = Date.now();
    let r;
    try {
      r = await fetch(p.url[i]);
    } catch (e) {
      segnala?.({ fetch, url: p.url[i], ok: false, byte: 0, ms: Date.now() - partenza, nodo: p.nodo });
      throw e;
    }
    const ok = !!r.ok;
    const byte = ok ? new Uint8Array(await r.arrayBuffer()) : new Uint8Array(0);
    segnala?.({ fetch, url: p.url[i], ok, byte: byte.length, ms: Date.now() - partenza, nodo: p.nodo, cache: r.headers?.get?.("x-cache") });
    if (!ok) throw new Error(`la pagina ${i + 1} non è arrivata (${r.status})`);
    const ext = (p.file[i].match(/\.(\w+)$/) || [, "jpg"])[1].toLowerCase();
    z.aggiungi(`${String(i + 1).padStart(3, "0")}.${ext}`, byte);
  }
  onProgress?.({ pagina: p.url.length, pagine: p.url.length });
  const blob = z.chiudi();
  const nome = nomeFile(serie, cap);
  return typeof File === "function" ? new File([blob], nome, { type: "application/vnd.comicbook+zip" }) : Object.assign(blob, { name: nome });
}

export function segnalaPagina({ fetch, url, ok, byte, ms, nodo, cache }) {
  if (!nodo || nodo.startsWith(COPERTINE)) return false;
  try {
    const p = fetch(RAPPORTO, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url, success: !!ok, bytes: byte || 0, duration: ms || 0, cached: /HIT/i.test(String(cache || "")) }),
      keepalive: true,
    });
    p?.catch?.(() => {});
  } catch {
    /* un rapporto che non parte non ferma il capitolo */
  }
  return true;
}

// ---- LE SERIE SEGUITE (del dispositivo, `bc_serie`) -----------------------

export function leggiSerie(st = globalThis.localStorage) {
  try {
    const v = JSON.parse(st?.getItem(CHIAVE_SERIE) || "[]");
    return Array.isArray(v) ? v.filter((s) => s && s.id) : [];
  } catch {
    return [];
  }
}
export function scriviSerie(lista, st = globalThis.localStorage) {
  try {
    st?.setItem(CHIAVE_SERIE, JSON.stringify(lista));
  } catch {
    /* senza memoria la lista vale solo adesso */
  }
  return lista;
}

export function segui(lista, trovata, { lingua = null, adesso = Date.now() } = {}) {
  if (!trovata?.id || lista.some((s) => s.id === trovata.id)) return lista;
  const l = lingua && trovata.lingue?.includes(lingua) ? lingua : trovata.lingue?.[0] || "en";
  return [...lista, { id: trovata.id, titolo: trovata.titolo, autore: trovata.autore || "", copertina: trovata.copertina || null, originale: trovata.originale || null, lingue: trovata.lingue || [], lingua: l, seguitaDa: adesso, ultimoNoto: null, ultimo: null, nuovi: 0, controllata: null }];
}
export const smetti = (lista, id) => lista.filter((s) => s.id !== id);
export const cambiaLingua = (lista, id, lingua) => lista.map((s) => (s.id === id ? { ...s, lingua, ultimoNoto: null, ultimo: null, nuovi: 0 } : s));

// DOPO UN CONTROLLO: l'ultimo capitolo uscito, e quanti sono nuovi rispetto
// all'ultimo che il lettore aveva visto. La prima volta nessuno e' «nuovo»:
// si parte da dove si e'
export function conCapitoli(serie, lista, adesso = Date.now()) {
  const numeri = lista.map((c) => c.numero).filter((n) => Number.isFinite(n));
  const ultimo = numeri.length ? Math.max(...numeri) : null;
  const noto = serie.ultimoNoto == null ? ultimo : serie.ultimoNoto;
  const nuovi = noto == null ? 0 : numeri.filter((n) => n > noto).length;
  return { ...serie, ultimo, ultimoNoto: noto, nuovi, controllata: adesso };
}
// il lettore ha guardato la serie: da qui in poi i nuovi si contano da qui
export const visti = (serie) => ({ ...serie, ultimoNoto: serie.ultimo ?? serie.ultimoNoto, nuovi: 0 });

export const nuoviInTutto = (lista) => lista.reduce((s, x) => s + (Number(x.nuovi) || 0), 0);

export function fraseSerie(lista) {
  if (!lista.length) return null;
  const n = nuoviInTutto(lista);
  const serie = lista.length === 1 ? "1 serie seguita" : `${lista.length} serie seguite`;
  return n ? `${serie} · ${n === 1 ? "1 capitolo nuovo" : `${n} capitoli nuovi`}` : serie;
}

// IL CAPITOLO CHE STA GIA' IN BIBLIOTECA: stessa saga (com'e' scritta in
// casa, maiuscole a parte) e stesso numero, e che sia un fumetto
const chiave = (s) => String(s || "").trim().toLowerCase().replace(/^(the|il|lo|la|i|gli|le|l')\s+/, "");
export function nellaBiblioteca(books, serie, cap) {
  if (!cap || cap.numero == null) return null;
  const k = chiave(serie.titolo);
  return (books || []).find((b) => ["cbz", "cbr"].includes(b.fileType) && chiave(b.saga) === k && Number(b.sagaOrder) === cap.numero) || null;
}

export const daScaricare = (capitoli, books, serie) => capitoli.filter((c) => !c.esterno && c.pagine > 0 && !nellaBiblioteca(books, serie, c));

// la riga del lavoro lungo: «📡 Berserk 386: pagina 3 di 14 · 1 di 3»
export function fraseScarico({ i = 0, totale = 0, nome = "", pagina = 0, pagine = 0 } = {}) {
  const dove = pagine ? ` · pagina ${Math.min(pagina + 1, pagine)} di ${pagine}` : "";
  return `📡 Scarico «${nome}»${totale > 1 ? ` (${i + 1} di ${totale})` : ""}${dove}`;
}
