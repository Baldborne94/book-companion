import { getStatus, getProgress } from "./library.js";
import { PARTI_DI_GUIDA, contornoDiUnaGuida } from "./sagaBooks.js";

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

// I volumi fra cui cercare «il prossimo» di un libro: quelli della sua
// SERIE, dentro la sua saga. Niente se li' dentro i numeri si interlacciano.
//
// QUESTA REGOLA E' STATA GIRATA DUE VOLTE, e la ragione va scritta per
// intero o il prossimo la gira una terza. Per un giro il gruppo e' stato la
// SAGA INTERA dove i numeri erano una fila sola — i quarantun Pratchett
// numerati da 1 a 41 — e la serie entrava in gioco solo dove i numeri si
// ripetevano, come nel Cosmoverse. L'aveva chiesto il lettore con quattro
// Pratchett in fila, e l'ha disdetto lui stesso guardando il Malazan: «per
// malazan pero' o altre saghe considera non tutto il ciclo ma la singola
// serie per sapere cosa devo leggere dopo; ho sbagliato prima a bloccarti,
// era giusto suggerirmi i volumi successivi alle serie che avevo gia'
// iniziato».
//
// Ha ragione, e il perche' sta nei dati: IL NUMERO E LA SERIE RISPONDONO A
// DUE DOMANDE DIVERSE. Il numero dice in che ordine leggere, la serie dice
// DI QUALE STORIA stiamo parlando — e in un universo come il Malazan i
// numeri sono una fila sola solo perche' se li e' scritti lui in un ordine
// di lettura unico, mentre le storie restano quattro. Chi ha in mano il
// Path to Ascendancy non aspetta «il numero dopo», aspetta il prossimo di
// QUELLA storia; il numero dopo puo' essere un Kharkanas che col filo in
// mano non c'entra niente. Raggruppare e' mestiere della serie, sempre.
//
// I senza-serie sono un gruppo come gli altri — «Volumi a se'» sullo
// scaffale — e su una saga che la serie non ce l'ha su nessuno il gruppo e'
// la saga intera: li' i due raggruppamenti coincidono e non cambia niente.
// MA UNA PARTE NON E' UN CICLO, E NON LO SI PUO' INDOVINARE.
//
// La regola qui sopra da' per scontato che una serie scritta sia sempre una
// STORIA A SE'. Nel Malazan e nel Cosmoverse e' vero; su una GUIDA DI
// LETTURA non lo e' affatto — l'Eresia di Horus e' divisa in tredici
// «parti», ma sono i capitoli di una storia sola, letti in fila. Trattarle
// da cicli vorrebbe dire che «Prima di cominciare», aperto il volume 25,
// riassume i due volumi della sua parte e tace sui ventidue che vengono
// prima: cioe' proprio il racconto per cui quel tasto esiste.
//
// LA STRADA DEI NUMERI E' STATA PROVATA E SCARTATA, e va scritta o la
// riprova il prossimo. L'idea era: due storie parallele si INTERLACCIANO
// nell'ordine di lettura (Mistborn 1, Folgoluce 1, Mistborn 2) mentre le
// parti di una storia sola sono blocchi CONTIGUI. Misurata sulle tavole,
// sembrava perfetta — nel Mondo Disco tutti e otto i cicli con piu' volumi
// sono sparsi, nell'Eresia tutte e dodici le parti sono contigue. Ma il
// Malazan del lettore la smentisce: i suoi numeri se li e' scritti lui in
// un ordine di lettura unico, quindi Book of the Fallen 1-3 e Path to
// Ascendancy 7-8 sono blocchi contigui esattamente come le parti — e la
// regola avrebbe rifatto proprio il difetto che lui aveva fatto togliere.
// Dalla forma dei numeri le due cose non si distinguono.
//
// La differenza vera e' un'altra e la sappiamo per davvero: LE PARTI LE
// DICHIARA UNA GUIDA CHE SPEDIAMO NOI, i cicli li scrive il lettore. Quindi
// non si indovina: si guarda se quel nome e' una parte di una delle nostre
// guide. Una tavola nuova lo dichiara con `parti: true` e i suoi capitoli
// entrano qui dentro; tutto il resto resta un ciclo, che e' il lato giusto
// in cui sbagliare — al massimo si racconta piu' storia del necessario,
// mai di meno.
export function parteDiUnaStoria(book) {
  const serie = cicloDi(book).toLowerCase();
  return !!serie && PARTI_DI_GUIDA.has(serie);
}

