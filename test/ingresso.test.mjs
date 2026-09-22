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
import {
  prossimiPassi,
  nextInSaga,
  numeriMescolati,
  perchePassoTace,
  frasePassoTace,
  MOTIVI_PASSO,
} from "../src/lib/saga.js";
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
// tutt'e due le saghe cominciate con un volume FINITO: da quando «in
// lettura» non apre un filo, un `m1: "reading"` qui lascerebbe Malazan
// fuori da ogni caso a due saghe
const STATI = { d1: "read", d2: "read", m1: "read" };
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

  // ---- UN VOLUME APERTO NON È UN VOLUME LETTO ----------------------------
  //
  // Segnalato due volte con l'Ingresso in mano. La prima: «Moving Pictures»
  // compariva fra i libri in corso E fra i prossimi passi — un romanzo
  // aperto e lasciato a metà risultava intatto e si proponeva da solo. La
  // seconda, dopo la cura: «ha senso suggerire solo i libri successivi alle
  // saghe già iniziate e libri già letti, non volumi a caso» — «The Eye of
  // the World» in fila perché New Spring era stato aperto allo 0,4%, e
  // «Warrior Prophet» proposto col primo volume al 2%.
  //
  // La regola nuova sta tutta qui: apre un filo solo un volume FINITO, e il
  // passo dopo è quello che SEGUE l'ultimo letto — se lo stai leggendo, o
  // l'hai aperto e lasciato lì, non c'è niente da proporre: ce l'hai in mano.
  {
    // il 27% su `d3` non lo propone (era il primo difetto) e non fa nemmeno
    // saltare a un volume più in là: Discworld non propone niente
    const aperto = (id) => (id === "d3" ? 0.27 : 0);
    const p = prossimiPassi(LIBRI, { statusOf, progressoOf: aperto });
    t.c("un volume al 27% non si propone", !ids(p).includes("d3"), ids(p));
    t.eq("…e la sua saga tace, perché il passo dopo ce l'hai già in mano", ids(p), "m2");
  }
  {
    // un'apertura di passaggio NON apre il filo: New Spring allo 0,4% non
    // vuol dire che stai leggendo la Ruota del Tempo
    const soli = [L("s1", "Ombre", 1), L("s2", "Ombre", 2)];
    const p = prossimiPassi(soli, { statusOf: () => "unread", progressoOf: (id) => (id === "s1" ? 0.004 : 0) });
    t.eq("il solo progresso non apre il filo", p.length, 0);
    // e nemmeno «in lettura» da solo: il passo dopo lo stai facendo
    const inCorso = prossimiPassi(soli, { statusOf: (id) => (id === "s1" ? "reading" : "unread") });
    t.eq("una saga solo in lettura non ha ancora un passo dopo", inCorso.length, 0);
    // un volume FINITO sì
    t.eq("un volume finito apre il filo", ids(prossimiPassi(soli, { statusOf: (id) => (id === "s1" ? "read" : "unread") })), "s2");
  }
  {
    // IL RIFERIMENTO È IL PIÙ AVANTI FRA I LETTI, e un volume in lettura più
    // avanti non lo sposta: letto il primo, in lettura il terzo — il secondo
    // saltato non è «il prossimo» (si guarda solo avanti), e il terzo ce
    // l'hai in mano, quindi non c'è niente da proporre
    const tre = [L("a", "Ombre", 1), L("b", "Ombre", 2), L("c", "Ombre", 3), L("d", "Ombre", 4)];
    const stati = { a: "read", c: "reading" };
    t.eq(
      "in lettura più avanti non fa da riferimento",
      prossimiPassi(tre, { statusOf: (id) => stati[id] || "unread" }).length,
      0
    );
    // finito anche il terzo, il passo è il quarto
    const finiti = { a: "read", c: "read" };
    t.eq("finito, il passo è il suo seguito", ids(prossimiPassi(tre, { statusOf: (id) => finiti[id] || "unread" })), "d");
    // e un'apertura di passaggio più avanti NON è un riferimento: letto il
    // primo e il terzo sfogliato per un attimo, il passo resta il secondo
    // (col progresso a fare da riferimento, la saga tacerebbe: provato)
    t.eq(
      "il volume sfogliato più avanti non sposta il riferimento",
      ids(prossimiPassi(tre, { statusOf: (id) => (id === "a" ? "read" : "unread"), progressoOf: (id) => (id === "c" ? 0.3 : 0) })),
      "b"
    );
  }
  {
    // DUE STORIE COMINCIATE, DUE PASSI — e questo controllo è GIRATO di
    // proposito. Pinnava «coi numeri unici la saga è un filo solo»: la
    // regola durò un giorno, e l'ha disdetta il lettore guardando proprio
    // il Malazan («considera non tutto il ciclo ma la singola serie per
    // sapere cosa devo leggere dopo... era giusto suggerirmi i volumi
    // successivi alle serie che avevo già iniziato»). Qui ha in mano i
    // Kharkanas (k1 letto) e i senza-serie (x1 letto): sono due fili, e il
    // prossimo di ognuno è il prossimo della SUA storia, non il numero dopo.
    //
    // E lo stesso libro non si propone due volte, che era il difetto da cui
    // questo blocco è nato («Fall of Light» in fila due volte): i
    // senza-serie sono un gruppo a sé, quindi da x1 non si arriva a k2.
    const C = (id, ciclo, n) => ({ ...L(id, "Malazan", n), series: ciclo });
    const malazan = [C("k1", "Kharkanas", 7), C("k2", "Kharkanas", 8), C("x1", "", 5), C("x2", "", 6)];
    const stati = { k1: "read", x1: "read" };
    const p = prossimiPassi(malazan, { statusOf: (id) => stati[id] || "unread" });
    t.eq("due serie cominciate danno due passi", ids(p), "x2+k2");
    t.eq("il filo dei Kharkanas propone il suo", p.find((x) => x.ciclo === "Kharkanas").libro.id, "k2");
    t.eq("e i senza-serie il loro, senza scavalcare nell'altra storia", p.find((x) => !x.ciclo).libro.id, "x2");
    // IL NOME SEGUE IL NUMERO, NON IL GRUPPO: qui i numeri sono una fila
    // sola del Malazan, quindi «Malazan n° 8» — «Kharkanas n° 8» direbbe
    // «l'ottavo Kharkanas», e i Kharkanas sono tre.
    t.eq("…col nome della saga, che è il numero sul dorso", p[0].nome, "Malazan");
    t.eq("…tutt'e due", p[1].nome, "Malazan");
  }

  // ---- IL MONDO DISCO: UN PASSO PER OGNI CICLO COMINCIATO ----------------
  {
    // QUESTO BLOCCO È GIRATO, e il perché va letto prima di girarlo una
    // terza volta. Pinnava «letti i primi dieci, il prossimo è l'undicesimo
    // e basta»: l'aveva chiesto il lettore con quattro Pratchett in fila, e
    // l'ha disdetto lui stesso un giorno dopo, guardando il Malazan e un
    // Disco diventato muto («era giusto suggerirmi i volumi successivi alle
    // serie che avevo già iniziato»).
    //
    // Il numero e la serie rispondono a due domande diverse: il numero dice
    // in che ordine leggere, la serie dice di quale storia si parla. Chi ha
    // finito i primi dieci ha in mano cinque storie, e ognuna ha il suo
    // prossimo volume; il numero resta quello della saga, ed è per questo
    // che l'etichetta dice «Discworld» e non «Death» (vedi sotto).
    const D = (id, n, ciclo) => ({ ...L(id, "Discworld", n), series: ciclo });
    const disco = [
      D("cm", 1, "Rincewind"), D("lf", 2, "Rincewind"), D("er", 3, "The Witches"), D("mo", 4, "Death"),
      D("so", 5, "Rincewind"), D("ws", 6, "The Witches"), D("py", 7, "Ancient Civilizations"),
      D("gg", 8, "City Watch"), D("ec", 9, "Rincewind"), D("mp", 10, "Industrial Revolution"),
      D("rm", 11, "Death"), D("wa", 12, "The Witches"), D("sg", 13, "Ancient Civilizations"),
      D("ll", 14, "The Witches"), D("ma", 15, "City Watch"),
    ];
    const primiDieci = new Set(["cm", "lf", "er", "mo", "so", "ws", "py", "gg", "ec", "mp"]);
    const p = prossimiPassi(disco, { statusOf: (id) => (primiDieci.has(id) ? "read" : "unread") });
    // cinque cicli cominciati, cinque passi: Morte → Reaper Man (11),
    // Streghe → Witches Abroad (12), Civiltà → Small Gods (13), Guardie →
    // Men at Arms (15). Rincewind e la Rivoluzione industriale non hanno un
    // seguito in questa biblioteca e tacciono.
    t.eq("un passo per ogni ciclo cominciato", ids(p), "rm+wa+sg+ma");
    // IL NOME SEGUE IL NUMERO: nel Disco la fila è una sola, da 1 a 41, e il
    // numero accanto è quello del dorso. «Death n° 11» direbbe «l'undicesimo
    // della Morte», che è falso — i romanzi della Morte sono cinque.
    t.eq("…e si chiama col numero della saga", `${p[0].nome} n° ${p[0].libro.sagaOrder}`, "Discworld n° 11");
    t.c("…tutte le righe", p.every((x) => x.nome === "Discworld"), JSON.stringify(p.map((x) => x.nome)));
    // a parità di nome e di tocco comanda il numero, o l'ordine delle righe
    // sarebbe quello d'ingresso in biblioteca, diverso a ogni import
    t.eq("…in ordine di numero", p.map((x) => x.libro.sagaOrder).join(","), "11,12,13,15");
    // e il ciclo è quello del volume che hai finito, non il primo che si
    // incontra scorrendo: letto solo Guards! Guards! (Guardie), il passo è
    // Men at Arms, non il numero dopo di un'altra storia
    const solo = new Set(["gg"]);
    const q = prossimiPassi(disco, { statusOf: (id) => (solo.has(id) ? "read" : "unread") });
    t.eq("letto solo Guards! Guards!, il prossimo è Men at Arms", ids(q), "ma");
    t.eq("…che è il seguito della SUA storia", q[0].ciclo, "City Watch");
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
  {
    // UN CONTORNO DELLA GUIDA NON APRE UN FILO, ED È LA METÀ CHE SI VEDEVA
    // NELLA FOTOGRAFIA: «perché come prossimo passo per il 40K mi suggerisce
    // Night Lords invece del numero successivo dopo Mechanicum?».
    //
    // L'unico volume letto senza Serie era il prologo — che la guida chiama
    // fondazione del 40K, non tappa dell'Eresia — e bastava lui a far
    // nascere una riga «Warhammer 40K» che poi proponeva la lettura di
    // sfondo venuta dopo di lui. Il contorno si passa da fuori: qui si
    // prova la REGOLA, i titoli veri stanno in `capitoli.test.mjs`.
    const G = (id, serie, n) => ({ ...L(id, "Warhammer 40K", n), series: serie });
    const scena = [
      G("prologo", "", 0.01),
      G("sfondo", "", 9.04),
      G("uno", "Eresia", 1),
      G("quindici", "Eresia", 15),
      G("sedici", "Eresia", 16),
    ];
    const contorno = (b) => b.id === "prologo" || b.id === "sfondo";
    const letto = (id) => (id === "prologo" || id === "uno" || id === "quindici" ? "read" : "unread");
    t.eq("il contorno non apre un filo", ids(prossimiPassi(scena, { statusOf: letto, contorno })), "sedici");
    // e senza la guardia torna il difetto identico, con la sua riga in più
    t.eq(
      "senza la guardia la riga di troppo torna",
      ids(prossimiPassi(scena, { statusOf: letto, contorno: () => false })),
      "sfondo+sedici"
    );
    // E LA DOMANDA DEVE ARRIVARE FIN DENTRO `nextInSaga`: qui il filo lo
    // apre un romanzo vero e il contorno è un CANDIDATO, non il
    // riferimento — è il solo caso che prova il passaggio (mutazione
    // provata: senza, la riga propone la lettura di sfondo)
    const dentro = [G("uno", "", 1), G("sfondo", "", 1.04), G("due", "", 2)];
    t.eq(
      "il contorno si scavalca anche fra i candidati",
      ids(prossimiPassi(dentro, { statusOf: (id) => (id === "uno" ? "read" : "unread"), contorno })),
      "due"
    );
    // E NON FA NEMMENO DA RIFERIMENTO, e qui la guardia RESTITUISCE una
    // proposta invece di toglierla: il riferimento è il volume PIÙ AVANTI
    // che hai dichiarato, quindi un contorno letto col numero più alto se
    // lo prende lui e dopo di sé non ha niente — la storia vera resta senza
    // il suo passo. Il caso vuole un contorno letto OLTRE l'ultimo romanzo
    // dichiarato, o le due strade danno la stessa risposta.
    const oltre = [G("g1", "", 1), G("g2", "", 2), G("sfondo", "", 9.04)];
    const statiOltre = (id) => (id === "g1" || id === "sfondo" ? "read" : "unread");
    t.eq(
      "un contorno letto non ruba il riferimento",
      ids(prossimiPassi(oltre, { statusOf: statiOltre, contorno })),
      "g2"
    );
  }
  {
    // LA SCENA DELLA FOTOGRAFIA, COI TITOLI VERI E SENZA FINGERE NIENTE.
    // I controlli qui sopra provano la regola col contorno iniettato;
    // questo pinna il DEFAULT — senza, la cura resterebbe scritta e la fila
    // dell'Ingresso non la vedrebbe mai (mutazione provata).
    const W = (id, titolo, autore, n, serie = "") => ({
      id,
      title: titolo,
      author: autore,
      saga: "Warhammer 40K",
      series: serie,
      sagaOrder: n,
      addedAt: 1,
    });
    const suoi = [
      // il prologo, letto: l'unico volume senza Serie che aveva uno stato,
      // ed è lui che faceva nascere la riga
      W("eis", "Eisenhorn", "Dan Abnett", 0.01),
      W("nl", "Night Lords Omnibus", "Aaron Dembski-Bowden", 9.04),
      W("hr", "Horus Rising", "Dan Abnett", 1, "The Horus Heresy"),
      W("mec", "Mechanicum", "Graham McNeill", 15, "The Horus Heresy"),
    ];
    const letto = (id) => (id === "eis" || id === "hr" || id === "mec" ? "read" : "unread");
    t.eq(
      "il prologo letto non propone la lettura di sfondo",
      ids(prossimiPassi(suoi, { statusOf: letto, progressoOf: () => 0 })),
      ""
    );
    // e il romanzo che viene dopo si propone eccome
    const conSedici = [...suoi, W("ats", "A Thousand Sons", "Graham McNeill", 16, "The Horus Heresy")];
    t.eq(
      "…e dopo Mechanicum arriva A Thousand Sons",
      ids(prossimiPassi(conSedici, { statusOf: letto, progressoOf: () => 0 })),
      "ats"
    );
  }

  // ── E UNA SAGA CHE TACE DICE PERCHÉ ──────────────────────────────────
  //
  // Segnalato con l'Ingresso in mano, il giorno dopo la cura del 40K:
  // «adesso non mi proponi più nulla?». Sette righe c'erano e la sua no —
  // e da fuori le ragioni per cui un filo non propone niente si vedono
  // tutte uguali: una riga che non c'è.
  //
  // La ragione sbaglia in silenzio come ogni frase dell'app: un motivo
  // senza parole scrive «undefined» dentro una riga in italiano, e uno
  // sbagliato racconta al lettore una cosa che non è successa.
  {
    const V = (id, titolo, n, serie = "Storia") => ({
      id,
      title: titolo,
      saga: "Universo",
      series: serie,
      sagaOrder: n,
      addedAt: 1,
    });
    const uno = V("a", "Primo", 1);
    const due = V("b", "Secondo", 2);
    const motivi = (libri, stati, prog = {}) =>
      perchePassoTace(libri, {
        statusOf: (id) => stati[id] || "unread",
        progressoOf: (id) => prog[id] || 0,
      });
    const solo = (libri, stati, prog) => motivi(libri, stati, prog)[0];

    // le sei ragioni, una per una, coi nomi che il lettore vedrà
    t.eq("stai leggendo il più avanti", solo([uno, due], { a: "read", b: "reading" })?.motivo, "inMano");
    t.eq("…e la frase nomina quel volume", frasePassoTace(solo([uno, due], { a: "read", b: "reading" })).includes("Secondo"), true);
    t.eq("il seguito l'hai aperto", solo([uno, due], { a: "read" }, { b: 0.3 })?.motivo, "aperto");
    // …e la frase nomina IL SEGUITO, non il volume da cui si è partiti:
    // sono due libri diversi e scambiarli manda a cercare il volume
    // sbagliato (mutazione provata)
    const apertoQui = frasePassoTace(solo([uno, due], { a: "read" }, { b: 0.3 }));
    t.eq("…e nomina il seguito", apertoQui.includes("Secondo"), true);
    t.eq("…e non il volume di partenza", apertoQui.includes("Primo"), false);
    t.eq("dopo di te non hai altro", solo([uno], { a: "read" })?.motivo, "ultimo");
    // L'ABBANDONATO SI SCAVALCA COME IL LETTO, ma non vuol dire la stessa
    // cosa a chi legge la riga: «li hai letti» e «li hai lasciati» sono due
    // storie diverse
    t.eq("dopo di te solo quel che avevi lasciato", solo([uno, due], { a: "read", b: "abandoned" })?.motivo, "abbandonati");
    // E «tuttiLetti» È RAGGIUNGIBILE SOLO DOVE IL GRUPPO È PIÙ LARGO DELLA
    // CHIAVE: il riferimento è il più avanti DELLA SUA SERIE, ma dove la
    // Serie è una PARTE di una nostra guida `gruppoDi` allarga alla saga
    // intera — così davanti al riferimento ci possono stare volumi letti di
    // un'altra parte. È il caso di chi ha ancora i capitoli scritti nel
    // campo, e senza questa scena il ramo non lo prova nessuno.
    const parti = [
      { ...uno, series: "Part 1 · The Fall of Horus" },
      { ...due, series: "Part 7 · Mars & Magnus" },
    ];
    t.eq("hai letto tutto quello che hai", solo(parti, { a: "read", b: "read" })?.motivo, "tuttiLetti");
    // i numeri mescolati zittiscono il filo, ed è l'unica ragione che
    // chiede al lettore di mettere mano a un campo. IL DOPPIONE CHE CONTA
    // È QUELLO SUL PASSO: due titoli sul numero che si starebbe per
    // proporre sono un sorteggio, e in una saga il volume sbagliato è uno
    // spoiler servito dall'app.
    const litigio = solo([uno, due, V("x", "Altro", 2)], { a: "read" });
    t.eq("due titoli sul numero del passo", litigio?.motivo, "mescolati");
    // …e la riga li NOMINA: «due volumi portano lo stesso numero» senza
    // dire quali lascia a cercarli fra settanta schede
    const frase = frasePassoTace(litigio);
    t.eq("…e la frase nomina il primo", frase.includes("Secondo"), true);
    t.eq("…e anche l'altro", frase.includes("Altro"), true);
    t.eq("…col numero che litiga", frase.includes("n° 2"), true);
    // MA UN DOPPIONE LONTANO NON ZITTISCE PIÙ NIENTE, dove la Serie è
    // scritta e uguale su tutto il gruppo: lì il filo è uno solo per
    // dichiarazione del lettore, e un numero sbagliato venti volumi più in
    // là è un campo storto, non una seconda storia (segnalato: «dopo
    // Mechanicum ci sono altri libri»).
    const lontano = [uno, due, V("c", "Terzo", 3), V("y", "Gemello", 3)];
    t.eq(
      "il doppione lontano lascia parlare il filo",
      prossimiPassi(lontano, { statusOf: (id) => (id === "a" ? "read" : "unread"), progressoOf: () => 0 })[0]?.libro?.id,
      "b"
    );
    // …mentre col campo Serie VUOTO il veto resta intero: lì due fili si
    // distinguono solo dai numeri, e i numeri mentono
    const senzaSerie = lontano.map((b) => ({ ...b, series: "" }));
    t.eq(
      "senza Serie dichiarata si tace su tutto",
      solo(senzaSerie, { a: "read" })?.motivo,
      "mescolati"
    );
    // …e nemmeno DUE Serie diverse sono una dichiarazione: succede dove la
    // Serie è una PARTE di una guida, perché lì `gruppoDi` allarga alla
    // saga intera e nel gruppo finiscono capitoli diversi
    const dueParti = [
      { ...uno, series: "Part 1 · The Fall of Horus" },
      { ...due, series: "Part 7 · Mars & Magnus" },
      { ...V("y", "Gemello", 3), series: "Part 7 · Mars & Magnus" },
      { ...V("c", "Terzo", 3), series: "Part 1 · The Fall of Horus" },
    ];
    t.eq("due capitoli diversi non sono una storia dichiarata", solo(dueParti, { a: "read" })?.motivo, "mescolati");

    // UN CONTORNO NON È UN RIVALE, né da vicino né da lontano: non è una
    // tappa, quindi il suo numero non fa una seconda sequenza — e questo
    // vale tutt'e due le volte che si guarda (sul passo e su tutto il
    // gruppo), o le due domande direbbero cose diverse
    const conSfondo = (serie) => [
      { ...uno, series: serie },
      { ...due, series: serie },
      { ...V("s", "Lettura di sfondo", 2), series: serie },
    ];
    const soloIlContorno = (b) => b.id === "s";
    t.eq(
      "un contorno sullo stesso numero non ferma il passo",
      prossimiPassi(conSfondo("Storia"), {
        statusOf: (id) => (id === "a" ? "read" : "unread"),
        progressoOf: () => 0,
        contorno: soloIlContorno,
      })[0]?.libro?.id,
      "b"
    );
    t.eq(
      "…e nemmeno dove la Serie non è dichiarata",
      prossimiPassi(conSfondo(""), {
        statusOf: (id) => (id === "a" ? "read" : "unread"),
        progressoOf: () => 0,
        contorno: soloIlContorno,
      })[0]?.libro?.id,
      "b"
    );
    // e un contorno della guida non è «un volume che viene dopo»: lì il
    // filo tace, ma per una ragione sua
    t.eq(
      "dopo di te solo letture di sfondo",
      perchePassoTace([uno, V("s", "Sfondo", 1.04)], {
        statusOf: (id) => (id === "a" ? "read" : "unread"),
        progressoOf: () => 0,
        contorno: (b) => b.id === "s",
      })[0]?.motivo,
      "soloSfondo"
    );

    // CHI NON HA NIENTE DA DIRE TACE: una saga che il passo ce l'ha sta
    // già nella fila sopra, e ridirla qui sarebbe lo stesso libro due
    // volte; una saga mai cominciata non è un filo in mano.
    t.eq("il filo che propone non si spiega", motivi([uno, due, V("c", "Terzo", 3)], { a: "read" }).length, 0);
    t.eq("una saga mai cominciata non compare", motivi([uno, due], {}).length, 0);
    // e nemmeno quella il cui passo è il libro in cima all'Ingresso
    t.eq(
      "il volume già in cima non si spiega",
      perchePassoTace([uno, due], { statusOf: (id) => (id === "a" ? "read" : "unread"), progressoOf: () => 0, escludi: "b" }).length,
      0
    );

    // OGNI MOTIVO SA PARLARE, e nessuna frase lascia un «undefined» in
    // mezzo: è la regola di `GUAI` e di `PERCHE_TACE`
    for (const motivo of Object.keys(MOTIVI_PASSO)) {
      const frase = frasePassoTace({ nome: "Universo", motivo, da: uno, volume: due });
      t.eq(`«${motivo}» ha una frase`, frase.length > 20 && !frase.includes("undefined"), true);
      t.eq(`«${motivo}» porta il nome del filo`, frase.startsWith("Universo: "), true);
    }
    // e un motivo che non conosciamo si dice com'è invece di sparire
    t.eq(
      "un motivo ignoto resta visibile",
      frasePassoTace({ nome: "Universo", motivo: "boh" }).includes("boh"),
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
