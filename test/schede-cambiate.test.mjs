// LE SCHEDE CAMBIATE DA UN GIRO SI TIMBRANO (`schedeCambiate` in
// `lib/library.js`). Sbaglia in silenzio: la saga trovata da sola sul PC
// resta sul PC, e il tablet la mostra «Fuori saga» per sempre (segnalato).
import { schedeCambiate } from "../src/lib/library.js";

export default async function (t) {
  const prima = [{ id: "a", title: "Elric", saga: "" }, { id: "b", title: "Kane", saga: "" }, { id: "c", title: "Babel" }];
  const dopo = [{ id: "a", title: "Elric", saga: "Elric di Melniboné" }, { id: "b", title: "Kane", saga: "" }, { id: "c", title: "Babel" }, { id: "n", title: "Nuovo" }];
  t.eq("si timbra solo la scheda cambiata", schedeCambiate(prima, dopo).join(), "a");
  t.eq("un libro nuovo non e' cambiato (lo timbra l'import)", schedeCambiate(prima, dopo).includes("n"), false);
  t.eq("niente cambiato, niente timbri", schedeCambiate(prima, prima.map((b) => ({ ...b }))).length, 0);
  t.eq("anche il numero nella saga conta", schedeCambiate([{ id: "a", sagaOrder: 1 }], [{ id: "a", sagaOrder: 2 }]).join(), "a");
  t.eq("liste storte non rompono", schedeCambiate(null, [null, { id: "x" }]).length, 0);
}