export function gruppoDi(book, books = []) {
  const saga = (book?.saga || "").trim();
  if (!saga) return null;
  const dellaSaga = books.filter((b) => b && (b.saga || "").trim() === saga);
  // dove la serie e' la PARTE di una guida il filo e' la saga intera: «il
  // prossimo» di un cammino in tredici capitoli e' il capitolo dopo, non
  // il prossimo volume del capitolo in cui stai
  const dove = parteDiUnaStoria(book)
    ? dellaSaga
    : dellaSaga.filter((b) => cicloDi(b).toLowerCase() === cicloDi(book).toLowerCase());
  // IL VETO NON STA PIU' QUI: raggruppare e' una cosa, decidere se il numero
  // si puo' leggere e' un'altra. La domanda «e' una fila sola?» si fa in
  // `passoDentro`, dove si sa anche quale volume si starebbe per proporre.
  return dove;
}

// UN DOPPIONE LONTANO NON E' «DUE STORIE».
//
// Segnalato con l'Ingresso in mano: «controlla le saghe perche' dopo
// Mechanicum ci sono altri libri, usa la stessa logica che hai usato per le
// altre saghe». Misurato al banco sull'Eresia intera — settantun volumi coi
// numeri del cammino, letti fino al quindici: **propone il sedici**. Ma
// basta UN secondo titolo sul numero 24 — un racconto comprato da solo col
// numero della collana addosso, un numero scritto a mano male — e tutta la
// saga ammutolisce, per sempre, da un doppione che sta ventiquattro volumi
// piu' in la' di dove stai leggendo.
//
// Era il veto di `numeriMescolati`, e la sua ragione resta buona: nel
// Cosmoverse Mistborn e la Folgoluce sono numerate tutt'e due da uno, e li'
// «il prossimo» non si puo' proprio calcolare. Ma quella e' una saga in cui
// il lettore NON ha dichiarato le storie: col campo Serie vuoto due fili si
// distinguono solo dai numeri, e i numeri mentono.
//
// QUANDO LA SERIE E' SCRITTA, E UGUALE SU TUTTO IL GRUPPO, il lettore ha
// gia' detto che quella e' UNA storia: li' due titoli sullo stesso numero
// non sono due sequenze, sono un campo sbagliato su un volume. E un campo
// sbagliato lontano non deve zittire una fila che si legge benissimo.
const unaStoriaSola = (dove) => {
  const primo = cicloDi(dove[0] || {}).toLowerCase();
  return !!primo && dove.every((b) => cicloDi(b).toLowerCase() === primo);
};

// LA COPPIA CHE LITIGA, per nome. «Due volumi portano lo stesso numero»
// senza dire QUALI lascia il lettore a cercarli fra settanta schede: e' la
// regola di `spiegaSync` — il guasto dice cos'e' successo E cosa farci, e
// qui il cosa farci sono due titoli e un numero.
const coppiaDoppia = (dove, contorno) => {
  const visti = new Map();
  for (const b of dove) {
    if (b.sagaOrder == null || contorno(b)) continue;
    const titolo = String(b.title || "").trim().toLowerCase();
    const gia = visti.get(b.sagaOrder);
    if (!gia) visti.set(b.sagaOrder, b);
    else if (String(gia.title || "").trim().toLowerCase() !== titolo) return { uno: gia, due: b };
  }
  return {};
};

