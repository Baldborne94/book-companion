// QUANTO COSTA L'ORACOLO.
//
// La chiave e' tua e paghi tu, direttamente. Ogni «Chi e' costui?», ogni
// «Dove eravamo rimasti», ogni «Prima di cominciare» e' una richiesta vera
// con dei token veri — e su una saga lunga davanti al modello finiscono
// cento passaggi. L'app riceveva `usage` in ogni risposta e LO BUTTAVA
// VIA: non c'era modo di sapere quanto avevi speso, ne' quale funzione
// spendesse di piu'.
//
// Qui non si stima niente a naso: si sommano i token che l'API dichiara.

// Le tariffe sono di `claude-opus-5`, in dollari per MILIONE di token.
// Stanno scritte qui, in chiaro, per una ragione precisa: un numero in
// valuta senza la tariffa accanto e' un numero di cui il lettore non puo'
// verificare niente. E le tariffe cambiano — quando cambiano, si cambia
// QUI, e la riga sullo schermo continua a dire da dove esce il conto.
//
// La cache costa diversamente dal resto (scrittura piu' cara, lettura
// molto piu' economica). Oggi l'app la cache non la usa e quei due campi
// arrivano a zero, ma si contano lo stesso: il giorno che si accende, il
// conto non comincia a mentire in silenzio.
export const TARIFFE = {
  dentro: 5,
  fuori: 25,
  cacheScritta: 6.25,
  cacheLetta: 0.5,
};

export const MODELLO = "claude-opus-5";

// I nomi che l'API usa, tradotti nei nostri una volta sola. Un `usage` che
// non arriva, o che arriva monco, vale zero e non `NaN`: un conto che
// diventa NaN si porta dietro tutta la somma e non torna piu' indietro.
export function daUsage(usage) {
  const n = (v) => (Number.isFinite(v) && v > 0 ? v : 0);
  return {
    dentro: n(usage?.input_tokens),
    fuori: n(usage?.output_tokens),
    cacheScritta: n(usage?.cache_creation_input_tokens),
    cacheLetta: n(usage?.cache_read_input_tokens),
  };
}

export const VOCI = ["dentro", "fuori", "cacheScritta", "cacheLetta"];

// In dollari. Non si arrotonda qui: chi mostra decide quante cifre, e
// arrotondare adesso vorrebbe dire perdere i centesimi di ogni singola
// richiesta invece che quelli della somma.
export function costo(conto) {
  return VOCI.reduce((s, v) => s + ((conto?.[v] || 0) / 1e6) * TARIFFE[v], 0);
}

export const somma = (a, b) => {
  const out = {};
  for (const v of VOCI) out[v] = (a?.[v] || 0) + (b?.[v] || 0);
  out.chiamate = (a?.chiamate || 0) + (b?.chiamate || 0);
  return out;
};

// Il mese come chiave: «2026-08». Il conto si tiene per mese e non a
// giornata perche' e' il mese che ti arriva sulla carta, ed e' li' che il
// numero si puo' confrontare con qualcosa.
export const meseDi = (quando) => new Date(quando).toISOString().slice(0, 7);

// Quanti mesi si tengono. Oltre, il piu' vecchio se ne va: e' un conto,
// non un archivio, e tredici mesi bastano a confrontare un agosto con
// quello dell'anno prima.
export const MESI_TENUTI = 13;

const CHIAVE = "bc_ai_uso";

export function leggiSpesa() {
  try {
    const v = JSON.parse(localStorage.getItem(CHIAVE) || "null");
    return v && typeof v === "object" ? v : { mesi: {}, ultima: null };
  } catch {
    return { mesi: {}, ultima: null };
  }
}

// LA REGISTRAZIONE NON DEVE MAI FAR SALTARE UNA RISPOSTA. Il lettore ha
// appena pagato quella richiesta: se lo storage e' pieno, o negato, o il
// JSON e' rotto, si perde il conto — non la risposta.
export function registra(uso, { ora = Date.now(), stato } = {}) {
  const conto = daUsage(uso);
  // una risposta che non ha consumato niente non e' successa: contarla
  // gonfierebbe il numero delle chiamate senza aggiungere un centesimo
  if (!VOCI.some((v) => conto[v] > 0)) return null;
  const dati = stato || leggiSpesa();
  const mese = meseDi(ora);
  dati.mesi = dati.mesi || {};
  dati.mesi[mese] = somma(dati.mesi[mese], { ...conto, chiamate: 1 });
  // l'ultima richiesta si tiene a parte: e' quella che la scheda mostra
  // sotto la risposta, e senza sarebbe un totale senza dettaglio
  dati.ultima = { ...conto, quando: ora };
  const vecchi = Object.keys(dati.mesi).sort();
  for (const m of vecchi.slice(0, Math.max(0, vecchi.length - MESI_TENUTI)))
    delete dati.mesi[m];
  try {
    localStorage.setItem(CHIAVE, JSON.stringify(dati));
  } catch {
    /* il conto e' un di piu': non si porta via la risposta */
  }
  return dati;
}

// Il riassunto per lo schermo: il mese corrente, il totale di quel che
// teniamo, e l'ultima richiesta.
export function riassunto({ ora = Date.now(), stato } = {}) {
  const dati = stato || leggiSpesa();
  const mesi = dati.mesi || {};
  const questo = mesi[meseDi(ora)] || null;
  let tutto = null;
  for (const m of Object.keys(mesi)) tutto = somma(tutto, mesi[m]);
  return {
    mese: questo,
    mesi: Object.keys(mesi).length,
    totale: tutto && tutto.chiamate ? tutto : null,
    ultima: dati.ultima || null,
  };
}

// I token si scrivono corti: «14k» invece di «13.847». La cifra esatta non
// serve a nessuno, e occupa lo spazio dove sta il costo, che invece conta.
export function tokenCorti(n) {
  const v = Math.round(Number(n) || 0);
  if (v < 1000) return String(v);
  if (v < 1e6) return `${(v / 1000).toFixed(v < 10000 ? 1 : 0).replace(".", ",")}k`;
  return `${(v / 1e6).toFixed(1).replace(".", ",")}M`;
}

// SOTTO IL CENTESIMO NON SI SCRIVE «$0,00», che sembra gratis e non lo e':
// si dice «meno di un centesimo», che e' la verita' ed e' anche piu' utile.
export function soldi(dollari) {
  const d = Number(dollari) || 0;
  if (d <= 0) return "$0";
  if (d < 0.01) return "meno di $0,01";
  return `$${d.toFixed(2).replace(".", ",")}`;
}

// La riga sotto una singola risposta.
export function rigaUltima(conto) {
  if (!conto) return null;
  return `${tokenCorti(conto.dentro)} dentro · ${tokenCorti(conto.fuori)} fuori · ${soldi(costo(conto))}`;
}
