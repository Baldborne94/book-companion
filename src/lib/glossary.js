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

// Le locuzioni si riconoscono dentro una frase lunga: e' esattamente il caso
// d'uso, selezionare la frase e chiedere cosa vuol dire. Le parole singole
// hanno due trappole: quelle segnate `c` hanno anche un senso comunissimo
// («dead», «proper», «row») e scatterebbero ovunque, mentre i nomi propri
// («Death», «Igor») vanno distinti dall'uso normale della stessa parola.
function match(index, raw, { proper = false } = {}) {
  const words = norm(raw).split(" ").filter(Boolean);
  if (!words.length || !index) return null;
  for (let n = Math.min(index.max, words.length); n >= 2; n--) {
    for (let i = 0; i + n <= words.length; i++) {
      const hit = index.map.get(words.slice(i, i + n).join(" "));
      if (hit) return hit;
    }
  }
  const alone = words.length === 1;
  for (const w of words) {
    const hit = index.map.get(w);
    if (!hit) continue;
    // selezionata da sola non ci sono dubbi: e' quella che si sta chiedendo
    if (alone) return hit;
    if (hit.c) continue;
    if (proper && /^[A-Z]/.test(hit.t) && !capitalized(raw, w)) continue;
    return hit;
  }
  return null;
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

const cache = { saga: new Map(), slang: null };

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

async function slangIndex() {
  if (!cache.slang) {
    cache.slang = (async () => {
      try {
        const mod = await import("../data/slangEn.js");
        return buildIndex(mod.default);
      } catch {
        return null;
      }
    })();
  }
  return cache.slang;
}

// Ritorna quel che di casa nostra si sa su una selezione: la voce della saga
// (con il rimando al wiki) e il modo di dire. Possono esserci tutti e due.
export async function explain(raw, book) {
  const text = String(raw || "").trim();
  if (!text) return { gloss: null, slang: null };
  const id = glossaryOf(book);
  const [saga, slang] = await Promise.all([sagaIndex(id), slangIndex()]);
  const gloss = match(saga, text, { proper: true });
  return {
    gloss: gloss ? { ...gloss, wiki: wikiUrl(gloss.t), saga: id } : null,
    slang: match(slang, text) || null,
  };
}
