import { C, F, R } from "../data/constants.js";
import { fmtBytes } from "../lib/bytes.js";
import { PIANO, fetta, spartisci } from "../lib/spazio.js";

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
  const voce = (colore, testo) => (
    <span>
      <span style={{ color: colore }}>■</span> {testo}
    </span>
  );
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
