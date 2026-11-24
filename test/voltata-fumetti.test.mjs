// LA VOLTATA DEI FUMETTI (`voltataAnimata`, `scorrimento` in lib/fumetto.js).
// Quando si anima sbaglia in silenzio in due modi: un lampo sulla prima
// apertura o a schermo girato (si muove dove non c'e' niente da voltare), o
// il movimento a chi l'ha spento. E come: era una dissolvenza, e il lettore,
// col video di Kingdom, ha visto le due tavole sovrapposte («quel rimasuglio
// di pixel tra una pagina e l'altra»); ora il foglio esce di lato e il nuovo
// entra accanto, nel verso di lettura, senza mai stare uno sopra l'altro.
import { voltataAnimata, scorrimento, SCORRI_MS } from "../src/lib/fumetto.js";

export default async (t) => {
  const prima = { chiave: "4,5" };
  t.c("dalla coppia di prima alla nuova si anima", voltataAnimata(prima, "6,7"));
  t.c("…anche a pagina singola", voltataAnimata({ chiave: "4" }, "5"));
  t.c("la prima apertura non ha niente da voltare", !voltataAnimata(null, "1"));
  t.c("lo stesso foglio ridisegnato (schermo girato) non si anima", !voltataAnimata(prima, "4,5"));
  t.c("nel nastro si scorre col dito, non si volta", !voltataAnimata(prima, "6,7", { nastro: true }));
  t.c("spenta dal lettore, non si anima", !voltataAnimata(prima, "6,7", { acceso: false }));
  t.c("con «meno animazioni» del sistema, non si anima", !voltataAnimata(prima, "6,7", { riduci: true }));
  t.c("un soffio e non un'attesa: fra un quinto e un terzo di secondo", SCORRI_MS >= 200 && SCORRI_MS <= 340);

  // ---- IL VERSO ------------------------------------------------------------
  const giro = (o) => { const s = scorrimento({ largo: 902, ...o }); return `${s.esce} ${s.entra}`; };
  t.eq("un fumetto, avanti: il foglio esce a sinistra e il nuovo arriva da destra", giro({ avanti: true, verso: "ltr" }), "-902 902");
  t.eq("un fumetto, indietro: il contrario", giro({ avanti: false, verso: "ltr" }), "902 -902");
  t.eq("un manga, avanti: la pagina nuova arriva da sinistra", giro({ avanti: true, verso: "rtl" }), "902 -902");
  t.eq("un manga, indietro: da destra", giro({ avanti: false, verso: "rtl" }), "-902 902");
  t.eq("la distanza e' la larghezza dello schermo, intera", giro({ largo: 1503.4 }), "-1503 1503");
  const s = scorrimento({ largo: 902 });
  t.c("i due fogli non si sovrappongono mai: partono e arrivano a una larghezza intera di distanza", Math.abs(s.esce - 0) === 902 && Math.abs(s.entra - 0) === 902);
};
