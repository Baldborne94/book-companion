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
