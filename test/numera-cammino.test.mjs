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
import { camminoDi } from "../src/lib/cammino.js";

// la forma che `camminoDi` produce: una tappa per voce della guida, col
// libro dentro se ce l'hai
const cammino = (righe, saga = "Finta") => ({
  saga,
  tappe: righe.map(([t, libro]) => ({ voce: { t }, libro: libro || null })),
  tue: righe.filter(([, l]) => l).length,
  fuori: 0,
});
const L = (id, title, extra = {}) => ({ id, title, ...extra });

export default async (t) => {
  // ── IL POSTO È QUELLO DELLA GUIDA ─────────────────────────────────────
  {
    // cinque tappe, e il lettore ha la seconda e la quinta: i numeri sono
    // 2 e 5, non 1 e 2. È LA RIGA CHE CONTA — contando solo i tuoi,
    // importare un volume in mezzo rinumererebbe tutti gli altri e i
    // numeri già scritti diventerebbero bugie.
    const c = cammino([
      ["Prologo", null],
      ["Alfa", L("a", "Alfa")],
      ["Antologia", null],
      ["Beta", null],
      ["Gamma", L("g", "Gamma")],
    ]);
    const n = numerazioneGuida(c);
    t.eq("si numerano solo i volumi che hai", n.length, 2);
    t.eq("e il numero è il posto nella guida", n.map((p) => `${p.title}=${p.a}`).join(" "), "Alfa=2 Gamma=5");
    t.eq("chi non ne aveva lo dichiara", n[0].da, null);
  }

  // le antologie e il prologo contano come tappe anche se non le hai: è
  // tutta la differenza con il numero che scrive `riconosci`, che salta
  // quel che non è un romanzo
  {
    const c = cammino([
      ["Antologia", L("x", "Antologia")],
      ["Romanzo", L("r", "Romanzo")],
    ]);
    t.eq("un'antologia è una tappa come le altre", numerazioneGuida(c)[0].a, 1);
    t.eq("…e il romanzo dopo viene dopo", numerazioneGuida(c)[1].a, 2);
  }

  // ── CHI È GIÀ A POSTO NON È UNA PROPOSTA ──────────────────────────────
  {
    const c = cammino([
      ["Alfa", L("a", "Alfa", { sagaOrder: 1 })],
      ["Beta", L("b", "Beta", { sagaOrder: 9 })],
    ]);
    const n = numerazioneGuida(c);
    t.eq("chi ha già il numero giusto non compare", n.length, 1);
    t.eq("…e compare chi ce l'ha storto", n[0].id, "b");
    t.eq("dicendo da dove viene", `${n[0].da}→${n[0].a}`, "9→2");
    // al secondo giro non resta niente da spuntare: è la prova che il
    // tasto sa sparire invece di riproporsi per sempre
    const dopo = cammino([
      ["Alfa", L("a", "Alfa", { sagaOrder: 1 })],
      ["Beta", L("b", "Beta", { sagaOrder: 2 })],
    ]);
    t.eq("e al secondo giro non c'è più niente da fare", numerazioneGuida(dopo).length, 0);
  }
  {
    // il numero salvato può essere arrivato come stringa (una scheda
    // scritta a mano, un archivio vecchio): «2» e 2 sono lo stesso posto,
    // e proporne il cambio sarebbe una riga che non cambia niente
    const c = cammino([["Alfa", L("a", "Alfa", { sagaOrder: "1" })]]);
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
      ["Alfa", L("a", "Alfa", { saga: "Warhammer 40K" })],
      ["Beta", L("b", "Beta", { saga: "Warhammer 40K" })],
      ["Gamma", L("g", "Gamma", { saga: "", sagaTolta: true })],
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
    const campi = campiDaScrivere({ numeri, saga, scelti: new Set(["a", "b"]) });
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
    const campi = campiDaScrivere({ numeri, saga: null, scelti: new Set(["a"]) });
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
    // Eisenhorn apre il prologo della guida: per `riconosci` non ha
    // numero (non è un romanzo dell'Eresia) e resterebbe fuori dalla
    // frontiera — qui invece è la prima tappa
    const eisenhorn = n.find((p) => p.title === "Eisenhorn");
    t.eq("e il prologo è la prima tappa", eisenhorn.a, 1);
    t.eq("…anche se per la tavola non ha un numero di lettura", eisenhorn.da, null);
    const horus = n.find((p) => p.title === "Horus Rising");
    t.c("«Horus Rising» sta dopo il prologo", horus.a > 13);
    t.c("…e prima di «False Gods»", horus.a < n.find((p) => p.title === "False Gods").a);
    t.eq("la saga scritta a mano non si tocca", sagaComune(c), null);
  }
};
