import { C, F, R } from "../data/constants.js";
import { fmtBytes } from "../lib/bytes.js";
import { PIANO, fetta, spartisci, stretto } from "../lib/spazio.js";

// La voce della legenda: un quadretto del colore della sua regione e il
// testo accanto. Sta qui e la usano tutt'e due le righe, perché è proprio
// l'uguaglianza a fare il lavoro — chi impara che l'oro sono i libri deve
// ritrovarlo identico sopra e sotto.
const voce = (colore, testo) => (
  <span>
    <span style={{ color: colore }}>■</span> {testo}
  </span>
);

// QUEL CHE STA SU QUESTO DISPOSITIVO, spartito come il gigabyte di lassù.
//
// Era un numero nudo in mezzo alla riga di servizio, subito dopo «286 libri
// custoditi», e per posizione diceva «i tuoi libri pesano 978 MB»: falso, e
// non verificabile — dentro ci sono anche copertine, melodie, dizionario
// offline e cache. Segnalato: «queste diciture mi confondono sempre».
//
// SI DICE SOLO QUEL CHE SI È MISURATO. Il primo giro teneva anche la stima
// del browser come totale, con «altro» a nominare quel che avanzava: al
// banco è venuto fuori che togliendo una melodia da 5 MB «altro» CRESCE —
// da 4 a 9 — perché i Blob li pesiamo subito e la stima resta indietro. Un
// numero che si muove al contrario del gesto appena fatto è la confusione
// da curare, non un di più. La stima resta dov'è utile: la riga «ne restano
// X» quando il dispositivo si sta riempiendo davvero.
export function PesoQui({ parti, estimate }) {
  if (!parti) return null;
  const { libri, melodie } = parti;
  // niente da pesare, niente da dire: una riga «su questo dispositivo» sopra
  // il nulla sarebbe un'intestazione senza contenuto
  if (libri <= 0 && melodie <= 0) return null;
  return (
    <div style={{ marginTop: 10, display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
      <span style={{ fontSize: F.piccolo, color: C.text }}>💾 Su questo dispositivo</span>
      <span style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: F.minuscolo, color: C.muted }}>
        {/* gli zeri non si dicono, qui come nella barra: chi non ha melodie
            non deve leggere «melodie 0 B» a ogni apertura dello scaffale */}
        {libri > 0 && voce(C.accent, `libri ${fmtBytes(libri)}`)}
        {melodie > 0 && voce(C.arcane, `melodie ${fmtBytes(melodie)}`)}
        {/* IL TETTO SOLO QUANDO STRINGE, come prima: «di 499,6 GB» era la
            domanda «cosa sarebbero sti 500 GB?», e sotto soglia un numero
            che non chiede niente si impara a ignorare. */}
        {stretto(estimate) && (
          <span style={{ color: C.accent }}>ne restano {fmtBytes(Math.max(0, estimate.quota - estimate.usage))}</span>
        )}
      </span>
    </div>
  );
}

// DI COSA È FATTO QUEL GIGABYTE.
//
// In Libreria si leggeva «☁ 340 MB di 1 GB», ed è il numero giusto — è
// l'unico spazio che vincola davvero — ma non risponde alla domanda del
// lettore, che era: «quanto spazio ho ancora per caricare la mia musica».
// Libri e melodie stanno nello STESSO secchio, quindi un totale non dice
// quale dei due lo sta riempiendo, e sono due cose diversissime: un romanzo
// pesa qualche megabyte, un brano da tenere a schermo spento parecchi di più.
//
// La barra sta qui, in un file suo, perché la mostrano in due — la Libreria e
// il pannello della sincronizzazione — e i colori devono essere GLI STESSI:
// chi impara che il viola sono le melodie in un posto deve ritrovarcelo
// nell'altro, o sono due grafici diversi che raccontano lo stesso secchio.
//
// TRE VOCI E NON DUE: il vuoto della barra è la terza regione, ed è quella
// che risponde alla domanda. Con le sole due piene bisognerebbe fare la
// sottrazione a mente, che è esattamente quel che il numero dovrebbe
// risparmiare.

export function BarraCloud({ dati, compatta }) {
  if (!dati) return null;
  const { libri, melodie, totale } = dati;
  const { libri: byteLibri, melodie: byteMelodie, liberi, sforato } = spartisci(dati);
  return (
    <div style={compatta ? { marginTop: 10 } : { marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 7 }}>
        <span style={{ fontSize: compatta ? F.piccolo : F.nota, color: C.text }}>
          ☁ {fmtBytes(totale)} lassù
        </span>
        <span style={{ fontSize: F.minuscolo, color: C.muted }}>di {fmtBytes(PIANO)} del piano gratuito</span>
      </div>
      <div style={{ display: "flex", height: 8, borderRadius: R.minimo, overflow: "hidden", background: C.dim }}>
        <div style={{ width: fetta(byteLibri), background: C.accent }} />
        <div style={{ width: fetta(byteMelodie), background: C.arcane }} />
      </div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 8, fontSize: F.minuscolo, color: C.muted }}>
        {/* GLI ZERI NON SI DICONO, qui come nel resoconto dell'import: «0
            melodie · 0 MB» a ogni apertura dello scaffale è una riga che si
            impara a saltare, e a forza di saltarla non si legge nemmeno
            quella accanto. Una regione larga zero non ha una voce. */}
        {libri.quanti > 0 &&
          voce(C.accent, `${libri.quanti} ${libri.quanti === 1 ? "libro" : "libri"} · ${fmtBytes(byteLibri)}`)}
        {melodie.quanti > 0 &&
          voce(
            C.arcane,
            `${melodie.quanti} ${melodie.quanti === 1 ? "melodia" : "melodie"} · ${fmtBytes(byteMelodie)}`
          )}
        {/* il vuoto della barra ha il colore del vuoto della barra: la
            legenda spiega tutte e tre le sue regioni, non due su tre. E se il
            piano è stato passato non si scrive «0 liberi», che è vero solo
            per modo di dire: si dice di quanto — un numero fermo a zero
            nasconderebbe proprio la misura del guaio. */}
        {sforato > 0 ? voce(C.accent, `${fmtBytes(sforato)} oltre il piano`) : voce(C.dim, `${fmtBytes(liberi)} liberi`)}
      </div>
    </div>
  );
}
