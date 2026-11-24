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

// ---------------------------------------------------------------------------
// IL TETTO DEL MESE.
//
// Sapere quanto hai speso e' meta' della risposta: l'altra meta' e' quanto ti
// RESTA, e senza un limite quella meta' non esiste — «$1,20» non e' ne' poco
// ne' tanto finche' non c'e' un numero accanto a cui sta. Il tetto lo sceglie
// il lettore (di partenza cinque dollari al mese, chiesto da lui), e non e'
// una decorazione: quando e' finito l'Oracolo si FERMA. Un tetto che si
// limita a raccontare non e' un tetto, e' una didascalia.
//
// Sta sul dispositivo come la chiave, e per la stessa ragione: chi paga e'
// chi ha la chiave in mano, e la chiave non viaggia.

// Cinque dollari al mese. E' un valore di partenza, non una regola.
export const TETTO_DEFAULT = 5;

// I gradini offerti col dito. Sul tablet scrivere un numero vuol dire aprire
// la tastiera, che copre mezza scheda — la stessa ragione per cui i generi si
// scelgono a tasti. Lo zero e' l'ultimo gradino ed e' una scelta vera:
// «nessun tetto», non un campo lasciato vuoto.
export const SCALINI = [5, 10, 20, 50, 0];

// IL TETTO SI SCRIVE COME LO SI SCEGLIE. E' un numero tondo preso a tasti, e
// stamparlo «$5,00» accanto a un tasto che dice «$5» vuol dire chiamare la
// stessa cosa in due modi nella stessa schermata. I centesimi restano dove
// servono davvero, cioe' sulla spesa.
export const soldiTetto = (d) => (Number.isInteger(Number(d)) ? `$${Number(d)}` : soldi(d));

// Il gradino subito sopra quello che hai adesso: e' quel che offre il tasto
// quando il tetto e' finito, cosi' rimetterlo in cammino e' un tocco solo e
// non una scelta da rifare da capo. Oltre l'ultimo gradino non si inventa un
// numero tondo a caso: si raddoppia, che e' la stessa decisione che uno
// prenderebbe da se'. Lo zero della scala non conta come «sopra»: e' «nessun
// tetto», che e' un'altra cosa, e ci si arriva scegliendolo.
export function scalinoSopra(t) {
  const v = Number(t);
  if (!Number.isFinite(v) || v <= 0) return null;
  return SCALINI.filter((s) => s > v).sort((a, b) => a - b)[0] ?? Math.round(v * 2);
}

const CHIAVE_TETTO = "bc_ai_tetto";

// ZERO E' UNA SCELTA, NON UN VUOTO, e qui sta la trappola: `Number(null)` e
// `Number("")` valgono tutt'e due ZERO. Leggendo il numero senza guardare
// prima la stringa, uno storage in cui non e' mai stato scritto niente
// direbbe «nessun tetto» — cioe' l'esatto contrario del valore di partenza.
export function leggiTetto() {
  try {
    const raw = localStorage.getItem(CHIAVE_TETTO);
    if (raw === null || String(raw).trim() === "") return TETTO_DEFAULT;
    const v = Number(raw);
    return Number.isFinite(v) && v >= 0 ? v : TETTO_DEFAULT;
  } catch {
    return TETTO_DEFAULT;
  }
}

export function scriviTetto(d) {
  const v = Number(d);
  if (!Number.isFinite(v) || v < 0) return;
  try {
    localStorage.setItem(CHIAVE_TETTO, String(v));
  } catch {
    /* storage negato: si resta al tetto di prima, non si perde una risposta */
  }
}

// Quanto resta del mese, in dollari. `null` quando non c'e' un tetto: li' un
// «resto» non vuol dire niente, e scrivere zero suonerebbe come «hai finito».
// Puo' tornare NEGATIVO, ed e' giusto che lo faccia: sforare di poco succede
// (vedi `oltreIlTetto`), e un resto bloccato a zero nasconderebbe di quanto.
export function restaDelMese({ ora = Date.now(), stato, tetto } = {}) {
  const t = Number(tetto === undefined ? leggiTetto() : tetto);
  if (!Number.isFinite(t) || t <= 0) return null;
  const speso = costo(riassunto({ ora, stato }).mese);
  return t - speso;
}

// L'Oracolo puo' ancora parlare? La domanda si fa PRIMA di partire, e la
// risposta guarda quel che e' gia' stato speso — non quel che costera'
// questa richiesta, che nessuno puo' sapere prima di averla fatta. Il
// prezzo di questa onesta' e' che si puo' sforare di UNA domanda, e infatti
// la scheda dice «hai speso $5,12 di $5» invece di fingere un pareggio.
export function oltreIlTetto(opzioni) {
  const resta = restaDelMese(opzioni);
  return resta !== null && resta <= 0;
}

// La riga del mese in corso: quanto hai speso, e quanto ti resta di quel che
// ti eri dato. Senza tetto resta il solo speso.
export function rigaMese({ ora = Date.now(), stato, tetto } = {}) {
  const r = riassunto({ ora, stato });
  if (!r.mese) return null;
  const n = r.mese.chiamate;
  const base = `questo mese ${soldi(costo(r.mese))} in ${n} ${n === 1 ? "domanda" : "domande"}`;
  const t = Number(tetto === undefined ? leggiTetto() : tetto);
  const resta = restaDelMese({ ora, stato, tetto: t });
  if (resta === null) return base;
  return resta > 0
    ? `${base} · restano ${soldi(resta)} di ${soldiTetto(t)}`
    : `${base} · il tetto di ${soldiTetto(t)} è finito`;
}