// Chi altro, nel gruppo, porta il numero di questo volume. Sono i RIVALI
// del passo: se ce n'e' uno, qual e' «il prossimo» non lo sa nessuno — e
// allora si tace, ma dicendo QUALI, che e' l'unica cosa che il lettore puo'
// mettere a posto.
const rivaliDi = (libro, dove, contorno) => {
  const titolo = String(libro?.title || "").trim().toLowerCase();
  return dove.filter(
    (b) =>
      b.id !== libro.id &&
      b.sagaOrder === libro.sagaOrder &&
      String(b.title || "").trim().toLowerCase() !== titolo &&
      // un contorno non e' una tappa, quindi non e' un rivale del passo
      !contorno(b)
  );
};

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
// E IL PROSSIMO STA DENTRO LA SERIE: lo decide `gruppoDi`, dove sta scritto
// perche' quella regola e' stata girata due volte. Qui basta sapere che il
// gruppo arriva di li' e che `null` vuol dire «non si puo' dire»: dentro
// quella serie due titoli diversi portano lo stesso numero, e indovinare
// vorrebbe dire servire uno spoiler.
export function nextInSaga(
  book,
  books,
  statusOf = getStatus,
  progressoOf = getProgress,
  contorno = contornoDiUnaGuida
) {
  return passoDentro(book, books, statusOf, progressoOf, contorno).libro;
}

