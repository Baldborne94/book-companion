// I CONSIGLI DAL CATALOGO, SENZA ORACOLO. Quel che sbaglia in silenzio: un
// volume saltato nella fila, il manuale di un omonimo, il quarto di una
// serie proposto come scoperta, un libro che hai gia', un libro per ragazzi
// fra i gusti di chi legge Erikson, una rete caduta letta come «niente».
import {
  eRaccolta,
  titoloDi,
  stessaSaga,
  saghePartite,
  libriAmati,
  soloDellAutore,
  opereInOrdine,
  annoDiPartenza,
  prossimiDellaSaga,
  inFila,
  primiDiSerie,
  argomentiComuni,
  daGusti,
  argomentiPesati,
  pesoLibro,
  pesoGusto,
  consigliDalCatalogo,
  aGruppi,
  scaduti,
  PER_SAGA,
  MAX_PROVE,
  MIN_VOTI,
  SCADENZA,
  SEZIONI_CATALOGO,
  copertinaDi,
  urlCopertina,
} from "../src/lib/consigliLiberi.js";
import { giaInCasa } from "../src/lib/importBook.js";

const libro = (id, title, author, extra = {}) => ({ id, title, author, ...extra });
const stati = (m) => (id) => m[id] || "unread";
const doc = (title, anno, extra = {}) => ({ title, first_publish_year: anno, author_key: ["OL1A"], edition_count: 10, ...extra });

