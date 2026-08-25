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
export async function cercaRetro({ title, author } = {}, fetcher) {
  const f = fetcher || fetch;
  if (!pulisci(title)) return null;
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
  // 2. Open Library: meno descrizioni, ma nessun altro padrone
  try {
    const r = await f(
      `https://openlibrary.org/search.json?title=${encodeURIComponent(title || "")}&author=${encodeURIComponent(author || "")}&limit=5&fields=key,title,author_name`
    );
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
