import { lazy, Suspense, useRef, useState } from "react";
import { C, FONT_TITLE } from "../data/constants.js";
import { getProgress, getStatus, setStatus } from "../lib/library.js";
import { getCfi } from "../lib/annotations.js";
import { frontiera } from "../lib/frontiera.js";
import { soloDellaSerie } from "../lib/trama.js";
import BookCover from "./BookCover.jsx";

// la scheda dell'Oracolo arriva solo se la si chiede: qui dentro non
// serve quasi mai, e pesa quanto il reader
const SchedaOracolo = lazy(() => import("./SchedaOracolo.jsx"));

const GENRE_HINTS = [
  "Fantasy",
  "Fantascienza",
  "Horror",
  "Giallo",
  "Thriller",
  "Avventura",
  "Storico",
  "Romanzo",
  "Saggistica",
  "Biografia",
  "Poesia",
  "Fumetti",
  "Manuali",
];

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

function Stars({ value, onChange }) {
  const half = (n) => Math.min(1, Math.max(0, value - (n - 1)));
  const set = (v) => onChange(v === value ? 0 : v);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = half(n);
        const star = (color) => (
          <span
            style={{
              display: "block",
              width: 32,
              fontSize: 27,
              lineHeight: "32px",
              textAlign: "center",
              color,
              filter: color === C.accent ? `drop-shadow(0 0 6px ${C.accent}66)` : "none",
            }}
          >
            ★
          </span>
        );
        return (
          <span key={n} style={{ position: "relative", width: 32, height: 32 }}>
            {star(C.dim)}
            <span
              style={{
                position: "absolute",
                inset: 0,
                width: `${fill * 100}%`,
                overflow: "hidden",
                pointerEvents: "none",
              }}
            >
              {star(C.accent)}
            </span>
            <button
              onClick={() => set(n - 0.5)}
              aria-label={`${n - 0.5} stelle`}
              style={{ position: "absolute", left: 0, top: 0, width: "50%", height: "100%" }}
            />
            <button
              onClick={() => set(n)}
              aria-label={`${n} stelle`}
              style={{ position: "absolute", right: 0, top: 0, width: "50%", height: "100%" }}
            />
          </span>
        );
      })}
      <span style={{ marginLeft: 8, fontSize: 14, color: C.muted }}>
        {value ? String(value).replace(".", ",") : "—"}
      </span>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, options, listId }) {
  return (
    <label style={{ display: "block", marginBottom: 10 }}>
      <span style={{ display: "block", fontSize: 12.5, color: C.muted, marginBottom: 3 }}>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        list={listId}
        style={fieldStyle}
      />
      {options && (
        <datalist id={listId}>
          {options.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
      )}
    </label>
  );
}

export default function BookSheet({ book, books = [], onClose, onSaveMeta, onDelete, onRead, notify }) {
  const [title, setTitle] = useState(book.title);
  const [author, setAuthor] = useState(book.author || "");
  const [series, setSeries] = useState(book.series || "");
  const [genre, setGenre] = useState(book.genre || "");
  const [saga, setSaga] = useState(book.saga || "");
  const [sagaOrder, setSagaOrder] = useState(
    book.sagaOrder === null || book.sagaOrder === undefined ? "" : String(book.sagaOrder)
  );

  const uniq = (key) => [...new Set(books.map((b) => (b[key] || "").trim()).filter(Boolean))].sort();
  const [notes, setNotes] = useState(book.notes || "");
  const [rating, setRating] = useState(book.rating || 0);
  const [status, setStatusState] = useState(getStatus(book.id));
  const [confirmDelete, setConfirmDelete] = useState(false);

  const pct = Math.round(getProgress(book.id) * 100);

  // «PRIMA DI COMINCIARE»: c'è solo se davvero c'è un prima, cioè se di
  // questa saga hai già letto (o stai leggendo) qualche volume che viene
  // avanti nell'ordine. Vale per qualunque saga: l'ordine lo dici tu qui
  // sopra, nei campi Saga e Numero.
  const [prima, setPrima] = useState(null);
  const filoPrima = useRef(0);
  const comEditato = {
    ...book,
    saga: saga.trim(),
    series: series.trim(),
    sagaOrder: sagaOrder.trim() === "" ? null : Number(sagaOrder),
  };
  // stesso raggruppamento della scheda: se il volume dichiara una serie i
  // precedenti sono quelli della SUA serie. Il conteggio nel tasto deve
  // dire lo stesso numero che poi verrà davvero sfogliato.
  const precedenti = soloDellaSerie(
    comEditato,
    frontiera(comEditato, books, { statusOf: getStatus, cfiOf: getCfi }).filter(
      (t) => t.libro.id !== book.id
    )
  );

  async function chiediPrimaDiCominciare() {
    const mio = ++filoPrima.current;
    const vivo = () => filoPrima.current === mio;
    setPrima({ fase: "cerco", tappe: precedenti });
    const { schedaPrima } = await import("../lib/trama.js");
    const finito = await schedaPrima({
      book: comEditato,
      libri: books,
      statusOf: getStatus,
      // il volume che sta per cominciare non ha un «fin dove»: quello che
      // conta è tutto quello che viene prima
      cfiOf: (id) => (id === book.id ? null : getCfi(id)),
      vivo,
      passo: (s) => vivo() && setPrima(s),
    });
    if (vivo() && finito) setPrima(finito);
  }

  function commitAndClose() {
    onSaveMeta({
      ...book,
      title: title.trim() || book.title,
      author: author.trim(),
      series: series.trim(),
      genre: genre.trim(),
      saga: saga.trim(),
      sagaOrder: sagaOrder.trim() === "" ? null : Number(sagaOrder),
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
    onSaveMeta({
      ...book,
      title: title.trim() || book.title,
      author: author.trim(),
      series: series.trim(),
      genre: genre.trim(),
      saga: saga.trim(),
      sagaOrder: sagaOrder.trim() === "" ? null : Number(sagaOrder),
      notes,
      rating,
    });
    onRead(book.id);
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
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Field
                  label="Saga (l'universo che raccoglie più libri)"
                  value={saga}
                  onChange={setSaga}
                  placeholder="es. The Realm of the Elderlings"
                  options={uniq("saga")}
                  listId="bc-sagas"
                />
              </div>
              <label style={{ display: "block", marginBottom: 10, width: 96, flexShrink: 0 }}>
                <span style={{ display: "block", fontSize: 12.5, color: C.muted, marginBottom: 3 }}>
                  N° lettura
                </span>
                <input
                  value={sagaOrder}
                  onChange={(e) => setSagaOrder(e.target.value.replace(/[^\d]/g, ""))}
                  inputMode="numeric"
                  placeholder="1"
                  style={{ ...fieldStyle, textAlign: "center" }}
                />
              </label>
            </div>
            <Field
              label="Serie (il ciclo dentro la saga)"
              value={series}
              onChange={setSeries}
              placeholder="es. Farseer Trilogy"
              options={uniq("series")}
              listId="bc-series"
            />
            <Field
              label="Genere"
              value={genre}
              onChange={setGenre}
              placeholder="es. Fantasy"
              options={[...new Set([...uniq("genre"), ...GENRE_HINTS])]}
              listId="bc-genres"
            />

            <div style={{ marginBottom: 10 }}>
              <span style={{ display: "block", fontSize: 12.5, color: C.muted, marginBottom: 3 }}>Valutazione</span>
              <Stars value={rating} onChange={setRating} />
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

        {/* Il richiamo dei volumi precedenti: c'è solo se un prima esiste
            davvero, e sta sopra «Apri il libro» perché è lì che serve —
            un attimo prima di cominciare. */}
        {precedenti.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            {prima ? (
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: `1px solid ${C.border}`,
                  background: `${C.bg}88`,
                  maxHeight: "44vh",
                  overflowY: "auto",
                }}
              >
                <Suspense fallback={<p style={{ color: C.muted, fontSize: 14, margin: 0 }}>…</p>}>
                  <SchedaOracolo
                    scheda={prima}
                    attese={{
                      cerco: `Rileggo ${precedenti.length === 1 ? "il volume che viene prima" : `i ${precedenti.length} volumi che vengono prima`}…`,
                      chiedo: `✨ L'Oracolo sta leggendo ${prima.passaggi?.length || 0} passaggi…`,
                    }}
                    vuoto="Di questa saga non trovo volumi precedenti già letti su questo dispositivo."
                    onRiprova={chiediPrimaDiCominciare}
                  />
                </Suspense>
              </div>
            ) : (
              <button
                onClick={chiediPrimaDiCominciare}
                style={{
                  width: "100%",
                  padding: "10px 16px",
                  borderRadius: 12,
                  border: `1px solid ${C.arcane}66`,
                  color: C.arcane,
                  fontSize: 14.5,
                  textAlign: "left",
                  lineHeight: 1.4,
                }}
              >
                ✨ Prima di cominciare: cosa è successo{" "}
                {precedenti.length === 1
                  ? "nel volume precedente"
                  : `nei ${precedenti.length} volumi precedenti`}
              </button>
            )}
          </div>
        )}

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
