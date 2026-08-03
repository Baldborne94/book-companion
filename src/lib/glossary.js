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
      const key = words.slice(i, i + n).join(" ");
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
  const author = norm(book?.author);
  const saga = norm(book?.saga);
  if (author.includes("pratchett")) return "discworld";
  if (SAGA_HINTS.some((h) => saga.includes(h))) return "discworld";
  return null;
}

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

// Per segnare i termini nel testo serve una passata sola su ogni nodo: una
// espressione unica con tutte le chiavi, le piu' lunghe per prime cosi'
// «Granny Weatherwax» vince su «Weatherwax». Fuori le chiavi corte, che da
// sole nel corpo del testo farebbero solo rumore.
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function termIndex(book) {
  const id = glossaryOf(book);
  if (!id) return null;
  const ix = await sagaIndex(id);
  if (!ix) return null;
  if (!ix.re) {
    const keys = [...ix.map.keys()].filter((k) => k.length >= 4).sort((a, b) => b.length - a.length);
    ix.re = keys.length
      ? new RegExp(`(?<![\\p{L}\\p{N}])(${keys.map(escapeRe).join("|")})(?![\\p{L}\\p{N}])`, "giu")
      : null;
  }
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
  const [saga, modi, parlato] = await Promise.all([sagaIndex(id), slangIndex(), spokenIndex()]);
  const found = scan(
    [
      ["gloss", saga],
      ["slang", modi],
      ["spoken", parlato],
    ],
    text
  ).map((e) => (e.kind === "gloss" ? { ...e, wiki: wikiUrl(e.t), saga: id } : e));
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
