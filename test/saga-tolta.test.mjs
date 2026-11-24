// UNA SAGA TOLTA A MANO RESTA TOLTA.
//
// Segnalato dal lettore per la SECONDA volta sullo stesso libro, con lo
// scaffale in mano: «devi smettere di dedurre automaticamente che Between
// Two Fires fa parte della saga The Blacktongue Thief». La prima cura —
// la veto del catalogo (`senzaTraccia`) — era giusta e non bastava: un tomo
// che una saga ce l'ha non viene MAI chiesto al catalogo, quindi appena
// svuotato il campo non c'è nessuna memoria che lo fermi, e su un tablet
// senza rete non ci sarà mai.
//
// QUI NON CASCA NIENTE DA SÉ, ed è la ragione per cui questo file esiste:
// una saga riscritta addosso a un romanzo a sé non alza nessun errore —
// si vede sullo scaffale, se si guarda, e intanto allarga la frontiera di
// «Chi è costui?», riassume in «Prima di cominciare» libri che non
// c'entrano, e mescola due glossari.
import {
  nienteSaga,
  scritturaSaga,
  sagaDaBiblioteca,
  deduciSaghe,
  ripassa,
} from "../src/lib/sagaBooks.js";
import { rowFromLocal, localFromRow, normalizeRow, DEGRADE } from "../src/lib/syncCore.js";

// i tre Buehlman della sua fotografia: due con la saga letta dal file, il
// terzo un romanzo a sé
const BUEHLMAN = (tolta) => [
  { id: "bt1", title: "The Blacktongue Thief", author: "Christopher Buehlman", saga: "The Blacktongue Thief", sagaOrder: 1 },
  { id: "bt2", title: "The Daughters' War", author: "Christopher Buehlman", saga: "The Blacktongue Thief", sagaOrder: 2 },
  { id: "btf", title: "Between Two Fires", author: "Christopher Buehlman", saga: "", ...(tolta ? { sagaTolta: true } : {}) },
];

