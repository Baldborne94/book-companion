import { useMemo, useState } from "react";
import { C, TEMA, FONT_TITLE, F, R, px } from "../data/constants.js";
import { getHighlights, saveHighlights, getMarks } from "../lib/annotations.js";
import { raccogli, filtra, conta, testoCitazione, esporta } from "../lib/citazioni.js";

export default function QuoteGarden({ books, onClose, onReadAt }) {
  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState("");
  // il segno che una citazione e' finita negli appunti: senza, tocchi e non
  // succede niente di visibile, e non sai se ha funzionato
  const [copiata, setCopiata] = useState(null);

  const tutti = useMemo(
    () => raccogli(books, (id) => ({ highlights: getHighlights(id), marks: getMarks(id) })),
    [books, version]
  );
  const groups = useMemo(() => filtra(tutti, query), [tutti, query]);
  const n = conta(groups);
  const cercando = !!query.trim();

  function removeQuote(bookId, quote) {
    saveHighlights(bookId, getHighlights(bookId).filter((h) => h.id !== quote.id));
    setVersion((v) => v + 1);
  }

  async function copia(c, book) {
    const testo = testoCitazione(c, book);
    try {
      await navigator.clipboard.writeText(testo);
      setCopiata(c.id);
      setTimeout(() => setCopiata((x) => (x === c.id ? null : x)), 1600);
    } catch {
      // niente appunti (permesso negato, contesto non sicuro): meglio dirlo
      // che lasciare il lettore a chiedersi se ha copiato
      setCopiata("no");
      setTimeout(() => setCopiata((x) => (x === "no" ? null : x)), 2200);
    }
  }

  // Si esporta quello che stai GUARDANDO: se hai cercato «vendetta», il file
  // e' quello. Cercare e poi ricevere tutto sarebbe una sorpresa sgradita.
  function esportaTutto() {
    const blob = new Blob([esporta(groups)], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `citazioni-${new Date().toISOString().slice(0, 10)}.md`;
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
            onClick={onClose}
            aria-label="Chiudi il giardino"
            style={{ width: 40, height: 40, borderRadius: R.piccolo, fontSize: F.titoletto, color: C.text }}
          >
            ✕
          </button>
          <h2 style={{ flex: 1, fontFamily: FONT_TITLE, fontSize: F.titolo, fontWeight: 600, color: C.text }}>
            🌿 Il giardino delle citazioni
          </h2>
          {n.citazioni > 0 && (
            <button
              onClick={esportaTutto}
              style={{
                padding: "8px 14px",
                borderRadius: R.piccolo,
                border: `1px solid ${C.arcane}66`,
                color: C.arcane,
                fontSize: F.piccolo,
              }}
            >
              📄 Esporta
            </button>
          )}
        </div>
        {tutti.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca nelle tue citazioni, note e segnalibri…"
              style={{
                flex: 1,
                padding: "10px 14px",
                borderRadius: R.piccolo,
                border: `1px solid ${C.border}`,
                background: C.card,
                color: C.text,
                fontSize: F.nota,
              }}
            />
            {cercando && (
              <button onClick={() => setQuery("")} aria-label="Cancella la ricerca" style={{ color: C.muted, padding: 8 }}>
                ✕
              </button>
            )}
            <span style={{ fontSize: F.piccolo, color: C.muted, whiteSpace: "nowrap" }}>
              {n.citazioni} {n.citazioni === 1 ? "passaggio" : "passaggi"}
              {n.segni ? ` · ${n.segni} 🔖` : ""}
            </span>
          </div>
        )}
        {copiata === "no" && (
          <div style={{ marginTop: 8, fontSize: F.piccolo, color: C.accent }}>
            Gli appunti non si lasciano scrivere qui: seleziona il testo a mano.
          </div>
        )}
      </div>

      <div style={{ maxWidth: px(720), margin: "0 auto", padding: "18px 16px 48px" }}>
        {groups.length === 0 ? (
          <div style={{ textAlign: "center", padding: "56px 24px" }}>
            <div style={{ fontSize: 60, marginBottom: 14, filter: `drop-shadow(0 0 22px ${C.arcane}66)` }}>
              {cercando ? "🔍" : "🌱"}
            </div>
            <h3 style={{ fontFamily: FONT_TITLE, fontSize: F.titolo, fontWeight: 600, color: C.text, marginBottom: 8 }}>
              {cercando ? "Niente che somigli a questo" : "Il giardino attende i primi semi…"}
            </h3>
            <p style={{ color: C.muted, maxWidth: px(420), margin: "0 auto" }}>
              {cercando
                ? "La ricerca guarda il testo delle citazioni, le tue note e le etichette dei segnalibri."
                : "Mentre leggi, seleziona un passaggio che ti incanta e scegli un colore: la citazione fiorirà qui, insieme a tutte le altre, di ogni libro."}
            </p>
          </div>
        ) : (
          groups.map(({ book, citazioni, segni }) => (
            <section key={book.id} style={{ marginBottom: 30 }}>
              <h3
                style={{
                  fontFamily: FONT_TITLE,
                  fontSize: F.titoletto,
                  fontWeight: 600,
                  color: C.accent,
                  marginBottom: 2,
                  textShadow: `0 0 14px ${C.accent}33`,
                }}
              >
                {book.title}
              </h3>
              {book.author && (
                <div style={{ fontSize: F.piccolo, color: C.muted, marginBottom: 10 }}>{book.author}</div>
              )}
              {citazioni.map((q) => (
                <div
                  key={q.id}
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "stretch",
                    marginBottom: 10,
                    padding: "12px 14px",
                    borderRadius: R.piccolo,
                    border: `1px solid ${C.border}`,
                    background: `linear-gradient(135deg, ${C.card}, ${C.surface})`,
                  }}
                >
                  <span style={{ width: 4, borderRadius: R.minimo, background: q.color, flexShrink: 0 }} />
                  <button
                    onClick={() => onReadAt(book.id, q.cfi)}
                    style={{
                      flex: 1,
                      textAlign: "left",
                      fontSize: F.corpo,
                      fontStyle: "italic",
                      lineHeight: 1.5,
                      color: C.text,
                    }}
                  >
                    “{q.text}”
                    {q.note && (
                      <span
                        style={{
                          display: "block",
                          marginTop: 8,
                          paddingLeft: 10,
                          borderLeft: `2px solid ${C.arcane}77`,
                          fontSize: F.nota,
                          fontStyle: "normal",
                          color: C.arcane,
                          lineHeight: 1.45,
                        }}
                      >
                        {q.note}
                      </span>
                    )}
                    <span style={{ display: "block", marginTop: 6, fontSize: F.minuscolo, fontStyle: "normal", color: C.muted }}>
                      {new Date(q.createdAt).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}
                      {" · tocca per rileggere nel libro"}
                    </span>
                  </button>
                  <span style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 2 }}>
                    <button
                      onClick={() => copia(q, book)}
                      aria-label="Copia la citazione"
                      style={{ color: copiata === q.id ? C.green : C.muted, padding: 6, fontSize: F.corpo }}
                    >
                      {copiata === q.id ? "✓" : "⧉"}
                    </button>
                    <button
                      onClick={() => removeQuote(book.id, q)}
                      aria-label="Rimuovi citazione"
                      style={{ color: C.muted, padding: 6 }}
                    >
                      🗑
                    </button>
                  </span>
                </div>
              ))}
              {/* I segnalibri compaiono solo quando cerchi: a riposo il
                  giardino resta un giardino di citazioni. */}
              {segni.map((m) => (
                <button
                  key={m.id}
                  onClick={() => onReadAt(book.id, m.cfi)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    marginBottom: 8,
                    padding: "10px 14px",
                    borderRadius: R.piccolo,
                    border: `1px dashed ${C.border}`,
                    color: C.muted,
                    fontSize: F.nota,
                  }}
                >
                  🔖 {m.label || "Segnalibro"}
                </button>
              ))}
            </section>
          ))
        )}
      </div>
    </div>
  );
}
