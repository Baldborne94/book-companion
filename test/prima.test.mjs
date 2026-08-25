// PERCHÉ «PRIMA DI COMINCIARE» TACE.
//
// Il tasto compare solo se un «prima» esiste, e quando manca la scheda
// deve dire DOVE si rompe la catena — saga, numeri, stato, serie — invece
// di sparire in silenzio: il lettore coi primi volumi letti guardava la
// scheda del nono e il tasto non c'era, senza una riga a dire il perché.
// Qui si prova che ogni anello rotto venga nominato giusto, e che i casi
// normali (primo volume, nessuna saga) restino in silenzio.
import { perchePrimaTace, soloDellaSerie } from "../src/lib/trama.js";
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
}
