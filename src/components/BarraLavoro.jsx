// LA RIGA DEL LAVORO LUNGO, sopra la barra delle sezioni (vedi il giro dei
// CBR in `App.jsx`): da ogni sezione si vede a che punto e', e si ferma. Ad
// app riaperta con un giro lasciato a meta', la stessa riga offre di
// riprenderlo.
import { C, F, R, px } from "../data/constants.js";
import { fraseLavoro } from "../lib/convertiCbr.js";

export default function BarraLavoro({ lavoro, restanti = 0, onFerma, onRiprendi, onLascia }) {
  const tasto = {
    minHeight: 44,
    padding: "6px 14px",
    borderRadius: R.piccolo,
    border: `1px solid ${C.border}`,
    color: C.text,
    fontSize: F.nota,
    flexShrink: 0,
  };
  return (
    <div
      role="status"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "6px 16px",
        minHeight: px(40),
        background: C.surface,
        borderTop: `1px solid ${C.border}`,
        color: C.muted,
        fontSize: F.nota,
        fontVariantNumeric: "tabular-nums",
        flexShrink: 0,
      }}
    >
      {lavoro ? (
        <>
          <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>
            <span style={{ color: C.text }}>{fraseLavoro(lavoro)}</span>
            {lavoro.titolo ? ` · «${lavoro.titolo}»` : ""}
          </span>
          <button onClick={onFerma} style={tasto}>
            Ferma
          </button>
        </>
      ) : (
        <>
          <span style={{ flex: 1, minWidth: 0 }}>
            {restanti === 1 ? "Resta un CBR da convertire in CBZ" : `Restano ${restanti} CBR da convertire in CBZ`}: il giro si era fermato a metà.
          </span>
          <button onClick={onRiprendi} style={{ ...tasto, borderColor: `${C.accent}88`, color: C.accent }}>
            Riprendi
          </button>
          <button onClick={onLascia} style={{ ...tasto, color: C.muted }}>
            Lascia
          </button>
        </>
      )}
    </div>
  );
}
