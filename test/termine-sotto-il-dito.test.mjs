// LA PAROLA SOTTO IL DITO. Toccando il testo di un capitolo il reader chiede
// al documento dov'è il caret e da lì allarga alla parola, poi a una prima
// e due dopo, per riconoscere un termine del glossario anche quando è un
// nome composto. Stava in `Reader.jsx`, fuori dalla portata di ogni test, e
// sbaglia in silenzio da tutt'e due i lati: un nome letto a metà non alza
// errori, apre la scheda sbagliata o non la apre affatto.
import { termineIn, termAt, buildIndex } from "../src/lib/glossary.js";

const ix = buildIndex([
  { t: "Vimes", d: "il comandante" },
  { t: "Sam Vimes", d: "il comandante, per esteso" },
  { t: "Lord Havelock Vetinari", d: "il Patrizio" },
  { t: "Death", d: "il personaggio" },
  { t: "warren", d: "un cunicolo di magia" },
  { t: "Ankh-Morpork", d: "la città" },
]);
// il caret dentro una parola: l'indice della lettera «dentro»
const su = (testo, parola) => testo.indexOf(parola) + 1;

export default async function (t) {
  // ---- LA PAROLA SOLA -----------------------------------------------------
  t.eq("il caret dentro la parola la trova", termineIn("said Vimes quietly", su("said Vimes quietly", "Vimes"), ix)?.t, "Vimes");
  t.eq("anche in testa al testo", termineIn("Vimes said", 0, ix)?.t, "Vimes");
  t.eq("anche in coda, col caret sull'ultima lettera", termineIn("said Vimes", 9, ix)?.t, "Vimes");
  t.eq("il caret su uno spazio non è una parola", termineIn("said Vimes", 4, ix), null);
  t.eq("una parola che non è nel glossario", termineIn("said nobody", 6, ix), null);
  t.eq("un testo vuoto", termineIn("", 0, ix), null);
  t.eq("un testo assente", termineIn(null, 0, ix), null);
  t.eq("il trattino sta dentro la parola", termineIn("in Ankh-Morpork today", su("in Ankh-Morpork today", "Morpork"), ix)?.t, "Ankh-Morpork");

  // ---- IL NOME COMPOSTO, E IL PIÙ LUNGO VINCE -----------------------------
  const frase = "Captain Sam Vimes walked in";
  t.eq("toccando l'ultima parola si prende il nome intero", termineIn(frase, su(frase, "Vimes"), ix)?.t, "Sam Vimes");
  // PRESO DAL TEST: coi soli quattro «angoli» toccando «Sam» si provavano
  // «Sam Vimes walked» e «Sam», mai «Sam Vimes»: il nome composto rispondeva
  // solo toccato sull'ultima parola, o a fine frase
  t.eq("e anche toccando la prima, col testo che continua", termineIn(frase, su(frase, "Sam"), ix)?.t, "Sam Vimes");
  t.eq("a fine frase, toccando la prima", termineIn("Captain Sam Vimes", su("Captain Sam Vimes", "Sam"), ix)?.t, "Sam Vimes");
  // due parole dopo: «Lord» + «Havelock Vetinari»
  const lord = "the Lord Havelock Vetinari smiled thinly";
  t.eq("una parola prima e due dopo bastano a tre parole, toccando la prima", termineIn(lord, su(lord, "Lord"), ix)?.t, "Lord Havelock Vetinari");
  t.eq("e toccando quella in mezzo", termineIn(lord, su(lord, "Havelock"), ix)?.t, "Lord Havelock Vetinari");
  // DICHIARATO: a sinistra si guarda UNA parola sola, quindi toccando
  // l'ultima di un nome di tre non lo si ricompone — è il prezzo di non
  // allargare troppo, e il lettore tocca il nome dove lo vede intero
  t.eq("toccando l'ultima di tre, una parola prima non basta (dichiarato)", termineIn(lord, su(lord, "Vetinari"), ix), null);

  // ---- SOLO LO SPAZIO UNISCE ------------------------------------------------
  t.eq("una virgola in mezzo è un confine: resta la parola sola", termineIn("Sam, Vimes", su("Sam, Vimes", "Vimes"), ix)?.t, "Vimes");
  t.eq("e anche a destra", termineIn("Sam. Vimes", su("Sam. Vimes", "Sam"), ix), null);
  t.eq("più spazi sono uno spazio", termineIn("Sam   Vimes", su("Sam   Vimes", "Sam"), ix)?.t, "Sam Vimes");

  // ---- IL NOME PROPRIO VUOLE LA MAIUSCOLA NEL TESTO -------------------------
  t.eq("«the death of the king» non è il personaggio", termineIn("the death of the king", su("the death of the king", "death"), ix), null);
  t.eq("«Death said» sì", termineIn("Death said", 1, ix)?.t, "Death");
  // una voce minuscola si accende anche scritta maiuscola nel testo: la
  // regola difende il nome proprio, non la parola comune
  t.eq("una voce minuscola vale anche in maiuscola", termineIn("The Warren opened", su("The Warren opened", "Warren"), ix)?.t, "warren");
  t.eq("e in minuscola", termineIn("a warren opened", su("a warren opened", "warren"), ix)?.t, "warren");

  // ---- IL CARET SI CHIEDE AL DOCUMENTO, SU DUE MOTORI ----------------------
  const nodo = (testo) => ({ nodeType: 3, nodeValue: testo });
  const chromium = { caretRangeFromPoint: () => ({ startContainer: nodo("said Vimes"), startOffset: 6 }) };
  t.eq("Chromium: caretRangeFromPoint", termAt(chromium, 10, 10, ix)?.t, "Vimes");
  // Gecko — il browser del lettore — ha SOLO caretPositionFromPoint
  const gecko = { caretPositionFromPoint: () => ({ offsetNode: nodo("said Vimes"), offset: 6 }) };
  t.eq("Gecko: caretPositionFromPoint", termAt(gecko, 10, 10, ix)?.t, "Vimes");
  // se ci sono tutt'e due si usa la prima, e la seconda non si chiama
  let chiamata = false;
  const entrambi = { ...chromium, caretPositionFromPoint: () => { chiamata = true; return null; } };
  t.eq("con tutt'e due risponde la prima", termAt(entrambi, 1, 1, ix)?.t, "Vimes");
  t.c("e la seconda non si tocca", !chiamata);
  // il caret fuori da un nodo di testo non è una parola — un commento ha
  // un `nodeValue` come un nodo di testo, e senza la guardia sul tipo si
  // leggerebbe anche quello
  t.eq("un commento non è testo, anche se ha un valore", termAt({ caretRangeFromPoint: () => ({ startContainer: { nodeType: 8, nodeValue: "Vimes" }, startOffset: 1 }) }, 1, 1, ix), null);
  t.eq("nessun caret sotto il punto", termAt({ caretRangeFromPoint: () => null }, 1, 1, ix), null);
  t.eq("un documento senza nessuna delle due", termAt({}, 1, 1, ix), null);
  t.eq("un nodo di testo vuoto", termAt({ caretRangeFromPoint: () => ({ startContainer: nodo(""), startOffset: 0 }) }, 1, 1, ix), null);
}
