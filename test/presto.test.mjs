// LA MODIFICA PARTE DA SOLA (`sincronizzaPresto` in `lib/presto.js`).
// Sbaglia in silenzio: la saga scritta sul PC resta sul PC finche'
// qualcuno non chiude l'app (segnalato: undici libri «Fuori saga» sul
// tablet), oppure ogni tasto fa partire un giro intero.
import { sincronizzaPresto } from "../src/lib/presto.js";

function orologioFinto() {
  let ora = 0;
  let prossimo = 1;
  const attese = new Map();
  return {
    setTimeout: (f, ms) => { attese.set(prossimo, { f, quando: ora + ms }); return prossimo++; },
    clearTimeout: (id) => attese.delete(id),
    avanza(ms) {
      const fine = ora + ms;
      for (;;) {
        const pronte = [...attese.entries()].filter(([, a]) => a.quando <= fine).sort((x, y) => x[1].quando - y[1].quando);
        if (!pronte.length) break;
        const [id, a] = pronte[0];
        attese.delete(id);
        ora = a.quando;
        a.f();
      }
      ora = fine;
    },
  };
}

export default async function (t) {
  const o = orologioFinto();
  let giri = 0;
  let occupato = false;
  const tira = sincronizzaPresto(() => (giri += 1), { attesa: 3000, occupato: () => occupato, orologio: o });

  tira();
  o.avanza(2999);
  t.eq("non subito", giri, 0);
  o.avanza(1);
  t.eq("dopo un attimo parte da solo", giri, 1);

  tira(); o.avanza(1000); tira(); o.avanza(1000); tira();
  o.avanza(3000);
  t.eq("una raffica di modifiche fa UN giro", giri, 2);

  occupato = true;
  tira();
  o.avanza(3000);
  t.eq("con un giro in corso non ne parte un altro", giri, 2);
  occupato = false;
  o.avanza(3000);
  t.eq("…ma parte appena quello finisce: la modifica non si perde", giri, 3);

  tira();
  tira.ferma();
  o.avanza(10000);
  t.eq("fermato, non parte", giri, 3);
}
