import { riconosci, TAVOLE } from "./sagaBooks.js";

// IL CAMMINO DI UNA SAGA: la guida per intero, e dentro i TUOI libri.
//
// Chiesto dal lettore con in mano la guida di Polygon all'Eresia di Horus:
// «basandoti sulla guida completa e quello che ho in libreria, riesci a
// farmi una cronologia dei libri nell'ordine della guida?».
//
// Lo scaffale sa gia' mettere in fila i volumi che HAI — dentro una saga
// comanda il numero di lettura — ma non puo' dire niente di quelli che non
// hai, e in un percorso da settantuno tappe e' proprio quello che serve
// sapere: dove sei, cosa viene dopo, e quale buco ti aspetta fra due
// capitoli. La tavola quella fila la conosce tutta.
//
// L'ORDINE E' QUELLO DELL'ARRAY, e non si tocca: la tavola e' scritta nel
// verso in cui la guida si legge, con le antologie e i romanzi 40K INFILATI
// dove vanno letti. Riordinare per `o` — il numero del cammino — sembra la
// cosa ovvia e butterebbe in fondo tutto quello che un numero non ce l'ha:
// il prologo, undici antologie e i sette 40K, cioe' meta' della guida.
//
// I LIBRI SI RICONOSCONO PER TITOLO, mai per il campo Saga. E' la riga che
// fa funzionare tutto il resto sul tablet del lettore, dove quei volumi
// stanno sotto una saga scritta a mano («Warhammer 40K») che nessuna tavola
// conosce: la domanda qui non e' «in che saga l'hai messo», e' «questo
// libro e' quella tappa». A rispondere e' `riconosci`, con le sue guardie
// gia' provate — sedici voci dell'Eresia sono parole comuni («Scars»,
// «Mortis») e senza quelle guardie il cammino si riempirebbe di libri che
// non c'entrano niente.
//
// `riconosce` si passa da fuori come `leggiByte`: in Libreria il
// riconoscimento e' gia' fatto una volta per tutti i libri, e rifarlo per
// ogni ripiano a ogni render sarebbe lo stesso giro moltiplicato per venti.
const chiave = (saga, titolo) => `${saga}\u0000${titolo}`;

export function camminoDi(libri = [], { tavole = TAVOLE, riconosce } = {}) {
  const sapere = riconosce || ((b) => riconosci({ title: b?.title, author: b?.author }));
  const miei = new Map();
  const conti = new Map();
  let riconosciuti = 0;
  for (const b of libri) {
    if (!b) continue;
    const r = sapere(b);
    // senza TITOLO non c'e' una tappa: `riconosci` risponde anche col solo
    // autore («questo e' un Pratchett, la saga gliela do lo stesso»), e li'
    // non sappiamo di quale volume si tratti
    if (!r?.titolo) continue;
    riconosciuti += 1;
    conti.set(r.saga, (conti.get(r.saga) || 0) + 1);
    const k = chiave(r.saga, r.titolo);
    // due copie dello stesso volume sono UNA tappa, e vince la prima:
    // l'ordine in cui arrivano e' quello dello scaffale, non del caso
    if (!miei.has(k)) miei.set(k, b);
  }

  // il ripiano puo' contenere libri di piu' tavole (un volume di un'altra
  // saga finito li' dentro): comanda quella che ne ha di piu', e a parita'
  // la prima dichiarata — un criterio che dipendesse dall'ordine dei libri
  // cambierebbe cammino a ogni import
  let scelta = null;
  for (const tav of tavole) {
    const quanti = conti.get(tav.saga) || 0;
    if (quanti > (scelta?.quanti || 0)) scelta = { tav, quanti };
  }
  if (!scelta) return null;

  const tappe = scelta.tav.libri.map((voce) => ({
    voce,
    libro: miei.get(chiave(scelta.tav.saga, voce.t)) || null,
  }));
  return {
    saga: scelta.tav.saga,
    tappe,
    tue: tappe.filter((t) => t.libro).length,
    // i tuoi libri che in questo cammino non ci sono: non e' un guaio, e'
    // un'informazione — su un ripiano da trentaquattro volumi dice quanti
    // stanno fuori dalla guida invece di lasciarli contare a mano
    fuori: libri.filter(Boolean).length - scelta.quanti,
  };
}

// Le tappe raccolte per PARTE, nell'ordine in cui la guida le incontra.
// Si raggruppa qui e non nel componente per la ragione di sempre: un
// raggruppamento che rimescola non alza nessun errore, cambia solo
// l'ordine di lettura di una guida — e quello nessuno lo verifica a occhio
// su settantuno righe.
export function perParte(tappe = []) {
  const parti = new Map();
  for (const t of tappe) {
    const nome = t?.voce?.c || "";
    if (!parti.has(nome)) parti.set(nome, []);
    parti.get(nome).push(t);
  }
  return [...parti].map(([parte, dentro]) => ({ parte, tappe: dentro }));
}
