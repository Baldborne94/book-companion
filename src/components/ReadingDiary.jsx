import { useMemo, useState } from "react";
import { C, TEMA, FONT_TITLE, F, R, px } from "../data/constants.js";
import { getStarted, getFinished, getStatus } from "../lib/library.js";
import { buildDiary, yearStats, dayCount } from "../lib/diary.js";
import { leggiTempo, statisticheAnno, durata } from "../lib/tempo.js";
import {
  leggiObiettivi,
  scriviObiettivi,
  obiettivoDi,
  conObiettivo,
  passoObiettivo,
  SCELTE_OBIETTIVO,
} from "../lib/obiettivo.js";
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
            fontSize: F.rilievo,
            color: C.text,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {e.book.title}
        </span>
        <span style={{ display: "block", fontSize: F.piccolo, color: C.muted, marginTop: 2 }}>
          {/* senza data non si scrive «cominciato il 1 gennaio 1970»: quel
              libro l'hai letto, non sappiamo quando, e si dice cosi' */}
          {e.senza
            ? "letto — l'anno non è segnato"
            : e.finished
              ? e.started
                ? `${breve(e.started)} → ${breve(e.finished)} · ${giorni(e.days)}`
                : `finito il ${data(e.finished)}`
              : `cominciato il ${data(e.started)} · ${giorni(dayCount(e.started, Date.now()))}`}
        </span>
      </span>
    </button>
  );
}

const chip = (acceso) => ({
  minWidth: 44,
  minHeight: 44,
  padding: "0 14px",
  borderRadius: R.tondo,
  border: `1px solid ${acceso ? C.accent : C.border}`,
  background: acceso ? `${C.accent}22` : "transparent",
  color: acceso ? C.accent : C.text,
  fontSize: F.corpo,
});

function Numero({ valore, etichetta }) {
  return (
    <div style={{ flex: "1 1 140px", minWidth: 0 }}>
      <div style={{ fontFamily: FONT_TITLE, fontSize: F.titolo, fontWeight: 600, color: C.text }}>{valore}</div>
      <div style={{ fontSize: F.piccolo, color: C.muted, marginTop: 2 }}>{etichetta}</div>
    </div>
  );
}

