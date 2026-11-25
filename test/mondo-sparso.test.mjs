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
};