// LO STESSO CAMMINO, MA DICE ANCHE PERCHE' SI E' FERMATO.
//
// Segnalato con l'Ingresso in mano, il giorno dopo aver tolto la proposta
// sbagliata del 40K: «adesso non mi proponi piu' nulla?». Sette righe
// c'erano, e la sua non c'era — e una riga che sparisce in silenzio
// trasforma una regola in un mistero. E' la lezione di `perchePrimaTace`,
// dove un tasto che non compare spiega quale anello si e' rotto.
//
// LA RAGIONE ESCE DALLA STESSA CAMMINATA che sceglie il volume, non da una
// seconda funzione che la ricostruisce: due copie della stessa regola
// divergono senza che nessun errore lo dica, e qui la copia sbagliata
// direbbe al lettore una cosa che non e' successa. `nextInSaga` e'
// diventata una riga sopra questa.
export function passoDentro(
  book,
  books,
  statusOf = getStatus,
  progressoOf = getProgress,
  contorno = contornoDiUnaGuida
) {
  const saga = (book?.saga || "").trim();
  if (!saga) return { libro: null, motivo: "senzaSaga" };
  const dove = gruppoDi(book, books);
  if (!dove) return { libro: null, motivo: "senzaSaga" };
  // DOVE LA STORIA NON E' DICHIARATA, un numero ripetuto vuol dire due fili
  // numerati ognuno da uno, e «il prossimo» non si puo' calcolare: si tace
  // su tutto il gruppo, come si e' sempre fatto. Dove invece la Serie e'
  // scritta e uguale su tutti, il filo e' uno solo per dichiarazione del
  // lettore, e basta guardare il passo che si starebbe per proporre.
  //
  // E LA DOMANDA E' UNA SOLA, `coppiaDoppia`, non `numeriMescolati`: quella
  // conta anche i contorni, e un'antologia che porta per sbaglio il numero
  // di un romanzo non fa due sequenze — non e' una tappa. `numeriMescolati`
  // resta dov'e' serve, a decidere come si CHIAMA la riga.
  const coppia = unaStoriaSola(dove) ? {} : coppiaDoppia(dove, contorno);
  if (coppia.uno) return { libro: null, motivo: "mescolati", ...coppia };
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
  let sfondo = 0;
  let letti = 0;
  let mollati = 0;
  for (const b of dopo) {
    // QUEL CHE LA GUIDA NON CONTA COME TAPPA SI SCAVALCA, non ferma la
    // ricerca: non sta in questo filo affatto, quindi non e' il passo dopo
    // e nemmeno il volume che te lo trattiene in mano. Chiuso «Fallen
    // Angels» (9) con «Night Lords Omnibus» (9,04) sullo scaffale, il passo
    // resta il numero 10.
    if (contorno(b)) {
      sfondo += 1;
      continue;
    }
    const stato = statusOf(b.id);
    // letto e abbandonato si scavalcano tutt'e due, ma NON vogliono dire la
    // stessa cosa a chi legge la riga: «li hai letti» e «li hai lasciati»
    // sono due storie diverse, e contarli insieme farebbe dire all'app una
    // cosa che non e' successa
    if (stato === "read") {
      letti += 1;
      continue;
    }
    if (stato === "abandoned") {
      mollati += 1;
      continue;
    }
    // e sul passo che si sta per proporre il numero dev'essere di UNO solo:
    // se un altro titolo lo porta, proporre l'uno o l'altro e' tirare a
    // sorte — e in una saga il volume sbagliato e' uno spoiler servito
    // dall'app
    const rivali = rivaliDi(b, dove, contorno);
    if (rivali.length) return { libro: null, motivo: "mescolati", uno: b, due: rivali[0] };
    if (maiAperto(b, statusOf, progressoOf)) return { libro: b, motivo: null };
    // il seguito c'e' e l'hai gia' aperto: il passo ce l'hai in mano, e
    // dirlo per nome e' meglio che tacere
    return { libro: null, motivo: "aperto", volume: b };
  }
  // i tre silenzi non sono la stessa cosa, e chiedono al lettore tre cose
  // diverse: comprare il volume dopo, non cercarlo perche' l'hai letto,
  // sapere che quel che resta la guida non te lo chiede
  if (letti) return { libro: null, motivo: "tuttiLetti" };
  if (mollati) return { libro: null, motivo: "abbandonati" };
  if (sfondo) return { libro: null, motivo: "soloSfondo" };
  return { libro: null, motivo: "ultimo" };
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
// UN FILO PER SERIE COMINCIATA, ED E' LA SERIE A SPARTIRE (chiesto dal
// lettore guardando il Malazan: «considera non tutto il ciclo ma la singola
// serie per sapere cosa devo leggere dopo... era giusto suggerirmi i volumi
// successivi alle serie che avevo gia' iniziato»). Chi tiene in mano due
// storie dello stesso universo ha due prossimi volumi, e sono due righe:
// il perche' sta per esteso in `gruppoDi`.
//
// MA IL NOME DELLA RIGA NON SEGUE IL GRUPPO: SEGUE IL NUMERO. Il numero
// mostrato accanto e' quello che il lettore ha scritto sul volume, e va
// letto sotto l'etichetta giusta. Dove ogni serie si numera da se' — nel
// Cosmoverse Mistborn e la Folgoluce partono tutt'e due da uno — l'etichetta
// e' la serie: «Mistborn n° 4» dice qualcosa, «Cosmoverse n° 4» non si
// poteva verificare a occhio, ed e' il difetto segnalato allora («sanderson
// mi sta suggerendo il numero 4 del cosmoverso a caso»). Dove invece il
// numero e' della SAGA, come nel Mondo Disco che corre da 1 a 41, l'etichetta
// e' la saga: «Rincewind n° 13» direbbe «il tredicesimo Rincewind», che non
// e' vero — il tredici e' il numero sul dorso, e sul dorso c'e' scritto
// Discworld. Le due righe di una stessa saga si distinguono dal titolo e
// dalla copertina, che sono li' accanto; un'etichetta che mente no.
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

// I FILI CHE HAI IN MANO, raccolti una volta sola: li leggono sia chi
// propone il passo sia chi spiega perche' non lo propone, e devono vedere
// gli stessi gruppi — se divergessero, la spiegazione parlerebbe di una
// storia diversa da quella che e' rimasta muta.
function raccogliStorie(books, statusOf, tocco, contorno) {
  // dove ogni serie si numera da se', il numero e' della SERIE e l'etichetta
  // pure; dove la fila e' una sola, il numero e' della saga. Non decide come
  // si raggruppa — quello e' mestiere della serie, sempre — decide come si
  // chiama la riga.
  const suoi = new Set();
  for (const b of books) {
    const saga = (b?.saga || "").trim();
    if (saga && !suoi.has(saga) && numeriMescolati(books, saga)) suoi.add(saga);
  }
  const storie = new Map();
  for (const b of books) {
    const saga = (b?.saga || "").trim();
    if (!saga) continue;
    // contano i volumi DICHIARATI, letti o in lettura: un'apertura di
    // passaggio non e' niente, e l'abbandonato e' una storia lasciata
    const stato = statusOf(b.id);
    if (stato !== "read" && stato !== "reading") continue;
    // E NON APRE UN FILO NEMMENO DA RIFERIMENTO. Era la meta' che si vedeva
    // nella fotografia: l'unico volume letto senza Serie era «Eisenhorn»
    // — il prologo, che la guida chiama fondazione del 40K e non tappa
    // dell'Eresia — e bastava lui a far nascere una riga «Warhammer 40K»
    // che poi proponeva la lettura di sfondo dopo di lui. Un libro che la
    // guida non conta come tappa non e' un filo in mano.
    if (contorno(b)) continue;
    // un filo per serie cominciata, e le maiuscole non ne fanno un secondo;
    // il volume che non sta in nessun gruppo — numeri doppi dentro la sua
    // stessa serie — lo zittisce `nextInSaga`
    const ciclo = cicloDi(b);
    const chiave = `${saga}\u0000${ciclo.toLowerCase()}`;
    const e = storie.get(chiave) || { saga, ciclo, avanti: null, quando: 0 };
    // il piu' avanti: `-Infinity` tiene i senza-numero sotto a chiunque
    // ne abbia uno, cosi' un volume non numerato non fa da riferimento
    // finche' c'e' di meglio
    if (!e.avanti || (b.sagaOrder ?? -Infinity) > (e.avanti.sagaOrder ?? -Infinity)) e.avanti = b;
    e.quando = Math.max(e.quando, tocco(b.id) || 0);
    storie.set(chiave, e);
  }
  for (const e of storie.values()) e.nome = suoi.has(e.saga) ? e.ciclo || e.saga : e.saga;
  return storie;
}

export function prossimiPassi(
  books = [],
  {
    statusOf = getStatus,
    progressoOf = getProgress,
    tocco = () => 0,
    escludi = null,
    contorno = contornoDiUnaGuida,
  } = {}
) {
  const storie = raccogliStorie(books, statusOf, tocco, contorno);

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
    const libro = nextInSaga(e.avanti, books, statusOf, progressoOf, contorno);
    // il libro gia' in cima all'Ingresso non si ripete due righe piu' sotto
    if (!libro || libro.id === escludi) continue;
    passi.push({ saga: e.saga, ciclo: e.ciclo, nome: e.nome, libro, da: e.avanti, quando: e.quando });
  }
  // e a parita' di nome decide il NUMERO del volume proposto: da quando due
  // serie della stessa saga possono chiamarsi tutt'e due come la saga
  // («Discworld» due volte), l'alfabeto non le distingue piu' e senza questo
  // terzo criterio l'ordine sarebbe quello in cui i libri sono entrati in
  // biblioteca, cioe' diverso a ogni import
  return passi.sort(
    (a, b) =>
      b.quando - a.quando ||
      a.nome.localeCompare(b.nome, "it") ||
      (a.libro.sagaOrder ?? Infinity) - (b.libro.sagaOrder ?? Infinity)
  );
}

