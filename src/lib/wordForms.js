// La ricerca nel libro non deve essere alla lettera: chi cerca «muscle in»
// vuole trovare anche «muscling in», e chi cerca «muscling» vuole trovare
// «muscle». Da ogni parola della domanda si generano le flessioni regolari
// (avanti) e le possibili basi (indietro), e si cercano tutte: una forma che
// non esiste non compare nel testo e non costa niente.
//
// LE LINGUE SONO DUE, e si generano SEMPRE tutt'e due senza chiedersi in che
// lingua sia il libro. Indovinare la lingua da una parola sola non si puo', e
// sbagliando si perderebbero proprio le ricerche che questa cura deve
// salvare. Le forme dell'altra lingua quasi mai esistono in questa — «cane»
// inglese genera l'italiano «cani», che in un romanzo inglese non compare — e
// quel che non compare non costa niente.

const doppia = (s) => /(.)\1$/.test(s);

function flessioni(w) {
  const out = new Set();
  if (w.length < 3) return out;
  out.add(`${w}s`);
  out.add(`${w}es`);
  if (w.endsWith("e")) {
    out.add(`${w}d`);
    out.add(`${w.slice(0, -1)}ing`);
    out.add(`${w.slice(0, -1)}ed`);
  } else {
    out.add(`${w}ed`);
    out.add(`${w}ing`);
  }
  if (w.endsWith("y")) {
    out.add(`${w.slice(0, -1)}ies`);
    out.add(`${w.slice(0, -1)}ied`);
  }
  if (/[aeiou][bcdfgklmnprstvz]$/.test(w)) {
    out.add(`${w}${w[w.length - 1]}ed`);
    out.add(`${w}${w[w.length - 1]}ing`);
  }
  return out;
}

function basi(w) {
  const out = new Set();
  if (w.endsWith("ing") && w.length > 4) {
    const stem = w.slice(0, -3);
    out.add(stem);
    out.add(`${stem}e`);
    if (doppia(stem)) out.add(stem.slice(0, -1));
  } else if (w.endsWith("ied") && w.length > 4) {
    out.add(`${w.slice(0, -3)}y`);
  } else if (w.endsWith("ed") && w.length > 3) {
    const stem = w.slice(0, -2);
    out.add(stem);
    out.add(`${stem}e`);
    if (doppia(stem)) out.add(stem.slice(0, -1));
  } else if (w.endsWith("ies") && w.length > 4) {
    out.add(`${w.slice(0, -3)}y`);
  } else if (w.endsWith("es") && w.length > 3) {
    out.add(w.slice(0, -1));
    out.add(w.slice(0, -2));
  } else if (w.endsWith("s") && w.length > 3) {
    out.add(w.slice(0, -1));
  }
  out.delete(w);
  return out;
}

// ---------------------------------------------------------------------------
// L'ITALIANO: solo il NUMERO, mai il genere.
//
// «libro» non trovava «libri», «strega» non trovava «streghe»: su un romanzo
// italiano la ricerca falliva proprio dove sbaglia piu' spesso la memoria,
// perche' una frase la ricordi al singolare e il libro la scrive al plurale.
//
// IL GENERE RESTA FUORI, ed e' una rinuncia decisa e non una dimenticanza.
// Passare da -o a -a per prendere gli aggettivi («alto» → «alta») vorrebbe
// dire generare anche «caso» da «casa», e quella non e' una forma inventata
// che nel testo non compare: e' UN'ALTRA PAROLA, che compare eccome. In
// inglese l'over-generazione produce non-parole («musclees») e non costa
// niente; in italiano produce parole vere, e li' il prezzo cambia. Il genere
// per giunta serve poco: una frase la ricordi come l'hai letta, con gli
// accordi che aveva.
//
// SOTTO LE QUATTRO LETTERE NON SI FLETTE, mentre l'inglese si ferma a tre. A
// tre, «che» diventerebbe «chi» e «uno» diventerebbe «uni» — parole che
// stanno in ogni riga di ogni pagina, e una ricerca che le confonde non
// trova, allaga. Il prezzo dichiarato e' che «zio» non trova «zii»: un nome
// di tre lettere perso vale molto meno di una parola-funzione allagata.
const MIN_IT = 4;

