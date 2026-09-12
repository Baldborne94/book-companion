// LA SAGA SCRITTA NEL TITOLO.
//
// Segnalato con la Libreria in mano: quattro John Gwynne sotto il nome
// dell'autore, «02 Valour», «Malice: The Faithful and the Fallen Series
// Book 1», «Ruin», «Wrath» — e nessuna saga. La tavola non lo conosce, la
// collana nel file non c'era, la deduzione dalla biblioteca ha bisogno di
// un ALTRO libro dello stesso autore che la saga ce l'abbia gia': nessuna
// delle tre strade poteva dire niente. Ma la saga sta scritta nel titolo,
// per esteso, col numero accanto — e' l'etichettatura dell'editore, la
// stessa che `retroInRete.js` TOGLIE per interrogare il catalogo. Qui si
// fa il contrario: si legge prima di buttarla.
//
// Tre forme, e sono quelle che gli ePub portano davvero:
//   Titolo: Saga Series Book N     Titolo (Saga Book N)    Titolo (Saga, #N)
//   Saga Book N - Titolo           Saga 09 - Titolo        Saga 1: Titolo
//   02 Titolo                      (solo il numero: la saga la dice un altro)
// Quel che non e' in una di queste forme non si legge: un'etichetta
// indovinata mette il libro nella saga sbagliata, ed e' peggio di un
// ripiano in piu'.

const NUMERO = "(\\d{1,3}(?:[.,]\\d)?)";
// col confine di parola davanti, o «Season 2» si leggerebbe «Seaso» + «n 2»
const ETICHETTA =
  "(?<![a-z])(?:book|bk|vol\\.?|volume|no\\.?|n\\.?|#|part|parte|chapter|capitolo|episode|episodio|season|stagione|libro|tome|tomo)";
const CODA = /[\s,:;.\-–—]+$/;
const SERIE = /\s+(series|serie|saga|cycle|ciclo)$/i;

