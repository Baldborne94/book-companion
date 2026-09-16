import { pezziDalTitolo } from "./sagaDalTitolo.js";

// IL TITOLO SULLO SCAFFALE E' IL NOME DEL FILE.
//
// Segnalato guardando la Libreria: la Ruota del Tempo era «Wheel of Time
// [00]:…», «Wheel of Time [02]:…», «Wheel of Time [05]:…» — sei volumi che
// sul ripiano cominciano tutti con le stesse tre parole e si troncano
// prima di arrivare al nome del romanzo, mentre le copertine sotto il
// titolo ce l'hanno stampato sopra. Un ripiano serve a riconoscere un
// libro con la coda dell'occhio, e li' bisognava aprirli uno per uno.
//
// La roba davanti non e' il titolo: e' l'etichettatura di chi ha
// impacchettato il file, e `sagaDalTitolo` la sa gia' leggere — e' cosi'
// che la saga di quei volumi e' finita sul ripiano giusto. Quel che qui si
// tiene e' l'altra meta': cio' che RESTA tolta l'etichetta.
//
// **E NON SI RISCRIVE NIENTE IN SILENZIO.** In `CLAUDE.md` sta scritto che
// il titolo non si ripulisce, con una ragione che vale ancora: sbagliare
// un titolo e' peggio che lasciarlo lungo, e il parser sbaglierebbe in
// silenzio — un romanzo ribattezzato male non alza nessun errore, si
// legge e basta. Quindi qui si PROPONE soltanto: la Libreria mostra «da →
// a» una riga per volta e il lettore spunta. Un titolo sbagliato non passa
// perche' lo vede prima, ed e' l'unica forma in cui questa cura sta in
// piedi.

const BORDO = /^[\s\-–—:;.,_()[\]]+|[\s\-–—:;.,_]+$/g;
// le stesse parole che `sagaDalTitolo` riconosce come etichetta: un resto
// che e' solo «Book 2» non e' un titolo
const SOLO_ETICHETTA =
  /^(?:book|bk|vol\.?|volume|no\.?|n\.?|#|part|parte|chapter|capitolo|episode|episodio|libro|tome|tomo)\s*\d*$/i;
// quel che certi archivi appiccicano al nome e non e' ne' saga ne' titolo
const RUMORE = /^(?:ebook|e-book|epub|pdf|retail|unabridged|italian|ita|eng)$/i;

// L'AUTORE DAVANTI NON VA TOLTO QUI, e la prima versione lo faceva.
// «Jordan, Robert - Wheel of Time 01 - The Eye of the World» e' un titolo
// che e' il nome del file, autore compreso — ma il titolo e' comunque
// l'ultimo pezzo, e `sagaBuona` la sua meta' (la saga) se la prende gia'
// dall'ultimo segmento prima del numero. Misurato sui quattro casi veri:
// togliere il primo segmento o lasciarlo da' lo STESSO titolo. Quella
// funzione era una guardia che non guardava niente, ed e' peggio di
// nessuna guardia perche' il prossimo le crede.
//
// Torna il titolo ripulito, o `null` quando non c'e' niente da togliere o
// quel che resta non e' un titolo. `null` non e' un guasto: e' la risposta
// normale su un titolo gia' pulito, che sono la maggioranza.
export function titoloPulito({ title } = {}) {
  const originale = String(title || "").trim();
  if (!originale) return null;
  const pezzi = pezziDalTitolo(originale);
  if (!pezzi?.resto) return null;
  const pulito = String(pezzi.resto).replace(BORDO, "").trim();
  if (pulito.length < 2) return null;
  if (!/\p{L}/u.test(pulito)) return null;
  if (SOLO_ETICHETTA.test(pulito) || RUMORE.test(pulito)) return null;
  // cintura e bretelle, e dichiarato nel test: oggi non ci si arriva —
  // ogni espressione consuma almeno una cifra, quindi il resto e' sempre
  // piu' corto — ma una forma nuova potrebbe lasciare tutto, e il pannello
  // mostrerebbe una riga «X → X» da spuntare
  return pulito === originale ? null : pulito;
}

// La passata sulla biblioteca: una proposta per libro, e solo dove c'e'
// qualcosa da togliere. Resta pura — chi scrive e' la Libreria, dopo che
// il lettore ha spuntato.
export function proponiTitoli(books) {
  const fuori = [];
  for (const b of books || []) {
    if (!b?.id) continue;
    const a = titoloPulito(b);
    if (a) fuori.push({ id: b.id, da: b.title, a });
  }
  return fuori;
}
