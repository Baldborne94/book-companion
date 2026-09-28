// LA MEMORIA DEL RICONOSCIMENTO SAGHE ALL'APERTURA DELLA LIBRERIA.
//
// Chiesto dal lettore: «fai anche la memoria del riconoscimento saghe
// all'apertura». La passata automatica ricordava gia' ogni tomo guardato —
// la collana letta dal file (`collana_<id>`), la risposta del catalogo
// (`catalogo_<id>`) — ma per SAPERE che l'aveva guardato doveva chiederlo a
// IndexedDB, tomo per tomo e uno dietro l'altro: ogni ePub senza saga due
// letture (memoria e file), ogni tomo senza saga una per il catalogo e una
// per la veto della deduzione, piu' le due deduzioni sull'intera
// biblioteca. Su centinaia di libri senza saga — e da quando si leggono da
// Drive i file sul tablet quasi non ci sono, quindi quei tomi non si
// segnano mai come visti — erano centinaia di transazioni a OGNI apertura,
// per arrivare alla stessa conclusione della volta prima.
//
// Qui la memoria e' UNA per tutto il giro: una firma di quel che il giro
// guarda. Se la firma e' quella dell'ultimo giro finito bene, il giro non
// avrebbe niente da dire e non si fa. La firma e' la regola che sbaglia in
// silenzio — un campo dimenticato vuol dire un giro saltato che doveva
// girare, e una saga che non arriva senza che nessuno lo dica — quindi
// dentro c'e' TUTTO quel che le cinque strade leggono:
//   - titolo e autore (tavola, titolo, catalogo, deduzione);
//   - saga, saga tolta e numero (chi e' candidato, la grafia di casa);
//   - quali ePub candidati hanno i byte QUI: un tomo sceso da Drive va
//     guardato, e i suoi campi non cambiano scendendo. Il tipo di file
//     passa di qui e non ha un campo suo: conta solo per dire chi e'
//     candidato, e un ePub che diventa altro cambia gia' questo segno
//     (un campo del tipo scritto al primo giro e' stato TOLTO, perche'
//     nessuna mutazione lo faceva cascare);
//   - la versione dell'app, perche' una tavola o una regola nuova deve
//     poter girare sulla biblioteca di ieri.
//
// E si ricorda solo un giro FINITO BENE: un buco di rete nel catalogo, un
// giro fermato a meta' o smontato prima della fine si rifanno la volta dopo.

export const CHIAVE_GIRO = "bc_saghe_giro";

// cyrb53: la firma sta in localStorage, e seicento libri in chiaro sono
// cinquanta chilobyte scritti a ogni giro
function impasta(s) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

const campo = (v) => (v == null ? "" : String(v));

export function firmaGiro(libri = [], { conByte = null, versione = "" } = {}) {
  const righe = (libri || [])
    .filter((b) => b && b.id)
    .map((b) => {
      const candidato = b.fileType === "epub" && !String(b.saga || "").trim();
      // i byte contano solo per chi il giro aprirebbe: sugli altri
      // scendere o salire non cambia niente, e far girare tutto per un
      // fumetto portato sul tablet sarebbe lavoro buttato
      const byte = candidato ? (conByte ? (conByte.has(b.id) ? "1" : "0") : "?") : "";
      return [b.id, b.title, b.author, b.saga, b.sagaTolta ? "1" : "", b.sagaOrder, byte]
        .map(campo)
        .join("\u0001");
    })
    // l'ordine della biblioteca non e' un fatto sui libri: riordinare lo
    // scaffale non deve far rigirare niente
    .sort();
  return impasta(`${campo(versione)}\u0002${righe.join("\u0002")}`);
}

export function leggiGiro(storage = globalThis.localStorage) {
  try {
    return storage?.getItem(CHIAVE_GIRO) || null;
  } catch {
    return null;
  }
}

export function ricordaGiro(firma, storage = globalThis.localStorage) {
  try {
    storage?.setItem(CHIAVE_GIRO, firma);
  } catch {
    /* senza memoria si rigira: costa e non rompe */
  }
}

// un giro si ricorda solo se ha detto tutto quel che aveva da dire
export function giroFinito({ collane, catalogo } = {}) {
  if (collane?.fermato || catalogo?.fermato) return false;
  if ((catalogo?.rete || 0) > 0) return false;
  return true;
}
