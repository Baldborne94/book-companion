import { Component } from "react";
import { C, FONT_TITLE, F, R, px } from "../data/constants.js";

// QUANDO SI ROMPE QUALCOSA, LO SCHERMO NON DEVE RESTARE BIANCO.
//
// React ha una regola sola e spietata: un'eccezione durante il disegno di
// un componente, se nessuno la raccoglie, smonta l'albero INTERO. Il
// lettore non vede un errore: vede l'app sparire. E siccome i suoi libri
// stanno tutti dentro l'app, la prima cosa che pensa e' «ho perso
// tutto» — che non e' vero (i tomi sono in IndexedDB, i segni in
// localStorage, non li tocca nessuno), ma non c'e' niente sullo schermo
// che glielo dica.
//
// Questa e' l'unica classe dell'app, e non e' una svista: raccogliere
// un'eccezione di disegno si puo' fare SOLO con una classe — non esiste
// un hook che lo faccia, e non e' in programma.
//
// DUE ANELLI, non uno. Quello grosso avvolge tutta l'app; quello stretto
// avvolge il libro aperto, che e' la parte piu' complicata e quella dove
// un difetto e' piu' probabile. Cosi' un guasto dentro il reader ti
// riporta in biblioteca invece di portarsi via anche lei — e la
// biblioteca e' esattamente il posto da cui puoi riaprire il libro.
//
// L'ERRORE SI MOSTRA, non si nasconde. Una frase in inglese in mezzo alla
// pergamena e' brutta, ma e' l'unica cosa che permette di capire cos'e'
// successo: chi legge ci manda uno screenshot, e senza quella riga
// resterebbe solo «si e' rotto».
export default class Guasto extends Component {
  constructor(props) {
    super(props);
    this.state = { guaio: null };
  }

  static getDerivedStateFromError(err) {
    return { guaio: err };
  }

  componentDidCatch(err, info) {
    // niente telemetria: in console, dove chi sviluppa lo trova, e basta
    console.error("Book Companion — guasto raccolto:", err, info?.componentStack);
  }

  riprova = () => {
    this.setState({ guaio: null });
    this.props.onChiudi?.();
  };

  render() {
    if (!this.state.guaio) return this.props.children;
    const messaggio = String(this.state.guaio?.message || this.state.guaio || "").slice(0, 300);
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 90,
          background: C.bg,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
          padding: 28,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 56, filter: `drop-shadow(0 0 22px ${C.arcane}66)` }}>🕯️</div>
        <h2 style={{ fontFamily: FONT_TITLE, fontWeight: 600, fontSize: F.titolo, color: C.text }}>
          La candela si è spenta
        </h2>
        <p style={{ color: C.muted, fontSize: F.corpo, lineHeight: 1.55, maxWidth: px(460) }}>
          {this.props.dentroIlLibro
            ? "Qualcosa si è rotto mentre leggevi. Il punto in cui eri è salvato: torna in biblioteca e riapri il tomo."
            : "Qualcosa si è rotto. "}
          <strong style={{ color: C.text }}>
            I tuoi libri, i segnalibri e le evidenziazioni sono al sicuro su questo dispositivo.
          </strong>
        </p>
        {messaggio && (
          <code
            style={{
              maxWidth: "min(92vw, 520px)",
              padding: "8px 12px",
              borderRadius: R.piccolo,
              border: `1px solid ${C.border}`,
              background: C.surface,
              color: C.dim,
              fontSize: F.minuscolo,
              lineHeight: 1.45,
              wordBreak: "break-word",
            }}
          >
            {messaggio}
          </code>
        )}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", marginTop: 4 }}>
          <button
            onClick={this.riprova}
            style={{
              padding: "11px 22px",
              borderRadius: R.piccolo,
              background: `linear-gradient(180deg, ${C.accent}, ${C.accentDeep})`,
              color: C.onAccent,
              fontWeight: 600,
              fontSize: F.corpo,
            }}
          >
            {this.props.dentroIlLibro ? "Torna in biblioteca" : "Riprova"}
          </button>
          {/* L'ultima spiaggia, e sta scritta chiara: ricaricare la pagina
              non cancella niente: i dati non stanno nella pagina. */}
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "11px 22px",
              borderRadius: R.piccolo,
              border: `1px solid ${C.border}`,
              color: C.muted,
              fontSize: F.corpo,
            }}
          >
            Ricarica l'app
          </button>
        </div>
      </div>
    );
  }
}