export default async function (t) {
  // ---- IL SEGNO PARLA SOLO DEL VUOTO ------------------------------------
  {
    t.c("un libro senza niente non è «saga tolta»", !nienteSaga({ id: "x" }));
    t.c("col segno e il campo vuoto, sì", nienteSaga({ id: "x", sagaTolta: true }));
    // UN SEGNO RIMASTO ADDOSSO NON PUÒ SPEGNERE UNA SAGA VIVA: se una saga
    // c'è — riscritta qui o arrivata dall'altro dispositivo — comanda lei.
    t.c(
      "ma col segno E una saga scritta, comanda la saga",
      !nienteSaga({ id: "x", sagaTolta: true, saga: "Malazan" })
    );
    t.c("e gli spazi non sono una saga", nienteSaga({ id: "x", sagaTolta: true, saga: "   " }));
  }

  // ---- QUEL CHE SCRIVE LA SCHEDA ----------------------------------------
  {
    // svuotare un campo che conteneva qualcosa È il gesto
    const r = scritturaSaga({ saga: "The Blacktongue Thief" }, "");
    t.eq("svuotando, la saga se ne va", r.saga, "");
    t.c("…e il segno si accende", r.sagaTolta === true);
  }
  {
    const r = scritturaSaga({ saga: "", sagaTolta: true }, "Malazan");
    t.eq("riscrivendola, la saga torna", r.saga, "Malazan");
    // `false` e non un campo tolto: deve poter spegnere un `true` sceso
    // dall'altro dispositivo, come il cuore dei preferiti
    t.c("…e il segno si spegne, scritto false", r.sagaTolta === false);
  }
  {
    // APRIRE LA SCHEDA E CHIUDERLA NON È UN GESTO. Senza questa riga
    // bastava aprire la scheda di un libro senza saga per cancellare la
    // scelta di ieri — in silenzio, e con la saga di ritorno al giro dopo.
    const r = scritturaSaga({ saga: "", sagaTolta: true }, "");
    t.c("una scheda aperta e chiusa non spegne il segno", r.sagaTolta === true);
    const mai = scritturaSaga({ saga: "" }, "");
    t.c("…e su chi una saga non l'ha mai avuta non accende niente", mai.sagaTolta === false);
  }
  {
    const r = scritturaSaga({ saga: "Malazan" }, "  Malazan  ");
    t.eq("gli spazi ai bordi si tolgono", r.saga, "Malazan");
    t.c("…e non è un gesto di rimozione", r.sagaTolta === false);
  }

  // ---- LE CINQUE STRADE TACCIONO ----------------------------------------
  {
    // LA DEDUZIONE DAI FRATELLI, che è quella che ha sbagliato: due
    // Buehlman su due dicono «The Blacktongue Thief», e la regola timida la
    // trova unanime. È il caso della fotografia.
    const [, , btf] = BUEHLMAN(false);
    t.eq(
      "senza il segno la deduzione gliela dà ancora (è il difetto vero)",
      sagaDaBiblioteca(btf, BUEHLMAN(false)),
      "The Blacktongue Thief"
    );
    const [, , tolto] = BUEHLMAN(true);
    t.c("col segno, la deduzione tace", sagaDaBiblioteca(tolto, BUEHLMAN(true)) === null);
  }
  {
    // e la passata automatica non lo tocca affatto
    const dedotte = deduciSaghe(BUEHLMAN(true));
    t.eq("la passata non scrive niente", Object.keys(dedotte.campi).length, 0);
    t.eq("…e non lo conta fra le dedotte", dedotte.dedotte, 0);
    const senza = deduciSaghe(BUEHLMAN(false));
    t.eq("senza il segno invece scriverebbe", senza.dedotte, 1);
  }
  {
    // IL TITOLO. «02 Valour» scrive il posto, e la forma piena scrive la
    // saga: nessuna delle due deve riaprire un campo chiuso a mano.
    const libri = [
      { id: "a", title: "Malice: The Faithful and the Fallen Series Book 1", author: "John Gwynne", saga: "", sagaTolta: true },
    ];
    t.eq("il titolo non riscrive una saga tolta", Object.keys(deduciSaghe(libri).campi).length, 0);
    const senza = [{ ...libri[0], sagaTolta: false }];
    t.eq("…mentre senza il segno la legge", deduciSaghe(senza).dalTitolo, 1);
  }
  {
    // LA TAVOLA, cioè il tasto «Riconosci saghe e cicli». Il Mondo Disco lo
    // riconosce per titolo, e se il lettore ha detto di no comanda lui —
    // niente saga e niente ciclo, che senza la sua saga non vuol dire
    // niente.
    const pratchett = { id: "p", title: "Guards! Guards!", author: "Terry Pratchett", saga: "" };
    t.c("la tavola riconosce il libro", !!ripassa(pratchett, [pratchett])?.campi.saga);
    t.c(
      "…e tace se la saga è stata tolta a mano",
      ripassa({ ...pratchett, sagaTolta: true }, [pratchett]) === null
    );
  }
  {
    // e la deduzione passata dal tasto tace come quella della passata
    const [, , tolto] = BUEHLMAN(true);
    t.c("anche la deduzione del tasto tace", ripassa(tolto, BUEHLMAN(true)) === null);
  }

  // ---- IL SEGNO VIAGGIA --------------------------------------------------
  {
    // se non sale, l'altro dispositivo la rimette al primo giro: è la
    // stessa lezione del cuore dei preferiti
    const stato = { status: "reading", progress: 0.44 };
    const riga = rowFromLocal({ id: "btf", title: "Between Two Fires", sagaTolta: true }, stato, 7);
    t.c("la saga tolta sale", riga.saga_tolta === true);
    // e `false` deve poter spegnere un `true` sceso da lassù: se il campo
    // sparisse, l'altro dispositivo terrebbe il segno per sempre
    const acceso = rowFromLocal({ id: "x", title: "X" }, stato, 7);
    t.c("…e chi non ce l'ha manda false, non niente", acceso.saga_tolta === false);
    t.c("scendendo torna un segno", localFromRow({ id: "btf", saga_tolta: true }).book.sagaTolta === true);
    // scendendo NON si inventa: `false` non deve scrivere un campo addosso
    // a tutti i libri, come per l'impronta e per il cuore
    t.c(
      "…e un false non si scrive addosso a nessuno",
      !("sagaTolta" in localFromRow({ id: "x", saga_tolta: false }).book)
    );
  }
  {
    // IL PATTO DELLE CHIAVI (vedi `test/lapidi.test.mjs`): una lapide con
    // meno colonne di una riga piena fa cascare l'INTERO invio, perché
    // PostgREST unisce le chiavi del lotto. Qui si guarda solo che la
    // colonna nuova sia passata da tutt'e due i posti.
    const piena = rowFromLocal({ id: "x", title: "X", sagaTolta: true }, {}, 1);
    t.c("`normalizeRow` conosce la colonna nuova", "saga_tolta" in normalizeRow({ id: "x" }));
    t.c("…e non la perde su una riga piena", normalizeRow(piena).saga_tolta === true);
  }
  {
    // LA SCALA DELLE RINUNCE, e l'ORDINE è la guardia: il gradino «genere e
    // saga» prova `/genre|saga/i`, che dentro «saga_tolta» ci sta — messo
    // davanti si porterebbe via genere, saga e numero lasciando in piedi la
    // colonna di cui il database si lamentava, e al secondo errore identico
    // non resterebbe nessun gradino (la stessa trappola del numero di
    // collana coi decimali).
    const msg = "Could not find the 'saga_tolta' column of 'books' in the schema cache";
    const righe = [{ id: "x", genre: "Fantasy", saga: "Malazan", saga_order: 1, saga_tolta: false }];
    const primo = DEGRADE.find((d) => d.test(msg, righe));
    t.eq("una colonna «saga_tolta» sceglie il suo gradino", primo.label, "saga tolta a mano");
    const dopo = primo.apply(righe);
    t.c("…che toglie solo lei", !("saga_tolta" in dopo[0]));
    t.eq("…e lascia la saga dov'era", dopo[0].saga, "Malazan");
    t.eq("…e il genere", dopo[0].genre, "Fantasy");
  }
}
