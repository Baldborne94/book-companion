import { useState } from "react";
import { C, FONT_TITLE } from "../data/constants.js";
import { getProgress, getStatus, setStatus, setLastOpened } from "../lib/library.js";
import BookCover from "./BookCover.jsx";

const STATUSES = [
  { id: "unread", label: "Da leggere", color: null },
  { id: "reading", label: "In lettura", color: null },
  { id: "read", label: "Letto", color: "green" },
];

const fieldStyle = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: 10,
  border: `1px solid ${C.border}`,
  background: C.surface,
  color: C.text,
  fontSize: 15,
  outline: "none",
};

function Field({ label, value, onChange, placeholder }) {
  return (
    <label style={{ display: "block", marginBottom: 10 }}>
      <span style={{ display: "block", fontSize: 12.5, color: C.muted, marginBottom: 3 }}>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={fieldStyle} />
    </label>
  );
}

export default function BookSheet({ book, onClose, onSaveMeta, onDelete, notify }) {
  const [title, setTitle] = useState(book.title);
  const [author, setAuthor] = useState(book.author || "");
  const [series, setSeries] = useState(book.series || "");
  const [notes, setNotes] = useState(book.notes || "");
  const [rating, setRating] = useState(book.rating || 0);
  const [status, setStatusState] = useState(getStatus(book.id));
  const [confirmDelete, setConfirmDelete] = useState(false);

  const pct = Math.round(getProgress(book.id) * 100);

  function commitAndClose() {
    onSaveMeta({
      ...book,
      title: title.trim() || book.title,
      author: author.trim(),
      series: series.trim(),
      notes,
      rating,
    });
    onClose();
  }

  function changeStatus(s) {
    setStatus(book.id, s);
    setStatusState(s);
  }

  function openBook() {
    setLastOpened(book.id);
    if (status === "unread") changeStatus("reading");
    notify("Il reader arriva con la prossima fase ✨ Intanto l'ho segnato come libro attuale.");
  }

  return (
    <div
      onClick={commitAndClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "#080611cc",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        animation: "bc-fade-in 0.25s ease-out",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 600,
          maxHeight: "90vh",
          overflowY: "auto",
          borderRadius: 18,
          border: `1px solid ${C.border}`,
          background: `linear-gradient(180deg, ${C.card}, ${C.surface})`,
          boxShadow: `0 0 60px ${C.arcane}22, 0 20px 50px #00000088`,
          padding: 20,
        }}
      >
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
          <div style={{ width: 150, flexShrink: 0, margin: "0 auto" }}>
            <BookCover book={book} radius={10} />
            {status === "reading" && pct > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ height: 5, borderRadius: 3, background: C.dim, overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${pct}%`,
                      height: "100%",
                      borderRadius: 3,
                      background: `linear-gradient(90deg, ${C.accent}, ${C.arcane})`,
                    }}
                  />
                </div>
                <div style={{ marginTop: 4, fontSize: 12.5, color: C.muted, textAlign: "center" }}>{pct}%</div>
              </div>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 220 }}>
            <Field label="Titolo" value={title} onChange={setTitle} />
            <Field label="Autore" value={author} onChange={setAuthor} placeholder="Sconosciuto…" />
            <Field label="Serie" value={series} onChange={setSeries} placeholder="—" />

            <div style={{ marginBottom: 10 }}>
              <span style={{ display: "block", fontSize: 12.5, color: C.muted, marginBottom: 3 }}>Valutazione</span>
              <div style={{ display: "flex", gap: 4 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setRating(n === rating ? 0 : n)}
                    aria-label={`${n} stelle`}
                    style={{
                      fontSize: 24,
                      color: n <= rating ? C.accent : C.dim,
                      filter: n <= rating ? `drop-shadow(0 0 6px ${C.accent}66)` : "none",
                      transition: "color 0.15s ease-out",
                    }}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <span style={{ display: "block", fontSize: 12.5, color: C.muted, marginBottom: 4 }}>Stato</span>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {STATUSES.map((s) => {
                  const active = status === s.id;
                  const tone = s.color === "green" ? C.green : C.accent;
                  return (
                    <button
                      key={s.id}
                      onClick={() => changeStatus(s.id)}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 999,
                        fontSize: 14,
                        border: `1px solid ${active ? tone : C.border}`,
                        color: active ? tone : C.muted,
                        background: active ? `${tone}14` : "transparent",
                      }}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <label style={{ display: "block", margin: "6px 0 14px" }}>
          <span style={{ display: "block", fontSize: 12.5, color: C.muted, marginBottom: 3 }}>Note personali</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Pensieri, citazioni, dove l'hai lasciato…"
            style={{ ...fieldStyle, resize: "vertical", fontFamily: "inherit", lineHeight: 1.4 }}
          />
        </label>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button
            onClick={openBook}
            style={{
              flex: 1,
              minWidth: 170,
              padding: "12px 20px",
              borderRadius: 12,
              background: `linear-gradient(180deg, ${C.accent}, #b8893a)`,
              color: "#241c0a",
              fontWeight: 700,
              fontSize: 16,
              fontFamily: FONT_TITLE,
              letterSpacing: "0.02em",
              boxShadow: `0 0 24px ${C.accent}33`,
            }}
          >
            📖 Apri il libro
          </button>
          <button
            onClick={commitAndClose}
            style={{
              padding: "12px 18px",
              borderRadius: 12,
              border: `1px solid ${C.border}`,
              color: C.muted,
              fontSize: 15,
            }}
          >
            Chiudi
          </button>
        </div>

        <div style={{ marginTop: 14, textAlign: "center" }}>
          <button
            onClick={() => (confirmDelete ? onDelete(book.id) : setConfirmDelete(true))}
            style={{ fontSize: 13.5, color: confirmDelete ? C.red : C.muted, textDecoration: "underline" }}
          >
            {confirmDelete ? "Confermi? Il file verrà rimosso per sempre — tocca di nuovo" : "Elimina questo libro"}
          </button>
        </div>
      </div>
    </div>
  );
}
