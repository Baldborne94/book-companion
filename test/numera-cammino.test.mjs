// NUMERARE I TUOI VOLUMI COME LA GUIDA.
//
// Chiesto dal lettore con l'Eresia in biblioteca: «in che modo posso
// ordinare la Horus Heresy affinché il nostro Oracolo possa lavorare al
// meglio senza rivelare eventuali spoiler e che segue la trama così come
// la suggeriscono dal sito per l'ordine migliore di lettura?».
//
// Quel che sbaglia in silenzio qui è IL NUMERO: non alza nessun errore,
// sposta soltanto il confine di quel che l'Oracolo può raccontare. Un
// numero di troppo apre uno spoiler, uno di meno fa sparire un volume
// dalla scheda — e in tutt'e due i casi sullo scaffale sembra tutto a
// posto.
import { numerazioneGuida, sagaComune, campiDaScrivere } from "../src/lib/numeraCammino.js";
import { camminoDi, postiDelCammino } from "../src/lib/cammino.js";

// la forma che `camminoDi` produce: una tappa per voce della guida, col
// libro dentro se ce l'hai. IL POSTO SI CALCOLA COME LÀ — chiedendolo alla
// tavola — o il test proverebbe una numerazione che nell'app non esiste.
const cammino = (righe, saga = "Finta") => ({
  saga,
  tappe: postiDelCammino(
    righe.map(([t, libro, o = null, tipo]) => ({ voce: { t, o, tipo }, libro: libro || null })),
    (v) => v?.o
  ),
  tue: righe.filter(([, l]) => l).length,
  fuori: 0,
});
const L = (id, title, extra = {}) => ({ id, title, ...extra });

