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

// E DOVE IL CAMPO «SERIE» E' VUOTO, LO DICONO I NUMERI.
//
// La regola del ciclo funziona solo se il ciclo e' SCRITTO, e quel campo lo
// riempiono la tavola del Mondo Disco, quella dell'Eresia e il lettore a
// mano: su un autore che nessuna tavola conosce — Sanderson, per dirne uno
// che ha due storie grosse dentro la stessa saga — e' quasi sempre vuoto, e
// la cura del ciclo non scatta. Misurato sulla scena della segnalazione, coi
// tre Mistborn letti e la Folgoluce mai aperta: col campo Serie pieno non si
// propone niente (giusto), col campo vuoto torna «Rhythm of War — Cosmoverse
// n° 4», cioe' il difetto identico a quello segnalato.
//
// Il secondo segnale pero' c'e' gia' nei dati: se in una saga DUE TITOLI
// DIVERSI portano lo stesso numero di lettura, quella non e' una sequenza
// sola — sono due storie numerate ognuna da uno. Non serve sapere quali
// siano: basta sapere che il numero non e' una fila, e allora «il prossimo»
// non si puo' calcolare.
//
// DUE COPIE DELLO STESSO TITOLO NON SONO DUE STORIE: due edizioni, o un
// doppione dichiarato, condividono il numero perche' sono lo stesso volume —
// e quel caso ha gia' la sua regola («a pari ordine vince chi e' arrivato
// prima»). Si confrontano percio' i TITOLI, non gli id.
//
// Si tace, non si indovina: e' la stessa regola del volume senza numero.
// Meglio nessuna proposta di una sbagliata, perche' in una saga il volume
// sbagliato e' uno spoiler servito dall'app.
export function numeriMescolati(libri = [], saga = "") {
  const nome = String(saga || "").trim();
  if (!nome) return false;
  const visti = new Map();
  for (const b of libri) {
    if (!b || (b.saga || "").trim() !== nome) continue;
    if (b.sagaOrder == null) continue;
    const titolo = String(b.title || "").trim().toLowerCase();
    const gia = visti.get(b.sagaOrder);
    if (gia === undefined) visti.set(b.sagaOrder, titolo);
    else if (gia !== titolo) return true;
  }
  return false;
}

export const cicloDi = (b) => (b?.series || "").trim();

// I volumi fra cui cercare «il prossimo» di un libro: la saga intera se i
// suoi numeri sono una fila sola, il suo ciclo se si interlacciano, niente
// se si interlacciano anche dentro il ciclo (vedi `nextInSaga`). Serve anche
// a `prossimiPassi`, che con la stessa domanda decide quanti fili tiene una
// saga — uno solo, o uno per ciclo.
export function gruppoDi(book, books = []) {
  const saga = (book?.saga || "").trim();
  if (!saga) return null;
  const dellaSaga = books.filter((b) => b && (b.saga || "").trim() === saga);
  if (!numeriMescolati(dellaSaga, saga)) return dellaSaga;
  const ciclo = cicloDi(book).toLowerCase();
  const delCiclo = dellaSaga.filter((b) => cicloDi(b).toLowerCase() === ciclo);
  return numeriMescolati(delCiclo, saga) ? null : delCiclo;
}

