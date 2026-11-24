import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { C, FONT_TITLE } from "../data/constants.js";
import { ensureLocalFile } from "../lib/sync.js";
import { getCfi, setCfi } from "../lib/annotations.js";
import { setProgress, setStatus } from "../lib/library.js";
import { openCbz } from "../lib/comic.js";
import { isRtl } from "../lib/nas.js";
import BookCover from "./BookCover.jsx";

const isTouch = () => navigator.maxTouchPoints > 0;
const KEEP = 6;

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

const rtlKey = (id) => `bc_rtl_${id}`;

function readRtl(book) {
  const v = localStorage.getItem(rtlKey(book.id));
  return v === null ? isRtl(book) : v === "1";
}

const wideScreen = () => window.innerWidth > window.innerHeight && window.innerWidth >= 900;

// In doppia pagina la copertina resta sola, come nel volume stampato:
// cosi' le coppie successive cadono sulle facciate giuste.
function buildViews(total, spread) {
  if (!spread) return Array.from({ length: total }, (_, i) => [i]);
  const views = total ? [[0]] : [];
  for (let i = 1; i < total; i += 2) views.push(i + 1 < total ? [i, i + 1] : [i]);
  return views;
}

export default function ComicReader({ book, startCfi, music, onMusicToggle, onMusicStop, onClose, notify, nextBook, onReadNext }) {
  const comicRef = useRef(null);
  const urls = useRef(new Map());
  const pending = useRef(new Map());
  const swipe = useRef(null);
  const live = useRef({
    page: Math.max(0, (parseInt(startCfi, 10) || parseInt(getCfi(book.id), 10) || 1) - 1),
    last: 0,
    pages: 0,
  });

  const [status, setStatusUi] = useState("loading");
  const [chrome, setChrome] = useState(() => !isTouch());
  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(live.current.page);
  const [spread, setSpread] = useState(wideScreen);
  const [rtl, setRtl] = useState(() => readRtl(book));
  const [zoom, setZoom] = useState(1);
  const [endCard, setEndCard] = useState(null);
  const [, setLoadedTick] = useState(0);

  const views = useMemo(() => buildViews(pages, spread), [pages, spread]);
  const viewIdx = Math.max(0, views.findIndex((v) => v.includes(page)));
  const view = views[viewIdx] || [];

  const flush = useCallback(() => {
    const s = live.current;
    if (s.pages > 0) {
      setCfi(book.id, String(s.page + 1));
      setProgress(book.id, (s.last + 1) / s.pages);
    }
  }, [book.id]);

  const handleClose = useCallback(() => {
    flush();
    onClose();
  }, [flush, onClose]);

  const ensureUrl = useCallback(async (i) => {
    const comic = comicRef.current;
    if (!comic || i < 0 || i >= comic.pages.length || urls.current.has(i) || pending.current.has(i)) return;
    const job = comic.page(i).then((blob) => {
      pending.current.delete(i);
      if (blob && comicRef.current === comic) {
        urls.current.set(i, URL.createObjectURL(blob));
        setLoadedTick((t) => t + 1);
      }
    }).catch(() => pending.current.delete(i));
    pending.current.set(i, job);
  }, []);

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const blob = await ensureLocalFile(book);
        if (!blob) throw new Error("file mancante");
        const comic = await openCbz(blob);
        if (dead) return;
        if (!comic.pages.length) throw new Error("nessuna immagine");
        comicRef.current = comic;
        live.current.pages = comic.pages.length;
        live.current.page = Math.min(live.current.page, comic.pages.length - 1);
        setPages(comic.pages.length);
        setPage(live.current.page);
        setStatusUi("ready");
      } catch {
        if (!dead) setStatusUi("error");
      }
    })();

    const onVis = () => {
      if (document.visibilityState === "hidden") flush();
    };
    const onResize = () => setSpread(wideScreen());
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("beforeunload", flush);
    window.addEventListener("resize", onResize);
    const cache = urls.current;
    return () => {
      dead = true;
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("beforeunload", flush);
      window.removeEventListener("resize", onResize);
      flush();
      comicRef.current = null;
      cache.forEach((u) => URL.revokeObjectURL(u));
      cache.clear();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (status !== "ready" || !view.length) return;
    live.current.page = view[0];
    live.current.last = view[view.length - 1];
    flush();
    // la pagina corrente prima, poi le vicine: girare deve essere istantaneo
    view.forEach(ensureUrl);
    (views[viewIdx + 1] || []).forEach(ensureUrl);
    (views[viewIdx - 1] || []).forEach(ensureUrl);
    (views[viewIdx + 2] || []).forEach(ensureUrl);
    urls.current.forEach((u, i) => {
      if (Math.abs(i - view[0]) > KEEP) {
        URL.revokeObjectURL(u);
        urls.current.delete(i);
      }
    });
    if (viewIdx === views.length - 1) {
      setStatus(book.id, "read");
      setEndCard((v) => (v === null ? "shown" : v));
    }
  }, [status, viewIdx, views]); // eslint-disable-line react-hooks/exhaustive-deps

  const step = useCallback(
    (delta) => {
      const target = views[viewIdx + delta];
      if (target) {
        setPage(target[0]);
        setZoom(1);
      }
    },
    [views, viewIdx]
  );

  // a destra si avanza nei fumetti, a sinistra nei manga
  const goLeft = useCallback(() => step(rtl ? 1 : -1), [step, rtl]);
  const goRight = useCallback(() => step(rtl ? -1 : 1), [step, rtl]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowLeft") goLeft();
      else if (e.key === "ArrowRight") goRight();
      else if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goLeft, goRight, handleClose]);

  function toggleRtl() {
    const next = !rtl;
    setRtl(next);
    localStorage.setItem(rtlKey(book.id), next ? "1" : "0");
    notify(next ? "Lettura da destra a sinistra" : "Lettura da sinistra a destra");
  }

  const shown = rtl ? [...view].reverse() : view;
  const pct = pages > 0 ? Math.round(((view[view.length - 1] ?? 0) + 1) / pages * 100) : 0;
  const label = view.length > 1 ? `${view[0] + 1}–${view[1] + 1}` : `${(view[0] ?? 0) + 1}`;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 45,
        background: "#0d0b14",
        animation: "bc-fade-in 0.45s ease-out",
        overflow: "hidden",
      }}
    >
      <div
        onPointerDown={(e) => {
          swipe.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          const s = swipe.current;
          swipe.current = null;
          if (!s || zoom > 1) return;
          const dx = e.clientX - s.x;
          const dy = e.clientY - s.y;
          if (Math.abs(dx) > 60 && Math.abs(dy) < 90) {
            // si trascina la pagina: verso sinistra mostra quella a destra
            if (dx < 0) goRight();
            else goLeft();
            swipe.current = "swiped";
          }
        }}
        onClick={(e) => {
          if (swipe.current === "swiped") {
            swipe.current = null;
            return;
          }
          if (zoom > 1) return setChrome((v) => !v);
          const rel = e.clientX / (window.innerWidth || 1);
          if (rel < 0.3) return goLeft();
          if (rel > 0.7) return goRight();
          setChrome((v) => !v);
        }}
        style={{
          position: "absolute",
          inset: 0,
          overflow: zoom > 1 ? "auto" : "hidden",
          touchAction: zoom > 1 ? "pan-x pan-y" : "pan-y",
        }}
      >
        {status === "loading" && (
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, fontFamily: FONT_TITLE, fontSize: 18 }}>
            🕯️ Apro il volume…
          </div>
        )}
        {status === "error" && (
          <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, color: C.muted, padding: 24, textAlign: "center" }}>
            <span>Non riesco ad aprire questo volume: il file manca o non è un CBZ valido.</span>
            <button onClick={handleClose} style={{ color: C.accent, fontWeight: 600 }}>Torna alla biblioteca</button>
          </div>
        )}
        {status === "ready" && (
          <div
            style={{
              width: `${zoom * 100}%`,
              height: `${zoom * 100}%`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {shown.map((i) => {
              const url = urls.current.get(i);
              return url ? (
                <img
                  key={i}
                  src={url}
                  alt={`Pagina ${i + 1}`}
                  draggable={false}
                  style={{
                    maxWidth: `${100 / shown.length}%`,
                    maxHeight: "100%",
                    objectFit: "contain",
                    userSelect: "none",
                    animation: "bc-fade-in 0.18s ease-out",
                  }}
                />
              ) : (
                <div key={i} style={{ color: C.dim, fontSize: 14, flex: 1, textAlign: "center" }}>…</div>
              );
            })}
          </div>
        )}
      </div>

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
            <button onClick={handleClose} style={barBtn(false)} aria-label="Chiudi il volume">✕</button>
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
              onClick={toggleRtl}
              style={{ ...barBtn(rtl), fontSize: 13, fontWeight: 700, width: 48 }}
              aria-label="Verso di lettura"
            >
              {rtl ? "← 漫" : "→"}
            </button>
            <button
              onClick={() => setSpread((v) => !v)}
              style={{ ...barBtn(spread), fontSize: 17 }}
              aria-label="Doppia pagina"
            >
              📖
            </button>
            <button onClick={() => setZoom((z) => Math.max(1, +(z - 0.5).toFixed(1)))} style={barBtn(false)} aria-label="Riduci zoom">
              −
            </button>
            <button onClick={() => setZoom((z) => Math.min(3, +(z + 0.5).toFixed(1)))} style={barBtn(false)} aria-label="Aumenta zoom">
              ＋
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
              min={0}
              max={Math.max(0, views.length - 1)}
              value={viewIdx}
              onChange={(e) => {
                const v = views[parseInt(e.target.value, 10)];
                if (v) setPage(v[0]);
              }}
              style={{ width: "100%", accentColor: C.accent, direction: rtl ? "rtl" : "ltr" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: C.muted, marginTop: 2 }}>
              <span>{pct}%</span>
              <span>
                Pagina {label} di {pages}
              </span>
            </div>
          </div>
        </>
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
                onClick={(e) => {
                  e.stopPropagation();
                  flush();
                  onReadNext(nextBook.id);
                }}
                style={{ fontSize: 14, fontWeight: 600, color: C.accent }}
              >
                Leggilo ora
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEndCard("dismissed");
                }}
                style={{ fontSize: 14, color: C.muted }}
              >
                Più tardi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
