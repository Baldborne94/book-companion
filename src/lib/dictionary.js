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

async function fetchTranslation(word, from, intera = false) {
  const res = await fetch(
    `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=${from}|it`
  );
  if (!res.ok) return "";
  const data = await res.json();
  // le proposte migliori per prime; via la parola stessa, i doppioni e i
  // frammenti di frase che MyMemory ripesca dalle sue memorie
  // Su una frase intera la resa e' lunga per forza: il filtro delle tre
  // parole, giusto per una voce di vocabolario, qui cancellerebbe tutto.
  if (intera) {
    const t = String(data?.responseData?.translatedText || "").trim();
    return t.toLowerCase() === word.toLowerCase() ? "" : t;
  }
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

// Gli idiomi su Wiktionary sono voci a sé («kick the bucket», «take the
// mickey»), ma la frase che si evidenzia leggendo non coincide quasi mai con
// il titolo della voce: dentro c'è il modo di dire più il resto del periodo.
// Si provano allora le sotto-frasi, dalla più lunga alla più corta, e vince
// la prima che esiste davvero. È un dizionario di modi di dire grande quanto
// Wiktionary, al posto di un elenco scritto a mano.
const MAX_TRIES = 50;

// Wiktionary indicizza l'infinito: nel libro c'e' «taking the mickey», la
// voce si chiama «take the mickey». Il verbo sta quasi sempre in testa al
// modo di dire, quindi si prova anche la prima parola riportata alla forma
// base. Solo con una tabella esplicita: tagliare le desinenze a occhio
// storpierebbe le parole che desinenze non hanno.
const LEMMI = {
  took: "take", takes: "take", taking: "take", taken: "take",
  kicked: "kick", kicks: "kick", kicking: "kick",
  went: "go", gone: "go", goes: "go", going: "go",
  came: "come", comes: "come", coming: "come",
  got: "get", gets: "get", getting: "get",
  gave: "give", given: "give", gives: "give", giving: "give",
  made: "make", makes: "make", making: "make",
  put: "put", puts: "put", putting: "put",
  kept: "keep", keeps: "keep", keeping: "keep",
  pulled: "pull", pulls: "pull", pulling: "pull",
  threw: "throw", thrown: "throw", throws: "throw", throwing: "throw",
  ran: "run", runs: "run", running: "run",
  saw: "see", seen: "see", sees: "see", seeing: "see",
  held: "hold", holds: "hold", holding: "hold",
  lost: "lose", loses: "lose", losing: "lose",
  blew: "blow", blown: "blow", blows: "blow", blowing: "blow",
  broke: "break", broken: "break", breaks: "break", breaking: "break",
  caught: "catch", catches: "catch", catching: "catch",
  spent: "spend", spends: "spend", spending: "spend",
  paid: "pay", pays: "pay", paying: "pay",
  drew: "draw", drawn: "draw", draws: "draw", drawing: "draw",
  fell: "fall", fallen: "fall", falls: "fall", falling: "fall",
  told: "tell", tells: "tell", telling: "tell",
  turned: "turn", turns: "turn", turning: "turn",
  strung: "string", strings: "string", stringing: "string",
  stood: "stand", stands: "stand", standing: "stand",
  cut: "cut", cuts: "cut", cutting: "cut",
  sent: "send", sends: "send", sending: "send",
  knocked: "knock", knocks: "knock", knocking: "knock",
  picked: "pick", picks: "pick", picking: "pick",
  pushed: "push", pushes: "push", pushing: "push",
  worked: "work", works: "work", working: "work",
  talked: "talk", talks: "talk", talking: "talk",
  did: "do", does: "do", doing: "do", done: "do",
  had: "have", has: "have", having: "have",
  was: "be", were: "be", been: "be", being: "be", is: "be", are: "be",
};

// «out of the» non e' un modo di dire di niente: le finestre che finiscono
// con una parola vuota si scartano prima di sprecarci una richiesta
const VUOTE = new Set([
  "the", "a", "an", "of", "and", "or", "but", "to", "in", "on", "at", "by",
  "for", "with", "from", "that", "this", "it", "he", "she", "they", "you",
  "his", "her", "their", "your", "my", "was", "were", "is", "are", "had",
  "has", "been", "as", "so", "if", "then", "than", "very", "just", "only",
]);

// Tutte le finestre da 2 a 5 parole, le piu' lunghe per prime perche' piu'
// specifiche. Non si prova a indovinare quale sia quella buona: costano una
// richiesta sola tutte insieme (vedi esistenti()), quindi tanto vale
// chiederle tutte invece di sprecare il budget sulle prime della frase — che
// e' l'errore in cui questa funzione e' cascata due volte.
function subPhrases(words) {
  const out = [];
  const visti = new Set();
  const aggiungi = (t) => {
    if (visti.has(t) || out.length >= MAX_TRIES) return;
    visti.add(t);
    out.push(t);
  };
  for (let n = Math.min(5, words.length); n >= 2; n--) {
    for (let i = 0; i + n <= words.length; i++) {
      const f = words.slice(i, i + n);
      if (VUOTE.has(f[f.length - 1]) || f.every((w) => VUOTE.has(w))) continue;
      aggiungi(f.join(" "));
      const base = LEMMI[f[0]];
      if (base) aggiungi([base, ...f.slice(1)].join(" "));
    }
  }
  return out;
}

// Quali di questi titoli esistono davvero su Wiktionary: una domanda sola per
// tutti e cinquanta, invece di una richiesta a testa. Le voci mancanti
// tornano marcate `missing`, e i titoli normalizzati (la maiuscola iniziale)
// vanno riportati alla forma chiesta.
async function esistenti(titoli) {
  const url =
    "https://en.wiktionary.org/w/api.php?action=query&format=json&formatversion=2&origin=*&titles=" +
    encodeURIComponent(titoli.join("|"));
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  const vive = new Set();
  for (const p of data?.query?.pages || []) {
    if (!p.missing && p.title) vive.add(p.title.toLowerCase());
  }
  return titoli.filter((t) => vive.has(t.toLowerCase()));
}

export async function lookupPhrase(raw, bookLang = "en") {
  const lang = (bookLang || "en").slice(0, 2).toLowerCase();
  const words = cleanWord(raw).toLowerCase().split(" ").filter(Boolean);
  if (words.length < 2) return lookup(raw, bookLang);
  await loadCache();

  const cands = subPhrases(words);
  const noti = cands.filter((c) => CACHE.get(`${c}|${lang}`)?.entries?.length);
  let offline = false;
  let vive = noti;
  if (!vive.length) {
    try {
      vive = await esistenti(cands);
    } catch {
      offline = true;
      vive = [];
    }
  }

  // fra le voci esistenti vince la piu' lunga: «take the mickey» batte
  // «the mickey», ed e' quella che spiega davvero il passaggio
  const scelta = vive.sort((a, b) => b.split(" ").length - a.split(" ").length)[0] || null;
  let entries = [];
  if (scelta) {
    const known = CACHE.get(`${scelta}|${lang}`);
    if (known?.entries?.length) entries = known.entries;
    else {
      try {
        entries = await fetchSenses(scelta, lang);
      } catch {
        offline = true;
      }
    }
  }

  const vinta = entries.length ? { c: scelta, entries } : null;
  const testo = vinta ? vinta.c : cleanWord(raw);
  let translation = "";
  if (lang !== "it" && !translation) {
    translation = await fetchTranslation(testo, lang, !vinta).catch(() => "");
  }

  const out = {
    word: testo,
    entries: (vinta?.entries || []).slice(0, 8),
    translation,
    // senza una voce, la resa è una traduzione a macchina dell'intero
    // passaggio: va detto, o si scambia per il significato del modo di dire
    machine: !vinta && !!translation,
    idiom: !!vinta,
    foreign: false,
    offline,
    at: Date.now(),
  };
  if (vinta && !out.offline) {
    CACHE.set(`${vinta.c}|${lang}`, { ...out, foreign: false });
    await persist();
  }
  return out;
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
