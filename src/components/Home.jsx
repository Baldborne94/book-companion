import { useState } from "react";
import { C, FONT_TITLE, F, R } from "../data/constants.js";
import { useViewport } from "../lib/viewport.js";
import { getLastOpened, getProgress, getStatus, getUpdatedAt } from "../lib/library.js";
import { nextInSaga } from "../lib/saga.js";
import BookCover from "./BookCover.jsx";
import { BookmarkIcon, LeafIcon, SparkIcon, StarIcon } from "./Icons.jsx";
import EmptyState from "./EmptyState.jsx";

// da quante stelle in su la CARTA DI UNA SAGA si accende (bordo dorato e
// voto in vista). Non c'entra coi preferiti, che sono quelli col cuore:
// qui è solo «questa saga ha un voto alto, mostralo» — ed è il punto che
// ha rotto l'app quando i preferiti hanno smesso di usare le stelle: la
// costante era stata tolta ma le carte-saga la usavano ancora, e Vite non
// si accorge di un identificatore libero (la pagina moriva SOLO con una
// saga sullo scaffale, quindi la prova senza saghe non l'aveva preso)
const STELLE_ALTE = 4;

const stars = (v) => String(v).replace(".", ",");

function SectionTitle({ children }) {
  return (
    <h2
      style={{
        fontFamily: FONT_TITLE,
        fontWeight: 600,
        fontSize: F.titolo,
        color: C.text,
        margin: "16px 0 12px",
        display: "flex",
        alignItems: "center",
        gap: 7,
      }}
    >
      <span style={{ color: C.arcane, flexShrink: 0 }}>
        <SparkIcon size={15} />
      </span>
      {children}
    </h2>
  );
}

function Rating({ value }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        fontSize: F.minuscolo,
        color: C.accent,
      }}
    >
      <StarIcon size={12} />
      {stars(value)}
    </span>
  );
}

