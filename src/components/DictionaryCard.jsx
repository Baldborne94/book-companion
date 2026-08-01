import { useState } from "react";
import { C, FONT_TITLE } from "../data/constants.js";

// La scheda del dizionario e' identica nei due reader: qui una volta sola,
// cosi' EPUB e PDF non divergono.
export default function DictionaryCard({ dict, bottom, onClose }) {
  const [all, setAll] = useState(false);
  if (!dict) return null;
  const shown = dict.translation ? 2 : 3;

  return (
    <div
      onClick={onClose}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 30,
        background: "#0806115e",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(94%, 460px)",
          marginBottom: bottom,
          maxHeight: "52%",
          overflowY: "auto",
          background: `${C.card}fa`,
          border: `1px solid ${C.border}`,
          borderRadius: 16,
          boxShadow: "0 12px 44px #000000aa",
          padding: "13px 16px 15px",
          animation: "bc-fade-in 0.2s ease-out",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
          <span style={{ fontFamily: FONT_TITLE, fontSize: 21, fontWeight: 600, color: C.text }}>
            {dict.word}
          </span>
          {dict.foreign && <span style={{ fontSize: 11.5, color: C.muted }}>in lingua originale</span>}
          <button onClick={onClose} style={{ marginLeft: "auto", color: C.muted, fontSize: 17 }}>
            ✕
          </button>
        </div>

        {dict.translation && (
          <p style={{ fontSize: 16.5, color: C.accent, lineHeight: 1.4, margin: "0 0 10px" }}>
            {dict.translation}
          </p>
        )}

        {dict.loading ? (
          <p style={{ color: C.muted, fontSize: 14.5 }}>Consulto il dizionario…</p>
        ) : dict.entries.length === 0 && !dict.translation ? (
          <p style={{ color: C.muted, fontSize: 14.5, lineHeight: 1.5 }}>
            {dict.offline
              ? "Il dizionario ha bisogno della rete: riprova quando sei online."
              : `Nessuna voce per «${dict.word}».`}
          </p>
        ) : (
          <>
            {(all ? dict.entries : dict.entries.slice(0, shown)).map((e, i) => (
              <div key={i} style={{ display: "flex", gap: 9, marginBottom: 9 }}>
                {e.pos && (
                  <span
                    style={{
                      flexShrink: 0,
                      fontSize: 11.5,
                      color: C.arcane,
                      fontStyle: "italic",
                      paddingTop: 3,
                      minWidth: 66,
                    }}
                  >
                    {e.pos}
                  </span>
                )}
                <span style={{ fontSize: 15, color: C.text, lineHeight: 1.45 }}>{e.text}</span>
              </div>
            ))}
            {!all && dict.entries.length > shown && (
              <button onClick={() => setAll(true)} style={{ fontSize: 13.5, color: C.accent, paddingTop: 2 }}>
                Altri {dict.entries.length - shown} significati
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
