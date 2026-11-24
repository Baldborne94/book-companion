// IL PASSO DI LETTURA, e il «quanto manca» che ne esce.
//
// L'app misura quanto ci metti a voltare pagina e da lì dice quanto manca
// alla fine. È una stima, e una stima sbagliata non alza nessun errore: dice
// un numero, e il numero sembra vero. Le regole che la tengono onesta sono
// tre, e stavano tutte scritte nei nomi delle costanti e in nessun test.
//
// Ce n'è poi una quarta che non si vede affatto guardando questo file: il
// valore di ritorno di `pushSample` è un SEGNALE, e il chiamante lo legge
// per identità. Un rewrite che tornasse sempre un array nuovo non
// romperebbe niente di visibile — farebbe solo salvare su disco e
// ridisegnare a ogni voltata scartata.
const memoria = {};
for (const [nome, fn] of Object.entries({
  getItem: (k) => (k in memoria ? memoria[k] : null),
  setItem: (k, v) => {
    memoria[k] = String(v);
  },
  removeItem: (k) => {
    delete memoria[k];
  },
})) {
  Object.defineProperty(memoria, nome, { value: fn, enumerable: false });
}
globalThis.localStorage = memoria;

const { pushSample, medianMs, formatLeft, loadSamples, saveSamples } = await import(
  "../src/lib/readingSpeed.js"
);

