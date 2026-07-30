import { useMemo, useState } from "react";
import { C, FONT_TITLE } from "../data/constants.js";
import { getHighlights, saveHighlights } from "../lib/annotations.js";

export default function QuoteGarden({ books, onClose, onReadAt }) {
  const [version, setVersion] = useState(0);

  const groups = useMemo(
    () =>
      books
        .map((b) => ({ book: b, quotes: getHighlights(b.id) }))
        .filter((g) => g.quotes.length > 0),
    [books, version]
  );

  function removeQuote(bookId, quote) {
    saveHighlights(bookId, getHighlights(bookId).filter((h) => h.id !== quote.id));
    setVersion((v) => v + 1);
  }

  const total = groups.reduce((n, g) => n + g.quotes.length, 0);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 40,
        overflowY: "auto",
        background: `radial-gradient(ellipse 120% 80% at 50% 0%, #1a1530 0%, ${C.bg} 55%, #0b0914 100%)`,
        animation: "bc-fade-in 0.35s ease-out",
      }}
    >
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 5,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 14px",
          background: `${C.surface}f2`,
          backdropFilter: "blur(8px)",
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <button
          onClick={onClose}
          aria-label="Chiudi il giardino"
          style={{ width: 40, height: 40, borderRadius: 10, fontSize: 19, color: C.text }}
        >
          ✕
        </button>
        <h2 style={{ flex: 1, fontFamily: FONT_TITLE, fontSize: 21, fontWeight: 600, color: C.text }}>
          🌿 Il giardino delle citazioni
        </h2>
        {total > 0 && (
          <span style={{ fontSize: 13.5, color: C.muted }}>
            {total} {total === 1 ? "passaggio" : "passaggi"}
          </span>
        )}
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "18px 16px 48px" }}>
        {groups.length === 0 ? (
          <div style={{ textAlign: "center", padding: "56px 24px" }}>
            <div style={{ fontSize: 60, marginBottom: 14, filter: `drop-shadow(0 0 22px ${C.arcane}66)` }}>🌱</div>
            <h3 style={{ fontFamily: FONT_TITLE, fontSize: 23, fontWeight: 600, color: C.text, marginBottom: 8 }}>
              Il giardino attende i primi semi…
            </h3>
            <p style={{ color: C.muted, maxWidth: 420, margin: "0 auto" }}>
              Mentre leggi, seleziona un passaggio che ti incanta e scegli un colore: la citazione
              fiorirà qui, insieme a tutte le altre, di ogni libro.
            </p>
          </div>
        ) : (
          groups.map(({ book, quotes }) => (
            <section key={book.id} style={{ marginBottom: 30 }}>
              <h3
                style={{
                  fontFamily: FONT_TITLE,
                  fontSize: 20,
                  fontWeight: 600,
                  color: C.accent,
                  marginBottom: 2,
                  textShadow: `0 0 14px ${C.accent}33`,
                }}
              >
                {book.title}
              </h3>
              {book.author && (
                <div style={{ fontSize: 13.5, color: C.muted, marginBottom: 10 }}>{book.author}</div>
              )}
              {quotes.map((q) => (
                <div
                  key={q.id}
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "stretch",
                    marginBottom: 10,
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: `1px solid ${C.border}`,
                    background: `linear-gradient(135deg, ${C.card}, ${C.surface})`,
                  }}
                >
                  <span style={{ width: 4, borderRadius: 2, background: q.color, flexShrink: 0 }} />
                  <button
                    onClick={() => onReadAt(book.id, q.cfi)}
                    style={{
                      flex: 1,
                      textAlign: "left",
                      fontSize: 15.5,
                      fontStyle: "italic",
                      lineHeight: 1.5,
                      color: C.text,
                    }}
                  >
                    “{q.text}”
                    <span style={{ display: "block", marginTop: 6, fontSize: 12.5, fontStyle: "normal", color: C.muted }}>
                      {new Date(q.createdAt).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}
                      {" · tocca per rileggere nel libro"}
                    </span>
                  </button>
                  <button
                    onClick={() => removeQuote(book.id, q)}
                    aria-label="Rimuovi citazione"
                    style={{ color: C.muted, padding: 6, alignSelf: "center" }}
                  >
                    🗑
                  </button>
                </div>
              ))}
            </section>
          ))
        )}
      </div>
    </div>
  );
}
