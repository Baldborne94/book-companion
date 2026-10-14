// L'UNIVERSO DI HELLBOY NELL'ORDINE DELLA COMICS BEAT (chiesto dal lettore:
// «sistemami tutti i libri di Hellboy mettendoli dentro la saga di Hellboy
// con l'ordine consigliato da questo sito»). I nomi in cima sono quelli dei
// suoi file e delle sue schede, letti dai rapporti del disco e di Drive.
import HELLBOY from "../src/data/hellboy.js";
import { riconosci, saghePropose, fraseSaga, ripassa, formaDi } from "../src/lib/sagaBooks.js";
import { camminoDi } from "../src/lib/cammino.js";
import { nextInSaga } from "../src/lib/saga.js";
import { casaDelVolume } from "../src/lib/driveCore.js";

export default async (t) => {
  const n = (title, extra = {}) => riconosci({ title, ...extra })?.sagaOrder ?? null;
  const di = (title, extra = {}) => riconosci({ title, ...extra })?.titolo ?? null;

  // i suoi
  t.eq("Omnibus 1 coi tag", n("Hellboy Omnibus v01 - Seed of Destruction (2018) (digital) (F) (Son of Ultron-Empire)"), 1);
  t.eq("la copia «-027»", n("Hellboy Omnibus v01 - Seed of Destruction-027"), 1);
  t.eq("la scheda ripulita", n("v01 - Seed of Destruction", { saga: "Hellboy" }), 1);
  t.eq("Short Stories 1", n("Hellboy - The Complete Short Stories v01 (2018) (digital) (Son of Ultron-Empire)"), 2);
  t.eq("Short Stories 2, «v1-015» non inganna", n("Hellboy - The Complete Short Stories v02 (2018) (digital) (Son of Ultron-Empire)"), 3);
  t.eq("e il v1 con la coda", n("Hellboy - The Complete Short Stories v1-015"), 2);
  t.eq("Omnibus 3 scritto «v3-522»", n("Hellboy Omnibus - The Wild Hunt v3-522"), 9);
  t.eq("B.P.R.D. Omnibus 1", n("B.P.R.D. Omnibus v01 (2022) (digital) (Son of Ultron-Empire)"), 5);
  t.eq("B.P.R.D. Omnibus 2", n("B.P.R.D. Omnibus v02 (2022) (digital) (Son of Ultron-Empire)"), 6);
  t.eq("«vol 1» come «v01»", n("B.P.R.D. Omnibus vol 1"), 5);
  t.eq("Witchfinder 1", n("Sir Edward Grey, Witchfinder Omnibus v01 (2019) (digital) (Son of Ultron-Empire)"), 11);
  t.eq("Witchfinder «Omnibus01»", n("Sir Edward Grey, Witchfinder Omnibus01"), 11);
  t.eq("Witchfinder 2", n("Sir Edward Grey, Witchfinder Omnibus02"), 36);
  t.eq("Lobster Johnson senza numero è il primo", n("Lobster Johnson Omnibus"), 12);
  t.eq("1955-1957", n("Hellboy and the B.P.R.D. - 1955-1957 (2024) (digital) (Li'l Ultron-Empire)"), 42);
  t.eq("Effie Kolb", n("Hellboy and the B.P.R.D. - The Return of Effie Kolb and Others (2022) (digital) (Son of Ultron-Empire)"), 45);
  t.eq("Koshchei", n("Koshchei the Deathless Omnibus (2026)"), 34);
  t.eq("Hellboy in Mexico", n("Hellboy in Mexico (2016) GetComics.INFO"), 20);

  // un volume singolo prende il posto della raccolta che lo contiene
  t.eq("Hollow Earth è nell'Omnibus 1 del B.P.R.D.", n("B.P.R.D. v01 - Hollow Earth and Other Stories"), 5);
  t.eq("il vecchio Plague of Frogs 3", n("B.P.R.D. - Plague of Frogs v03 (2011)"), 7);
  t.eq("The Black Flame non è Rise of the Black Flame", n("B.P.R.D. v07 - The Black Flame"), 6);
  t.eq("Reign of the Black Flame", n("B.P.R.D. Hell on Earth v09 - The Reign of the Black Flame"), 29);
  t.eq("Rise of the Black Flame", n("Rise of the Black Flame (2017)"), 37);
  // «Hell on Earth v04» e' il volume singolo 4, non la vecchia raccolta 4:
  // il sottotitolo si legge prima del numero
  t.eq("Hell on Earth 4 dal sottotitolo", n("B.P.R.D. Hell on Earth v04 - The Devil's Engine and the Long Death"), 27);
  t.eq("la vecchia raccolta Hell on Earth 4", n("B.P.R.D. - Hell on Earth v04 (2019)"), 31);
  t.eq("Abe Sapien singolo 3", n("Abe Sapien v03 - Dark and Terrible and The New Race of Man"), 30);
  t.eq("Abe Sapien raccolta 2", n("Abe Sapien - Dark and Terrible v02 (2018)"), 32);
  t.eq("Library Edition 5", n("Hellboy Library Edition v05 (2012)"), 9);
  t.eq("Weird Tales", n("Hellboy - Weird Tales (2022)"), 10);
  t.eq("«&» come «and»", n("Hellboy v09 - The Storm & the Fury"), 9);
  t.eq("l'apostrofo non spezza la parola", n("B.P.R.D. Hell on Earth v10 - The Devil's Wings"), 31);
  t.eq("Lobster Johnson 2", n("Lobster Johnson Omnibus v02"), 13);
  t.eq("The Sea of Forever non è New World", n("Frankenstein - New World - The Sea of Forever (2024)"), 54);
  t.eq("dal nome del file, all'import", n("Senza titolo", { fileName: "B.P.R.D. Omnibus v01 (2022).cbz" }), 5);

  // le storie spezzate dalla guida: righe senza numero, dentro il loro omnibus
  t.eq("Rasputin si spunta", n("Rasputin - The Voice of the Dragon (2023)"), null);
  t.eq("ma si riconosce", di("Rasputin - The Voice of the Dragon (2023)"), "Rasputin: The Voice of the Dragon");
  t.eq("un dramma audio non è un volume", n("Hellboy - A Plague of Wasps"), null);

  // chi non è Hellboy resta fuori
  t.eq("The Wild Hunt di un altro", riconosci({ title: "The Wild Hunt", author: "Someone Else" }), null);
  t.eq("End of Days di Susan Ee", riconosci({ title: "End of Days", author: "Susan Ee" }), null);
  t.eq("City of the Dead", riconosci({ title: "City of the Dead" }), null);
  t.eq("Frankenstein di Mary Shelley", riconosci({ title: "Frankenstein", author: "Mary Shelley" }), null);
  t.eq("Abe Sapien Library Edition non è Hellboy 1", n("Abe Sapien Library Edition v01"), null);
  t.eq("ma con la saga scritta l'Omnibus 3 sì", n("The Wild Hunt v3-522", { saga: "Hellboy" }), 9);
  t.eq("Discworld resta Discworld", riconosci({ title: "Mort", author: "Terry Pratchett" })?.saga, "Discworld");

  // la guida stessa
  const numeri = HELLBOY.map((v) => v.o).filter((o) => o != null);
  t.c("i numeri crescono uno alla volta", numeri.every((o, i) => o === i + 1));
  // «Crimson Lotus» da solo potrebbe essere di chiunque: nella sua saga no
  t.c("ogni tappa si riconosce dal suo titolo, nella sua saga", HELLBOY.filter((v) => v.o != null).every((v) => riconosci({ title: v.t, saga: "Hellboy" })?.titolo === v.t));
  t.eq("Crimson Lotus da solo non basta", riconosci({ title: "Crimson Lotus" }), null);
  t.c("ogni racconto sta in una tappa che c'è", HELLBOY.filter((v) => v.tipo === "racconto").every((v) => HELLBOY.some((x) => x.t === v.in && x.o != null)));
  t.eq("«B.P.R.D.» ridotto", formaDi("B.P.R.D. Omnibus Vol. 03"), "bprd omnibus v3");

  // le schede del lettore: si propone la saga della guida e il suo numero,
  // e la SERIE resta la sua (le aveva messe a mano: «così come stavo
  // facendo»); chi non ne ha una prende quella della guida
  const scaffale = [
    { id: "h1", title: "v01 - Seed of Destruction", saga: "Hellboy", series: "Hellboy Omnibus", sagaOrder: 1 },
    { id: "h2", title: "B.P.R.D. Omnibus v01 (2022)", saga: "B.P.R.D. Omnibus", series: "", sagaOrder: 1 },
    { id: "h3", title: "Sir Edward Grey, Witchfinder Omnibus01", saga: "Hellboy", series: "Witchfinder Omnibus", sagaOrder: 1 },
    { id: "h4", title: "Hellboy Omnibus - The Wild Hunt v3-522", saga: "Hellboy", series: "Hellboy Omnibus", sagaOrder: 9 },
    { id: "h5", title: "Koshchei the Deathless Omnibus (2026)", saga: "Hellboy", series: "", sagaOrder: null },
    { id: "h8", title: "Hellboy and the B.P.R.D. - The Secret of Chesbro House and Others (2023)", saga: "Hellboy", series: "Hellboy and the B.P.R.D.", sagaOrder: 43 },
    { id: "d1", title: "Mort", author: "Terry Pratchett", saga: "Discworld", series: "La Morte scritta a mano", sagaOrder: 4 },
  ];
  const p = Object.fromEntries(saghePropose(scaffale).map((x) => [x.id, x]));
  t.c("chi è già a posto non si propone", !p.h1 && !p.h4);
  t.eq("B.P.R.D. entra in Hellboy, con la serie della guida", fraseSaga(p.h2?.dopo), "Hellboy · B.P.R.D. Omnibus · n. 5");
  t.eq("e si dice da dove parte", fraseSaga(p.h2?.prima), "B.P.R.D. Omnibus · n. 1");
  t.eq("Witchfinder al suo posto, la serie resta", fraseSaga(p.h3?.dopo), "Hellboy · Witchfinder Omnibus · n. 11");
  t.eq("la serie scritta a mano resta, il numero è della guida", fraseSaga(p.h8?.dopo), "Hellboy · Hellboy and the B.P.R.D. · n. 46");
  t.eq("il numero che mancava", fraseSaga(p.h5?.dopo), "Hellboy · n. 34");
  t.eq("una serie diversa da quella della guida resta la sua", fraseSaga(saghePropose([{ id: "m", title: "B.P.R.D. Omnibus v03", saga: "B.P.R.D.", series: "Plague of Frogs", sagaOrder: 3 }])[0]?.dopo), "Hellboy · Plague of Frogs · n. 7");
  t.c("il Disco scritto a mano non si tocca", !p.d1);
  t.eq("la saga scritta fa da contesto anche qui", fraseSaga(saghePropose([{ id: "j", title: "The Wild Hunt v3-522", saga: "Hellboy", sagaOrder: 3 }])[0]?.dopo), "Hellboy · Hellboy Omnibus · n. 9");
  // la saga e' contesto, non titolo: «Lobster Johnson Omnibus» scritta come
  // saga non fa del secondo volume il primo
  t.eq("Lobster Johnson 2 nella sua saga", riconosci({ title: "Lobster Johnson Omnibus v02 (2023) (digital)", saga: "Lobster Johnson Omnibus" })?.sagaOrder, 13);
  // le altre tavole restano come prima: l'Eresia sa l'ordine di lettura, e
  // il numero della collana scritto nel titolo (24) non si propone
  t.eq("l'Eresia non prende il numero della collana", saghePropose([{ id: "e", title: "Betrayer (The Horus Heresy Book 24)", saga: "" }]).length, 0);
  t.c("la saga tolta a mano resta tolta", !saghePropose([{ id: "x", title: "B.P.R.D. Omnibus v02", saga: "", sagaTolta: true }]).length);
  t.eq("ripassa riempie solo i vuoti", ripassa({ id: "y", title: "B.P.R.D. Omnibus v02", saga: "Hellboy", series: "Mia", sagaOrder: 2 })?.campi ?? null, null);
  t.eq("e il vuoto lo riempie", ripassa({ id: "z", title: "B.P.R.D. Omnibus v02", saga: "", sagaOrder: null })?.campi?.sagaOrder, 6);
  t.eq("anche con la saga come contesto", ripassa({ id: "w", title: "Crimson Lotus", saga: "Hellboy", sagaOrder: null })?.campi?.sagaOrder, 39);
  t.eq("la saga si scrive come la scrive già la biblioteca", fraseSaga(saghePropose([{ id: "k", title: "B.P.R.D. Omnibus v01", saga: "HELLBOY" }])[0]?.dopo), "HELLBOY · B.P.R.D. Omnibus · n. 5");

  // dopo le proposte: ogni serie nell'ordine della guida
  const fatti = scaffale.map((b) => (p[b.id] ? { ...b, ...p[b.id].dopo } : b));
  const tutti = [
    ...fatti,
    { id: "h6", title: "B.P.R.D. Omnibus v02 (2022)", saga: "Hellboy", series: "B.P.R.D. Omnibus", sagaOrder: 6 },
    { id: "h7", title: "Crimson Lotus", saga: "Hellboy", series: "", sagaOrder: 39 },
  ];
  const stato = { h1: "read", h2: "read" };
  const leggi = (id) => stato[id] || "unread";
  t.eq("dopo il B.P.R.D. 1 il B.P.R.D. 2", nextInSaga(tutti.find((b) => b.id === "h2"), tutti, leggi, () => 0)?.id, "h6");
  t.eq("dopo l'Omnibus 1 l'Omnibus 3 (il 2 non c'è)", nextInSaga(tutti.find((b) => b.id === "h1"), tutti, leggi, () => 0)?.id, "h4");
  t.eq("sul disco: dentro Hellboy, nella cartella della serie", casaDelVolume(fatti[1], "fumetti").join("/"), "Fumetti/Hellboy/B.P.R.D. Omnibus");

  // il cammino conta i suoi volumi
  const c = camminoDi(tutti);
  t.eq("il cammino è quello di Hellboy", c?.saga, "Hellboy");
  t.eq("hai otto tappe, Crimson Lotus compreso", c?.tue, 8);
  t.eq("54 volumi e 3 drammi audio: i racconti non contano", c?.volumi, 57);
};
