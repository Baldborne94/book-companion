// QUANTO COSTA L'ORACOLO.
//
// La chiave è del lettore e paga lui, direttamente. L'app riceveva `usage`
// in ogni risposta e lo buttava via: non c'era modo di sapere quanto si era
// speso, né quale funzione spendesse di più — e la scheda di un personaggio
// su una saga lunga manda al modello cento passaggi, mentre una parola
// spiegata ne manda venti righe.
// E QUANTO NE RESTA: il tetto del mese, che è la metà mancante. «$1,20» non
// è né poco né tanto finché non c'è un numero accanto a cui sta.
//
// Il finto storage sta PRIMA dell'import, e per questo l'import è dinamico:
// `leggiTetto` legge da localStorage, e senza il finto il modulo si
// difenderebbe da solo tornando sempre il valore di partenza — cioè il test
// passerebbe senza aver provato niente di quel che c'è da provare.
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

const {
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
  TETTO_DEFAULT,
  SCALINI,
  leggiTetto,
  scriviTetto,
  scalinoSopra,
  restaDelMese,
  oltreIlTetto,
  rigaMese,
} = await import("../src/lib/spesa.js");

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

  // =========================================================================
  // IL TETTO DEL MESE
  // =========================================================================
  const pulisci = () => {
    for (const k of Object.keys(memoria)) delete memoria[k];
  };

  // ---- ZERO È UNA SCELTA, NON UN VUOTO ----------------------------------
  // Ed è la trappola di questo modulo: `Number(null)` e `Number("")` valgono
  // tutt'e due ZERO, e zero qui vuol dire «nessun tetto». Leggendo il numero
  // senza guardare prima la stringa, uno storage in cui non è mai stato
  // scritto niente direbbe «nessun tetto» — cioè l'esatto contrario del
  // valore di partenza, e l'Oracolo non si fermerebbe mai.
  {
    pulisci();
    t.eq("senza niente scritto vale il tetto di partenza", leggiTetto(), TETTO_DEFAULT);
    t.eq("e il tetto di partenza è cinque dollari al mese", TETTO_DEFAULT, 5);
    memoria.setItem("bc_ai_tetto", "");
    t.eq("una stringa vuota non è uno zero scelto", leggiTetto(), TETTO_DEFAULT);
    memoria.setItem("bc_ai_tetto", "   ");
    t.eq("nemmeno degli spazi", leggiTetto(), TETTO_DEFAULT);
    memoria.setItem("bc_ai_tetto", "boh");
    t.eq("né qualcosa che non è un numero", leggiTetto(), TETTO_DEFAULT);
    memoria.setItem("bc_ai_tetto", "-3");
    t.eq("né un numero negativo", leggiTetto(), TETTO_DEFAULT);
    // e ADESSO lo zero, che invece deve sopravvivere
    memoria.setItem("bc_ai_tetto", "0");
    t.eq("uno zero SCRITTO vuol dire «nessun tetto» e resta", leggiTetto(), 0);
  }
  {
    pulisci();
    scriviTetto(20);
    t.eq("quel che si scrive si rilegge", leggiTetto(), 20);
    scriviTetto(0);
    t.eq("zero compreso", leggiTetto(), 0);
    scriviTetto(-1);
    t.eq("un tetto negativo non si scrive affatto", leggiTetto(), 0);
    scriviTetto("boh");
    t.eq("e nemmeno una parola", leggiTetto(), 0);
  }

  // ---- quanto resta -----------------------------------------------------
  {
    // un mese con dentro una scheda vera: 30k dentro + 1,5k fuori
    let s = vuoto();
    const q = Date.UTC(2026, 7, 21);
    s = registra(T(30000, 1500), { ora: q, stato: s });
    const speso = costo(daUsage(T(30000, 1500)));

    t.c(
      "col tetto di partenza resta quasi tutto",
      Math.abs(restaDelMese({ ora: q, stato: s, tetto: 5 }) - (5 - speso)) < 1e-9
    );
    t.c("e l'Oracolo parla ancora", !oltreIlTetto({ ora: q, stato: s, tetto: 5 }));

    // SENZA TETTO NON C'È UN RESTO: `null` e non zero, che sullo schermo si
    // leggerebbe come «hai finito» — l'esatto contrario di «nessun limite»
    t.eq("senza tetto non c'è niente da restare", restaDelMese({ ora: q, stato: s, tetto: 0 }), null);
    t.c("e non si ferma mai niente", !oltreIlTetto({ ora: q, stato: s, tetto: 0 }));

    // il tetto stretto: la sola scheda lo esaurisce
    t.c("con un tetto da dieci centesimi si è già oltre", oltreIlTetto({ ora: q, stato: s, tetto: 0.1 }));
    t.c("e il resto lo dice col segno meno", restaDelMese({ ora: q, stato: s, tetto: 0.1 }) < 0);

    // IL MESE È IL MESE: quel che hai speso ad agosto non ti chiude settembre
    t.c(
      "un mese nuovo riparte col tetto intero",
      Math.abs(restaDelMese({ ora: Date.UTC(2026, 8, 1), stato: s, tetto: 5 }) - 5) < 1e-9
    );
    t.c("e l'Oracolo riprende da solo", !oltreIlTetto({ ora: Date.UTC(2026, 8, 1), stato: s, tetto: 0.1 }));

    // un mese senza domande: `riassunto().mese` è `null`, e `costo(null)`
    // deve valere zero invece di sporcare il conto
    t.c(
      "un mese in cui non hai chiesto niente ha il tetto intero",
      Math.abs(restaDelMese({ ora: Date.UTC(2030, 0, 1), stato: vuoto(), tetto: 5 }) - 5) < 1e-9
    );
  }

  // ---- il gradino sopra --------------------------------------------------
  {
    t.eq("da cinque si sale a dieci", scalinoSopra(5), 10);
    t.eq("da dieci a venti", scalinoSopra(10), 20);
    t.eq("da venti a cinquanta", scalinoSopra(20), 50);
    // LO ZERO DELLA SCALA NON È «SOPRA»: è «nessun tetto», che è un'altra
    // cosa, e ci si arriva scegliendolo. Offrirlo come gradino successivo
    // vorrebbe dire togliere il limite col tasto che dovrebbe alzarlo.
    t.eq("oltre l'ultimo gradino si raddoppia, non si toglie il tetto", scalinoSopra(50), 100);
    t.c("e il tasto non offre mai «nessuno»", SCALINI.filter((s) => s > 0).every((s) => scalinoSopra(s) > 0));
    // un valore in mezzo ai gradini sale al primo che lo supera
    t.eq("un tetto fuori scala sale al gradino che lo supera", scalinoSopra(7), 10);
    // senza tetto non c'è un sopra
    t.eq("senza tetto non c'è un gradino sopra", scalinoSopra(0), null);
    t.eq("né con un valore storto", scalinoSopra("boh"), null);
    t.c("e lo zero c'è, in fondo alla scala", SCALINI.includes(0));
  }

  // ---- la riga del mese --------------------------------------------------
  {
    let s = vuoto();
    const q = Date.UTC(2026, 7, 21);
    s = registra(T(30000, 1500), { ora: q, stato: s });

    const con = rigaMese({ ora: q, stato: s, tetto: 5 });
    t.c("dice quanto hai speso", /questo mese \$0,1\d/.test(con), con);
    t.c("in quante domande", /in 1 domanda/.test(con), con);
    t.c("E QUANTO TI RESTA, che è la metà che mancava", /restano \$4,8\d di \$5/.test(con), con);

    // SENZA TETTO NON SI SCRIVE «RESTANO»: senza un limite quella parola non
    // vuol dire niente, e un «restano $0» suonerebbe come «hai finito»
    const senza = rigaMese({ ora: q, stato: s, tetto: 0 });
    t.c("senza tetto resta il solo speso", /questo mese/.test(senza) && !/restano/.test(senza), senza);

    // OLTRE IL TETTO NON SI SCRIVE UN RESTO NEGATIVO: si dice che è finito
    const finito = rigaMese({ ora: q, stato: s, tetto: 0.1 });
    t.c("finito il tetto lo si dice a parole", /il tetto di \$0,10 è finito/.test(finito), finito);
    t.c("e non con un numero negativo", !/-/.test(finito), finito);

    // un mese muto non ha una riga: non c'è ancora niente da dire
    t.eq("un mese senza domande non ha una riga", rigaMese({ ora: Date.UTC(2030, 0, 1), stato: vuoto() }), null);

    // le domande si contano al plurale quando sono più d'una
    let due = vuoto();
    due = registra(T(1000, 100), { ora: q, stato: due });
    due = registra(T(1000, 100), { ora: q, stato: due });
    t.c("due domande sono «domande»", /in 2 domande/.test(rigaMese({ ora: q, stato: due, tetto: 5 })));
  }

  // ---- IL FRENO: LA DOMANDA NON PARTE ------------------------------------
  //
  // È la parte che rende il tetto un tetto. Un limite che lascia partire la
  // richiesta e poi si lamenta ha già speso i soldi: quel che si prova qui
  // non è il messaggio, è che il `fetch` NON viene chiamato.
  //
  // Il freno sta in `chiedi`, che è l'unico punto da cui passano tutte le
  // domande — spiegazione, scheda personaggio, «Dove eravamo rimasti»,
  // «Prima di cominciare». Messo in ognuna, la prossima se lo dimentica.
  {
    const { chiedi, setOracleKey } = await import("../src/lib/oracle.js");
    const risposta = {
      ok: true,
      status: 200,
      json: async () => ({
        content: [{ type: "text", text: "eccomi" }],
        stop_reason: "end_turn",
        usage: { input_tokens: 30000, output_tokens: 1500 },
      }),
    };
    const spia = () => {
      const f = async () => {
        f.chiamate++;
        return risposta;
      };
      f.chiamate = 0;
      return f;
    };

    pulisci();
    // SENZA CHIAVE NON C'È NIENTE DA SPENDERE: il controllo della chiave
    // resta davanti a quello del tetto, o chi non ha ancora una chiave si
    // vedrebbe dire che ha finito il budget
    {
      const f = spia();
      const out = await chiedi({ system: "s", user: "u" }, f);
      t.eq("senza chiave si chiede la chiave", out.error, "chiave");
      t.eq("e non si chiama nessuno", f.chiamate, 0);
    }

    setOracleKey("sk-ant-finta");
    scriviTetto(5);

    // sotto il tetto la domanda parte
    {
      const f = spia();
      const out = await chiedi({ system: "s", user: "u" }, f);
      t.eq("sotto il tetto l'Oracolo risponde", out.answer, "eccomi");
      t.eq("e la domanda è partita davvero", f.chiamate, 1);
      // e la spesa si è segnata: è il giro che porta il mese verso il tetto
      t.c("la spesa si segna", riassunto().mese.chiamate >= 1);
    }

    // ora si sfonda il tetto a mano, e la domanda NON deve partire
    {
      scriviTetto(0.001);
      const f = spia();
      const out = await chiedi({ system: "s", user: "u" }, f);
      t.eq("finito il tetto, l'Oracolo si ferma", out.error, "tetto");
      t.eq("E LA DOMANDA NON PARTE: il conto non si paga per sentirsi dire di no", f.chiamate, 0);
      t.eq("la scheda riceve il tetto per poterlo dire", out.tettoMese, 0.001);
      t.c("e quanto si è sforato", out.resta < 0, String(out.resta));
    }

    // ALZARE IL TETTO È L'UNICA STRADA, ed è quella che il tasto offre: si
    // prova che rimette davvero in cammino, o il tasto sarebbe un ornamento
    {
      scriviTetto(scalinoSopra(5));
      const f = spia();
      const out = await chiedi({ system: "s", user: "u" }, f);
      t.eq("alzato il tetto si riparte", out.answer, "eccomi");
      t.eq("e stavolta la domanda parte", f.chiamate, 1);
    }

    // e «nessun tetto» non ferma mai niente
    {
      scriviTetto(0);
      const f = spia();
      const out = await chiedi({ system: "s", user: "u" }, f);
      t.eq("senza tetto non ci si ferma mai", out.answer, "eccomi");
      t.eq("nemmeno con un mese già speso", f.chiamate, 1);
    }
  }
  pulisci();
}
