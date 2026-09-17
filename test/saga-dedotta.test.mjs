// LA DEDUZIONE DAI FRATELLI CEDE A CHI IL LIBRO L'HA GUARDATO.
//
// Segnalato con lo scaffale in mano: «perche' mi deduci Between Two Fires
// in una saga che non c'entra nulla?». Sul ripiano «The Blacktongue Thief»
// stavano tre Buehlman: i primi due con la saga scritta addosso dal file
// (numeri 1 e 2), e in fondo un romanzo a se' che con quella storia non
// c'entra niente.
//
// Il colpevole e' `sagaDaBiblioteca`, la SOLA strada che il libro non lo
// guarda affatto: copia dai fratelli, e la sua regola timida — «si propone
// solo se TUTTI i libri di quell'autore che una saga ce l'hanno dichiarano
// la stessa» — su Buehlman trovava due su due e gliela dava. Il difetto non
// e' nella regola: e' nella PREMESSA, «un autore, una saga». L'unica difesa
// era una lista scritta a mano dei fuori-saga di Pratchett, che non potra'
// mai conoscere tutti gli autori.
//
// E NON E' UN DANNO DI SOLO SCAFFALE: con quella saga addosso, «Prima di
// cominciare» riassumerebbe i due Blacktongue come volumi precedenti, la
// frontiera di «Chi e' costui?» si allargherebbe a libri che non c'entrano,
// e il glossario userebbe la stessa chiave per due storie diverse.
//
// La cura sta nell'ORDINE e in un segnale che si misura, non si indovina:
// il catalogo guarda le EDIZIONI del libro, e i suoi due silenzi non sono
// la stessa cosa. Misurato dal vivo su Open Library il giorno della cura:
//
//   Between Two Fires   0 tracce su 7 edizioni     ← romanzo a se'
//   Warbreaker          0                          ← romanzo a se'
//   Howling Dark        1 («The Sun Eater»)        ← volume vero
//   Shadow of the Gods  1 («The Bloodsworn Saga»)  ← volume vero
//   Shadows Linger      6 · Empire of Silence 4 · Before They Are Hanged 8
//
// Sette volumi di saga veri provati, tutti con almeno una traccia; lo zero
// e' uscito solo sui romanzi a se'. Quindi ZERO tracce veta la deduzione, e
// UNA traccia no — ed e' importante che non la veti, perche' «Howling Dark»
// sotto la soglia dei due voti e' esattamente il caso per cui la deduzione
// dai fratelli esiste.
import {
  tracceDalleEdizioni, cercaSaga, ripassaCatalogo,
} from "../src/lib/sagaDalCatalogo.js";
import { sagaDaBiblioteca, deduciSaghe, ripassa } from "../src/lib/sagaBooks.js";

const ed = (...series) => series.map((s) => ({ series: Array.isArray(s) ? s : [s] }));

// LA SCENA VERA, quella della fotografia: due volumi con la saga scritta
// dal file, e il romanzo a se' in fondo.
const BUEHLMAN = () => [
  { id: "b1", title: "The Blacktongue Thief", author: "Christopher Buehlman", saga: "The Blacktongue Thief", sagaOrder: 1 },
  { id: "b2", title: "The Daughters' War", author: "Christopher Buehlman", saga: "The Blacktongue Thief", sagaOrder: 2 },
  { id: "b3", title: "Between Two Fires", author: "Christopher Buehlman", saga: "", sagaOrder: null },
];

