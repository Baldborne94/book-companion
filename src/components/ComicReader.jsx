import { useCallback, useEffect, useRef, useState } from "react";
import { C, FONT_TITLE, F, R, px } from "../data/constants.js";
import TastoBarra, { barBtn, useNomiNeiTasti, useDueRighe, BarraDelLibro, MusicaInBarra } from "./TastoBarra.jsx";
import { ensureLocalFile } from "../lib/sync.js";
import { getCfi, setCfi, getMarks, saveMarks } from "../lib/annotations.js";
import { setProgress, setStatus } from "../lib/library.js";
import { loadReaderSettings, saveReaderSettings } from "../lib/readerSettings.js";
import { apriFumetto, misuraBordi } from "../lib/archivioFumetto.js";
import {
  paginaDaAprire,
  tocco,
  leggiVerso,
  scriviVerso,
  leggiAdatta,
  scriviAdatta,
  tipoImmagine,
  bordiDaMisure,
  disegnaPagina,
  leggiBordi,
  scriviBordi,
} from "../lib/fumetto.js";
import { vuoto } from "../lib/pdfCrop.js";
import { doppioTocco, limita, zoomAttorno } from "../lib/tavola.js";
import { apertaATuttoSchermo, serveTastoSchermo } from "../lib/schermoIntero.js";
import BookCover from "./BookCover.jsx";

// IL LETTORE DEI FUMETTI (CBZ e CBR): una pagina e' un'immagine, e il
// lavoro e' tutto nel gesto — voltare, avvicinarsi, e il VERSO, perche' un
// manga si legge da destra. Le decisioni che sbagliano in silenzio (quale
// formato, l'ordine delle pagine, cosa fa un tocco a sinistra in un manga)
// stanno in `lib/fumetto.js`; lo zoom e' quello della tavola
// (`lib/tavola.js`), che il gesto lo conosce gia'.
//
// LE PAGINE SI ESTRAGGONO UNA PER VOLTA e si tengono come object URL per
// quella aperta e le sue vicine, revocando le altre: un volume da trecento
// pagine decodificato tutto insieme e' il modo piu' rapido di farsi
// chiudere la scheda su un tablet (lezione 11: i byte si persistono, gli
// object URL no — qui vivono quanto la lettura).

const isTouch = () => navigator.maxTouchPoints > 0;
const MOSSA = 12;
const PRESSIONE = 500;
const DOPPIO = 300;
const SCORSA = 60;
// quante pagine tenere pronte attorno a quella aperta
const VICINE = 2;