export default async (t) => {
  // ── IL NUMERO È QUELLO CHE LA GUIDA DICHIARA ──────────────────────────
  {
    // cinque tappe, e la guida numera solo i romanzi: il prologo e
    // l'antologia non portano via il posto a nessuno. IL NUMERO NON SI
    // CONTA, SI CHIEDE — contando le righe, «Alfa» uscirebbe secondo e
    // «Gamma» quinto, che è il quindicesimo posto di «Horus Rising» in
    // piccolo: il difetto che il lettore ha segnalato due volte.
    const c = cammino([
      ["Prologo", null],
      ["Alfa", L("a", "Alfa"), 1],
      ["Antologia", null],
      ["Beta", null, 2],
      ["Gamma", L("g", "Gamma"), 3],
    ]);
    const n = numerazioneGuida(c);
    t.eq("si numerano solo i volumi che hai", n.length, 2);
    t.eq("e il numero è quello della guida", n.map((p) => `${p.title}=${p.a}`).join(" "), "Alfa=1 Gamma=3");
    t.eq("chi non ne aveva lo dichiara", n[0].da, null);
  }

  // QUEL CHE LA GUIDA NON NUMERA SI INFILA CON UN DECIMALE, e non resta
  // senza: un volume senza numero la frontiera non lo colloca e resta
  // fuori — un buco, non una prudenza. Ma non ruba il posto al romanzo,
  // che è la ragione per cui un numero suo non ce l'ha.
  {
    const c = cammino([
      ["Antologia", L("x", "Antologia")],
      ["Romanzo", L("r", "Romanzo"), 1],
    ]);
    const n = numerazioneGuida(c);
    t.eq("l'antologia si infila prima del primo", n[0].a, 0.01);
    t.eq("…e il romanzo resta il primo", n[1].a, 1);
    t.c("…cioè l'antologia viene prima", n[0].a < n[1].a);
  }
  {
    // DUE FILE DI TAPPE SENZA NUMERO, una davanti al primo romanzo e una
    // in mezzo: il conto dei centesimi RIPARTE a ogni romanzo. Senza il
    // ritorno a zero la seconda fila comincerebbe da dove aveva finito la
    // prima, e con un vuoto lungo davanti scavalcherebbe il romanzo dopo —
    // cioè l'ordine sbagliato, in silenzio. Ci vogliono tutt'e due le
    // file: con una sola il difetto non si vede.
    const c = cammino([
      ["Prologo", L("p", "Prologo")],
      ["Alfa", L("a", "Alfa"), 1],
      ["Uno", L("u1", "Uno")],
      ["Due", L("u2", "Due")],
      ["Tre", L("u3", "Tre")],
      ["Beta", L("b", "Beta"), 2],
    ]);
    const n = numerazioneGuida(c);
    t.eq(
      "le tappe non numerate stanno in fila fra i due",
      n.map((p) => p.a).join(" "),
      "0.01 1 1.01 1.02 1.03 2"
    );
  }
  {
    // E IL DECIMALE DEV'ESSERE UN DECIMALE. In virgola mobile 1 + 14×0,01
    // fa 1.1400000000000001, e senza l'arrotondamento è quello che
    // finirebbe scritto sul libro e mostrato sullo scaffale. Quattordici
    // perché è il vuoto più largo che la guida abbia (il prologo intero),
    // e perché è l'unico conto in cui lo scarto si vede.
    const fila = [["Alfa", L("a", "Alfa"), 1]];
    for (let i = 1; i <= 14; i++) fila.push([`Vuoto ${i}`, L(`v${i}`, `Vuoto ${i}`)]);
    const n = numerazioneGuida(cammino(fila));
    t.eq("e il decimale è un decimale", String(n[14].a), "1.14");
  }
  {
    // UN RACCONTO NON È UN FILE E NON SI NUMERA. La sua riga porta il libro
    // della sua ANTOLOGIA, che il numero ce l'ha già dalla propria riga:
    // senza la guardia gli si proporrebbe `null` — cioè di cancellarglielo
    // — e il volume uscirebbe dalla frontiera dell'Oracolo. Il numero
    // addosso all'antologia è quel che rende il controllo portante: a
    // scheda vuota `null` e `null` pareggiano e non succede niente.
    const antologia = L("x", "Antologia", { sagaOrder: 0.01 });
    const c = cammino([
      ["Antologia", antologia],
      ["Alfa", L("a", "Alfa"), 1],
      ["Un racconto", antologia, null, "racconto"],
      ["Beta", L("b", "Beta"), 2],
    ]);
    const n = numerazioneGuida(c);
    t.eq("il racconto non prende un posto", n.length, 2);
    t.c("…e non propone di cancellare quello dell'antologia", !n.some((p) => p.a == null));
    t.eq("…né lo toglie a chi viene dopo", n[1].a, 2);
  }

  // ── CHI È GIÀ A POSTO NON È UNA PROPOSTA ──────────────────────────────
  {
    const c = cammino([
      ["Alfa", L("a", "Alfa", { sagaOrder: 1 }), 1],
      ["Beta", L("b", "Beta", { sagaOrder: 9 }), 2],
    ]);
    const n = numerazioneGuida(c);
    t.eq("chi ha già il numero giusto non compare", n.length, 1);
    t.eq("…e compare chi ce l'ha storto", n[0].id, "b");
    t.eq("dicendo da dove viene", `${n[0].da}→${n[0].a}`, "9→2");
    // al secondo giro non resta niente da spuntare: è la prova che il
    // tasto sa sparire invece di riproporsi per sempre
    const dopo = cammino([
      ["Alfa", L("a", "Alfa", { sagaOrder: 1 }), 1],
      ["Beta", L("b", "Beta", { sagaOrder: 2 }), 2],
    ]);
    t.eq("e al secondo giro non c'è più niente da fare", numerazioneGuida(dopo).length, 0);
  }
  {
    // il numero salvato può essere arrivato come stringa (una scheda
    // scritta a mano, un archivio vecchio): «2» e 2 sono lo stesso posto,
    // e proporne il cambio sarebbe una riga che non cambia niente
    const c = cammino([["Alfa", L("a", "Alfa", { sagaOrder: "1" }), 1]]);
    t.eq("«1» e 1 sono lo stesso numero", numerazioneGuida(c).length, 0);
  }

  // ── LA SAGA È L'ALTRA METÀ, E DA SOLA NON SI VEDE ─────────────────────
  {
    // due grafie fra i tuoi volumi: la frontiera confronta lettera per
    // lettera, quindi così com'è li spezza in due storie che non si parlano
    const c = cammino([
      ["Alfa", L("a", "Alfa", { saga: "Warhammer 40K" })],
      ["Beta", L("b", "Beta", { saga: "Warhammer 40K" })],
      ["Gamma", L("g", "Gamma", { saga: "The Horus Heresy" })],
    ]);
    const s = sagaComune(c);
    t.eq("comanda la grafia più usata fra i TUOI", s.nome, "Warhammer 40K");
    t.eq("…e si tocca solo chi sta fuori", s.quali.join(","), "g");
  }
  {
    // e la grafia scelta è quella del lettore anche quando la tavola la
    // pensa diversamente: su questi campi l'ultima parola è sua
    const c = cammino([["Alfa", L("a", "Alfa", { saga: "Roba mia" })]], "The Horus Heresy");
    t.eq("una saga sola non si tocca", sagaComune(c), null);
  }
  {
    // nessuno dei tuoi ha una saga: lì si propone il nome della tavola,
    // che è l'unico che c'è
    const c = cammino([["Alfa", L("a", "Alfa")], ["Beta", L("b", "Beta")]], "The Horus Heresy");
    const s = sagaComune(c);
    t.eq("senza nessuna saga si propone quella della guida", s.nome, "The Horus Heresy");
    t.eq("…su tutti", s.quali.length, 2);
  }
  {
    // la stessa saga scritta con un'altra maiuscola NON è un'altra saga:
    // per tutta l'app la chiave è la stessa, e riscriverla non curerebbe
    // niente
    const c = cammino([
      ["Alfa", L("a", "Alfa", { saga: "The Horus Heresy" })],
      ["Beta", L("b", "Beta", { saga: "the horus heresy" })],
    ]);
    t.eq("una maiuscola non fa due saghe", sagaComune(c), null);
  }
  {
    t.eq("e senza volumi non c'è niente da unificare", sagaComune(cammino([["Alfa", null]])), null);
  }
  {
    // LA SAGA TOLTA A MANO RESTA TOLTA, anche da questa porta: il campo
    // svuotato è una scelta che non si vede, e senza questa riga la saga
    // rientrerebbe da qui. Il volume resta nel cammino — quello si
    // riconosce dal titolo — e il suo numero lo prende lo stesso.
    const c = cammino([
      ["Alfa", L("a", "Alfa", { saga: "Warhammer 40K" }), 1],
      ["Beta", L("b", "Beta", { saga: "Warhammer 40K" }), 2],
      ["Gamma", L("g", "Gamma", { saga: "", sagaTolta: true }), 3],
    ]);
    t.eq("a chi la saga se l'è tolta non si riscrive", sagaComune(c), null);
    t.eq("…ma il numero della guida lo prende", numerazioneGuida(c).find((p) => p.id === "g").a, 3);
  }

  // ── QUEL CHE SI SCRIVE ────────────────────────────────────────────────
  {
    const numeri = [
      { id: "a", title: "Alfa", da: null, a: 1 },
      { id: "b", title: "Beta", da: 7, a: 2 },
    ];
    const saga = { nome: "Warhammer 40K", quali: ["b", "c"] };
    const campi = campiDaScrivere({ numeri, saga, scelti: new Set(["n:a", "n:b"]) });
    // IL LIBRO CHE HA TUTT'E DUE I GUAI riceve UNA riga sola: due
    // scritture separate sullo stesso libro si sovrascriverebbero, e il
    // numero (o la saga) sparirebbe senza che nessuno lo dica
    t.eq("chi ha numero e saga storti riceve tutt'e due", JSON.stringify(campi.get("b")), '{"sagaOrder":2,"saga":"Warhammer 40K"}');
    t.eq("chi ha solo il numero riceve quello", JSON.stringify(campi.get("a")), '{"sagaOrder":1}');
    t.eq("e chi ha solo la saga pure", JSON.stringify(campi.get("c")), '{"saga":"Warhammer 40K"}');
  }
  {
    // quel che togli non si tocca: è tutta la ragione per cui questo
    // pannello propone invece di riscrivere
    const numeri = [
      { id: "a", title: "Alfa", da: null, a: 1 },
      { id: "b", title: "Beta", da: null, a: 2 },
    ];
    const campi = campiDaScrivere({ numeri, saga: null, scelti: new Set(["n:a"]) });
    t.eq("il volume non spuntato resta com'era", campi.has("b"), false);
    t.eq("…e l'altro no", campi.get("a").sagaOrder, 1);
  }
  {
    const saga = { nome: "X", quali: ["a"] };
    t.eq(
      "e la saga si può lasciare stare da sola",
      campiDaScrivere({ numeri: [], saga, scelti: new Set(), sagaScelta: false }).size,
      0
    );
    t.eq("mentre spuntata si scrive", campiDaScrivere({ numeri: [], saga, scelti: new Set() }).get("a").saga, "X");
  }

  // ── SULLA GUIDA VERA ──────────────────────────────────────────────────
  //
  // Il caso del lettore: i suoi volumi stanno sotto una saga scritta a
  // mano che nessuna tavola conosce, e si riconoscono per TITOLO.
  {
    const suoi = [
      { id: "1", title: "Horus Rising", author: "", saga: "Warhammer 40K" },
      { id: "2", title: "False Gods", author: "", saga: "Warhammer 40K" },
      { id: "3", title: "Eisenhorn", author: "", saga: "Warhammer 40K" },
    ];
    const c = camminoDi(suoi);
    const n = numerazioneGuida(c);
    t.eq("i tre volumi ricevono un numero", n.length, 3);
    // Eisenhorn apre il prologo della guida: un numero di lettura suo non
    // ce l'ha (non è un romanzo dell'Eresia) e senza il decimale
    // resterebbe fuori dalla frontiera, che è un buco e non una prudenza
    const eisenhorn = n.find((p) => p.title === "Eisenhorn");
    t.eq("e il prologo si infila prima del primo", eisenhorn.a, 0.01);
    t.eq("…anche se per la tavola non ha un numero di lettura", eisenhorn.da, null);
    // IL CONTROLLO CHE IL LETTORE HA CHIESTO DUE VOLTE. Pinnava il
    // contrario («horus.a > 13») ed è girato con dentro la ragione: il
    // prologo sono quattro percorsi ALTERNATIVI, ne leggi uno e non
    // tredici, e numerarli di fila faceva uscire «Horus Rising»
    // quindicesimo del suo stesso inizio — «perché mi dice numero lettura
    // 15 quando è il primo?», e poi «i numeri di lettura riesci a
    // mettermeli giusti?».
    const horus = n.find((p) => p.title === "Horus Rising");
    t.eq("«Horus Rising» è il PRIMO, non il quindicesimo", horus.a, 1);
    t.c("…e sta dopo il prologo lo stesso", horus.a > eisenhorn.a);
    t.c("…e prima di «False Gods»", horus.a < n.find((p) => p.title === "False Gods").a);
    t.eq("la saga scritta a mano non si tocca", sagaComune(c), null);
  }
};
