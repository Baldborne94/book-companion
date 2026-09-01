// IL RETRO CERCATO IN RETE, per i libri che nel file non ce l'hanno.
//
// La scala delle fonti e': (1) il file — l'ha scritto l'editore, funziona
// offline, e' la migliore; (2) il catalogo in rete, che e' questo modulo;
// (3) l'Oracolo dalle prime pagine, che costa e resta l'ultima spiaggia.
// Chiesto dal lettore: «invece di infastidire l'oracolo, tanto lo trovi
// online».
//
// QUI IL TITOLO ESCE DAL DISPOSITIVO, ed e' una scelta dichiarata: la
// regola «i titoli non escono mai» riguarda il MODELLO — che
// riconoscerebbe il libro e risponderebbe a memoria, spoiler compresi —
// non un catalogo bibliografico, che alla domanda «che libro e'?» risponde
// con la quarta di copertina e basta. La riga sotto il retro dice da dove
// viene («Dal catalogo in rete»), come la banda del dizionario.
import { ripulisci, buona } from "./sinossi.js";

const pulisci = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// ---------------------------------------------------------------------
// IL TITOLO CHE ABBIAMO NON È IL TITOLO CHE IL CATALOGO CONOSCE.
//
// Misurato su quindici titoli della forma che gli ePub portano davvero:
// **4 su 15**. Non era il catalogo a non avere i libri — era la domanda a
// essere impossibile. `Eric (Discworld, #9)`, `09 - Eric`,
// `Terry Pratchett - Discworld 09 - Eric`, `Mistborn - The Final Empire
// (v5.0)`: nessuno di questi è un titolo, sono un titolo più
// l'etichettatura di chi ha impacchettato il file. E il ripiego
// dell'import è **il nome del file** (`importBook.js`), quindi ogni ePub
// senza metadati arriva qui con la spazzatura attaccata.
//
// Non si sceglie UNA pulitura: si prova una scala di varianti, dalla più
// fedele alla più spogliata, e ci si ferma alla prima che risponde. Chi
// pulisce troppo in un colpo solo perde i titoli che una parentesi ce
// l'hanno per davvero.

// Le parole che dentro una parentesi dicono «questo è un etichetta
// dell'editore», non parte del titolo. Con un numero accanto bastano.
const ETICHETTA = /\b(book|bk|vol|volume|novel|series|saga|cycle|part|edition|ed|unabridged|retail|ebook|epub|pdf|mobi|azw3|omnibus|trilogy|libro|volume|serie|ciclo|parte|edizione)\b/i;
// una parentesi con dentro una cifra è quasi sempre «(Discworld 8)»,
// «(v5.0)», «(#9)»: il numero è il segno che non è prosa
const haNumero = /\d/;

// una parentesi o una quadra si toglie SOLO se dichiara di essere
// un'etichetta: «Eric (Faust)» è un sottotitolo vero e resta
const senzaParentesi = (s) =>
  s.replace(/[([{]([^)\]}]*)[)\]}]/g, (tutto, dentro) =>
    haNumero.test(dentro) || ETICHETTA.test(dentro) ? " " : tutto
  );

