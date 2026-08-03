import { useState } from "react";
import { C, FONT_TITLE } from "../data/constants.js";

// La scheda del dizionario e' identica nei due reader: qui una volta sola,
// cosi' EPUB e PDF non divergono.
export default function DictionaryCard({ dict, bottom, onClose }) {
  const [all, setAll] = useState(false);
  if (!dict) return null;
  const local = dict.gloss || dict.slang;
  // le due voci in evidenza sono gia' scritte per esteso sopra: qui sotto
  // vanno tutte le altre chiavi trovate nel brano
  const rest = (dict.found || []).filter((e) => e !== dict.gloss && e !== dict.slang);
  const shown = local ? 1 : dict.translation ? 2 : 3;

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
            {dict.gloss?.t || dict.word}
          </span>
          {dict.gloss && <span style={{ fontSize: 11.5, color: C.arcane }}>{dict.gloss.k}</span>}
          {!dict.gloss && dict.foreign && (
            <span style={{ fontSize: 11.5, color: C.muted }}>in lingua originale</span>
          )}
          <button onClick={onClose} style={{ marginLeft: "auto", color: C.muted, fontSize: 17 }}>
            ✕
          </button>
        </div>

        {dict.gloss && (
          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 15.5, color: C.text, lineHeight: 1.5, margin: "0 0 8px" }}>
              {dict.gloss.d}
            </p>
            <a
              href={dict.gloss.wiki}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-block",
                fontSize: 13.5,
                color: C.accent,
                border: `1px solid ${C.accent}55`,
                borderRadius: 999,
                padding: "5px 12px",
                textDecoration: "none",
              }}
            >
              Apri sul wiki ↗
            </a>
            <span style={{ fontSize: 11.5, color: C.muted, marginLeft: 9 }}>
              di là si spoilera
            </span>
          </div>
        )}

        {!dict.gloss && dict.wikiSearch && (
          <a
            href={dict.wikiSearch.url}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-block",
              marginBottom: 12,
              fontSize: 13.5,
              color: C.accent,
              border: `1px solid ${C.accent}55`,
              borderRadius: 999,
              padding: "5px 12px",
              textDecoration: "none",
            }}
          >
            Cerca «{dict.wikiSearch.term}» sul wiki ↗
          </a>
        )}

        {dict.slang && (
          <div
            style={{
              marginBottom: 12,
              paddingLeft: 10,
              borderLeft: `2px solid ${C.arcane}66`,
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 3 }}>
              <span style={{ fontSize: 14.5, color: C.text, fontWeight: 600 }}>{dict.slang.t}</span>
              {dict.slang.r && (
                <span style={{ fontSize: 11.5, color: C.muted, fontStyle: "italic" }}>
                  {dict.slang.r}
                </span>
              )}
            </div>
            <p style={{ fontSize: 15, color: C.text, lineHeight: 1.45, margin: 0 }}>
              {dict.slang.d}
            </p>
          </div>
        )}

        {rest.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 6 }}>
              Nel brano riconosco anche
            </div>
            {rest.slice(0, 12).map((e, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 5, alignItems: "baseline" }}>
                <span
                  style={{
                    flexShrink: 0,
                    minWidth: 96,
                    fontSize: 13.5,
                    color: e.kind === "gloss" ? C.accent : C.text,
                    fontWeight: 600,
                  }}
                >
                  {e.t}
                </span>
                <span style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.4 }}>{e.d}</span>
              </div>
            ))}
            {rest.length > 12 && (
              <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
                e altre {rest.length - 12} voci
              </div>
            )}
          </div>
        )}

        {dict.translation && (
          <p style={{ fontSize: 16.5, color: C.accent, lineHeight: 1.4, margin: "0 0 10px" }}>
            {dict.translation}
          </p>
        )}

        {dict.loading ? (
          <p style={{ color: C.muted, fontSize: local ? 13 : 14.5 }}>
            {local ? "Cerco anche sul dizionario…" : "Consulto il dizionario…"}
          </p>
        ) : dict.entries.length === 0 && !dict.translation ? (
          // col glossario in mano il dizionario che tace non e' una notizia:
          // la domanda ha gia' avuto risposta
          local ? null : (
            <p style={{ color: C.muted, fontSize: 14.5, lineHeight: 1.5 }}>
              {dict.offline
                ? "Il dizionario ha bisogno della rete: riprova quando sei online."
                : `Nessuna voce per «${dict.word}».`}
            </p>
          )
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
