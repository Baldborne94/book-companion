// LO SCAFFALE E' FATTO DI RIPIANI, e su un ripiano i libri stanno accanto
// ai loro fratelli.
//
// «Scaffale» era il nome del NESSUN raggruppamento: tutti i tomi in fila,
// ordinati per data d'ingresso, cioe' un ordine che l'occhio non riconosce.
// Sullo schermo del lettore il primo volume di una trilogia stava fra il
// quinto di un'altra e un romanzo solo, e i tre libri della stessa storia
// finivano in tre righe diverse (segnalato: «la parte scaffale fa vedere
// tutto senza un ordine preciso»).
//
// Uno scaffale vero raccoglie: la saga sta insieme e in ordine di lettura,
// i libri di un autore stanno insieme, e i volumi che non hanno fratelli
// chiudono la fila. Qui si costruiscono quei ripiani, e stanno in `lib`
// perche' e' la parte che un test puo' chiamare senza montare niente.
import { chiaveAutore } from "./sagaBooks.js";

// L'ultimo ripiano, quello dei libri che non stanno con nessuno.
export const SOLI = "__soli__";

// UN RIPIANO DA UN LIBRO SOLO NON E' UN RIPIANO — MA UNA SAGA SI'.
//
// Un'intestazione con sotto un unico dorso costa due righe di schermo per
// non dire niente, e una biblioteca fatta di autori con un libro a testa
// diventerebbe un elenco di titoletti. Chi non ha fratelli scende fra i
// volumi soli.
//
// La saga pero' e' un'altra cosa, e la differenza la fa CHI L'HA DETTO:
// l'autore e' un ripiego che deduciamo noi dai metadati, la saga la
// dichiara il lettore a mano nella scheda del libro. Quando scrive
// «Malazan» sta dicendo che quel romanzo appartiene a una storia piu'
// grande, e quell'informazione resta vera anche se di quella storia ha un
// volume solo — anzi, e' proprio li' che serve: «Malazan · 1 volume» dice
// che di quel ciclo hai un pezzo, mentre lo stesso libro buttato fra i
// soli non dice piu' niente. Chiesto dal lettore.
const MINIMO = 2;

// Quanti libri servono a tenere in piedi un ripiano, secondo com'e' nato.
const bastano = (g) => g.tipo === "saga" || g.libri.length >= MINIMO;

const testo = (v) => String(v || "").trim();

// La chiave dice con CHI sta un libro: la saga se ce l'ha — e' il legame
// piu' forte, ed e' quello che il lettore dichiara a mano — altrimenti
// l'autore. Il nome dell'autore si confronta a parole ordinate come in
// tutto il resto dell'app, cosi' «Abercrombie, Joe» e «Joe Abercrombie»
// non fanno due ripiani.
function chiaveDi(b) {
  const saga = testo(b.saga);
  if (saga) return { chiave: `saga:${saga.toLowerCase()}`, tipo: "saga", nome: saga };
  const autore = testo(b.author);
  if (autore) {
    const k = chiaveAutore(autore);
    if (k) return { chiave: `autore:${k}`, tipo: "autore", nome: autore };
  }
  return null;
}

// Dentro un ripiano comanda l'ORDINE DI LETTURA, che e' l'unico ordine che
// una saga possiede davvero; solo dove il numero non c'e' decide
// l'ordinamento scelto in Libreria. I volumi senza numero vanno in coda ai
// numerati: un romanzo che non sa dove sta nella storia non si mette in
// mezzo a quelli che lo sanno.
const perLettura = (confronta) => (a, b) => {
  const x = a.sagaOrder ?? null;
  const y = b.sagaOrder ?? null;
  if (x !== y) {
    if (x === null) return 1;
    if (y === null) return -1;
    return x - y;
  }
  return confronta ? confronta(a, b) : 0;
};

