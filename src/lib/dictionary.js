const CACHE = new Map();

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

async function fromWiktionary(word, lang) {
  const res = await fetch(
    `https://${lang}.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`
  );
  if (!res.ok) return [];
  const data = await res.json();
  const out = [];
  for (const blocks of Object.values(data || {})) {
    for (const block of blocks || []) {
      for (const d of block.definitions || []) {
        const text = strip(d.definition);
        if (text) out.push({ pos: block.partOfSpeech || "", text });
      }
    }
  }
  return out;
}

export async function lookup(raw, langs = ["en"]) {
  const word = cleanWord(raw).toLowerCase();
  if (!word) return { word: "", entries: [] };
  const key = `${word}|${langs.join(",")}`;
  if (CACHE.has(key)) return CACHE.get(key);

  let entries = [];
  let offline = false;
  for (const lang of langs) {
    try {
      entries = await fromWiktionary(word, lang);
    } catch {
      offline = true;
    }
    if (entries.length) break;
  }
  const out = { word, entries: entries.slice(0, 8), offline: offline && !entries.length };
  CACHE.set(key, out);
  return out;
}
