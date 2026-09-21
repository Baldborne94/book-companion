// I RACCONTI DELLE ANTOLOGIE, E LE PARTI DELLA GUIDA.
//
// Chiesto dal lettore con lo scaffale in mano: «rimettimi a posto tutta la
// Horus Heresy sotto la saga Warhammer 40K con le parti corrette e decidi
// tu come gestire le storie presenti nelle antologie nell'ordine suggerito
// dal sito».
//
// Quel che sbaglia in silenzio qui è di due specie. La SPUNTA di un
// racconto è l'unico segno che dice «questa l'ho letta» — un racconto non
// è un file e non ha uno stato — quindi una chiave storta non alza nessun
// errore: fa risultare da leggere una storia che hai letto, o peggio letta
// una che non hai mai aperto. E la PARTE, che scritta nel campo Serie
// cambia come si raggruppa lo scaffale e quanto racconta «Prima di
// cominciare».
import { chiaveRacconto, fondiRacconti } from "../src/lib/racconti.js";
import { serieDaScrivere, numerazioneGuida, campiDaScrivere } from "../src/lib/numeraCammino.js";
import { lettiDelCammino, camminoDi, postiDelCammino } from "../src/lib/cammino.js";
import { parteDiUnaStoria, gruppoDi } from "../src/lib/saga.js";
import { soloDellaSerie } from "../src/lib/trama.js";
import HORUS from "../src/data/horusHeresy.js";

const cammino = (righe) => ({
  saga: "Finta",
  // il posto si chiede alla tavola come in `camminoDi`, o il test proverebbe
  // una numerazione che nell'app non esiste
  tappe: postiDelCammino(
    righe.map(([voce, libro]) => ({ voce, libro: libro || null })),
    (v) => v?.o
  ),
});
const L = (id, extra = {}) => ({ id, title: id, ...extra });
const con = (m = {}, r = []) => ({
  statoDi: (id) => m[id] || "unread",
  progressoDi: () => 0,
  spuntati: new Set(r),
});

