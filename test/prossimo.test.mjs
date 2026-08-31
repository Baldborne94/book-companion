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

// un volume di libreria come lo vede questa funzione
const V = (id, saga, sagaOrder, addedAt = 0) => ({ id, saga, sagaOrder, addedAt, title: id });
// nessuno letto, se non detto altrimenti
const nuovi = () => "unread";
const letti = (...ids) => (id) => (ids.includes(id) ? "read" : "unread");

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
  {
    const doppi = [
      V("uno", "First Law", 1),
      V("secondaCopia", "First Law", 2, 5000),
      V("primaCopia", "First Law", 2, 1000),
    ];
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
}
