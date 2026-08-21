// QUANTO COSTA L'ORACOLO.
//
// La chiave è del lettore e paga lui, direttamente. L'app riceveva `usage`
// in ogni risposta e lo buttava via: non c'era modo di sapere quanto si era
// speso, né quale funzione spendesse di più — e la scheda di un personaggio
// su una saga lunga manda al modello cento passaggi, mentre una parola
// spiegata ne manda venti righe.
import {
  TARIFFE,
  daUsage,
  costo,
  somma,
  meseDi,
  registra,
  riassunto,
  tokenCorti,
  soldi,
  rigaUltima,
  MESI_TENUTI,
} from "../src/lib/spesa.js";

const vuoto = () => ({ mesi: {}, ultima: null });
const T = (d, m, cw = 0, cr = 0) => ({
  input_tokens: d,
  output_tokens: m,
  cache_creation_input_tokens: cw,
  cache_read_input_tokens: cr,
});

export default async function (t) {
  // ---- i token si leggono da `usage`, e non diventano mai NaN -----------
  // un conto che diventa NaN si porta dietro tutta la somma e non torna
  // più indietro: il totale resterebbe rotto per sempre
  const u = daUsage(T(1000, 200));
  t.eq("i token in entrata", u.dentro, 1000);
  t.eq("quelli in uscita", u.fuori, 200);
  t.eq("un `usage` che non arriva vale zero", daUsage(undefined).dentro, 0);
  t.eq("un campo mancante pure", daUsage({ input_tokens: 5 }).fuori, 0);
  t.c("e niente NaN in giro", Object.values(daUsage({ input_tokens: "boh" })).every(Number.isFinite));
  t.eq("un numero negativo non toglie soldi", daUsage({ input_tokens: -50 }).dentro, 0);

  // ---- IL COSTO, sulle tariffe dichiarate -------------------------------
  // un milione dentro costa esattamente la tariffa: se questo non torna,
  // non torna niente
  t.c("un milione in entrata costa la sua tariffa", Math.abs(costo(daUsage(T(1e6, 0))) - TARIFFE.dentro) < 1e-9);
  t.c("e uno in uscita la sua", Math.abs(costo(daUsage(T(0, 1e6))) - TARIFFE.fuori) < 1e-9);
  // L'USCITA COSTA PIÙ DELL'ENTRATA: se le due tariffe si scambiassero, la
  // scheda lunga sembrerebbe costare quanto una parola
  t.c("l'uscita costa più dell'entrata", TARIFFE.fuori > TARIFFE.dentro);
  // la cache ha tariffe sue: oggi l'app non la usa e quei campi arrivano a
  // zero, ma il giorno che si accende il conto non deve cominciare a mentire
  t.c("scrivere in cache costa più dell'entrata normale", TARIFFE.cacheScritta > TARIFFE.dentro);
  t.c("leggerla costa molto meno", TARIFFE.cacheLetta < TARIFFE.dentro);
  t.c(
    "e la cache entra davvero nel conto",
    costo(daUsage(T(0, 0, 1e6, 0))) > 0 && costo(daUsage(T(0, 0, 0, 1e6))) > 0
  );
  t.eq("niente token, niente costo", costo(daUsage(T(0, 0))), 0);

  // una scheda vera: 30k dentro, 1.5k fuori
  const scheda = costo(daUsage(T(30000, 1500)));
  t.c("una scheda intera costa qualche centesimo", scheda > 0.1 && scheda < 0.3, scheda.toFixed(4));

  // ---- il conto si tiene per mese ---------------------------------------
  t.eq("il mese è anno-mese", meseDi(Date.UTC(2026, 7, 21)), "2026-08");

  let stato = vuoto();
  const ora = Date.UTC(2026, 7, 21);
  stato = registra(T(1000, 100), { ora, stato });
  stato = registra(T(2000, 300), { ora, stato });
  t.eq("i token si sommano nel mese", stato.mesi["2026-08"].dentro, 3000);
  t.eq("e le domande si contano", stato.mesi["2026-08"].chiamate, 2);
  // L'ULTIMA RICHIESTA SI TIENE A PARTE: senza, il totale sarebbe un numero
  // senza dettaglio e non diresti mai quale funzione spende
  t.eq("l'ultima è l'ultima, non la somma", stato.ultima.dentro, 2000);

  // un mese nuovo non si mescola col precedente
  stato = registra(T(500, 50), { ora: Date.UTC(2026, 8, 2), stato });
  t.eq("settembre è un altro mese", stato.mesi["2026-09"].dentro, 500);
  t.eq("e agosto resta com'era", stato.mesi["2026-08"].dentro, 3000);

  // ---- UNA RISPOSTA CHE NON HA CONSUMATO NIENTE NON È SUCCESSA ---------
  // contarla gonfierebbe il numero delle domande senza aggiungere un
  // centesimo, e il conto direbbe una cosa falsa
  const prima = stato.mesi["2026-09"].chiamate;
  const dopo = registra(T(0, 0), { ora: Date.UTC(2026, 8, 3), stato });
  t.eq("un `usage` vuoto non si registra", dopo, null);
  t.eq("e non conta come domanda", stato.mesi["2026-09"].chiamate, prima);

  // ---- il riassunto -----------------------------------------------------
  const r = riassunto({ ora: Date.UTC(2026, 8, 10), stato });
  t.eq("il mese in corso è quello di adesso", r.mese.dentro, 500);
  t.eq("il totale li tiene tutti", r.totale.dentro, 3500);
  t.eq("con tutte le domande", r.totale.chiamate, 3);
  // un mese in cui non hai chiesto niente non deve dire «$0»: non c'è
  // ancora niente da dire
  const zero = riassunto({ ora: Date.UTC(2027, 0, 1), stato });
  t.eq("un mese senza domande non ha un conto", zero.mese, null);
  t.eq("ma il totale c'è ancora", zero.totale.chiamate, 3);
  t.eq("e senza niente registrato, niente totale", riassunto({ stato: vuoto() }).totale, null);

  // ---- i mesi vecchi se ne vanno: è un conto, non un archivio -----------
  let lungo = vuoto();
  for (let m = 0; m < 20; m++) lungo = registra(T(100, 10), { ora: Date.UTC(2025, m, 5), stato: lungo });
  t.eq("si tengono solo gli ultimi mesi", Object.keys(lungo.mesi).length, MESI_TENUTI);
  const rimasti = Object.keys(lungo.mesi).sort();
  t.c("e sono i più recenti", rimasti[rimasti.length - 1] === "2026-08", rimasti.join(" "));

  // ---- come si scrive un numero -----------------------------------------
  t.eq("sotto il migliaio, la cifra", tokenCorti(842), "842");
  t.eq("qualche migliaio", tokenCorti(1500), "1,5k");
  t.eq("parecchie migliaia", tokenCorti(30000), "30k");
  t.eq("e i milioni", tokenCorti(2400000), "2,4M");

  // SOTTO IL CENTESIMO NON SI SCRIVE «$0,00», che sembra gratis e non lo è
  t.eq("una spesa piccolissima si dichiara", soldi(0.004), "meno di $0,01");
  t.eq("un centesimo è un centesimo", soldi(0.01), "$0,01");
  t.eq("la virgola è quella italiana", soldi(1.5), "$1,50");
  t.eq("zero è zero davvero", soldi(0), "$0");

  // ---- la riga sotto la risposta ----------------------------------------
  const riga = rigaUltima(daUsage(T(30000, 1500)));
  t.c("dice i token in entrata", /30k dentro/.test(riga), riga);
  t.c("quelli in uscita", /1,5k fuori/.test(riga), riga);
  t.c("e quanto è costata", /\$/.test(riga), riga);
  t.eq("senza conto, nessuna riga", rigaUltima(null), null);

  // ---- somma -------------------------------------------------------------
  t.eq("sommare a niente dà il conto stesso", somma(null, { dentro: 5 }).dentro, 5);
  t.eq("e le chiamate partono da zero", somma(null, { dentro: 5 }).chiamate, 0);
}
