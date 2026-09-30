// LA VOLTATA CHE SFUMA (`sfumaDa` in lib/fumetto.js): sbaglia in silenzio
// in due modi — un lampo sulla prima apertura o a schermo girato (sfuma
// dove non c'e' niente da sfumare), o la dissolvenza a chi l'ha spenta.
import { sfumaDa, SFUMA_MS } from "../src/lib/fumetto.js";

export default async (t) => {
  const prima = { chiave: "4,5" };
  t.c("dalla coppia di prima alla nuova si sfuma", sfumaDa(prima, "6,7"));
  t.c("…anche a pagina singola", sfumaDa({ chiave: "4" }, "5"));
  t.c("la prima apertura non ha niente da sfumare", !sfumaDa(null, "1"));
  t.c("lo stesso foglio ridisegnato (schermo girato) non sfuma", !sfumaDa(prima, "4,5"));
  t.c("nel nastro si scorre, non si volta", !sfumaDa(prima, "6,7", { nastro: true }));
  t.c("spenta dal lettore, non sfuma", !sfumaDa(prima, "6,7", { acceso: false }));
  t.c("con «meno animazioni» del sistema, non sfuma", !sfumaDa(prima, "6,7", { riduci: true }));
  t.c("un soffio e non un'attesa: fra un quinto e mezzo secondo", SFUMA_MS >= 200 && SFUMA_MS <= 500);
};
