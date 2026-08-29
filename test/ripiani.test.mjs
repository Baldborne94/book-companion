// LO SCAFFALE SI DISPONE, e i libri stanno accanto ai loro fratelli.
//
// Il difetto curato: «Scaffale» era il nome del NESSUN raggruppamento —
// tutti i tomi in fila per data d'ingresso, cioè un ordine che l'occhio
// non riconosce, col primo volume di una trilogia fra il quinto di
// un'altra e un romanzo solo.
import { disponi, SOLI } from "../src/lib/ripiani.js";

const libro = (title, author, saga = "", sagaOrder = null) => ({
  id: title,
  title,
  author,
  saga,
  sagaOrder,
});

const nomi = (r) => r.map((x) => x.nome);
const titoli = (r) => r.libri.map((b) => b.title);
const perTitolo = (a, b) => a.title.localeCompare(b.title, "it");

export default async function (t) {
  // ---- la saga sta insieme, e in ordine di lettura ----------------------
  {
    const r = disponi([
      libro("Last Argument of Kings", "Joe Abercrombie", "First Law", 3),
      libro("The Blade Itself", "Joe Abercrombie", "First Law", 1),
      libro("Before They Are Hanged", "Joe Abercrombie", "First Law", 2),
    ]);
    t.eq("una saga fa un ripiano solo", r.length, 1);
    t.eq(
      "e i volumi ci stanno in ordine di lettura",
      titoli(r[0]).join(" · "),
      "The Blade Itself · Before They Are Hanged · Last Argument of Kings"
    );
    t.eq("col nome della saga in testa", r[0].nome, "First Law");
    t.eq("e l'autore sotto, che è uno solo", r[0].autore, "Joe Abercrombie");
  }

  // ---- il volume senza numero non si mette in mezzo a quelli che l'hanno -
  {
    const r = disponi([
      libro("Senza numero", "Tale", "Saga", null),
      libro("Secondo", "Tale", "Saga", 2),
      libro("Primo", "Tale", "Saga", 1),
    ]);
    t.eq(
      "chi non sa dove sta nella storia chiude la fila",
      titoli(r[0]).join(" · "),
      "Primo · Secondo · Senza numero"
    );
  }

  // ---- due grafie dello stesso autore sono un autore solo ---------------
  {
    const r = disponi([
      libro("Uno", "Abercrombie, Joe"),
      libro("Due", "Joe Abercrombie"),
    ]);
    t.eq("«Abercrombie, Joe» e «Joe Abercrombie» stanno insieme", r.length, 1);
    t.eq("e il ripiano è dell'autore", r[0].tipo, "autore");
  }

  // ---- un ripiano da un libro solo non è un ripiano ---------------------
  {
    const r = disponi([
      libro("Solo suo", "Susanna Clarke"),
      libro("Primo", "Tale", "Saga", 1),
      libro("Secondo", "Tale", "Saga", 2),
    ]);
    t.eq("chi non ha fratelli non prende un'intestazione", r.length, 2);
    t.eq("scende fra i volumi soli", r[1].id, SOLI);
    t.eq("dove c'è davvero", titoli(r[1]).join(""), "Solo suo");
  }
  {
    // vale anche per una saga di cui possiedi un volume solo: una
    // intestazione con sotto un dorso solo costa due righe per non dire
    // niente, e il giorno che arriva il secondo il ripiano nasce da sé
    const r = disponi([
      libro("Dune", "Frank Herbert", "Dune", 1),
      libro("Primo", "Tale", "Saga", 1),
      libro("Secondo", "Tale", "Saga", 2),
    ]);
    t.eq("una saga con un volume solo non fa ripiano", r.length, 2);
    t.eq("e Dune sta fra i soli", r[1].libri[0].title, "Dune");
  }

  // ---- l'autore sotto il nome SOLO se è uno -----------------------------
  {
    const r = disponi([
      libro("Horus Rising", "Dan Abnett", "Horus Heresy", 1),
      libro("False Gods", "Graham McNeill", "Horus Heresy", 2),
    ]);
    // una saga scritta da venti mani, con un nome solo sotto,
    // racconterebbe una bugia
    t.eq("una saga a più mani non si prende un autore", r[0].autore, null);
  }

  // ---- l'ordine dei ripiani, e i soli sempre per ultimi -----------------
  {
    const r = disponi([
      libro("Zeta", "Zeta Autore", "Zulu", 1),
      libro("Zeta 2", "Zeta Autore", "Zulu", 2),
      libro("Orfano", "Nessuno"),
      libro("Alfa", "Alfa Autore", "Alfa", 1),
      libro("Alfa 2", "Alfa Autore", "Alfa", 2),
    ]);
    t.eq("i ripiani stanno in ordine alfabetico", nomi(r).join(" · "), "Alfa · Zulu · Volumi soli");
    t.eq("e i volumi soli chiudono sempre", r[r.length - 1].id, SOLI);
  }

  // ---- nessun libro si perde per strada ---------------------------------
  {
    const biblioteca = [
      libro("A", "Uno", "Saga", 2),
      libro("B", "Uno", "Saga", 1),
      libro("C", "Due"),
      libro("D", "Due"),
      libro("E", "Tre"),
      libro("F", "", ""),
      { id: "g", title: "G" },
    ];
    const r = disponi(biblioteca);
    const quanti = r.reduce((n, x) => n + x.libri.length, 0);
    t.eq("sullo scaffale ci sono tutti i libri che c'erano", quanti, biblioteca.length);
    // un libro senza né saga né autore non deve far esplodere niente:
    // succede a ogni ePub senza metadati
    t.c("e chi non ha né saga né autore sta fra i soli", r[r.length - 1].libri.some((b) => b.title === "G"));
  }

  // ---- dove il numero non c'è decide l'ordinamento scelto in Libreria ---
  {
    const r = disponi(
      [libro("Zeta", "Autore"), libro("Alfa", "Autore"), libro("Mezzo", "Autore")],
      perTitolo
    );
    t.eq("il confronto passato ordina il ripiano", titoli(r[0]).join(" · "), "Alfa · Mezzo · Zeta");
  }
  {
    // la Libreria i libri glieli passa GIA' ordinati: senza confronto
    // l'ordine d'arrivo non si deve rimescolare
    const r = disponi([libro("Zeta", "Autore"), libro("Alfa", "Autore")]);
    t.eq("senza confronto resta l'ordine d'arrivo", titoli(r[0]).join(" · "), "Zeta · Alfa");
  }

  // ---- una biblioteca vuota non inventa ripiani -------------------------
  t.eq("niente libri, niente ripiani", disponi([]).length, 0);
}
