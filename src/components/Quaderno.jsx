import { useMemo, useState } from "react";
import { C, TEMA, FONT_TITLE, F, R, px } from "../data/constants.js";
import {
  GIRO,
  STATI,
  daRipassare,
  esportaQuaderno,
  filtraQuaderno,
  leggiQuaderno,
  libriDelQuaderno,
  paroleVive,
  pezziFrase,
  ripassata,
  scriviQuaderno,
  segnaImparata,
  togliParola,
} from "../lib/quaderno.js";

const chip = (acceso, colore = C.accent) => ({
  minHeight: 44,
  padding: "8px 14px",
  borderRadius: R.tondo,
  border: `1px solid ${acceso ? colore : C.border}`,
  background: acceso ? `${colore}22` : "transparent",
  color: acceso ? C.text : C.muted,
  fontSize: F.piccolo,
  whiteSpace: "nowrap",
  flexShrink: 0,
});

function Frase({ incontro }) {
  if (!incontro?.frase) return null;
  return (
    <span style={{ display: "block", fontSize: F.nota, fontStyle: "italic", color: C.text, lineHeight: 1.5 }}>
      “
      {pezziFrase(incontro.frase, incontro.forma).map((p, i) =>
        p.qui ? (
          <strong key={i} style={{ color: C.accent, fontStyle: "normal" }}>
            {p.t}
          </strong>
        ) : (
          <span key={i}>{p.t}</span>
        )
      )}
      ”
    </span>
  );
}

// IL RIPASSO: la parola con la sua frase, e il significato solo quando lo
// chiedi — vedere la risposta insieme alla domanda non e' ripassare, e'
// rileggere. Poi due tasti: «La so» la toglie dai giri, «Ancora» la rimanda
// in fondo alla fila. Niente punteggi: un minuto concesso al vocabolario
// non ha bisogno di un voto.
function Ripasso({ giro, onFatto, onEsito }) {
  const [i, setI] = useState(0);
  const [aperta, setAperta] = useState(false);
  const [sapute, setSapute] = useState(0);
  const v = giro[i];

  function esito(so) {
    onEsito(v.id, so);
    if (so) setSapute((n) => n + 1);
    setAperta(false);
    setI((n) => n + 1);
  }

  const bottone = (colore) => ({
    flex: 1,
    minHeight: 48,
    borderRadius: R.medio,
    border: `1px solid ${colore}88`,
    background: `${colore}1c`,
    color: C.text,
    fontSize: F.corpo,
  });

  if (!v) {
    return (
      <div style={{ textAlign: "center", padding: "48px 20px" }}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>✨</div>
        <h3 style={{ fontFamily: FONT_TITLE, fontSize: F.titolo, color: C.text, marginBottom: 8 }}>Giro finito</h3>
        <p style={{ color: C.muted, marginBottom: 18 }}>
          {sapute === giro.length
            ? `Le sapevi tutte e ${giro.length}.`
            : `Ne sapevi ${sapute} su ${giro.length}: le altre tornano al prossimo giro.`}
        </p>
        <button onClick={onFatto} style={{ ...bottone(C.accent), flex: "none", padding: "0 28px" }}>
          Torna al quaderno
        </button>
      </div>
    );
  }

  const incontro = (v.incontri || [])[0];
  return (
    <div style={{ padding: "8px 0 40px" }}>
      <div style={{ fontSize: F.minuscolo, color: C.muted, textAlign: "center", marginBottom: 14 }}>
        {i + 1} di {giro.length}
      </div>
      <div
        style={{
          padding: "22px 20px",
          borderRadius: R.medio,
          border: `1px solid ${C.border}`,
          background: `linear-gradient(135deg, ${C.card}, ${C.surface})`,
          textAlign: "center",
        }}
      >
        <div style={{ fontFamily: FONT_TITLE, fontSize: F.grande, fontWeight: 600, color: C.text, marginBottom: 12 }}>
          {v.parola}
        </div>
        <Frase incontro={incontro} />
        {incontro?.titolo && (
          <div style={{ fontSize: F.minuscolo, color: C.muted, marginTop: 6 }}>da «{incontro.titolo}»</div>
        )}
        {aperta ? (
          <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
            {v.resa && <div style={{ fontSize: F.rilievo, fontWeight: 600, color: C.accent, marginBottom: 6 }}>{v.resa}</div>}
            {v.definizione && <div style={{ fontSize: F.nota, color: C.muted, lineHeight: 1.5 }}>{v.definizione}</div>}
          </div>
        ) : (
          <button onClick={() => setAperta(true)} style={{ ...bottone(C.arcane), flex: "none", width: "100%", marginTop: 18 }}>
            Mostra il significato
          </button>
        )}
      </div>
      {aperta && (
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button onClick={() => esito(false)} style={bottone(C.arcane)}>
            ↺ Ancora
          </button>
          <button onClick={() => esito(true)} style={bottone(C.green)}>
            ✓ La so
          </button>
        </div>
      )}
    </div>
  );
}

