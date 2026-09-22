// IL PROSSIMO PASSO DENTRO LA SAGA.
//
// Finito un volume, l'app propone quello dopo. Sbagliando, non alza nessun
// errore: propone un libro, e quel libro sembra il seguito. Le tre regole
// che lo tengono onesto — si guarda solo AVANTI, si salta quel che hai già
// letto, e senza numero d'ordine non si indovina — stavano scritte nei
// commenti e difese da niente.
//
// La terza è quella che costa di più a sbagliarsi: proporre il volume
// sbagliato di una saga è uno spoiler servito dall'app stessa.
import { nextInSaga } from "../src/lib/saga.js";

// LO STORAGE FINTO SERVE, E VA DICHIARATO QUI. Da quando il filtro guarda
// anche il PROGRESSO, il quarto argomento di `nextInSaga` ha per default il
// `getProgress` vero, che legge `localStorage` — e in Node non c'è. Senza
// questa riga il file passava lo stesso nel giro completo, perché un altro
// test lascia il suo stub sul `globalThis`: verde per l'ORDINE dei file, e
// rosso da solo. Un test che dipende da chi gira prima non difende niente.
globalThis.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

// un volume di libreria come lo vede questa funzione
const V = (id, saga, sagaOrder, addedAt = 0) => ({ id, saga, sagaOrder, addedAt, title: id });
// nessuno letto, se non detto altrimenti
const nuovi = () => "unread";
const letti = (...ids) => (id) => (ids.includes(id) ? "read" : "unread");
// quanto sei dentro un volume: qui nessuno è mai stato aperto
const intatti = () => 0;