// DENTRO LA SAGA, I CICLI. Chiesto dal lettore («le saghe posso vederle
// raggruppate anche per serie se ci sono?») guardando il Circle of the
// World: dieci volumi in fila, dove la trilogia della Prima Legge, i
// romanzi a se' e l'Eta' della Follia stanno uno dopo l'altro senza una
// riga a dire dove finisce una storia e ne comincia un'altra. Il ciclo e'
// gia' scritto nella scheda (la Serie) e «Prima di cominciare» lo usa da
// un pezzo: qui lo usa anche lo scaffale.
//
// Il ripiano resta UNO per saga — e' la saga il legame forte — e i cicli
// sono sotto-ripiani dentro di lui, nell'ordine in cui la storia li
// incontra: ogni ciclo sta dove sta il suo primo volume, cosi' la Prima
// Legge (1-3) viene prima dei romanzi a se' (4-7) e l'Eta' della Follia
// (8-10) chiude. Nel Mondo Disco, dove i cicli si intrecciano, Rincewind
// apre perche' apre il primo romanzo. I volumi che un ciclo non lo
// dichiarano stanno insieme sotto `nome: null`, e ci stanno per due ragioni
// che si assomigliano: o sono romanzi a se' — ed e' giusto cosi' — o il
// campo e' vuoto, e vederli raccolti a parte e' il modo di accorgersene.
//
// Se nessun volume dichiara un ciclo si torna `null`, non un solo
// sotto-ripiano senza nome: una saga senza cicli non ha niente da
// suddividere, e una riga in piu' li' sarebbe rumore.
export function raccogliCicli(libri = []) {
  if (!libri.some((b) => testo(b.series))) return null;
  const gruppi = new Map();
  for (const b of libri) {
    const nome = testo(b.series) || null;
    const k = nome === null ? null : nome.toLowerCase();
    if (!gruppi.has(k)) gruppi.set(k, { nome, libri: [], primo: null });
    const g = gruppi.get(k);
    g.libri.push(b);
    const n = b.sagaOrder ?? null;
    if (n !== null && (g.primo === null || n < g.primo)) g.primo = n;
  }
  // chi non ha nessun numero chiude, come i volumi senza numero dentro un
  // ripiano; a parita' resta l'ordine d'arrivo, che e' quello di lettura
  return [...gruppi.values()].sort((a, b) => {
    if (a.primo === b.primo) return 0;
    if (a.primo === null) return 1;
    if (b.primo === null) return -1;
    return a.primo - b.primo;
  });
}

export function disponi(libri = [], confronta = null) {
  const gruppi = new Map();
  const soli = [];
  for (const b of libri) {
    const k = chiaveDi(b);
    if (!k) {
      soli.push(b);
      continue;
    }
    if (!gruppi.has(k.chiave)) gruppi.set(k.chiave, { ...k, libri: [] });
    gruppi.get(k.chiave).libri.push(b);
  }

  const ripiani = [];
  for (const g of gruppi.values()) {
    if (!bastano(g)) {
      soli.push(...g.libri);
      continue;
    }
    g.libri.sort(perLettura(confronta));
    ripiani.push({
      id: g.chiave,
      tipo: g.tipo,
      nome: g.nome,
      // Sotto il nome di una saga ci va l'autore, ma SOLO se e' uno: le
      // saghe scritte da venti mani — l'Eresia di Horus — con un nome
      // solo sotto racconterebbero una bugia.
      autore: g.tipo === "saga" ? autoreUnico(g.libri) : null,
      libri: g.libri,
      // i cicli si raccolgono DOPO l'ordinamento: cosi' dentro ogni ciclo
      // i volumi restano in ordine di lettura senza rifare il conto
      cicli: g.tipo === "saga" ? raccogliCicli(g.libri) : null,
    });
  }
  ripiani.sort((a, b) => a.nome.localeCompare(b.nome, "it"));

  if (soli.length) {
    soli.sort(confronta || (() => 0));
    ripiani.push({ id: SOLI, tipo: "soli", nome: "Volumi soli", autore: null, libri: soli });
  }
  return ripiani;
}

function autoreUnico(libri) {
  let nome = null;
  let chiave = null;
  for (const b of libri) {
    const k = chiaveAutore(b.author);
    if (!k) return null;
    if (chiave === null) {
      chiave = k;
      nome = testo(b.author);
    } else if (k !== chiave) return null;
  }
  return nome;
}
