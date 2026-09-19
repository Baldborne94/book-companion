import { getStatus, getProgress } from "./library.js";

// UN VOLUME CHE HAI GIA' APERTO NON E' «IL PROSSIMO».
//
// Il filtro era «non letto», e guardava il solo STATO: un romanzo al 27%
// che il lettore non aveva mai dichiarato «in lettura» risultava intatto e
// si proponeva come passo successivo — segnalato con l'Ingresso in mano,
// dove «Moving Pictures» compariva insieme fra quelli che stava leggendo E
// fra i prossimi passi, a due righe di distanza.
//
// La domanda giusta non e' «l'hai finito?» ma «l'hai MAI aperto?», e le
// risposte sono due e vanno guardate tutt'e due: lo stato, che dichiari
// tu, e il progresso, che lo dice il libro. L'abbandonato resta fuori per
// la ragione opposta e altrettanto buona: quella storia l'hai lasciata
// apposta, e riproportela e' il difetto per cui quello stato esiste.
const maiAperto = (b, statusOf, progressoOf) =>
  statusOf(b.id) === "unread" && !(progressoOf(b.id) > 0);

// Il prossimo passo dentro la stessa saga: la voce di libreria non ancora
// aperta con l'ordine di lettura piu' basso dopo quella corrente. Un omnibus
// che racchiude una trilogia e' una voce come le altre — conta il numero
// d'ordine assegnato, non cosa contiene. Si guarda solo in avanti: un
// volume precedente lasciato indietro non e' "il prossimo".
export function nextInSaga(book, books, statusOf = getStatus, progressoOf = getProgress) {
  const saga = (book?.saga || "").trim();
  if (!saga) return null;
  const ord = (b) => (b.sagaOrder ?? Infinity);
  const cur = book.sagaOrder ?? null;
  return (
    books
      .filter(
        (b) =>
          b.id !== book.id &&
          (b.saga || "").trim() === saga &&
          maiAperto(b, statusOf, progressoOf) &&
          // senza numero d'ordine non si indovina: meglio nessuna proposta
          // di una sbagliata
          b.sagaOrder != null &&
          (cur == null || ord(b) > cur)
      )
      .sort((a, b) => ord(a) - ord(b) || (a.addedAt || 0) - (b.addedAt || 0))[0] || null
  );
}