// E LE SAGHE CHE TACCIONO DICONO PERCHE'.
//
// Segnalato con l'Ingresso in mano: «adesso non mi proponi piu' nulla?».
// Sette righe c'erano, e quella del 40K no — e da fuori le ragioni per cui
// un filo non propone niente sono indistinguibili fra loro: il volume dopo
// non ce l'hai, l'hai gia' aperto, stai ancora leggendo quello di prima,
// due volumi portano lo stesso numero. Tutte e quattro si vedono uguali:
// una riga che non c'e'.
//
// E' la lezione di `perchePrimaTace`, dove il tasto che non compare nomina
// il PRIMO anello rotto e dice dove si mette a posto. Qui la ragione non si
// ricostruisce: viene da `passoDentro`, la stessa camminata che sceglie il
// volume.
//
// TACE CHI NON HA NIENTE DA DIRE: una saga mai cominciata non compare (non
// e' un filo in mano), e nemmeno una che il passo ce l'ha — quella sta gia'
// nella fila sopra. Resta solo chi un filo lo ha e non riceve una proposta.
export function perchePassoTace(
  books = [],
  {
    statusOf = getStatus,
    progressoOf = getProgress,
    tocco = () => 0,
    escludi = null,
    contorno = contornoDiUnaGuida,
  } = {}
) {
  const storie = raccogliStorie(books, statusOf, tocco, contorno);
  const muti = [];
  for (const e of storie.values()) {
    // il piu' avanti che hai dichiarato lo stai ancora leggendo: il passo
    // dopo ce l'hai in mano, e la riga lo dice invece di sparire
    if (statusOf(e.avanti.id) !== "read") {
      muti.push({ ...e, motivo: "inMano", da: e.avanti });
      continue;
    }
    // SI SPREME TUTTO L'ESITO, non i campi che oggi mi vengono in mente:
    // `passoDentro` porta con se' i volumi che la frase deve nominare
    // (`volume`, `uno`, `due`), e un motivo nuovo ne portera' altri —
    // elencandoli a mano, il prossimo li perde per strada e la riga torna
    // generica senza che nessun errore lo dica (preso dal test)
    const esito = passoDentro(e.avanti, books, statusOf, progressoOf, contorno);
    const { libro } = esito;
    // chi un passo ce l'ha non si spiega: o sta nella fila qui sopra, o e'
    // il libro gia' in cima all'Ingresso (`escludi`), che la fila salta
    // apposta per non dirlo due volte. In tutt'e due i casi la riga c'e',
    // ed e' per questo che il confronto con `escludi` NON si scrive: una
    // guardia che non guarda e' peggio di nessuna guardia (mutazione
    // provata, sopravviveva)
    if (libro) continue;
    muti.push({ ...e, ...esito, da: e.avanti });
  }
  return muti.sort((a, b) => b.quando - a.quando || a.nome.localeCompare(b.nome, "it"));
}