function SagaCard({ saga, onOpen }) {
  return (
    <button
      onClick={() => onOpen(saga.name)}
      style={{
        flexShrink: 0,
        width: 214,
        textAlign: "left",
        padding: 13,
        borderRadius: R.medio,
        border: `1px solid ${saga.best >= STELLE_ALTE ? `${C.accent}66` : C.border}`,
        background: `linear-gradient(135deg, ${C.card}, ${C.surface})`,
      }}
    >
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {saga.books.slice(0, 3).map((b) => (
          <div key={b.id} style={{ width: 42 }}>
            <BookCover book={b} radius={5} compact />
          </div>
        ))}
      </div>
      <div
        style={{
          fontFamily: FONT_TITLE,
          fontWeight: 600,
          fontSize: F.rilievo,
          color: C.text,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {saga.name}
      </div>
      <div style={{ fontSize: F.piccolo, color: C.muted, marginTop: 2, display: "flex", gap: 8 }}>
        <span>
          {saga.books.length} {saga.books.length === 1 ? "libro" : "libri"}
        </span>
        {saga.best >= STELLE_ALTE && <Rating value={saga.best} />}
      </div>
    </button>
  );
}

export default function Home({ books, goTo, onOpenBook, onRead, onGarden, onDiary, onSaga }) {
  // chi ha il dorso disegnato lo sa solo `BookCover`: lo dice qui, così i
  // preferiti non ristampano un titolo che sta già sulla copertina
  const [dorsi, setDorsi] = useState({});
  const segnaDorso = (id, v) => setDorsi((d) => (d[id] === v ? d : { ...d, [id]: v }));
  const { wide } = useViewport();

  if (books.length === 0) {
    return (
      <EmptyState
        emoji="🔮"
        title="Benvenuto nel tuo regno"
        text="Qui ritroverai il libro che stai leggendo e le saghe a cui tieni di più. Tutto comincia portando il primo tomo in Libreria."
        action="Vai alla Libreria"
        onAction={() => goTo("library")}
      />
    );
  }

  // bc_lastopen vale solo per questo dispositivo: se manca (perche' il libro
  // e' stato aperto altrove) si ripiega sui libri gia' iniziati e infine sul
  // piu' recente, cosi' la home propone sempre qualcosa da aprire.
  const byRecent = (a, b) => getUpdatedAt(b.id, b.addedAt || 0) - getUpdatedAt(a.id, a.addedAt || 0);
  // Un libro chiuso non si ripropone, e «chiuso» sono DUE cose: finito e
  // abbandonato. Senza il secondo, il romanzo che hai mollato resterebbe qui
  // in cima per sempre — che e' proprio il motivo per cui quello stato esiste.
  const chiuso = (b) => {
    const s = getStatus(b.id);
    return s === "read" || s === "abandoned";
  };
  const started = books
    .filter((b) => !chiuso(b) && (getStatus(b.id) === "reading" || getProgress(b.id) > 0))
    .sort(byRecent);
  const unread = books.filter((b) => !chiuso(b)).sort(byRecent);
  // se l'ultimo aperto e' stato finito, il riquadro propone il passo
  // successivo della sua saga invece di riproporre un libro chiuso
  const apertoOra = books.find((b) => b.id === getLastOpened());
  // l'ultimo aperto vale solo se non l'hai chiuso: un libro abbandonato non
  // torna in cima solo perche' era l'ultimo che avevi in mano
  const lastOpened = apertoOra && getStatus(apertoOra.id) === "abandoned" ? null : apertoOra;
  const lastDone = lastOpened && getStatus(lastOpened.id) === "read" ? lastOpened : null;
  const followUp = lastDone ? nextInSaga(lastDone, books) : null;
  const last =
    (lastDone ? null : lastOpened) || followUp || started[0] || unread[0] || [...books].sort(byRecent)[0];
  const followedFrom = followUp && last === followUp ? lastDone : null;
  const pct = last ? Math.round(getProgress(last.id) * 100) : 0;
  const resuming = pct > 0;

  // I PREFERITI SONO QUELLI COL CUORE, non «tutti i libri da quattro
  // stelle in su»: le stelle sono un voto, la vetrina è una scelta, e
  // sceglierla tocca al lettore (chiesto: «metto io quali sono i miei
  // preferiti»). Il cuore si mette nella scheda del libro, accanto alla
  // valutazione.
  const favorites = books
    .filter((b) => b.fav)
    .sort((a, b) => (b.rating || 0) - (a.rating || 0) || (a.sagaOrder ?? Infinity) - (b.sagaOrder ?? Infinity));

  const bySaga = new Map();
  for (const b of books) {
    const name = (b.saga || "").trim();
    if (!name) continue;
    const e = bySaga.get(name) || { name, books: [], best: 0 };
    e.books.push(b);
    e.best = Math.max(e.best, b.rating || 0);
    bySaga.set(name, e);
  }
  for (const e of bySaga.values()) {
    e.books.sort((a, b) => (a.sagaOrder ?? Infinity) - (b.sagaOrder ?? Infinity));
  }
  const sagas = [...bySaga.values()].sort(
    (a, b) => b.best - a.best || b.books.length - a.books.length || a.name.localeCompare(b.name, "it")
  );

  return (
    <div
      style={{
        animation: "bc-fade-in 0.4s ease-out",
        display: wide ? "grid" : "block",
        gridTemplateColumns: wide ? "minmax(0, 1fr) minmax(0, 1fr)" : undefined,
        gap: wide ? "0 28px" : undefined,
        alignItems: "start",
      }}
    >
      <div style={{ gridColumn: wide ? 1 : "auto" }}>
      {last && (
        <>
          <SectionTitle>{followedFrom ? "Il prossimo della saga" : "Continua da dove ti sei fermato"}</SectionTitle>
          <button
            onClick={() => onRead(last.id)}
            style={{
              width: "100%",
              display: "flex",
              gap: 16,
              alignItems: "center",
              textAlign: "left",
              padding: 14,
              borderRadius: R.medio,
              border: `1px solid ${C.border}`,
              background: `linear-gradient(135deg, ${C.card}, ${C.surface})`,
              boxShadow: `0 0 30px ${C.arcane}14`,
            }}
          >
            <div style={{ width: 84, flexShrink: 0 }}>
              {/* qui il titolo e l'autore stanno già scritti accanto, e il
                  riquadro è alto ottantaquattro pixel: il dorso fa la sua
                  parte col colore e basta */}
              <BookCover book={last} compact />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontFamily: FONT_TITLE,
                  fontWeight: 600,
                  fontSize: F.titoletto,
                  color: C.text,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {last.title}
              </div>
              {last.author && <div style={{ fontSize: F.nota, color: C.muted, marginBottom: 8 }}>{last.author}</div>}
              {resuming && (
                <div style={{ height: 5, borderRadius: R.minimo, background: C.dim, overflow: "hidden", marginBottom: 5 }}>
                  <div
                    style={{
                      width: `${Math.max(pct, 2)}%`,
                      height: "100%",
                      borderRadius: R.minimo,
                      background: `linear-gradient(90deg, ${C.accent}, ${C.arcane})`,
                    }}
                  />
                </div>
              )}
              <div style={{ fontSize: F.piccolo, color: C.muted }}>
                {resuming
                  ? `${pct}% — riprendi da dove eri`
                  : followedFrom
                    ? `il passo n° ${last.sagaOrder} di ${last.saga}`
                    : "apri e comincia il primo capitolo"}
              </div>
            </div>
            <span style={{ fontSize: F.titolo, color: C.accent }}>›</span>
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
          borderRadius: R.medio,
          border: `1px solid ${C.arcane}55`,
          background: `linear-gradient(135deg, ${C.arcane}14, transparent)`,
          textAlign: "left",
        }}
      >
        <span style={{ color: C.arcane, filter: `drop-shadow(0 0 10px ${C.arcane}66)` }}>
          <LeafIcon size={24} active />
        </span>
        <span style={{ flex: 1 }}>
          <span style={{ display: "block", fontFamily: FONT_TITLE, fontWeight: 600, fontSize: F.rilievo, color: C.text }}>
            Il giardino delle citazioni
          </span>
          <span style={{ display: "block", fontSize: F.piccolo, color: C.muted }}>
            I passaggi che hai evidenziato, di ogni libro, in un unico posto
          </span>
        </span>
        <span style={{ fontSize: F.titoletto, color: C.arcane }}>›</span>
      </button>

      <button
        onClick={onDiary}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginTop: 10,
          padding: "13px 16px",
          borderRadius: R.medio,
          border: `1px solid ${C.accent}44`,
          background: `linear-gradient(135deg, ${C.accent}10, transparent)`,
          textAlign: "left",
        }}
      >
        <span style={{ color: C.accent, filter: `drop-shadow(0 0 10px ${C.accent}55)` }}>
          <BookmarkIcon size={24} />
        </span>
        <span style={{ flex: 1 }}>
          <span style={{ display: "block", fontFamily: FONT_TITLE, fontWeight: 600, fontSize: F.rilievo, color: C.text }}>
            Il diario di lettura
          </span>
          <span style={{ display: "block", fontSize: F.piccolo, color: C.muted }}>
            Quando hai cominciato e finito ogni libro, anno per anno
          </span>
        </span>
        <span style={{ fontSize: F.titoletto, color: C.accent }}>›</span>
      </button>
      </div>

      <div style={{ gridColumn: wide ? 2 : "auto" }}>
      {sagas.length > 0 && (
        <>
          <SectionTitle>Le tue saghe</SectionTitle>
          <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 4, flexWrap: wide ? "wrap" : "nowrap" }}>
            {sagas.map((s) => (
              <SagaCard key={s.name} saga={s} onOpen={onSaga} />
            ))}
          </div>
        </>
      )}

      {favorites.length > 0 && (
        <>
          <SectionTitle>I tuoi preferiti</SectionTitle>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))",
              gap: "16px 14px",
              // I LIBRI SI ALLINEANO IN ALTO. Un `<button>` più basso della sua
              // riga centra il contenuto — è il browser che lo fa — e da quando la
              // didascalia compare solo sotto le copertine VERE le righe hanno
              // altezze diverse: i dorsi disegnati scivolavano in basso di
              // quaranta pixel, e lo scaffale sembrava storto.
              alignItems: "start",
            }}
          >
            {favorites.map((b) => (
              <button key={b.id} onClick={() => onOpenBook(b.id)} style={{ textAlign: "center" }}>
                <BookCover book={b} onDisegnata={(v) => segnaDorso(b.id, v)} />
                {!dorsi[b.id] && (
                <div
                  style={{
                    marginTop: 6,
                    fontSize: F.piccolo,
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
                )}
                <div style={{ marginTop: 3 }}>
                  <Rating value={b.rating} />
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {sagas.length === 0 && favorites.length === 0 && (
        <div
          style={{
            marginTop: 22,
            padding: "16px 18px",
            borderRadius: R.medio,
            border: `1px dashed ${C.border}`,
            fontSize: F.nota,
            lineHeight: 1.5,
            color: C.muted,
          }}
        >
          Qui vivranno le tue saghe e i tuoi preferiti. Apri la scheda di un libro dalla Libreria:
          indica la saga a cui appartiene, e tocca ♡ accanto alla valutazione — col cuore lo ritrovi qui.
        </div>
      )}
      </div>
    </div>
  );
}
