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
  t.eq("un mondo in una raccolta sola non e' sparso: Malazan resta", p.mz, undefined);
  // una guida sola nel suo nome, ma la raccolta del mondo c'e' gia'
  const una = saghePropose([...libri.slice(1), { id: "w", title: "Horus Rising", author: "Dan Abnett", saga: "Warhammer 40K", series: "The Horus Heresy", sagaOrder: 1 }]);
  t.eq("con la raccolta del mondo gia' sullo scaffale, ci va anche una guida sola", una.map((x) => `${x.id}>${x.dopo.saga}`).join(), "gg>Warhammer 40K");
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
};
