// LE TAVOLE DEI MONDI (`MONDI` in `sagaBooks.js`): l'ordine di lettura di
// tutte le guide di un universo insieme (Malazan, il Cosmere). Quel che
// sbaglia in silenzio e' la tavola: una riga spostata a mano, un titolo che
// la guida scrive diverso, un volume dimenticato. E il nome della serie in
// ogni fila, che in un mondo deve dire anche la guida.
import { MONDI, TAVOLE } from "../src/lib/sagaBooks.js";
import { camminoDelMondo, perParte, serieNelMondo, tavolaDelMondo } from "../src/lib/cammino.js";

export default async (t) => {
  t.eq("i mondi con un ordine", MONDI.map((m) => m.nome).join(", "), "Tutto Malazan, Tutto il Cosmere");
  for (const mondo of MONDI) {
    const tav = tavolaDelMondo(mondo);
    t.eq(`${mondo.nome}: ogni riga e' una voce della sua guida`, tav.libri.filter((v) => !v.t).map((v) => v.guida).join(), "");
    const guide = TAVOLE.filter((x) => x.universo === mondo.universo);
    const nelMondo = tav.libri.map((v) => `${v.guida}\u0000${v.t}`);
    const fuori = guide.flatMap((g) => g.libri.map((v) => `${g.saga}\u0000${v.t}`)).filter((k) => !nelMondo.includes(k));
    t.eq(`${mondo.nome}: ogni volume delle sue guide ci sta`, fuori.join(" | "), "");
    t.eq(`${mondo.nome}: una volta sola`, new Set(nelMondo).size, nelMondo.length);
    // l'ordine e' quello di uscita: una riga spostata a mano si vede
    const date = mondo.ordine.map((r) => r[2]);
    const storte = date.map((d, i) => (i && !(d >= date[i - 1]) ? `${mondo.ordine[i][1]} (${d}) dopo ${mondo.ordine[i - 1][1]} (${date[i - 1]})` : null)).filter(Boolean);
    t.eq(`${mondo.nome}: in ordine di data`, storte.join("; "), "");
    t.eq(`${mondo.nome}: ogni riga ha una data`, mondo.ordine.filter((r) => !/^\d{4}(-\d{2}){0,2}$/.test(r[2] || "")).map((r) => r[1]).join(), "");
  }

  // IL COSMERE: diciotto romanzi, e le file dicono la guida
  const cosmere = MONDI.find((m) => m.universo === "Cosmere");
  const c = camminoDelMondo(cosmere, []);
  t.eq("il Cosmere comincia da Elantris, poi Mistborn", c.tappe.slice(0, 3).map((x) => x.voce.t).join(", "), "Elantris, The Final Empire, The Well of Ascension");
  t.eq("e ogni volume tiene il numero della sua serie (Warbreaker e' il 2 dei romanzi a se')", c.tappe.find((x) => x.voce.t === "Warbreaker").posto, 2);
  t.eq("diciotto volumi", c.volumi, 18);
  t.eq(
    "le file nominano la guida e il ciclo",
    perParte(c.tappe, { fila: true }).slice(0, 4).map((p) => `${p.parte}·${p.tappe.length}`).join(" | "),
    "Cosmere Standalones·1 | Mistborn · Era One·3 | Cosmere Standalones·1 | The Stormlight Archive·1"
  );
  t.eq("un Secret Project dice guida e ciclo", serieNelMondo(c.tappe.find((x) => x.voce.t === "The Sunlit Man").voce), "Cosmere Standalones · Secret Projects");
  t.eq("in Malazan il ciclo e' la guida, e si dice una volta", serieNelMondo({ guida: "Witness", c: "Witness" }), "Witness");
};
