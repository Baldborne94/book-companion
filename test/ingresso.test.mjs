// L'INGRESSO DICE TRE COSE IN PIÙ, E TUTT'E TRE SBAGLIANO IN SILENZIO.
//
// Chiesto dal lettore («nella schermata principale, oltre al libro che sto
// leggendo, le citazioni e il diario, cosa ha senso vedere») e scelte tutte
// e tre: gli altri libri in corso, il prossimo passo di ogni saga, e il
// numero sulle due porte.
//
// Qui non casca niente da sé: una fila che propone il volume sbagliato di
// una saga è uno SPOILER servito dall'app, e una porta che scrive «1 libri»
// o «0 citazioni» si legge e basta.
import { prossimiPassi, nextInSaga } from "../src/lib/saga.js";
import { rigaDiario, buildDiary } from "../src/lib/diary.js";
import { rigaGiardino, conta, raccogli } from "../src/lib/citazioni.js";

const L = (id, saga, ordine, extra = {}) => ({ id, title: id, saga, sagaOrder: ordine, ...extra });

// la biblioteca di prova: due saghe cominciate, una mai aperta, un romanzo
// a sé
const LIBRI = [
  L("d1", "Discworld", 1),
  L("d2", "Discworld", 2),
  L("d3", "Discworld", 3),
  L("m1", "Malazan", 1),
  L("m2", "Malazan", 2),
  L("w1", "Wheel of Time", 1),
  L("solo", "", null),
];
const STATI = { d1: "read", d2: "read", m1: "reading" };
const statusOf = (id) => STATI[id] || "unread";
const ids = (p) => p.map((x) => x.libro.id).join("+");