// Le parole, una per ragione. Stanno in un elenco per la ragione di `GUAI` e
// di `PERCHE_TACE`: un motivo senza frase non alza nessun errore, scrive
// «undefined» dentro una riga in italiano — e il test pretende che ognuno
// sappia parlare.
export const MOTIVI_PASSO = {
  inMano: (t) => `stai ancora leggendo «${t.da?.title || "il volume più avanti"}».`,
  aperto: (t) => `il seguito «${t.volume?.title || "che viene dopo"}» l'hai già aperto: il passo ce l'hai in mano.`,
  ultimo: (t) => `«${t.da?.title || "l'ultimo che hai letto"}» è l'ultimo volume che hai di questa storia.`,
  tuttiLetti: (t) => `dopo «${t.da?.title || "l'ultimo"}» hai già letto tutto quello che hai.`,
  abbandonati: (t) => `dopo «${t.da?.title || "l'ultimo"}» hai solo volumi che avevi lasciato.`,
  soloSfondo: (t) =>
    `dopo «${t.da?.title || "l'ultimo"}» ti restano solo letture di sfondo, che la guida non chiede come tappa.`,
  mescolati: (t) =>
    t?.uno && t?.due
      ? `«${t.uno.title}» e «${t.due.title}» portano tutt'e due il n° ${t.uno.sagaOrder}: finché è così non so dire qual è il prossimo — correggi il numero di uno dei due nella scheda.`
      : "due volumi portano lo stesso numero di lettura: finché è così non so dire qual è il prossimo — correggi i numeri nella scheda.",
  senzaSaga: () => "non ha una saga scritta nella scheda.",
};

// La frase intera, col nome del filo davanti. Un motivo che non conosciamo
// si dice com'e' invece di sparire: e' la regola di `spiegaSync` — quel che
// non sappiamo tradurre resta l'unico appiglio.
export function frasePassoTace(t) {
  const dillo = MOTIVI_PASSO[t?.motivo];
  return `${t?.nome || "Questa storia"}: ${dillo ? dillo(t) : `non ho un passo da proporti (${t?.motivo}).`}`;
}
