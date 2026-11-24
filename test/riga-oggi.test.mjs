// LA RIGA DI OGGI SULL'INGRESSO (`pezziDiOggi` in `tempo.js`): tempo di
// oggi, giorni di fila, passo dell'obiettivo. Sbaglia in silenzio: uno zero
// detto e' rumore, un giorno contato male e' una serie che mente.
import { pezziDiOggi, giornoDi } from "../src/lib/tempo.js";
import { passoObiettivo } from "../src/lib/obiettivo.js";

export default async function (t) {
  const oggi = new Date(2026, 8, 28, 18).getTime();
  const g = (d) => giornoDi(new Date(2026, 8, 28 - d, 12).getTime());

  t.eq("niente letto, niente obiettivo: la riga tace", pezziDiOggi({}, null, oggi).length, 0);

  const solo = pezziDiOggi({ tab: { [g(0)]: 25 * 60 } }, null, oggi);
  t.eq("oggi 25 minuti, e un giorno solo non e' una serie", solo.join("|"), "Oggi 25 min");

  t.eq(
    "meno di un minuto non si dice",
    pezziDiOggi({ tab: { [g(0)]: 50 } }, null, oggi).length,
    0
  );

  const due = pezziDiOggi({ tab: { [g(0)]: 400 }, tel: { [g(0)]: 400 } }, null, oggi);
  t.eq("i dispositivi si sommano", due[0], "Oggi 13 min");

  const fila = pezziDiOggi({ tab: { [g(0)]: 600, [g(1)]: 600, [g(2)]: 600, [g(4)]: 600 } }, null, oggi);
  t.eq("tre giorni di fila, il buco ferma la serie", fila.join("|"), "Oggi 10 min|3 giorni di fila");

  const ieri = pezziDiOggi({ tab: { [g(1)]: 600, [g(2)]: 600 } }, null, oggi);
  t.eq("stamattina la serie di ieri e' ancora viva", ieri.join("|"), "2 giorni di fila");

  const inPari = pezziDiOggi({}, passoObiettivo(20, 24, 2026, oggi), oggi);
  t.eq("il passo, non il conto (lo dice la porta del diario)", inPari.join("|"), "obiettivo: 2 libri avanti sulla tabella di marcia (20 letti, a oggi ne bastavano 18)");
  t.c("…e il conto «20 di 24» non si ripete", !inPari[0].includes("24"));

  const fatto = pezziDiOggi({}, passoObiettivo(24, 24, 2026, oggi), oggi);
  t.eq("obiettivo raggiunto", fatto.join("|"), "obiettivo raggiunto ✨");

  t.eq("senza obiettivo nessun pezzo del passo", pezziDiOggi({}, passoObiettivo(3, 0, 2026, oggi), oggi).length, 0);
}