export default async function (t) {
  // ---- LE TRACCE ---------------------------------------------------------
  t.eq("zero edizioni, zero tracce", tracceDalleEdizioni([]), 0);
  t.eq(
    "«Between Two Fires»: sette edizioni e nessuna collana",
    tracceDalleEdizioni(ed([], [], [], [], [], [], [])),
    0
  );
  t.eq("«Howling Dark»: una traccia, sotto la soglia dei voti", tracceDalleEdizioni(ed("The Sun Eater")), 1);
  t.eq(
    "le grafie della stessa collana sono UNA traccia",
    tracceDalleEdizioni(ed("The Sun Eater", "Sun eater -- Book one", "Sun Eater #1")),
    1
  );
  t.eq(
    "due collane diverse sono due tracce",
    tracceDalleEdizioni(ed("The First Law #1, First Law World #1")),
    2
  );
  // IL RUMORE NON E' UNA TRACCIA, ed e' la meta' che conta: se l'editore
  // contasse, «Tigana» — che porta «Pandora» e «Romans -- 18-19» — non
  // sarebbe mai zero, e la veto non scatterebbe proprio dove serve.
  t.eq(
    "l'editore non lascia tracce",
    tracceDalleEdizioni(ed("A Bantam spectra book", "Romans -- 18-19", "Fantasy", "Blanvalet -- 24292")),
    0
  );
  t.eq(
    "e un titolo d'opera con la saga dentro lascia la sua",
    tracceDalleEdizioni([], ["Red Seas Under Red Skies (Gentlemen Bastards #2)"]),
    1
  );

  // ---- I DUE SILENZI DI `cercaSaga` --------------------------------------
  // `null` = l'opera non si e' trovata: del libro non sappiamo niente.
  // `{ saga: null, tracce }` = l'opera c'era e le edizioni le abbiamo lette.
  // Fonderli era l'errore.
  const finto = (mappa) => async (url) => {
    const k = Object.keys(mappa).find((x) => url.includes(x));
    return k ? { ok: true, json: async () => mappa[k] } : { ok: false, status: 404 };
  };
  const opera = { docs: [{ key: "/works/OL1W", title: "Between Two Fires", author_name: ["Christopher Buehlman"] }] };

  const muto = await cercaSaga(
    { title: "Between Two Fires", author: "Christopher Buehlman" },
    finto({ "search.json": opera, "editions.json": { entries: ed([], [], []) } })
  );
  t.eq("l'opera c'era: la risposta non e' null", typeof muto, "object");
  t.eq("…nessuna saga", muto?.saga ?? null, null);
  t.eq("…e ZERO tracce, che e' il segnale che serve", muto?.tracce, 0);

  const intravista = await cercaSaga(
    { title: "Howling Dark", author: "Christopher Ruocchio" },
    finto({
      "search.json": { docs: [{ key: "/works/OL2W", title: "Howling Dark", author_name: ["Christopher Ruocchio"] }] },
      "editions.json": { entries: ed("The Sun Eater") },
    })
  );
  t.eq("un voto solo non da' la saga", intravista?.saga ?? null, null);
  t.eq("…ma la traccia si vede, e non e' zero", intravista?.tracce, 1);

  t.eq(
    "opera introvabile: `null`, non «zero tracce»",
    await cercaSaga({ title: "Ignoto", author: "Nessuno" }, finto({ "search.json": { docs: [] } })),
    null
  );

  // UN SILENZIO NON CANCELLA UNA TRACCIA. Il titolo si prova in piu'
  // varianti («09 - Eric» e poi «Eric»), e ognuna puo' atterrare su
  // un'opera diversa: chi intravede una collana ha guardato lo stesso
  // libro. Tenendo l'ULTIMA risposta invece del massimo, una variante che
  // non vede niente veterebbe la deduzione su un libro di cui il catalogo
  // una traccia l'aveva vista eccome.
  const dueVarianti = async (url) => {
    if (url.includes("search.json")) {
      // «09 - Eric» risponde con l'opera A, «Eric» con la B
      const primo = url.includes("09");
      return { ok: true, json: async () => ({
        docs: [{ key: primo ? "/works/A" : "/works/B", title: primo ? "09 - Eric" : "Eric", author_name: ["Uno"] }],
      }) };
    }
    const a = url.includes("/works/A");
    return { ok: true, json: async () => ({ entries: a ? ed("Discworld") : ed([], []) }) };
  };
  const misti = await cercaSaga({ title: "09 - Eric", author: "Uno" }, dueVarianti);
  t.eq("la traccia vista da una variante non la cancella l'altra", misti?.tracce, 1);
  // il buco di rete ESPLODE: su quello non si scrive nessuna memoria
  let scoppiata = false;
  try {
    await cercaSaga({ title: "Between Two Fires" }, async () => { throw new TypeError("Failed to fetch"); });
  } catch {
    scoppiata = true;
  }
  t.c("la rete caduta alza, non veta", scoppiata);

  // ---- LA MEMORIA PORTA LE TRACCE ----------------------------------------
  // senza, la veto morirebbe al riavvio e il catalogo andrebbe richiesto a
  // ogni apertura della Libreria: una domanda per tomo, per sempre
  const memoria = [];
  const esito = await ripassaCatalogo(
    [
      { id: "b3", title: "Between Two Fires", author: "Christopher Buehlman", saga: "" },
      { id: "h", title: "Howling Dark", author: "Christopher Ruocchio", saga: "" },
      { id: "x", title: "Ignoto", author: "Nessuno", saga: "" },
    ],
    {
      cerca: async (b) => ({ b3: { saga: null, tracce: 0 }, h: { saga: null, tracce: 1 }, x: null }[b.id]),
      segnaVista: async (b, cosa) => memoria.push([b.id, cosa]),
      nomeInCasa: (s) => s,
    }
  );
  t.eq("tre mute", esito.mute, 3);
  t.eq("e una sola senza nessuna traccia", esito.senzaTraccia, 1);
  const ricordo = (id) => memoria.find(([x]) => x === id)?.[1];
  t.eq("lo zero si scrive", ricordo("b3")?.tracce, 0);
  t.eq("l'uno si scrive", ricordo("h")?.tracce, 1);
  // «non ho trovato l'opera» non e' «il libro non ha collana»: scriverci
  // zero veterebbe la deduzione su un libro che nessuno ha mai guardato
  t.eq("l'opera introvabile si segna `null`, non zero", ricordo("x")?.tracce, null);
  t.c("…e resta comunque una muta", !!ricordo("x")?.muta);

  // ---- LA VETO, DOVE IL DIFETTO VIVEVA -----------------------------------
  const libri = BUEHLMAN();
  const b3 = libri[2];
  t.eq(
    "senza veto, «Between Two Fires» si prende la saga dei fratelli (il difetto)",
    sagaDaBiblioteca(b3, libri),
    "The Blacktongue Thief"
  );
  t.eq(
    "col catalogo che dice «nessuna collana», non la prende",
    sagaDaBiblioteca(b3, libri, new Set(["b3"])),
    null
  );
  // LA VETO E' PER TOMO, non per autore: i fratelli restano dove sono
  t.eq(
    "e la veto non tocca gli altri",
    sagaDaBiblioteca({ id: "b4", title: "Altro", author: "Christopher Buehlman", saga: "" }, libri, new Set(["b3"])),
    "The Blacktongue Thief"
  );
  // un insieme che non e' un insieme non deve far esplodere niente
  t.eq("senza insieme si lavora come sempre", sagaDaBiblioteca(b3, libri, undefined), "The Blacktongue Thief");
  t.eq("un libro senza id non si puo' vetare", sagaDaBiblioteca({ author: "Christopher Buehlman" }, libri, new Set(["b3"])), "The Blacktongue Thief");

  // ---- LA SCENA INTERA, DA `deduciSaghe` ---------------------------------
  const senza = deduciSaghe(BUEHLMAN(), { senzaTraccia: new Set(["b3"]) });
  t.eq("nella passata, il romanzo a se' resta senza saga", senza.campi.b3, undefined);
  t.eq("…e non si conta come dedotta", senza.dedotte, 0);

  const con = deduciSaghe(BUEHLMAN());
  t.eq("e senza la veto il difetto e' ancora li' (e' il patto che si difende)", con.campi.b3?.saga, "The Blacktongue Thief");

  // IL CASO CHE NON SI DEVE ROMPERE: Ruocchio. Il catalogo «The Sun Eater»
  // la vede una volta sola — sotto la soglia — quindi la memoria porta UNA
  // traccia, non zero, e il fratello gliela passa. E' il caso per cui la
  // deduzione dai fratelli e' stata scritta: se la veto lo prendesse,
  // avremmo curato un difetto rompendo una funzione.
  const ruocchio = deduciSaghe(
    [
      { id: "r1", title: "Empire of Silence", author: "Christopher Ruocchio", saga: "The Sun Eater", sagaOrder: 1 },
      { id: "r2", title: "Howling Dark", author: "Christopher Ruocchio", saga: "", sagaOrder: null },
    ],
    { senzaTraccia: new Set(["b3"]) }
  );
  t.eq("«Howling Dark» eredita lo stesso", ruocchio.campi.r2?.saga, "The Sun Eater");

  // ---- L'ORDINE: il titolo prima, i fratelli dopo -------------------------
  // In mezzo ci va il catalogo, quindi le due passate si devono poter
  // chiedere separate. Con l'ordine di prima la deduzione parlava per
  // PRIMA, la saga veniva scritta, e il catalogo non veniva nemmeno
  // interrogato: quel libro non era piu' «senza saga».
  const misto = [
    { id: "g1", title: "Malice: The Faithful and the Fallen Series Book 1", author: "John Gwynne", saga: "", sagaOrder: null },
    { id: "g2", title: "Valour", author: "John Gwynne", saga: "", sagaOrder: null },
  ];
  const soloTitolo = deduciSaghe(misto, { dallaBiblioteca: false });
  t.eq("il titolo si legge lo stesso", soloTitolo.campi.g1?.saga, "The Faithful and the Fallen");
  t.eq("…e si conta", soloTitolo.dalTitolo, 1);
  t.eq("ma il fratello NON eredita ancora", soloTitolo.campi.g2, undefined);
  t.eq("…e la conta delle dedotte resta a zero", soloTitolo.dedotte, 0);

  const tutto = deduciSaghe(misto);
  t.eq("chiesta intera, il fratello eredita nello stesso giro", tutto.campi.g2?.saga, "The Faithful and the Fallen");

  // la passata dei titoli e' IDEMPOTENTE: la Libreria la chiama due volte
  // (una prima del catalogo e una dopo) e il secondo giro non deve
  // raddoppiare niente
  const gia = deduciSaghe([{ ...misto[0], saga: "The Faithful and the Fallen" }, misto[1]], { dallaBiblioteca: false });
  t.eq("chi la saga ce l'ha gia' non si rilegge", gia.dalTitolo, 0);

  // ---- E LO STESSO SUL TASTO (`ripassa`) ---------------------------------
  const conLibri = BUEHLMAN();
  t.eq(
    "il tasto, senza veto, deduce (il difetto)",
    ripassa(conLibri[2], conLibri)?.campi.saga,
    "The Blacktongue Thief"
  );
  t.eq(
    "col catalogo muto non deduce piu'",
    ripassa(conLibri[2], conLibri, { senzaTraccia: new Set(["b3"]) }),
    null
  );
  t.eq(
    "e nel primo giro del tasto la deduzione tace del tutto",
    ripassa(conLibri[2], conLibri, { dallaBiblioteca: false }),
    null
  );
  // ma il resto di `ripassa` non si tocca: la tavola continua a parlare
  // anche quando la deduzione e' spenta, o il primo giro del tasto
  // smetterebbe di riconoscere il Mondo Disco
  t.eq(
    "la tavola parla anche a deduzione spenta",
    ripassa({ id: "p", title: "Mort", author: "Terry Pratchett", saga: "", series: "" }, [], { dallaBiblioteca: false })?.campi.saga,
    "Discworld"
  );
}
