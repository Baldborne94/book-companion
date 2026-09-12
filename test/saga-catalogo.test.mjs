// LA SAGA DAL CATALOGO.
//
// Chiesto dal lettore: «perche' non hai riconosciuto la saga di Cook,
// Ruocchio e Lynch?». Le quattro strade locali erano mute, e Open Library
// la sa — ma sulle edizioni scrive di tutto, e una collana dell'EDITORE
// presa per saga mette il libro in una storia che non esiste. Qui si prova
// il VOTO, con le stringhe vere raccolte dal catalogo il giorno della cura,
// e il giro di rete con un fetcher finto.
import { candidato, sagaDalleEdizioni, scegliOpera, cercaSaga, ripassaCatalogo, MIN_VOTI } from "../src/lib/sagaDalCatalogo.js";

const ed = (...series) => series.map((s) => ({ series: Array.isArray(s) ? s : [s] }));

export default async function (t) {
  // ---- una stringa di collana → nome e numero ----------------------------
  const c = (s) => candidato(s);
  t.eq("«Wheel of Time (1)»", c("Wheel of Time (1)")?.saga, "Wheel of Time");
  t.eq("…col numero", c("Wheel of Time (1)")?.n, 1);
  t.eq("«Wheel of time -- bk.1»", c("Wheel of time -- bk.1")?.n, 1);
  t.eq("«The first law. Book 1»", c("The first law. Book 1")?.saga, "The first law");
  t.eq("«The First Law: Book 1»", c("The First Law: Book 1")?.saga, "The First Law");
  t.eq("«First law trilogy -- book one»", c("First law trilogy -- book one")?.n, 1);
  t.eq("«The Stormlight Archive #1»", c("The Stormlight Archive #1")?.saga, "The Stormlight Archive");
  t.eq("«The Stormlight Archive, 1»", c("The Stormlight Archive, 1")?.n, 1);
  t.eq("«Malazan book of the fallen -- bk. 1»", c("Malazan book of the fallen -- bk. 1")?.saga, "Malazan book of the fallen");
  t.eq("«Sun eater -- Book one»", c("Sun eater -- Book one")?.saga, "Sun eater");
  t.eq("«The Faithful and the Fallen (#1)»", c("The Faithful and the Fallen (#1)")?.n, 1);
  t.eq("«The prince of nothing ;»", c("The prince of nothing ;")?.saga, "The prince of nothing");
  t.eq("«Shadows of the Apt book one»", c("Shadows of the Apt book one")?.saga, "Shadows of the Apt");
  t.eq("senza numero resta senza", c("The Black Company")?.n, null);

  // ---- IL RUMORE, che e' la parte che sbaglia in silenzio ---------------
  for (const s of [
    "A Bantam spectra book", "A Tom Doherty Associates book", "Daw book collectors -- no. 1792",
    "DAW book collectors -- no. 1792.", "Blanvalet -- 24292", "24932", "Heyne science fiction & fantasy -- Bd. 06/5291-06/5292",
    "Heyne Allgemeine Reihe 8449", "Oscar classici moderni", "Presses pocket. Science fiction", "Romans -- 18-19",
    "Romans (Éditions Alire) -- 18-19", "Fantasy", "Clásicos Minotauro",
  ]) {
    t.c(`«${s}» non e' una saga`, c(s) === null, JSON.stringify(c(s)));
  }

  // ---- il voto fra le edizioni ------------------------------------------
  // Abercrombie, com'e' davvero: la grafia dei catalogatori ha piu' voti,
  // ma sul ripiano ci va il NOME, con le maiuscole
  const law = sagaDalleEdizioni(
    ed("The first law. Book 1", "The first law. Book 1", "The first law. Book 1", "The First Law: Book 1", "First law trilogy -- book one", "The First Law #1, First Law World #1")
  );
  t.eq("Abercrombie → The First Law", law?.saga, "The First Law");
  t.eq("…numero 1", law?.sagaOrder, 1);
  // Erikson: la collana vera batte l'editore anche se l'editore ha due voti
  const malazan = sagaDalleEdizioni(
    ed("Blanvalet -- 24292", "Blanvalet -- 24292", "Malazan Book of the Fallen (1)", "Malazan Book of the Fallen (1)", "Malazan book of the fallen -- bk. 1", "A Tom Doherty Associates book", "A Tom Doherty Associates book", "24932")
  );
  t.eq("Erikson → Malazan Book of the Fallen", malazan?.saga, "Malazan Book of the Fallen");
  // Ruocchio: due grafie, un voto ciascuna, insieme fanno due
  const sole = sagaDalleEdizioni(ed("The Sun Eater", ["Sun eater -- Book one", "Daw book collectors -- no. 1792"]));
  t.eq("Ruocchio → The Sun Eater", sole?.saga, "The Sun Eater");
  t.eq("…numero 1", sole?.sagaOrder, 1);
  // Jordan: la traduzione portoghese non fa una saga a parte, e l'inglese vince
  const ruota = sagaDalleEdizioni(ed("Wheel of Time (1)", "Wheel of Time (1)", "Wheel of time -- bk.1", "A Roda do Tempo", "La Roue du Temps", "Fantasy"));
  t.eq("Jordan → Wheel of Time", ruota?.saga, "Wheel of Time");
  t.eq("…coi voti di tutt'e due le grafie", ruota?.voti, 3);

  // UNA SOLA EDIZIONE NON BASTA: «Howling Dark» ha «The Sun Eater» su una
  // sola edizione e non si prende — ci pensa la deduzione dai fratelli.
  // E' anche cio' che tiene fuori «Pandora» su Tigana e «Strade blu» su
  // Good Omens: un voto solo e' un catalogatore, non una collana.
  t.eq("un voto solo non basta", sagaDalleEdizioni(ed("The Sun Eater")), null);
  t.eq("Tigana resta senza", sagaDalleEdizioni(ed("Romans -- 18-19", "Pandora", "Pandora (Milan, Italy)")), null);
  t.eq("Lynch resta senza (solo l'editore)", sagaDalleEdizioni(ed("A Bantam spectra book")), null);
  // «Strade blu» e' la collana Mondadori di Good Omens: per FORMA non si
  // distingue da una saga, e a tenerla fuori e' il voto — un'edizione sola
  t.eq("Good Omens resta senza", sagaDalleEdizioni(ed("Strade blu")), null);
  t.eq("nessuna edizione, niente", sagaDalleEdizioni([]), null);
  // E I TITOLI DELLE OPERE VOTANO: su Lynch le edizioni portano solo
  // l'editore, ma le opere si chiamano «Red Seas Under Red Skies (Gentlemen
  // Bastards #2)» — trovato nei dati veri, non immaginato
  const lynch = sagaDalleEdizioni(ed("A Bantam spectra book"), ["Red Seas Under Red Skies (Gentlemen Bastards #2)", "Red Seas under Red Skies"]);
  t.eq("Lynch dai titoli delle opere → Gentlemen Bastards", lynch?.saga, "Gentlemen Bastards");
  t.eq("…numero 2", lynch?.sagaOrder, 2);
  // e VALE DA SOLO: dal vivo e' l'unica scheda che porta la saga, e con un
  // voto per titolo Lynch restava fuori (mutazione provata: a peso 1 casca)
  t.eq("un titolo d'opera con la saga basta da solo", sagaDalleEdizioni([], ["Red Seas Under Red Skies (Gentlemen Bastards #2)"])?.saga, "Gentlemen Bastards");
  t.eq("e un titolo senza saga non vota", sagaDalleEdizioni(ed("The Sun Eater"), ["Howling Dark"]), null);
  // ma non batte la collana delle edizioni quando questa e' piu' votata
  t.eq("le edizioni votate battono un titolo d'opera", sagaDalleEdizioni(ed("Wheel of Time (1)", "Wheel of Time (1)", "Wheel of Time (1)"), ["The Eye of the World (Discworld Novels Book 8)"])?.saga, "Wheel of Time");
  t.c("la soglia e' due", MIN_VOTI === 2);
  // il numero piu' votato, non il primo
  const num = sagaDalleEdizioni(ed("Dune (1)", "Dune (1)", "Duna #1", "The Dune Chronicles, Book 1;", "Dune, Book 1;"));
  t.eq("Dune → Dune", num?.saga, "Dune");
  t.eq("…numero 1", num?.sagaOrder, 1);

  // ---- l'opera giusta fra quelle proposte ---------------------------------
  const docs = [
    { key: "/works/A", title: "Eric: The Graphic Novel", author_name: ["Terry Pratchett"] },
    { key: "/works/B", title: "Eric", author_name: ["Terry Pratchett"] },
    { key: "/works/C", title: "Eric", author_name: ["Qualcun Altro"] },
  ];
  t.eq("il titolo esatto batte il prefisso", scegliOpera(docs, { title: "Eric", author: "Terry Pratchett" })?.key, "/works/B");
  t.eq("un autore diverso e' una smentita", scegliOpera([docs[2]], { title: "Eric", author: "Terry Pratchett" }), null);
  t.eq("un autore mancante non lo e'", scegliOpera([{ key: "/works/D", title: "Eric" }], { title: "Eric", author: "Terry Pratchett" })?.key, "/works/D");
  t.eq("«Unknown» non e' un autore", scegliOpera([docs[2]], { title: "Eric", author: "Unknown" })?.key, "/works/C");

  // ---- il giro di rete, con un catalogo finto -----------------------------
  const finto = (risposte) => async (url) => {
    const u = String(url);
    for (const [pezzo, corpo] of Object.entries(risposte)) if (u.includes(pezzo)) return { ok: true, json: async () => corpo };
    return { ok: false, status: 404 };
  };
  const cook = finto({
    "search.json": { docs: [{ key: "/works/OL1W", title: "Shadows Linger", author_name: ["Glen Cook"] }] },
    "/works/OL1W/editions.json": { entries: ed("The Black Company", "The Black Company", "A Tor book") },
  });
  t.eq("Cook → The Black Company", (await cercaSaga({ title: "Shadows Linger", author: "Glen Cook" }, cook))?.saga, "The Black Company");
  // Lynch dal vivo: tre opere per lo stesso romanzo, la saga nei titoli
  const lynchRete = finto({
    "search.json": { docs: [
      { key: "/works/L1", title: "Red Seas Under Red Skies (Gentlemen Bastards #2)", author_name: ["Scott Lynch"] },
      { key: "/works/L2", title: "Red Seas under Red Skies", author_name: ["Scott Lynch"] },
      { key: "/works/X", title: "Red Seas Under Red Skies: A Study Guide", author_name: ["Qualcun Altro"] },
    ] },
    // l'opera scelta e' L2 (titolo esatto), e le sue edizioni non dicono niente
    "/works/L2/editions.json": { entries: ed("A Bantam spectra book") },
  });
  t.eq("Lynch → Gentlemen Bastards dai titoli delle opere", (await cercaSaga({ title: "Red Seas Under Red Skies", author: "Scott Lynch" }, lynchRete))?.saga, "Gentlemen Bastards");
  t.eq("un catalogo che non la sa torna null", await cercaSaga({ title: "Tigana", author: "Kay" }, finto({ "search.json": { docs: [] } })), null);
  // UN BUCO DI RETE ESPLODE, non torna null: su null si scrive una memoria
  // «il catalogo non la sa», e una rete caduta non e' quella risposta
  let esploso = false;
  try {
    await cercaSaga({ title: "Shadows Linger" }, async () => { throw new TypeError("Failed to fetch"); });
  } catch {
    esploso = true;
  }
  t.c("la rete caduta esplode", esploso);
  esploso = false;
  try {
    await cercaSaga({ title: "Shadows Linger" }, finto({}));
  } catch {
    esploso = true;
  }
  t.c("e un 404 pure", esploso);

  // ---- la passata --------------------------------------------------------
  const LIBRI = [
    { id: "c1", title: "Shadows Linger", author: "Glen Cook", saga: "", sagaOrder: null },
    { id: "r1", title: "Empire of Silence", author: "Christopher Ruocchio", saga: "", sagaOrder: null },
    { id: "l1", title: "The Lies of Locke Lamora", author: "Scott Lynch", saga: "", sagaOrder: null },
    { id: "g", title: "Malice", author: "John Gwynne", saga: "The Faithful and the Fallen", sagaOrder: 1 },
  ];
  const risposte = {
    c1: { saga: "The Black Company", sagaOrder: 2 },
    r1: { saga: "The Sun Eater", sagaOrder: 1 },
    l1: null,
  };
  const memoria = [];
  const esito = await ripassaCatalogo(LIBRI, {
    cerca: async (b) => risposte[b.id],
    segnaVista: async (b, cosa) => memoria.push([b.id, cosa]),
    nomeInCasa: (s) => s,
  });
  t.eq("due trovate", esito.trovate, 2);
  t.eq("una muta", esito.mute, 1);
  t.eq("Cook scritto", esito.campi.c1?.saga, "The Black Company");
  t.eq("…col numero", esito.campi.c1?.sagaOrder, 2);
  t.c("chi la saga ce l'ha non si chiede", !("g" in esito.campi));
  t.eq("la memoria si scrive su trovata E su muta", memoria.length, 3);
  t.c("e la muta si segna come tale", memoria.some(([id, c]) => id === "l1" && c.muta));

  // la rete caduta NON scrive memoria e si conta a parte
  const m2 = [];
  const e2 = await ripassaCatalogo(LIBRI.slice(0, 1), {
    cerca: async () => { throw new Error("rete"); },
    segnaVista: async (b, cosa) => m2.push(cosa),
  });
  t.eq("rete caduta: contata", e2.rete, 1);
  t.eq("rete caduta: nessuna memoria", m2.length, 0);
  // la memoria salta il giro
  const e3 = await ripassaCatalogo(LIBRI, { cerca: async () => { throw new Error("non dovevo essere chiamato"); }, giaVista: async () => true });
  t.eq("chi e' gia' stato chiesto si salta", e3.saltati, 3);
  t.eq("…senza chiamare il catalogo", e3.rete, 0);
  // fermabile a meta', con quel che e' fatto che resta
  let giri = 0;
  const e4 = await ripassaCatalogo(LIBRI, { cerca: async (b) => { giri += 1; return risposte[b.id]; }, vivo: () => giri < 1 });
  t.c("fermata, e lo dice", e4.fermato);
  t.eq("quel che e' fatto resta", e4.trovate, 1);
}