export default async function (t) {
  // =======================================================================
  // QUALI VOLTATE CONTANO
  // =======================================================================
  //
  // Una voltata più rapida di due secondi e mezzo non è lettura: stai
  // sfogliando, o cercando qualcosa. Una più lenta di quattro minuti vuol
  // dire che hai posato il libro. Prese per buone, tutt'e due sballerebbero
  // la stima — e quella del ritorno dal caffè la sballerebbe di parecchio.
  {
    t.eq("mezzo secondo non è una lettura", pushSample([], 500).length, 0);
    t.eq("nemmeno due secondi e mezzo meno uno", pushSample([], 2499).length, 0);
    t.eq("ma due secondi e mezzo sì", pushSample([], 2500).length, 1);
    t.eq("mezzo minuto è la norma", pushSample([], 30000)[0], 30000);
    t.eq("quattro minuti sono il limite", pushSample([], 240000).length, 1);
    t.eq("e appena oltre non conta più", pushSample([], 240001).length, 0);
    t.eq("una pausa lunga non è una voltata", pushSample([], 999999).length, 0);
  }
  {
    // un tempo che non è un tempo non deve entrare nel conto: una mediana
    // con un NaN dentro non torna più indietro
    t.eq("un tempo negativo", pushSample([], -5).length, 0);
    t.eq("un NaN", pushSample([], NaN).length, 0);
    t.eq("un tempo che non c'è", pushSample([], undefined).length, 0);
    t.c("e niente NaN fra i campioni", pushSample([], 3000).every(Number.isFinite));
  }

  // =======================================================================
  // IL VALORE DI RITORNO È UN SEGNALE, E SI LEGGE PER IDENTITÀ
  // =======================================================================
  //
  // Il reader fa `if (next === campioni) return;` — cioè usa l'IDENTITÀ
  // dell'array per capire che non è cambiato niente e saltare il salvataggio
  // e il ridisegno. Se `pushSample` tornasse una copia anche quando scarta,
  // il confronto fallirebbe sempre: ogni voltata troppo rapida scriverebbe
  // su disco e farebbe ridisegnare la pagina, senza che niente lo dica.
  {
    const prima = [3000, 4000];
    t.c("un campione scartato torna LO STESSO array", pushSample(prima, 100) === prima);
    t.c("e uno accettato ne torna uno nuovo", pushSample(prima, 3000) !== prima);
    // e l'array di partenza non si tocca mai
    t.eq("i campioni di prima restano com'erano", JSON.stringify(prima), "[3000,4000]");
  }
  {
    // SI TENGONO GLI ULTIMI QUATTORDICI: il passo di stasera vale più di
    // quello di tre settimane fa, e una media su tutta la vita del libro non
    // seguirebbe mai un cambio di ritmo
    const pieno = Array.from({ length: 14 }, (_, i) => 3000 + i);
    const dopo = pushSample(pieno, 9000);
    t.eq("il numero non cresce", dopo.length, 14);
    t.eq("il più vecchio se ne va", dopo[0], 3001);
    t.eq("e l'ultimo è quello nuovo", dopo[13], 9000);
  }

  // =======================================================================
  // LA MEDIANA, E PERCHÉ SERVONO ALMENO QUATTRO CAMPIONI
  // =======================================================================
  //
  // Con una o due voltate il numero c'è ma non vuol dire niente, e mostrare
  // «restano 4 ore» calcolate su due pagine è peggio che non mostrare
  // niente: `null` fa sparire la riga, un numero inventato la riempie di una
  // bugia che sembra una misura.
  {
    t.eq("senza campioni niente", medianMs([]), null);
    t.eq("con uno niente", medianMs([3000]), null);
    t.eq("con tre ancora niente", medianMs([3000, 4000, 5000]), null);
    t.eq("da quattro in su si può dire", medianMs([3000, 4000, 5000, 6000]), 4500);
  }
  {
    // LA MEDIANA E NON LA MEDIA, ed è tutto il punto: una sola pausa lunga —
    // una telefonata a metà capitolo — sposterebbe una media di parecchio,
    // la mediana non la sente
    const normali = [3000, 3100, 3200, 3300, 3400];
    const conPausa = [...normali, 200000];
    t.eq("cinque voltate regolari", medianMs(normali), 3200);
    t.c(
      "e una pausa lunga in mezzo la sposta appena",
      Math.abs(medianMs(conPausa) - 3200) < 200,
      String(medianMs(conPausa))
    );
  }
  {
    // l'ordine d'arrivo non conta: i campioni arrivano come capita
    t.eq("i campioni si ordinano da soli", medianMs([5000, 3000, 9000, 4000, 8000]), 5000);
    // e l'array di partenza non si tocca — questi campioni stanno anche
    // nello stato del reader, e riordinarglieli sotto sarebbe una modifica
    // silenziosa a quel che verrà salvato
    const s = [5000, 3000, 9000, 4000];
    medianMs(s);
    t.eq("senza riordinare l'originale", JSON.stringify(s), "[5000,3000,9000,4000]");
    t.eq("senza campioni non esplode", medianMs(null), null);
  }

  // =======================================================================
  // COME SI SCRIVE «QUANTO MANCA»
  // =======================================================================
  {
    // SOTTO IL MINUTO NON SI SCRIVE UN NUMERO: «1 min» quando ne mancano
    // dieci secondi è falso, e «0 min» è peggio
    t.eq("pochi secondi", formatLeft(1000), "meno di un minuto");
    t.eq("fino a tre quarti di minuto", formatLeft(44999), "meno di un minuto");
    t.eq("e da lì il minuto si scrive", formatLeft(45000), "1 min");
    t.eq("un minuto e mezzo si arrotonda a due", formatLeft(90000), "2 min");
    t.eq("i minuti arrivano fino a 59", formatLeft(3540000), "59 min");
  }
  {
    // e da un'ora in su si scrive in ore, che è come si ragiona davvero
    t.eq("un'ora tonda non porta i minuti", formatLeft(3600000), "1 h");
    t.eq("un'ora e un minuto sì", formatLeft(3660000), "1 h 1 min");
    t.eq("due ore tonde", formatLeft(7200000), "2 h");
    t.eq("due ore e un minuto", formatLeft(7260000), "2 h 1 min");
  }

  // =======================================================================
  // DUE CASSETTI, PERCHÉ UNA PAGINA A4 NON È UNA SCHERMATA DI LIBRO
  // =======================================================================
  //
  // Mescolare i due passi sballerebbe tutt'e due le stime: su un PDF una
  // «pagina» è un foglio intero, su un EPUB è quel che ci sta nel vetro.
  {
    for (const k of Object.keys(memoria)) delete memoria[k];
    saveSamples([1000, 2000, 3000], "pdf");
    saveSamples([9000, 9000], "epub");
    t.eq("il passo dei PDF", JSON.stringify(loadSamples("pdf")), "[1000,2000,3000]");
    t.eq("e quello degli EPUB, per conto suo", JSON.stringify(loadSamples("epub")), "[9000,9000]");
    t.eq("il cassetto senza nome è un terzo cassetto", loadSamples().length, 0);
  }
  {
    // quel che è salvato può essere qualunque cosa: un archivio vecchio, un
    // altro dispositivo, una mano che ha modificato lo storage
    localStorage.setItem("bc_speed_pdf", '["a", 3000, null, 4000]');
    t.eq("quel che non è un numero si butta", JSON.stringify(loadSamples("pdf")), "[3000,4000]");
    localStorage.setItem("bc_speed_pdf", "non json");
    t.eq("un json rotto non è un guasto, è un cassetto vuoto", loadSamples("pdf").length, 0);
    localStorage.setItem("bc_speed_pdf", '{"non":"un elenco"}');
    t.eq("nemmeno un oggetto al posto dell'elenco", loadSamples("pdf").length, 0);
    for (const k of Object.keys(memoria)) delete memoria[k];
    t.eq("e un cassetto mai scritto è vuoto", loadSamples("pdf").length, 0);
  }
  {
    // il giro completo: quel che si salva si rilegge, e la mediana torna
    for (const k of Object.keys(memoria)) delete memoria[k];
    let campioni = [];
    for (const dt of [3000, 100, 3400, 3200, 999999, 3600]) campioni = pushSample(campioni, dt);
    saveSamples(campioni, "epub");
    t.eq("le voltate buone sono quattro", loadSamples("epub").length, 4);
    t.eq("e la mediana torna dopo il salvataggio", medianMs(loadSamples("epub")), medianMs(campioni));
  }
  for (const k of Object.keys(memoria)) delete memoria[k];
}
