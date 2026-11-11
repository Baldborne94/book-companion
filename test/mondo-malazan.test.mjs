// L'ORDINE DI LETTURA DI UN MONDO INTERO (`camminoDelMondo`, `MONDI`),
// chiesto dal lettore con la sua raccolta «Malazan universe»: «mi metti
// l'ordine di lettura di tutti i libri del malazan universe e non solo
// delle singole serie?», e poi: «riesci a fare si' che possa sistemare la
// libreria pero' con il tutto malazan?» (i numeri del mondo, lo scaffale
// diviso per serie). Quel che sbaglia in silenzio: due numerazioni che si riscrivono a
// vicenda (il mondo e la guida), e un libro nuovo che entra col numero
// della serie in una raccolta numerata col mondo.
import { MONDI } from "../src/lib/sagaBooks.js";
import { camminiDi, camminoDelMondo, mondiDi, perParte, rifaiCammino, prossimoPasso } from "../src/lib/cammino.js";
import { numerazioneGuida, serieDaScrivere } from "../src/lib/numeraCammino.js";
import { universiNumerati, ripassaSciolti } from "../src/lib/sagaBooks.js";
import { completaSaga } from "../src/lib/importBook.js";
import { disponi } from "../src/lib/ripiani.js";
import { nextInSaga } from "../src/lib/saga.js";
import { vociDallaGuida } from "../src/lib/senzaFile.js";

const L = (id, title, author, extra = {}) => ({ id, title, author, fileType: "epub", ...extra });

