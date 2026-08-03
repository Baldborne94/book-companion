import { useCallback, useEffect, useRef, useState } from "react";
import { C, FONT_TITLE } from "../data/constants.js";
import { ensureLocalFile } from "../lib/sync.js";
import { getCfi, setCfi, getMarks, saveMarks, getHighlights, saveHighlights } from "../lib/annotations.js";
import { getProgress, setProgress, setStatus } from "../lib/library.js";
import { HL_COLORS, loadReaderSettings, saveReaderSettings } from "../lib/readerSettings.js";
import { lookup, lookupPhrase, wordCount, cleanWord } from "../lib/dictionary.js";
import { explain } from "../lib/glossary.js";
import { contextAround } from "../lib/oracle.js";
import { toPageRects, rectStyle, pageOf } from "../lib/pdfHighlights.js";
import { searchPdf } from "../lib/pdfSearch.js";
import BookCover from "./BookCover.jsx";
import DictionaryCard from "./DictionaryCard.jsx";
import HighlightList from "./HighlightList.jsx";

// stesse fasce del reader EPUB, misurate sullo schermo: cosi' anche il
// margine attorno alla pagina volta, non solo il foglio
const TAP_PREV = 0.28;
const TAP_NEXT = 0.72;
// stessi limiti del reader EPUB per la scheda del significato
const NET_WORDS = 30;
const PHRASE_WORDS = 300;

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

