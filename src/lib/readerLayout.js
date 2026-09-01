// I conti del reader che non hanno bisogno di un DOM. Stanno fuori da
// `Reader.jsx` per la stessa ragione di `readerTheme.js`: sono le parti
// dove un errore non si vede leggendo il diff, e un test se le puo'
// importare (`test/impaginazione.test.mjs`).

// L'AVANZO DI RIGA: quanto togliere dal fondo del riquadro.
//
// L'altezza della colonna non e' un multiplo dell'altezza di riga, e
// quello che resta in fondo — da 1 a 23px secondo lo schermo — e' spazio
// morto. Qui c'e' solo l'aritmetica; il quando e il dove restano nel
// reader, che e' l'unico a sapere se epub.js ha finito di montare.
//
// Due trappole, tutt'e due gia' cascate una volta:
//
// (1) SI MISURA SEMPRE SULL'ALTEZZA SENZA RITAGLIO. Tolto l'avanzo la
//     colonna torna multipla e di avanzo ne ha zero: rimisurando l'altezza
//     CORRENTE il ritaglio si annullerebbe, poi tornerebbe, all'infinito.
//     Per questo `attuale` si somma prima del resto.
//
// (2) IL RITAGLIO E' IN PIXEL INTERI E L'INTERLINEA NO (corpo grande:
//     26,4px). Si arrotonda per ECCESSO, o la colonna resta un capello
//     sopra il multiplo; ma a meno di un pixel dalla riga piena non si
//     toglie niente — quella riga ci sta, e portargliela via sarebbe una
//     riga di lettura buttata.
//
// Torna `null` quando non c'e' niente da misurare: colonna piu' bassa di
// una riga, interlinea assurda, numeri che non sono numeri. `null` non e'
// zero — zero vuol dire «misurato, e non c'e' avanzo».
export function ritaglioAvanzo({ colonna, riga, attuale = 0 } = {}) {
  if (!Number.isFinite(riga) || riga <= 1) return null;
  if (!Number.isFinite(colonna) || colonna <= riga) return null;
  const grezzo = (colonna + (Number.isFinite(attuale) ? attuale : 0)) % riga;
  return grezzo < 1 || riga - grezzo < 1 ? 0 : Math.ceil(grezzo);
}

// L'indice del libro, da albero a elenco: epub.js lo consegna annidato, la
// pagina lo mostra in fila con un rientro per livello.
export function flattenToc(items, depth = 0, out = []) {
  for (const it of items || []) {
    out.push({ href: it.href, label: (it.label || "").trim() || "…", depth });
    if (it.subitems?.length) flattenToc(it.subitems, depth + 1, out);
  }
  return out;
}

// UN SEGNO CHE NON SI LASCIA NEMMENO LEGGERE NON SI DA' A EPUB.JS.
//
// Misurato in un browser vero: dando a `rendition.display()` un CFI
// malformato, epub.js non torna una promessa rifiutata — esplode DENTRO LA
// SUA CODA (`Queue.dequeue` → `Spine.get` → `new EpubCFI`), fuori da
// qualunque catena di promesse che noi possiamo agganciare. Nessun `catch`
// arriva li': l'errore risale come «non gestito» e il lettore si vede
// «questo tomo non si lascia aprire… il file potrebbe essere danneggiato»
// su un romanzo perfettamente sano, con l'unica via d'uscita di cancellarlo
// e reimportarlo. Quindi non c'e' niente da PRENDERE: c'e' da non darglielo.
//
// La classe arriva da fuori (`ePub.CFI`) per la ragione di sempre: cosi' un
// test la chiama con un finto invece di tirarsi dietro epub.js.
//
// Attenzione a cosa NON fa: un CFI *ben formato* che parla di un pezzo che
// il libro non ha piu' passa di qui senza un graffio, ed e' giusto — quello
// `display` lo rifiuta come si deve, e lo gestisce il `catch` la'.
export function cfiLeggibile(CFI, cfi) {
  // Scorciatoia, non guardia: `String(null)` fa «null», che il parser
  // rifiuta lo stesso — provato togliendola, e non falliva niente. Resta
  // perche' un libro mai aperto e' il caso normale e non merita un giro
  // dentro un parser per sentirsi dire di no.
  if (!cfi) return false;
  try {
    new CFI(String(cfi));
    return true;
  } catch {
    return false;
  }
}