export default async (t) => {
  const mondo = MONDI.find((m) => m.universo === "Malazan");
  t.c("Malazan ha un ordine del mondo", !!mondo);

  // la tavola (date, voci, copertura) la guarda `mondi-ordine.test.mjs`

  // IL CAMMINO: i libri del lettore, scritti come sul suo tablet
  const libri = [
    L("toll", "Malazan 08 - Toll the Hounds", "Steven Erikson", { saga: "Malazan universe", sagaOrder: 3 }),
    L("nok", "Night of Knives", "Ian C. Esslemont", { saga: "Malazan universe" }),
    L("gotm", "Gardens of the Moon", "Steven Erikson", { saga: "Malazan universe", sagaOrder: 1, series: "Malazan Book of the Fallen" }),
    L("way", "The Way of Kings", "Brandon Sanderson", { saga: "Cosmoverse" }),
  ];
  const c = camminoDelMondo(mondo, libri, { scaffale: libri });
  t.c("e' un cammino di mondo", c.mondo === true);
  t.eq("il nome e' quello del mondo", c.saga, "Tutto Malazan");
  t.eq(
    "le tappe nell'ordine di uscita, con le serie che si alternano",
    c.tappe.slice(0, 7).map((x) => x.voce.t).join(", "),
    "Gardens of the Moon, Deadhouse Gates, Memories of Ice, House of Chains, Midnight Tides, Night of Knives, The Bonehunters"
  );
  const di = (titolo) => c.tappe.find((x) => x.voce.t === titolo);
  t.eq("il numero del cammino e' il posto nel mondo (Toll the Hounds e' il 10)", di("Toll the Hounds").posto, 10);
  t.eq("…Night of Knives il 6, e la voce tiene quello della serie", `${di("Night of Knives").posto} ${di("Night of Knives").voce.o}`, "6 1");
  t.eq("i libri si trovano nella loro guida (non «altrui»)", ["Toll the Hounds", "Night of Knives"].map((x) => `${!!di(x).libro}${!!di(x).altrui}`).join(), "truefalse,truefalse");
  t.eq("hai 3 dei 25 volumi", `${c.tue}/${c.volumi}`, "3/25");
  t.eq("quel che il ripiano ha fuori dal mondo si conta", `${c.fuori} ${c.dalRipiano}`, "1 3");

  // LE PARTI: una fila per serie, e la stessa serie torna
  const parti = perParte(c.tappe, { fila: true });
  t.eq(
    "le prime file: cinque del Libro dei Caduti, uno di Esslemont, di nuovo Erikson",
    parti.slice(0, 3).map((p) => `${p.parte}·${p.tappe.length}`).join(" | "),
    "Malazan Book of the Fallen·5 | Novels of the Malazan Empire·1 | Malazan Book of the Fallen·2"
  );
  t.eq("raccolte per nome sarebbero cinque parti, una per guida", perParte(c.tappe).length, 5);
  t.eq("senza `fila` resta il raggruppamento di prima", perParte(c.tappe).map((p) => p.tappe.length).join(), "10,6,2,4,3");

  // I NUMERI: «Mettili in ordine» scrive il posto nel mondo
  const numeri = numerazioneGuida(c);
  t.eq("Toll the Hounds scritto 3 diventa 10, Night of Knives 6", numeri.map((n) => `${n.id}:${n.a}`).sort().join(), "nok:6,toll:10");
  t.eq("la serie e' quella della guida del volume", serieDaScrivere(c).map((s) => `${s.id}:${s.a}`).sort().join(), "nok:Novels of the Malazan Empire,toll:Malazan Book of the Fallen");

  // IL PROSSIMO PASSO e' il primo del mondo che non hai letto
  const stati = { gotm: "read" };
  const passo = prossimoPasso(c, { statoDi: (id) => stati[id] || "unread", progressoDi: () => 0, spuntati: new Set() });
  t.eq("letto Gardens of the Moon, il passo e' Deadhouse Gates", passo?.tappa.voce.t, "Deadhouse Gates");
  t.eq("…e il primo che puoi aprire e' Night of Knives, il sesto", passo?.apribile?.voce.t, "Night of Knives");

  // IL TASTO: sul ripiano di Malazan si', su quello del Cosmere no
  const qui = camminiDi(libri, { scaffale: libri.slice(0, 3) });
  t.eq("un ripiano con una guida di Malazan ha il mondo", mondiDi(qui, libri, { scaffale: libri.slice(0, 3) }).map((m) => m.saga).join(), "Tutto Malazan");
  const cosmere = camminiDi(libri, { scaffale: [libri[3]] });
  t.eq("sul ripiano del Cosmere, il suo mondo e non quello di Malazan", mondiDi(cosmere, libri, { scaffale: [libri[3]] }).map((m) => m.saga).join(), "Tutto il Cosmere");
  const lockwood = [L("lw", "The Screaming Staircase", "Jonathan Stroud")];
  t.eq("una guida senza universo un mondo non ce l'ha", mondiDi(camminiDi(lockwood, { scaffale: lockwood }), lockwood, { scaffale: lockwood }).length, 0);

  // RIFATTO coi libri di adesso, resta un mondo
  const rifatto = rifaiCammino(c, [...libri, L("dg", "Deadhouse Gates", "Steven Erikson")]);
  t.eq("rifatto, e' ancora il mondo col libro nuovo", `${rifatto?.mondo} ${rifatto?.tue}`, "true 4");
  const guida = rifaiCammino(camminiDi(libri, { scaffale: [libri[3]] })[0], libri);
  t.eq("una guida rifatta resta la sua guida", `${guida?.mondo} ${guida?.saga}`, "false The Stormlight Archive");

  // LE SCHEDE SENZA FILE: in ordine di mondo, ognuna con la serie e il
  // numero della sua guida, nella raccolta dove il lettore tiene Malazan
  const voci = vociDallaGuida(c, libri);
  t.eq("tutti e 25, in ordine di mondo", voci.map((v) => v.titolo).slice(4, 7).join(", "), "Midnight Tides, Night of Knives, The Bonehunters");
  const nok = voci.find((v) => v.titolo === "Night of Knives");
  t.eq("Night of Knives: la sua serie, il numero della serie (la biblioteca non e' ancora numerata col mondo), la raccolta del lettore", `${nok.serie} · ${nok.numero} · ${nok.saga} · ${nok.autore}`, "Novels of the Malazan Empire · 1 · Malazan universe · Ian C. Esslemont");
  t.eq("quel che hai e' segnato", voci.filter((v) => v.gia).map((v) => v.titolo).join(), "Gardens of the Moon,Night of Knives,Toll the Hounds");

  // LA BIBLIOTECA NUMERATA COL MONDO: quella che resta dopo «Mettili in
  // ordine» del mondo
  const prima = [
    L("gotm", "Gardens of the Moon", "Steven Erikson", { saga: "Malazan universe", sagaOrder: 1, series: "Malazan Book of the Fallen" }),
    L("nok", "Night of Knives", "Ian C. Esslemont", { saga: "Malazan universe", sagaOrder: 1, series: "Novels of the Malazan Empire" }),
    L("tb", "The Bonehunters", "Steven Erikson", { saga: "Malazan universe", sagaOrder: 6, series: "Malazan Book of the Fallen" }),
    L("toll", "Toll the Hounds", "Steven Erikson", { saga: "Malazan universe", sagaOrder: 8, series: "Malazan Book of the Fallen" }),
  ];
  t.eq("numerata per serie, il mondo non e' acceso", universiNumerati(prima).size, 0);
  const scritti = new Map(numerazioneGuida(camminoDelMondo(mondo, prima)).map((n) => [n.id, n.a]));
  const dopo = prima.map((b) => (scritti.has(b.id) ? { ...b, sagaOrder: scritti.get(b.id) } : b));
  t.eq("i numeri scritti dal mondo", dopo.map((b) => `${b.id}:${b.sagaOrder}`).join(), "gotm:1,nok:6,tb:7,toll:10");
  t.eq("…e adesso la biblioteca e' numerata col mondo", [...universiNumerati(dopo)].join(), "Malazan");
  t.eq("un solo libro col posto del mondo contro tre della serie non basta", universiNumerati([dopo[1], ...prima.slice(2)]).size, 0);

  // le guide non riscrivono quel che il mondo ha scritto
  const guidaMB = camminiDi(dopo, { scaffale: dopo }).find((x) => x.saga === "Malazan Book of the Fallen");
  t.eq("il cammino della guida usa il posto nel mondo", guidaMB.tappe.find((x) => x.voce.t === "Toll the Hounds").posto, 10);
  t.eq("…e non propone di rimettere 8", numerazioneGuida(guidaMB).length, 0);
  const conCosmere = [...dopo, L("wor", "Words of Radiance", "Brandon Sanderson", { saga: "Cosmoverse", sagaOrder: 2 })];
  t.eq("…e un altro mondo, non numerato, resta coi suoi", camminiDi(conCosmere, { scaffale: conCosmere }).find((x) => x.saga === "The Stormlight Archive").tappe.find((x) => x.voce.t === "Words of Radiance").posto, 2);
  t.eq("…su una biblioteca per serie, la guida resta coi suoi numeri", camminiDi(prima, { scaffale: prima }).find((x) => x.saga === "Malazan Book of the Fallen").tappe.find((x) => x.voce.t === "Toll the Hounds").posto, 8);

  // un libro nuovo entra col suo posto nel mondo
  const meta = { title: "Dust of Dreams", author: "Steven Erikson" };
  completaSaga(meta, null, "Dust of Dreams.epub", dopo);
  t.eq("all'import, Dust of Dreams nella raccolta numerata col mondo e' l'11", `${meta.saga} · ${meta.sagaOrder}`, "Malazan universe · 11");
  const meta2 = { title: "Dust of Dreams", author: "Steven Erikson" };
  completaSaga(meta2, null, "Dust of Dreams.epub", prima);
  t.eq("…in una per serie, il 9", meta2.sagaOrder, 9);
  const wor = { title: "Words of Radiance", author: "Brandon Sanderson" };
  completaSaga(wor, null, "Words of Radiance.epub", dopo);
  t.eq("…e un libro di un altro mondo tiene il numero della sua serie", wor.sagaOrder, 2);
  const sciolto = L("dod", "Dust of Dreams", "Steven Erikson");
  t.eq("anche dal giro dei libri sciolti", ripassaSciolti([...dopo, sciolto]).libri.find((b) => b.id === "dod").sagaOrder, 11);
  t.eq("…e per serie il 9", ripassaSciolti([...prima, sciolto]).libri.find((b) => b.id === "dod").sagaOrder, 9);

  // le schede senza file del mondo, in una biblioteca numerata col mondo
  const vociDopo = vociDallaGuida(camminoDelMondo(mondo, dopo), dopo);
  t.eq("le schede nuove prendono il posto nel mondo", vociDopo.find((v) => v.titolo === "Return of the Crimson Guard").numero, 9);

  // il prossimo volume segue il mondo
  const letti = { gotm: "read", nok: "read", tb: "read" };
  const sullo = [...dopo, L("rg", "Reaper's Gale", "Steven Erikson", { saga: "Malazan universe", sagaOrder: 8, series: "Malazan Book of the Fallen" }), L("rcg", "Return of the Crimson Guard", "Ian C. Esslemont", { saga: "Malazan universe", sagaOrder: 9, series: "Novels of the Malazan Empire" })];
  const statoDi = (id) => letti[id] || "unread";
  t.eq("letto The Bonehunters (7), il prossimo e' Reaper's Gale (8)", nextInSaga(sullo[2], sullo, statoDi, () => 0)?.id, "rg");
  letti.rg = "read";
  t.eq("…e dopo Reaper's Gale, Return of the Crimson Guard di Esslemont (9)", nextInSaga(sullo[4], sullo, statoDi, () => 0)?.id, "rcg");

  // LO SCAFFALE RESTA PER SERIE (il lettore, dopo averlo visto in fila:
  // «lasciami i libri nella stessa serie senza dividerla, scrivici solo il
  // numero giusto in ordine di lettura»): un sotto-ripiano per serie, i
  // volumi in ordine col numero del mondo, le serie nell'ordine del loro
  // primo volume
  const rip = disponi(sullo, null, "auto").find((r) => r.nome === "Malazan universe");
  t.eq(
    "una serie, un sotto-ripiano, coi numeri del mondo in ordine",
    rip.cicli.map((g) => `${g.nome}: ${g.libri.map((b) => b.sagaOrder).join(",")}`).join(" | "),
    "Malazan Book of the Fallen: 1,7,8,10 | Novels of the Malazan Empire: 6,9"
  );
};
