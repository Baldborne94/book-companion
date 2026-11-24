import { getFile } from "./bookStore.js";
import { eFumetto } from "./fumetto.js";
import { findMatches } from "./pdfSearch.js";
import { testoDelLibro, puntoNelNodo } from "./testoLibro.js";
import { queryRegex } from "./wordForms.js";

// CERCARE IN TUTTA LA BIBLIOTECA.
//
// Dentro un libro la ricerca era gia' possibile; qui la domanda e' un'altra
// — «dov'era quella frase?» — e la risposta puo' stare in qualunque tomo.
//
// Un tomo per volta, aperto e richiuso. La tentazione sarebbe aprirli tutti
// insieme e cercare in parallelo: su un tablet significa tenere in memoria
// venti libri sbobinati contemporaneamente, e il browser chiude la scheda
// molto prima di finire. Meglio piu' lento e vivo.
//
// Si cerca solo in quello che e' GIA' qui. Un libro che vive solo nel cloud
// si scaricherebbe intero per una domanda di tre parole: si salta e si dice
// quanti ne sono rimasti fuori.

// meno di tre lettere non e' una domanda, e' un setaccio che raccoglie tutto
export const abbastanzaLunga = (q) => (q || "").trim().length >= 3;

// Il passaggio arriva in una riga sola, ma nell'elenco l'occhio deve
// trovare subito la parola cercata. La si ritrova con la stessa espressione
// che l'ha trovata nel libro — quella con le forme flesse — cosi' si accende
// «scrolls» a chi ha chiesto «scroll», e «pergamene» a chi ha chiesto
// «pergamena».
//
// E VALE IN TUTT'E DUE LE LINGUE: qui c'era scritto «pergamene» per
// «pergamena» quando `wordForms` conosceva il solo inglese, cioe' il
// commento prometteva una cosa che il codice non faceva. Adesso la promessa
// e' vera perche' e' stata aggiunta la morfologia italiana, non perche' si
// e' abbassata la promessa.
//
// ESPORTATA PER ESSERE PROVATA: se non ritrova il pezzo, il passaggio finisce
// tutto in `prima` e sullo schermo non si accende niente — nessun errore, solo
// una riga di testo piatta dove l'occhio non trova piu' la parola.
export function spezza(testo, re) {
  if (!re) return { prima: testo, dentro: "", dopo: "" };
  re.lastIndex = 0;
  const m = re.exec(testo);
  if (!m) return { prima: testo, dentro: "", dopo: "" };
  return {
    prima: testo.slice(0, m.index),
    dentro: m[0],
    dopo: testo.slice(m.index + m[0].length),
  };
}

// LA RICERCA SI FA SUL TESTO TENUTO, non sul libro aperto (`testoLibro.js`):
// dalla seconda domanda non si apre piu' niente, e un libro tornato su Drive
// si cerca lo stesso se il suo testo era gia' stato letto. Il passaggio e il
// punto sono quelli di prima — la stessa finestra di 55 caratteri per l'ePub,
// le stesse tre per pagina del PDF — cosi' l'elenco non cambia faccia.
export function cercaNelTesto(testo, query, limite = 6) {
  const re = queryRegex(query);
  if (!re || !testo) return [];
  const out = [];
  if (testo.tipo === "pdf") {
    for (const [i, pagina] of (testo.pagine || []).entries()) {
      for (const m of findMatches(pagina, query)) {
        out.push({ punto: String(i + 1), dove: `pag. ${i + 1}`, prima: m.before, dentro: m.hit, dopo: m.after });
        if (out.length >= limite) return out;
      }
    }
    return out;
  }
  for (const cap of testo.capitoli || []) {
    for (const nodo of cap.nodi) {
      const text = nodo.t;
      if (!text || !text.trim() || !nodo.c) continue;
      re.lastIndex = 0;
      for (const m of text.matchAll(re)) {
        const punto = puntoNelNodo(nodo, m.index);
        if (!punto) continue;
        const a = Math.max(0, m.index - 55);
        const b = Math.min(text.length, m.index + m[0].length + 55);
        const passo =
          (a > 0 ? "…" : "") + text.slice(a, b).replace(/\s+/g, " ").trim() + (b < text.length ? "…" : "");
        out.push({ punto, ...spezza(passo, re) });
        if (out.length >= limite) return out;
      }
    }
  }
  return out;
}

// `leggiByte` arriva da fuori — di norma e' `getFile` di `bookStore` — per la
// ragione di sempre: cosi' un test lo chiama con un finto invece di tirarsi
// dietro IndexedDB.
//
// Qui si chiama DRITTO, e non serve il giro `Promise.resolve().then(…)` che
// `ripassaImpronte` si porta dietro per lo stesso mestiere: la' la chiamata
// sta fuori da ogni `try`, e un `leggiByte` che esplode in modo sincrono si
// porterebbe via la funzione intera; qui sta DENTRO il `try`, quindi il
// `catch` lo prende gia'. Provato mettendocelo: nessuna differenza, ed e'
// stato tolto invece di restare li' a sembrare necessario.
export async function cercaOvunque(
  libri,
  query,
  { onLibro, onTrovato, vivo, perLibro = 6, leggiByte = getFile, leggiTesto = testoDelLibro } = {}
) {
  const attivo = vivo || (() => true);
  let lontani = 0;
  let esaminati = 0;
  for (const [i, libro] of libri.entries()) {
    // un fumetto non ha testo in cui cercare
    if (eFumetto(libro)) continue;
    if (!attivo()) break;
    onLibro?.({ i, totale: libri.length, titolo: libro.title });
    let testo = null;
    try {
      testo = await leggiTesto(libro, { leggiByte });
    } catch {
      /* tomo che non si lascia aprire: gli altri non c'entrano */
      continue;
    }
    if (!testo) {
      lontani++;
      continue;
    }
    esaminati++;
    const trovati = cercaNelTesto(testo, query, perLibro);
    if (trovati.length && attivo()) onTrovato?.({ libro, trovati });
  }
  return { lontani, esaminati };
}
