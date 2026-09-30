// LA RIGA DEL LAVORO LUNGO, sopra la barra delle sezioni (vedi il giro dei
// CBR e l'importazione da Drive in `App.jsx`): da ogni sezione si vede a
// che punto e', e si ferma. Ad app riaperta con un giro dei CBR lasciato a
// meta', la stessa riga offre di riprenderlo.
import { C, F, R, px } from "../data/constants.js";
import { fraseLavoro, fraseImport } from "../lib/convertiCbr.js";

export default function BarraLavoro({ importo = null, onFermaImport, lavoro, restanti = 0, onFerma, onRiprendi, onLascia }) {
  const tasto = {
    minHeight: 44,
    padding: "6px 14px",
    borderRadius: R.piccolo,
    border: `1px solid ${C.border}`,
    color: C.text,
    fontSize: F.nota,
    flexShrink: 0,
  };
  const riga = {
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
  };
  const giro = lavoro || restanti > 0;
  return (
    <>
      {importo && (
        <div role="status" style={riga}>
          <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>
            <span style={{ color: C.text }}>📥 Da Google Drive: {fraseImport(importo)}</span>
            {importo.nome ? ` · «${importo.nome}»` : ""}
          </span>
          <button onClick={onFermaImport} style={tasto}>
            Ferma
          </button>
        </div>
      )}
      {giro && <GiroCbr {...{ riga, tasto, lavoro, restanti, onFerma, onRiprendi, onLascia }} />}
    </>
  );
}

function GiroCbr({ riga, tasto, lavoro, restanti, onFerma, onRiprendi, onLascia }) {
  return (
    <div role="status" style={riga}>
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
