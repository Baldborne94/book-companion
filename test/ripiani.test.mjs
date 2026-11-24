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
    // MA UNA SAGA SI', ANCHE DA UN VOLUME SOLO, e la differenza la fa chi
    // l'ha detto: l'autore lo deduciamo noi dai metadati, la saga la
    // dichiara il lettore a mano. «Dune · 1 volume» dice che di quel ciclo
    // ne ha un pezzo; lo stesso libro buttato fra i soli non dice piu'
    // niente (chiesto dal lettore).
    const r = disponi([
      libro("Dune", "Frank Herbert", "Dune", 1),
      libro("Primo", "Tale", "Saga", 1),
      libro("Secondo", "Tale", "Saga", 2),
    ]);
    t.eq("una saga da un volume solo TIENE il suo ripiano", r.length, 2);
    t.eq("e il ripiano porta il nome della saga", r[0].nome, "Dune");
    t.eq("ed è di tipo saga", r[0].tipo, "saga");
    t.eq("con dentro il suo unico volume", titoli(r[0]).join(""), "Dune");
    t.c("quindi non c'è nessun ripiano dei soli", !r.some((x) => x.id === SOLI));
  }
  {
    // e la distinzione regge nello stesso scaffale: la saga da uno resta,
    // l'autore da uno no
    const r = disponi([
      libro("Dune", "Frank Herbert", "Dune", 1),
      libro("Piranesi", "Susanna Clarke"),
      libro("Primo", "Tale", "Saga", 1),
      libro("Secondo", "Tale", "Saga", 2),
    ]);
    t.eq("saga da uno: ripiano; autore da uno: soli", nomi(r).join(" · "), "Dune · Saga · Volumi soli");
    t.eq("e fra i soli c'è solo il libro senza saga", titoli(r[2]).join(""), "Piranesi");
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

  // ---- DENTRO LA SAGA, I CICLI ------------------------------------------
  // Chiesto dal lettore guardando il Circle of the World: dieci volumi in
  // fila senza una riga a dire dove finisce la Prima Legge e comincia
  // l'Età della Follia. Il ciclo è la Serie della scheda.
  const conCiclo = (title, n, series) => ({ ...libro(title, "Joe Abercrombie", "Circle of the World", n), series });
  {
    const r = disponi([
      conCiclo("A Little Hatred", 8, "The Age of Madness"),
      conCiclo("The Blade Itself", 1, "The First Law"),
      conCiclo("Best Served Cold", 5, ""),
      conCiclo("Sharp Ends", 4, ""),
      conCiclo("Last Argument of Kings", 3, "The First Law"),
      conCiclo("The Trouble with Peace", 9, "The Age of Madness"),
      conCiclo("Before They Are Hanged", 2, "The First Law"),
    ]);
    t.eq("il ripiano resta UNO per saga", r.length, 1);
    const cicli = r[0].cicli;
    t.eq("tre sotto-ripiani", cicli.length, 3);
    // OGNI CICLO STA DOVE STA IL SUO PRIMO VOLUME: la Prima Legge apre, i
    // romanzi a sé stanno in mezzo, l'Età della Follia chiude
    t.eq(
      "nell'ordine in cui la storia li incontra",
      cicli.map((c) => c.nome ?? "—").join(" · "),
      "The First Law · — · The Age of Madness"
    );
    t.eq(
      "e dentro ogni ciclo l'ordine di lettura",
      cicli[0].libri.map((b) => b.title).join(" · "),
      "The Blade Itself · Before They Are Hanged · Last Argument of Kings"
    );
    t.eq("i volumi senza ciclo stanno insieme", cicli[1].libri.map((b) => b.title).join(" · "), "Sharp Ends · Best Served Cold");
    t.eq("e non hanno nome", cicli[1].nome, null);
    t.eq("nessun libro si perde nei cicli", cicli.reduce((n, c) => n + c.libri.length, 0), r[0].libri.length);
  }
  {
    // una saga SENZA cicli non ha niente da suddividere: `null`, non un
    // sotto-ripiano solo senza nome, o ogni saga porterebbe una riga in più
    const r = disponi([
      libro("Dune", "Frank Herbert", "Dune", 1),
      libro("Dune Messiah", "Frank Herbert", "Dune", 2),
    ]);
    t.eq("senza cicli niente sotto-ripiani", r[0].cicli, null);
  }
  {
    // le maiuscole non fanno due cicli, e un ciclo senza nessun numero
    // chiude la fila come i volumi senza numero
    const r = disponi([
      conCiclo("Uno", 1, "Prima Legge"),
      conCiclo("Due", 2, "prima legge"),
      conCiclo("Senza", null, "Racconti"),
    ]);
    t.eq("due cicli, non tre", r[0].cicli.length, 2);
    t.eq("e chi non ha numeri chiude", r[0].cicli[1].nome, "Racconti");
  }
  // un ripiano d'autore non ha cicli: il ciclo vive dentro una saga
  t.eq("l'autore non ha cicli", disponi([libro("A", "X"), libro("B", "X")])[0].cicli, null);

  // ---- una biblioteca vuota non inventa ripiani -------------------------
  t.eq("niente libri, niente ripiani", disponi([]).length, 0);
}