// IL TUO ANNO: l'obiettivo e il tempo passato a leggere. Sta in cima al
// diario perche' e' la domanda che uno si fa entrando — «come sta andando
// quest'anno?» — e le annate qui sotto sono il dettaglio.
function IlTuoAnno({ finiti }) {
  const anno = new Date().getFullYear();
  const [obiettivi, setObiettivi] = useState(leggiObiettivi);
  const [scegli, setScegli] = useState(false);
  const ob = obiettivoDi(obiettivi, anno);
  const passo = passoObiettivo(finiti, ob, anno);
  const st = useMemo(() => statisticheAnno(leggiTempo(), anno), [anno]);

  const fissa = (n) => {
    const nuovi = conObiettivo(obiettivi, anno, n);
    scriviObiettivi(nuovi);
    setObiettivi(nuovi);
    setScegli(false);
  };
  const aperto = scegli || !ob;

  return (
    <section
      style={{
        marginBottom: 28,
        padding: "16px 16px 18px",
        borderRadius: R.medio,
        border: `1px solid ${C.border}`,
        background: `${C.surface}cc`,
      }}
    >
      <h3 style={{ fontFamily: FONT_TITLE, fontSize: F.titolo, fontWeight: 600, color: C.text, marginBottom: 10 }}>
        Il tuo {anno}
      </h3>

      {passo && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontFamily: FONT_TITLE, fontSize: F.titoletto, fontWeight: 600, color: C.accent }}>
              {passo.finiti} di {passo.obiettivo} libri
            </span>
            <span style={{ fontSize: F.nota, color: C.muted }}>{passo.passo}</span>
          </div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={passo.obiettivo}
            aria-valuenow={passo.finiti}
            style={{ height: 8, borderRadius: R.tondo, background: `${C.border}88`, marginTop: 8, overflow: "hidden" }}
          >
            <div style={{ width: `${Math.round(passo.frazione * 100)}%`, height: "100%", background: C.accent }} />
          </div>
          {!scegli && (
            <button onClick={() => setScegli(true)} style={{ ...chip(false), marginTop: 10, fontSize: F.nota }}>
              Cambia obiettivo
            </button>
          )}
        </div>
      )}

      {aperto && (
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: F.nota, color: C.muted, marginBottom: 8, lineHeight: 1.5 }}>
            {ob
              ? "Quanti libri vuoi finire quest'anno?"
              : "Quanti libri vuoi finire quest'anno? Scegli un numero e il diario ti dirà se sei al passo."}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {SCELTE_OBIETTIVO.map((n) => (
              <button key={n} onClick={() => fissa(n)} style={chip(n === ob)}>
                {n}
              </button>
            ))}
            {ob > 0 && (
              <>
                <button onClick={() => fissa(ob - 1)} aria-label="Un libro in meno" style={chip(false)}>−</button>
                <button onClick={() => fissa(ob + 1)} aria-label="Un libro in più" style={chip(false)}>+</button>
                <button onClick={() => fissa(0)} style={chip(false)}>Nessun obiettivo</button>
              </>
            )}
          </div>
        </div>
      )}

      {st.minuti > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
          <Numero valore={durata(st.minuti)} etichetta="passate a leggere" />
          <Numero valore={st.giorni} etichetta={st.giorni === 1 ? "giorno di lettura" : "giorni di lettura"} />
          {st.giorni > 0 && <Numero valore={durata(st.mediaMinuti)} etichetta="in media, nei giorni letti" />}
          <Numero
            valore={st.serie === 1 ? "1 giorno" : `${st.serie} giorni`}
            etichetta={st.serieMax > st.serie ? `di fila (il record: ${st.serieMax})` : "di fila"}
          />
        </div>
      ) : (
        <p style={{ fontSize: F.nota, color: C.muted, lineHeight: 1.5 }}>
          Il tempo di lettura si conta da quando c'è questa pagina: ogni pagina che volti aggiunge il suo.
          Le pause lunghe non contano, e nemmeno il libro lasciato aperto.
        </p>
      )}
    </section>
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
        <h2 style={{ flex: 1, fontFamily: FONT_TITLE, fontSize: F.titolo, fontWeight: 600, color: C.text }}>
          Diario di lettura
        </h2>
        <button onClick={onClose} aria-label="Chiudi" style={{ fontSize: F.titoletto, color: C.muted, padding: 6 }}>
          ✕
        </button>
      </div>

      <div style={{ maxWidth: px(760), margin: "0 auto", padding: "16px 18px 40px" }}>
        <IlTuoAnno finiti={diary.years.find((y) => y.year === new Date().getFullYear())?.entries.length || 0} />

        {diary.total === 0 && diary.reading.length === 0 ? (
          <p style={{ color: C.muted, fontSize: F.corpo, lineHeight: 1.6, marginTop: 20 }}>
            Il diario è ancora bianco. Da qui in avanti, ogni libro che cominci e che finisci
            lascerà la sua data: fra qualche mese questa pagina racconterà il tuo anno di letture.
          </p>
        ) : null}

        {diary.reading.length > 0 && (
          <section style={{ marginBottom: 26 }}>
            <h3
              style={{
                fontFamily: FONT_TITLE,
                fontSize: F.rilievo,
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
                  fontSize: F.titolo,
                  fontWeight: 600,
                  color: C.text,
                  marginBottom: 4,
                }}
              >
                Letti nel {year}
                <span style={{ fontSize: F.nota, color: C.accent, fontFamily: "inherit" }}>
                  {s.libri} {s.libri === 1 ? "libro" : "libri"}
                </span>
              </h3>
              <p style={{ fontSize: F.piccolo, color: C.muted, marginBottom: 10, lineHeight: 1.5 }}>
                {s.media != null ? `In media ${giorni(s.media)} a libro.` : "Durate non registrate."}
                {s.veloce ? ` Il più veloce: «${s.veloce.book.title}», ${giorni(s.veloce.days)}.` : ""}
              </p>
              {entries.map((e) => (
                <Riga key={e.book.id} e={e} onOpenBook={onOpenBook} />
              ))}
            </section>
          );
        })}

        {/* IN FONDO, come i «Volumi soli» dello scaffale: sono libri finiti
            a cui manca solo una cosa, e la riga dice dove si mette. */}
        {diary.senzaData.length > 0 && (
          <section style={{ marginBottom: 30 }}>
            <h3
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 10,
                fontFamily: FONT_TITLE,
                fontSize: F.titolo,
                fontWeight: 600,
                color: C.text,
                marginBottom: 4,
              }}
            >
              Letti, senza anno
              <span style={{ fontSize: F.nota, color: C.accent, fontFamily: "inherit" }}>
                {diary.senzaData.length} {diary.senzaData.length === 1 ? "libro" : "libri"}
              </span>
            </h3>
            <p style={{ fontSize: F.piccolo, color: C.muted, marginBottom: 10, lineHeight: 1.5 }}>
              Li hai letti prima di metterli qui. Scrivi l'anno nella scheda del libro, sotto lo
              stato, e saliranno fra le annate.
            </p>
            {diary.senzaData.map((e) => (
              <Riga key={e.book.id} e={e} onOpenBook={onOpenBook} />
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
