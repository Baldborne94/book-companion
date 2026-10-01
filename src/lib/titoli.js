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
// **E NON SI RISCRIVE NIENTE IN SILENZIO.** In `docs/STORIA.md` sta scritto che
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
// LE ETICHETTE DI CHI HA MESSO IN GIRO IL FUMETTO (segnalato dal lettore con
// le raccolte di I Hate Fairyland e Walking Dead: «v03 - Good Girl (2017)
// GetComics.INFO», «(Digital) (XRA-Empire)», «(Fan Made TPB)»). Stanno IN
// CODA, fra parentesi o nude, e non sono il titolo: l'anno, «digital», il
// gruppo che l'ha scansionato, il sito. Si tolgono solo dalla coda e solo
// nei fumetti: in mezzo al titolo un anno distingue una serie («Batman
// (2016) v01»), e nei romanzi «(1965)» puo' essere del titolo.
const ETICHETTA =
  /^(?:\d{4}(?:-\d{4})?|digital|digital-empire|webrip|web-rip|c2c|hd|hq|upscaled|scan|fixed|repack|tpb|fan[ -]?made(?: tpb)?|of \d+|[\w'.-]*empire|getcomics(?:\.info)?)$/i;
const CODA = /\s*(?:[([]([^()[\]]*)[)\]]|\bgetcomics\.info)\s*$/i;
export function senzaEtichette(titolo) {
  let t = String(titolo || "").trim();
  for (;;) {
    const m = CODA.exec(t);
    if (!m || (m[1] !== undefined && !ETICHETTA.test(m[1].trim()))) return t;
    t = t.slice(0, m.index).trim();
  }
}
// «Saga v03 - Titolo», «v06: Titolo»: la forma dei fumetti che il parser
// delle saghe non legge (vuole «Vol.» o il numero senza la «v»)
const VOLUME_V = /^(?:.*?\s)?v\d{1,3}\s*[-–—:]\s*(.+)$/i;

// Il numero del volume, nei fumetti, esce dal titolo solo se la scheda ce
// l'ha gia' (il numero sulla copertina): rinominare tocca il solo titolo, e
// «v03» tolto da una scheda senza numero sparirebbe del tutto.
export function titoloPulito({ title, fileType, sagaOrder } = {}) {
  const originale = String(title || "").trim();
  if (!originale) return null;
  const fumetto = fileType === "cbz" || fileType === "cbr";
  const base = fumetto ? senzaEtichette(originale) : originale;
  const senzaNumero = !fumetto || Number(sagaOrder) > 0 ? pezziDalTitolo(base)?.resto || (fumetto && VOLUME_V.exec(base)?.[1]) : null;
  const resto = senzaNumero || (base !== originale ? base : null);
  if (!resto) return null;
  const pulito = String(resto).replace(BORDO, "").trim();
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
//
// UN TITOLO RIPULITO NON PUO' FARE DUE FUMETTI OMONIMI: i doppioni dei
// fumetti si riconoscono dal solo titolo (`doppioniInBiblioteca`), e
// «The Complete Short Stories v1» e «v2» diventati uguali sarebbero
// proposti come copie da unire. Una proposta che fa un titolo gia' preso
// da un altro fumetto (com'e' adesso o come verrebbe) non si fa.
export function proponiTitoli(books) {
  const fuori = [];
  const chiave = (t) => String(t || "").trim().toLowerCase();
  const fumetti = (books || []).filter((b) => b?.id && (b.fileType === "cbz" || b.fileType === "cbr"));
  const conta = new Map();
  const nuovo = new Map();
  for (const b of books || []) {
    if (!b?.id) continue;
    const a = titoloPulito(b);
    if (a) nuovo.set(b.id, a);
  }
  for (const b of fumetti) {
    const k = chiave(nuovo.get(b.id) ?? b.title);
    conta.set(k, (conta.get(k) || 0) + 1);
  }
  for (const b of books || []) {
    const a = nuovo.get(b?.id);
    if (!a) continue;
    const eFumetto = b.fileType === "cbz" || b.fileType === "cbr";
    if (eFumetto && conta.get(chiave(a)) > 1) continue;
    fuori.push({ id: b.id, da: b.title, a });
  }
  return fuori;
}