// «01 - », «09. », «#3 »: la numerazione che mettono i cataloghi di file
const senzaNumerazione = (s) => s.replace(/^\s*#?\d{1,3}\s*[-–—.)]\s+/, "");

const spazi = (s) => s.replace(/[_]+/g, " ").replace(/\s+/g, " ").trim().replace(/[\s\-–—:;,.]+$/, "");

// Un segmento fra trattini che NON è il titolo: l'autore, un numero nudo,
// «Discworld 09», «Book One of the First Law».
const NUMERO_A_PAROLE = /\b(one|two|three|four|five|six|seven|eight|nine|ten|uno|due|tre|quattro|cinque)\b/i;
function eEtichetta(pezzo, autore) {
  const p = pulisci(pezzo);
  if (!p) return true;
  if (autore && p === pulisci(autore)) return true;
  if (/^\d+$/.test(p)) return true;
  // «Book One of the First Law», «Volume 2», «Discworld 09»
  if (ETICHETTA.test(pezzo) && (haNumero.test(pezzo) || NUMERO_A_PAROLE.test(pezzo))) return true;
  if (/\s\d{1,3}$/.test(p)) return true;
  return false;
}

// GLI AUTORI CHE NON SONO AUTORI. Un ePub senza metadati arriva con
// «Unknown», e il catalogo, a cui `author=Unknown` lo passiamo per
// davvero, risponde **zero risultati** — misurato: con l'autore giusto
// gli stessi tre libri li trova. Un autore che non sappiamo è meglio di
// un autore sbagliato: si toglie e si cerca per solo titolo.
const AUTORE_VUOTO = /^(unknown|unknown author|anonymous|anonimo|autore sconosciuto|sconosciuto|n\/?a|none|null|undefined|calibre|various|aa\.? ?vv\.?)$/i;
export const autorePerIlCatalogo = (autore) => {
  const a = String(autore || "").trim();
  return !a || AUTORE_VUOTO.test(a) ? "" : a;
};

// La scala delle domande, dalla più fedele alla più spogliata. Mai più di
// `MAX_VARIANTI`: ogni variante è un giro di rete, e la scheda si apre
// mentre il lettore guarda.
export const MAX_VARIANTI = 3;

export function varianti(titolo, autore) {
  const a = autorePerIlCatalogo(autore);
  const grezzo = String(titolo || "").replace(/\.(epub|pdf|mobi|azw3?)$/i, "");
  const fuori = [];
  const metti = (s) => {
    const t = spazi(s || "");
    if (t && !fuori.some((v) => pulisci(v) === pulisci(t))) fuori.push(t);
  };

  // 1. il titolo com'è arrivato: se una parentesi era parte del titolo
  //    vero, l'abbiamo provato prima di spogliarlo
  metti(grezzo);
  // via le etichette fra parentesi e la numerazione in testa, e via i
  // segmenti fra trattini che sono autore, saga o numero. I DUE PASSI SI
  // FANNO INSIEME, e questo è il secondo tentativo, non il terzo: provare
  // anche la forma di mezzo (spogliata delle parentesi ma non dei
  // segmenti) bruciava un giro senza aggiungere niente — è quasi sempre
  // uguale a questa — e su un nome di file come «Terry Pratchett -
  // Discworld 09 - Eric (v5.0)» il tetto scattava PRIMA di arrivare a
  // «Eric». Misurato nel browser: tre domande, e nessuna era quella
  // giusta.
  const nudo = spazi(senzaNumerazione(senzaParentesi(spazi(grezzo))));
  const pezzi = nudo.split(/\s+[-–—]\s+/).filter((p) => !eEtichetta(p, a));
  metti(pezzi.length ? pezzi.join(" - ") : nudo);
  // 3. l'ultima spiaggia: il solo ultimo segmento — che è dove sta il
  //    titolo quando l'autore in testa non l'abbiamo riconosciuto perché
  //    il libro l'autore non ce l'ha — o il solo titolo prima dei due
  //    punti: «The Blade Itself: Book One of The First Law».
  if (pezzi.length > 1) metti(pezzi[pezzi.length - 1]);
  const primaDeiDuePunti = nudo.split(/\s*:\s*/)[0];
  if (primaDeiDuePunti !== nudo) metti(primaDeiDuePunti);

  return fuori.slice(0, MAX_VARIANTI);
}

// LA SCELTA DEL VOLUME E' LA PARTE DOVE SI SBAGLIA. Il catalogo risponde
// con cinque edizioni e adattamenti («Eric: the graphic novel», la guida,
// il cofanetto): prendere «il primo con una descrizione» pesca il libro
// sbagliato, e una quarta di copertina di un ALTRO libro e' peggio di
// nessuna. Il titolo del catalogo deve cominciare col titolo cercato (o
// viceversa: «Eric» trova «Eric. Faust», la nostra edizione col
// sottotitolo), e se l'autore lo abbiamo, l'autore deve comparire.
export function scegliVolume(voci = [], { title, author } = {}) {
  const t = pulisci(title);
  if (!t) return null;
  const a = pulisci(author);
  const buone = voci.filter((v) => {
    if (!v?.testo) return false;
    if (a) {
      const autori = (v.autori || []).map(pulisci).join(" ");
      // come nei doppioni: un autore MANCANTE non e' una smentita, uno
      // DIVERSO si'
      if (autori && !autori.includes(a.split(" ").pop())) return false;
    }
    return true;
  });
  // DUE PASSATE, e l'ordine e' la difesa: il titolo ESATTO prima, il
  // prefisso poi. «Eric» esatto deve battere «Eric: The Graphic Novel» —
  // che col solo prefisso passerebbe, ed e' un ALTRO libro — mentre il
  // prefisso resta per le edizioni col sottotitolo («Eric. Faust»), che
  // sono il libro giusto scritto piu' lungo.
  const esatta = buone.find((v) => pulisci(v.titolo) === t);
  if (esatta) return esatta;
  return (
    buone.find((v) => {
      const suo = pulisci(v.titolo);
      return suo.startsWith(t + " ") || t.startsWith(suo + " ");
    }) || null
  );
}

// le due risposte dei cataloghi, ridotte a una forma sola — cosi' la
// scelta si prova senza rete
export const daGoogle = (json) =>
  (json?.items || []).map((i) => ({
    titolo: i?.volumeInfo?.title,
    autori: i?.volumeInfo?.authors || [],
    testo: i?.volumeInfo?.description || "",
  }));

export const daOpenLibrary = (doc, lavoro) => {
  const d = lavoro?.description;
  return [
    {
      titolo: doc?.title,
      autori: doc?.author_name || [],
      testo: typeof d === "string" ? d : d?.value || "",
    },
  ];
};

// Torna { testo, fonte } o `null`. MAI la stringa vuota: un buco di rete
// non e' «questo libro un retro non ce l'ha», e salvarlo come tale
// impedirebbe di riprovare — la stessa regola della cache del dizionario.
// Un giro solo di cataloghi, su UN titolo già pulito. `cercaRetro` lo
// chiama una volta per variante.
async function unGiro(f, title, author) {
  // 1. Google Books: copertura migliore, e per le edizioni italiane la
  //    descrizione arriva in italiano
  try {
    const q = [`intitle:"${title}"`, author ? `inauthor:"${author}"` : ""].filter(Boolean).join("+");
    const r = await f(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=5&printType=books`
    );
    if (r.ok) {
      const scelto = scegliVolume(daGoogle(await r.json()), { title, author });
      const t = ripulisci(scelto?.testo);
      if (buona(t)) return { testo: t, fonte: "Google Books" };
    }
  } catch {
    /* si prova il prossimo catalogo */
  }
  // 2. Open Library: meno descrizioni, ma nessun altro padrone.
  //    L'autore si manda solo se ce l'abbiamo: `author=` vuoto e
  //    `author=Unknown` tornano ZERO risultati anche su libri che il
  //    catalogo ha (misurato su «Fool's Errand»).
  try {
    const r = await f(
      `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}${author ? `&author=${encodeURIComponent(author)}` : ""}&limit=5&fields=key,title,author_name`
    );
    // una ricerca andata storta non è «questo libro non esiste»: si tace
    // e si passa alla variante dopo — prima un 500 di passaggio si
    // portava via tutto il resto della scala
    if (!r.ok) return null;
    const docs = (await r.json())?.docs || [];
    for (const doc of docs.slice(0, 3)) {
      if (!doc?.key) continue;
      try {
        const rl = await f(`https://openlibrary.org${doc.key}.json`);
        if (!rl.ok) continue;
        const scelto = scegliVolume(daOpenLibrary(doc, await rl.json()), { title, author });
        const t = ripulisci(scelto?.testo);
        if (buona(t)) return { testo: t, fonte: "Open Library" };
      } catch {
        /* il prossimo lavoro */
      }
    }
  } catch {
    /* niente rete: si riprovera' */
  }
  return null;
}

export async function cercaRetro({ title, author } = {}, fetcher) {
  const f = fetcher || fetch;
  const autore = autorePerIlCatalogo(author);
  for (const variante of varianti(title, author)) {
    const trovato = await unGiro(f, variante, autore);
    if (trovato) return trovato;
  }
  return null;
}
