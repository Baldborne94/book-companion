import { useEffect, useRef, useState } from "react";
import { C, F, R, px } from "../data/constants.js";
import { doppioTocco, limita, zoomAttorno } from "../lib/tavola.js";

// LA TAVOLA A TUTTO SCHERMO: una mappa o un'illustrazione del libro, da
// guardare da vicino. Le regole che sbagliano in silenzio (quale tocco e'
// per un'immagine, fin dove si sposta il foglio) stanno in `lib/tavola.js`;
// qui c'e' solo il gesto.
//
// **IL MOVIMENTO NON PASSA DA REACT**: a ogni `pointermove` si scrive il
// `transform` sull'elemento, e solo quello (lezione 10: `transform`, mai
// `width`/`left`). Uno stato React a ogni spostamento del dito ridisegnerebbe
// il componente sessanta volte al secondo per muovere un'immagine.
//
// **I TOCCHI NON ESCONO DI QUI**: il reader sotto ha il suo `onClick` e i
// suoi `onTouch*` sul contenitore (voltata, barre), e un pizzico sulla
// mappa non deve voltare la pagina che c'e' dietro.

const TOCCO = 12;
const DOPPIO = 300;

export default function Tavola({ src, alt, onClose }) {
  const box = useRef(null);
  const img = useRef(null);
  const st = useRef({ s: 1, x: 0, y: 0 });
  const dita = useRef(new Map());
  const pizzico = useRef(null);
  const partenza = useRef(null);
  const ultimoTocco = useRef(null);
  const [rotta, setRotta] = useState(false);

  const misure = () => {
    const b = box.current;
    const i = img.current;
    if (!b || !i) return null;
    return {
      foglio: { w: i.offsetWidth, h: i.offsetHeight },
      riquadro: { w: b.clientWidth, h: b.clientHeight },
      rect: b.getBoundingClientRect(),
    };
  };

  const applica = (nuovo) => {
    st.current = nuovo;
    if (img.current) img.current.style.transform = `translate(${nuovo.x}px, ${nuovo.y}px) scale(${nuovo.s})`;
  };

  // un punto dello schermo, riportato al centro del riquadro
  const dalCentro = (m, cx, cy) => ({ x: cx - (m.rect.left + m.rect.width / 2), y: cy - (m.rect.top + m.rect.height / 2) });

  useEffect(() => {
    const riassesta = () => {
      const m = misure();
      if (m) applica(limita(st.current, m.foglio, m.riquadro));
    };
    window.addEventListener("resize", riassesta);
    return () => window.removeEventListener("resize", riassesta);
  }, []);

  const giu = (e) => {
    e.stopPropagation();
    try { box.current?.setPointerCapture(e.pointerId); } catch { /* puntatore gia' andato */ }
    dita.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (dita.current.size === 1) {
      partenza.current = { x: e.clientX, y: e.clientY, quando: Date.now(), sulFoglio: e.target === img.current };
    } else {
      partenza.current = null;
    }
    if (dita.current.size === 2) {
      const [a, b] = [...dita.current.values()];
      pizzico.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        mezzo: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        st: st.current,
      };
    }
  };

  const muovi = (e) => {
    e.stopPropagation();
    const prima = dita.current.get(e.pointerId);
    if (!prima) return;
    dita.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const m = misure();
    if (!m) return;
    if (dita.current.size >= 2 && pizzico.current) {
      const [a, b] = [...dita.current.values()];
      const p = pizzico.current;
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mezzo = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const c = dalCentro(m, p.mezzo.x, p.mezzo.y);
      const z = zoomAttorno(p.st, p.st.s * (dist / p.dist), c.x, c.y, m.foglio, m.riquadro);
      applica(limita({ ...z, x: z.x + mezzo.x - p.mezzo.x, y: z.y + mezzo.y - p.mezzo.y }, m.foglio, m.riquadro));
      return;
    }
    if (st.current.s > 1) {
      const cur = st.current;
      applica(limita({ ...cur, x: cur.x + e.clientX - prima.x, y: cur.y + e.clientY - prima.y }, m.foglio, m.riquadro));
    }
  };

  const su = (e) => {
    e.stopPropagation();
    dita.current.delete(e.pointerId);
    if (dita.current.size < 2) pizzico.current = null;
    const p = partenza.current;
    partenza.current = null;
    if (!p || dita.current.size) return;
    if (Math.abs(e.clientX - p.x) > TOCCO || Math.abs(e.clientY - p.y) > TOCCO) return;
    if (!p.sulFoglio) {
      // sul nero attorno alla tavola: si torna al libro, ma solo a foglio
      // intero — da vicino il nero e' dove finisce il dito spostando la mappa
      if (st.current.s <= 1.01) onClose();
      return;
    }
    const prec = ultimoTocco.current;
    const ora = Date.now();
    if (prec && ora - prec.quando < DOPPIO && Math.hypot(e.clientX - prec.x, e.clientY - prec.y) < TOCCO * 3) {
      ultimoTocco.current = null;
      const m = misure();
      if (!m) return;
      const c = dalCentro(m, e.clientX, e.clientY);
      applica(doppioTocco(st.current, c.x, c.y, m.foglio, m.riquadro));
      return;
    }
    ultimoTocco.current = { x: e.clientX, y: e.clientY, quando: ora };
  };

  const rotella = (e) => {
    e.stopPropagation();
    const m = misure();
    if (!m) return;
    const c = dalCentro(m, e.clientX, e.clientY);
    applica(zoomAttorno(st.current, st.current.s * Math.exp(-e.deltaY * 0.002), c.x, c.y, m.foglio, m.riquadro));
  };

  const ferma = (e) => e.stopPropagation();

  return (
    <div
      role="dialog"
      aria-label={alt || "Immagine del libro"}
      onClick={ferma}
      onTouchStart={ferma}
      onTouchEnd={ferma}
      onWheel={rotella}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 40,
        background: "#07050dee",
        display: "flex",
        flexDirection: "column",
        animation: "bc-fade-in 0.2s ease-out",
      }}
    >
      <div
        ref={box}
        onPointerDown={giu}
        onPointerMove={muovi}
        onPointerUp={su}
        onPointerCancel={su}
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          touchAction: "none",
          padding: 8,
        }}
      >
        {rotta ? (
          <p style={{ color: C.muted, fontSize: F.corpo, textAlign: "center", maxWidth: px(420), lineHeight: 1.5 }}>
            Questa immagine non si lascia mostrare a tutto schermo. Nel libro resta dov'era.
          </p>
        ) : (
          <img
            ref={img}
            src={src}
            alt={alt || ""}
            draggable={false}
            onError={() => setRotta(true)}
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              transformOrigin: "center center",
              willChange: "transform",
              userSelect: "none",
              background: "#fff",
            }}
          />
        )}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "8px 12px",
          borderTop: `1px solid ${C.border}`,
          background: C.surface,
        }}
      >
        <span style={{ flex: 1, minWidth: 0, color: C.muted, fontSize: F.nota, lineHeight: 1.4 }}>
          {alt || "Due dita o un doppio tocco per avvicinarti"}
        </span>
        <button
          onClick={onClose}
          aria-label="Chiudi l'immagine"
          style={{
            minWidth: 44,
            minHeight: 44,
            padding: "0 14px",
            borderRadius: R.piccolo,
            border: `1px solid ${C.border}`,
            color: C.text,
            fontSize: F.corpo,
          }}
        >
          ✕ Torna al libro
        </button>
      </div>
    </div>
  );
}
