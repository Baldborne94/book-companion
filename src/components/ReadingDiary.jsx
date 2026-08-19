import { useMemo } from "react";
import { C, TEMA, FONT_TITLE } from "../data/constants.js";
import { getStarted, getFinished, getStatus } from "../lib/library.js";
import { buildDiary, yearStats, dayCount } from "../lib/diary.js";
import BookCover from "./BookCover.jsx";

const data = (ms) =>
  new Date(ms).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
const breve = (ms) => new Date(ms).toLocaleDateString("it-IT", { day: "numeric", month: "short" });
const giorni = (n) => (n === 1 ? "in un giorno" : `in ${n} giorni`);

function Riga({ e, onOpenBook }) {
  return (
    <button
      onClick={() => onOpenBook(e.book.id)}
      style={{
        display: "flex",
        width: "100%",
        gap: 14,
        alignItems: "center",
        textAlign: "left",
        padding: "10px 4px",
        borderBottom: `1px solid ${C.border}44`,
      }}
    >
      <div style={{ width: 44, flexShrink: 0 }}>
        <BookCover book={e.book} radius={5} compact />
      </div>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: "block",
            fontFamily: FONT_TITLE,
            fontWeight: 600,
            fontSize: 16.5,
            color: C.text,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {e.book.title}
        </span>
        <span style={{ display: "block", fontSize: 13, color: C.muted, marginTop: 2 }}>
          {e.finished
            ? e.started
              ? `${breve(e.started)} → ${breve(e.finished)} · ${giorni(e.days)}`
              : `finito il ${data(e.finished)}`
            : `cominciato il ${data(e.started)} · ${giorni(dayCount(e.started, Date.now()))}`}
        </span>
      </span>
    </button>
  );
}

export default function ReadingDiary({ books, onClose, onOpenBook }) {
  const diary = useMemo(
    () =>
      buildDiary(books, (id) => ({
        started: getStarted(id),
        finished: getFinished(id),
        status: getStatus(id),
      })),
    [books]
  );

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
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "14px 18px",
          background: `${C.surface}f2`,
          backdropFilter: "blur(8px)",
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <h2 style={{ flex: 1, fontFamily: FONT_TITLE, fontSize: 22, fontWeight: 600, color: C.text }}>
          Diario di lettura
        </h2>
        <button onClick={onClose} aria-label="Chiudi" style={{ fontSize: 19, color: C.muted, padding: 6 }}>
          ✕
        </button>
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "16px 18px 40px" }}>
        {diary.total === 0 && diary.reading.length === 0 ? (
          <p style={{ color: C.muted, fontSize: 15, lineHeight: 1.6, marginTop: 20 }}>
            Il diario è ancora bianco. Da qui in avanti, ogni libro che cominci e che finisci
            lascerà la sua data: fra qualche mese questa pagina racconterà il tuo anno di letture.
          </p>
        ) : null}

        {diary.reading.length > 0 && (
          <section style={{ marginBottom: 26 }}>
            <h3
              style={{
                fontFamily: FONT_TITLE,
                fontSize: 18,
                fontWeight: 600,
                color: C.accent,
                marginBottom: 6,
              }}
            >
              Sul comodino
            </h3>
            {diary.reading.map((e) => (
              <Riga key={e.book.id} e={e} onOpenBook={onOpenBook} />
            ))}
          </section>
        )}

        {diary.years.map(({ year, entries }) => {
          const s = yearStats(entries);
          return (
            <section key={year} style={{ marginBottom: 30 }}>
              <h3
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 10,
                  fontFamily: FONT_TITLE,
                  fontSize: 21,
                  fontWeight: 600,
                  color: C.text,
                  marginBottom: 4,
                }}
              >
                Letti nel {year}
                <span style={{ fontSize: 14, color: C.accent, fontFamily: "inherit" }}>
                  {s.libri} {s.libri === 1 ? "libro" : "libri"}
                </span>
              </h3>
              <p style={{ fontSize: 13.5, color: C.muted, marginBottom: 10, lineHeight: 1.5 }}>
                {s.media != null ? `In media ${giorni(s.media)} a libro.` : "Durate non registrate."}
                {s.veloce ? ` Il più veloce: «${s.veloce.book.title}», ${giorni(s.veloce.days)}.` : ""}
              </p>
              {entries.map((e) => (
                <Riga key={e.book.id} e={e} onOpenBook={onOpenBook} />
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}