export default async function (t) {
  // ---- IL PROSSIMO PASSO -------------------------------------------------
  {
    const p = prossimiPassi(LIBRI, { statusOf });
    t.eq("una proposta per saga cominciata", ids(p), "d3+m2");
    t.c("…e ognuna dice di quale saga è", p.every((x) => x.saga), JSON.stringify(p.map((x) => x.saga)));
  }
  {
    // SOLO LE SAGHE GIÀ COMINCIATE. «Wheel of Time» è in biblioteca e non
    // l'hai mai aperta: proporne il primo volume non è riprendere un filo,
    // è un consiglio di lettura — e quello lo fa la Libreria.
    const p = prossimiPassi(LIBRI, { statusOf });
    t.c("una saga mai aperta non entra", !ids(p).includes("w1"), ids(p));
  }
  {
    // IL RIFERIMENTO È IL PIÙ AVANTI CHE HAI TOCCATO, non l'ultimo che si
    // incontra scorrendo la biblioteca — e i due divergono spesso, perché
    // i libri stanno in ordine d'INGRESSO e non di lettura: il volume più
    // avanti può benissimo essere entrato per primo.
    //
    // Il caso che separa le due regole vuole un BUCO: letti il 3 e il 1,
    // saltato il 2. Dal più avanti si propone il 4; dall'ultimo incontrato
    // si tornerebbe al 2 — e «un volume precedente lasciato indietro non è
    // il prossimo» è la regola dichiarata di `nextInSaga`. Senza il buco la
    // mutazione sopravvive: provata.
    const fuoriOrdine = [L("x3", "Ombre", 3), L("x1", "Ombre", 1), L("x2", "Ombre", 2), L("x4", "Ombre", 4)];
    const letti = { x3: "read", x1: "read" };
    const p = prossimiPassi(fuoriOrdine, { statusOf: (id) => letti[id] || "unread" });
    t.eq("comanda il volume più avanti, non l'ultimo incontrato", ids(p), "x4");
  }
  {
    // e rileggendo un volume indietro la proposta non torna indietro con te
    const rilettura = { ...STATI, d1: "reading" };
    const p = prossimiPassi(LIBRI, { statusOf: (id) => rilettura[id] || "unread" });
    t.c("rileggendo, la proposta resta avanti", ids(p).includes("d3"), ids(p));
    t.c("…e non torna su un volume già letto", !ids(p).includes("d2"), ids(p));
  }
  {
    // una saga finita non ha un passo dopo, e non si dice niente
    const tutti = { d1: "read", d2: "read", d3: "read" };
    const p = prossimiPassi(LIBRI, { statusOf: (id) => tutti[id] || "unread" });
    t.c("una saga finita sparisce dalla fila", !ids(p).includes("d"), ids(p));
  }
  {
    // SENZA NUMERO NON SI INDOVINA: è la guardia di `nextInSaga`, e vale
    // anche di qui — in una saga il volume sbagliato è uno spoiler.
    const senzaPosto = [L("x1", "Ombre", 1), L("x2", "Ombre", null)];
    const p = prossimiPassi(senzaPosto, { statusOf: (id) => (id === "x1" ? "read" : "unread") });
    t.eq("un volume senza posto non si propone", p.length, 0);
  }
  {
    // IL LIBRO CHE STA GIÀ IN CIMA NON SI RIPETE due righe più sotto
    const p = prossimiPassi(LIBRI, { statusOf, escludi: "d3" });
    t.eq("l'escluso non entra", ids(p), "m2");
  }
  {
    // L'ORDINE È L'ULTIMO TOCCO: la saga che stai leggendo stasera sta per
    // prima. Con l'alfabeto, «Discworld» vincerebbe comunque: il caso che
    // conta è quello dove i due ordini si contraddicono.
    const tocco = (id) => ({ d1: 10, d2: 20, m1: 900 })[id] || 0;
    t.eq("comanda l'ultimo tocco sulla saga", ids(prossimiPassi(LIBRI, { statusOf, tocco })), "m2+d3");
  }
  {
    // E IL TOCCO DELLA SAGA È IL PIÙ RECENTE DEI SUOI, non quello del primo
    // volume che si incontra: qui Discworld va in testa per merito di `d2`,
    // che si legge DOPO `d1`. Col primo volume a comandare, Discworld
    // varrebbe 1 e finirebbe in coda — e la mutazione passa se il massimo
    // sta già sul primo libro della saga (provata).
    const tocco = (id) => ({ d1: 1, d2: 999, m1: 500 })[id] || 0;
    t.eq("il tocco della saga è il più recente", ids(prossimiPassi(LIBRI, { statusOf, tocco })), "d3+m2");
  }
  {
    // A PARITÀ DECIDE L'ALFABETO, o due saghe ferme allo stesso istante
    // cambierebbero posto a ogni apertura. L'ordine della biblioteca deve
    // CONTRADDIRE l'alfabeto, se no il `sort` stabile dà la risposta giusta
    // per caso e la mutazione sopravvive (provata): qui Malazan sta prima.
    const mescolati = [L("m1", "Malazan", 1), L("m2", "Malazan", 2), L("d1", "Discworld", 1), L("d2", "Discworld", 2)];
    const p = prossimiPassi(mescolati, { statusOf: (id) => (id === "m1" || id === "d1" ? "read" : "unread"), tocco: () => 5 });
    t.eq("a parità, l'alfabeto", ids(p), "d2+m2");
  }
  {
    // una biblioteca senza saghe non produce niente, e non esplode
    t.eq("nessuna saga, nessuna proposta", prossimiPassi([L("solo", "", null)], { statusOf }).length, 0);
    t.eq("nessun libro, nessuna proposta", prossimiPassi().length, 0);
  }
  {
    // la fila dice anche DA DOVE viene la proposta: serve al riquadro e
    // sarebbe la prima cosa a marcire in silenzio
    const [primo] = prossimiPassi(LIBRI, { statusOf });
    t.eq("porta il volume di riferimento", primo.da.id, "d2");
    t.eq("…e il libro proposto è quello di `nextInSaga`", primo.libro.id, nextInSaga(primo.da, LIBRI, statusOf).id);
  }

  // ---- LA PORTA DEL DIARIO ----------------------------------------------
  {
    const anno = (y, n) => ({ year: y, entries: Array.from({ length: n }, (_, i) => ({ i })) });
    const d = { years: [anno(2026, 12), anno(2025, 30)], total: 42 };
    t.eq("prima l'anno in corso", rigaDiario(d, 2026), "Quest'anno hai finito 12 libri");
    // il singolare si scrive a mano: «1 libri» si legge come un guasto
    t.eq("uno solo, al singolare", rigaDiario({ years: [anno(2026, 1)], total: 1 }, 2026), "Quest'anno hai finito 1 libro");
  }
  {
    // A GENNAIO non si tace: il totale è comunque suo, ed è meglio di una
    // descrizione che non dice niente di lui
    const d = { years: [{ year: 2025, entries: [{}, {}] }], total: 2 };
    t.eq("niente quest'anno, si ripiega sul totale", rigaDiario(d, 2026), "2 libri finiti in tutto");
    t.eq("…e anche lì il singolare", rigaDiario({ years: [], total: 1 }, 2026), "1 libro finito in tutto");
  }
  {
    // GLI ZERI NON SI DICONO: `null` fa tenere alla porta la descrizione di
    // sempre. Una porta che scrive «0 libri» a ogni apertura si impara a
    // non leggere, e non la si legge nemmeno il giorno che il numero arriva.
    t.c("niente di finito, nessuna riga", rigaDiario({ years: [], total: 0 }, 2026) === null);
    t.c("…e nessun diario affatto", rigaDiario(null, 2026) === null);
    t.c("…né un diario senza campi", rigaDiario({}, 2026) === null);
  }
  {
    // LA CATENA VERA, da `buildDiary` alla riga: è l'unico modo di vedere
    // che i campi che la frase legge sono quelli che il diario scrive
    const libri = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const q = (y) => new Date(`${y}-06-01`).getTime();
    const date = {
      a: { finished: q(2026), started: q(2026), status: "read" },
      b: { finished: q(2026), started: q(2026), status: "read" },
      c: { finished: q(2024), started: q(2024), status: "read" },
    };
    const riga = rigaDiario(buildDiary(libri, (id) => date[id]), 2026);
    t.eq("il giro intero", riga, "Quest'anno hai finito 2 libri");
    // e un abbandonato non conta come finito, nemmeno se una data di fine
    // gliel'ha lasciata addosso un dispositivo rimasto indietro
    const mollato = { ...date, b: { ...date.b, status: "abandoned" } };
    t.eq("l'abbandonato non entra nel conto", rigaDiario(buildDiary(libri, (id) => mollato[id]), 2026), "Quest'anno hai finito 1 libro");
  }

  // ---- LA PORTA DEL GIARDINO --------------------------------------------
  {
    t.eq("quante e da quanti", rigaGiardino({ citazioni: 417, libri: 23 }), "417 citazioni da 23 libri");
    t.eq("una sola, e da un libro solo", rigaGiardino({ citazioni: 1, libri: 1 }), "1 citazione da 1 libro");
    t.c("nessuna citazione, nessuna riga", rigaGiardino({ citazioni: 0, libri: 0 }) === null);
    t.c("…e senza argomenti non esplode", rigaGiardino() === null);
  }
  {
    // LA CATENA, come per il diario: `raccogli` scarta i libri senza niente
    // dentro, quindi «da N libri» conta i libri che una citazione ce l'hanno
    // davvero — non tutta la biblioteca.
    const libri = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const evid = { a: [{ text: "una" }, { text: "due" }], b: [], c: [{ text: "tre" }] };
    const riga = rigaGiardino(conta(raccogli(libri, (id) => ({ highlights: evid[id] }))));
    t.eq("il giro intero", riga, "3 citazioni da 2 libri");
  }
  {
    // I SEGNALIBRI NON SI CONTANO. Nel giardino a riposo non compaiono —
    // le loro etichette se le scrive l'app — quindi contarli qui direbbe un
    // numero che poi lì dentro non si ritrova.
    const libri = [{ id: "a" }];
    const con = raccogli(libri, () => ({ highlights: [{ text: "una" }], marks: [{ label: "cap. 3" }] }));
    t.eq("i segni restano fuori dal conto", rigaGiardino(conta(con)), "1 citazione da 1 libro");
  }
}