export default async function (t) {
  // ---- i titoli -------------------------------------------------------------
  t.c("un cofanetto e' una raccolta", eRaccolta("First Law Series 3 Books Collection Set"));
  t.c("… e anche due titoli con la barra", eRaccolta("Shadow Games / Dreams of Steel"));
  t.c("… e la guida alla saga", eRaccolta("The Wheel of Time Companion"));
  t.c("un romanzo no", !eRaccolta("The Great Hunt"));
  t.eq("l'etichetta dell'editore se ne va", titoloDi({ title: "The Great Hunt (The Wheel of Time Book 2)" }), "The Great Hunt");
  t.eq(
    "… anche doppia (preso dal vivo)",
    titoloDi({ title: "Reaper's Gale (Malazan Book of Fallen 7) (Malazan Book of the Fallen)" }),
    "Reaper's Gale"
  );
  t.eq("un titolo che e' solo un'etichetta non diventa vuoto", titoloDi({ title: "(Book 2)" }), "(Book 2)");
  t.eq("un sottotitolo vero resta", titoloDi({ title: "Eric (Faust)" }), "Eric (Faust)");
  t.c("la stessa saga scritta piu' lunga e' la stessa", stessaSaga("Malazan", "The Malazan Book of the Fallen"));
  t.c("… a parole intere", !stessaSaga("Law", "Lawless"));
  t.c("una saga vuota non combacia", !stessaSaga("", "Malazan"));

  // ---- chi guardare ---------------------------------------------------------------
  const casa = [
    libro("1", "Gardens of the Moon", "Steven Erikson", { saga: "Malazan", sagaOrder: 1, rating: 5 }),
    libro("2", "The Blade Itself", "Joe Abercrombie", { saga: "First Law", sagaOrder: 1, fav: true }),
    libro("3", "Before They Are Hanged", "Abercrombie, Joe", { saga: "First Law", sagaOrder: 2 }),
    libro("4", "Mai aperto", "Nessuno", { saga: "Sospesa", sagaOrder: 1 }),
    libro("5", "Lasciato", "Tizio", { rating: 5 }),
  ];
  const st = stati({ 1: "read", 2: "read", 3: "reading", 5: "abandoned" });
  let saghe = saghePartite(casa, { statusOf: st });
  t.eq("una saga mai cominciata non si guarda", saghe.map((s) => s.saga).join(","), "First Law,Malazan");
  t.eq("… la prima e' quella con piu' volumi letti", saghe[0].peso, 2);
  t.eq("… l'ordine e' il piu' avanti fra i letti o in lettura", saghe[0].ordine, 2);
  t.eq(
    "i libri amati: cuore e voti alti, mai gli abbandonati",
    libriAmati(casa, { statusOf: st }).map((b) => b.id).join(","),
    "2,1"
  );

  // ---- l'autore giusto -------------------------------------------------------------
  const cook = [
    { title: "The Black Company", author_key: ["OL_COOK"] },
    { title: "Shadows Linger", author_key: ["OL_COOK"] },
    { title: "Approved practices in swine production", author_key: ["OL_MAIALI"] },
    { title: "Hog farming", author_key: ["OL_MAIALI"] },
    { title: "Pigs", author_key: ["OL_MAIALI"] },
  ];
  const suoi = soloDellAutore(cook, [libro("c", "The Black Company", "Glen Cook")], "Glen Cook");
  t.eq("l'omonimo se ne va anche se ha piu' opere (preso dal vivo)", suoi.map((d) => d.title).join(","), "The Black Company,Shadows Linger");
  t.eq(
    "senza un tuo libro fra le opere vince la chiave piu' frequente",
    soloDellAutore(cook, [], "Glen Cook").length,
    3
  );

  // ---- le saghe -------------------------------------------------------------------
  const opere = opereInOrdine([
    doc("Memories of Ice", 2001),
    doc("Gardens of the Moon", 1999),
    doc("Deadhouse Gates", 2000),
    doc("Deadhouse gates", 2000),
    doc("Malazan Box Set", 2010),
    doc("Forge of Darkness", 2012),
    doc("Senza anno"),
  ]);
  t.eq(
    "le opere dalla piu' vecchia, senza cofanetti ne' doppioni",
    opere.map((d) => d.pulito).join(","),
    "Gardens of the Moon,Deadhouse Gates,Memories of Ice,Forge of Darkness,Senza anno"
  );
  const malazan = saghePartite(casa, { statusOf: st }).find((s) => s.saga === "Malazan");
  t.eq("l'anno di partenza e' quello del tuo volume ritrovato", annoDiPartenza(malazan, opere), 1999);
  const catalogoSaghe = {
    "Deadhouse Gates": { saga: "The Malazan Book of the Fallen", sagaOrder: 2 },
    "Memories of Ice": { saga: "Malazan Book of the Fallen", sagaOrder: 3 },
    "Forge of Darkness": { saga: "Kharkanas", sagaOrder: 1 },
    "Night of Knives": { saga: "Malazan", sagaOrder: 1 },
  };
  const chieste = [];
  const sagaDi = async ({ title }) => {
    chieste.push(title);
    return catalogoSaghe[title] || null;
  };
  let r = await prossimiDellaSaga(malazan, opere, casa, { sagaDi });
  t.eq("il seguito della saga, in fila", r.voci.map((v) => `${v.titolo} ${v.numero}`).join(","), "Deadhouse Gates 2,Memories of Ice 3");
  t.eq("… col perche'", r.voci[0].perche, "dopo «Gardens of the Moon», che hai letto");
  const rAmata = await prossimiDellaSaga({ ...malazan, preferita: true }, opere, casa, { sagaDi });
  t.eq("… che dice quando la saga e' fra le preferite", rAmata.voci[0].perche, "dopo «Gardens of the Moon», che hai letto · fra le tue saghe preferite");
  t.eq("… e il nome della TUA saga, non quello del catalogo", r.voci[0].saga, "Malazan");
  t.c("… e il volume che hai non si chiede nemmeno", !chieste.includes("Gardens of the Moon"));
  t.c("un'altra saga dello stesso autore non entra", !r.voci.some((v) => v.titolo === "Forge of Darkness"));

  // la saga che non si ritrova tace
  const persa = { saga: "Malazan", autore: "Steven Erikson", letti: [libro("x", "Titolo che il catalogo non ha", "Steven Erikson")], ordine: null };
  r = await prossimiDellaSaga(persa, opere, casa, { sagaDi });
  t.eq("un volume letto che non si ritrova, senza numero: la saga tace", r.voci.length, 0);
  // ma col numero si va avanti lo stesso, e i numeri dicono chi e' «dopo»
  r = await prossimiDellaSaga({ ...persa, ordine: 2 }, opere, casa, { sagaDi });
  t.eq("… col numero si', e il secondo non si ripropone a chi e' al secondo", r.voci.map((v) => v.titolo).join(","), "Memories of Ice");

  // senza numeri comanda l'anno: quel che e' uscito prima del tuo volume
  // e' dietro di te, anche se non l'hai (la Compagnia Nera non ha numeri
  // sulle edizioni)
  r = await prossimiDellaSaga(
    { saga: "Nera", autore: "Glen Cook", letti: [libro("n", "The Black Company", "Glen Cook")], ordine: null },
    opereInOrdine([doc("Un racconto di prima", 1980), doc("The Black Company", 1984), doc("Shadows Linger", 1984)]),
    [libro("n", "The Black Company", "Glen Cook")],
    { sagaDi: async () => ({ saga: "Nera", sagaOrder: null }) }
  );
  t.eq("senza numeri, quel che e' uscito prima del tuo non si propone", r.voci.map((v) => v.titolo).join(","), "Shadows Linger");

  // un tetto alle domande
  chieste.length = 0;
  const tante = opereInOrdine(Array.from({ length: 20 }, (_, i) => doc(`Opera ${i}`, 2000 + i)));
  await prossimiDellaSaga({ ...persa, ordine: 1 }, tante, [], { sagaDi });
  t.eq("non piu' di MAX_PROVE domande per saga", chieste.length, MAX_PROVE);
  // la saga scritta nel titolo si legge gratis
  chieste.length = 0;
  r = await prossimiDellaSaga(
    { ...persa, saga: "Wheel of Time", ordine: 1 },
    opereInOrdine([doc("The Great Hunt (The Wheel of Time Book 2)", 1990)]),
    [],
    { sagaDi }
  );
  t.eq("la saga nel titolo non costa una domanda", chieste.length, 0);
  t.eq("… e dice il numero", r.voci[0]?.numero, 2);

  // ---- la fila --------------------------------------------------------------------
  const m = (numero) => ({ d: { title: `n${numero}` }, numero });
  t.eq("un buco ferma la fila (la Ruota del Tempo, dal vivo)", inFila([m(2), m(4), m(5)], 1).map((x) => x.numero).join(","), "2");
  t.eq("un volume oltre il tuo senza il suo precedente non si propone", inFila([m(4)], 2).length, 0);
  t.eq("la novella a mezzo numero sta in fila", inFila([m(3), m(2.5)], 2).map((x) => x.numero).join(","), "2.5,3");
  t.eq("senza il tuo numero si parte dal primo trovato", inFila([m(5), m(3), m(4)], null).map((x) => x.numero).join(","), "3,4,5");
  t.eq("al massimo PER_SAGA", inFila([m(2), m(3), m(4), m(5)], 1).length, PER_SAGA);
  t.eq(
    "i senza numero valgono solo dove nessuno ne ha uno",
    inFila([m(2), { d: {}, numero: null }], 1).length,
    1
  );
  t.eq("… e li' passano in ordine d'uscita", inFila([{ numero: null }, { numero: null }], 1).length, 2);

  // ---- i seguiti -----------------------------------------------------------------
  const serie = {
    "Best Served Cold": { saga: "World of the First Law", sagaOrder: 1 },
    "The Heroes": { saga: "World of the First Law", sagaOrder: 2 },
    "House of Chains": { saga: "Malazan", sagaOrder: 4 },
    Esplode: "boom",
  };
  const sagaDiSerie = async ({ title }) => {
    if (serie[title] === "boom") throw new Error("rete");
    return serie[title] || null;
  };
  const v = (titolo) => ({ titolo, autore: "A" });
  let tenuti = await primiDiSerie([v("House of Chains"), v("The Heroes"), v("Best Served Cold"), v("Muto")], {
    sagaDi: sagaDiSerie,
    saghe: ["Malazan"],
    max: 5,
  });
  t.eq(
    "fuori la tua saga e i seguiti, dentro il primo di un'altra e il muto",
    tenuti.map((x) => x.titolo).join(","),
    "Best Served Cold,Muto"
  );
  tenuti = await primiDiSerie([v("Best Served Cold")], { sagaDi: sagaDiSerie, saghe: ["First Law"], max: 5 });
  t.eq("«World of the First Law» non e' la tua «First Law»: si confronta a lettere uguali", tenuti.length, 1);
  tenuti = await primiDiSerie([v("Esplode")], { sagaDi: sagaDiSerie, max: 5 });
  t.eq("una domanda che esplode non si porta via il libro", tenuti.length, 1);
  tenuti = await primiDiSerie([v("a"), v("b"), v("c")], { sagaDi: sagaDiSerie, max: 2 });
  t.eq("ci si ferma a max tenuti", tenuti.length, 2);
  tenuti = await primiDiSerie([v("The Heroes"), v("The Heroes"), v("a")], { sagaDi: sagaDiSerie, max: 5, prove: 2 });
  t.eq("… e a `prove` domande", tenuti.length, 0);

  // ---- i gusti --------------------------------------------------------------------
  t.eq(
    "gli argomenti comuni, senza i generici, contati una volta per libro",
    argomentiComuni([
      ["Fiction", "Fantasy", "Fantasy", "epic", "Fiction, fantasy, general"],
      ["Fantasy", "Large type books", "epic"],
      ["Fantasy", "Wizards"],
    ]).join(","),
    "Fantasy,epic,Wizards"
  );
  const d = (title, autore, extra = {}) => ({
    title,
    author_name: [autore],
    ratings_count: 100,
    ratings_average: 4.2,
    first_publish_year: 2000,
    subject: ["Fantasy", "epic"],
    ...extra,
  });
  const risultati = [
    {
      argomento: "Fantasy",
      docs: [
        d("A Game of Thrones", "George R. R. Martin", { first_publish_year: 1996 }),
        d("A Clash of Kings", "George R. R. Martin", { first_publish_year: 1998, ratings_average: 4.4 }),
        d("Pochi voti", "Uno", { ratings_count: MIN_VOTI - 1 }),
        d("Per ragazzi", "Due", { subject: ["Fantasy", "epic", "Juvenile fiction"] }),
        d("The Name of the Wind", "Patrick Rothfuss", { subject: ["Fantasy", "epic", "Adult books for young adults", "Homeless children"] }),
        d("The Raven", "Edgar Allan Poe", { subject: ["Fantasy"], ratings_average: 4.9 }),
        d("Gardens", "Steven Erikson"),
        d("Tigana", "Guy Gavriel Kay"),
        d("The Two Towers (Lord of the Rings Book 2)", "Tolkien"),
      ],
    },
    { argomento: "epic", docs: [d("Les Misérables", "Victor Hugo", { subject: ["epic"], ratings_average: 4.9 })] },
  ];
  const gusti = daGusti(risultati, [...casa, libro("k", "Tigana", "Kay, Guy Gavriel")]);
  const titoli = gusti.map((x) => x.titolo);
  t.c("un libro per autore, il piu' vecchio: il primo di una serie", titoli.includes("A Game of Thrones") && !titoli.includes("A Clash of Kings"));
  t.c("… ma il suo voto conta per l'autore", gusti[0].titolo === "A Game of Thrones");
  t.c("pochi voti non sono un giudizio", !titoli.includes("Pochi voti"));
  t.c("un libro per ragazzi non passa", !titoli.includes("Per ragazzi"));
  t.c("… ma una parola sparsa negli argomenti non lo fa diventare tale (dal vivo)", titoli.includes("The Name of the Wind"));
  t.c("un argomento solo non basta dove ce ne sono due (The Raven, Les Misérables)", !titoli.includes("The Raven") && !titoli.includes("Les Misérables"));
  t.c("un autore che hai gia' e' della sezione di sopra", !titoli.includes("Gardens"));
  t.c("un libro che hai non torna", !titoli.includes("Tigana"));
  t.c("un «Book 2» non e' una scoperta", !titoli.some((x) => /Two Towers/.test(x)));
  t.c("il perche' dice il voto con la virgola", gusti[0].perche.startsWith("★ 4,2 su Open Library"));
  t.eq(
    "con un argomento solo, uno basta",
    daGusti([{ argomento: "Fantasy", docs: [d("The Raven", "Poe", { subject: ["Fantasy"] })] }], []).length,
    1
  );

  // ---- i preferiti comandano ------------------------------------------------------
  t.eq("il cuore vale un voto pieno", pesoLibro({ fav: true }, "unread"), 2.5);
  t.eq("… e si somma al voto", pesoLibro({ fav: true, rating: 5 }, "read"), 5);
  t.eq("un letto senza voto vale uno", pesoLibro({}, "read"), 1);
  t.eq("un abbandono toglie", pesoLibro({ rating: 3 }, "abandoned"), -2.5);
  const lunga = [
    libro("w1", "The Eye of the World", "Robert Jordan", { saga: "Wheel of Time", sagaOrder: 1 }),
    libro("w2", "The Great Hunt", "Robert Jordan", { saga: "Wheel of Time", sagaOrder: 2 }),
    libro("w3", "The Dragon Reborn", "Robert Jordan", { saga: "Wheel of Time", sagaOrder: 3 }),
    libro("m1", "Gardens of the Moon", "Steven Erikson", { saga: "Malazan", sagaOrder: 1, fav: true, rating: 5 }),
  ];
  const stLunga = stati({ w1: "read", w2: "read", w3: "read", m1: "read" });
  const ordinate = saghePartite(lunga, { statusOf: stLunga });
  t.eq("la saga amata viene prima di quella lunga che trascini", ordinate.map((s) => s.saga).join(","), "Malazan,Wheel of Time");
  t.c("… e sa di avere un preferito", ordinate[0].preferita && !ordinate[1].preferita);
  t.eq("… il peso resta il conto dei volumi letti", ordinate[1].peso, 3);
  const molte = Array.from({ length: 9 }, (_, i) =>
    libro(`s${i}`, `Volume ${i}`, `Autore ${i}`, { saga: `Saga ${i}`, sagaOrder: 1 })
  );
  molte.push(libro("amata", "Amata", "Autore Z", { saga: "Saga Z", sagaOrder: 1, fav: true }));
  const tagliate = saghePartite(molte, { statusOf: () => "read" });
  t.c("al taglio delle saghe resta quella del tuo preferito", tagliate.length === 8 && tagliate[0].saga === "Saga Z");
  t.eq("il peso dei generi: il cuore il doppio", pesoGusto({ fav: true, rating: 5 }), 3);
  t.eq("… un quattro vale uno", pesoGusto({ rating: 4 }), 1);
  const pesati = argomentiPesati([
    { argomenti: ["Fantasy"], peso: 1, titolo: "Tre" },
    { argomenti: ["Grimdark", "Fantasy"], peso: 3, titolo: "Gardens of the Moon" },
    { argomenti: ["Romance"], peso: 1, titolo: "Uno" },
    { argomenti: ["Romance"], peso: 1, titolo: "Due" },
  ]);
  t.eq("un genere del preferito batte uno di due libri da quattro", pesati.map((a) => a.nome).join(","), "Fantasy,Grimdark,Romance");
  t.eq("… e si ricorda il libro amato per primo", pesati[0].fonti.join(","), "Gardens of the Moon,Tre");
  t.eq("un elenco nudo vale uno, come prima", argomentiPesati([["Fantasy"], ["Fantasy"]])[0].peso, 2);
  // tre generi, ognuno dei due libri ne tocca due: Scuro quello del
  // preferito, Tenero no. L'autore di Scuro viene dopo in alfabetico, cosi'
  // senza i pesi vincerebbe Tenero.
  const pesiGusti = daGusti(
    [
      { argomento: "Grimdark", peso: 3, fonti: ["Gardens of the Moon"], docs: [d("Scuro", "Zeta", { subject: ["Grimdark", "Romance"] })] },
      { argomento: "Romance", peso: 1, fonti: ["Uno"], docs: [d("Tenero", "Alfa", { subject: ["Romance", "Cozy"] })] },
      { argomento: "Cozy", peso: 1, fonti: ["Due"], docs: [] },
    ],
    []
  );
  t.eq("a pari voto sale chi tocca il genere del preferito", pesiGusti[0].titolo, "Scuro");
  const soli = daGusti(
    [
      { argomento: "Grimdark", peso: 3, fonti: ["Gardens of the Moon"], docs: [d("Scuro", "Autore A", { subject: ["Grimdark"] })] },
      { argomento: "Romance", peso: 1, fonti: ["Uno"], docs: [d("Tenero", "Autore B", { subject: ["Romance"], ratings_average: 4.3 })] },
    ],
    []
  );
  t.eq("… ma due argomenti restano due: con uno solo non passa nessuno", soli.length, 0);
  t.c("il perche' nomina il libro amato", pesiGusti[0].perche.endsWith("· come «Gardens of the Moon»"));

  // ---- quel che hai non torna, scritto in qualunque modo ------------------------
  const scaffale = [
    libro("g", "Malazan Book of the Fallen 01 - Gardens of the Moon", "Erikson, Steven"),
    libro("o", "The First Law Trilogy: The Blade Itself, Before They Are Hanged", "Joe Abercrombie"),
    libro("p", "Mortal Engines", "Philip Reeve"),
    libro("z", "Saga X 02 - Nameless Book", ""),
  ];
  t.c("il titolo dentro l'etichetta dello scaffale e' tuo (segnalato)", giaInCasa({ title: "Gardens of the Moon", author: "Steven Erikson" }, scaffale));
  t.c("… anche dentro un omnibus", giaInCasa({ title: "Before They Are Hanged", author: "Abercrombie, Joe" }, scaffale));
  t.c("… ma non di un altro autore", !giaInCasa({ title: "Gardens of the Moon", author: "Qualcuno" }, scaffale));
  t.c("… ne' senza autore", !giaInCasa({ title: "Gardens of the Moon", author: "" }, scaffale));
  t.c("… nemmeno quando manca da tutt'e due i lati", !giaInCasa({ title: "Nameless Book", author: "" }, scaffale));
  t.c("… ne' a meta' parola", !giaInCasa({ title: "Engine", author: "Philip Reeve" }, scaffale));
  t.c("… ne' un titolo troppo corto", !giaInCasa({ title: "Eng", author: "Philip Reeve" }, [libro("q", "Mortal Eng Stuff", "Philip Reeve")]));
  t.c("… e il titolo uguale resta tuo come prima", giaInCasa({ title: "Mortal Engines", author: "" }, scaffale));
  // la saga non ripropone il volume che hai dentro un omnibus
  const omni = [
    libro("o1", "Gardens of the Moon", "Steven Erikson", { saga: "Malazan", sagaOrder: 1 }),
    libro("o2", "Malazan Omnibus: Deadhouse Gates, Memories of Ice", "Steven Erikson"),
  ];
  const rOmni = await prossimiDellaSaga(
    { saga: "Malazan", autore: "Steven Erikson", letti: [omni[0]], ordine: 1 },
    opereInOrdine([doc("Gardens of the Moon", 1999), doc("Deadhouse Gates", 2000), doc("Memories of Ice", 2001)]),
    omni,
    { sagaDi }
  );
  t.eq("la saga non ripropone i volumi che hai dentro un omnibus", rOmni.voci.length, 0);

  // ---- il giro ---------------------------------------------------------------------
  t.eq("a gruppi, nell'ordine degli ingressi", (await aGruppi([30, 10, 20], async (x) => {
    await new Promise((ok) => setTimeout(ok, x));
    return x;
  }, 2)).join(","), "30,10,20");

  const urls = [];
  const finto = (rotte) => async (u) => {
    urls.push(u);
    const q = new URL(u).searchParams;
    for (const [prova, docs] of rotte) if (prova(q)) return { ok: true, json: async () => ({ docs }) };
    return { ok: true, json: async () => ({ docs: [] }) };
  };
  const biblio = [libro("1", "Gardens of the Moon", "Steven Erikson", { saga: "Malazan", sagaOrder: 1, rating: 5 })];
  const g = await consigliDalCatalogo(biblio, {
    statusOf: stati({ 1: "read" }),
    sagaDi,
    fetcher: finto([
      [(q) => q.get("author") === "Steven Erikson" && q.get("sort") === "editions", [doc("Gardens of the Moon", 1999), doc("Deadhouse Gates", 2000, { cover_i: 240727 }), doc("Memories of Ice", 2001)]],
      [(q) => q.get("title") === "Gardens of the Moon", [{ key: "/w/1", title: "Gardens of the Moon", author_name: ["Steven Erikson"], subject: ["Fantasy", "epic"] }]],
      [
        (q) => /subject:"Fantasy"/.test(q.get("q") || ""),
        [d("Night of Knives", "Ian C. Esslemont", { ratings_average: 4.6 }), d("A Game of Thrones", "George R. R. Martin", { cover_i: 9269962 })],
      ],
    ]),
  });
  t.eq("il giro intero: le saghe", g.consigli?.saghe.map((x) => x.titolo).join(","), "Deadhouse Gates,Memories of Ice");
  t.eq("… e la sezione degli autori non c'e' piu' (chiesto dal lettore)", g.consigli.autori, undefined);
  t.eq(
    "… i gusti, senza il volume di una saga che segui scritto da un'altra mano (sta nella sezione delle saghe)",
    g.consigli.gusti.map((x) => x.titolo).join(","),
    "A Game of Thrones"
  );
  // LA COPERTINA: il numero del catalogo viaggia sulla voce, e chi non ce
  // l'ha resta senza invece di prendersi quella di un altro.
  t.eq("la saga porta la copertina del suo volume", g.consigli.saghe.map((x) => x.copertina).join(","), "240727,");
  t.eq("… e chi non ce l'ha vale null", g.consigli.saghe[1].copertina, null);
  t.eq("i gusti portano la copertina", g.consigli.gusti[0].copertina, 9269962);
  t.c(
    "la copertina si chiede al catalogo, nelle opere e nei generi",
    urls.filter((u) => /sort=editions|subject%3A/.test(u)).every((u) => new URL(u).searchParams.get("fields").split(",").includes("cover_i"))
  );
  t.c("… e le domande ci sono davvero", urls.some((u) => /subject%3A/.test(u)) && urls.some((u) => /sort=editions/.test(u)));
  t.eq("il numero del catalogo e' la copertina", copertinaDi({ cover_i: 12 }), 12);
  t.eq("… anche scritto come stringa", copertinaDi({ cover_i: "12" }), 12);
  t.eq("… senza: null", copertinaDi({}), null);
  t.eq("… zero o negativo: null (-1 e' il «niente» del catalogo)", [copertinaDi({ cover_i: 0 }), copertinaDi({ cover_i: -1 })].join(","), ",");
  t.eq("… un decimale o una parola: null", [copertinaDi({ cover_i: 1.5 }), copertinaDi({ cover_i: "abc" })].join(","), ",");
  t.eq("… nessun documento: null", copertinaDi(null), null);
  t.eq("l'indirizzo dell'immagine", urlCopertina(240727), "https://covers.openlibrary.org/b/id/240727-M.jpg");
  t.eq("… in un'altra misura", urlCopertina(5, "S"), "https://covers.openlibrary.org/b/id/5-S.jpg");
  t.eq("… senza copertina nessun indirizzo", [urlCopertina(null), urlCopertina(undefined), urlCopertina(0), urlCopertina("x"), urlCopertina(-1), urlCopertina(1.5)].join(","), ",,,,,");
  t.eq("il catalogo mostra saghe, stile e gusti (gli autori che leggi no, chiesto dal lettore)", SEZIONI_CATALOGO.join(","), "saghe,stile,gusti");
  t.eq(
    "… e le opere dell'autore si chiedono una volta sola",
    urls.filter((u) => /sort=editions/.test(u)).length,
    1
  );
  t.eq("… col momento, per sapere quando rifarlo", typeof g.quando, "number");
  const caduta = await consigliDalCatalogo(biblio, {
    statusOf: stati({ 1: "read" }),
    sagaDi,
    fetcher: async () => {
      throw new TypeError("Failed to fetch");
    },
  });
  t.eq("nessuna risposta dal catalogo e' «rete», non «niente da proporre»", caduta.error, "rete");
  const mezza = await consigliDalCatalogo(biblio, {
    statusOf: stati({ 1: "read" }),
    sagaDi,
    fetcher: async (u) => {
      if (new URL(u).searchParams.get("title")) throw new TypeError("Failed to fetch");
      return finto([[(q) => q.get("sort") === "editions", [doc("Gardens of the Moon", 1999), doc("Deadhouse Gates", 2000)]]])(u);
    },
  });
  t.eq("una domanda caduta non si porta via le altre", mezza.consigli?.saghe.map((x) => x.titolo).join(","), "Deadhouse Gates");
  t.eq("… e si conta", mezza.mancate, 1);
  t.eq("biblioteca vuota: nessuna domanda, nessun errore", (await consigliDalCatalogo([], { fetcher: async () => { throw new Error("x"); } })).error, undefined);

  // I GENERI DEI PREFERITI ENTRANO NEL TAGLIO: senza i pesi i due generi
  // dei quattro stelle («Yak», «Zeta», due libri ciascuno) e «Wolf» si
  // prenderebbero i tre posti, e quello del libro col cuore resterebbe fuori.
  urls.length = 0;
  const gusti6 = [
    libro("f", "Amato", "A Uno", { fav: true, rating: 5 }),
    libro("y1", "Yak Uno", "A Due", { rating: 4 }),
    libro("y2", "Yak Due", "A Tre", { rating: 4 }),
    libro("z1", "Zeta Uno", "A Quattro", { rating: 4 }),
    libro("z2", "Zeta Due", "A Cinque", { rating: 4 }),
    libro("w1", "Wolf Uno", "A Sei", { rating: 4 }),
  ];
  const argomentiDi = { Amato: ["Xenon"], "Yak Uno": ["Yak"], "Yak Due": ["Yak"], "Zeta Uno": ["Zeta"], "Zeta Due": ["Zeta"], "Wolf Uno": ["Wolf"] };
  await consigliDalCatalogo(gusti6, {
    statusOf: () => "read",
    sagaDi,
    fetcher: async (u) => {
      urls.push(u);
      const q = new URL(u).searchParams;
      const t0 = q.get("title");
      const docs = argomentiDi[t0] ? [{ key: "/w", title: t0, author_name: [q.get("author")], subject: argomentiDi[t0] }] : [];
      return { ok: true, json: async () => ({ docs }) };
    },
  });
  t.c("il genere del libro col cuore si chiede al catalogo", urls.some((u) => new URL(u).searchParams.get("q") === 'subject:"Xenon"'));

  t.c("mai cercati: da cercare", scaduti(null));
  t.c("cercati ieri: si tengono", !scaduti({ quando: 1000 }, 1000 + 86400000));
  t.c("cercati oltre la settimana: si rifanno", scaduti({ quando: 1000 }, 1000 + SCADENZA + 1));
}
