import { useCallback, useEffect, useRef, useState } from "react";
import { C, FONT_TITLE } from "../data/constants.js";
import { ensureLocalFile } from "../lib/sync.js";
import { getCfi, setCfi, getMarks, saveMarks } from "../lib/annotations.js";
import { getProgress, setProgress, setStatus } from "../lib/library.js";
import { loadReaderSettings, saveReaderSettings } from "../lib/readerSettings.js";
import { lookup, wordCount, cleanWord } from "../lib/dictionary.js";
import BookCover from "./BookCover.jsx";
import DictionaryCard from "./DictionaryCard.jsx";

const isTouch = () => navigator.maxTouchPoints > 0;

const barBtn = (active) => ({
  width: 40,
  height: 40,
  borderRadius: 10,
  fontSize: 19,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: active ? C.accent : C.text,
  background: active ? `${C.accent}1a` : "transparent",
});

function Panel({ title, onClose, children }) {
  return (
    <div
      onClick={onClose}
      style={{ position: "absolute", inset: 0, zIndex: 30, background: "#08061188", display: "flex", alignItems: "flex-end" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxHeight: "72%",
          overflowY: "auto",
          background: C.surface,
          borderTop: `1px solid ${C.border}`,
          borderRadius: "18px 18px 0 0",
          padding: "16px 18px 24px",
          animation: "bc-fade-in 0.25s ease-out",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h3 style={{ fontFamily: FONT_TITLE, fontSize: 20, fontWeight: 600, color: C.text }}>{title}</h3>
          <button onClick={onClose} style={barBtn(false)}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function PdfReader({ book, music, onMusicToggle, onMusicStop, onClose, notify, nextBook, onReadNext }) {
  const containerRef = useRef(null);
  const pageBoxRef = useRef(null);
  const canvasRef = useRef(null);
  const textRef = useRef(null);
  const pdfRef = useRef(null);
  const modRef = useRef(null);
  const renderTask = useRef(null);
  const textLayer = useRef(null);
  const langRef = useRef("en");
  const live = useRef({ page: Math.max(1, parseInt(getCfi(book.id), 10) || 1), pages: 0 });

  const [settings, setSettings] = useState(() =>
    loadReaderSettings(Math.min(window.innerWidth, window.innerHeight))
  );
  const [status, setStatusUi] = useState("loading");
  const [chrome, setChrome] = useState(() => !isTouch());
  const [panel, setPanel] = useState(null);
  const [page, setPage] = useState(live.current.page);
  const [pages, setPages] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [endCard, setEndCard] = useState(null);
  const [marks, setMarks] = useState(() => getMarks(book.id));
  const [outline, setOutline] = useState([]);
  const [sel, setSel] = useState(null);
  const [dict, setDict] = useState(null);
  const [jump, setJump] = useState("");

  const flush = useCallback(() => {
    const s = live.current;
    if (s.pages > 0) {
      setCfi(book.id, String(s.page));
      setProgress(book.id, s.page / s.pages);
    }
  }, [book.id]);

  const handleClose = useCallback(() => {
    flush();
    if (live.current.pages > 0 && live.current.page / live.current.pages >= 0.97) {
      setStatus(book.id, "read");
    }
    onClose();
  }, [book.id, flush, onClose]);

  const goToPage = useCallback((n) => {
    const max = live.current.pages || 1;
    setPage(Math.min(max, Math.max(1, n)));
  }, []);

  const renderPage = useCallback(
    async (pageNum, zoomLevel) => {
      const pdf = pdfRef.current;
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!pdf || !canvas || !container) return;
      try {
        renderTask.current?.cancel();
        textLayer.current?.cancel?.();
        const p = await pdf.getPage(pageNum);
        const base = p.getViewport({ scale: 1 });
        const cssWidth = Math.min(container.clientWidth - 8, (container.clientHeight - 8) * (base.width / base.height));
        const scale = (cssWidth / base.width) * zoomLevel;
        const dpr = window.devicePixelRatio || 1;
        const viewport = p.getViewport({ scale: scale * dpr });
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const cssW = Math.ceil(viewport.width / dpr);
        const cssH = Math.ceil(viewport.height / dpr);
        canvas.style.width = `${cssW}px`;
        canvas.style.height = `${cssH}px`;
        if (pageBoxRef.current) {
          pageBoxRef.current.style.width = `${cssW}px`;
          pageBoxRef.current.style.height = `${cssH}px`;
        }
        const task = p.render({ canvas, canvasContext: canvas.getContext("2d"), viewport });
        renderTask.current = task;
        await task.promise;

        const layer = textRef.current;
        const mod = modRef.current;
        if (layer && mod) {
          layer.replaceChildren();
          layer.style.setProperty("--total-scale-factor", String(scale));
          const tl = mod.makeTextLayer({
            textContentSource: p.streamTextContent(),
            container: layer,
            viewport: p.getViewport({ scale }),
          });
          textLayer.current = tl;
          await tl.render();
        }
      } catch (e) {
        if (e?.name !== "RenderingCancelledException" && e?.message !== "TextLayer task cancelled.") throw e;
      }
    },
    []
  );

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const blob = await ensureLocalFile(book);
        if (!blob) throw new Error("file mancante");
        const mod = await import("../lib/pdfThumb.js");
        modRef.current = mod;
        const pdf = await mod.loadPdf(await blob.arrayBuffer());
        if (dead) {
          pdf.destroy();
          return;
        }
        pdfRef.current = pdf;
        live.current.pages = pdf.numPages;
        live.current.page = Math.min(live.current.page, pdf.numPages);
        setPages(pdf.numPages);
        setPage(live.current.page);
        setStatusUi("ready");

        pdf.getMetadata().then((m) => {
          const l = (m?.info?.Language || "").slice(0, 2).toLowerCase();
          if (l) langRef.current = l;
        }).catch(() => { /* metadati assenti: resta l'inglese */ });

        // l'indice del PDF, se c'e': i titoli puntano a riferimenti interni
        // che vanno risolti in numeri di pagina uno per uno
        pdf.getOutline().then(async (items) => {
          if (dead || !items?.length) return;
          const flat = [];
          const walk = (list, depth) => {
            for (const it of list || []) {
              flat.push({ title: (it.title || "").trim(), dest: it.dest, depth });
              if (it.items?.length && flat.length < 200) walk(it.items, depth + 1);
            }
          };
          walk(items, 0);
          const out = [];
          for (const it of flat.slice(0, 200)) {
            try {
              const dest = typeof it.dest === "string" ? await pdf.getDestination(it.dest) : it.dest;
              const idx = dest?.[0] ? await pdf.getPageIndex(dest[0]) : null;
              if (idx != null) out.push({ ...it, page: idx + 1 });
            } catch { /* voce rotta: si salta */ }
          }
          if (!dead) setOutline(out);
        }).catch(() => { /* niente indice */ });
      } catch {
        if (!dead) setStatusUi("error");
      }
    })();

    const onVis = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("beforeunload", flush);
    return () => {
      dead = true;
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("beforeunload", flush);
      renderTask.current?.cancel();
      flush();
      try { pdfRef.current?.destroy(); } catch { /* già distrutto */ }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (status !== "ready") return;
    live.current.page = page;
    setSel(null);
    renderPage(page, zoom);
    flush();
    if (pages > 0 && page === pages) {
      setStatus(book.id, "read");
      setEndCard((v) => (v === null ? "shown" : v));
    }
  }, [status, page, zoom, pages, book.id, renderPage, flush]);

  useEffect(() => {
    if (status !== "ready") return;
    const onResize = () => renderPage(live.current.page, zoom);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [status, zoom, renderPage]);

  // il riquadro cambia misura col mostrarsi delle barre: si ridisegna
  useEffect(() => {
    if (status !== "ready") return;
    const id = requestAnimationFrame(() => renderPage(live.current.page, zoom));
    return () => cancelAnimationFrame(id);
  }, [chrome, status, zoom, renderPage]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") (panel ? setPanel(null) : handleClose());
      if (e.key === "ArrowRight") goToPage(live.current.page + 1);
      if (e.key === "ArrowLeft") goToPage(live.current.page - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel, handleClose, goToPage]);

  function updateSettings(patch) {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveReaderSettings(next);
  }

  function readSelection() {
    const text = window.getSelection()?.toString() || "";
    setSel(text.trim() ? { text } : null);
  }

  async function defineSelection() {
    const word = cleanWord(sel?.text);
    if (!word) return;
    setSel(null);
    setDict({ word, loading: true, entries: [] });
    setPanel("dict");
    const res = await lookup(word, langRef.current);
    setDict({
      word: res.word || word,
      loading: false,
      entries: res.entries,
      translation: res.translation,
      foreign: res.foreign,
      offline: res.offline,
    });
  }

  function addMark() {
    const m = {
      id: crypto.randomUUID(),
      cfi: String(live.current.page),
      label: `pag. ${live.current.page}`,
      createdAt: Date.now(),
    };
    const next = [...marks, m];
    setMarks(next);
    saveMarks(book.id, next);
    notify("Segnalibro riposto tra le pagine 📑");
  }

  function removeMark(m) {
    const next = marks.filter((x) => x.id !== m.id);
    setMarks(next);
    saveMarks(book.id, next);
  }

  const pct = pages > 0 ? Math.round((page / pages) * 100) : 0;
  const edge = "clamp(3px, 0.9vw, 10px)";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 45,
        background: "#1b1826",
        animation: "bc-fade-in 0.45s ease-out",
        overflow: "hidden",
      }}
    >
      <div
        ref={containerRef}
        onPointerUp={readSelection}
        onClick={(e) => {
          if (window.getSelection()?.toString().trim()) return;
          if (isTouch() && zoom === 1) {
            const r = containerRef.current.getBoundingClientRect();
            const rel = (e.clientX - r.left) / (r.width || 1);
            if (rel < 0.22) return goToPage(live.current.page - 1);
            if (rel > 0.78) return goToPage(live.current.page + 1);
          }
          setChrome((v) => !v);
        }}
        style={{
          position: "absolute",
          left: edge,
          right: edge,
          top: chrome ? 59 : edge,
          bottom: chrome ? "calc(69px + env(safe-area-inset-bottom))" : edge,
          overflow: "auto",
          display: "flex",
          alignItems: zoom > 1 ? "flex-start" : "center",
          justifyContent: zoom > 1 ? "flex-start" : "center",
        }}
      >
        <div ref={pageBoxRef} style={{ position: "relative", flexShrink: 0, boxShadow: "0 4px 30px #00000088" }}>
          <canvas ref={canvasRef} style={{ display: "block" }} />
          <div ref={textRef} className="textLayer" />
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 5,
          background: "#ff9a3c",
          mixBlendMode: "multiply",
          opacity: settings.warmth,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 5,
          background: "#000",
          opacity: 1 - settings.brightness,
        }}
      />

      {status === "loading" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 20,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            background: "#1b1826",
            color: C.muted,
          }}
        >
          <span style={{ fontSize: 40, animation: "bc-flicker 3s ease-in-out infinite" }}>🕯️</span>
          <span style={{ fontFamily: FONT_TITLE, fontSize: 18 }}>Apro il tomo…</span>
        </div>
      )}

      {status === "error" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 20,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 14,
            background: "#1b1826",
            color: C.text,
            textAlign: "center",
            padding: 24,
          }}
        >
          <span style={{ fontSize: 40 }}>📕</span>
          <span>
            Questo tomo non si lascia aprire… il file potrebbe essere danneggiato, oppure è nel
            cloud e ora sei offline.
          </span>
          <button
            onClick={handleClose}
            style={{ padding: "10px 22px", borderRadius: 10, border: `1px solid ${C.border}`, color: C.muted }}
          >
            Torna alla Libreria
          </button>
        </div>
      )}

      {status === "ready" && zoom === 1 && !isTouch() && (
        <>
          <button
            aria-label="Pagina precedente"
            onClick={() => goToPage(live.current.page - 1)}
            style={{ position: "absolute", left: 0, top: "15%", bottom: "15%", width: "13%", zIndex: 10, cursor: "w-resize" }}
          />
          <button
            aria-label="Pagina successiva"
            onClick={() => goToPage(live.current.page + 1)}
            style={{ position: "absolute", right: 0, top: "15%", bottom: "15%", width: "13%", zIndex: 10, cursor: "e-resize" }}
          />
        </>
      )}

      {sel && (
        <div
          style={{
            position: "absolute",
            bottom: chrome ? 92 : 24,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 35,
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 14px",
            borderRadius: 14,
            background: `${C.card}f8`,
            border: `1px solid ${C.border}`,
            boxShadow: "0 8px 30px #00000088",
            animation: "bc-fade-in 0.2s ease-out",
          }}
        >
          {wordCount(sel.text) <= 3 && (
            <button onClick={defineSelection} style={{ fontSize: 14.5, color: C.accent, fontWeight: 600 }}>
              📖 Definisci
            </button>
          )}
          <button
            onClick={() => {
              window.getSelection()?.removeAllRanges();
              setSel(null);
            }}
            style={{ fontSize: 14.5, color: C.muted }}
          >
            Annulla
          </button>
        </div>
      )}

      {chrome && (
        <>
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              zIndex: 25,
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "8px 10px",
              background: `${C.surface}f2`,
              backdropFilter: "blur(8px)",
              borderBottom: `1px solid ${C.border}`,
              animation: "bc-fade-in 0.2s ease-out",
            }}
          >
            <button onClick={handleClose} style={barBtn(false)} aria-label="Chiudi il libro">✕</button>
            <span
              style={{
                flex: 1,
                fontFamily: FONT_TITLE,
                fontSize: 16.5,
                fontWeight: 600,
                color: C.text,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {book.title}
            </span>
            {music?.current && (
              <>
                <button onClick={onMusicToggle} style={barBtn(false)} aria-label={music.playing ? "Pausa musica" : "Riprendi musica"}>
                  {music.playing ? "⏸" : "▶"}
                </button>
                <button onClick={onMusicStop} style={{ ...barBtn(false), fontSize: 16, color: C.muted }} aria-label="Spegni musica">
                  🔇
                </button>
              </>
            )}
            {outline.length > 0 && (
              <button onClick={() => setPanel(panel === "toc" ? null : "toc")} style={barBtn(panel === "toc")} aria-label="Indice">
                ☰
              </button>
            )}
            <button onClick={() => setPanel(panel === "marks" ? null : "marks")} style={barBtn(panel === "marks")} aria-label="Segnalibri">
              📑
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(1, +(z - 0.25).toFixed(2)))}
              style={barBtn(false)}
              aria-label="Riduci zoom"
            >
              −
            </button>
            <button
              onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}
              style={barBtn(false)}
              aria-label="Aumenta zoom"
            >
              ＋
            </button>
            <button onClick={() => setPanel(panel === "night" ? null : "night")} style={{ ...barBtn(panel === "night"), fontSize: 17 }} aria-label="Filtro notte">
              🌙
            </button>
          </div>

          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 25,
              padding: "10px 16px calc(10px + env(safe-area-inset-bottom))",
              background: `${C.surface}f2`,
              backdropFilter: "blur(8px)",
              borderTop: `1px solid ${C.border}`,
              animation: "bc-fade-in 0.2s ease-out",
            }}
          >
            <input
              type="range"
              min={1}
              max={Math.max(1, pages)}
              value={page}
              onChange={(e) => setPage(parseInt(e.target.value, 10))}
              style={{ width: "100%", accentColor: C.accent }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5, color: C.muted, marginTop: 2 }}>
              <span>{pct}%</span>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const n = parseInt(jump, 10);
                  if (Number.isFinite(n)) goToPage(n);
                  setJump("");
                }}
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <input
                  value={jump}
                  onChange={(e) => setJump(e.target.value.replace(/\D/g, ""))}
                  inputMode="numeric"
                  placeholder={String(page)}
                  aria-label="Vai a pagina"
                  style={{
                    width: 58,
                    padding: "3px 7px",
                    borderRadius: 8,
                    border: `1px solid ${C.border}`,
                    background: C.card,
                    color: C.text,
                    fontSize: 12.5,
                    textAlign: "right",
                    outline: "none",
                  }}
                />
                <span>/ {pages || "…"}</span>
              </form>
            </div>
          </div>
        </>
      )}

      {panel === "night" && (
        <div
          style={{
            position: "absolute",
            right: 10,
            top: 62,
            zIndex: 30,
            width: 260,
            padding: 16,
            borderRadius: 14,
            border: `1px solid ${C.border}`,
            background: `${C.surface}fa`,
            boxShadow: "0 10px 40px #00000088",
            animation: "bc-fade-in 0.2s ease-out",
          }}
        >
          <div style={{ fontSize: 14, color: C.muted, marginBottom: 4 }}>Filtro notte caldo</div>
          <input
            type="range"
            min={0}
            max={0.45}
            step={0.05}
            value={settings.warmth}
            onChange={(e) => updateSettings({ warmth: parseFloat(e.target.value) })}
            style={{ width: "100%", accentColor: C.accent, marginBottom: 12 }}
          />
          <div style={{ fontSize: 14, color: C.muted, marginBottom: 4 }}>Luminosità</div>
          <input
            type="range"
            min={0.4}
            max={1}
            step={0.05}
            value={settings.brightness}
            onChange={(e) => updateSettings({ brightness: parseFloat(e.target.value) })}
            style={{ width: "100%", accentColor: C.accent }}
          />
        </div>
      )}

      {panel === "marks" && (
        <Panel title="Segnalibri" onClose={() => setPanel(null)}>
          <button
            onClick={addMark}
            style={{
              width: "100%",
              padding: "11px 0",
              borderRadius: 12,
              marginBottom: 14,
              background: `linear-gradient(180deg, ${C.accent}, #b8893a)`,
              color: "#241c0a",
              fontWeight: 600,
              fontSize: 15,
            }}
          >
            📑 Salva qui
          </button>
          {marks.length === 0 ? (
            <p style={{ color: C.muted }}>Nessun segnalibro ancora.</p>
          ) : (
            [...marks]
              .sort((a, b) => (parseInt(a.cfi, 10) || 0) - (parseInt(b.cfi, 10) || 0))
              .map((m) => (
                <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, borderBottom: `1px solid ${C.border}44` }}>
                  <button
                    onClick={() => {
                      goToPage(parseInt(m.cfi, 10) || 1);
                      setPanel(null);
                    }}
                    style={{ flex: 1, textAlign: "left", padding: "11px 6px", fontSize: 15, color: C.text }}
                  >
                    {m.label}
                    <span style={{ display: "block", fontSize: 12.5, color: C.muted }}>
                      {pages ? `al ${Math.round(((parseInt(m.cfi, 10) || 1) / pages) * 100)}% · ` : ""}
                      {new Date(m.createdAt).toLocaleString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </button>
                  <button onClick={() => removeMark(m)} aria-label="Elimina segnalibro" style={{ color: C.muted, padding: 8 }}>🗑</button>
                </div>
              ))
          )}
        </Panel>
      )}

      {panel === "toc" && (
        <Panel title="Indice" onClose={() => setPanel(null)}>
          {outline.map((it, i) => (
            <button
              key={i}
              onClick={() => {
                goToPage(it.page);
                setPanel(null);
              }}
              style={{
                display: "flex",
                width: "100%",
                gap: 10,
                textAlign: "left",
                padding: "10px 6px",
                paddingLeft: 6 + it.depth * 14,
                borderBottom: `1px solid ${C.border}44`,
                fontSize: 15,
                color: it.page === page ? C.accent : C.text,
              }}
            >
              <span style={{ flex: 1 }}>{it.title || "…"}</span>
              <span style={{ fontSize: 12.5, color: C.muted }}>{it.page}</span>
            </button>
          ))}
        </Panel>
      )}

      {panel === "dict" && (
        <DictionaryCard dict={dict} bottom={chrome ? 92 : 26} onClose={() => setPanel(null)} />
      )}

      {endCard === "shown" && nextBook && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            bottom: chrome ? 96 : 30,
            zIndex: 32,
            width: "min(94%, 440px)",
            display: "flex",
            gap: 14,
            alignItems: "center",
            padding: "13px 16px",
            borderRadius: 16,
            background: `${C.card}fa`,
            border: `1px solid ${C.accent}55`,
            boxShadow: "0 12px 44px #000000aa",
            animation: "bc-fade-in 0.3s ease-out",
          }}
        >
          <div style={{ width: 52, flexShrink: 0 }}>
            <BookCover book={nextBook} radius={6} compact />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, color: C.muted }}>Fine del volume — il prossimo della saga</div>
            <div
              style={{
                fontFamily: FONT_TITLE,
                fontWeight: 600,
                fontSize: 17,
                color: C.text,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {nextBook.title}
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: 5 }}>
              <button
                onClick={() => {
                  flush();
                  onReadNext(nextBook.id);
                }}
                style={{ fontSize: 14, fontWeight: 600, color: C.accent }}
              >
                Leggilo ora
              </button>
              <button onClick={() => setEndCard("dismissed")} style={{ fontSize: 14, color: C.muted }}>
                Più tardi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
