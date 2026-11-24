// IL RAGGRUPPAMENTO SI DIVIDE IN DUE, E LA DIFFERENZA È CHI RESTA FUORI.
//
// Chiesto dal lettore guardando la Libreria: «il raggruppamento me lo
// dividi per saga o per autore e non tutto assieme». «Saga e autore» resta
// la disposizione di sempre — la saga se c'è, altrimenti l'autore — ma
// adesso i due criteri si possono chiedere anche da soli.
//
// La parte che sbaglia in silenzio non è la raccolta: è il MUCCHIO DI
// SCARTO e il suo nome. Un romanzo senza saga, chiesto «per saga», non è
// un «volume solo» — il suo autore può averne altri tre due ripiani più
// su — e chiamarlo così sarebbe una bugia che nessun errore segnala.
//
// E c'è una trappola che si vede solo raggruppando per autore: dentro quel
// ripiano ci sono DUE storie, tutt'e due numerate da uno. Sul solo numero
// di lettura si interlacciano, e la trilogia che il numero doveva tenere
// insieme viene sbriciolata proprio dal numero.
import { disponi, raccogliCicli, SOLI, CRITERI_VALIDI } from "../src/lib/ripiani.js";

const libro = (title, author, saga = "", sagaOrder = null, series = "") => ({
  id: title,
  title,
  author,
  saga,
  sagaOrder,
  series,
});

const nomi = (r) => r.map((x) => x.nome);
const titoli = (r) => r.libri.map((b) => b.title);
const scarto = (r) => r.find((x) => x.id === SOLI);

// Una biblioteca mista come quella vera: una saga a due volumi, un autore
// con due libri senza saga, e un romanzo solo di un autore solo.
const BIBLIOTECA = () => [
  libro("The Blade Itself", "Joe Abercrombie", "First Law", 1),
  libro("Before They Are Hanged", "Joe Abercrombie", "First Law", 2),
  libro("Best Served Cold", "Joe Abercrombie"),
  libro("Good Omens", "Neil Gaiman"),
  libro("American Gods", "Neil Gaiman"),
  libro("Piranesi", "Susanna Clarke"),
];

