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
// E IL CICLO SI CONFRONTA SEMPRE, ANCHE QUANDO E' VUOTO: un volume senza
// ciclo in una saga dove gli altri il ciclo ce l'hanno cercava il seguito in
// TUTTA la saga, e finiva sul volume di un'altra storia — nella fotografia
// «Fall of Light» compariva due volte, una dal ciclo dei Kharkanas e una da
// un volume del Malazan rimasto senza ciclo. I senza-ciclo sono un gruppo
// come gli altri («Volumi a se'» sullo scaffale, `raccogliCicli`), e su una
// saga senza cicli il gruppo e' la saga intera: li' non cambia niente.
export function nextInSaga(book, books, statusOf = getStatus, progressoOf = getProgress) {
  const saga = (book?.saga || "").trim();
  if (!saga) return null;
  const ciclo = cicloDi(book).toLowerCase();
  const dove = books.filter((b) => b && cicloDi(b).toLowerCase() === ciclo);
  // e dove i numeri non sono una fila sola non c'e' un «prossimo» da dire
  if (numeriMescolati(dove, saga)) return null;
  const ord = (b) => (b.sagaOrder ?? Infinity);
  const cur = book.sagaOrder ?? null;
  const dopo = dove
    .filter(
      (b) =>
        b.id !== book.id &&
        (b.saga || "").trim() === saga &&
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
// dichiara resta il gruppo dei senza-ciclo, che su una saga senza cicli e'
// la saga intera — li' i due raggruppamenti coincidono (vedi `nextInSaga`).
//
// Quindi una saga puo' proporre PIU' passi, uno per ciclo cominciato, ed
// e' giusto: chi legge Mistborn e la Folgoluce insieme ha due fili in mano
// e due prossimi volumi. E il nome mostrato e' quello del CICLO quando c'e'
// — «Mistborn n° 4» dice qualcosa, «Cosmoverse n° 4» era proprio la riga
// che non si poteva verificare a occhio.
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
  const storie = new Map();
  for (const b of books) {
    const saga = (b?.saga || "").trim();
    if (!saga) continue;
    // contano i volumi DICHIARATI, letti o in lettura: un'apertura di
    // passaggio non e' niente, e l'abbandonato e' una storia lasciata
    const stato = statusOf(b.id);
    if (stato !== "read" && stato !== "reading") continue;
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
