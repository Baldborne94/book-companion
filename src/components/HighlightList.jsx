import { useState } from "react";
import { C } from "../data/constants.js";

// L'elenco delle evidenziazioni e' identico nei due reader: qui una volta
// sola, cosi' EPUB e PDF non divergono (come per la scheda del dizionario).
export default function HighlightList({ highlights, onGoTo, onChange, onRemove, empty }) {
  const [noteFor, setNoteFor] = useState(null);
  const [draft, setDraft] = useState("");

  function saveNote() {
    onChange(highlights.map((h) => (h.id === noteFor ? { ...h, note: draft.trim() } : h)));
    setNoteFor(null);
  }

  const edit = (h) => {
    setNoteFor(h.id);
    setDraft(h.note || "");
  };

  if (highlights.length === 0) return <p style={{ color: C.muted }}>{empty}</p>;

  return highlights.map((h) => (
    <div
      key={h.id}
      style={{
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        padding: "10px 0",
        borderBottom: `1px solid ${C.border}44`,
      }}
    >
      <span style={{ width: 4, alignSelf: "stretch", borderRadius: 2, background: h.color, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <button
          onClick={() => onGoTo(h)}
          style={{ width: "100%", textAlign: "left", fontSize: 14.5, color: C.text, lineHeight: 1.45, fontStyle: "italic" }}
        >
          “{h.text}”
        </button>
        {noteFor === h.id ? (
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={saveNote}
            onKeyDown={(e) => e.key === "Escape" && setNoteFor(null)}
            rows={2}
            placeholder="Il tuo pensiero su questo passaggio…"
            style={{
              width: "100%",
              marginTop: 6,
              padding: "7px 10px",
              borderRadius: 8,
              border: `1px solid ${C.accent}77`,
              background: C.card,
              color: C.text,
              fontSize: 14,
              fontFamily: "inherit",
              lineHeight: 1.4,
              resize: "vertical",
              outline: "none",
            }}
          />
        ) : (
          h.note && (
            <button
              onClick={() => edit(h)}
              style={{ display: "block", textAlign: "left", marginTop: 5, fontSize: 13.5, color: C.arcane, lineHeight: 1.4 }}
            >
              ✎ {h.note}
            </button>
          )
        )}
      </div>
      <button
        onClick={() => edit(h)}
        aria-label="Nota sull'evidenziazione"
        style={{ color: h.note ? C.arcane : C.muted, padding: 6 }}
      >
        ✎
      </button>
      <button onClick={() => onRemove(h)} aria-label="Rimuovi evidenziazione" style={{ color: C.muted, padding: 6 }}>
        🗑
      </button>
    </div>
  ));
}
