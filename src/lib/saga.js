import { getStatus } from "./library.js";

// Il prossimo passo dentro la stessa saga: la voce di libreria non ancora
// letta con l'ordine di lettura piu' basso dopo quella corrente. Un omnibus
// che racchiude una trilogia e' una voce come le altre — conta il numero
// d'ordine assegnato, non cosa contiene. Si guarda solo in avanti: un
// volume precedente lasciato indietro non e' "il prossimo".
export function nextInSaga(book, books, statusOf = getStatus) {
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
          statusOf(b.id) !== "read" &&
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
// hai gia' in mano, e «cominciata» vuol dire che di quella saga un volume
// l'hai letto o lo stai leggendo.
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
export function prossimiPassi(books = [], { statusOf = getStatus, tocco = () => 0, escludi = null } = {}) {
  const saghe = new Map();
  for (const b of books) {
    const saga = (b?.saga || "").trim();
    if (!saga) continue;
    const stato = statusOf(b.id);
    if (stato !== "read" && stato !== "reading") continue;
    const e = saghe.get(saga) || { saga, avanti: null, quando: 0 };
    // il piu' avanti: `-Infinity` tiene i senza-numero sotto a chiunque
    // ne abbia uno, cosi' un volume non numerato non fa da riferimento
    // finche' c'e' di meglio
    if (!e.avanti || (b.sagaOrder ?? -Infinity) > (e.avanti.sagaOrder ?? -Infinity)) e.avanti = b;
    e.quando = Math.max(e.quando, tocco(b.id) || 0);
    saghe.set(saga, e);
  }

  const passi = [];
  for (const e of saghe.values()) {
    const libro = nextInSaga(e.avanti, books, statusOf);
    // il libro gia' in cima all'Ingresso non si ripete due righe piu' sotto
    if (!libro || libro.id === escludi) continue;
    passi.push({ saga: e.saga, libro, da: e.avanti, quando: e.quando });
  }
  return passi.sort((a, b) => b.quando - a.quando || a.saga.localeCompare(b.saga, "it"));
}
