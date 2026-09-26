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
// ESPORTATA PER ESSERE PROVATA, come `contentStyles` e `ritaglioAvanzo`: e'
// la regola che tiene «Death» il personaggio separato da «the death of the
// king», e ritagliarla dal sorgente per provarla varrebbe meno che chiamarla.
export const capitalized = (raw, word) => {
  const esc = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(^|[^\\p{L}])(${esc})`, "giu");
  for (const m of String(raw).matchAll(re)) {
    const first = m[2][0];
    if (/\p{Lu}/u.test(first)) return true;
  }
  return false;
};

export function buildIndex(entries) {
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

export function scan(indexes, raw) {
  const words = norm(raw).split(" ").filter(Boolean);
  const out = [];
  const seen = new Set();
  const alone = words.length === 1;
  // LA FINESTRA ARRIVA A TRE ANCHE SE NESSUNA VOCE È LUNGA TRE, e non è un
  // di piu': la regola del verbo separabile qui sotto scatta a `n === 3`, e
  // senza questo minimo il ciclo non ci arriva mai — «egg them on» sta in un
  // indice il cui termine piu' lungo e' «egg on», due parole. Oggi funziona
  // per caso, perche' nello slang c'e' «take the mickey»: la regola dipendeva
  // dalla lunghezza di una voce che non c'entra niente, e potandola sarebbe
  // sparita in silenzio. Trovato scrivendo il test su un indice isolato.
  const longest = Math.max(3, ...indexes.map(([, ix]) => (ix ? ix.max : 1)));
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

// LA PAROLA SOTTO IL DITO, non il segno disegnato sopra: cosi' risponde ogni
// occorrenza e non solo quella marcata, e il tocco non deve contendersi
// l'evento con la fascia del cambio pagina. Stava in `Reader.jsx`, fuori
// dalla portata di ogni test, ed e' una regola che sbaglia in silenzio da
// tutt'e due i lati: un nome composto letto a meta' non alza errori, apre
// la scheda sbagliata o non la apre affatto.
//
// La parte pura prende il TESTO del nodo e l'offset del caret: dal caret si
// allarga alla parola, poi alle parole attorno — un nome puo' essere
// composto («Sam Vimes», «Lord Havelock Vetinari») — e si prova dal
// candidato piu' lungo al piu' corto.
//
// E I DUE LATI SONO UGUALI (era un limite dichiarato, scelto dal lettore:
// «vai con la 5»): a sinistra si guardava UNA parola sola e a destra due,
// quindi toccando l'ultima parola di «Lord Havelock Vetinari» il nome non
// si ricomponeva mai, mentre toccando la prima si'. Adesso da tutt'e due i
// lati si guardano tante parole quante ne ha la voce piu' lunga del
// glossario (`ix.max`), e nessuna finestra ne tiene di piu':
// una finestra piu' lunga di ogni voce non combacia con niente, e
// provarla e' solo lavoro. Solo lo SPAZIO unisce due
// parole: una virgola in mezzo e' un confine, o «Vimes, Carrot» farebbe un
// nome solo.
//
// E SI PROVANO TUTTE LE FINESTRE, non quattro: prima i candidati erano i
// soli quattro angoli (tutto, senza la parola prima, senza le due dopo,
// la parola sola), quindi toccando «Sam» in «Sam Vimes walked in» si
// provavano «Sam Vimes walked» e «Sam» ma MAI «Sam Vimes» — il nome
// composto rispondeva solo toccato sull'ultima parola, o a fine frase.
// Nessun errore: la scheda semplicemente non si apriva (preso dal test).
const PAROLA = /[\p{L}\p{N}'’-]/u;

export function termineIn(text, offset, ix) {
  text = String(text || "");
  let da = offset;
  let a = offset;
  while (da > 0 && PAROLA.test(text[da - 1])) da -= 1;
  while (a < text.length && PAROLA.test(text[a])) a += 1;
  if (a <= da) return null;
  // i confini possibili ai due lati, tante parole quante ne ha la voce piu'
  // lunga del glossario, e una finestra non ne tiene di piu'; tre se
  // l'indice non lo dice
  const quante = ix?.max || 3;
  const inizi = [da];
  let sinistra = da;
  while (inizi.length < quante && sinistra > 0) {
    let j = sinistra;
    while (j > 0 && text[j - 1] === " ") j -= 1;
    if (j === sinistra || j === 0 || !PAROLA.test(text[j - 1])) break;
    while (j > 0 && PAROLA.test(text[j - 1])) j -= 1;
    sinistra = j;
    inizi.push(j);
  }
  const fini = [a];
  let destra = a;
  while (fini.length < quante && destra < text.length) {
    let j = destra;
    while (j < text.length && text[j] === " ") j += 1;
    if (j === destra || j >= text.length || !PAROLA.test(text[j])) break;
    while (j < text.length && PAROLA.test(text[j])) j += 1;
    destra = j;
    fini.push(j);
  }
  const candidati = [];
  for (let i = 0; i < inizi.length; i++)
    for (let f = 0; f < fini.length; f++) if (i + f + 1 <= quante) candidati.push(text.slice(inizi[i], fini[f]));
  candidati.sort((p, q) => q.length - p.length);
  for (const c of candidati) {
    const pulito = c.trim();
    if (!pulito) continue;
    const e = ix.map.get(norm(pulito));
    // il nome proprio vale solo se nel testo e' scritto con la maiuscola
    if (e && (!/^\p{Lu}/u.test(e.t) || /^\p{Lu}/u.test(pulito))) return e;
  }
  return null;
}

// La parte che chiede al documento dov'e' il caret sotto il punto: Chromium
// ha `caretRangeFromPoint`, Gecko — che e' il browser del lettore — solo
// `caretPositionFromPoint`, e vanno servite tutt'e due. Fuori da un nodo di
// testo non c'e' una parola.
export function termAt(doc, x, y, ix) {
  let node = null;
  let offset = 0;
  if (doc.caretRangeFromPoint) {
    const r = doc.caretRangeFromPoint(x, y);
    if (r) {
      node = r.startContainer;
      offset = r.startOffset;
    }
  } else if (doc.caretPositionFromPoint) {
    const pos = doc.caretPositionFromPoint(x, y);
    if (pos) {
      node = pos.offsetNode;
      offset = pos.offset;
    }
  }
  if (!node || node.nodeType !== 3) return null;
  return termineIn(node.nodeValue, offset, ix);
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

export const espressione = (map) => {
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
