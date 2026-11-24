// LE SCHEDE CAMBIATE SI TIMBRANO, E SOLO LORO (`schedeCambiate` e
// `schedaDiversa` in `lib/syncCore.js`). Sbaglia in silenzio: la saga
// trovata da sola sul PC resta sul PC (segnalato), oppure la quarta di
// copertina scaricata aprendo una scheda la timbra e questa copia, saga
// vecchia compresa, vince su quella cambiata altrove.
import { schedeCambiate, schedaDiversa } from "../src/lib/syncCore.js";

export default async function (t) {
  const prima = [{ id: "a", title: "Elric", saga: "" }, { id: "b", title: "Kane", saga: "" }, { id: "c", title: "Babel" }];
  const dopo = [{ id: "a", title: "Elric", saga: "Elric di Melniboné" }, { id: "b", title: "Kane", saga: "" }, { id: "c", title: "Babel" }, { id: "n", title: "Nuovo" }];
  t.eq("si timbra solo la scheda cambiata", schedeCambiate(prima, dopo).join(), "a");
  t.eq("un libro nuovo non e' cambiato (lo timbra l'import)", schedeCambiate(prima, dopo).includes("n"), false);
  t.eq("niente cambiato, niente timbri", schedeCambiate(prima, prima.map((b) => ({ ...b }))).length, 0);
  t.eq("anche il numero nella saga conta", schedeCambiate([{ id: "a", sagaOrder: 1 }], [{ id: "a", sagaOrder: 2 }]).join(), "a");
  t.eq("liste storte non rompono", schedeCambiate(null, [null, { id: "x" }]).length, 0);

  const libro = { id: "a", title: "Elric", saga: "", rating: 0 };
  t.c("la quarta di copertina non e' la scheda (non viaggia)", !schedaDiversa(libro, { ...libro, sinossi: "Un albino…" }));
  t.c("un campo vuoto scritto o assente e' la stessa scheda", !schedaDiversa(libro, { ...libro, fav: false, notes: "" }));
  for (const [campo, v] of [["saga", "Elric"], ["title", "Elric!"], ["author", "Moorcock"], ["rating", 4], ["notes", "bello"], ["fav", true], ["sagaTolta", true], ["fileTolto", true], ["tipo", "manga"], ["series", "Ciclo"], ["genre", "Fantasy"]]) {
    t.c(`${campo} e' la scheda`, schedaDiversa(libro, { ...libro, [campo]: v }));
  }
}
