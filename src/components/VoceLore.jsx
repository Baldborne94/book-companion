import { useState } from "react";
import { C, FONT_TITLE, F, R } from "../data/constants.js";
import { pezzi, velaVoce, voceLore, indirizzoVoce, avvisoVoce, LEXICANUM, FANDOM } from "../lib/lexicanum.js";

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

// L'AVVISO DI FANDOM, davanti alla voce intera (chiesto dal lettore:
// «aggiungi fandom come seconda scheda con l'avviso»). Fandom non dice da
// quale libro viene ogni paragrafo, quindi niente veli: si dice quali libri
// della lista delle fonti il lettore non ha ancora letto, e il testo si
// mostra solo se lo chiede. Se le fonti sono tutte lette (o di altre
// saghe), una riga e basta.
export function AvvisoFandom({ avviso, onApri, corto = false }) {
  const { motivi, senzaFonti } = avviso;
  if (!motivi.length && !senzaFonti) {
    return (
      <p style={{ margin: "0 0 10px", fontSize: F.minuscolo, color: C.muted, lineHeight: 1.45 }}>
        Fandom non dice da quale libro viene ogni paragrafo; le fonti di questa voce sono volumi che hai già letto o di
        altre saghe.
      </p>
    );
  }
  const visti = corto ? motivi.slice(0, 2) : motivi.slice(0, 6);
  return (
    <button
      onClick={onApri}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        margin: "0 0 10px",
        padding: "9px 12px",
        border: `1px dashed ${C.accent}88`,
        borderRadius: R.piccolo,
        color: C.muted,
        fontSize: F.piccolo,
        lineHeight: 1.45,
        minHeight: 44,
      }}
    >
      <span style={{ color: C.accent }}>⚠ Questa voce può spoilerare.</span> Fandom non dice da quale libro viene ogni
      paragrafo
      {senzaFonti
        ? ", e questa voce non elenca le sue fonti."
        : `: la voce cita anche ${visti.map((m) => m.replace(/^da /, "")).join("; ")}${
            motivi.length > visti.length ? ` e altre ${motivi.length - visti.length}` : ""
          }.`}{" "}
      <span style={{ color: C.arcane }}>Tocca per leggerla lo stesso</span>
    </button>
  );
}

export default function VoceLore({ voce: prima, giudice, onChiudi, wiki = LEXICANUM, aperta = false }) {
  const [pila, setPila] = useState([prima]);
  const [aperti, setAperti] = useState(() => new Set());
  const [manca, setManca] = useState("");
  const voce = pila[pila.length - 1];
  const blocchi = velaVoce(voce, giudice);
  // su Fandom ogni voce ha il suo avviso, e quella letta resta letta
  const [lette, setLette] = useState(() => new Set(aperta ? [prima.t] : []));
  const avviso = wiki === FANDOM ? avvisoVoce(voce, giudice) : null;
  const chiusa = !!avviso && (avviso.motivi.length > 0 || avviso.senzaFonti) && !lette.has(voce.t);

  async function vai(titolo) {
    setManca("");
    const v = await voceLore(titolo, undefined, wiki).catch(() => null);
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
          {wiki.nome} · sul dispositivo
        </span>
      </div>
      <div style={{ fontFamily: FONT_TITLE, fontSize: F.titolo, fontWeight: 600, color: C.text, marginBottom: 2 }}>{voce.t}</div>
      {voce.via && <div style={{ fontSize: F.minuscolo, color: C.muted, fontStyle: "italic", marginBottom: 6 }}>da «{voce.via}»</div>}
      {manca && (
        <p style={{ margin: "6px 0 10px", fontSize: F.minuscolo, color: C.muted }}>
          «{manca}» non c'è in {wiki.nome} scaricato.
        </p>
      )}
      {avviso && (chiusa || (!avviso.motivi.length && !avviso.senzaFonti)) && (
        <AvvisoFandom avviso={avviso} onApri={() => setLette((l) => new Set(l).add(voce.t))} />
      )}
      {!chiusa && (
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
      )}
      <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.border}66`, display: "flex", alignItems: "baseline", gap: 9, flexWrap: "wrap" }}>
        <a
          href={indirizzoVoce(voce.t, wiki)}
          target="_blank"
          rel="noreferrer"
          style={{ fontSize: F.piccolo, color: C.accent, textDecoration: "none" }}
        >
          Apri su {wiki.nome} ↗
        </a>
        <span style={{ fontSize: F.minuscolo, color: C.muted }}>di là si spoilera</span>
      </div>
    </div>
  );
}