export default async function (t) {
  // ---- i tre criteri esistono e quello storto non spegne lo scaffale ----
  t.c("i criteri sono tre", CRITERI_VALIDI.length === 3, CRITERI_VALIDI.join(","));
  {
    const buono = disponi(BIBLIOTECA(), null, "auto");
    const storto = disponi(BIBLIOTECA(), null, "meringa");
    const senza = disponi(BIBLIOTECA());
    t.eq("un criterio che non esiste vale la disposizione di sempre", nomi(storto).join("|"), nomi(buono).join("|"));
    t.eq("…e chiamarla senza criterio è la stessa cosa", nomi(senza).join("|"), nomi(buono).join("|"));
  }

  // ---- «SAGA E AUTORE», che non deve cambiare --------------------------
  {
    const r = disponi(BIBLIOTECA(), null, "auto");
    t.eq("First Law fa il suo ripiano", nomi(r).includes("First Law"), true);
    t.eq("Neil Gaiman sta con i suoi due", nomi(r).includes("Neil Gaiman"), true);
    // «Best Served Cold» non ha saga e il suo autore ha gli altri due
    // dentro First Law, quindi sullo scaffale resta senza fratelli
    t.eq("il mucchio si chiama «Volumi soli»", scarto(r)?.nome, "Volumi soli");
    t.eq(
      "…e ci stanno il romanzo senza fratelli e l'autore da un libro solo",
      titoli(scarto(r)).sort().join(" · "),
      "Best Served Cold · Piranesi"
    );
  }

  // ---- «SAGA»: solo le storie dichiarate -------------------------------
  {
    const r = disponi(BIBLIOTECA(), null, "saga");
    t.eq("resta un ripiano solo, più il mucchio", r.length, 2);
    t.eq("ed è la saga", r[0].nome, "First Law");
    // LA RIGA CHE CONTA: qui NON si ripiega sull'autore. Gaiman ha due
    // libri in casa ma nessuna saga, quindi non fa ripiano.
    t.c("nessun ripiano d'autore", !nomi(r).includes("Neil Gaiman"), nomi(r).join(","));
    t.eq("il mucchio si chiama «Fuori saga», non «Volumi soli»", scarto(r)?.nome, "Fuori saga");
    t.eq("e ci finisce TUTTO quel che una saga non ce l'ha", scarto(r).libri.length, 4);
  }
  {
    // una saga da un volume solo resta un ripiano anche qui: la saga la
    // dichiara il lettore, e «Malazan · 1 volume» dice qualcosa
    const r = disponi([libro("Gardens of the Moon", "Steven Erikson", "Malazan", 1)], null, "saga");
    t.eq("una saga da un volume è un ripiano", r.length, 1);
    t.eq("…col suo nome", r[0].nome, "Malazan");
  }

  // ---- «AUTORE»: le saghe si sciolgono ---------------------------------
  {
    const r = disponi(BIBLIOTECA(), null, "autore");
    t.eq("Abercrombie raccoglie anche i suoi volumi di saga", titoli(r.find((x) => x.nome === "Joe Abercrombie")).length, 3);
    t.eq("Gaiman fa il suo ripiano", titoli(r.find((x) => x.nome === "Neil Gaiman")).length, 2);
    t.c("e nessun ripiano porta il nome di una saga", !nomi(r).includes("First Law"), nomi(r).join(","));
    // l'autore da un libro solo resta come sempre fra i soli: un'intestazione
    // con sotto un dorso costa due righe per non dire niente
    t.eq("l'autore da un libro solo sta fra i soli", titoli(scarto(r)).join(""), "Piranesi");
    t.eq("e il mucchio si chiama «Volumi soli»", scarto(r)?.nome, "Volumi soli");
  }
  {
    // UNA SAGA A VENTI MANI è il caso che «Saga e autore» nasconde: lì
    // sarebbe un ripiano solo, qui torna a dire chi ha scritto cosa
    const r = disponi(
      [
        libro("Horus Rising", "Dan Abnett", "Horus Heresy", 1),
        libro("False Gods", "Graham McNeill", "Horus Heresy", 2),
        libro("Galaxy in Flames", "Ben Counter", "Horus Heresy", 3),
        libro("Legion", "Dan Abnett", "Horus Heresy", 7),
      ],
      null,
      "autore"
    );
    t.eq("Abnett esce dal mucchio della saga", titoli(r.find((x) => x.nome === "Dan Abnett")).join(" · "), "Horus Rising · Legion");
    t.eq("…e gli altri due, da un libro ciascuno, stanno fra i soli", scarto(r).libri.length, 2);
  }

  // ---- LA TRAPPOLA: due saghe dello stesso autore non si interlacciano --
  {
    const r = disponi(
      [
        libro("The Way of Kings", "Brandon Sanderson", "Stormlight", 1),
        libro("Mistborn", "Brandon Sanderson", "Mistborn", 1),
        libro("Words of Radiance", "Brandon Sanderson", "Stormlight", 2),
        libro("The Well of Ascension", "Brandon Sanderson", "Mistborn", 2),
      ],
      null,
      "autore"
    );
    const ripiano = r.find((x) => x.nome === "Brandon Sanderson");
    // sul solo numero uscirebbe: Way of Kings · Mistborn · Words · Well
    t.eq(
      "ogni saga resta tutta attaccata",
      titoli(ripiano).join(" · "),
      "Mistborn · The Well of Ascension · The Way of Kings · Words of Radiance"
    );
    // e i sotto-ripiani sono le sue saghe, come i cicli dentro una saga
    t.eq("il ripiano si divide nelle sue saghe", ripiano.cicli?.length, 2);
    t.eq("…col nome della saga", ripiano.cicli.map((c) => c.nome).join(" | "), "Mistborn | Stormlight");
  }
  {
    // un autore che di saghe non ne ha non si divide in niente
    const r = disponi([libro("Good Omens", "Neil Gaiman"), libro("American Gods", "Neil Gaiman")], null, "autore");
    t.eq("senza saghe nessun sotto-ripiano", r[0].cicli, null);
  }

  // ---- i sotto-ripiani si raccolgono sul campo che si chiede ------------
  {
    const libri = [
      libro("The Blade Itself", "Joe Abercrombie", "Circle of the World", 1, "The First Law"),
      libro("A Little Hatred", "Joe Abercrombie", "Circle of the World", 8, "The Age of Madness"),
    ];
    t.eq("per `series` sono i cicli", raccogliCicli(libri).map((c) => c.nome).join("|"), "The First Law|The Age of Madness");
    t.eq("per `saga` sono le saghe", raccogliCicli(libri, "saga").map((c) => c.nome).join("|"), "Circle of the World");
    t.eq("e un campo che nessuno compila torna `null`", raccogliCicli(libri, "genere"), null);
  }

  // ---- dentro una saga il criterio non cambia niente --------------------
  {
    // la saga è una sola, quindi il confronto sul nome della saga collassa
    // e comanda il numero di lettura, come è sempre stato
    const dentro = [
      libro("Last Argument of Kings", "Joe Abercrombie", "First Law", 3),
      libro("The Blade Itself", "Joe Abercrombie", "First Law", 1),
      libro("Before They Are Hanged", "Joe Abercrombie", "First Law", 2),
    ];
    for (const per of ["auto", "saga"]) {
      const r = disponi(dentro, null, per);
      t.eq(
        `«${per}»: l'ordine di lettura comanda`,
        titoli(r[0]).join(" · "),
        "The Blade Itself · Before They Are Hanged · Last Argument of Kings"
      );
    }
  }
}
