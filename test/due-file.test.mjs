// LE DUE FILE DELL'INGRESSO (`inCorsoESeguiti` in `lib/saga.js`): i libri
// cominciati da una parte, i seguiti delle saghe dall'altra. Sbaglia in
// silenzio: un libro nella fila sbagliata si tocca e fa il gesto sbagliato
// (riapre un volume mai cominciato, o mostra la scheda di quello che leggi).
import { inCorsoESeguiti } from "../src/lib/saga.js";

export default async function (t) {
  const a = { id: "a", title: "A" };
  const b = { id: "b", title: "B" };
  const c = { id: "c", title: "C", sagaOrder: 4 };
  const d = { id: "d", title: "D", sagaOrder: 2.5 };
  const prog = { a: 0.12, b: 0 };
  const progressoOf = (id) => prog[id];
  const passi = [
    { libro: c, nome: "Mistborn" },
    { libro: a, nome: "Mistborn" },
    { libro: d, nome: "Discworld" },
  ];
  const { inCorso, seguiti } = inCorsoESeguiti([a, b], passi, progressoOf);
  const ids = (xs) => xs.map((x) => x.book.id).join(",");

  t.eq("i libri in lettura nella loro fila, nell'ordine dato", ids(inCorso), "a,b");
  t.eq("i seguiti nell'altra", ids(seguiti), "c,d");
  t.c("un libro che stai leggendo non si propone come seguito", !seguiti.some((x) => x.book.id === "a"));
  t.eq("la percentuale letta", inCorso[0].nota, "12% letto");
  t.eq("lo zero non si dice", inCorso[1].nota, "appena cominciato");
  t.eq("il seguito dice saga e numero", seguiti[0].nota, "Mistborn n° 4");
  t.eq("…col numero all'italiana", seguiti[1].nota, "Discworld n° 2,5");

  const doppi = inCorsoESeguiti([a, a], [{ libro: c, nome: "M" }, { libro: c, nome: "M" }], progressoOf);
  t.eq("un libro non sta due volte nella stessa fila", ids(doppi.inCorso) + "|" + ids(doppi.seguiti), "a|c");

  const vuoto = inCorsoESeguiti(null, null, progressoOf);
  t.eq("niente libri, niente file", vuoto.inCorso.length + vuoto.seguiti.length, 0);
}
