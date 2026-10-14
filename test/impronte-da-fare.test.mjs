// IL TASTO DELLE IMPRONTE conta solo quel che puo' servire (segnalato: «perche'
// mi dice che ci sono i doppioni di tre tomi e se ci clicco non succede
// nulla?»): un tomo senza byte qui non si puo' ripassare.
import { impronteDaFare } from "../src/lib/importBook.js";
import { riconosci } from "../src/lib/sagaBooks.js";

const SHA = (c) => c.repeat(64);

export default async function (t) {
  // ---- il tasto conta solo quel che puo' servire ----
  {
    const libri = [
      { id: "a", impronta: SHA("a") },
      { id: "b" },
      { id: "c" },
      { id: "d" },
    ];
    const qui = new Set(["b"]);
    t.eq("chi ha i byte qui si conta, chi non li ha no", impronteDaFare(libri, { qui }).map((b) => b.id).join(","), "b");
    t.eq("chi l'impronta ce l'ha gia' mai", impronteDaFare(libri, { qui: null }).map((b) => b.id).join(","), "b,c,d");
  }

  // ---- il riconoscimento delle saghe si ricorda, e torna una copia ----
  {
    const r1 = riconosci({ title: "Mort", author: "Terry Pratchett" });
    t.eq("lo stesso libro riconosciuto come prima", r1?.saga, "Discworld");
    r1.saga = "Guastata";
    const r2 = riconosci({ title: "Mort", author: "Terry Pratchett" });
    t.eq("chi tocca la risposta non la cambia agli altri", r2?.saga, "Discworld");
    t.c("…perche' ognuno riceve una copia sua", r1 !== r2);
    t.eq("il «niente» si ricorda come niente", riconosci({ title: "Un titolo che nessuna tavola conosce", author: "Nessuno" }), null);
    t.eq("…anche la seconda volta", riconosci({ title: "Un titolo che nessuna tavola conosce", author: "Nessuno" }), null);
    t.eq("un titolo diverso e' una domanda diversa", riconosci({ title: "Eric", author: "Terry Pratchett" })?.saga, "Discworld");
    t.c("col nome del file si guarda da capo, e combacia lo stesso", riconosci({ title: "", author: "", fileName: "Mort - Terry Pratchett.epub" })?.saga === "Discworld");
  }
}