// I PROSSIMI PASSI DI TUTTE LE SAGHE CHE HAI COMINCIATO.
//
// `nextInSaga` risponde su UN libro, e l'Ingresso la usava in un caso solo:
// avevi appena chiuso un volume e l'app ti proponeva il successivo. Ma
// «cosa leggo adesso» uno se lo chiede anche a meta' di un romanzo, e con
// dieci saghe in corso la risposta non e' una sola (chiesto dal lettore
// guardando l'Ingresso).
//
// SOLO LE SAGHE GIA' COMINCIATE. Proporre il primo volume di una saga mai
// aperta non e' «il prossimo passo», e' un consiglio di lettura — e quello
// lo fa la Libreria, dove i libri stanno tutti. Qui si riprende un filo che
// hai gia' in mano, e «cominciata» vuol dire che di quella storia un volume
// l'hai letto, lo stai leggendo o l'hai comunque APERTO — il progresso vale
// quanto lo stato, o un romanzo al 27% mai dichiarato «in lettura» farebbe
// da riferimento a nessuno e verrebbe per giunta proposto come prossimo.
// L'abbandonato no: quella storia l'hai lasciata apposta.
//
// E IL PASSO SUCCESSIVO STA DENTRO IL CICLO, NON NELLA SAGA (segnalato dal
// lettore: «sanderson mi sta suggerendo il numero 4 del cosmoverso a
// caso»). Una saga grande tiene piu' storie — nel Cosmoverse ci sono
// Mistborn e le Cronache della Folgoluce, nel Mondo Disco otto cicli — e
// dentro una saga cosi' i numeri di lettura si INTERLACCIANO: due storie
// numerate tutt'e due da uno, e il «piu' avanti» salta dall'una all'altra
// scegliendo un volume che col filo che hai in mano non c'entra niente.
// E' la stessa trappola gia' scritta per i ripiani della Libreria, un
// piano piu' in la', e la regola e' quella di `soloDellaSerie`: se il
// volume dichiara un ciclo, il prossimo e' del SUO ciclo; se non lo
// dichiara resta la saga intera, che e' il caso di una saga senza cicli —
// li' i due raggruppamenti coincidono.
//
// Quindi una saga puo' proporre PIU' passi, uno per ciclo cominciato, ed
// e' giusto: chi legge Mistborn e la Folgoluce insieme ha due fili in mano
// e due prossimi volumi. E il nome mostrato e' quello del CICLO quando c'e'
// — «Mistborn n° 4» dice qualcosa, «Cosmoverse n° 4» era proprio la riga
// che non si poteva verificare a occhio.
//
// IL RIFERIMENTO E' IL VOLUME PIU' AVANTI CHE HAI TOCCATO, non l'ultimo che
// hai aperto: chi rilegge il secondo di una saga letta fino al settimo non
// vuole sentirsi proporre il terzo. Da li' in poi comanda `nextInSaga` con
// le sue guardie — senza numero d'ordine non si indovina, e in una saga il
// volume sbagliato e' uno spoiler servito dall'app.
//
// L'ORDINE E' L'ULTIMO TOCCO SULLA SAGA, mai il titolo: la saga che stai
// leggendo stasera sta per prima e quella lasciata a meta' l'anno scorso
// chiude la fila. A parita' decide l'alfabeto, o due saghe ferme allo
// stesso istante cambierebbero posto a ogni apertura.
export const cicloDi = (b) => (b?.series || "").trim();

export function prossimiPassi(
  books = [],
  { statusOf = getStatus, progressoOf = getProgress, tocco = () => 0, escludi = null } = {}
) {
  const storie = new Map();
  for (const b of books) {
    const saga = (b?.saga || "").trim();
    if (!saga) continue;
    const stato = statusOf(b.id);
    const cominciato = stato === "read" || stato === "reading" || progressoOf(b.id) > 0;
    // l'abbandonato non apre nessun filo: vedi `maiAperto`
    if (!cominciato || stato === "abandoned") continue;
    const ciclo = cicloDi(b);
    // due cicli della stessa saga sono due fili distinti, e le maiuscole non
    // ne fanno un terzo
    const chiave = `${saga}\u0000${ciclo.toLowerCase()}`;
    const e = storie.get(chiave) || { saga, ciclo, avanti: null, quando: 0 };
    // il piu' avanti: `-Infinity` tiene i senza-numero sotto a chiunque
    // ne abbia uno, cosi' un volume non numerato non fa da riferimento
    // finche' c'e' di meglio
    if (!e.avanti || (b.sagaOrder ?? -Infinity) > (e.avanti.sagaOrder ?? -Infinity)) e.avanti = b;
    e.quando = Math.max(e.quando, tocco(b.id) || 0);
    storie.set(chiave, e);
  }

  const passi = [];
  for (const e of storie.values()) {
    // il candidato si cerca dentro il ciclo del riferimento; senza ciclo
    // resta la saga intera, come in `soloDellaSerie`
    const dove = e.ciclo
      ? books.filter((b) => cicloDi(b).toLowerCase() === e.ciclo.toLowerCase())
      : books;
    const libro = nextInSaga(e.avanti, dove, statusOf, progressoOf);
    // il libro gia' in cima all'Ingresso non si ripete due righe piu' sotto
    if (!libro || libro.id === escludi) continue;
    passi.push({ saga: e.saga, ciclo: e.ciclo, nome: e.ciclo || e.saga, libro, da: e.avanti, quando: e.quando });
  }
  return passi.sort((a, b) => b.quando - a.quando || a.nome.localeCompare(b.nome, "it"));
}
