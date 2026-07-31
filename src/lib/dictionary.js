const CACHE = new Map();

// la lingua dell'interfaccia: e' da qui che arriva la glossa tradotta
const UI_LANG = "it";

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

async function fetchSenses(site, section, word) {
  const res = await fetch(
    `https://${site}.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`
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

export async function lookup(raw, bookLang = "en") {
  const word = cleanWord(raw).toLowerCase();
  if (!word) return { word: "", entries: [] };
  const lang = (bookLang || "en").slice(0, 2).toLowerCase();
  const key = `${word}|${lang}`;
  if (CACHE.has(key)) return CACHE.get(key);

  // il Wiktionary italiano descrive anche le parole straniere, in italiano:
  // e' una traduzione vera, non una definizione da decifrare
  const sources = [{ site: UI_LANG, section: lang }];
  if (lang !== UI_LANG) sources.push({ site: lang, section: lang });

  let entries = [];
  let translated = false;
  let offline = false;
  for (const s of sources) {
    try {
      entries = await fetchSenses(s.site, s.section, word);
    } catch {
      offline = true;
    }
    if (entries.length) {
      translated = s.site === UI_LANG && lang !== UI_LANG;
      break;
    }
  }

  const out = {
    word,
    entries: entries.slice(0, 8),
    translated,
    // avvisa solo quando la definizione resta in una lingua non nostra
    foreign: lang !== UI_LANG && !translated && entries.length > 0,
    offline: offline && !entries.length,
  };
  CACHE.set(key, out);
  return out;
}
