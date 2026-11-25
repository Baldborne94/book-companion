// UN MONDO SPARSO IN TANTE RACCOLTE QUANTE LE SUE GUIDE si propone riunito
// (il lettore: «perche' non vedo warhammer 40K?»). Rifatta dal disco, la sua
// biblioteca aveva il 40K in «The Horus Heresy», «Gaunt's Ghosts»,
// «Eisenhorn»: nessuna raccolta del mondo che li tenesse insieme.
import { saghePropose } from "../src/lib/sagaBooks.js";

export default async (t) => {
  const libri = [
    { id: "hh", title: "False Gods", author: "Graham McNeill", saga: "The Horus Heresy", sagaOrder: 2 },
    { id: "gg", title: "First and Only", author: "Dan Abnett", saga: "Gaunt's Ghosts", sagaOrder: 1 },
    { id: "mz", title: "Gardens of the Moon", author: "Steven Erikson", saga: "Malazan Book of the Fallen", sagaOrder: 1 },
  ];
  const p = Object.fromEntries(saghePropose(libri).map((x) => [x.id, x.dopo]));
  t.eq("l'Eresia va nel 40K, con la guida come serie e il suo numero", JSON.stringify(p.hh), JSON.stringify({ saga: "Warhammer 40K", series: "The Horus Heresy", sagaOrder: 2 }));
  t.eq("…e Gaunt's Ghosts accanto", p.gg?.series, "Gaunt's Ghosts");
  t.eq("anche un mondo con una guida sola va nella raccolta del mondo", p.mz?.saga, "Malazan");
  // il caso del lettore: la sola Eresia, 63 libri in «The Horus Heresy»
  const soloEresia = saghePropose([libri[0]]);
  t.eq("la sola Eresia si propone nel 40K", soloEresia.map((x) => `${x.dopo.saga}/${x.dopo.series}`).join(), "Warhammer 40K/The Horus Heresy");
  // una guida sola nel suo nome, ma la raccolta del mondo c'e' gia'
  const una = saghePropose([...libri.slice(1), { id: "w", title: "Horus Rising", author: "Dan Abnett", saga: "Warhammer 40K", series: "The Horus Heresy", sagaOrder: 1 }]);
  t.eq("con la raccolta del mondo gia' sullo scaffale, ci vanno le guide (e Malazan nella sua)", una.map((x) => `${x.id}>${x.dopo.saga}`).join(), "gg>Warhammer 40K,mz>Malazan");
  // chi sta gia' in una raccolta scelta dal lettore non si tocca
  t.eq("un libro in una raccolta del lettore non si propone", saghePropose([...libri, { id: "x", title: "Xenos", author: "Dan Abnett", saga: "Inquisitori", sagaOrder: 1 }]).some((x) => x.id === "x"), false);
  // i romanzi a se' del mondo non sono una serie: entrano senza
  const soli = Object.fromEntries(saghePropose([...libri, { id: "si", title: "Helsreach", author: "Aaron Dembski-Bowden", saga: "Warhammer 40K · Romanzi a sé", sagaOrder: 3 }]).map((x) => [x.id, x.dopo]));
  t.eq("un romanzo a se' del 40K entra nel 40K senza serie", JSON.stringify(soli.si), JSON.stringify({ saga: "Warhammer 40K", series: "", sagaOrder: 3 }));

  // ---- DUE RACCOLTE CON LO STESSO NUCLEO SONO UNA ------------------------
  // il lettore: «fallo per tutti i libri che appartengono alla stessa saga»
  const sparsi = [
    { id: "w1", title: "Blood of Elves", author: "Andrzej Sapkowski", saga: "Witcher", sagaOrder: 1 },
    { id: "w2", title: "Time of Contempt", author: "Andrzej Sapkowski", saga: "Witcher", sagaOrder: 2 },
    { id: "w3", title: "Crossroads of Ravens", author: "Andrzej Sapkowski", saga: "The Witcher", series: "Bonus", sagaOrder: 9 },
    { id: "r1", title: "Red Rising", author: "Pierce Brown", saga: "Red Rising Trilogy", sagaOrder: 1 },
    { id: "r2", title: "Golden Son", author: "Pierce Brown", saga: "The Red Rising Saga", sagaOrder: 2 },
    { id: "r3", title: "Morning Star", author: "Pierce Brown", saga: "The Red Rising Saga", sagaOrder: 3 },
    { id: "du", title: "Dune", author: "Frank Herbert", saga: "Dune", sagaOrder: 1 },
  ];
  const uniti = Object.fromEntries(saghePropose(sparsi).map((x) => [x.id, x.dopo]));
  t.eq("«The Witcher» va in «Witcher», che ha piu' libri, con serie e numero suoi", JSON.stringify(uniti.w3), JSON.stringify({ saga: "Witcher", series: "Bonus", sagaOrder: 9 }));
  t.eq("«Red Rising Trilogy» va in «The Red Rising Saga»", uniti.r1?.saga, "The Red Rising Saga");
  t.eq("chi sta gia' nella grafia che vince resta, e una saga sola pure", ["w1", "r2", "du"].filter((id) => uniti[id]).join(), "");
  // e la raccolta del mondo scritta a modo del lettore («Malazan universe»)
  const malazan = Object.fromEntries(
    saghePropose([
      { id: "m1", title: "Gardens of the Moon", author: "Steven Erikson", saga: "Malazan Book of the Fallen", sagaOrder: 1 },
      { id: "m2", title: "Night of Knives", author: "Ian C. Esslemont", saga: "Malazan universe", sagaOrder: 2 },
    ]).map((x) => [x.id, x.dopo])
  );
  t.eq("il mondo va nella raccolta che il lettore gli ha gia' dato", malazan.m1?.saga, "Malazan universe");

  // ---- IL MONDO DI ABERCROMBIE, com'era nella foto del lettore ------------
  // «mi sistemi anche tutti i libri del mondo circle of the world?»
  const A = "Joe Abercrombie";
  const fl = [
    ["sh", "Sharp Ends: Stories from the World of The First Law", "Circle of the World", ""],
    ["bs", "Best Served Cold", "The Age of Madness", ""],
    ["bi", "The Blade Itself", "The Age of Madness", ""],
    ["lh", "A Little Hatred", "The First Law", "The Age of Madness"],
    ["la", "Last Argument of Kings", "The First Law", ""],
    ["fl2", "The Trouble with Peace", "The First Law", "The Age of Madness"],
    ["dv", "The Devils", "The Devils", ""],
  ].map(([id, title, saga, series], i) => ({ id, title, author: A, saga, series, sagaOrder: i + 1 }));
  const pfl = Object.fromEntries(saghePropose(fl).map((x) => [x.id, x.dopo]));
  t.eq("un libro nella raccolta di un'altra guida dello stesso mondo va nel mondo, con la serie della sua guida", `${pfl.bi?.saga}/${pfl.bi?.series}`, "The First Law/The First Law Trilogy");
  t.eq("…anche The First Law Standalones, che porta il nome del mondo, ha la sua serie", pfl.bs?.series, "The First Law Standalones");
  t.eq("chi sta nel mondo senza serie prende quella della sua guida", pfl.la?.series, "The First Law Trilogy");
  t.eq("chi sta nel mondo con la sua serie resta", pfl.lh, undefined);
  const mano = saghePropose([...fl, { id: "wc", title: "The Wisdom of Crowds", author: A, saga: "The First Law", series: "La mia trilogia", sagaOrder: 9 }]);
  t.eq("…anche una serie scritta a mano, diversa da quella della guida", mano.some((x) => x.id === "wc"), false);
  t.eq("«Circle of the World» e' un nome del mondo: Sharp Ends va nella raccolta del mondo", pfl.sh?.saga, "The First Law");
  t.eq("The Devils e' un altro mondo e resta", pfl.dv, undefined);
  // e se la raccolta del mondo il lettore la chiama «Circle of the World»
  const cw = fl.map((b) => (b.saga === "The First Law" ? { ...b, saga: "Circle of the World" } : b));
  t.eq("col nome d'uso piu' usato, il mondo va li'", Object.fromEntries(saghePropose(cw).map((x) => [x.id, x.dopo])).bi?.saga, "Circle of the World");

  // ---- BLACK COMPANY: «The Chronicles of the Black Company» e' la stessa
  const bc = [["The Black Company", "The Black Company"], ["Shadows Linger", "The Black Company"], ["Shadow Games", "The Chronicles of the Black Company"], ["Dreams of Steel", "Books of the South"]].map(([title, saga], i) => ({ id: `c${i}`, title, author: "Glen Cook", saga, sagaOrder: i + 1 }));
  const pbc = Object.fromEntries(saghePropose(bc).map((x) => [x.id, x.dopo]));
  t.eq("«The Chronicles of the Black Company» va in «The Black Company»", pbc.c2?.saga, "The Black Company");
  t.eq("…e un ciclo col suo nome («Books of the South») resta", pbc.c3, undefined);
};
