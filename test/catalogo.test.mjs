// IL RETRO CERCATO IN RETE.
//
// La scala delle fonti è: il file (l'editore), il catalogo in rete, e solo
// in ultimo l'Oracolo. Qui si prova il catalogo, e soprattutto LA SCELTA
// DEL VOLUME, che è la parte dove si sbaglia: il catalogo risponde con
// cinque edizioni e adattamenti, e la quarta di copertina di un ALTRO
// libro è peggio di nessuna.
import { cercaRetro, scegliVolume, daGoogle, daOpenLibrary } from "../src/lib/retroInRete.js";

const DESCRIZIONE =
  "Eric is the Discworld's only demonology hacker, and he wants his three wishes: to be immortal, " +
  "to rule the world, and to have the most beautiful woman fall madly in love with him. Instead he " +
  "gets Rincewind, the Discworld's most incompetent wizard, and a talking luggage with hundreds of legs.";

export default async function (t) {
  // ---- LA SCELTA DEL VOLUME --------------------------------------------
  const voci = [
    { titolo: "The Unofficial Guide to Eric", autori: ["Qualcun Altro"], testo: "Una guida al romanzo." + "x".repeat(60) },
    { titolo: "Eric: The Graphic Novel", autori: ["Terry Pratchett"], testo: "L'adattamento a fumetti." + "x".repeat(60) },
    { titolo: "Eric", autori: ["Terry Pratchett"], testo: DESCRIZIONE },
  ];
  t.eq(
    "si sceglie il titolo giusto, non il primo con una descrizione",
    scegliVolume(voci, { title: "Eric", author: "Terry Pratchett" })?.testo,
    DESCRIZIONE
  );
  // «Eric» deve trovare anche «Eric. Faust», che è la nostra edizione col
  // sottotitolo — e viceversa, un titolo nostro più lungo trova il corto
  t.c(
    "il sottotitolo del catalogo non lo nasconde",
    !!scegliVolume([{ titolo: "Eric Faust", autori: ["Terry Pratchett"], testo: DESCRIZIONE }], {
      title: "Eric",
      author: "Terry Pratchett",
    })
  );
  t.c(
    "e nemmeno il sottotitolo nostro",
    !!scegliVolume([{ titolo: "Eric", autori: ["Terry Pratchett"], testo: DESCRIZIONE }], {
      title: "Eric Faust",
      author: "Terry Pratchett",
    })
  );
  // UN AUTORE DIVERSO È UNA SMENTITA, uno mancante no: come nei doppioni
  t.eq(
    "l'omonimo di un altro autore non passa",
    scegliVolume([{ titolo: "Eric", autori: ["Un Altro Scrittore"], testo: DESCRIZIONE }], {
      title: "Eric",
      author: "Terry Pratchett",
    }),
    null
  );
  t.c(
    "ma senza autore nel catalogo il titolo basta",
    !!scegliVolume([{ titolo: "Eric", autori: [], testo: DESCRIZIONE }], {
      title: "Eric",
      author: "Terry Pratchett",
    })
  );
  // e un titolo che CONTIENE il nostro in mezzo a una frase non è il libro
  t.eq(
    "«Notes on Eric and other essays» non è «Eric»",
    scegliVolume([{ titolo: "Notes on Eric and other essays", autori: [], testo: DESCRIZIONE }], {
      title: "Eric",
    }),
    null
  );
  t.eq("senza titolo cercato non si sceglie niente", scegliVolume(voci, {}), null);
  t.eq("e senza voci nemmeno", scegliVolume([], { title: "Eric" }), null);

  // ---- le forme dei due cataloghi ---------------------------------------
  const google = daGoogle({
    items: [{ volumeInfo: { title: "Eric", authors: ["Terry Pratchett"], description: DESCRIZIONE } }],
  });
  t.eq("Google si riduce alla forma comune", google[0].titolo, "Eric");
  t.eq("con la descrizione", google[0].testo, DESCRIZIONE);
  t.eq("una risposta vuota non esplode", daGoogle({}).length, 0);
  t.eq("nemmeno il niente", daGoogle(undefined).length, 0);

  const ol = daOpenLibrary({ title: "Eric", author_name: ["Terry Pratchett"] }, { description: DESCRIZIONE });
  t.eq("Open Library pure", ol[0].testo, DESCRIZIONE);
  t.eq(
    "anche quando la descrizione è un oggetto",
    daOpenLibrary({ title: "Eric" }, { description: { value: DESCRIZIONE } })[0].testo,
    DESCRIZIONE
  );

  // ---- il giro intero, con una rete finta -------------------------------
  const rispondi = (mappa) => async (url) => {
    for (const [pezzo, corpo] of Object.entries(mappa)) {
      if (url.includes(pezzo)) return { ok: true, json: async () => corpo };
    }
    return { ok: false };
  };

  let r = await cercaRetro(
    { title: "Eric", author: "Terry Pratchett" },
    rispondi({
      "googleapis.com": {
        items: [{ volumeInfo: { title: "Eric", authors: ["Terry Pratchett"], description: `<p>${DESCRIZIONE}</p>` } }],
      },
    })
  );
  t.c("Google risponde e si prende", !!r);
  t.eq("con la fonte dichiarata", r?.fonte, "Google Books");
  t.c("e l'HTML ripulito", !r.testo.includes("<p>"), r.testo.slice(0, 40));

  // Google tace → si passa a Open Library
  r = await cercaRetro(
    { title: "Eric", author: "Terry Pratchett" },
    rispondi({
      "googleapis.com": { items: [] },
      "search.json": { docs: [{ key: "/works/OL1W", title: "Eric", author_name: ["Terry Pratchett"] }] },
      "/works/OL1W.json": { description: DESCRIZIONE },
    })
  );
  t.eq("il ripiego su Open Library funziona", r?.fonte, "Open Library");

  // LA SPAZZATURA NON PASSA: una descrizione-segnaposto non è un retro
  r = await cercaRetro(
    { title: "Eric" },
    rispondi({
      "googleapis.com": { items: [{ volumeInfo: { title: "Eric", description: "No description available" } }] },
    })
  );
  t.eq("un segnaposto non diventa il retro", r, null);

  // UN BUCO DI RETE È NULL, MAI LA STRINGA VUOTA: salvarlo come «guardato,
  // non c'è» impedirebbe di riprovare — la regola della cache del dizionario
  r = await cercaRetro({ title: "Eric" }, async () => {
    throw new Error("niente rete");
  });
  t.eq("senza rete si torna null", r, null);
  t.c("e non stringa vuota", r !== "");
  t.eq("senza titolo non si chiama nessuno", await cercaRetro({}, async () => {
    throw new Error("non dovevi chiamare");
  }), null);
}