// «2.5» e' la novella fra il secondo e il terzo, e resta 2.5; lo zero e'
// il modo di dire «non lo so», e vale niente
function numero(s) {
  const n = parseFloat(String(s).replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

// una saga e' un nome, non un'etichetta ne' un numero: «Book», «Vol 2» o
// «3» non sono saghe, e senza questa guardia lo diventerebbero
function sagaBuona(s) {
  const nome = String(s || "").replace(CODA, "").replace(SERIE, "").trim();
  if (nome.length < 3 || nome.length > 60) return null;
  if (!/[a-z]/i.test(nome)) return null;
  if (new RegExp(`^${ETICHETTA}\\s*\\d*$`, "i").test(nome)) return null;
  // «Book 3 of the Wheel of Time» lascia l'articolo minuscolo: un nome
  // di saga comincia maiuscolo, o sul ripiano stonerebbe coi fratelli
  return nome[0].toUpperCase() + nome.slice(1);
}

// A. la saga DOPO il titolo, dietro un separatore: «Malice: The Faithful
//    and the Fallen Series Book 1», «Eric (Discworld, #9)», «The Final
//    Empire (Mistborn Book 1)». Dentro le parentesi il numero puo' stare
//    nudo — «(Discworld 9)» — fuori no, o «Fahrenheit 451» diventerebbe una
//    saga: li' l'etichetta e' obbligatoria.
const DOPO_PARENTESI = new RegExp(
  `^(.{2,}?)\\s*[(\\[]\\s*(.+?)\\s*(?:,\\s*)?(?:${ETICHETTA}\\s*)?${NUMERO}\\s*[)\\]]\\s*$`,
  "i"
);
const DOPO_SEPARATORE = new RegExp(
  `^(.{2,}?)\\s*[:\\-–—]\\s*(.+?)\\s*(?:,\\s*)?${ETICHETTA}\\s*${NUMERO}\\s*$`,
  "i"
);
// B. la saga PRIMA del titolo, col numero in mezzo: «Discworld 09 - Eric»,
//    «The Faithful and the Fallen Book 1 - Malice», «Mistborn 1: The Final
//    Empire». Il pezzo davanti deve avere una lettera — «2001: A Space
//    Odyssey» non e' la saga «2001».
const PRIMA = new RegExp(
  `^(.+?)\\s+(?:${ETICHETTA}\\s*)?${NUMERO}\\s*[:\\-–—]\\s*(.{2,})$`,
  "i"
);
// C. il solo numero in testa: «02 Valour», «1 - Malice». Non dice la saga,
//    dice il posto: vale solo se la saga arriva da un altro (un fratello, il
//    file, la tavola). Due cifre al massimo, o «1984» sarebbe il volume 1984.
const IN_TESTA = /^(\d{1,2})(?:\s*[-–.)_]\s*|\s+)(?=\D)/;
// D. «Book N of the Saga», in coda o in testa: «The Dragon Reborn: Book 3
//    of the Wheel of Time», «Book 3 of the Wheel of Time: The Dragon
//    Reborn». E' la forma delle edizioni inglesi vecchie.
const DI_IN_CODA = new RegExp(
  `^(.{2,}?)\\s*[:\\-–—(]\\s*${ETICHETTA}\\s*${NUMERO}\\s+(?:of|di|del|della|dei|delle)\\s+(.+?)\\s*\\)?\\s*$`,
  "i"
);
const DI_IN_TESTA = new RegExp(
  `^${ETICHETTA}\\s*${NUMERO}\\s+(?:of|di|del|della|dei|delle)\\s+(.+?)\\s*[:\\-–—]\\s*(.{2,})$`,
  "i"
);
// E. la saga fra parentesi quadre IN TESTA, che e' come certi archivi
//    battezzano i file: «[Wheel of Time 03] The Dragon Reborn».
const QUADRE_IN_TESTA = new RegExp(
  `^[\\[(]\\s*(.+?)\\s+(?:${ETICHETTA}\\s*)?${NUMERO}\\s*[\\])]\\s*(.{2,})$`,
  "i"
);

function leggi(campo) {
  const s = String(campo || "").trim();
  if (!s) return null;
  let m = DOPO_PARENTESI.exec(s) || DOPO_SEPARATORE.exec(s);
  if (m) {
    const saga = sagaBuona(m[2]);
    if (saga) return { saga, sagaOrder: numero(m[3]) };
  }
  m = DI_IN_CODA.exec(s);
  if (m) {
    const saga = sagaBuona(m[3]);
    if (saga) return { saga, sagaOrder: numero(m[2]) };
  }
  m = DI_IN_TESTA.exec(s);
  if (m) {
    const saga = sagaBuona(m[2]);
    if (saga) return { saga, sagaOrder: numero(m[1]) };
  }
  m = QUADRE_IN_TESTA.exec(s) || PRIMA.exec(s);
  if (m) {
    const saga = sagaBuona(m[1]);
    if (saga) return { saga, sagaOrder: numero(m[2]) };
  }
  m = IN_TESTA.exec(s);
  if (m) return { saga: null, sagaOrder: numero(m[1]) };
  return null;
}

// Il nome del file senza l'estensione, e con l'autore davanti tolto quando
// il file e' scritto «Autore - Saga 09 - Titolo»: il primo segmento che
// non porta numeri e' quasi sempre lui, e lasciandolo la forma B lo
// prenderebbe per la saga.
function pulisciFile(fileName, author) {
  let s = String(fileName || "").replace(/\.(epub|pdf|mobi|azw3|kepub)$/i, "").trim();
  const pezzi = s.split(/\s+-\s+/);
  if (pezzi.length >= 3 && !/\d/.test(pezzi[0])) {
    const primo = pezzi[0].toLowerCase();
    const cognome = String(author || "").toLowerCase().split(/[\s,]+/).filter(Boolean).pop();
    if (!cognome || primo.includes(cognome)) s = pezzi.slice(1).join(" - ");
  }
  return s;
}

// Titolo prima, nome del file dopo: il titolo e' quel che il lettore
// vede, e se dice una cosa diversa dal file comanda lui. Torna `null` se
// nessuno dei due dice niente; `saga: null` col solo `sagaOrder` quando
// c'e' il numero e non la saga.
export function sagaDalTitolo({ title, fileName, author } = {}) {
  const dalTitolo = leggi(title);
  if (dalTitolo?.saga) return dalTitolo;
  const dalFile = leggi(pulisciFile(fileName, author));
  if (dalFile?.saga) {
    // il titolo aveva il solo numero: quello resta suo
    return { saga: dalFile.saga, sagaOrder: dalTitolo?.sagaOrder ?? dalFile.sagaOrder };
  }
  const n = dalTitolo?.sagaOrder ?? dalFile?.sagaOrder ?? null;
  return n != null ? { saga: null, sagaOrder: n } : null;
}
