// I RACCONTI DELLE ANTOLOGIE SI SPUNTANO, PERCHE' NON SI POSSONO APRIRE.
//
// Chiesto dal lettore: «decidi tu come gestire le storie presenti nelle
// antologie nell'ordine suggerito dal sito». Un romanzo della guida e' un
// FILE: ha una scheda, uno stato, un punto di lettura, e il cammino sa
// dire se l'hai letto. Un racconto no — «The Aurelian» e' quaranta pagine
// dentro «Eye of Terra», e in biblioteca esiste solo l'antologia. Senza
// un segno suo il cammino non potrebbe MAI dire che quel passo e' fatto:
// resterebbe fermo li' mentre leggi il resto dell'Eresia, che e' lo
// stesso difetto per cui le antologie erano state tolte dal passo.
//
// Il segno e' quindi una spunta, e non c'e' altra strada: lo stato di un
// libro non puo' dire niente di un racconto dentro un altro libro.
//
// LA CHIAVE E' TITOLO + AUTORE, come nel wh-companion. Non l'indice nella
// tavola: quella cresce — i racconti sono appena entrati, e la guida puo'
// aggiungerne — e un indice spostato farebbe risultare letto un racconto
// che non hai mai aperto, in silenzio.
const KEY = "bc_racconti";

export const chiaveRacconto = (voce) =>
  `${String(voce?.t || "").trim()}__${String(voce?.a || "").trim()}`;

function leggi() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(raw) ? raw.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function raccontiLetti() {
  return new Set(leggi());
}

// Torna l'elenco nuovo, perche' chi disegna ha bisogno di un oggetto
// diverso per accorgersi del cambiamento.
export function segnaRacconto(voce, letto) {
  const k = chiaveRacconto(voce);
  if (!k.trim() || k === "__") return raccontiLetti();
  const ora = leggi().filter((x) => x !== k);
  if (letto) ora.push(k);
  scriviRacconti(ora);
  // IL TIMBRO STA QUI e non in `scriviRacconti`: quella e' la porta da cui
  // entra il cloud, e ritimbrare quel che e' appena sceso vorrebbe dire
  // rimandarlo su al giro dopo (stessa regola di `save*`/`write*` nella
  // musica).
  try {
    localStorage.setItem("bc_prefs_upd", String(Date.now()));
  } catch {
    /* come sopra */
  }
  return new Set(ora);
}

// La porta della sincronizzazione: scrive e basta, senza timbrare.
export function scriviRacconti(elenco) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...new Set(elenco || [])]));
  } catch {
    /* storage pieno o negato: si perde la spunta, non la lettura */
  }
}

// UNIONE, MAI SOSTITUZIONE — la regola delle melodie e delle
// evidenziazioni. Qui pero' non servono lapidi, e la differenza va detta:
// un racconto spuntato per sbaglio e poi tolto TORNA al primo giro, se
// l'altro dispositivo lo aveva. E' il lato sicuro: fra «un racconto letto
// che risulta da leggere» e «uno da leggere che risulta letto», il
// secondo ti fa saltare una tappa della storia senza accorgertene.
export function fondiRacconti(qui = [], lassu = []) {
  return [...new Set([...(qui || []), ...(lassu || [])])].filter((x) => typeof x === "string");
}
