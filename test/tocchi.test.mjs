// I TOCCHI DEL GIRO DELLE SAGHE NON COPRONO QUEL CHE HAI SCRITTO A MANO
// (`tocchiAncoraBuoni` in `lib/giroSaghe.js`). Trovato dalle prove sull'app
// con la rete vera: «Racconti» con la saga scritta a mano nella scheda, e
// il catalogo che rispondeva dopo con «Opere complete di Alberto Moravia»,
// che copriva la scelta e la timbrava — vincendo anche sull'altro
// dispositivo. Sbaglia in silenzio: la saga cambia da sola, giorni dopo.
import { tocchiAncoraBuoni } from "../src/lib/giroSaghe.js";

const ids = (o) => Object.keys(o).sort().join(",");

export default async function (t) {
  const moravia = { saga: "Opere complete di Alberto Moravia", sagaOrder: 7 };
  const visti = { r: { id: "r", title: "Racconti", saga: "" } };

  t.eq("il libro com'era: il tocco vale", ids(tocchiAncoraBuoni([{ id: "r", title: "Racconti" }], { r: moravia }, visti)), "r");
  t.eq(
    "la saga scritta a mano nel frattempo: il tocco se ne va",
    ids(tocchiAncoraBuoni([{ id: "r", title: "Racconti", saga: "Miti di Cthulhu" }], { r: moravia }, visti)),
    ""
  );
  t.eq(
    "il tocco gia' rimesso dal giro prima resta buono",
    ids(tocchiAncoraBuoni([{ id: "r", title: "Racconti", ...moravia }], { r: moravia }, visti)),
    "r"
  );
  t.eq(
    "…ma non se poi hai cambiato il numero",
    ids(tocchiAncoraBuoni([{ id: "r", title: "Racconti", ...moravia, sagaOrder: 2 }], { r: moravia }, visti)),
    ""
  );
  t.eq(
    "la saga tolta a mano nel frattempo ferma il tocco",
    ids(tocchiAncoraBuoni([{ id: "r", title: "Racconti", sagaTolta: true }], { r: moravia }, visti)),
    ""
  );
  // la stessa saga scritta in due modi: il giro la riunisce, e il libro ha
  // ancora la grafia vecchia che il giro ha visto
  const grafia = { w: { id: "w", saga: "Wheel of Time", sagaOrder: 1 } };
  t.eq(
    "la grafia riunita vale sul libro che l'ha ancora vecchia",
    ids(tocchiAncoraBuoni([{ id: "w", saga: "Wheel of Time", sagaOrder: 1 }], { w: { saga: "The Wheel of Time" } }, grafia)),
    "w"
  );
  t.eq("un libro che non c'e' piu' non riceve niente", ids(tocchiAncoraBuoni([], { r: moravia }, visti)), "");
  t.eq(
    "vuoto, assente e falso sono la stessa cosa",
    ids(tocchiAncoraBuoni([{ id: "r", title: "Racconti", saga: "", sagaTolta: false }], { r: moravia }, { r: { id: "r" } })),
    "r"
  );
}
