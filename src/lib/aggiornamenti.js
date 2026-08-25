// IL CONTROLLO AGGIORNAMENTI COL DITO.
//
// La versione in fondo alla Libreria dice quale build gira, ma non c'era
// modo di CHIEDERE «sono all'ultima?»: il service worker sta in modalità
// prompt, la ronda passa ogni mezz'ora, e il lettore restava col dubbio
// («siamo sicuri che gli ultimi aggiornamenti siano stati portati sul
// main? perché non vedo aggiornamenti sul tablet»). Il tasto risponde
// subito, e con una parola chiara per ogni esito.
//
// La trappola sta nei tempi: `update()` risolve quando il CONTROLLO è
// avviato, non quando è finito — il worker nuovo può comparire un attimo
// dopo. Fidarsi del silenzio al primo giro direbbe «sei all'ultima»
// proprio mentre la versione nuova sta scaricando. Per questo il primo
// tratto di attesa non conclude niente.
export async function cercaNuovaVersione(reg, { attesa = 8000, passo = 250, dormi } = {}) {
  if (!reg || typeof reg.update !== "function") return "niente-sw";
  // già in attesa da un giro precedente (la ronda, un altro tab): c'è
  if (reg.waiting) return "nuova";
  try {
    await reg.update();
  } catch {
    // di norma è la rete che manca: non «sei all'ultima», «non so dirtelo»
    return "errore";
  }
  const aspetta = dormi || ((ms) => new Promise((r) => setTimeout(r, ms)));
  let speso = 0;
  while (speso < attesa) {
    if (reg.waiting) return "nuova";
    if (!reg.installing && speso >= passo * 2) return "ultima";
    await aspetta(passo);
    speso += passo;
  }
  // il tempo è scaduto con un worker ancora in installazione: sta
  // arrivando, e dirlo è più onesto che dire «ultima»
  return reg.installing ? "nuova" : "ultima";
}

// le parole per ogni esito, qui e non nel componente: un esito senza la
// sua frase è un tasto che tace, e un test lo pretende
export const ESITI_CONTROLLO = {
  cerco: "Guardo se c'è una versione nuova…",
  nuova: "Trovata una versione nuova: la installo…",
  ultima: "Sei già all'ultima versione ✓",
  errore: "Non riesco a controllare: la rete non risponde",
  "niente-sw": "Qui gli aggiornamenti non passano dal service worker: ricarica la pagina",
};
