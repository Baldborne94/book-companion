// IL RETRO DEL LIBRO, che era già dentro il file.
//
// Gli ePub portano `dc:description` nei metadati, ed è quasi sempre il
// testo di quarta di copertina: scritto dall'editore, e quindi senza
// spoiler per mestiere. epub.js lo legge già e noi lo buttavamo via.
//
// Il pezzo dove si sbaglia è la ripulitura: quella descrizione è HTML,
// spesso scappato, dentro un attributo XML.
import { ripulisci, buona, dalMetadata, MAX, MINIMO } from "../src/lib/sinossi.js";

export default async function (t) {
  // ---- il caso di tutti i giorni ---------------------------------------
  t.eq("il testo semplice passa intatto", ripulisci("Un romanzo di vendetta."), "Un romanzo di vendetta.");

  // ---- L'HTML SE NE VA -------------------------------------------------
  // mostrarla com'è vorrebbe dire stampare i tag sullo schermo
  t.eq("i tag spariscono", ripulisci("<p>Monza Murcatto</p>"), "Monza Murcatto");
  t.eq("anche quelli in mezzo", ripulisci("Il <b>migliore</b> generale"), "Il migliore generale");
  t.eq("e quelli con attributi", ripulisci(`<p class="x" id="y">Testo</p>`), "Testo");
  t.eq("un `br` diventa un a capo", ripulisci("Prima<br/>Dopo"), "Prima\nDopo");
  t.eq("e la fine di un paragrafo una riga vuota", ripulisci("<p>Uno</p><p>Due</p>"), "Uno\n\nDue");

  // ---- L'HTML SCAPPATO, che è il caso vero -----------------------------
  // `dc:description` è HTML dentro un attributo XML: arriva scappato una
  // volta, a volte due. Si scappa PRIMA di togliere i tag — chi toglie i
  // tag per primo si ritrova i `&lt;p&gt;` intatti, li scappa dopo, e a
  // quel punto sono tag veri che nessuno toglie più.
  t.eq("l'HTML scappato si ripulisce lo stesso", ripulisci("&lt;p&gt;Monza&lt;/p&gt;"), "Monza");
  t.eq("le entità comuni si sciolgono", ripulisci("Styria &amp; Talins"), "Styria & Talins");
  t.eq("le virgolette tipografiche", ripulisci("&ldquo;Vendetta&rdquo;"), "“Vendetta”");
  t.eq("la lineetta", ripulisci("Sette uomini &mdash; sette morti"), "Sette uomini — sette morti");
  t.eq("i puntini", ripulisci("E poi&hellip;"), "E poi…");
  t.eq("il numero decimale", ripulisci("Anno &#8212; zero"), "Anno — zero");
  t.eq("e quello esadecimale", ripulisci("Anno &#x2014; zero"), "Anno — zero");
  // un'entità che non conosciamo si lascia com'è: inventarsi una resa
  // sarebbe peggio che mostrarla
  t.eq("un'entità sconosciuta resta", ripulisci("&chissa; che roba"), "&chissa; che roba");
  // UN SOLO GIRO DI SCAPPAMENTO: due aprirebbero la porta a un `&amp;lt;`
  // scritto apposta, che al secondo giro tornerebbe un tag vero
  t.eq("non si scappa due volte", ripulisci("&amp;lt;p&amp;gt;"), "&lt;p&gt;");

  // ---- gli spazi si riordinano ------------------------------------------
  t.eq("gli spazi doppi si stringono", ripulisci("Uno    due"), "Uno due");
  t.eq("lo spazio unificatore diventa spazio", ripulisci("Uno&nbsp;due"), "Uno due");
  t.eq("le righe vuote di troppo si riducono", ripulisci("Uno\n\n\n\n\nDue"), "Uno\n\nDue");
  t.eq("e i bordi si tolgono", ripulisci("   Uno   "), "Uno");

  // ---- SI TAGLIA A FINE FRASE ------------------------------------------
  // certi editori ci infilano la rassegna stampa e la biografia
  // dell'autore. Ma un retro che finisce con «l'unico modo per» sembra un
  // guasto, non una scelta.
  const frase = "Monza Murcatto è la donna più temuta di Styria. ";
  const lungo = frase.repeat(60);
  const tagliato = ripulisci(lungo);
  t.c("il testo lungo si accorcia", tagliato.length <= MAX, String(tagliato.length));
  t.c("e finisce con un punto", /\.$/.test(tagliato), tagliato.slice(-40));
  t.c("senza puntini di sospensione", !tagliato.endsWith("…"));
  // se una frase sola è più lunga del tetto non c'è punto dove tagliare:
  // lì i puntini sono onesti
  const muro = "a".repeat(MAX * 2);
  t.c("un muro senza punti si tronca coi puntini", ripulisci(muro).endsWith("…"));
  t.c("e sta comunque nel tetto", ripulisci(muro).length <= MAX + 1);

  // ---- QUELLO CHE NON È UN RETRO DI COPERTINA --------------------------
  // certi ePub ci mettono il nome del convertitore, o «Unknown», o la
  // stessa riga per tutto il catalogo: mostrarlo è peggio che tacere,
  // perché sembra che il libro parli di quello
  const vera = "Monza Murcatto, la Serpe di Talins, è la donna più temuta di tutta la Styria.";
  t.c("una quarta di copertina vera è buona", buona(vera));
  t.c("«Unknown» no", !buona("Unknown"));
  t.c("«calibre» nemmeno", !buona("calibre (3.48.0) [https://calibre-ebook.com]"));
  t.c("«N/A» nemmeno", !buona("N/A"));
  t.c("e un residuo corto neanche", !buona("Un romanzo."));
  t.c("il vuoto meno che mai", !buona(""));
  t.c("e il niente", !buona(undefined));
  t.c("il minimo è una soglia vera", vera.length > MINIMO);

  // ---- dai metadati alla stringa da mostrare ---------------------------
  t.eq("la descrizione dell'ePub arriva pulita", dalMetadata({ description: `<p>${vera}</p>` }), vera);
  // «» è una RISPOSTA, non un fallimento: vuol dire «guardato, non c'è», e
  // serve a non riaprire un ePub da trenta megabyte a ogni tocco
  t.eq("nessuna descrizione dà la stringa vuota", dalMetadata({}), "");
  t.eq("una descrizione-spazzatura pure", dalMetadata({ description: "Unknown" }), "");
  t.eq("e nessun metadato", dalMetadata(undefined), "");
  t.c("ed è sempre una stringa, mai `undefined`", typeof dalMetadata({}) === "string");
}
