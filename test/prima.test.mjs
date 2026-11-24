// PERCHÉ «PRIMA DI COMINCIARE» TACE.
//
// Il tasto compare solo se un «prima» esiste, e quando manca la scheda
// deve dire DOVE si rompe la catena — saga, numeri, stato, serie — invece
// di sparire in silenzio: il lettore coi primi volumi letti guardava la
// scheda del nono e il tasto non c'era, senza una riga a dire il perché.
// Qui si prova che ogni anello rotto venga nominato giusto, e che i casi
// normali (primo volume, nessuna saga) restino in silenzio.
import { perchePrimaTace, soloDellaSerie, scegliPrima, chiediPrima } from "../src/lib/trama.js";
import { conTitoli } from "../src/lib/chiSono.js";
import { frontiera } from "../src/lib/frontiera.js";

const libro = (id, saga, ordine, extra = {}) => ({ id, title: id, saga, sagaOrder: ordine, ...extra });

export default async function (t) {
  // la biblioteca del lettore: Discworld coi primi volumi letti
  const eric = libro("eric", "Discworld", 9, { series: "Rincewind" });
  const letti = [
    libro("com", "Discworld", 1, { series: "Rincewind" }),
    libro("tlf", "Discworld", 2, { series: "Rincewind" }),
    libro("sourcery", "Discworld", 5, { series: "Rincewind" }),
  ];
  const stati = (mappa) => ({
    statusOf: (id) => mappa[id] || "unread",
    cfiOf: () => null,
  });
  const tuttiLetti = stati({ com: "read", tlf: "read", sourcery: "read" });

  // ---- QUANDO IL TASTO C'È NON C'È NIENTE DA SPIEGARE -------------------
  t.eq("con la catena sana si tace", perchePrimaTace(eric, [eric, ...letti], tuttiLetti), null);
  // e la stessa catena fa comparire davvero il tasto: le due strade devono
  // dire la stessa cosa, o la spiegazione mentirebbe
  const tappe = soloDellaSerie(
    eric,
    frontiera(eric, [eric, ...letti], tuttiLetti).filter((x) => x.libro.id !== "eric")
  );
  t.eq("e il tasto conterebbe tre volumi", tappe.length, 3);

  // ---- I SILENZI GIUSTI --------------------------------------------------
  t.eq("senza saga si tace", perchePrimaTace(libro("solo", "", 3), [], tuttiLetti), null);
  t.eq(
    "il primo volume non ha un prima: si tace",
    perchePrimaTace(libro("com2", "Discworld", 1), [eric, ...letti], tuttiLetti),
    null
  );
  t.eq(
    "saga dichiarata ma né numero né altri volumi: si tace",
    perchePrimaTace(libro("x", "Malazan", null), [eric], tuttiLetti),
    null
  );

  // ---- GLI ANELLI ROTTI, UNO PER VOLTA ----------------------------------
  t.eq(
    "nessun altro volume della saga → «soli»",
    perchePrimaTace(libro("x", "Malazan", 3), [eric, ...letti], tuttiLetti)?.perche,
    "soli"
  );
  t.eq(
    "il volume senza numero, con la saga attorno → «senzaNumero»",
    perchePrimaTace(libro("x", "Discworld", null), [eric, ...letti], tuttiLetti)?.perche,
    "senzaNumero"
  );
  const senzaNumeri = letti.map((b) => ({ ...b, sagaOrder: null }));
  const rNumeri = perchePrimaTace(eric, [eric, ...senzaNumeri], tuttiLetti);
  t.eq("i precedenti senza numero → «numeri»", rNumeri?.perche, "numeri");
  t.eq("e la riga sa dire di quale numero si parla", rNumeri?.ordine, 9);

  const nonLetti = stati({});
  const rStato = perchePrimaTace(eric, [eric, ...letti], nonLetti);
  t.eq("i precedenti mai aperti → «stato»", rStato?.perche, "stato");
  t.eq("contati", rStato?.quanti, 3);
  // un «In lettura» senza punto di lettura non è nella frontiera, e la
  // colpa è dello stato, non della serie
  t.eq(
    "«In lettura» senza segno di pagina → ancora «stato»",
    perchePrimaTace(eric, [eric, ...letti], stati({ com: "reading" }))?.perche,
    "stato"
  );

  const altraSerie = letti.map((b) => ({ ...b, series: "The Witches" }));
  const rSerie = perchePrimaTace(eric, [eric, ...altraSerie], tuttiLetti);
  t.eq("letti ma di un'altra serie → «serie»", rSerie?.perche, "serie");
  t.eq("e la riga sa quale serie pretende questo volume", rSerie?.serie, "Rincewind");

  // la serie si confronta come nel tasto: maiuscole e spazi non contano
  t.eq(
    "«rincewind » e «Rincewind» sono la stessa serie",
    perchePrimaTace(
      { ...eric, series: "rincewind " },
      [eric, ...letti],
      tuttiLetti
    ),
    null
  );
  // e senza serie dichiarata conta tutta la saga: catena sana, silenzio
  t.eq(
    "senza serie i letti bastano",
    perchePrimaTace({ ...eric, series: "" }, [eric, ...altraSerie], tuttiLetti),
    null
  );

  // la saga invece si confronta come in `frontiera`, spazi tolti
  t.eq(
    "«Discworld » sul volume trova i «Discworld»",
    perchePrimaTace({ ...eric, saga: "Discworld " }, [eric, ...letti], tuttiLetti),
    null
  );

  // ---- OGNI VOLUME HA UN NUMERO, L'ULTIMO COMPRESO ----------------------
  // Segnalato dal lettore su Eric: l'ultimo paragrafo della scheda diceva
  // «Nel volume appena chiuso il Bagaglio è tornato a fare il Bagaglio…»
  // senza dire QUALE. Il volume più recente era l'unico che arrivava al
  // modello senza numero — solo [inizio] e [ultime pagine] — quindi non
  // aveva un modo di chiamarlo, e `conTitoli` non aveva niente da
  // sostituire: il titolo vero non compariva mai.
  const raccolto = (nome, posto, quanti = 6) => ({
    libro: { id: nome, title: nome },
    posto,
    corpo: Array.from({ length: quanti }, (_, i) => `${nome}: paragrafo ${i + 1}`),
    coda: [`${nome}: come si è chiuso`],
  });

  let scelti = scegliPrima([raccolto("com", 0), raccolto("tlf", 1), raccolto("sourcery", 2)]);
  const numeri = (quando) => [...new Set(scelti.filter((p) => p.quando === quando).map((p) => p.volume))];
  t.eq("i volumi vecchi portano il loro numero", JSON.stringify(numeri("prima")), "[1,2]");
  t.eq("e IL PIÙ RECENTE PURE, nell'apertura", JSON.stringify(numeri("qui")), "[3]");
  t.eq("e nelle ultime pagine", JSON.stringify(numeri("coda")), "[3]");

  // e il numero torna il titolo vero sullo schermo: è tutto il punto
  const tomi = [{ libro: { title: "The Colour of Magic" } }, { libro: { title: "The Light Fantastic" } }, { libro: { title: "Sourcery" } }];
  t.eq(
    "«Volume 3» diventa il titolo del volume appena chiuso",
    conTitoli("Nel Volume 3 arriva Coin.", tomi),
    "Nel «Sourcery» arriva Coin."
  );

  // UN TOMO RIMASTO NEL CLOUD non si sfoglia e salta il giro: i numeri
  // contano sulla FRONTIERA, non sul raccolto, o la scheda metterebbe
  // sopra a un racconto il titolo del libro che non ha potuto leggere
  scelti = scegliPrima([raccolto("com", 0), raccolto("sourcery", 2)]);
  t.eq("col secondo volume lontano, il primo resta 1", JSON.stringify(numeri("prima")), "[1]");
  t.eq("e il recente resta 3, non 2", JSON.stringify(numeri("qui")), "[3]");

  // ---- e la richiesta al modello li NOMINA tutti ------------------------
  const prima = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (k) => (k === "bc_ai_key" ? "prova" : null),
    setItem: () => {},
    removeItem: () => {},
  };
  let chiesto = "";
  const finto = async (_url, opz) => {
    chiesto = JSON.parse(opz.body).messages[0].content;
    return {
      ok: true,
      json: async () => ({ content: [{ type: "text", text: "va bene" }], stop_reason: "end_turn" }),
    };
  };
  try {
    await chiediPrima({ passaggi: scegliPrima([raccolto("com", 0), raccolto("tlf", 1), raccolto("sourcery", 2)]), tappe: tomi }, finto);
  } finally {
    globalThis.localStorage = prima;
  }
  t.c("i passaggi del volume recente arrivano col numero", /\[Volume 3, inizio\]/.test(chiesto), chiesto.slice(0, 200));
  t.c("e anche le sue ultime pagine", /\[Volume 3, ultime pagine\]/.test(chiesto));
  t.c("e al modello si vieta «il volume appena chiuso»", /volume appena chiuso/.test(chiesto));
}
