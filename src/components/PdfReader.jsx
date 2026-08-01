import { useCallback, useEffect, useRef, useState } from "react";
import { C, FONT_TITLE } from "../data/constants.js";
import { ensureLocalFile } from "../lib/sync.js";
import { getCfi, setCfi } from "../lib/annotations.js";
import { getProgress, setProgress, setStatus } from "../lib/library.js";
import { loadReaderSettings, saveReaderSettings } from "../lib/readerSettings.js";
import BookCover from "./BookCover.jsx";

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

export default function PdfReader({ book, music, onMusicToggle, onMusicStop, onClose, notify, nextBook, onReadNext }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const pdfRef = useRef(null);
  const renderTask = useRef(null);
  const live = useRef({ page: Math.max(1, parseInt(getCfi(book.id), 10) || 1), pages: 0 });

  const [settings, setSettings] = useState(() =>
    loadReaderSettings(Math.min(window.innerWidth, window.innerHeight))
  );
  const [status, setStatusUi] = useState("loading");
  const [chrome, setChrome] = useState(() => !isTouch());
  const [panel, setPanel] = useState(false);
  const [page, setPage] = useState(live.current.page);
  const [pages, setPages] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [endCard, setEndCard] = useState(null);

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

  const renderPage = useCallback(
    async (pageNum, zoomLevel) => {
      const pdf = pdfRef.current;
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!pdf || !canvas || !container) return;
      try {
        renderTask.current?.cancel();
        const p = await pdf.getPage(pageNum);
        const base = p.getViewport({ scale: 1 });
        const cssWidth = Math.min(container.clientWidth - 8, (container.clientHeight - 8) * (base.width / base.height));
        const scale = (cssWidth / base.width) * zoomLevel;
        const dpr = window.devicePixelRatio || 1;
        const viewport = p.getViewport({ scale: scale * dpr });
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        canvas.style.width = `${Math.ceil(viewport.width / dpr)}px`;
        canvas.style.height = `${Math.ceil(viewport.height / dpr)}px`;
        const task = p.render({ canvas, canvasContext: canvas.getContext("2d"), viewport });
        renderTask.current = task;
        await task.promise;
      } catch (e) {
        if (e?.name !== "RenderingCancelledException") throw e;
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
        const { loadPdf } = await import("../lib/pdfThumb.js");
        const pdf = await loadPdf(await blob.arrayBuffer());
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

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") (panel ? setPanel(false) : handleClose());
      if (e.key === "ArrowRight") setPage((p) => Math.min(live.current.pages || p, p + 1));
      if (e.key === "ArrowLeft") setPage((p) => Math.max(1, p - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel, handleClose]);

  function updateSettings(patch) {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveReaderSettings(next);
  }

  const pct = pages > 0 ? Math.round((page / pages) * 100) : 0;

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
        onClick={() => setChrome((v) => !v)}
        style={{
          position: "absolute",
          inset: 0,
          overflow: "auto",
          display: "flex",
          alignItems: zoom > 1 ? "flex-start" : "center",
          justifyContent: zoom > 1 ? "flex-start" : "center",
          padding: 4,
        }}
      >
        <canvas ref={canvasRef} style={{ display: "block", boxShadow: "0 4px 30px #00000088" }} />
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

      {status === "ready" && zoom === 1 && (
        <>
          <button
            aria-label="Pagina precedente"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            style={{ position: "absolute", left: 0, top: "15%", bottom: "15%", width: "13%", zIndex: 10, cursor: "w-resize" }}
          />
          <button
            aria-label="Pagina successiva"
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            style={{ position: "absolute", right: 0, top: "15%", bottom: "15%", width: "13%", zIndex: 10, cursor: "e-resize" }}
          />
        </>
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
            <button onClick={() => setPanel((v) => !v)} style={{ ...barBtn(panel), fontSize: 17 }} aria-label="Filtro notte">
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
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: C.muted, marginTop: 2 }}>
              <span>{pct}%</span>
              <span>
                {page} / {pages || "…"}
              </span>
            </div>
          </div>
        </>
      )}

      {panel && (
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
