import { getAux, putAux } from "./bookStore.js";

const CACHE = new Map();
const AUX_KEY = "dict_cache";
const MAX_WORDS = 600;

// L'endpoint /page/definition esiste SOLO su en.wiktionary: sugli altri
// Wiktionary risponde 404, quindi il vecchio ripiego "prima l'italiano"
// falliva in silenzio su ogni parola. Le definizioni arrivano da
// en.wiktionary; la glossa italiana da MyMemory (gratuito, senza chiavi).

// La cache vive anche fuori dalla sessione: le parole gia' cercate restano
// consultabili senza rete, che e' la condizione normale di chi legge in
// viaggio. In memoria per la velocita', su IndexedDB per il ritorno.

// DOMParser invece di innerHTML: il documento e' inerte, niente script o img
const strip = (html) => {
  try {
    const doc = new DOMParser().parseFromString(String(html), "text/html");
    return (doc.body.textContent || "").replace(/\s+/g, " ").trim();
  } catch {
    return "";
  }
};

export const cleanWord = (raw) =>
  String(raw || "")
    .replace(/[.,;:!?«»"“”'’()\[\]…—–-]/g, " ")
    .trim()
    .replace(/\s+/g, " ");

export const wordCount = (s) => (cleanWord(s) ? cleanWord(s).split(" ").length : 0);

// prima quello che si cerca leggendo, in fondo le curiosita' grammaticali
const POS_ORDER = [
  "noun",
  "verb",
  "adjective",
  "adverb",
  "pronoun",
  "preposition",
  "conjunction",
  "interjection",
  "determiner",
  "numeral",
  "proper noun",
];

const POS_IT = {
  noun: "sostantivo",
  verb: "verbo",
  adjective: "aggettivo",
  adverb: "avverbio",
  pronoun: "pronome",
  preposition: "preposizione",
  conjunction: "congiunzione",
  interjection: "interiezione",
  determiner: "determinante",
  numeral: "numerale",
  "proper noun": "nome proprio",
  participle: "participio",
  article: "articolo",
};

const rank = (pos) => {
  const i = POS_ORDER.indexOf(pos.toLowerCase());
  return i < 0 ? POS_ORDER.length : i;
};

async function fetchSenses(word, section) {
  const res = await fetch(
    `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`
  );
  if (!res.ok) return [];
  const data = await res.json();
  // solo la sezione della lingua del libro: le altre sono voci omografe di
  // altre lingue (era da li' che spuntavano i codici ISO fra le definizioni)
  const blocks = data?.[section] || [];
  const out = [];
  for (const block of blocks) {
    const pos = String(block.partOfSpeech || "").toLowerCase();
    for (const d of block.definitions || []) {
      const text = strip(d.definition);
      if (text) out.push({ pos: POS_IT[pos] || pos, order: rank(pos), text });
    }
  }
  return out
    .filter((e, i, all) => all.findIndex((x) => x.text === e.text) === i)
    .sort((a, b) => a.order - b.order);
}

async function fetchTranslation(word, from) {
  const res = await fetch(
    `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=${from}|it`
  );
  if (!res.ok) return "";
  const data = await res.json();
  // le proposte migliori per prime; via la parola stessa, i doppioni e i
  // frammenti di frase che MyMemory ripesca dalle sue memorie
  const seen = new Set([word.toLowerCase()]);
  const out = [];
  const take = (raw) => {
    const t = String(raw || "").trim().toLowerCase();
    if (!t || seen.has(t) || t.split(" ").length > 3) return;
    seen.add(t);
    out.push(t);
  };
  const matches = [...(data?.matches || [])].sort(
    (a, b) => parseFloat(b.quality || 0) - parseFloat(a.quality || 0)
  );
  for (const m of matches) if (out.length < 3) take(m.translation);
  if (!out.length) take(data?.responseData?.translatedText);
  return out.join(", ");
}

// le voci meno recenti cedono il posto: un vocabolario di lettura non ha
// bisogno di ricordare tutto, solo quello che si e' cercato ultimamente
export function trimCache(records, max = MAX_WORDS) {
  if (records.length <= max) return records;
  return [...records].sort((a, b) => (b[1].at || 0) - (a[1].at || 0)).slice(0, max);
}

let loaded;
function loadCache() {
  if (!loaded) {
    loaded = (async () => {
      try {
        const saved = await getAux(AUX_KEY);
        if (saved?.v !== 1 || !saved.words) return;
        for (const [k, v] of Object.entries(saved.words)) {
          if (v && Array.isArray(v.entries) && !CACHE.has(k)) CACHE.set(k, v);
        }
      } catch {
        /* senza IndexedDB resta la cache di sessione: si legge lo stesso */
      }
    })();
  }
  return loaded;
}

async function persist() {
  const kept = trimCache([...CACHE.entries()]);
  if (kept.length < CACHE.size) {
    CACHE.clear();
    for (const [k, v] of kept) CACHE.set(k, v);
  }
  const words = {};
  // «nessuna voce» non vale la pena di conservarlo: la selezione puo' aver
  // preso una parola spezzata, e al prossimo avvio si riprova
  for (const [k, v] of kept) if (v.entries.length || v.translation) words[k] = v;
  try {
    await putAux(AUX_KEY, { v: 1, words });
  } catch {
    /* quota piena o storage negato: la ricerca ha comunque risposto */
  }
}

export async function lookup(raw, bookLang = "en") {
  const word = cleanWord(raw).toLowerCase();
  if (!word) return { word: "", entries: [] };
  const lang = (bookLang || "en").slice(0, 2).toLowerCase();
  const key = `${word}|${lang}`;
  await loadCache();
  const known = CACHE.get(key);
  if (known) {
    known.at = Date.now();
    return known;
  }

  let entries = [];
  let translation = "";
  let offline = false;
  const jobs = [
    fetchSenses(word, lang)
      .then((r) => (entries = r))
      .catch(() => (offline = true)),
  ];
  if (lang !== "it") {
    jobs.push(fetchTranslation(word, lang).then((r) => (translation = r)).catch(() => {}));
  }
  await Promise.all(jobs);

  const out = {
    word,
    translation,
    entries: entries.slice(0, 8),
    // il libro e' straniero e la traduzione non e' arrivata: la scheda
    // avvisa che le definizioni restano in lingua originale
    foreign: lang !== "it" && !translation && entries.length > 0,
    offline: offline && !entries.length && !translation,
    at: Date.now(),
  };
  // un buco di rete non diventa una risposta definitiva: senza salvarlo,
  // la stessa parola riprova appena la connessione torna
  if (out.offline) return out;
  CACHE.set(key, out);
  await persist();
  return out;
}