export default function Quaderno({ onClose }) {
  const [tutte, setTutte] = useState(leggiQuaderno);
  const [query, setQuery] = useState("");
  const [stato, setStato] = useState("tutte");
  const [libroId, setLibroId] = useState(null);
  const [giro, setGiro] = useState(null);

  const salva = (nuove) => {
    scriviQuaderno(nuove);
    setTutte(nuove);
  };
  const libri = useMemo(() => libriDelQuaderno(tutte), [tutte]);
  const voci = useMemo(() => filtraQuaderno(tutte, { query, libroId, stato }), [tutte, query, libroId, stato]);
  const quante = paroleVive(tutte).length;
  const inAttesa = daRipassare(tutte, Infinity).length;

  function esportaTutto() {
    const blob = new Blob([esportaQuaderno(voci)], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `parole-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 40,
        overflowY: "auto",
        background: TEMA.gradient,
        animation: "bc-fade-in 0.35s ease-out",
      }}
    >
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 5,
          padding: "12px 14px",
          background: `${C.surface}f2`,
          backdropFilter: "blur(8px)",
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={giro ? () => setGiro(null) : onClose}
            aria-label={giro ? "Chiudi il ripasso" : "Chiudi il quaderno"}
            style={{ width: 40, height: 40, borderRadius: R.piccolo, fontSize: F.titoletto, color: C.text }}
          >
            ✕
          </button>
          <h2 style={{ flex: 1, minWidth: 0, fontFamily: FONT_TITLE, fontSize: F.titolo, fontWeight: 600, color: C.text }}>
            📒 {giro ? "Ripasso" : "Il quaderno delle parole"}
          </h2>
          {!giro && voci.length > 0 && (
            <button
              onClick={esportaTutto}
              style={{ padding: "8px 14px", borderRadius: R.piccolo, border: `1px solid ${C.arcane}66`, color: C.arcane, fontSize: F.piccolo }}
            >
              📄 Esporta
            </button>
          )}
        </div>
        {!giro && quante > 0 && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cerca fra parole, significati e frasi…"
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: "10px 14px",
                  borderRadius: R.piccolo,
                  border: `1px solid ${C.border}`,
                  background: C.card,
                  color: C.text,
                  fontSize: F.nota,
                }}
              />
              {query && (
                <button onClick={() => setQuery("")} aria-label="Cancella la ricerca" style={{ color: C.muted, padding: 8 }}>
                  ✕
                </button>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10, overflowX: "auto", paddingBottom: 2 }}>
              {STATI.map((s) => (
                <button key={s.id} onClick={() => setStato(s.id)} style={chip(stato === s.id)}>
                  {s.label}
                </button>
              ))}
            </div>
            {/* i libri si filtrano solo quando sono piu' d'uno: con un
                libro solo il filtro non toglierebbe niente */}
            {libri.length > 1 && (
              <div style={{ display: "flex", gap: 8, marginTop: 8, overflowX: "auto", paddingBottom: 2 }}>
                <button onClick={() => setLibroId(null)} style={chip(!libroId, C.arcane)}>
                  Ogni libro
                </button>
                {libri.map((l) => (
                  <button key={l.id} onClick={() => setLibroId(l.id)} style={chip(libroId === l.id, C.arcane)}>
                    {l.titolo || "Senza titolo"} · {l.n}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ maxWidth: px(720), margin: "0 auto", padding: "18px 16px 48px" }}>
        {giro ? (
          <Ripasso
            giro={giro}
            onFatto={() => setGiro(null)}
            onEsito={(id, so) => salva(so ? segnaImparata(leggiQuaderno(), id, true) : ripassata(leggiQuaderno(), id))}
          />
        ) : quante === 0 ? (
          <div style={{ textAlign: "center", padding: "56px 24px" }}>
            <div style={{ fontSize: 60, marginBottom: 14 }}>📒</div>
            <h3 style={{ fontFamily: FONT_TITLE, fontSize: F.titolo, fontWeight: 600, color: C.text, marginBottom: 8 }}>
              Il quaderno è ancora bianco
            </h3>
            <p style={{ color: C.muted, maxWidth: px(440), margin: "0 auto" }}>
              Mentre leggi, tieni premuta una parola e scegli «Definisci»: la parola arriva qui da sola, con la frase
              in cui l'hai incontrata, pronta da ripassare.
            </p>
          </div>
        ) : (
          <>
            {inAttesa > 0 && (
              <button
                onClick={() => setGiro(daRipassare(tutte))}
                style={{
                  width: "100%",
                  minHeight: 52,
                  marginBottom: 18,
                  borderRadius: R.medio,
                  border: `1px solid ${C.accent}88`,
                  background: `linear-gradient(135deg, ${C.accent}22, transparent)`,
                  color: C.text,
                  fontSize: F.corpo,
                  fontWeight: 600,
                }}
              >
                ✨ Ripassa {Math.min(inAttesa, GIRO)} {Math.min(inAttesa, GIRO) === 1 ? "parola" : "parole"}
                <span style={{ display: "block", fontSize: F.minuscolo, fontWeight: 400, color: C.muted }}>
                  {inAttesa > GIRO ? `ne aspettano ${inAttesa}: prima quelle che non hai mai ripassato` : "prima quelle che non hai mai ripassato"}
                </span>
              </button>
            )}
            {voci.length === 0 && (
              <p style={{ textAlign: "center", color: C.muted, padding: "24px 0" }}>
                Nessuna parola risponde a questi filtri.
              </p>
            )}
            {voci.map((v) => (
              <div
                key={v.id}
                style={{
                  marginBottom: 10,
                  padding: "12px 14px",
                  borderRadius: R.piccolo,
                  border: `1px solid ${C.border}`,
                  background: `linear-gradient(135deg, ${C.card}, ${C.surface})`,
                  opacity: v.imparata ? 0.75 : 1,
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: F.rilievo, fontWeight: 600, color: C.text }}>{v.parola}</span>
                  {v.pos && <span style={{ fontSize: F.minuscolo, color: C.arcane, textTransform: "uppercase" }}>{v.pos}</span>}
                  {v.imparata && <span style={{ fontSize: F.minuscolo, color: C.green }}>✓ imparata</span>}
                </div>
                {v.resa && <div style={{ fontSize: F.corpo, color: C.accent, fontWeight: 600, marginTop: 3 }}>{v.resa}</div>}
                {v.definizione && (
                  <div style={{ fontSize: F.nota, color: C.muted, lineHeight: 1.45, marginTop: 3 }}>{v.definizione}</div>
                )}
                {(v.incontri || []).map((x, i) => (
                  <div key={i} style={{ marginTop: 8, paddingLeft: 10, borderLeft: `2px solid ${C.arcane}66` }}>
                    <Frase incontro={x} />
                    <span style={{ fontSize: F.minuscolo, color: C.muted }}>
                      {x.titolo ? `«${x.titolo}»` : ""}
                      {x.quando ? ` · ${new Date(x.quando).toLocaleDateString("it-IT", { day: "numeric", month: "short" })}` : ""}
                    </span>
                  </div>
                ))}
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
                  <span style={{ flex: 1, fontSize: F.minuscolo, color: C.dim }}>
                    {v.volte > 1 ? `cercata ${v.volte} volte` : ""}
                  </span>
                  <button
                    onClick={() => salva(segnaImparata(tutte, v.id, !v.imparata))}
                    style={{ minHeight: 40, padding: "6px 12px", fontSize: F.piccolo, color: v.imparata ? C.muted : C.green }}
                  >
                    {v.imparata ? "↺ Di nuovo da ripassare" : "✓ La so"}
                  </button>
                  <button onClick={() => salva(togliParola(tutte, v.id))} aria-label="Togli dal quaderno" style={{ minHeight: 40, padding: 8, color: C.muted }}>
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
