// IL SEGUITO DI UN MONDO E' IL PRIMO VOLUME NON LETTO (chiesto dal lettore
// col Cosmoverse numerato col mondo: «mi proponi Warbreaker ma il primo che
// non e' stato letto del Cosmoverso e' Elantris»). Altrove resta il numero
// dopo il piu' avanti letto: un volume lasciato indietro non e' il prossimo.
import { prossimiPassi, passoDentro } from "../src/lib/saga.js";

globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

const S = "Brandon Sanderson";
const cosmo = [
  ["el", "Elantris", 1],
  ["fe", "The Final Empire", 2],
  ["wa", "The Well of Ascension", 3],
  ["ha", "The Hero of Ages", 4],
  ["wb", "Warbreaker", 5],
  ["wk", "The Way of Kings", 6],
].map(([id, title, sagaOrder]) => ({ id, title, author: S, saga: "Cosmoverse", sagaOrder }));
const stati = (m) => (id) => m[id] || "unread";
const passo = (libri, m) => prossimiPassi(libri, { statusOf: stati(m), progressoOf: () => 0 }).map((p) => p.libro.title).join();

export default async (t) => {
  const letti = { fe: "read", wa: "read", ha: "read" };
  t.eq("nel mondo numerato col mondo: il primo non letto, anche prima dei letti", passo(cosmo, letti), "Elantris");
  t.eq("e quello in mano si scavalca: il passo e' il primo mai aperto", passo(cosmo, { ...letti, el: "reading" }), "Warbreaker");
  t.eq("letto Elantris, il passo torna avanti", passo(cosmo, { ...letti, el: "read" }), "Warbreaker");
  const tutto = Object.fromEntries(cosmo.map((b) => [b.id, "read"]));
  t.eq("tutto letto: tutti letti", passoDentro(cosmo[1], cosmo, stati(tutto), () => 0).motivo, "tuttiLetti");
  t.eq("solo uno in mano: si dice quello", passoDentro(cosmo[1], cosmo, stati({ ...tutto, wk: "reading" }), () => 0).volume?.title, "The Way of Kings");

  // una saga che non e' un mondo resta col numero dopo il piu' avanti letto
  const altra = [1, 2, 3, 4, 5].map((n) => ({ id: `d${n}`, title: `Volume ${n}`, author: "Terry Pratchett", saga: "Discworld", sagaOrder: n }));
  t.eq("fuori dai mondi il volume lasciato indietro non torna", passo(altra, { d2: "read", d3: "read", d4: "read" }), "Volume 5");
  // e un Cosmoverse numerato serie per serie non e' numerato col mondo
  const perSerie = cosmo.map((b) => ({ ...b, sagaOrder: { el: 1, fe: 1, wa: 2, ha: 3, wb: 2, wk: 1 }[b.id], series: { fe: "Mistborn", wa: "Mistborn", ha: "Mistborn", wk: "Stormlight" }[b.id] || "Cosmere Standalones" }));
  t.eq("numerato serie per serie: il filo resta la serie", passo(perSerie, letti), "");
};
