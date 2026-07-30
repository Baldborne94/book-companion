import { C, FONT_TITLE } from "../data/constants.js";
import { getLastOpened, getProgress } from "../lib/library.js";
import BookCover from "./BookCover.jsx";
import EmptyState from "./EmptyState.jsx";

function SectionTitle({ children }) {
  return (
    <h2
      style={{
        fontFamily: FONT_TITLE,
        fontWeight: 600,
        fontSize: 21,
        color: C.text,
        margin: "22px 0 12px",
      }}
    >
      <span style={{ color: C.arcane, marginRight: 6 }}>✦</span>
      {children}
    </h2>
  );
}

export default function Home({ books, goTo, onOpenBook, onRead, onGarden }) {
  if (books.length === 0) {
    return (
      <EmptyState
        emoji="🔮"
        title="Benvenuto nel tuo regno"
        text="Qui ritroverai il libro che stai leggendo e gli ultimi arrivati sul tuo scaffale. Tutto comincia portando il primo tomo in Libreria."
        action="Vai alla Libreria"
        onAction={() => goTo("library")}
      />
    );
  }

  const last = books.find((b) => b.id === getLastOpened());
  const pct = last ? Math.round(getProgress(last.id) * 100) : 0;
  const recent = [...books].sort((a, b) => b.addedAt - a.addedAt).slice(0, 6);

  return (
    <div style={{ animation: "bc-fade-in 0.4s ease-out" }}>
      {last && (
        <>
          <SectionTitle>Continua a leggere</SectionTitle>
          <button
            onClick={() => onRead(last.id)}
            style={{
              width: "100%",
              display: "flex",
              gap: 16,
              alignItems: "center",
              textAlign: "left",
              padding: 14,
              borderRadius: 16,
              border: `1px solid ${C.border}`,
              background: `linear-gradient(135deg, ${C.card}, ${C.surface})`,
              boxShadow: `0 0 30px ${C.arcane}14`,
            }}
          >
            <div style={{ width: 84, flexShrink: 0 }}>
              <BookCover book={last} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontFamily: FONT_TITLE,
                  fontWeight: 600,
                  fontSize: 19,
                  color: C.text,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {last.title}
              </div>
              {last.author && <div style={{ fontSize: 14, color: C.muted, marginBottom: 8 }}>{last.author}</div>}
              <div style={{ height: 5, borderRadius: 3, background: C.dim, overflow: "hidden", marginBottom: 5 }}>
                <div
                  style={{
                    width: `${Math.max(pct, 2)}%`,
                    height: "100%",
                    borderRadius: 3,
                    background: `linear-gradient(90deg, ${C.accent}, ${C.arcane})`,
                  }}
                />
              </div>
              <div style={{ fontSize: 13, color: C.muted }}>
                {pct > 0 ? `${pct}% — riprendi da dove eri` : "riprendi la lettura"}
              </div>
            </div>
            <span style={{ fontSize: 22, color: C.accent }}>›</span>
          </button>
        </>
      )}

      <button
        onClick={onGarden}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginTop: 22,
          padding: "13px 16px",
          borderRadius: 14,
          border: `1px solid ${C.arcane}55`,
          background: `linear-gradient(135deg, ${C.arcane}14, transparent)`,
          textAlign: "left",
        }}
      >
        <span style={{ fontSize: 24, filter: `drop-shadow(0 0 10px ${C.arcane}88)` }}>🌿</span>
        <span style={{ flex: 1 }}>
          <span style={{ display: "block", fontFamily: FONT_TITLE, fontWeight: 600, fontSize: 17, color: C.text }}>
            Il giardino delle citazioni
          </span>
          <span style={{ display: "block", fontSize: 13.5, color: C.muted }}>
            I passaggi che hai evidenziato, di ogni libro, in un unico posto
          </span>
        </span>
        <span style={{ fontSize: 20, color: C.arcane }}>›</span>
      </button>

      <SectionTitle>Aggiunti di recente</SectionTitle>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))",
          gap: "16px 14px",
        }}
      >
        {recent.map((b) => (
          <button key={b.id} onClick={() => onOpenBook(b.id)} style={{ textAlign: "center" }}>
            <BookCover book={b} />
            <div
              style={{
                marginTop: 6,
                fontSize: 13,
                lineHeight: 1.25,
                color: C.text,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {b.title}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
