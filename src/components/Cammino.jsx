import { useMemo, useState } from "react";
import { C, TEMA, FONT_TITLE, F, R, px } from "../data/constants.js";
import { getStatus } from "../lib/library.js";
import { perParte } from "../lib/cammino.js";

// I FILTRI SONO TRE, e il terzo è quello per cui la pagina esiste: su una
// guida da settantuno tappe «cosa mi manca» è la domanda vera, e senza un
// tasto si scorre tutto a occhio.
const FILTRI = [
  { id: "tutte", nome: "Tutte" },
  { id: "tue", nome: "Ce l'hai" },
  { id: "mancano", nome: "Ti mancano" },
];

const STATO = { read: "letto", reading: "in lettura", abandoned: "abbandonato" };

function Tappa({ t, onOpenBook }) {
  const { voce, libro } = t;
  const stato = libro ? STATO[getStatus(libro.id)] : null;
  const dentro = (
    <>
      {/* IL NUMERO È QUELLO DEL CAMMINO, non quello della collana: la guida
          rimescola apposta, e «The First Heretic» è il 14 in copertina e il
          6 qui. Dove il numero non c'è — antologie, prologo, i 40K — al suo
          posto va il trattino e la ragione sta nella nota. */}
      <span
        style={{
          width: px(46),
          flexShrink: 0,
          textAlign: "center",
          fontFamily: FONT_TITLE,
          fontSize: F.piccolo,
          color: voce.o ? (libro ? C.accent : C.muted) : C.muted,
          opacity: voce.o ? 1 : 0.6,
        }}
      >
        {voce.o ? `n° ${voce.o}` : "—"}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: "block",
            fontFamily: FONT_TITLE,
            fontWeight: 600,
            fontSize: F.corpo,
            color: libro ? C.text : C.muted,
          }}
        >
          {voce.t}
        </span>
        <span style={{ display: "block", fontSize: F.minuscolo, color: C.muted, marginTop: 2 }}>
          {[voce.a, voce.nota, libro ? `nella tua biblioteca${stato ? ` · ${stato}` : ""}` : null]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>
      <span
        style={{
          flexShrink: 0,
          fontSize: F.minuscolo,
          color: libro ? C.green : C.muted,
          opacity: libro ? 1 : 0.7,
        }}
      >
        {libro ? "✓" : "manca"}
      </span>
    </>
  );

  const stile = {
    display: "flex",
    width: "100%",
    gap: 10,
    alignItems: "center",
    textAlign: "left",
    padding: "9px 4px",
    borderBottom: `1px solid ${C.border}44`,
  };

  // quello che hai si apre nella sua scheda; quello che manca non porta da
  // nessuna parte, e un tasto che non fa niente è peggio di nessun tasto
  return libro ? (
    <button onClick={() => onOpenBook(libro.id)} style={stile}>
      {dentro}
    </button>
  ) : (
    <div style={stile}>{dentro}</div>
  );
}

export default function Cammino({ cammino, onClose, onOpenBook }) {
  const [filtro, setFiltro] = useState("tutte");
  const { tappe, tue, fuori, saga } = cammino;

  const parti = useMemo(() => {
    const scelte =
      filtro === "tue" ? tappe.filter((t) => t.libro) : filtro === "mancano" ? tappe.filter((t) => !t.libro) : tappe;
    // si filtra PRIMA di raggruppare, così una parte dove non resta niente
    // non lascia un'intestazione vuota
    return perParte(scelte);
  }, [tappe, filtro]);

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
          padding: "14px 18px 10px",
          background: `${C.surface}f2`,
          backdropFilter: "blur(8px)",
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h2 style={{ flex: 1, fontFamily: FONT_TITLE, fontSize: F.titolo, fontWeight: 600, color: C.text }}>
            Il cammino · {saga}
          </h2>
          <button onClick={onClose} aria-label="Chiudi" style={{ fontSize: F.titoletto, color: C.muted, padding: 6 }}>
            ✕
          </button>
        </div>
        <p style={{ fontSize: F.piccolo, color: C.muted, marginTop: 2, lineHeight: 1.5 }}>
          {`Hai ${tue} delle ${tappe.length} tappe.`}
          {fuori > 0 ? ` Altri ${fuori} dei tuoi libri non stanno in questo percorso.` : ""}
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          {FILTRI.map((f) => {
            const acceso = filtro === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFiltro(f.id)}
                style={{
                  minHeight: 44,
                  padding: "0 14px",
                  borderRadius: R.tondo,
                  border: `1px solid ${acceso ? C.accent : C.border}`,
                  color: acceso ? C.accent : C.muted,
                  background: acceso ? `${C.accent}14` : "transparent",
                  fontSize: F.piccolo,
                }}
              >
                {f.nome}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ maxWidth: px(760), margin: "0 auto", padding: "14px 18px 40px" }}>
        {parti.map(({ parte, tappe: dentro }) => (
          <section key={parte} style={{ marginBottom: 22 }}>
            <h3
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 10,
                fontFamily: FONT_TITLE,
                fontSize: F.rilievo,
                fontWeight: 600,
                color: C.accent,
                marginBottom: 4,
                paddingBottom: 4,
                borderBottom: `1px solid ${C.border}`,
              }}
            >
              {parte}
              <span style={{ fontSize: F.minuscolo, color: C.muted, fontFamily: "inherit", fontWeight: 400 }}>
                {dentro.filter((t) => t.libro).length}/{dentro.length}
              </span>
            </h3>
            {dentro.map((t) => (
              <Tappa key={t.voce.t} t={t} onOpenBook={onOpenBook} />
            ))}
          </section>
        ))}
        {parti.length === 0 && (
          <p style={{ color: C.muted, fontSize: F.corpo, lineHeight: 1.6, marginTop: 20 }}>
            {filtro === "tue"
              ? "Di questo percorso non hai ancora nessun volume."
              : "Hai tutte le tappe del percorso."}
          </p>
        )}
      </div>
    </div>
  );
}
