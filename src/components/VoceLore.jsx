import { useState } from "react";
import { C, FONT_TITLE, F, R } from "../data/constants.js";
import { pezzi, velaVoce, voceLore, indirizzoVoce } from "../lib/lexicanum.js";

// UNA VOCE DI LEXICANUM, letta dentro la scheda del dizionario. I link
// portano alle altre voci SUL DISPOSITIVO, con un «indietro» che ricorda il
// cammino; i paragrafi che citano un volume non ancora letto restano velati
// finche' non li tocchi (`giudiceFonti`). Il velo non e' una sfocatura: il
// testo velato non c'e' proprio, finche' non lo chiedi.

export function Testo({ x, onLink }) {
  return pezzi(x).map((p, i) =>
    p.l && onLink ? (
      <button
        key={i}
        onClick={() => onLink(p.l)}
        style={{
          display: "inline",
          padding: 0,
          font: "inherit",
          fontStyle: p.i ? "italic" : "normal",
          color: C.accent,
          textDecoration: "underline",
          textDecorationColor: `${C.accent}55`,
          textUnderlineOffset: 3,
        }}
      >
        {p.s}
      </button>
    ) : (
      <span key={i} style={p.i ? { fontStyle: "italic" } : undefined}>
        {p.s}
      </span>
    )
  );
}

export function Velo({ perche, onApri }) {
  return (
    <button
      onClick={onApri}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        margin: "0 0 10px",
        padding: "9px 12px",
        border: `1px dashed ${C.border}`,
        borderRadius: R.piccolo,
        color: C.muted,
        fontSize: F.piccolo,
        lineHeight: 1.45,
        minHeight: 44,
      }}
    >
      🕯 Paragrafo velato: {perche}. <span style={{ color: C.arcane }}>Tocca per leggerlo</span>
    </button>
  );
}

export default function VoceLore({ voce: prima, giudice, onChiudi }) {
  const [pila, setPila] = useState([prima]);
  const [aperti, setAperti] = useState(() => new Set());
  const [manca, setManca] = useState("");
  const voce = pila[pila.length - 1];
  const blocchi = velaVoce(voce, giudice);

  async function vai(titolo) {
    setManca("");
    const v = await voceLore(titolo).catch(() => null);
    if (!v) {
      setManca(titolo);
      return;
    }
    setPila((p) => [...p, v]);
    setAperti(new Set());
  }

  function indietro() {
    setManca("");
    if (pila.length > 1) {
      setPila((p) => p.slice(0, -1));
      setAperti(new Set());
    } else onChiudi();
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <button
          onClick={indietro}
          style={{ minHeight: 40, padding: "4px 10px 4px 0", color: C.muted, fontSize: F.piccolo, flexShrink: 0 }}
        >
          ◂ {pila.length > 1 ? pila[pila.length - 2].t : "La parola"}
        </button>
        <span style={{ marginLeft: "auto", fontSize: F.minuscolo, color: C.muted, letterSpacing: 0.6, textTransform: "uppercase" }}>
          Lexicanum · sul dispositivo
        </span>
      </div>
      <div style={{ fontFamily: FONT_TITLE, fontSize: F.titolo, fontWeight: 600, color: C.text, marginBottom: 2 }}>{voce.t}</div>
      {voce.via && <div style={{ fontSize: F.minuscolo, color: C.muted, fontStyle: "italic", marginBottom: 6 }}>da «{voce.via}»</div>}
      {manca && (
        <p style={{ margin: "6px 0 10px", fontSize: F.minuscolo, color: C.muted }}>
          «{manca}» non c'è nel Lexicanum scaricato.
        </p>
      )}
      <div style={{ marginTop: 8 }}>
        {blocchi.length === 0 && (
          <p style={{ fontSize: F.nota, color: C.muted, margin: 0 }}>Questa voce sul wiki non ha ancora un testo.</p>
        )}
        {blocchi.map((b, i) =>
          b.h ? (
            <div
              key={i}
              style={{
                margin: "14px 0 6px",
                fontSize: b.l > 2 ? F.nota : F.corpo,
                fontWeight: 600,
                color: b.l > 2 ? C.muted : C.text,
              }}
            >
              {b.h}
            </div>
          ) : b.v && !aperti.has(i) ? (
            <Velo key={i} perche={b.v} onApri={() => setAperti((a) => new Set(a).add(i))} />
          ) : (
            <p
              key={i}
              style={{
                margin: "0 0 10px",
                paddingLeft: b.li ? 14 : 0,
                fontSize: F.corpo,
                color: C.text,
                lineHeight: 1.55,
              }}
            >
              {b.li && <span style={{ marginLeft: -12, marginRight: 6, color: C.muted }}>•</span>}
              <Testo x={b.x} onLink={vai} />
            </p>
          )
        )}
      </div>
      <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.border}66`, display: "flex", alignItems: "baseline", gap: 9, flexWrap: "wrap" }}>
        <a
          href={indirizzoVoce(voce.t)}
          target="_blank"
          rel="noreferrer"
          style={{ fontSize: F.piccolo, color: C.accent, textDecoration: "none" }}
        >
          Apri su Lexicanum ↗
        </a>
        <span style={{ fontSize: F.minuscolo, color: C.muted }}>di là si spoilera</span>
      </div>
    </div>
  );
}