// Il prossimo passo dentro la stessa saga: la voce di libreria non ancora
// aperta con l'ordine di lettura piu' basso dopo quella corrente. Un omnibus
// che racchiude una trilogia e' una voce come le altre — conta il numero
// d'ordine assegnato, non cosa contiene. Si guarda solo in avanti: un
// volume precedente lasciato indietro non e' "il prossimo".
//
// E LE DUE REGOLE DELLE SAGHE GRANDI STANNO QUI DENTRO, NON NEI CHIAMANTI.
// Il primo giro le aveva messe in `prossimiPassi`, e curavano la sola fila
// nuova dell'Ingresso: il riquadro in cima («Il prossimo della saga») e la
// proposta a libro chiuso in `App.jsx` chiamano `nextInSaga` DIRETTA e
// restavano indietro. Misurato al banco sulla scena del lettore, col campo
// Serie vuoto: il riquadro in cima diceva «Rhythm of War · il passo n° 4 di
// Cosmoverse», che sono le sue parole esatte — cioe' la cura di ieri aveva
// preso la fila e mancato proprio il posto da cui il difetto si vedeva.
// Una regola che vale per «il prossimo volume» vale ovunque lo si proponga:
// sta nella funzione che risponde a quella domanda, e chi ne aggiunge un
// quarto chiamante la eredita senza doverlo sapere.
//
// E IL PROSSIMO E' QUELLO SUBITO DOPO, NON IL PRIMO LIBERO PIU' IN LA'
// (chiesto dal lettore con l'Ingresso in mano: «ha senso suggerire solo i
// libri successivi alle saghe gia' iniziate e libri gia' letti, e non
// numeri o volumi a caso come succede ora»). Prima si SCAVALCAVA tutto quel
// che non era intatto: finito il primo e aperto il secondo, si proponeva il
// terzo — cioe' un volume che viene dopo un libro che non hai ancora letto.
// Nella sua fotografia: «Warrior Prophet» proposto con «The Darkness That
// Comes Before» al 2%. Adesso si guarda il volume che SEGUE, e se quello lo
// stai gia' leggendo — o l'hai aperto e lasciato li' — non c'e' un «prossimo»
// da dire: il passo dopo ce l'hai gia' in mano, e sta nella fila di quelli
// in lettura. I LETTI si scavalcano ancora (chi rilegge il primo di una saga
// letta fino al terzo vuole il quarto), e l'abbandonato pure, come sempre.
//
// E IL CICLO ENTRA IN GIOCO SOLO DOVE I NUMERI SI INTERLACCIANO (chiesto
// dal lettore, con quattro Pratchett in fila: «per la saga di Discworld
// consigliami solo il volume successivo all'ultimo gia' letto nell'ordine
// segnato, cosi' come stai facendo per gli altri»). Nel Mondo Disco i numeri
// sono UNA fila sola, da 1 a 41, e gli otto cicli sono un raggruppamento
// dentro quella fila: letti i primi dieci, il prossimo e' l'undicesimo e
// basta — mentre la regola del ciclo ne proponeva quattro, uno per ciclo
// cominciato, «Small Gods n° 13» e «Men at Arms n° 15» compresi, cioe'
// volumi che saltano tre e cinque posti di una fila che il lettore ha scelto
// di seguire. Il ciclo serve dove i numeri NON sono una fila: nel Cosmoverse
// Mistborn e la Folgoluce sono numerate tutt'e due da uno, e li' «dopo il
// 2» non vuol dire niente finche' non si dice di quale storia. Quindi:
// numeri unici in tutta la saga → si guarda la saga intera, ciclo o no;
// numeri doppi → si guarda il ciclo del volume, e se anche li' sono doppi
// si tace. E' `numeriMescolati` a decidere, sulla saga prima e sul ciclo
// poi — non il fatto che un ciclo sia scritto.
export function nextInSaga(book, books, statusOf = getStatus, progressoOf = getProgress) {
  const saga = (book?.saga || "").trim();
  if (!saga) return null;
  const dove = gruppoDi(book, books);
  if (!dove) return null;
  const ord = (b) => (b.sagaOrder ?? Infinity);
  const cur = book.sagaOrder ?? null;
  // `dove` e' gia' della sola saga del libro: lo garantisce `gruppoDi`
  const dopo = dove
    .filter(
      (b) =>
        b.id !== book.id &&
        // senza numero d'ordine non si indovina: meglio nessuna proposta
        // di una sbagliata
        b.sagaOrder != null &&
        (cur == null || ord(b) > cur)
    )
    .sort((a, b) => ord(a) - ord(b) || (a.addedAt || 0) - (b.addedAt || 0));
  for (const b of dopo) {
    const stato = statusOf(b.id);
    if (stato === "read" || stato === "abandoned") continue;
    return maiAperto(b, statusOf, progressoOf) ? b : null;
  }
  return null;
}