function Panel({ title, onClose, children }) {
  return (
    <div
      onClick={onClose}
      style={{ position: "absolute", inset: 0, zIndex: 30, background: "#00000066", display: "flex", justifyContent: "flex-end" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: `min(92%, ${px(360)}px)`,
          height: "100%",
          overflowY: "auto",
          padding: "14px 16px calc(14px + env(safe-area-inset-bottom))",
          background: C.surface,
          borderLeft: `1px solid ${C.border}`,
          boxShadow: "-10px 0 40px #00000088",
          animation: "bc-fade-in 0.2s ease-out",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ fontFamily: FONT_TITLE, fontSize: F.rilievo, fontWeight: 600, color: C.text }}>{title}</span>
          <button onClick={onClose} style={barBtn(false)} aria-label="Chiudi il pannello">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function ComicReader({ book, startCfi, music, onMusicToggle, onMusicStop, onMusicVolume, onMusicNext, onMusicRoom, onAlive, onClose, notify, nextBook, onReadNext, indietro }) {
  const rootRef = useRef(null);
  const boxRef = useRef(null);
  const imgRef = useRef(null);
  const archivio = useRef(null);
  const urls = useRef(new Map());
  const inArrivo = useRef(new Map());
  const gettone = useRef(0);
  const live = useRef({ page: 1, pages: 0 });
  const st = useRef({ s: 1, x: 0, y: 0 });
  const dita = useRef(new Map());
  const pizzico = useRef(null);
  const partenza = useRef(null);
  const ultimoTocco = useRef(null);
  const attesaBarre = useRef(null);
  const primoGiro = useRef(true);

  const [settings, setSettings] = useState(() => loadReaderSettings(Math.min(window.innerWidth, window.innerHeight)));
  const [status, setStatusUi] = useState("loading");
  const [chrome, setChrome] = useState(() => !isTouch());
  const [panel, setPanel] = useState(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [src, setSrc] = useState(null);
  const [verso, setVerso] = useState(() => leggiVerso(book.id, book.verso));
  const [adatta, setAdatta] = useState(() => leggiAdatta());
  // I BORDI DELLA SCANSIONE (`lib/fumetto.js`): misurati una volta per
  // libro alla prima apertura, sotto la candela, e poi letti dal
  // dispositivo. `null` = non ancora misurati.
  const [bordi, setBordi] = useState(() => leggiBordi(book.id));
  // la misura del file aperto e quella del riquadro: il disegno della
  // pagina (`disegnaPagina`) e' aritmetica su questi due
  const [nat, setNat] = useState(null);
  const [riquadro, setRiquadro] = useState(null);
  const [isFs, setIsFs] = useState(false);
  const [marks, setMarks] = useState(() => getMarks(book.id));
  const [endCard, setEndCard] = useState(null);
  const [jump, setJump] = useState("");
  const nomiNeiTasti = useNomiNeiTasti();
  const dueRighe = useDueRighe();
  // quanto e' alta la barra in cima: il pannello della luce le sta sotto
  const [altezzaBarra, setAltezzaBarra] = useState(0);

  const flush = useCallback(() => {
    const s = live.current;
    if (s.pages > 0) {
      setCfi(book.id, String(s.page));
      setProgress(book.id, s.page / s.pages);
    }
  }, [book.id]);

  const handleClose = useCallback(() => {
    flush();
    if (live.current.pages > 0 && live.current.page / live.current.pages >= 0.97) setStatus(book.id, "read");
    onClose();
  }, [book.id, flush, onClose]);

  const goToPage = useCallback((n) => {
    const max = live.current.pages || 1;
    setPage(Math.min(max, Math.max(1, n)));
  }, []);

  // avanti e indietro nel senso della LETTURA, non dello schermo
  const avanti = useCallback(() => goToPage(live.current.page + 1), [goToPage]);
  const indietroDiUna = useCallback(() => goToPage(live.current.page - 1), [goToPage]);

  // l'object URL di una pagina, estratta se non e' gia' pronta
  const urlDi = useCallback(async (n) => {
    const a = archivio.current;
    if (!a || n < 1 || n > a.pagine.length) return null;
    if (urls.current.has(n)) return urls.current.get(n);
    if (!inArrivo.current.has(n)) {
      inArrivo.current.set(
        n,
        (async () => {
          const bytes = await a.leggi(n - 1);
          const blob = new Blob([bytes], { type: tipoImmagine(a.pagine[n - 1]) || "image/jpeg" });
          const url = URL.createObjectURL(blob);
          urls.current.set(n, url);
          inArrivo.current.delete(n);
          return url;
        })().catch((e) => {
          inArrivo.current.delete(n);
          throw e;
        })
      );
    }
    return inArrivo.current.get(n);
  }, []);

  // le pagine lontane si lasciano andare: l'immagine resta nell'archivio,
  // da dove si riestrae in un attimo
  const sfoltisci = useCallback((attorno) => {
    for (const [n, url] of urls.current) {
      if (Math.abs(n - attorno) > VICINE) {
        URL.revokeObjectURL(url);
        urls.current.delete(n);
      }
    }
  }, []);

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const blob = await ensureLocalFile(book);
        if (!blob) throw new Error("file mancante");
        const a = await apriFumetto(blob);
        if (dead) return;
        if (!a.pagine.length) throw new Error("nessuna pagina");
        archivio.current = a;
        const n = a.pagine.length;
        live.current.pages = n;
        live.current.page = paginaDaAprire(startCfi, getCfi(book.id), n);
        setPages(n);
        setPage(live.current.page);
        // i bordi si misurano PRIMA di mostrare la prima pagina, cosi' la
        // tavola compare gia' della misura giusta invece di assestarsi
        // sotto gli occhi — una volta nella vita del libro
        if (leggiBordi(book.id) === null) {
          const misure = await misuraBordi(a);
          if (dead) return;
          const b = bordiDaMisure(misure);
          // una misura che non ha guardato nessuna pagina non si scrive:
          // si riprova alla prossima apertura
          if (misure.some(Boolean)) scriviBordi(book.id, b);
          setBordi(b);
        }
        setStatusUi("ready");
      } catch {
        if (!dead) setStatusUi("error");
      }
    })();
    return () => {
      dead = true;
      for (const url of urls.current.values()) URL.revokeObjectURL(url);
      urls.current.clear();
      archivio.current?.chiudi?.();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (status !== "ready") return;
    live.current.page = page;
    const mio = ++gettone.current;
    applica({ s: 1, x: 0, y: 0 });
    if (boxRef.current) boxRef.current.scrollTop = 0;
    urlDi(page)
      .then((url) => {
        if (gettone.current !== mio) return;
        setSrc(url);
        sfoltisci(page);
        // le vicine si preparano DOPO quella che si guarda, nel verso in
        // cui si legge: la prossima per prima
        urlDi(page + 1).catch(() => {});
        urlDi(page - 1).catch(() => {});
      })
      .catch(() => {
        if (gettone.current === mio) notify?.("Questa pagina non si lascia aprire");
      });
    flush();
    if (pages > 0 && page === pages) {
      setStatus(book.id, "read");
      setEndCard((v) => (v === null ? "shown" : v));
    }
    // una voltata e' la prova che qualcuno sta leggendo: lo schermo resta
    // sveglio e il tempo di lettura si conta da qui
    if (primoGiro.current) primoGiro.current = false;
    else onAlive?.();
  }, [status, page, pages, book.id, urlDi, sfoltisci, flush]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onFs = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else rootRef.current?.requestFullscreen?.().catch(() => notify("Schermo intero non disponibile qui"));
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") (panel ? setPanel(null) : handleClose());
      // le frecce seguono lo SCHERMO: in un manga la freccia a sinistra
      // porta alla pagina dopo, che sta a sinistra
      if (e.key === "ArrowRight") (verso === "rtl" ? indietroDiUna : avanti)();
      if (e.key === "ArrowLeft") (verso === "rtl" ? avanti : indietroDiUna)();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel, handleClose, avanti, indietroDiUna, verso]);

  // il tasto indietro del dispositivo: prima il pannello, poi il libro,
  // dalla porta di sempre — e' li' che la pagina si salva
  useEffect(() => {
    if (!indietro) return;
    indietro.current = () => {
      if (panel) { setPanel(null); return true; }
      handleClose();
      return false;
    };
    return () => { indietro.current = null; };
  }, [indietro, panel, handleClose]);

  useEffect(() => {
    const riassesta = () => {
      const m = misure();
      if (m) applica(limita(st.current, m.foglio, m.riquadro));
    };
    window.addEventListener("resize", riassesta);
    return () => window.removeEventListener("resize", riassesta);
  }, []);

  // il riquadro si misura da se': ruotando il tablet o entrando a schermo
  // intero cambia lui, e la pagina si ridisegna sulla sua misura nuova
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const misura = () => setRiquadro({ w: el.clientWidth, h: el.clientHeight });
    misura();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", misura);
      return () => window.removeEventListener("resize", misura);
    }
    const ro = new ResizeObserver(misura);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function updateSettings(patch) {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveReaderSettings(next);
  }

  function cambiaVerso() {
    const v = verso === "rtl" ? "ltr" : "rtl";
    setVerso(v);
    scriviVerso(book.id, v);
    notify?.(v === "rtl" ? "Si legge da destra a sinistra, come un manga" : "Si legge da sinistra a destra");
  }

  function cambiaAdatta() {
    const v = adatta === "intera" ? "larghezza" : "intera";
    setAdatta(v);
    scriviAdatta(v);
    applica({ s: 1, x: 0, y: 0 });
  }

  function addMark() {
    const m = { id: crypto.randomUUID(), cfi: String(live.current.page), label: `pag. ${live.current.page}`, createdAt: Date.now() };
    const next = [...marks, m];
    setMarks(next);
    saveMarks(book.id, next);
    notify?.("Segnalibro riposto tra le pagine 📑");
  }

  function removeMark(m) {
    const next = marks.filter((x) => x.id !== m.id);
    setMarks(next);
    saveMarks(book.id, next);
  }

  // ---- il gesto: lo stesso della tavola, piu' il tocco e la scorsa ------
  const misure = () => {
    const b = boxRef.current;
    const i = imgRef.current;
    if (!b || !i) return null;
    return {
      foglio: { w: i.offsetWidth, h: i.offsetHeight },
      riquadro: { w: b.clientWidth, h: b.clientHeight },
      rect: b.getBoundingClientRect(),
    };
  };
  const applica = (nuovo) => {
    st.current = nuovo;
    if (imgRef.current) imgRef.current.style.transform = `translate(${nuovo.x}px, ${nuovo.y}px) scale(${nuovo.s})`;
  };
  const dalCentro = (m, cx, cy) => ({ x: cx - (m.rect.left + m.rect.width / 2), y: cy - (m.rect.top + m.rect.height / 2) });
  const intera = adatta === "intera";

  const giu = (e) => {
    if (e.target.closest("button, input, a")) return;
    if (intera) {
      try { boxRef.current?.setPointerCapture(e.pointerId); } catch { /* puntatore gia' andato */ }
    }
    dita.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (dita.current.size === 1) {
      partenza.current = { x: e.clientX, y: e.clientY, quando: Date.now(), mosso: false };
    } else {
      partenza.current = null;
    }
    if (dita.current.size === 2 && intera) {
      const [a, b] = [...dita.current.values()];
      pizzico.current = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, mezzo: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, st: st.current };
    }
  };

  const muovi = (e) => {
    if (!dita.current.has(e.pointerId)) return;
    const prima = dita.current.get(e.pointerId);
    dita.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const p = partenza.current;
    if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > MOSSA) p.mosso = true;
    if (!intera) return;
    const m = misure();
    if (!m) return;
    if (dita.current.size === 2 && pizzico.current) {
      const [a, b] = [...dita.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mezzo = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const c = dalCentro(m, mezzo.x, mezzo.y);
      const c0 = dalCentro(m, pizzico.current.mezzo.x, pizzico.current.mezzo.y);
      const base = pizzico.current.st;
      const scala = base.s * (dist / pizzico.current.dist);
      const spostato = { ...base, x: base.x + (c.x - c0.x), y: base.y + (c.y - c0.y) };
      applica(zoomAttorno(spostato, scala, c.x, c.y, m.foglio, m.riquadro));
      return;
    }
    if (dita.current.size === 1 && st.current.s > 1.01) {
      applica(limita({ ...st.current, x: st.current.x + (e.clientX - prima.x), y: st.current.y + (e.clientY - prima.y) }, m.foglio, m.riquadro));
    }
  };

  const su = (e) => {
    if (!dita.current.has(e.pointerId)) return;
    dita.current.delete(e.pointerId);
    const p = partenza.current;
    if (dita.current.size > 0) {
      pizzico.current = null;
      partenza.current = null;
      return;
    }
    pizzico.current = null;
    partenza.current = null;
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    const durata = Date.now() - p.quando;
    // LA SCORSA VOLTA PAGINA, nel verso della lettura: a pagina intera e
    // senza zoom, un dito che scorre a sinistra porta alla pagina dopo (o
    // a quella prima, in un manga)
    if (intera && st.current.s <= 1.01 && Math.abs(dx) > SCORSA && Math.abs(dx) > 2 * Math.abs(dy)) {
      const versoSinistra = dx < 0;
      (versoSinistra === (verso !== "rtl") ? avanti : indietroDiUna)();
      return;
    }
    if (p.mosso || durata > PRESSIONE) return;
    // il doppio tocco: da intera si avvicina al punto toccato, da vicino
    // torna intera — qualunque sia la scala
    const u = ultimoTocco.current;
    ultimoTocco.current = { x: e.clientX, y: e.clientY, quando: Date.now() };
    if (intera && u && Date.now() - u.quando < DOPPIO && Math.hypot(e.clientX - u.x, e.clientY - u.y) < 24) {
      // il primo tocco della coppia aveva messo in attesa le barre: il
      // secondo dice che era uno zoom, e le barre non si toccano
      clearTimeout(attesaBarre.current);
      ultimoTocco.current = null;
      const m = misure();
      if (m) {
        const c = dalCentro(m, e.clientX, e.clientY);
        applica(doppioTocco(st.current, c.x, c.y, m.foglio, m.riquadro));
      }
      return;
    }
    // da vicino il tocco non volta: si sta guardando
    if (st.current.s > 1.01) return;
    const rel = e.pointerType === "mouse" ? null : e.clientX / (window.innerWidth || 1);
    const cosa = tocco(rel, verso);
    // LA VOLTATA E' SUBITO, LE BARRE ASPETTANO UN SOFFIO. Il doppio tocco
    // e' due tocchi, e il primo dei due arrivava qui come un tocco
    // qualunque: al centro accendeva le barre (e il secondo zoomava con
    // le barre accese), ai bordi voltava pagina e lo zoom finiva sulla
    // pagina dopo — preso dal banco, non dal video. Una voltata non puo'
    // aspettare trecento millisecondi per sapere se ne arriva un altro,
    // quindi ai bordi si volta e basta e il doppio tocco li' non esiste
    // (`ultimoTocco` azzerato); le barre invece un soffio lo reggono, e
    // aspettano `DOPPIO` — se nel frattempo arriva il secondo tocco, era
    // uno zoom.
    if (cosa === "next" || cosa === "prev") {
      ultimoTocco.current = null;
      (cosa === "next" ? avanti : indietroDiUna)();
      return;
    }
    clearTimeout(attesaBarre.current);
    attesaBarre.current = setTimeout(() => setChrome((c) => !c), DOPPIO);
  };

  const pct = pages ? Math.round((page / pages) * 100) : 0;
  const nomePagina = archivio.current?.pagine?.[page - 1] || "";
  // la levetta e' quella del PDF («Togli i margini»), condivisa in
  // `bc_reader`: spenta, la scansione si vede com'e', bordo compreso
  const disegno = disegnaPagina({ nat, riquadro, bordi: settings.ritaglia !== false ? bordi : null, modo: adatta });

  return (
    <div
      ref={rootRef}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 45,
        background: "#0b0a10",
        color: C.text,
        overflow: "hidden",
        userSelect: "none",
      }}
    >
      <div
        ref={boxRef}
        onPointerDown={giu}
        onPointerMove={muovi}
        onPointerUp={su}
        onPointerCancel={su}
        onWheel={(e) => {
          if (intera) (e.deltaY > 0 ? avanti : indietroDiUna)();
        }}
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: intera ? "center" : "flex-start",
          justifyContent: "center",
          overflowY: intera ? "hidden" : "auto",
          overflowX: "hidden",
          touchAction: intera ? "none" : "pan-y",
          cursor: "pointer",
        }}
      >
        {/* IL FOGLIO E' LA TAVOLA SENZA I BORDI DELLA SCANSIONE: un
            riquadro che ritaglia, e dentro l'immagine intera spostata di
            quanto basta a lasciare fuori la cornice. E' il foglio che lo
            zoom misura e trasforma (`imgRef`), non l'immagine. Finche' non
            si sa quanto e' grande il file (`onLoad`) il foglio resta
            invisibile: un fotogramma a misura sbagliata e' peggio di uno
            vuoto. */}
        {src && (
          <div
            ref={imgRef}
            style={{
              position: "relative",
              overflow: "hidden",
              flexShrink: 0,
              transformOrigin: "center",
              willChange: "transform",
              width: disegno?.foglio.w,
              height: disegno?.foglio.h,
              visibility: disegno ? "visible" : "hidden",
            }}
          >
            <img
              src={src}
              alt={nomePagina}
              draggable={false}
              onLoad={(e) => setNat({ w: e.target.naturalWidth, h: e.target.naturalHeight })}
              style={{
                position: "absolute",
                display: "block",
                maxWidth: "none",
                left: disegno?.immagine.x,
                top: disegno?.immagine.y,
                width: disegno?.immagine.w,
                height: disegno?.immagine.h,
              }}
            />
          </div>
        )}
      </div>

      {/* la luce si abbassa con lo stesso velo del PDF: e' la luminosita'
          delle preferenze di lettura, una per tutti i libri */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 5, background: "#000", opacity: 1 - settings.brightness }} />

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
          <span style={{ fontFamily: FONT_TITLE, fontSize: F.rilievo }}>Apro il tomo…</span>
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
            Questo fumetto non si lascia aprire… l'archivio potrebbe essere danneggiato o senza immagini
            dentro, oppure è nel cloud e ora sei offline.
          </span>
          <button onClick={handleClose} style={{ padding: "10px 22px", borderRadius: R.piccolo, border: `1px solid ${C.border}`, color: C.muted }}>
            Torna alla Libreria
          </button>
        </div>
      )}

      {chrome && (
        <>
          <BarraDelLibro
            titolo={book.title}
            onClose={handleClose}
            conNome={nomiNeiTasti}
            dueRighe={dueRighe}
            onAltezza={setAltezzaBarra}
            musica={<MusicaInBarra music={music} onMusicToggle={onMusicToggle} onMusicNext={onMusicNext} onMusicVolume={onMusicVolume} onMusicStop={onMusicStop} onMusicRoom={onMusicRoom} onClose={handleClose} />}
            tasti={
              <>
                {/* IL VERSO: un manga si legge da destra, e il tasto lo dice
                    col glifo — la freccia punta dove sta la pagina dopo */}
                <TastoBarra onClick={cambiaVerso} attivo={verso === "rtl"} conNome={nomiNeiTasti} nome="Verso" glifo={verso === "rtl" ? "⇦" : "⇨"} />
                <TastoBarra onClick={cambiaAdatta} attivo={!intera} conNome={nomiNeiTasti} nome="Adatta" glifo="⤢" />
                <TastoBarra
                  onClick={() => setPanel(panel === "marks" ? null : "marks")}
                  attivo={panel === "marks"}
                  conNome={nomiNeiTasti}
                  nome="Segnalibri"
                  glifo="📑"
                />
                {serveTastoSchermo({ abilitato: document.fullscreenEnabled, giaTuttoSchermo: apertaATuttoSchermo() }) && (
                  <TastoBarra onClick={toggleFullscreen} attivo={isFs} conNome={nomiNeiTasti} nome={isFs ? "Esci" : "Schermo"} glifo="⛶" />
                )}
              </>
            }
            // 🌙 apre la luce E il ritaglio dei bordi: sta in coda come la
            // «Notte» del PDF
            coda={
              <TastoBarra
                onClick={() => setPanel(panel === "luce" ? null : "luce")}
                attivo={panel === "luce"}
                conNome={nomiNeiTasti}
                nome="Luce"
                glifo="🌙"
                stile={{ fontSize: F.rilievo }}
              />
            }
          />

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
              aria-label="Pagina"
              style={{ width: "100%", accentColor: C.accent, direction: verso === "rtl" ? "rtl" : "ltr" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: F.minuscolo, color: C.muted, marginTop: 2 }}>
              <span>{pct}%</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "0 10px" }}>
                {verso === "rtl" ? "⇦ da destra a sinistra" : ""}
              </span>
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
                    borderRadius: R.piccolo,
                    border: `1px solid ${C.border}`,
                    background: C.card,
                    color: C.text,
                    fontSize: F.minuscolo,
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

      {panel === "luce" && (
        <div
          style={{
            position: "absolute",
            right: 10,
            top: altezzaBarra + px(6),
            zIndex: 30,
            width: `min(92%, ${px(260)}px)`,
            padding: 16,
            borderRadius: R.medio,
            border: `1px solid ${C.border}`,
            background: `${C.surface}fa`,
            boxShadow: "0 10px 40px #00000088",
            animation: "bc-fade-in 0.2s ease-out",
          }}
        >
          <div style={{ fontSize: F.nota, color: C.muted, marginBottom: 4 }}>Luminosità</div>
          <input
            type="range"
            min={0.4}
            max={1}
            step={0.05}
            value={settings.brightness}
            onChange={(e) => updateSettings({ brightness: parseFloat(e.target.value) })}
            aria-label="Luminosità"
            style={{ width: "100%", accentColor: C.accent }}
          />
          <div style={{ fontSize: F.minuscolo, color: C.muted, marginTop: 8, lineHeight: 1.45 }}>
            {intera ? "Pagina intera: due dita o un doppio tocco per avvicinarti." : "Larga quanto lo schermo: scorri in verticale."}
          </div>

          <div style={{ height: 1, background: C.border, margin: "14px 0 12px" }} />
          {/* la stessa levetta del PDF, e la stessa preferenza: la' toglie
              il bianco attorno al testo, qui la cornice della scansione */}
          <button
            onClick={() => updateSettings({ ritaglia: settings.ritaglia === false })}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 10px",
              borderRadius: R.piccolo,
              border: `1px solid ${settings.ritaglia !== false ? C.accent : C.border}`,
              color: settings.ritaglia !== false ? C.accent : C.muted,
              fontSize: F.nota,
              textAlign: "left",
            }}
          >
            <span style={{ fontSize: F.corpo }}>{settings.ritaglia !== false ? "☑" : "☐"}</span>
            <span style={{ flex: 1 }}>Togli i bordi della scansione</span>
          </button>
          <div style={{ fontSize: F.minuscolo, color: C.muted, marginTop: 6, lineHeight: 1.45 }}>
            {bordi === null
              ? "Sto misurando i bordi di questo volume…"
              : vuoto(bordi)
                ? "Queste tavole arrivano già al bordo: non c'è niente da togliere."
                : `Qui se ne va ${Math.round((1 - (bordi.r - bordi.l) * (bordi.b - bordi.t)) * 100)}% di cornice, e la tavola cresce.`}
          </div>
        </div>
      )}

      {panel === "marks" && (
        <Panel title="Segnalibri" onClose={() => setPanel(null)}>
          <button
            onClick={addMark}
            style={{
              width: "100%",
              padding: "11px 0",
              borderRadius: R.piccolo,
              marginBottom: 14,
              background: `linear-gradient(180deg, ${C.accent}, ${C.accentDeep})`,
              color: C.onAccent,
              fontWeight: 600,
              fontSize: F.corpo,
            }}
          >
            📑 Salva qui
          </button>
          {marks.length === 0 ? (
            <p style={{ color: C.muted }}>Nessun segnalibro ancora.</p>
          ) : (
            [...marks]
              .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
              .map((m) => (
                <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, borderBottom: `1px solid ${C.border}44` }}>
                  <button
                    onClick={() => {
                      goToPage(parseInt(m.cfi, 10) || 1);
                      setPanel(null);
                    }}
                    style={{ flex: 1, textAlign: "left", padding: "11px 6px", fontSize: F.corpo, color: C.text }}
                  >
                    {m.label}
                    <span style={{ display: "block", fontSize: F.minuscolo, color: C.muted }}>
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

      {endCard === "shown" && nextBook && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            bottom: chrome ? px(96) : px(30),
            zIndex: 32,
            width: `min(94%, ${px(440)}px)`,
            display: "flex",
            gap: 14,
            alignItems: "center",
            padding: "13px 16px",
            borderRadius: R.medio,
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
            <div style={{ fontSize: F.minuscolo, color: C.muted }}>Fine del volume — il prossimo della saga</div>
            <div style={{ fontFamily: FONT_TITLE, fontWeight: 600, fontSize: F.rilievo, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {nextBook.title}
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: 5 }}>
              <button
                onClick={() => {
                  flush();
                  onReadNext(nextBook.id);
                }}
                style={{ fontSize: F.nota, fontWeight: 600, color: C.accent }}
              >
                Leggilo ora
              </button>
              <button onClick={() => setEndCard("dismissed")} style={{ fontSize: F.nota, color: C.muted }}>
                Più tardi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
