// IL CONTROLLO AGGIORNAMENTI COL DITO.
//
// La parte che si sbaglia sono i TEMPI: `update()` risolve a controllo
// avviato, non finito, e il worker nuovo può comparire un attimo dopo.
// Fidarsi del silenzio al primo giro direbbe «sei all'ultima» proprio
// mentre la versione nuova sta scaricando.
import { cercaNuovaVersione, ESITI_CONTROLLO } from "../src/lib/aggiornamenti.js";

// una registrazione finta: `copione` è la sequenza degli stati che il
// browser attraverserebbe, un passo per ogni giro d'attesa
function regFinta(copione, { updateEsplode } = {}) {
  let i = 0;
  const reg = {
    installing: null,
    waiting: null,
    update: async () => {
      if (updateEsplode) throw new Error("niente rete");
      applica();
    },
  };
  const applica = () => {
    const s = copione[Math.min(i, copione.length - 1)] || {};
    reg.installing = s.installing || null;
    reg.waiting = s.waiting || null;
  };
  const dormi = async () => {
    i += 1;
    applica();
  };
  applica();
  return { reg, dormi };
}

const W = { chi: "worker" };

export default async function (t) {
  // ---- gli esiti hanno tutti la loro frase ------------------------------
  for (const esito of ["cerco", "nuova", "ultima", "errore", "niente-sw"]) {
    t.c(`l'esito «${esito}» sa parlare`, typeof ESITI_CONTROLLO[esito] === "string" && ESITI_CONTROLLO[esito].length > 4);
  }

  // ---- i casi semplici ---------------------------------------------------
  t.eq("senza registrazione si dice che il worker non c'è", await cercaNuovaVersione(null), "niente-sw");
  t.eq("e anche con un oggetto che non sa aggiornarsi", await cercaNuovaVersione({}), "niente-sw");

  let f = regFinta([{}], { updateEsplode: true });
  t.eq("update che esplode = errore, non «ultima»", await cercaNuovaVersione(f.reg, { dormi: f.dormi }), "errore");

  // un worker già in attesa (la ronda l'ha trovato prima): non si
  // ricontrolla nemmeno
  f = regFinta([{ waiting: W }]);
  t.eq("un worker già in attesa è «nuova»", await cercaNuovaVersione(f.reg, { dormi: f.dormi }), "nuova");

  // ---- i tempi, che sono la parte vera ----------------------------------
  // nessuna novità: silenzio stabile → «ultima»
  f = regFinta([{}, {}, {}, {}]);
  t.eq("silenzio stabile = «ultima»", await cercaNuovaVersione(f.reg, { dormi: f.dormi, attesa: 2000, passo: 250 }), "ultima");

  // IL WORKER NUOVO COMPARE UN ATTIMO DOPO: al primo giro non c'è niente,
  // al secondo sta installando, poi va in attesa. Il silenzio del primo
  // giro NON deve chiudere il controllo.
  f = regFinta([{}, { installing: W }, { installing: W }, { waiting: W }]);
  t.eq(
    "il worker che compare in ritardo si vede lo stesso",
    await cercaNuovaVersione(f.reg, { dormi: f.dormi, attesa: 2000, passo: 250 }),
    "nuova"
  );

  // installazione che non finisce entro l'attesa: sta arrivando, e dirlo
  // è più onesto di «ultima»
  f = regFinta([{ installing: W }]);
  t.eq(
    "installazione lenta = comunque «nuova»",
    await cercaNuovaVersione(f.reg, { dormi: f.dormi, attesa: 1000, passo: 250 }),
    "nuova"
  );

  // e il giro intero: installa e poi resta in attesa → «nuova»
  f = regFinta([{ installing: W }, { installing: W }, { waiting: W }]);
  t.eq(
    "installa e va in attesa = «nuova»",
    await cercaNuovaVersione(f.reg, { dormi: f.dormi, attesa: 2000, passo: 250 }),
    "nuova"
  );
}
