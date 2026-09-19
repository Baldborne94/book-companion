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
import { prossimiPassi, nextInSaga, numeriMescolati } from "../src/lib/saga.js";
import { rigaDiario, buildDiary } from "../src/lib/diary.js";
import { rigaGiardino, conta, raccogli } from "../src/lib/citazioni.js";

// lo storage finto: il `progressoOf` di `prossimiPassi` ha per default il
// `getProgress` vero, che legge `localStorage`. Senza questa riga il file
// passa nel giro completo — un altro test lascia il suo stub sul
// `globalThis` — e casca da solo: verde per l'ORDINE dei file.
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

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
    t.eq(
      "…e il libro proposto è quello di `nextInSaga`",
      primo.libro.id,
      nextInSaga(primo.da, LIBRI, statusOf, () => 0).id
    );
  }

  // ---- IL PROGRESSO VALE QUANTO LO STATO ---------------------------------
  {
    // Segnalato con l'Ingresso in mano: «Moving Pictures» compariva fra i
    // libri in corso E fra i prossimi passi. Un romanzo aperto e lasciato a
    // metà, senza mai dichiarare «in lettura», risultava intatto: non faceva
    // da riferimento, e si proponeva da solo come passo successivo.
    const aperto = (id) => (id === "d3" ? 0.27 : 0);
    const p = prossimiPassi(LIBRI, { statusOf, progressoOf: aperto });
    t.c("un volume al 27% non si propone", !ids(p).includes("d3"), ids(p));
    // e fa da riferimento: il passo dopo è quello che lo segue
    t.c("…e conta come «già lì», quindi il passo dopo è il suo", ids(p).includes("m2"), ids(p));
  }
  {
    // il progresso da solo apre il filo: una saga dove non hai dichiarato
    // niente ma un volume l'hai aperto è una saga cominciata
    const soli = [L("s1", "Ombre", 1), L("s2", "Ombre", 2)];
    const p = prossimiPassi(soli, { statusOf: () => "unread", progressoOf: (id) => (id === "s1" ? 0.4 : 0) });
    t.eq("il solo progresso apre il filo", ids(p), "s2");
  }
  {
    // L'ABBANDONATO NON APRE NIENTE: quella storia l'hai lasciata apposta,
    // e proporne il seguito è il difetto per cui quello stato esiste.
    //
    // E IL CASO CHE CONTA È L'ABBANDONATO CON DEL PROGRESSO ADDOSSO, che è
    // come succede davvero: si molla un romanzo a metà, non a pagina zero.
    // Con progresso zero lo tiene fuori già «non l'hai cominciato», e la
    // guardia sullo stato non viene nemmeno raggiunta (mutazione provata).
    const soli = [L("s1", "Ombre", 1), L("s2", "Ombre", 2)];
    const mollato = (id) => (id === "s1" ? "abandoned" : "unread");
    const aMeta = (id) => (id === "s1" ? 0.46 : 0);
    t.eq(
      "una saga solo abbandonata non propone niente",
      prossimiPassi(soli, { statusOf: mollato, progressoOf: aMeta }).length,
      0
    );
  }

  // ---- IL CICLO, NON LA SAGA ---------------------------------------------
  {
    // IL CASO DELLA SEGNALAZIONE: «sanderson mi sta suggerendo il numero 4
    // del cosmoverso a caso». Una saga grande tiene più storie, e dentro una
    // saga così i numeri si INTERLACCIANO — due cicli numerati tutt'e due da
    // uno. Col solo `sagaOrder` il «più avanti» salta da una storia
    // all'altra e propone un volume che col filo che hai in mano non
    // c'entra niente.
    const C = (id, ciclo, n) => ({ ...L(id, "Cosmoverse", n), series: ciclo });
    const cosmo = [
      C("mb1", "Mistborn", 1),
      C("mb2", "Mistborn", 2),
      C("mb3", "Mistborn", 3),
      C("sl1", "Stormlight", 1),
      C("sl4", "Stormlight", 4),
    ];
    // ha letto i primi due Mistborn: il passo è il TERZO Mistborn
    const letti = (id) => (id === "mb1" || id === "mb2" ? "read" : "unread");
    const p = prossimiPassi(cosmo, { statusOf: letti });
    t.eq("il passo resta dentro il ciclo", ids(p), "mb3");
    t.c("…e non salta all'altra storia", !ids(p).includes("sl4"), ids(p));
    // e il nome mostrato è quello del ciclo: «Cosmoverse n° 3» non si può
    // verificare a occhio, «Mistborn n° 3» sì
    t.eq("il nome è quello del ciclo", p[0].nome, "Mistborn");

    // LA FOTOGRAFIA DEL LETTORE, ALLA LETTERA. Finito il ciclo che aveva in
    // mano (tutti e tre i Mistborn) e mai aperta la Folgoluce, il «più
    // avanti» della SAGA era il numero 3, e il primo non letto dopo di lui
    // era «Rhythm of War» — il numero 4 di un'ALTRA storia. Dentro il ciclo
    // non resta niente da proporre, ed è la risposta giusta: quel filo l'hai
    // finito, e la Folgoluce non l'hai ancora cominciata.
    const finiti = (id) => (id.startsWith("mb") ? "read" : "unread");
    const q = prossimiPassi(cosmo, { statusOf: finiti });
    t.c("finito il ciclo non si salta all'altro", !ids(q).includes("sl4"), ids(q));
    t.eq("…e non si propone niente", q.length, 0);
  }
  {
    // DUE CICLI COMINCIATI FANNO DUE PASSI, ed è giusto: chi legge Mistborn
    // e la Folgoluce insieme ha due fili in mano.
    const C = (id, ciclo, n) => ({ ...L(id, "Cosmoverse", n), series: ciclo });
    const cosmo = [C("mb1", "Mistborn", 1), C("mb2", "Mistborn", 2), C("sl1", "Stormlight", 1), C("sl2", "Stormlight", 2)];
    const letti = (id) => (id === "mb1" || id === "sl1" ? "read" : "unread");
    const p = prossimiPassi(cosmo, { statusOf: letti, tocco: (id) => (id === "sl1" ? 100 : 1) });
    t.eq("un passo per ciclo, il più toccato per primo", ids(p), "sl2+mb2");
  }
  {
    // UNA SAGA SENZA CICLI NON CAMBIA DI UNA VIRGOLA: lì i due
    // raggruppamenti coincidono, ed è il caso più comune.
    const p = prossimiPassi(LIBRI, { statusOf });
    t.eq("senza cicli resta la saga", ids(p), "d3+m2");
    t.eq("…e il nome è quello della saga", p[0].nome, "Discworld");
  }
  {
    // LE MAIUSCOLE NON FANNO UN ALTRO CICLO, e il caso che lo dimostra vuole
    // DUE volumi cominciati con due grafie: con uno solo il raggruppamento
    // non conta, perché il candidato si cerca comunque senza guardare le
    // maiuscole e la risposta viene giusta per caso (mutazione provata).
    // Separati, quei due fili proporrebbero lo stesso volume due volte.
    const C = (id, ciclo, n) => ({ ...L(id, "Cosmoverse", n), series: ciclo });
    const cosmo = [C("a", "Mistborn", 1), C("b", "mistborn", 2), C("c", "MISTBORN", 3)];
    const letti = (id) => (id === "a" || id === "b" ? "read" : "unread");
    t.eq("una grafia diversa non è un altro ciclo", ids(prossimiPassi(cosmo, { statusOf: letti })), "c");
  }

  // ---- E SE IL CAMPO «SERIE» È VUOTO, LO DICONO I NUMERI ------------------
  {
    // LA CURA DEL CICLO FUNZIONA SOLO SE IL CICLO È SCRITTO, e quel campo lo
    // riempiono le tavole (Mondo Disco, Eresia) o il lettore a mano: su
    // Sanderson — che nessuna tavola conosce — è quasi sempre vuoto, e la
    // fotografia della segnalazione tornerebbe identica. Misurato prima di
    // curare: col campo pieno niente (giusto), col campo VUOTO «Rhythm of
    // War — Cosmoverse n° 4».
    //
    // Il secondo segnale è già nei dati: due TITOLI DIVERSI con lo stesso
    // numero di lettura non sono una fila, sono due storie numerate ognuna
    // da uno. Non si indovina quale filo hai in mano: si tace.
    const N = (id, n) => L(id, "Cosmoverse", n);
    const cosmo = [N("mb1", 1), N("mb2", 2), N("mb3", 3), N("sl1", 1), N("sl4", 4)];
    const letti = (id) => (id.startsWith("mb") ? "read" : "unread");
    const p = prossimiPassi(cosmo, { statusOf: letti });
    t.c("col campo Serie vuoto non si salta all'altra storia", !ids(p).includes("sl4"), ids(p));
    t.eq("…e non si propone niente", p.length, 0);
    // e non si propone niente NEMMENO a metà del primo filo: il numero non
    // è una fila, quindi «il prossimo» non esiste da nessuna parte
    const meta = (id) => (id === "mb1" ? "read" : "unread");
    t.eq("nemmeno a metà del filo", prossimiPassi(cosmo, { statusOf: meta }).length, 0);
  }
  {
    // UNA SAGA CHE NUMERA DRITTO NON SI TOCCA, ed è il caso comune: la
    // guardia deve tacere dove i numeri sono una fila sola.
    const p = prossimiPassi(LIBRI, { statusOf });
    t.eq("i numeri in fila non silenziano niente", ids(p), "d3+m2");
    const conBuco = [L("a", "Saga", 1), L("b", "Saga", 3), L("c", "Saga", 7)];
    t.eq(
      "e nemmeno i buchi nella numerazione",
      ids(prossimiPassi(conBuco, { statusOf: (id) => (id === "a" ? "read" : "unread") })),
      "b"
    );
  }
  {
    // DUE COPIE DELLO STESSO TITOLO NON SONO DUE STORIE: due edizioni, o un
    // doppione dichiarato, condividono il numero perché sono lo stesso
    // volume — e quel caso ha già la sua regola («a pari ordine vince chi è
    // arrivato prima»). Si confrontano i TITOLI, non gli id: guardando gli
    // id questa saga si zittirebbe da sola.
    const doppia = [
      L("a", "Saga", 1),
      { ...L("b", "Saga", 2), title: "Il secondo" },
      { ...L("b2", "Saga", 2), title: "Il secondo" },
    ];
    t.eq(
      "due edizioni dello stesso volume non silenziano la saga",
      ids(prossimiPassi(doppia, { statusOf: (id) => (id === "a" ? "read" : "unread") })),
      "b"
    );
    // e le maiuscole non fanno due titoli
    const maiuscole = [
      L("a", "Saga", 1),
      { ...L("b", "Saga", 2), title: "Il Secondo" },
      { ...L("b2", "Saga", 2), title: "il secondo " },
    ];
    t.eq(
      "né le maiuscole",
      ids(prossimiPassi(maiuscole, { statusOf: (id) => (id === "a" ? "read" : "unread") })),
      "b"
    );
  }
  {
    // E COL CICLO DICHIARATO LA GUARDIA NON DEVE ZITTIRE NIENTE: i numeri
    // doppi sono quel che ci si aspetta lì — è proprio la loro presenza ad
    // aver reso necessario il raggruppamento — e il filtro per ciclo li ha
    // già separati, quindi la domanda arriva a una fila pulita. Zittire
    // anche qui butterebbe via la cura di ieri.
    const C = (id, ciclo, n) => ({ ...L(id, "Cosmoverse", n), series: ciclo });
    const cosmo = [C("mb1", "Mistborn", 1), C("mb2", "Mistborn", 2), C("sl1", "Stormlight", 1), C("sl4", "Stormlight", 4)];
    const letti = (id) => (id === "mb1" ? "read" : "unread");
    t.eq("col ciclo dichiarato i numeri doppi non zittiscono", ids(prossimiPassi(cosmo, { statusOf: letti })), "mb2");
  }
  {
    // I VOLUMI SENZA NUMERO NON VOTANO: due tomi a cui nessuno ha dato un
    // posto non sono due storie, sono due tomi senza posto — e `nextInSaga`
    // li scarta già per conto suo. Contandoli, ogni saga con due volumi da
    // sistemare si zittirebbe da sola, cioè proprio quella che ha bisogno
    // di aiuto.
    const conIgnoti = [L("a", "Saga", 1), L("b", "Saga", 2), L("x", "Saga", null), L("y", "Saga", null)];
    t.eq(
      "due volumi senza numero non sono due storie",
      ids(prossimiPassi(conIgnoti, { statusOf: (id) => (id === "a" ? "read" : "unread") })),
      "b"
    );
    // e la funzione risponde anche chiamata da sola: la saga è obbligatoria,
    // o si confronterebbero i numeri di tutta la biblioteca. Il caso che
    // rende portante quella riga vuole i libri SENZA saga: senza il
    // controllo il filtro li lascerebbe passare tutti e due, e due romanzi a
    // sé numerati uno risulterebbero «due storie».
    const senzaSaga = [L("a", "", 1), L("b", "", 1)];
    t.eq("senza il nome della saga non si giudica", numeriMescolati(senzaSaga, ""), false);
    t.eq("…nemmeno con la saga fatta di spazi", numeriMescolati(senzaSaga, "   "), false);
    t.eq("una saga che non c'è non è mescolata", numeriMescolati(conIgnoti, "Altra"), false);
    t.eq(
      "e due titoli sullo stesso numero sì",
      numeriMescolati([L("a", "Saga", 1), L("b", "Saga", 1)], "Saga"),
      true
    );
    // gli spazi attorno al nome non fanno un'altra saga, qui come ovunque
    t.eq(
      "gli spazi attorno al nome non contano",
      numeriMescolati([L("a", "Saga", 1), L("b", "Saga", 1)], "  Saga  "),
      true
    );
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