export default async (t) => {
  // ── LA CHIAVE DELLA SPUNTA ────────────────────────────────────────────
  {
    // TITOLO + AUTORE, mai l'indice nella tavola: quella cresce — i
    // racconti sono appena entrati — e un indice spostato farebbe
    // risultare letto un racconto mai aperto, in silenzio.
    t.eq("la chiave è titolo e autore", chiaveRacconto({ t: "The Aurelian", a: "ADB" }), "The Aurelian__ADB");
    t.eq("gli spazi ai bordi non fanno due chiavi", chiaveRacconto({ t: " X ", a: " Y " }), "X__Y");
    t.eq("un racconto senza autore ha comunque una chiave", chiaveRacconto({ t: "X" }), "X__");
    t.eq("e una voce vuota non esplode", chiaveRacconto(null), "__");
  }
  {
    // DUE RACCONTI DIVERSI CON LO STESSO TITOLO esistono davvero nel
    // 40K — ed è l'autore a separarli. Senza, spuntarne uno spunterebbe
    // anche l'altro.
    t.c(
      "titolo uguale e autore diverso sono due racconti",
      chiaveRacconto({ t: "Mortis", a: "A" }) !== chiaveRacconto({ t: "Mortis", a: "B" })
    );
  }

  // ── LA FUSIONE FRA DISPOSITIVI ────────────────────────────────────────
  {
    // UNIONE, MAI SOSTITUZIONE: la regola delle melodie. Qui non ci sono
    // lapidi, e il limite è dichiarato — una spunta tolta torna se
    // l'altro dispositivo ce l'ha. È il lato sicuro: far risultare da
    // leggere una storia letta costa una rilettura, il contrario ti fa
    // saltare una tappa senza accorgertene.
    t.eq("le spunte si uniscono", fondiRacconti(["a"], ["b"]).sort().join(","), "a,b");
    t.eq("i doppioni non si moltiplicano", fondiRacconti(["a"], ["a"]).length, 1);
    t.eq("un lato vuoto non cancella l'altro", fondiRacconti([], ["a"]).join(","), "a");
    t.eq("e niente da nessuna parte è niente", fondiRacconti().length, 0);
    t.eq("quel che non è una chiave si butta", fondiRacconti(["a", 3, null], []).length, 1);
  }

  // ── IL CONTO LI COMPRENDE ─────────────────────────────────────────────
  {
    // un racconto è un passo che la guida chiede, quindi entra nel
    // denominatore come un romanzo; l'antologia che lo contiene no, o la
    // stessa raccolta varrebbe undici tappe
    const c = cammino([
      [{ t: "Eye of Terra", tipo: "antologia" }, L("eot")],
      [{ t: "Racconto uno", a: "A", tipo: "racconto", in: "Eye of Terra" }, L("eot")],
      [{ t: "Racconto due", a: "B", tipo: "racconto", in: "Eye of Terra" }, L("eot")],
      [{ t: "Romanzo" }, L("r")],
    ]);
    const q = lettiDelCammino(c, con({ r: "read" }, ["Racconto uno__A"]));
    t.eq("i racconti contano, l'antologia no", q.quante, 3);
    t.eq("…e la spunta vale come una lettura", q.letti, 2);
    t.eq(
      "senza spunte conta solo il romanzo",
      lettiDelCammino(c, con({ r: "read" })).letti,
      1
    );
  }

  // ── IL NUMERO NON SI MUOVE ────────────────────────────────────────────
  {
    // IL PATTO CHE TIENE IN PIEDI TUTTO: il numero è il posto del volume
    // fra i VOLUMI della guida. Contando anche i racconti, ogni numero già
    // scritto in biblioteca si sposterebbe in avanti di quanti racconti
    // gli stanno davanti — e la frontiera dell'Oracolo ci crede.
    const c = cammino([
      [{ t: "Racconto", a: "A", tipo: "racconto", in: "X" }, null],
      [{ t: "Alfa", o: 1 }, L("a")],
      [{ t: "Racconto due", a: "B", tipo: "racconto", in: "X" }, null],
      [{ t: "Beta", o: 2 }, L("b")],
    ]);
    const n = numerazioneGuida(c);
    t.eq("i racconti non prendono un numero", n.length, 2);
    t.eq("il primo volume è il n° 1, non il n° 2", n[0].a, 1);
    t.eq("…e il secondo il n° 2, non il n° 4", n[1].a, 2);
  }
  {
    // E SULLA GUIDA VERA «Horus Rising» È IL PRIMO. Questo controllo
    // pinnava il quindicesimo posto — il numero della RIGA — ed è girato
    // con dentro la ragione: era il difetto che il lettore aveva già fatto
    // togliere una volta e che da questa porta era tornato. Il prologo è
    // una scelta fra quattro percorsi, non una fila di tredici, e un
    // numero che conta le righe lo fa pagare al primo romanzo della saga.
    const suoi = [{ id: "1", title: "Horus Rising", author: "", saga: "Warhammer 40K" }];
    const n = numerazioneGuida(camminoDi(suoi));
    t.eq("sulla guida vera «Horus Rising» è il n° 1", n[0].a, 1);
  }

  // ── «CE L'HAI» DI UN RACCONTO È LA SUA ANTOLOGIA ──────────────────────
  {
    // Un racconto non è un file: cercarlo per titolo non troverebbe mai
    // niente, e la guida direbbe «ti manca» su trentanove storie che hai
    // in mano. Possederlo vuol dire possedere il volume che lo contiene.
    const suoi = [{ id: "eot", title: "Eye of Terra", author: "", saga: "Warhammer 40K" }];
    const c = camminoDi(suoi);
    const r = c.tappe.find((x) => x.voce.t === "The Aurelian");
    t.eq("il racconto porta il libro della sua antologia", r.libro?.id, "eot");
    // e uno di un'antologia che non hai resta scoperto
    const altro = c.tappe.find((x) => x.voce.tipo === "racconto" && x.voce.in !== "Eye of Terra");
    t.eq("…mentre quello di un'antologia che non hai no", altro.libro, null);
    // il possesso però non si gonfia: undici racconti della stessa
    // antologia non fanno undici volumi
    t.eq("e l'antologia vale UN volume, non undici", c.tue, 1);
  }
  {
    // MA UN RACCONTO SI COMPRA ANCHE DA SOLO, e il lettore ne ha tre.
    // Cercando SOLO l'antologia — dato per scontato che un racconto non sia
    // mai un file — «Savage Weapons» comprato singolo restava fuori dal
    // cammino, con la guida che diceva «ti manca» su una storia in mano.
    const suoi = [{ id: "sw", title: "Savage Weapons", author: "", saga: "Warhammer 40K" }];
    const c = camminoDi(suoi);
    const r = c.tappe.find((x) => x.voce.t === "Savage Weapons");
    t.eq("il racconto comprato singolo è una tappa", r.libro?.id, "sw");
    // E I DUE CONTI SONO DUE. «Hai N dei 71 volumi» guarda i volumi, e un
    // racconto non è uno di quei 71: contarcelo direbbe «hai 1 di 71» su
    // una storia breve. «Altri N dei tuoi non stanno nel percorso» invece
    // guarda le tappe, e lì il racconto è dentro eccome — è il filtro che
    // era stato tolto perché non guardava niente, e che questi dati hanno
    // reso di nuovo portante.
    t.eq("ma non conta come volume", c.tue, 0);
    t.eq("e non è «fuori dal percorso»", c.fuori, 0);
  }

  // ── LE PARTI ──────────────────────────────────────────────────────────
  {
    const c = cammino([
      [{ t: "Alfa", c: "Part 1 · Uno" }, L("a", { series: "The Horus Heresy" })],
      [{ t: "Beta", c: "Part 2 · Due" }, L("b", { series: "Part 2 · Due" })],
      [{ t: "Gamma", c: "Part 2 · Due" }, L("g")],
      // il racconto col suo file, e uno che porta l'antologia «Alfa»: lo
      // stesso libro su due righe è il caso che la deduplica deve prendere
      [{ t: "Racconto", a: "A", tipo: "racconto", in: "X", c: "Part 1 · Uno" }, L("x")],
      [{ t: "Dentro Beta", a: "B", tipo: "racconto", in: "Beta", c: "Part 2 · Due" }, L("b", { series: "Part 2 · Due" })],
    ]);
    // IL CAMPO TIENE LA STORIA, NON IL CAPITOLO: i livelli sono tre
    // (universo, storia, capitoli) e i campi due, quindi se le tredici
    // parti si prendono la Serie non resta un posto dove dire «questa è
    // l'Eresia» — e «Prima di cominciare», che restringe il racconto alla
    // Serie, sotto un «Warhammer 40K» con altre serie le racconta tutte.
    const p = serieDaScrivere({ ...c, saga: "The Horus Heresy", parti: true });
    t.eq("si propone solo chi ha la serie storta o vuota", p.length, 3);
    t.eq("chi ce l'ha già giusta non compare", p.find((x) => x.id === "a"), undefined);
    // il capitolo scritto ieri è proprio quel che va sostituito, e il
    // pannello lo dice «da → a» invece di riscriverlo in silenzio
    t.eq("e il capitolo di ieri diventa la storia", `${p[0].da}→${p[0].a}`, "Part 2 · Due→The Horus Heresy");
    t.eq("e chi non ne aveva lo dichiara", p[1].da, "");
    // UN RACCONTO COMPRATO SINGOLO È UN LIBRO TUO, e prende la serie come
    // gli altri: sullo scaffale è un volume dell'Eresia. Quel che non deve
    // succedere è che lo stesso libro compaia DUE volte — l'antologia ha
    // già una riga sua, e la Serie è del libro, non della tappa.
    t.eq("il racconto col suo file prende la serie", p.find((x) => x.id === "x")?.a, "The Horus Heresy");
    t.eq("e nessun libro compare due volte", new Set(p.map((x) => x.id)).size, p.length);
  }

  // ── QUEL CHE LA GUIDA DICHIARA FUORI DALLA STORIA ─────────────────────
  //
  // Segnalato dal lettore con lo scaffale in mano: «non mi convince che i
  // libri opzionali me li metti tu come parte di qualcosa quando io voglio
  // metterli solo che facciano parte dell'universo di Warhammer 40K». Il
  // prologo sono quattro percorsi ALTERNATIVI e i sette 40K la guida li
  // marca «fuori dall'Eresia»: sono nel percorso per accompagnare la
  // storia, non per farne parte. Scriverci sopra la Serie non alza nessun
  // errore — li raggruppa sullo scaffale come volumi dell'Eresia e fa
  // raccontare «Prima di cominciare» su libri di un'altra storia.
  {
    const c = cammino([
      [{ t: "Alfa", c: "Part 1 · Uno", o: 1 }, L("a")],
      [{ t: "Eisenhorn", c: "Prologo · 40K", tipo: "prologo" }, L("p", { series: "The Horus Heresy" })],
      [{ t: "Night Lords", c: "Part 1 · Uno", tipo: "fuori" }, L("f", { series: "The Horus Heresy" })],
      // un'antologia invece la storia la fa eccome: tiene i racconti del
      // percorso, e la sua Serie si scrive come quella dei romanzi
      [{ t: "Antologia", c: "Part 1 · Uno", tipo: "antologia" }, L("n")],
    ]);
    const p = serieDaScrivere({ ...c, saga: "The Horus Heresy", parti: true });
    const dove = (id) => p.find((x) => x.id === id);
    t.eq("al romanzo si scrive la storia", dove("a")?.a, "The Horus Heresy");
    t.eq("e all'antologia anche", dove("n")?.a, "The Horus Heresy");
    // LE DUE RIGHE CHE CURANO LA SEGNALAZIONE: la Serie che avevamo
    // scritto noi si toglie, e la riga lo dice «da → senza serie»
    t.eq("al prologo la storia si TOGLIE", dove("p")?.a, "");
    t.eq("…e la riga dice da dove viene", dove("p")?.da, "The Horus Heresy");
    t.eq("e al titolo fuori dall'Eresia pure", dove("f")?.a, "");
  }
  {
    // MA QUEL CHE HA SCRITTO IL LETTORE NON SI TOCCA, nemmeno per
    // togliere: si propone solo dove il campo tiene il nome che avremmo
    // scritto noi (la stessa regola di `CICLI_NOSTRI`). Senza questa
    // guardia il pannello proporrebbe di cancellare una Serie sua —
    // «Night Lords» sul suo omnibus — e sarebbe una perdita, non una cura.
    const c = cammino([
      [{ t: "Night Lords", c: "Part 1 · Uno", tipo: "fuori" }, L("f", { series: "Night Lords" })],
      [{ t: "Eisenhorn", c: "Prologo · 40K", tipo: "prologo" }, L("p")],
    ]);
    const p = serieDaScrivere({ ...c, saga: "The Horus Heresy", parti: true });
    t.eq("una serie sua non si propone di togliere", p.find((x) => x.id === "f"), undefined);
    t.eq("e chi è già senza serie non è una proposta", p.find((x) => x.id === "p"), undefined);
    t.eq("quindi non c'è niente da fare", p.length, 0);
  }
  {
    // E SU UNA TAVOLA CHE NON DICHIARA CAPITOLI NON SI TOGLIE MAI NIENTE.
    // Lì quel che scriviamo è il CICLO della voce, non il nome della
    // storia, quindi «il campo tiene il nome che avremmo scritto noi» non
    // si può decidere confrontandolo con la saga: sarebbe la domanda
    // sbagliata, e la risposta un campo cancellato. La fixture deve avere
    // la Serie UGUALE alla saga, o la guardia non viene nemmeno raggiunta
    // (mutazione sopravvissuta al primo giro).
    const c = cammino([[{ t: "Fuori", c: "Death", tipo: "fuori" }, L("x", { series: "Finta" })]]);
    t.eq("senza capitoli non si tocca niente", serieDaScrivere({ ...c, saga: "Finta" }).length, 0);
  }
  {
    // e su una tavola che NON dichiara capitoli si scrive il ciclo, che lì
    // è proprio quel che il lettore chiama Serie (Rincewind, le Guardie)
    const c = cammino([[{ t: "Mort", c: "Death" }, L("m")]]);
    t.eq("senza capitoli si scrive il ciclo", serieDaScrivere({ ...c, parti: false })[0].a, "Death");
  }
  {
    // numero, parte e saga dello STESSO libro si scrivono in una riga
    // sola, o due scritture separate si sovrascriverebbero
    const campi = campiDaScrivere({
      numeri: [{ id: "a", a: 3 }],
      serie: [{ id: "a", a: "The Horus Heresy" }],
      saga: { nome: "Warhammer 40K", quali: ["a"] },
      scelti: new Set(["n:a", "s:a"]),
    });
    t.eq(
      "numero, serie e saga arrivano insieme",
      JSON.stringify(campi.get("a")),
      '{"sagaOrder":3,"series":"The Horus Heresy","saga":"Warhammer 40K"}'
    );
  }
  {
    // LA SPUNTA È PER RIGA, NON PER LIBRO: lo stesso volume compare due
    // volte — numero e parte — e con un insieme di soli id togliendo la
    // spunta a una si toglierebbe anche all'altra, in silenzio.
    const campi = campiDaScrivere({
      numeri: [{ id: "a", a: 3 }],
      serie: [{ id: "a", a: "The Horus Heresy" }],
      scelti: new Set(["n:a"]),
    });
    t.eq("si può scrivere il numero e lasciare la serie", JSON.stringify(campi.get("a")), '{"sagaOrder":3}');
  }

  // ── UNA PARTE NON È UN CICLO ──────────────────────────────────────────
  //
  // La regola che rende scrivibili le parti senza rompere «Prima di
  // cominciare». Non si indovina dai numeri — provato e scartato, vedi
  // `parteDiUnaStoria` — si legge dalle guide che spediamo noi.
  {
    const parte = HORUS.find((v) => v.o === 8).c;
    t.c("una parte dell'Eresia si riconosce", parteDiUnaStoria({ series: parte }));
    t.c("…anche scritta in un'altra maiuscola", parteDiUnaStoria({ series: parte.toUpperCase() }));
    t.c("un ciclo del Mondo Disco no", !parteDiUnaStoria({ series: "City Watch" }));
    t.c("una serie del Malazan no", !parteDiUnaStoria({ series: "Kharkanas" }));
    t.c("e un libro senza serie nemmeno", !parteDiUnaStoria({ series: "" }));
  }
  {
    // IL CASO DEL LETTORE: coi capitoli scritti addosso, «Prima di
    // cominciare» deve continuare a raccontare TUTTI i volumi di prima,
    // non i due della parte in cui stai. Senza questa regola, scrivere le
    // parti — che è quel che ha chiesto — avrebbe spento il tasto.
    const parte1 = HORUS.find((v) => v.o === 1).c;
    const parte3 = HORUS.find((v) => v.o === 8).c;
    const tappe = [
      { libro: { id: "1", series: parte1 } },
      { libro: { id: "2", series: parte1 } },
      { libro: { id: "3", series: parte3 } },
    ];
    t.eq(
      "sulle parti di una guida si racconta tutto quel che viene prima",
      soloDellaSerie({ series: parte3 }, tappe).length,
      3
    );
    // e il Malazan resta com'era: lì le serie sono storie diverse, e il
    // lettore l'aveva chiesto esplicitamente
    const suoi = [
      { libro: { id: "1", series: "Book of the Fallen" } },
      { libro: { id: "2", series: "Kharkanas" } },
    ];
    t.eq("e nel Malazan si resta nella propria storia", soloDellaSerie({ series: "Kharkanas" }, suoi).length, 1);
  }
  {
    // stessa domanda, stessa risposta: il filo del «prossimo passo» è la
    // saga intera dove le serie sono capitoli, la serie dove sono storie
    const parte1 = HORUS.find((v) => v.o === 1).c;
    const parte3 = HORUS.find((v) => v.o === 8).c;
    const eresia = [
      { id: "1", saga: "Warhammer 40K", series: parte1, sagaOrder: 15 },
      { id: "2", saga: "Warhammer 40K", series: parte3, sagaOrder: 25 },
    ];
    t.eq("il filo di una guida è la saga intera", gruppoDi(eresia[1], eresia).length, 2);
    const malazan = [
      { id: "1", saga: "Malazan", series: "Book of the Fallen", sagaOrder: 1 },
      { id: "2", saga: "Malazan", series: "Kharkanas", sagaOrder: 7 },
    ];
    t.eq("…e quello del Malazan resta la serie", gruppoDi(malazan[1], malazan).length, 1);
  }
};