export default async function (t) {
  const trilogia = [V("uno", "First Law", 1), V("due", "First Law", 2), V("tre", "First Law", 3)];

  // =======================================================================
  // SI GUARDA SOLO AVANTI
  // =======================================================================
  //
  // Un volume precedente lasciato indietro non è «il prossimo»: se stai
  // rileggendo il terzo, il primo non è quel che viene dopo.
  {
    t.eq("dal primo si va al secondo", nextInSaga(trilogia[0], trilogia, nuovi)?.id, "due");
    t.eq("dal secondo al terzo", nextInSaga(trilogia[1], trilogia, nuovi)?.id, "tre");
    t.eq("dopo l'ultimo non c'è niente", nextInSaga(trilogia[2], trilogia, nuovi), null);
    // e un volume indietro non si propone nemmeno se non l'hai letto
    t.eq(
      "dal terzo il primo non è «il prossimo»",
      nextInSaga(trilogia[2], trilogia, nuovi),
      null
    );
  }
  {
    // SI SALTA IL PRIMO LIBERO, non il successivo per numero: se hai già
    // letto il secondo, il prossimo è il terzo
    t.eq("il letto si scavalca", nextInSaga(trilogia[0], trilogia, letti("due"))?.id, "tre");
    t.eq(
      "e se sono letti tutti non si propone niente",
      nextInSaga(trilogia[0], trilogia, letti("due", "tre")),
      null
    );
  }

  // =======================================================================
  // SENZA NUMERO D'ORDINE NON SI INDOVINA
  // =======================================================================
  //
  // Meglio nessuna proposta di una sbagliata: in una saga, il volume
  // sbagliato è uno spoiler servito dall'app.
  {
    const conSenzaNumero = [...trilogia, V("ignoto", "First Law", null)];
    const r = nextInSaga(trilogia[0], conSenzaNumero, nuovi);
    t.eq("il volume senza numero non si propone", r?.id, "due");
    // nemmeno quando è l'unico rimasto
    t.eq(
      "e se è l'unico, non si propone niente",
      nextInSaga(trilogia[0], [trilogia[0], V("ignoto", "First Law", null)], nuovi),
      null
    );
  }
  {
    // MA SE È IL LIBRO CORRENTE a non avere numero, la saga si può ancora
    // percorrere: non sappiamo dove sei, quindi si offre il primo libero
    const corrente = V("ignoto", "First Law", null);
    const r = nextInSaga(corrente, [corrente, ...trilogia], nuovi);
    t.eq("da un volume senza numero si riparte dal più basso", r?.id, "uno");
    t.eq("saltando i letti", nextInSaga(corrente, [corrente, ...trilogia], letti("uno"))?.id, "due");
  }

  // =======================================================================
  // LA SAGA È QUELLA, NON UN'ALTRA
  // =======================================================================
  {
    const miste = [...trilogia, V("altrove", "Malazan", 1), V("altrove2", "Malazan", 2)];
    t.eq("un'altra saga non c'entra", nextInSaga(trilogia[0], miste, nuovi)?.id, "due");
    // gli spazi attorno al nome non fanno una saga diversa: quel campo lo
    // scrivi a mano nella scheda del libro
    const conSpazi = V("spaziato", "  First Law  ", 4);
    t.eq(
      "gli spazi attorno al nome non contano",
      nextInSaga(trilogia[2], [...trilogia, conSpazi], nuovi)?.id,
      "spaziato"
    );
  }
  {
    // un libro senza saga non ha un «prossimo»: non c'è nessun filo da
    // seguire, e proporre qualcosa sarebbe inventare
    t.eq("senza saga niente", nextInSaga(V("solo", "", 1), trilogia, nuovi), null);
    t.eq("con la saga fatta di spazi nemmeno", nextInSaga(V("solo", "   ", 1), trilogia, nuovi), null);
    t.eq("e senza libro", nextInSaga(null, trilogia, nuovi), null);
    t.eq("né senza scaffale", nextInSaga(trilogia[0], [], nuovi), null);
  }
  {
    // Sé stesso non è il proprio seguito.
    //
    // NOTA ONESTA: `b.id !== book.id` è cintura e bretelle. Provato a
    // toglierlo e non casca niente, perché il libro corrente è già escluso
    // due volte — se ha un numero, `ord(b) > cur` è falso per sé stesso; se
    // non ce l'ha, lo butta fuori `b.sagaOrder != null`. Resta perché dice a
    // voce alta una cosa che altrimenti si capisce solo ragionando, ma
    // nessun test lo difende.
    t.eq("un libro non è il proprio prossimo", nextInSaga(trilogia[0], [trilogia[0]], nuovi), null);
    t.eq("nemmeno senza numero d'ordine", nextInSaga(V("x", "First Law", null), [V("x", "First Law", null)], nuovi), null);
  }

  // =======================================================================
  // A PARI ORDINE DECIDE CHI È ARRIVATO PRIMA
  // =======================================================================
  //
  // Due edizioni dello stesso volume, o un doppione dichiarato: senza una
  // regola, quale dei due esce dipenderebbe dall'ordine dello scaffale, e
  // cambierebbe da un giorno all'altro.
  //
  // LO STESSO VOLUME VUOL DIRE LO STESSO TITOLO, e la fixture prima non lo
  // diceva: dava due titoli diversi allo stesso numero, cioè la firma di
  // due STORIE numerate ognuna da uno, che è il caso opposto e adesso fa
  // tacere la proposta (vedi `numeriMescolati`). Contraddiceva la sua
  // stessa intenzione, e a scoprirlo è stata la cura, non la rilettura.
  {
    const copia = (id, addedAt) => ({ ...V(id, "First Law", 2, addedAt), title: "Before They Are Hanged" });
    const doppi = [V("uno", "First Law", 1), copia("secondaCopia", 5000), copia("primaCopia", 1000)];
    t.eq("vince quella entrata per prima", nextInSaga(doppi[0], doppi, nuovi)?.id, "primaCopia");
    // e la risposta non dipende dall'ordine dell'elenco
    const girati = [doppi[0], doppi[2], doppi[1]];
    t.eq("qualunque ordine dello scaffale", nextInSaga(doppi[0], girati, nuovi)?.id, "primaCopia");
  }
  {
    // l'ordine di lettura comanda sull'ordine d'arrivo: un volume entrato
    // ieri ma numerato 2 viene prima di uno entrato l'anno scorso e numerato 3
    const sparsi = [
      V("uno", "First Law", 1, 0),
      V("terzo", "First Law", 3, 100),
      V("secondo", "First Law", 2, 99999),
    ];
    t.eq("comanda il numero di lettura", nextInSaga(sparsi[0], sparsi, nuovi)?.id, "secondo");
  }

  // =======================================================================
  // UN COFANETTO È UNA VOCE COME LE ALTRE
  // =======================================================================
  //
  // Un omnibus che racchiude una trilogia conta per il numero d'ordine che
  // gli hai dato, non per cosa contiene: l'app non deve provare a indovinare
  // che dentro ci sono tre romanzi.
  {
    const conCofanetto = [V("cofanetto", "First Law", 1), V("quarto", "First Law", 2)];
    t.eq("dopo il cofanetto viene il numero dopo", nextInSaga(conCofanetto[0], conCofanetto, nuovi)?.id, "quarto");
  }

  // =======================================================================
  // UN VOLUME CHE HAI GIÀ APERTO NON È «IL PROSSIMO»
  // =======================================================================
  //
  // Segnalato con l'Ingresso in mano: «Moving Pictures» compariva fra i
  // libri che stava leggendo E fra i prossimi passi, a due righe di
  // distanza. Il filtro guardava il solo STATO, e un romanzo al 27% mai
  // dichiarato «in lettura» risultava intatto.
  //
  // Le due risposte vanno guardate tutt'e due: lo stato lo dichiari tu, il
  // progresso lo dice il libro.
  //
  // E IL VOLUME CHE HAI IN MANO NON SI SCAVALCA (seconda segnalazione: «solo
  // i libri successivi ai libri già letti, non volumi a caso»): al primo giro
  // il secondo in lettura faceva proporre il TERZO — un volume che viene
  // dopo un libro che non hai ancora letto. Adesso il seguito è quello che
  // SEGUE, e se lo stai leggendo non c'è un «prossimo» da dire.
  {
    t.eq("intatto, il secondo è il prossimo", nextInSaga(trilogia[0], trilogia, letti(), intatti)?.id, "due");
    const inLettura = (id) => (id === "due" ? "reading" : "unread");
    t.eq(
      "…e se lo stai leggendo non si salta al terzo",
      nextInSaga(trilogia[0], trilogia, inLettura, intatti),
      null
    );
    // il caso della prima segnalazione: lo stato non dice niente, il
    // progresso sì — e vale lo stesso: non si propone, e non si salta
    const aMeta = (id) => (id === "due" ? 0.27 : 0);
    t.eq(
      "un volume al 27% è già aperto, anche se lo stato tace",
      nextInSaga(trilogia[0], trilogia, nuovi, aMeta),
      null
    );
    // ABBANDONATO NON È «DA LEGGERE»: quella storia l'hai lasciata apposta,
    // e riproportela è il difetto per cui quello stato esiste
    const mollato = (id) => (id === "due" ? "abandoned" : "unread");
    t.eq("l'abbandonato non si ripropone", nextInSaga(trilogia[0], trilogia, mollato, intatti)?.id, "tre");
    // e un progresso a zero non toglie niente a nessuno
    t.eq("il progresso a zero non scarta", nextInSaga(trilogia[0], trilogia, nuovi, () => 0)?.id, "due");
  }

  // =======================================================================
  // DENTRO UNA SAGA GRANDE CI SONO PIÙ STORIE
  // =======================================================================
  //
  // Le due regole stanno QUI e non nei chiamanti. Il primo giro le aveva
  // messe in `prossimiPassi`, e curavano la sola fila dell'Ingresso: il
  // riquadro in cima e la proposta a libro chiuso in `App.jsx` chiamano
  // `nextInSaga` diretta, e restavano indietro — misurato al banco, il
  // riquadro diceva ancora «Rhythm of War · il passo n° 4 di Cosmoverse»,
  // che sono le parole esatte della segnalazione.
  {
    const C = (id, ciclo, n) => ({ ...V(id, "Cosmoverse", n), series: ciclo });
    const cosmo = [
      C("mb1", "Mistborn", 1),
      C("mb2", "Mistborn", 2),
      C("mb3", "Mistborn", 3),
      C("sl1", "Stormlight", 1),
      C("sl4", "Stormlight", 4),
    ];
    // IL CICLO: dal secondo Mistborn si va al terzo, non al numero 4
    // dell'altra storia
    t.eq("il passo resta dentro il ciclo", nextInSaga(cosmo[1], cosmo, nuovi)?.id, "mb3");
    t.eq("e finito il ciclo non si salta all'altro", nextInSaga(cosmo[2], cosmo, letti("mb1", "mb2")), null);
    // le maiuscole non fanno un altro ciclo
    const storto = [...cosmo, { ...V("mb4", "Cosmoverse", 4), series: "MISTBORN" }];
    t.eq("una grafia diversa non è un altro ciclo", nextInSaga(cosmo[2], storto, letti("mb1", "mb2"))?.id, "mb4");
  }
  {
    // I NUMERI, quando il ciclo non è scritto: due titoli diversi sullo
    // stesso posto non sono una fila, e «il prossimo» non esiste.
    const N = (id, n) => V(id, "Cosmoverse", n);
    const cosmo = [N("mb1", 1), N("mb2", 2), N("mb3", 3), N("sl1", 1), N("sl4", 4)];
    t.eq("col campo Serie vuoto non si indovina", nextInSaga(cosmo[2], cosmo, letti("mb1", "mb2")), null);
    t.eq("nemmeno a metà del filo", nextInSaga(cosmo[0], cosmo, nuovi), null);
    // ma una saga che numera dritto non si tocca
    t.eq("i numeri in fila non silenziano niente", nextInSaga(trilogia[0], trilogia, nuovi)?.id, "due");
  }
  {
    // IL CICLO COMANDA SEMPRE, ANCHE COI NUMERI UNICI — e questo controllo è
    // GIRATO. Pinnava «coi numeri unici la saga è una fila sola e il ciclo
    // non c'entra», regola chiesta su Pratchett e disdetta dal lettore un
    // giorno dopo guardando il Malazan: «considera non tutto il ciclo ma la
    // singola serie per sapere cosa devo leggere dopo».
    //
    // Il caso lo spiega da sé: x2 è il numero 6 e il numero 7 è k1, ma k1 è
    // un Kharkanas. Chi ha in mano i senza-serie non aspetta «il numero
    // dopo», aspetta il prossimo della SUA storia — e lì non ce n'è uno.
    const C = (id, ciclo, n) => ({ ...V(id, "Malazan", n), series: ciclo });
    const misti = [C("k1", "Kharkanas", 7), C("k2", "Kharkanas", 8), C("x1", "", 5), C("x2", "", 6)];
    t.eq("il prossimo è quello della sua serie", nextInSaga(misti[2], misti, nuovi)?.id, "x2");
    t.eq("…e non si scavalca in un'altra storia", nextInSaga(misti[3], misti, nuovi), null);
    t.eq("…mentre dentro i Kharkanas si prosegue", nextInSaga(misti[0], misti, nuovi)?.id, "k2");
    // coi numeri DOPPI non cambia niente, ed è la prova che a spartire è la
    // serie e non i numeri: un volume senza ciclo resta fra i senza-ciclo
    const doppi = [C("k1", "Kharkanas", 1), C("k2", "Kharkanas", 2), C("x1", "", 1), C("x2", "", 2)];
    t.eq("coi numeri doppi si resta nel ciclo", nextInSaga(doppi[0], doppi, nuovi)?.id, "k2");
    t.eq("…e il senza-ciclo fra i senza-ciclo", nextInSaga(doppi[2], doppi, nuovi)?.id, "x2");
    // su una saga senza cicli il gruppo è la saga intera: non cambia niente
    t.eq("senza cicli è la saga intera", nextInSaga(trilogia[0], trilogia, nuovi)?.id, "due");
  }

  // ── QUEL CHE LA GUIDA NON CONTA COME TAPPA NON È IL PROSSIMO PASSO ────
  //
  // Segnalato con l'Ingresso in mano: «perché come prossimo passo per il
  // 40K mi suggerisce Night Lords invece del numero successivo dopo
  // Mechanicum? Night Lords è solo successivo alla Horus Heresy».
  //
  // Il concetto c'era già, da un'altra parte: `prossimoPasso` — la pagina
  // del cammino — un passo su queste specie non lo propone mai. Qui, dove
  // si risponde alla STESSA domanda per l'Ingresso e per il riquadro in
  // cima, non se ne sapeva niente.
  //
  // E IL NUMERO DEL CAMMINO LO RENDE INVISIBILE invece che innocuo: da
  // quando le tappe senza numero ne prendono uno col decimale, quei volumi
  // si infilano FRA i romanzi nell'ordinamento — è quel decimale che li ha
  // portati in fila.
  {
    // il contorno si passa da fuori come `leggiByte`: qui si finge, così il
    // controllo prova la REGOLA e non la tavola (quella ha i suoi, in
    // `capitoli.test.mjs`, coi titoli veri)
    const G = (id, n) => ({ ...V(id, "Warhammer 40K", n), series: "" });
    const contorno = (b) => b.id === "sfondo" || b.id === "prologo";
    const scena = [G("prologo", 0.01), G("uno", 1), G("sfondo", 1.04), G("due", 2)];
    t.eq(
      "il contorno si scavalca, non ferma la ricerca",
      nextInSaga(scena[1], scena, nuovi, () => 0, contorno)?.id,
      "due"
    );
    // ED È UN SALTO, NON UNO STOP: senza il `continue` il passo dopo «uno»
    // sarebbe «niente», perché un volume che non hai aperto ti trattiene
    // in mano il filo. Il caso lo prova solo con un romanzo vero DOPO il
    // contorno — con «due» tolto, le due regole danno la stessa risposta.
    t.eq(
      "…e senza un romanzo dopo non si propone niente",
      nextInSaga(scena[1], [scena[0], scena[1], scena[2]], nuovi, () => 0, contorno),
      null
    );
    // e nemmeno da lui si riparte per la storia: il contorno non è un filo
    t.eq(
      "dal contorno non si continua la storia",
      nextInSaga(scena[0], scena, nuovi, () => 0, contorno)?.id,
      "uno"
    );
    // e il contorno già letto si scavalca come prima. DICHIARATO: questo
    // controllo non è portante, e lo dice una mutazione sopravvissuta —
    // spostando la guardia sotto quella dello stato le due strade fanno
    // `continue` lo stesso, quindi l'ordine fra le due righe non cambia
    // niente. Resta perché la regola vale su ogni stato, non perché
    // difenda una riga.
    t.eq(
      "vale anche sul contorno già letto",
      nextInSaga(scena[1], scena, letti("sfondo"), () => 0, contorno)?.id,
      "due"
    );
    // senza guida che dica niente, tutto resta com'era
    t.eq("senza contorni non cambia niente", nextInSaga(scena[1], scena, nuovi, () => 0, () => false)?.id, "sfondo");
  }
  {
    // E LA TAVOLA VERA È COLLEGATA DAVVERO, coi titoli della sua
    // fotografia. I controlli qui sopra fingono il contorno per provare la
    // REGOLA; questo non finge niente, e pinna il default — senza, la
    // regola resterebbe scritta e non arriverebbe mai all'Ingresso né al
    // riquadro in cima (mutazione provata: col default a «nessuno è un
    // contorno» tutto il resto del file passava).
    const W = (id, titolo, autore, n, serie = "") => ({
      id,
      title: titolo,
      author: autore,
      saga: "Warhammer 40K",
      series: serie,
      sagaOrder: n,
      addedAt: 1,
    });
    const suoi = [
      W("mec", "Mechanicum", "Graham McNeill", 15, "The Horus Heresy"),
      // il numero col decimale è quello che il cammino scrive alle tappe
      // che la guida non numera: è lui che li infila FRA i romanzi
      W("nl", "Night Lords Omnibus", "Aaron Dembski-Bowden", 15.01, "The Horus Heresy"),
      W("ats", "A Thousand Sons", "Graham McNeill", 16, "The Horus Heresy"),
    ];
    t.eq(
      "dopo Mechanicum viene A Thousand Sons, non Night Lords",
      nextInSaga(suoi[0], suoi, letti("mec"), () => 0)?.id,
      "ats"
    );
  }
}
