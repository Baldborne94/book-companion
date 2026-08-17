import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { C, FONT_TITLE } from "../data/constants.js";
import { getProgress, getStatus, setStatus, touchBook } from "../lib/library.js";
import { getCover, getFile, putCover, removeCover } from "../lib/bookStore.js";
import { preparaCopertina, copertinaOriginale } from "../lib/copertina.js";
import { caricaCopertina } from "../lib/sync.js";
import { chiaveGlossario, vociDi, salvaVoci, togli } from "../lib/glossarioMio.js";
import { getCfi } from "../lib/annotations.js";
import { frontiera } from "../lib/frontiera.js";
import { soloDellaSerie } from "../lib/trama.js";
import { TUTTI } from "../data/generi.js";
import BookCover from "./BookCover.jsx";

// la scheda dell'Oracolo arriva solo se la si chiede: qui dentro non
// serve quasi mai, e pesa quanto il reader
const SchedaOracolo = lazy(() => import("./SchedaOracolo.jsx"));
// e l'elenco dei generi solo a chi tocca «Scegli»
const GenrePicker = lazy(() => import("./GenrePicker.jsx"));

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
  const [sceltaGenere, setSceltaGenere] = useState(false);
  const [saga, setSaga] = useState(book.saga || "");
  const [sagaOrder, setSagaOrder] = useState(
    book.sagaOrder === null || book.sagaOrder === undefined ? "" : String(book.sagaOrder)
  );

  const uniq = (key) => [...new Set(books.map((b) => (b[key] || "").trim()).filter(Boolean))].sort();
  const [notes, setNotes] = useState(book.notes || "");
  const [rating, setRating] = useState(book.rating || 0);
  const [status, setStatusState] = useState(getStatus(book.id));
  const [confirmDelete, setConfirmDelete] = useState(false);

  // LA COPERTINA A MANO. `coverV` è l'appiglio che fa ricaricare l'immagine:
  // l'id del libro non cambia, quindi da solo non basterebbe.
  const coverRef = useRef(null);
  const [coverV, setCoverV] = useState(0);
  const [coverBusy, setCoverBusy] = useState(false);
  const [haCopertina, setHaCopertina] = useState(false);
  useEffect(() => {
    let vivo = true;
    getCover(book.id).then((b) => vivo && setHaCopertina(!!b));
    return () => {
      vivo = false;
    };
  }, [book.id, coverV]);

  async function cambiaCopertina(file) {
    if (!file || coverBusy) return;
    setCoverBusy(true);
    try {
      const blob = await preparaCopertina(file);
      if (!blob) {
        notify?.("Quella non sembra un'immagine");
        return;
      }
      await putCover(book.id, blob);
      // il libro è cambiato anche se i suoi campi no: senza questo la
      // sincronizzazione non saprebbe che c'è qualcosa di nuovo
      touchBook(book.id);
      setCoverV((v) => v + 1);
      caricaCopertina(book.id);
      notify?.("Copertina rivestita 🖼");
    } catch {
      notify?.("Non sono riuscito a leggere quell'immagine");
    } finally {
      setCoverBusy(false);
      if (coverRef.current) coverRef.current.value = "";
    }
  }

  // «Torna indietro» vuol dire rimettere la copertina DEL LIBRO, non restare
  // senza: quella sta ancora dentro il file, e tirarla fuori è lo stesso
  // giro che fa l'import. Solo se il libro davvero non ne ha una si resta
  // col dorso disegnato, che lì è lo stato di partenza.
  async function togliCopertina() {
    if (coverBusy) return;
    setCoverBusy(true);
    try {
      const bytes = await getFile(book.id).catch(() => null);
      // senza il file non si guarda, e buttare via la copertina buona di un
      // libro rimasto nel cloud sarebbe il danno peggiore
      if (!bytes) {
        notify?.("Il file non è su questo dispositivo: la copertina resta com'è");
        return;
      }
      const originale = await copertinaOriginale(book, bytes);
      if (originale) await putCover(book.id, originale);
      else await removeCover(book.id);
      touchBook(book.id);
      setCoverV((v) => v + 1);
      caricaCopertina(book.id);
      notify?.(originale ? "Rimessa la copertina del libro 🖼" : "Tornata al dorso disegnato");
    } catch {
      notify?.("Non sono riuscito a rimettere la copertina originale");
    } finally {
      setCoverBusy(false);
    }
  }

  // Il glossario tuo è legato alla SAGA, e la saga si può stare cambiando
  // proprio qui sopra: si rilegge dal campo, non dal libro salvato.
  const chiaveMia = chiaveGlossario({ ...book, saga });
  const [glossOpen, setGlossOpen] = useState(false);
  const [glossV, setGlossV] = useState(0);
  const mieVoci = useMemo(() => vociDi(chiaveMia), [chiaveMia, glossV]);
  function togliVoce(t) {
    salvaVoci(chiaveMia, togli(mieVoci, t));
    setGlossV((v) => v + 1);
  }

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
            <BookCover book={book} radius={10} version={coverV} />
            {/* Titolo, autore, saga e genere si correggono qui da sempre; la
                copertina no, e un ePub senza copertina restava un dorso muto
                per sempre. Il tasto sta sotto l'immagine, dov'è la cosa che
                cambia. */}
            <input
              ref={coverRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => cambiaCopertina(e.target.files?.[0])}
            />
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <button
                onClick={() => coverRef.current?.click()}
                disabled={coverBusy}
                style={{
                  flex: 1,
                  padding: "7px 0",
                  borderRadius: 9,
                  border: `1px solid ${C.border}`,
                  color: coverBusy ? C.muted : C.text,
                  fontSize: 12.5,
                }}
              >
                {coverBusy ? "…" : "🖼 Copertina"}
              </button>
              {haCopertina && (
                <button
                  onClick={togliCopertina}
                  disabled={coverBusy}
                  aria-label="Rimetti la copertina del libro"
                  style={{
                    padding: "7px 10px",
                    borderRadius: 9,
                    border: `1px solid ${C.border}`,
                    color: C.muted,
                    fontSize: 12.5,
                  }}
                >
                  ↺
                </button>
              )}
            </div>
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
            {/* la casella resta scrivibile — quello che ci scrivi tu vale
                sempre — ma il tasto accanto apre l'elenco da toccare, che
                e' l'unico modo civile di scegliere «Sword & sorcery» su un
                tablet senza tirare su la tastiera */}
            <label style={{ display: "block", marginBottom: 10 }}>
              <span style={{ display: "block", fontSize: 12.5, color: C.muted, marginBottom: 3 }}>
                Genere
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  placeholder="es. Fantasy"
                  list="bc-genres"
                  style={{ ...fieldStyle, flex: 1, minWidth: 0 }}
                />
                <button
                  onClick={() => setSceltaGenere((v) => !v)}
                  aria-expanded={sceltaGenere}
                  style={{
                    flexShrink: 0,
                    padding: "9px 16px",
                    borderRadius: 10,
                    fontSize: 14,
                    cursor: "pointer",
                    border: `1px solid ${sceltaGenere ? C.accent : C.border}`,
                    background: sceltaGenere ? `${C.accent}22` : "transparent",
                    color: sceltaGenere ? C.accent : C.text,
                  }}
                >
                  Scegli
                </button>
              </div>
              <datalist id="bc-genres">
                {[...new Set([...uniq("genre"), ...TUTTI])].map((o) => (
                  <option key={o} value={o} />
                ))}
              </datalist>
            </label>
            {sceltaGenere && (
              <Suspense fallback={null}>
                <GenrePicker value={genre} onChange={setGenre} miei={uniq("genre")} />
              </Suspense>
            )}

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

        {/* IL GLOSSARIO TUO. Le voci si scrivono nel reader, toccando la
            parola: qui si rileggono tutte insieme, che è l'unico posto dove
            ci si accorge di una spiegazione sbagliata scritta di fretta. La
            chiave è la saga, quindi la stessa lista vale per tutti i volumi. */}
        {mieVoci.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <button
              onClick={() => setGlossOpen((v) => !v)}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "10px 14px",
                borderRadius: 12,
                border: `1px solid ${C.border}`,
                color: C.text,
                fontSize: 14.5,
              }}
            >
              📖 Il tuo glossario · {mieVoci.length}{" "}
              {mieVoci.length === 1 ? "termine" : "termini"}
              {saga.trim() ? ` di «${saga.trim()}»` : " di questo libro"}
              <span style={{ float: "right", color: C.muted }}>{glossOpen ? "▾" : "▸"}</span>
            </button>
            {glossOpen && (
              <div style={{ marginTop: 8 }}>
                {mieVoci.map((v) => (
                  <div
                    key={v.t}
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "flex-start",
                      padding: "9px 12px",
                      marginBottom: 6,
                      borderRadius: 10,
                      background: C.surface,
                      border: `1px solid ${C.border}`,
                    }}
                  >
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 14.5, color: C.accent, fontWeight: 600 }}>
                        {v.t}
                      </span>
                      <span style={{ display: "block", fontSize: 13.5, color: C.text, lineHeight: 1.45 }}>
                        {v.d}
                      </span>
                    </span>
                    <button
                      onClick={() => togliVoce(v.t)}
                      aria-label={`Togli «${v.t}» dal glossario`}
                      style={{ color: C.muted, padding: 4 }}
                    >
                      🗑
                    </button>
                  </div>
                ))}
              </div>
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
