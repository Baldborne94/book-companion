import { riconosci } from "./sagaBooks.js";
import { chiaveGlossario, vociDi } from "./glossarioMio.js";

// Il glossario risponde prima della rete e anche senza: sono dati nostri,
// non un dizionario da interrogare. I file delle voci arrivano lazy, cosi'
// restano fuori dal primo caricamento e finiscono in un chunk precachato:
// per questo l'indirizzo del wiki sta qui e non nel file delle voci.

// la ricerca del wiki non da' mai 404: con un titolo esatto ci si atterra
// dritti, con un titolo diverso si finisce sui risultati invece che su una
// pagina da creare
const WIKI_SEARCH = "https://discworld.fandom.com/wiki/Special:Search?query=";

const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[^a-z0-9'\- ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// il termine da solo nel testo: serve a distinguere «Death» il personaggio
// da «the death of the king», che di Mondo Disco non ha nulla
// basta che una delle occorrenze sia maiuscola: nella stessa selezione puo'
// esserci sia «the death of the king» sia «Death said». E la maiuscola va
// cercata nel testo com'e' scritto, non ricostruita: «Ankh-Morpork» ne ha
// due, e confrontarla con «Ankh-morpork» non la trovava mai.
const capitalized = (raw, word) => {
  const esc = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(^|[^\\p{L}])(${esc})`, "giu");
  for (const m of String(raw).matchAll(re)) {
    const first = m[2][0];
    if (/\p{Lu}/u.test(first)) return true;
  }
  return false;
};

function buildIndex(entries) {
  const map = new Map();
  let max = 1;
  for (const e of entries) {
    for (const key of [e.t, ...(e.a || [])]) {
      const n = norm(key);
      if (!n) continue;
      for (const variant of new Set([n, n.replace(/-/g, " ")])) {
        if (!map.has(variant)) map.set(variant, e);
        max = Math.max(max, variant.split(" ").length);
      }
    }
  }
  return { map, max };
}

// La selezione si legge da sinistra a destra prendendo ogni volta il pezzo
// piu' lungo che si riconosce e ripartendo da dopo: su un paragrafo intero
// escono tutte le voci, in ordine di lettura e senza accavallarsi. Le parole
// singole hanno due trappole: quelle segnate `c` hanno anche un senso
// comunissimo («dead», «proper», «row») e scatterebbero ovunque, mentre i
// nomi propri («Death», «Igor») vanno distinti dall'uso normale della stessa
// parola, e a distinguerli e' la maiuscola nel testo.
// Nei verbi separabili il complemento sta in mezzo: «egg them on» e' «egg
// on» con «them» incastrato. Elencare un alias per ogni pronome e per ogni
// forma del verbo non scala, quindi la regola sta qui una volta sola.
const OGGETTI = new Set([
  "them", "him", "her", "me", "us", "you", "it", "'em", "em", "himself",
  "herself", "themselves", "myself", "yourself", "ourselves", "one",
]);

function scan(indexes, raw) {
  const words = norm(raw).split(" ").filter(Boolean);
  const out = [];
  const seen = new Set();
  const alone = words.length === 1;
  const longest = Math.max(1, ...indexes.map(([, ix]) => (ix ? ix.max : 1)));
  let i = 0;
  while (i < words.length) {
    let hit = null;
    let len = 0;
    let kind = "";
    for (let n = Math.min(longest, words.length - i); n >= 1 && !hit; n--) {
      const finestra = words.slice(i, i + n);
      const chiavi = [finestra.join(" ")];
      if (n === 3 && OGGETTI.has(finestra[1])) chiavi.push(`${finestra[0]} ${finestra[2]}`);
      for (const key of chiavi) {
        for (const [k, ix] of indexes) {
          const e = ix?.map.get(key);
          if (!e) continue;
          if (n === 1 && !alone) {
            if (e.c) continue;
            if (k === "gloss" && /^[A-Z]/.test(e.t) && !capitalized(raw, key)) continue;
          }
          hit = e;
          len = n;
          kind = k;
          break;
        }
        if (hit) break;
      }
    }
    if (!hit) {
      i += 1;
      continue;
    }
    if (!seen.has(`${kind}:${hit.t}`)) {
      seen.add(`${kind}:${hit.t}`);
      out.push({ ...hit, kind });
    }
    i += len;
  }
  return out;
}

const SAGA_HINTS = ["discworld", "disc world", "mondo disco", "mondo dei dischi"];

// Il legame libro → glossario passa dall'autore, che l'import legge dai
// metadati dell'EPUB, o dalla saga scritta a mano nella scheda del libro.
export function glossaryOf(book) {
  const saga = norm(book?.saga);
  if (SAGA_HINTS.some((h) => saga.includes(h))) return "discworld";
  // anche dal titolo: i libri importati prima che l'app riconoscesse le saghe
  // hanno il campo saga vuoto, e non e' un buon motivo per restare senza
  return riconosci({ title: book?.title, author: book?.author }) ? "discworld" : null;
}

// Il glossario di un libro adesso puo' venire da due parti: le nostre voci
// (solo Mondo Disco) e le tue (qualunque saga). La levetta «segna i
// termini» guarda questo, non piu' la sola saga riconosciuta — altrimenti
// su Malazan resterebbe spenta anche con venti voci scritte da te.
export const haGlossario = (book) =>
  !!glossaryOf(book) || vociDi(chiaveGlossario(book)).length > 0;

export const wikiUrl = (term) => WIKI_SEARCH + encodeURIComponent(term);
export const normalize = norm;

const cache = { saga: new Map(), slang: null, spoken: null };

async function sagaIndex(id) {
  if (!id) return null;
  if (!cache.saga.has(id)) {
    const load = (async () => {
      try {
        const mod = await import("../data/glossaryDiscworld.js");
        return buildIndex(mod.default);
      } catch {
        return null;
      }
    })();
    cache.saga.set(id, load);
  }
  return cache.saga.get(id);
}

function lazyIndex(key, load) {
  if (!cache[key]) {
    cache[key] = (async () => {
      try {
        return buildIndex((await load()).default);
      } catch {
        return null;
      }
    })();
  }
  return cache[key];
}

const slangIndex = () => lazyIndex("slang", () => import("../data/slangEn.js"));
const spokenIndex = () => lazyIndex("spoken", () => import("../data/spokenEn.js"));

// LE VOCI TUE. Non si mettono in cache: sono poche e cambiano mentre leggi
// — aggiungi un termine e alla selezione dopo dev'esserci gia'. Un indice
// costruito su venti voci costa meno di un battito di ciglia; una cache che
// non si accorge dell'ultima voce aggiunta costa la fiducia.
export function indiceMio(book) {
  const voci = vociDi(chiaveGlossario(book));
  return voci.length ? buildIndex(voci) : null;
}

// Per segnare i termini nel testo serve una passata sola su ogni nodo: una
// espressione unica con tutte le chiavi, le piu' lunghe per prime cosi'
// «Granny Weatherwax» vince su «Weatherwax». Fuori le chiavi corte, che da
// sole nel corpo del testo farebbero solo rumore.
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const espressione = (map) => {
  const keys = [...map.keys()].filter((k) => k.length >= 4).sort((a, b) => b.length - a.length);
  return keys.length
    ? new RegExp(`(?<![\\p{L}\\p{N}])(${keys.map(escapeRe).join("|")})(?![\\p{L}\\p{N}])`, "giu")
    : null;
};

export async function termIndex(book) {
  const id = glossaryOf(book);
  const mio = indiceMio(book);
  const ix = id ? await sagaIndex(id) : null;
  // I due glossari si segnano insieme sulla pagina: sono la stessa cosa per
  // chi legge — una parola di questo mondo, spiegata. Le voci TUE vincono,
  // perche' sulla tua saga sai piu' tu di noi.
  if (mio) {
    const map = new Map(ix ? [...ix.map, ...mio.map] : mio.map);
    // l'espressione qui si ricostruisce ogni volta: le voci tue cambiano
    // mentre leggi, e una regex cachata resterebbe indietro di un termine
    const re = espressione(map);
    return re ? { map, max: Math.max(ix?.max || 1, mio.max), re } : null;
  }
  if (!ix) return null;
  if (!ix.re) ix.re = espressione(ix.map);
  return ix.re ? ix : null;
}

// Ritorna quel che di casa nostra si sa su una selezione: `found` e' tutto
// quello che si riconosce nell'ordine in cui si legge — su un paragrafo di
// parlato biascicato sono le chiavi per rimetterlo in piedi — mentre `gloss`
// e `slang` sono le due voci da mettere in evidenza nella scheda.
export async function explain(raw, book) {
  const text = String(raw || "").trim();
  if (!text) return { gloss: null, slang: null, found: [] };
  const id = glossaryOf(book);
  const mio = indiceMio(book);
  const [saga, modi, parlato] = await Promise.all([sagaIndex(id), slangIndex(), spokenIndex()]);
  // le voci tue stanno per PRIME: `scan` prende la prima che risponde, e su
  // un termine che sta in tutt'e due comanda quello che hai scritto tu
  const found = scan(
    [
      ["gloss", mio],
      ["gloss", saga],
      ["slang", modi],
      ["spoken", parlato],
    ],
    text
    // il rimando al wiki e' del Mondo Disco: appiccicarlo a una voce tua su
    // un'altra saga manderebbe il lettore a cercare Malazan sul wiki sbagliato
  ).map((e) => (e.kind === "gloss" && id && !mio?.map.has(norm(e.t)) ? { ...e, wiki: wikiUrl(e.t), saga: id } : e));
  const gloss = found.find((e) => e.kind === "gloss") || null;
  const slang = found.find((e) => e.kind !== "gloss") || null;
  // Le voci scritte a mano non copriranno mai tutto un mondo intero: se il
  // libro e' di una saga con un wiki e la selezione e' corta, la strada per
  // il wiki si offre lo stesso. Meglio un tocco in piu' che un vicolo cieco
  // su una parola che esiste solo li' dentro.
  const parola = text.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
  // il rimando al wiki e' un ripiego: se una risposta ce l'abbiamo, anche
  // solo il modo di dire, non serve mandare nessuno altrove
  const cercabile = id && !gloss && !slang && parola && parola.split(/\s+/).length <= 4;
  return {
    gloss,
    slang,
    found,
    wikiSearch: cercabile ? { term: parola, url: wikiUrl(parola) } : null,
  };
}
