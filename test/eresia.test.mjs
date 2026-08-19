// L'ERESIA DI HORUS NEL PERCORSO CD8D. La guida stava in wh-companion e
// rispondeva a «cosa leggo adesso»; qui risponde a «questo file che ho in
// libreria, dove sta nel percorso». Sono due domande diverse, e la
// differenza e' tutta nelle antologie.
//
// E soprattutto: aggiungere una seconda saga non deve rompere la prima.
import { riconosci, ripassa } from "../src/lib/sagaBooks.js";
import HORUS, { SAGA as SAGA_HH } from "../src/data/horusHeresy.js";
import { SAGA as SAGA_DISCO } from "../src/data/discworldBooks.js";

export default async function (t) {
  // ---- la tavola sta in piedi da sola -----------------------------------
  t.c("ci sono i volumi", HORUS.length > 60, String(HORUS.length));
  const ordini = HORUS.map((b) => b.o);
  t.c("ogni volume ha il suo posto", ordini.every((o) => Number.isInteger(o) && o > 0));
  t.eq("e nessun posto e' occupato due volte", new Set(ordini).size, ordini.length);
  t.c("i posti sono di fila", ordini.every((o, i) => o === i + 1), ordini.slice(0, 5).join(","));
  t.c("ogni volume dice a che parte appartiene", HORUS.every((b) => !!b.c));
  const titoli = HORUS.map((b) => b.t.toLowerCase());
  t.eq("nessun titolo ripetuto", new Set(titoli).size, titoli.length);

  // ---- OGNI VOCE RICONOSCE SE STESSA, e nella saga giusta ---------------
  // e' il controllo che prende le collisioni fra le due tavole: se un
  // titolo dell'Eresia venisse mangiato da uno del Mondo Disco (o
  // viceversa) si vedrebbe qui e non fra sei mesi, da uno scaffale storto
  const sbagliati = [];
  for (const b of HORUS) {
    const r = riconosci({ title: b.t, author: b.a || "" });
    if (r?.saga !== SAGA_HH || r?.sagaOrder !== b.o) {
      sbagliati.push(`${b.t} → ${r ? `${r.saga} #${r.sagaOrder}` : "niente"}`);
    }
  }
  t.c("tutte le voci si riconoscono", sbagliati.length === 0, sbagliati.slice(0, 4).join(" · "));

  // ---- il caso di tutti i giorni: un file scaricato ---------------------
  const daFile = (fileName) => riconosci({ title: "", author: "", fileName });
  t.eq(
    "«Horus Rising» dal nome del file",
    daFile("Horus Rising (The Horus Heresy Book 1) - Dan Abnett.epub")?.saga,
    SAGA_HH
  );
  t.c(
    "e col titolo nei metadati",
    riconosci({ title: "Know No Fear", author: "Dan Abnett" })?.saga === SAGA_HH
  );
  // IL CASO CHE MI ERA SFUGGITO: nome del file col numero di collana e
  // SENZA autore, e col nome della saga scritto senza l'articolo. Cercando
  // «the horus heresy» per intero restava mezza saga attaccata al titolo,
  // e «Betrayer» copriva un terzo del campo invece che tutto.
  t.eq(
    "«Betrayer (Horus Heresy 24).epub», senza autore da nessuna parte",
    daFile("Betrayer (Horus Heresy 24).epub")?.saga,
    SAGA_HH
  );
  t.eq(
    "e con l'articolo davanti",
    daFile("Betrayer (The Horus Heresy Book 24).epub")?.saga,
    SAGA_HH
  );

  // ---- `o` E' L'ORDINE DEL PERCORSO, NON IL NUMERO DELLA COLLANA -------
  // e' la cosa che sorprende guardando lo scaffale: CD8D rimescola apposta,
  // quindi il quattordicesimo della Black Library arriva presto nel cammino
  const primoEretico = riconosci({ title: "The First Heretic", author: "Aaron Dembski-Bowden" });
  const fulgrim = riconosci({ title: "Fulgrim", author: "Graham McNeill" });
  t.c("«The First Heretic» è il 14 in collana", HORUS.find((b) => b.t === "The First Heretic")?.n === 14);
  t.c(
    "ma nel percorso viene subito dopo Fulgrim (il 5)",
    primoEretico.sagaOrder > fulgrim.sagaOrder && primoEretico.sagaOrder - fulgrim.sagaOrder <= 2,
    `${fulgrim.sagaOrder} → ${primoEretico.sagaOrder}`
  );
  t.c("e il numero di collana non finisce nell'ordine", primoEretico.sagaOrder !== 14);

  // ---- UN TITOLO DI UNA PAROLA SOLA NON BASTA A DECIDERE ---------------
  // «Scars», «Mortis», «Betrayer»: prese per contenimento si mangerebbero
  // libri di tutt'altre saghe
  t.eq(
    "«Scars» senza il suo autore non è dell'Eresia",
    riconosci({ title: "Scars of the Past", author: "Qualcun Altro" }),
    null
  );
  t.c(
    "ma col suo autore sì",
    riconosci({ title: "Scars", author: "Chris Wraight" })?.saga === SAGA_HH
  );
  t.eq(
    "e un romanzo che si chiama come un volume non viene rapito",
    riconosci({ title: "Betrayer", author: "Una Sconosciuta" }),
    null
  );

  // le antologie l'autore non ce l'hanno: lì il titolo dev'essere TUTTO
  // quello che c'è scritto
  t.c("l'antologia «Eye of Terra» si riconosce", riconosci({ title: "Eye of Terra" })?.saga === SAGA_HH);
  t.eq(
    "ma non si prende un libro che la cita e basta",
    riconosci({ title: "Notes on the Eye of Terra and other essays" }),
    null
  );

  // ---- NIENTE RIPIEGO SULL'AUTORE PER L'ERESIA -------------------------
  // la scrivono venti autori che scrivono anche moltissimo altro: col
  // ripiego, i Gaunt's Ghosts di Abnett diventerebbero Eresia
  t.eq(
    "un Abnett che non è dell'Eresia resta fuori",
    riconosci({ title: "First and Only", author: "Dan Abnett" }),
    null
  );
  // UN AUTORE SBAGLIATO È UNA PROVA, uno mancante no: metà degli ePub
  // l'autore non ce l'hanno, e lì il silenzio non vale come smentita
  t.c(
    "«Betrayer» senza autore entra lo stesso",
    riconosci({ title: "Betrayer", author: "" })?.saga === SAGA_HH
  );
  // LIMITE DICHIARATO: un titolo che ne contiene un altro, quando la voce
  // non porta l'autore (le antologie e i libri del prologo), passa. Per
  // chiuderlo servirebbe il titolo esatto, e allora «Betrayer (Horus
  // Heresy 24).epub» non si riconoscerebbe più: si è scelta la ricezione.

  // ---- UN TITOLO DENTRO UN ALTRO --------------------------------------
  // «Garro» (l'antologia 42) sta dentro «Garro: Knight of the Grey», ed è
  // l'unica coppia del genere fra le due tavole. Vince il più lungo, che è
  // il libro che hai davvero in mano.
  const knight = riconosci({ title: "Garro: Knight of the Grey", author: "James Swallow" });
  t.eq("il titolo lungo vince sul corto", knight?.titolo, "Garro: Knight of the Grey");
  t.c("e l'antologia resta la sua", riconosci({ title: "Garro" })?.titolo === "Garro");

  // ---- IL MONDO DISCO NON SI ACCORGE DI NIENTE -------------------------
  const mort = riconosci({ title: "Mort", author: "Terry Pratchett" });
  t.eq("«Mort» resta del Disco", mort?.saga, SAGA_DISCO);
  t.eq("e il ripiego sull'autore c'è ancora", riconosci({ title: "Un titolo inventato", author: "Terry Pratchett" })?.saga, SAGA_DISCO);
  t.eq("coi suoi fuori-saga al loro posto", riconosci({ title: "Good Omens", author: "Terry Pratchett" }), null);

  // ---- e il ripasso dei libri già in libreria --------------------------
  const tocchi = ripassa({ title: "Betrayer", author: "Aaron Dembski-Bowden", saga: "", series: "" });
  t.eq("il ripasso gli dà la saga", tocchi?.campi.saga, SAGA_HH);
  t.c("e la parte del percorso", /^Part /.test(tocchi?.campi.series || ""), tocchi?.campi.series);
  t.c("più il posto nel cammino", Number.isInteger(tocchi?.campi.sagaOrder));
  // quello che hai scritto tu non si tocca mai
  const gia = ripassa({ title: "Betrayer", author: "Aaron Dembski-Bowden", saga: "La mia saga", series: "Il mio ciclo" });
  t.eq("una saga scritta a mano resta la tua", gia?.campi.saga, undefined);
  t.eq("e il ciclo pure", gia?.campi.series, undefined);
}