export default function PdfReader({ book, startCfi, music, onMusicToggle, onMusicStop, onClose, notify, nextBook, onReadNext }) {
  const rootRef = useRef(null);
  const containerRef = useRef(null);
  const pageBoxRef = useRef(null);
  const canvasRef = useRef(null);
  const textRef = useRef(null);
  const pdfRef = useRef(null);
  const modRef = useRef(null);
  const renderTask = useRef(null);
  const renderToken = useRef(0);
  const textLayer = useRef(null);
  const langRef = useRef("en");
  const textCache = useRef(new Map());
  const searchRun = useRef(0);
  const live = useRef({
    page: Math.max(1, parseInt(startCfi, 10) || parseInt(getCfi(book.id), 10) || 1),
    pages: 0,
  });

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
  const [hls, setHls] = useState(() => getHighlights(book.id));
  const [outline, setOutline] = useState([]);
  const [sel, setSel] = useState(null);
  const [dict, setDict] = useState(null);
  const [jump, setJump] = useState("");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState({ busy: false, results: null, scanned: 0, full: false });

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
      // Annullare non basta: finche' il disegno precedente non ha davvero
      // mollato la tela, pdf.js rifiuta il successivo. Il gettone scarta i
      // ridisegni scavalcati mentre si aspettava.
      const token = ++renderToken.current;
      try {
        const prev = renderTask.current;
        if (prev) {
          prev.cancel();
          await prev.promise.catch(() => {});
        }
        textLayer.current?.cancel?.();
        if (renderToken.current !== token) return;
        const p = await pdf.getPage(pageNum);
        if (renderToken.current !== token) return;
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
        if (layer && mod && renderToken.current === token) {
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
      searchRun.current++;
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

  useEffect(() => {
    if (status !== "ready") return;
    const id = requestAnimationFrame(() => renderPage(live.current.page, zoom));
    return () => cancelAnimationFrame(id);
  }, [status, zoom, renderPage]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") (panel ? setPanel(null) : handleClose());
      if (e.key === "ArrowRight") goToPage(live.current.page + 1);
      if (e.key === "ArrowLeft") goToPage(live.current.page - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel, handleClose, goToPage]);

  // chiuso il pannello, sfogliare il resto del tomo non serve piu' a nessuno
  useEffect(() => {
    if (panel !== "search") searchRun.current++;
  }, [panel]);

  function updateSettings(patch) {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveReaderSettings(next);
  }

  // i rettangoli vanno presi adesso: al primo tocco sul menu la selezione
  // non c'e' piu' e con lei sparirebbe la posizione del passaggio
  function readSelection() {
    const s = window.getSelection();
    const text = (s?.toString() || "").trim();
    if (!text || !s.rangeCount || !pageBoxRef.current) return setSel(null);
    const rects = toPageRects(s.getRangeAt(0).getClientRects(), pageBoxRef.current.getBoundingClientRect());
    setSel({ text, rects, context: contextAround(s) });
  }

  function clearSelection() {
    window.getSelection()?.removeAllRanges();
    setSel(null);
  }

  function applyHighlight(color) {
    if (!sel?.rects.length) return;
    const h = {
      id: crypto.randomUUID(),
      cfi: String(live.current.page),
      text: sel.text.slice(0, 400),
      color,
      rects: sel.rects,
      createdAt: Date.now(),
    };
    const next = [...hls, h];
    setHls(next);
    saveHighlights(book.id, next);
    clearSelection();
  }

  function saveHls(next) {
    setHls(next);
    saveHighlights(book.id, next);
  }

  async function runSearch() {
    const q = query.trim();
    if (!q || !pdfRef.current) return;
    const run = ++searchRun.current;
    setSearch({ busy: true, results: [], scanned: 0, full: false });
    const out = await searchPdf(pdfRef.current, q, {
      cache: textCache.current,
      from: live.current.page,
      alive: () => searchRun.current === run,
      // ridisegnare a ogni pagina di un tomo lungo costa piu' della ricerca:
      // si aggiorna quando c'e' qualcosa di nuovo da mostrare
      onPage: (scanned, results) => {
        if (searchRun.current !== run) return;
        setSearch((s) =>
          results.length > (s.results?.length || 0) || scanned % 24 === 0
            ? { busy: true, results: [...results], scanned, full: false }
            : s
        );
      },
    });
    if (searchRun.current === run) {
      setSearch({ busy: false, results: out.results, scanned: out.scanned, full: out.full });
    }
  }

  // come nel reader EPUB: prima il glossario di casa, che risponde anche
  // offline, poi il dizionario in rete se la selezione e' corta abbastanza
  async function defineSelection() {
    const raw = sel?.text || "";
    const context = sel?.context || "";
    const word = cleanWord(raw);
    if (!word) return;
    setSel(null);
    setDict({ word, raw, context, loading: true, entries: [] });
    setPanel("dict");
    const local = await explain(raw, book);
    setDict((d) => (d ? { ...d, ...local } : d));
    if (wordCount(raw) > NET_WORDS) {
      setDict((d) => (d ? { ...d, loading: false } : d));
      return;
    }
    const res = await (wordCount(raw) > 1
      ? lookupPhrase(raw, langRef.current)
      : lookup(word, langRef.current));
    setDict({
      ...local,
      word: res.word || word,
      raw,
      context,
      loading: false,
      entries: res.entries,
      translation: res.translation,
      foreign: res.foreign,
      offline: res.offline,
      machine: res.machine,
      idiom: res.idiom,
      frase: wordCount(raw) > 1,
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

  // il margine attorno al foglio non e' terra di nessuno: vale come il bordo
  // della pagina. Qui arrivano solo i tocchi sullo sfondo — barre, pannelli e
  // menu sono altri elementi, o ogni loro bottone avrebbe voltato pagina.
  function tapAside(e) {
    if (!isTouch() || e.target !== rootRef.current) return;
    if (zoom === 1) {
      const rel = e.clientX / (window.innerWidth || 1);
      if (rel < TAP_PREV) return goToPage(live.current.page - 1);
      if (rel > TAP_NEXT) return goToPage(live.current.page + 1);
    }
    setChrome((v) => !v);
  }

  const pct = pages > 0 ? Math.round((page / pages) * 100) : 0;
  const edge = "clamp(3px, 0.9vw, 10px)";
  const pageHls = hls.filter((h) => pageOf(h) === page && h.rects?.length);

  return (
    <div
      ref={rootRef}
      onClick={tapAside}
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
            const rel = e.clientX / (window.innerWidth || 1);
            if (rel < TAP_PREV) return goToPage(live.current.page - 1);
            if (rel > TAP_NEXT) return goToPage(live.current.page + 1);
          }
          setChrome((v) => !v);
        }}
        style={{
          position: "absolute",
          left: edge,
          right: edge,
          // il foglio non cambia mai misura: le barre compaiono sopra la
          // fascia sempre lasciata libera a testa e piede, cosi' la pagina
          // non viene ridisegnata e non balla sotto le dita
          top: 59,
          bottom: "calc(69px + env(safe-area-inset-bottom))",
          overflow: "auto",
          display: "flex",
          alignItems: zoom > 1 ? "flex-start" : "center",
          justifyContent: zoom > 1 ? "flex-start" : "center",
        }}
      >
        <div ref={pageBoxRef} style={{ position: "relative", flexShrink: 0, boxShadow: "0 4px 30px #00000088" }}>
          <canvas ref={canvasRef} style={{ display: "block" }} />
          {/* sotto il livello testo: sopra, ruberebbe la selezione proprio
              dove si e' gia' evidenziato */}
          <div style={{ position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none" }}>
            {pageHls.map((h) =>
              h.rects.map((r, i) => (
                <div
                  key={`${h.id}-${i}`}
                  style={{
                    position: "absolute",
                    ...rectStyle(r),
                    background: h.color,
                    opacity: 0.36,
                    mixBlendMode: "multiply",
                    borderRadius: 2,
                  }}
                />
              ))
            )}
          </div>
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
          {sel.rects.length > 0 &&
            HL_COLORS.map((c) => (
              <button
                key={c.id}
                onClick={() => applyHighlight(c.value)}
                aria-label={`Evidenzia in ${c.label}`}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: c.value,
                  border: `2px solid ${C.bg}`,
                  boxShadow: `0 0 8px ${c.value}88`,
                }}
              />
            ))}
          {wordCount(sel.text) <= PHRASE_WORDS && (
            <button
              onClick={defineSelection}
              style={{
                marginLeft: 4,
                padding: "6px 12px",
                borderRadius: 999,
                border: `1px solid ${C.arcane}88`,
                color: C.arcane,
                fontSize: 14,
                whiteSpace: "nowrap",
              }}
            >
              {wordCount(sel.text) > 1 ? "🔎 Significato" : "📖 Definisci"}
            </button>
          )}
          <button onClick={clearSelection} style={{ fontSize: 14.5, color: C.muted, marginLeft: 4 }}>
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
            <button onClick={() => setPanel(panel === "search" ? null : "search")} style={barBtn(panel === "search")} aria-label="Cerca">
              🔍
            </button>
            <button onClick={() => setPanel(panel === "marks" ? null : "marks")} style={barBtn(panel === "marks")} aria-label="Segnalibri">
              📑
            </button>
            <button onClick={() => setPanel(panel === "hl" ? null : "hl")} style={barBtn(panel === "hl")} aria-label="Evidenziazioni">
              🖍️
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

      {panel === "hl" && (
        <Panel title="Evidenziazioni" onClose={() => setPanel(null)}>
          <HighlightList
            highlights={hls}
            onGoTo={(h) => {
              goToPage(pageOf(h) || 1);
              setPanel(null);
            }}
            onChange={saveHls}
            onRemove={(h) => saveHls(hls.filter((x) => x.id !== h.id))}
            empty="Seleziona un passaggio nella pagina per evidenziarlo: lo ritroverai qui e nel giardino delle citazioni."
          />
        </Panel>
      )}

      {panel === "search" && (
        <Panel title="Cerca nel tomo" onClose={() => setPanel(null)}>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              placeholder="Una parola, un nome, un incantesimo…"
              style={{
                flex: 1,
                padding: "10px 14px",
                borderRadius: 10,
                border: `1px solid ${C.border}`,
                background: C.card,
                color: C.text,
                fontSize: 15,
                outline: "none",
              }}
            />
            <button
              onClick={runSearch}
              style={{ padding: "0 18px", borderRadius: 10, background: `linear-gradient(180deg, ${C.accent}, #b8893a)`, color: "#241c0a", fontWeight: 600 }}
            >
              {search.busy ? "…" : "Cerca"}
            </button>
          </div>
          {search.busy && (
            <p style={{ color: C.muted, marginBottom: 10 }}>
              Sfoglio le pagine… {search.scanned} di {pages}
            </p>
          )}
          {!search.busy && search.results?.length === 0 && (
            <p style={{ color: C.muted }}>Nessuna traccia di «{query}» in questo tomo.</p>
          )}
          {search.full && (
            <p style={{ color: C.muted, fontSize: 13, marginBottom: 8 }}>
              Primi {search.results.length} passaggi: affina la ricerca per vedere gli altri.
            </p>
          )}
          {search.results?.map((r, i) => (
            <button
              key={`${r.page}-${i}`}
              onClick={() => {
                goToPage(r.page);
                setPanel(null);
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "10px 6px",
                fontSize: 14.5,
                color: C.text,
                lineHeight: 1.4,
                borderBottom: `1px solid ${C.border}44`,
              }}
            >
              <span style={{ display: "block", fontSize: 12, color: C.muted, marginBottom: 2 }}>pag. {r.page}</span>
              {r.before}
              <mark style={{ background: "transparent", color: C.accent, fontWeight: 600 }}>{r.hit}</mark>
              {r.after}
            </button>
          ))}
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
        <DictionaryCard dict={dict} book={book} bottom={chrome ? 92 : 26} onClose={() => setPanel(null)} />
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