// Le uscite del plurale, per famiglia. La `c` e la `g` cambiano suono davanti
// alla `i` e alla `e`, quindi la loro strada e' doppia: «amico» fa «amici» ma
// «banco» fa «banchi», e da una parola sola non si sa quale delle due sia —
// si generano tutt'e due, e quella sbagliata semplicemente non compare.
const AVANTI = [
  [/cia$/, ["ce", "cie"]],
  [/gia$/, ["ge", "gie"]],
  [/ca$/, ["che"]],
  [/ga$/, ["ghe"]],
  [/co$/, ["chi", "ci"]],
  [/go$/, ["ghi", "gi"]],
  [/io$/, ["i", "ii"]],
  [/o$/, ["i"]],
  [/a$/, ["e"]],
  [/e$/, ["i"]],
];

// All'indietro il plurale non dice da dove viene: «-i» puo' venire da «-o»
// (libri) o da «-e» (cani), e non c'e' modo di saperlo. Si tengono tutt'e due.
const INDIETRO = [
  [/chi$/, ["co"]],
  [/ghi$/, ["go"]],
  [/cie$/, ["cia"]],
  [/gie$/, ["gia"]],
  [/che$/, ["ca"]],
  [/ghe$/, ["ga"]],
  [/ce$/, ["cia"]],
  [/ge$/, ["gia"]],
  [/ii$/, ["io"]],
  [/ci$/, ["co"]],
  [/gi$/, ["go"]],
  [/i$/, ["o", "e"]],
  [/e$/, ["a"]],
];

// La prima famiglia che risponde vince: le uscite stanno in ordine dalla piu'
// specifica alla piu' generica, o `/o$/` si mangerebbe «-co» e «-go» prima
// che possano dire la loro.
function applica(w, regole) {
  const out = new Set();
  if (w.length < MIN_IT) return out;
  for (const [coda, uscite] of regole) {
    if (!coda.test(w)) continue;
    const radice = w.replace(coda, "");
    for (const u of uscite) out.add(radice + u);
    break;
  }
  out.delete(w);
  return out;
}

export const pluraliIt = (w) => applica(w, AVANTI);
export const singolariIt = (w) => applica(w, INDIETRO);

export function varianti(word) {
  const w = String(word || "").toLowerCase();
  const out = new Set([w]);
  for (const f of flessioni(w)) out.add(f);
  for (const b of basi(w)) {
    out.add(b);
    for (const f of flessioni(b)) out.add(f);
  }
  // l'italiano: il plurale della parola chiesta, e — se quella chiesta era
  // gia' un plurale — il singolare, col suo plurale di ritorno. Cosi'
  // «streghe» ritrova «strega», come «muscling» ritrova «muscle».
  for (const p of pluraliIt(w)) out.add(p);
  for (const s of singolariIt(w)) {
    out.add(s);
    for (const p of pluraliIt(s)) out.add(p);
  }
  return out;
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Una sola espressione per tutta la domanda: ogni parola diventa il ventaglio
// delle sue forme (le lunghe per prime), le parole corte restano esatte per
// non prendere lucciole per lanterne, e fra una parola e l'altra va bene
// qualsiasi separatore. Confini di parola veri ai due capi.
export function queryRegex(query) {
  const words = String(query || "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}']+/u)
    .filter(Boolean);
  if (!words.length) return null;
  const parts = words.map((w) =>
    w.length >= 3
      ? `(?:${[...varianti(w)].sort((a, b) => b.length - a.length).map(esc).join("|")})`
      : esc(w)
  );
  return new RegExp(
    `(?<![\\p{L}\\p{N}])${parts.join("[^\\p{L}\\p{N}]+")}(?![\\p{L}\\p{N}])`,
    "giu"
  );
}