// I PROSSIMI PASSI DI TUTTE LE SAGHE CHE HAI COMINCIATO.
//
// `nextInSaga` risponde su UN libro, e l'Ingresso la usava in un caso solo:
// avevi appena chiuso un volume e l'app ti proponeva il successivo. Ma
// «cosa leggo adesso» uno se lo chiede anche a meta' di un romanzo, e con
// dieci saghe in corso la risposta non e' una sola (chiesto dal lettore
// guardando l'Ingresso).
//
// SOLO LE SAGHE GIA' COMINCIATE, E «COMINCIATA» VUOL DIRE UN VOLUME FINITO.
// Proporre il primo volume di una saga mai aperta non e' «il prossimo
// passo», e' un consiglio di lettura — e quello lo fa la Libreria, dove i
// libri stanno tutti. Al primo giro bastava aver APERTO un volume (stato o
// progresso), e il lettore si e' trovato in fila «The Eye of the World»
// perche' New Spring era stato aperto per un attimo, allo 0,4%: «volumi a
// caso», parole sue. Un'apertura non e' un filo in mano; un libro finito
// si'. Quindi la storia comincia col primo volume LETTO; il riferimento e'
// il piu' avanti fra quelli DICHIARATI, letti o in lettura, e se e' in
// lettura non c'e' un passo dopo — lo hai in mano (letto il primo e in
// lettura il terzo, il secondo saltato non e' «il prossimo» e il terzo ce
// l'hai gia'). L'abbandonato non apre niente, come sempre: quella storia
// l'hai lasciata apposta.
//
// E IL PASSO SUCCESSIVO STA DENTRO IL CICLO SOLO DOVE I NUMERI SI
// INTERLACCIANO (segnalato dal lettore: «sanderson mi sta suggerendo il
// numero 4 del cosmoverso a caso», e poi, su Pratchett, «consigliami solo
// il volume successivo all'ultimo gia' letto nell'ordine segnato»). Nel
// Cosmoverse Mistborn e la Folgoluce sono numerate tutt'e due da uno, e sul
// solo numero il «piu' avanti» salta da una storia all'altra: li' i fili
// sono due, uno per ciclo cominciato, e il nome mostrato e' quello del ciclo
// — «Mistborn n° 4» dice qualcosa, «Cosmoverse n° 4» non si poteva
// verificare a occhio. Nel Mondo Disco invece i numeri sono una fila sola e
// gli otto cicli stanno DENTRO quella fila: il filo e' uno, il prossimo e'
// quello dopo l'ultimo letto, e il nome e' la saga — «Discworld n° 11» e'
// esattamente il numero che il lettore vede sul dorso. A decidere e' la
// stessa domanda di `nextInSaga` (`gruppoDi`): un ciclo scritto non basta a
// spartire una saga, ci vogliono i numeri doppi.
//
// IL RIFERIMENTO E' IL VOLUME PIU' AVANTI CHE HAI DICHIARATO, non l'ultimo che
// hai aperto: chi rilegge il secondo di una saga letta fino al settimo non
// vuole sentirsi proporre il terzo. Da li' in poi comanda `nextInSaga` con
// le sue guardie — senza numero d'ordine non si indovina, il volume che
// segue dev'essere intatto, e in una saga il volume sbagliato e' uno
// spoiler servito dall'app.
//
// L'ORDINE E' L'ULTIMO TOCCO SULLA SAGA, mai il titolo: la saga che stai
// leggendo stasera sta per prima e quella lasciata a meta' l'anno scorso
// chiude la fila. A parita' decide l'alfabeto, o due saghe ferme allo
// stesso istante cambierebbero posto a ogni apertura.

export function prossimiPassi(
  books = [],
  { statusOf = getStatus, progressoOf = getProgress, tocco = () => 0, escludi = null } = {}
) {
  // le saghe coi numeri interlacciati si spartiscono per ciclo, le altre no
  const spartita = new Set();
  for (const b of books) {
    const saga = (b?.saga || "").trim();
    if (saga && !spartita.has(saga) && numeriMescolati(books, saga)) spartita.add(saga);
  }
  const storie = new Map();
  for (const b of books) {
    const saga = (b?.saga || "").trim();
    if (!saga) continue;
    // contano i volumi DICHIARATI, letti o in lettura: un'apertura di
    // passaggio non e' niente, e l'abbandonato e' una storia lasciata
    const stato = statusOf(b.id);
    if (stato !== "read" && stato !== "reading") continue;
    // un filo per saga, o uno per ciclo dove i numeri si interlacciano (e le
    // maiuscole non ne fanno un terzo); il volume che non sta in nessun
    // gruppo — numeri doppi anche nel suo ciclo — lo zittisce `nextInSaga`
    const ciclo = spartita.has(saga) ? cicloDi(b) : "";
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
    // il filo si apre con un volume FINITO, e se il piu' avanti lo stai
    // ancora leggendo il passo dopo ce l'hai in mano: niente da proporre.
    // Le due cose sono UNA domanda: col piu' avanti letto, un volume letto
    // c'e' per forza (un `letto` a parte era una guardia che non guardava)
    if (statusOf(e.avanti.id) !== "read") continue;
    // il ciclo qui serve a RAGGRUPPARE le storie e a dare il nome alla riga;
    // a cercare il candidato dentro il ciclo giusto — e a tacere dove i
    // numeri non sono una fila — ci pensa `nextInSaga`, che il ciclo lo
    // legge dal volume che le si passa
    const libro = nextInSaga(e.avanti, books, statusOf, progressoOf);
    // il libro gia' in cima all'Ingresso non si ripete due righe piu' sotto
    if (!libro || libro.id === escludi) continue;
    passi.push({ saga: e.saga, ciclo: e.ciclo, nome: e.ciclo || e.saga, libro, da: e.avanti, quando: e.quando });
  }
  return passi.sort((a, b) => b.quando - a.quando || a.nome.localeCompare(b.nome, "it"));
}
