// LE USCITE DEL 40K, DA LEXICANUM, AD APP APERTA (`components/Uscite40k.jsx`
// sull'Ingresso, `test/uscite-40k.test.mjs`). Chiesto dal lettore: «vorrei
// novità di tutto il mondo 40k». Le fonti aperte non bastano (misurato:
// Wikidata non conosce Night Lords, Forges of Mars, Ahriman; Open Library
// ha uno o due libri del 40K l'anno; la categoria dei romanzi di Fandom si
// riempie di libri vecchi; Warhammer Community non ha un feed). Lexicanum
// ha ogni libro, anche annunciato, ma risponde solo a un browser: il guscio
// Android, che non lo e', resterebbe fermo alla pagina anti-bot, e quella
// non si aggira. Quindi si guarda dalla pagina, quando apri l'app — scelto
// dal lettore: «lo vedo quando apro l'applicazione».
//
// Come: le PAGINE NUOVE del wiki (`list=recentchanges`, `rctype=new`), e di
// quelle solo i libri, che su Lexicanum hanno il tipo nel titolo («Hive
// (Novel)», «… (Anthology)»). Una pagina nuova di un libro e' quasi sempre
// un libro annunciato o appena uscito: i libri vecchi Lexicanum li ha gia'.
// La prima volta si guardano gli ultimi `PRIMA_VOLTA` giorni; poi da dove
// si era arrivati. Non piu' di una volta ogni `OGNI`.
export const CHIAVE = "bc_uscite40k";
export const OGNI = 6 * 60 * 60 * 1000;
export const PRIMA_VOLTA = 30 * 24 * 60 * 60 * 1000;
// le pagine dell'elenco chieste a ogni giro (500 cambi l'una)
export const PAGINE_MAX = 4;
export const TENUTE = 40;

const TIPI = { Novel: "romanzo", Novella: "novella", Anthology: "antologia", "Audio Drama": "audiodramma", Omnibus: "omnibus", "Short Story Collection": "raccolta di racconti" };
const TIPO = new RegExp(`\\s\\((${Object.keys(TIPI).join("|")})\\)$`);

// una pagina nuova del wiki → un libro, o niente
export function libroDallaPagina(pagina) {
  const t = String(pagina?.title || "");
  const m = TIPO.exec(t);
  if (!m) return null;
  return { pagina: t, titolo: t.slice(0, m.index).trim(), tipo: TIPI[m[1]], quando: String(pagina?.timestamp || "") };
}

export const domandaNuove = (api, { fino, continua = null } = {}) =>
  `${api}?${new URLSearchParams({
    action: "query",
    list: "recentchanges",
    rctype: "new",
    rcnamespace: "0",
    rclimit: "500",
    rcprop: "title|timestamp",
    rcdir: "older",
    rcend: new Date(fino).toISOString(),
    format: "json",
    formatversion: "2",
    origin: "*",
    ...(continua ? { rccontinue: continua } : {}),
  })}`;

export const indirizzoPagina = (sito, pagina) => `${sito}/wiki/${encodeURIComponent(String(pagina).replace(/ /g, "_"))}`;

// ---- lo stato (del dispositivo) ---------------------------------------------

const vuoto = () => ({ dal: null, quando: 0, voci: [] });
export function leggiUscite(st = globalThis.localStorage) {
  try {
    const v = JSON.parse(st?.getItem(CHIAVE) || "null");
    return v && Array.isArray(v.voci) ? v : vuoto();
  } catch {
    return vuoto();
  }
}
export function scriviUscite(stato, st = globalThis.localStorage) {
  try {
    st?.setItem(CHIAVE, JSON.stringify(stato));
  } catch {
    /* senza memoria si richiede la prossima volta */
  }
  return stato;
}

export const daControllare = (stato, ora = Date.now()) => !stato?.quando || ora - stato.quando >= OGNI;
export const nuove = (stato) => (stato?.voci || []).filter((v) => !v.vista);
export const segnaViste = (stato) => ({ ...stato, voci: (stato?.voci || []).map((v) => ({ ...v, vista: true })) });

// Un giro: le pagine nuove dal punto a cui si era (o degli ultimi
// `PRIMA_VOLTA` giorni), solo i libri, i nuovi davanti. `prendi(url)` da' il
// JSON. Un intoppo sale a chi chiede, e lo stato resta quello di prima.
export async function controllaUscite({ api, prendi, stato = vuoto(), ora = Date.now() }) {
  const fino = stato.dal ? Date.parse(stato.dal) : ora - PRIMA_VOLTA;
  const trovate = [];
  let continua = null;
  for (let p = 0; p < PAGINE_MAX; p++) {
    const r = await prendi(domandaNuove(api, { fino, continua }));
    for (const x of r?.query?.recentchanges || []) {
      const l = libroDallaPagina(x);
      if (l) trovate.push(l);
    }
    continua = r?.continue?.rccontinue || null;
    if (!continua) break;
  }
  const gia = new Set((stato.voci || []).map((v) => v.pagina));
  const nuoveVoci = [];
  for (const l of trovate) {
    if (gia.has(l.pagina)) continue;
    gia.add(l.pagina);
    nuoveVoci.push({ ...l, vista: false });
  }
  return { dal: new Date(ora).toISOString(), quando: ora, voci: [...nuoveVoci, ...(stato.voci || [])].slice(0, TENUTE) };
}

// la riga sopra l'elenco
export function fraseUscite(stato) {
  const n = nuove(stato).length;
  if (n) return n === 1 ? "1 libro nuovo su Lexicanum" : `${n} libri nuovi su Lexicanum`;
  if (stato?.quando) return "Niente di nuovo dall'ultima volta";
  return "";
}
