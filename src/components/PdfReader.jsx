import { useCallback, useEffect, useRef, useState } from "react";
import { C, FONT_TITLE } from "../data/constants.js";
import { ensureLocalFile } from "../lib/sync.js";
import { getCfi, setCfi, getMarks, saveMarks, getHighlights, saveHighlights } from "../lib/annotations.js";
import { getProgress, setProgress, setStatus, getStatus, loadBooks } from "../lib/library.js";
import { schedaChiE, nuoveMenzioni } from "../lib/chiSono.js";
import { schedaRiassunto } from "../lib/trama.js";
import { sembraUnNome } from "../lib/nomi.js";
import { HL_COLORS, loadReaderSettings, saveReaderSettings } from "../lib/readerSettings.js";
import { lookup, lookupPhrase, wordCount, cleanWord } from "../lib/dictionary.js";
import { explain } from "../lib/glossary.js";
import { contextAround } from "../lib/oracle.js";
import { toPageRects, rectStyle, pageOf } from "../lib/pdfHighlights.js";
import { searchPdf, normalizeWithMap } from "../lib/pdfSearch.js";
import { TUTTA, getCrop, saveCrop, misuraLibro, vuoto } from "../lib/pdfCrop.js";
import { pushSample, medianMs, formatLeft, loadSamples, saveSamples } from "../lib/readingSpeed.js";
import BookCover from "./BookCover.jsx";
import DictionaryCard from "./DictionaryCard.jsx";
import HighlightList from "./HighlightList.jsx";
import SchedaOracolo, { attese } from "./SchedaOracolo.jsx";

// stesse fasce del reader EPUB, misurate sullo schermo: cosi' anche il
// margine attorno alla pagina volta, non solo il foglio
const TAP_PREV = 0.28;
const TAP_NEXT = 0.72;
// stesso limite del reader EPUB per la scheda del significato
const PHRASE_WORDS = 300;
// Oltre questa lunghezza la selezione non e' piu' una frase ma un brano, e
// cercarci dentro un modo di dire non ha senso.
const NET_WORDS = 30;
// e stesso tetto alle schede dell'Oracolo tenute da parte
const MAX_SCHEDE = 8;

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

// Arrivando da un risultato di ricerca, la riga del livello testo che
// contiene il passaggio si accende un attimo: senza, si atterra sulla pagina
// giusta ma il punto tocca trovarlo a occhio. Confronto sul testo
// normalizzato come fa la ricerca, cosi' accenti e maiuscole non ingannano.
function accendiRisultato(flashRef, layer, pageNum) {
  const f = flashRef.current;
  if (!f || !layer) return;
  if (pageNum != null && f.page !== pageNum) return;
  flashRef.current = null;
  const cerca = normalizeWithMap(f.hit || "").text.trim().slice(0, 20);
  if (!cerca) return;
  for (const span of layer.querySelectorAll("span")) {
    if (normalizeWithMap(span.textContent || "").text.includes(cerca)) {
      span.style.background = `${C.accent}55`;
      span.style.borderRadius = "3px";
      setTimeout(() => { span.style.background = "transparent"; }, 2600);
      return;
    }
  }
}

export default function PdfReader({ book, startCfi, music, onMusicToggle, onMusicStop, onMusicVolume, onMusicNext, onMusicRoom, onAlive, onClose, notify, nextBook, onReadNext }) {
  const rootRef = useRef(null);
  const containerRef = useRef(null);
  const pageBoxRef = useRef(null);
  // La cornice della pagina INTERA, margini compresi, che scorre sotto la
  // finestra ritagliata. Testo ed evidenziazioni vivono qui dentro: cosi'
  // le frazioni salvate restano frazioni della pagina vera, e accendere o
  // spegnere il ritaglio non sposta niente di quel che avevi segnato.
  const pageFullRef = useRef(null);
  const canvasRef = useRef(null);
  const textRef = useRef(null);
  const pdfRef = useRef(null);
  const modRef = useRef(null);
  const renderTask = useRef(null);
  const renderToken = useRef(0);
  const textLayer = useRef(null);
  const flashRef = useRef(null);
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
  const [chi, setChi] = useState(null);
  const [jump, setJump] = useState("");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState({ busy: false, results: null, scanned: 0, full: false });
  const [crop, setCrop] = useState(() => getCrop(book.id));
  const [campioni, setCampioni] = useState(() => loadSamples("pdf"));
  const ultimoGiro = useRef(0);

  // il ritaglio in mano al disegno, che vive fuori da React
  const rotella = useRef(0);
  const cropRef = useRef(TUTTA);
  cropRef.current = settings.ritaglia !== false && crop ? crop : TUTTA;

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
        // Il foglio si misura sul RITAGLIO, non sulla pagina: e' la parte
        // scritta a doversi prendere lo schermo. La stessa scala vale poi
        // per la cornice piena, o testo e disegno si sfaserebbero.
        const rit = cropRef.current;
        const base = p.getViewport({ scale: 1 });
        const largo = base.width * (rit.r - rit.l);
        const alto = base.height * (rit.b - rit.t);
        const cssWidth = Math.min(container.clientWidth - 8, (container.clientHeight - 8) * (largo / alto));
        const scale = (cssWidth / largo) * zoomLevel;
        const dpr = window.devicePixelRatio || 1;
        const pieno = p.getViewport({ scale: scale * dpr });
        // gli scostamenti spostano il disegno, non la misura del riquadro:
        // la tela grande quanto il ritaglio ritaglia da se'
        const viewport = p.getViewport({
          scale: scale * dpr,
          offsetX: -rit.l * pieno.width,
          offsetY: -rit.t * pieno.height,
        });
        canvas.width = Math.ceil(pieno.width * (rit.r - rit.l));
        canvas.height = Math.ceil(pieno.height * (rit.b - rit.t));
        const cssW = Math.ceil(canvas.width / dpr);
        const cssH = Math.ceil(canvas.height / dpr);
        canvas.style.width = `${cssW}px`;
        canvas.style.height = `${cssH}px`;
        if (pageBoxRef.current) {
          pageBoxRef.current.style.width = `${cssW}px`;
          pageBoxRef.current.style.height = `${cssH}px`;
        }
        if (pageFullRef.current) {
          const pw = pieno.width / dpr;
          const ph = pieno.height / dpr;
          pageFullRef.current.style.width = `${pw}px`;
          pageFullRef.current.style.height = `${ph}px`;
          pageFullRef.current.style.left = `${-rit.l * pw}px`;
          pageFullRef.current.style.top = `${-rit.t * ph}px`;
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
          if (renderToken.current === token) accendiRisultato(flashRef, layer, pageNum);
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

        // i margini si misurano una volta sola per libro: dalla seconda
        // apertura il ritaglio e' gia' li' e il foglio nasce gia' giusto
        if (!getCrop(book.id)) {
          misuraLibro(pdf).then((c) => {
            if (dead) return;
            saveCrop(book.id, c);
            setCrop(c);
          }).catch(() => { /* niente misura: si legge la pagina intera */ });
        }

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
    renderPage(live.current.page, zoom);
  }, [status, crop, settings.ritaglia]); // eslint-disable-line react-hooks/exhaustive-deps

  // Il passo di lettura, misurato sul tempo fra una pagina e l'altra. Sta
  // in un cassetto suo e non in quello dei libri sfogliati: una pagina A4
  // non e' una schermata di EPUB, e mescolarle sballerebbe tutt'e due le
  // stime.
  useEffect(() => {
    if (status !== "ready") return;
    const ora = Date.now();
    const prima = ultimoGiro.current;
    ultimoGiro.current = ora;
    if (!prima) return;
    // una voltata e' la prova che qualcuno sta leggendo: e' da qui che lo
    // schermo si guadagna un altro quarto d'ora di veglia
    onAlive?.();
    const next = pushSample(campioni, ora - prima);
    if (next === campioni) return;
    setCampioni(next);
    saveSamples(next, "pdf");
  }, [page, status]); // eslint-disable-line react-hooks/exhaustive-deps

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
    // le frazioni si prendono sulla pagina INTERA, mai sulla finestra
    // ritagliata: quel che si salva deve valere anche a ritaglio spento
    if (!text || !s.rangeCount || !pageFullRef.current) return setSel(null);
    const rects = toPageRects(s.getRangeAt(0).getClientRects(), pageFullRef.current.getBoundingClientRect());
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

  // Le schede dell'Oracolo, identiche a quelle del reader EPUB: la macchina
  // sotto sa gia' leggere i PDF (il segno e' il numero di pagina), mancava
  // solo il tasto. La frontiera vale anche qui, saga compresa.
  const chiRun = useRef(0);
  const chiCache = useRef(new Map());
  const doveSono = () => ({
    book,
    libri: loadBooks(),
    statusOf: getStatus,
    // nel PDF il segno e' un numero di pagina, e quello vivo e' piu' avanti
    // di quello salvato: fra un flush e l'altro passano pagine gia' lette
    cfiOf: (id) => (id === book.id ? String(live.current.page) : getCfi(id)),
  });

  async function scheda(chiave, avvia, riusa, tocco) {
    setSel(null);
    setPanel("chi");
    const gia = chiCache.current.get(chiave);
    if (gia && (!riusa || (await riusa(gia)))) return setChi(gia.dato);
    const mio = ++chiRun.current;
    const vivo = () => chiRun.current === mio;
    const finito = await avvia({ ...doveSono(), vivo, passo: (s) => vivo() && setChi(s) });
    if (!vivo() || !finito) return;
    if (finito.answer) {
      chiCache.current.set(chiave, { dato: finito, segno: String(live.current.page), tocco });
      if (chiCache.current.size > MAX_SCHEDE) {
        chiCache.current.delete(chiCache.current.keys().next().value);
      }
    }
    setChi(finito);
  }

  // come nel reader EPUB: la scheda si rifà solo se da allora il
  // personaggio è tornato in scena — qui il segno è il numero di pagina
  // come nell'EPUB: si conta dalla menzione TOCCATA — qui, dalla pagina su
  // cui l'avevi toccata — e non da dove eri
  const chiE = (nome, tocco) =>
    scheda(
      `chi:${nome}`,
      (ctx) => schedaChiE({ nome, ...ctx }),
      async (gia) => {
        setChi({ ...gia.dato, fase: "cerco" });
        return !(await nuoveMenzioni(
          book,
          [nome, ...(gia.dato.alias || [])],
          gia.tocco || gia.segno,
          String(live.current.page)
        ));
      },
      tocco
    );
  // il riassunto si rifà ogni volta: il senso è «fin dove sono ADESSO», e
  // una risposta in cache racconterebbe dov'eri la volta scorsa
  const dovEravamo = () => {
    chiCache.current.delete("trama");
    return scheda("trama", schedaRiassunto);
  };

  // come nel reader EPUB: prima il glossario di casa, che risponde anche
  // offline, poi il vocabolario in rete che completa la scheda. Un PDF non
  // dichiara la lingua come un ePub: si cerca in inglese, che e' la lingua
  // dei libri per cui questa scheda serve.
  async function defineSelection() {
    const raw = sel?.text || "";
    const context = sel?.context || "";
    const word = cleanWord(raw);
    if (!word) return;
    setSel(null);
    const frase = wordCount(raw) > 1;
    setDict({ word, raw, context, loading: true });
    setPanel("dict");
    const mio = raw;
    const local = await explain(raw, book);
    setDict((d) => (d && d.raw === mio ? { ...d, ...local } : d));
    if (wordCount(raw) > NET_WORDS) {
      setDict((d) => (d && d.raw === mio ? { ...d, loading: false, frase } : d));
      return;
    }
    const res = await (frase ? lookupPhrase(raw, "en") : lookup(word, "en")).catch(() => ({
      entries: [],
      offline: true,
    }));
    setDict((d) =>
      d && d.raw === mio
        ? {
            ...d,
            word: res.word || word,
            loading: false,
            frase,
            lang: "en",
            entries: res.entries,
            translation: res.translation,
            lemma: res.lemma,
            forma: res.forma,
            offline: res.offline,
            machine: res.machine,
            idiom: res.idiom,
          }
        : d
    );
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
    if (e.target !== rootRef.current) return;
    if (zoom === 1) {
      const rel = e.clientX / (window.innerWidth || 1);
      if (rel < TAP_PREV) return goToPage(live.current.page - 1);
      if (rel > TAP_NEXT) return goToPage(live.current.page + 1);
    }
    setChrome((v) => !v);
  }

  const pct = pages > 0 ? Math.round((page / pages) * 100) : 0;
  const pagineLeft = pages > 0 ? Math.max(0, pages - page) : 0;
  const passo = medianMs(campioni);
  const tempoLeft = passo && pagineLeft > 0 ? formatLeft(pagineLeft * passo) : null;
  const quantoManca = !pages
    ? null
    : pagineLeft === 0
      ? "ultima pagina"
      : [
          `${pagineLeft} ${pagineLeft === 1 ? "pagina" : "pagine"}`,
          tempoLeft ? `${tempoLeft.startsWith("meno") ? "" : "~"}${tempoLeft} alla fine` : null,
        ]
          .filter(Boolean)
          .join(" · ");
  const edge = "clamp(3px, 0.9vw, 10px)";
  const pageHls = hls.filter((h) => pageOf(h) === page && h.rects?.length);

  return (
    <div
      ref={rootRef}
      onClick={tapAside}
      onWheel={(e) => {
        // col mouse la pagina si volta con la rotellina: non litiga con la
        // selezione del testo, che e' esattamente quel che facevano i
        // bottoni invisibili di prima. A zoom aperto no: li' la rotellina
        // serve a scorrere il foglio ingrandito.
        if (isTouch() || zoom !== 1 || status !== "ready") return;
        if (Math.abs(e.deltaY) < 4) return;
        const ora = Date.now();
        if (ora - rotella.current < 220) return;
        rotella.current = ora;
        goToPage(live.current.page + (e.deltaY > 0 ? 1 : -1));
      }}
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
        <div
          ref={pageBoxRef}
          style={{ position: "relative", flexShrink: 0, overflow: "hidden", boxShadow: "0 4px 30px #00000088" }}
        >
          <canvas ref={canvasRef} style={{ display: "block" }} />
          {/* la pagina intera, margini compresi: sporge dalla finestra e
              viene tagliata da lei. Dentro ci stanno testo ed evidenziazioni,
              che cosi' continuano a misurarsi sulla pagina vera */}
          <div ref={pageFullRef} style={{ position: "absolute", left: 0, top: 0 }}>
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

      {/* Come nel reader EPUB: col mouse niente bottoni invisibili sulle
          fasce laterali. Stavano sopra il livello del testo e li' dentro non
          si poteva selezionare niente — cliccare voltava e basta. Restano la
          rotellina, le frecce e il margine attorno al foglio. */}

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
          {sembraUnNome(sel.text) && (
            <button
              onClick={() => chiE(sel.text.trim(), String(live.current.page))}
              style={{
                padding: "6px 12px",
                borderRadius: 999,
                border: `1px solid ${C.accent}88`,
                color: C.accent,
                fontSize: 14,
                whiteSpace: "nowrap",
              }}
            >
              🕮 Chi è
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
                {music.manca && (
                  <span title="Quanto manca allo spegnimento della musica" style={{ fontSize: 12.5, color: C.muted, whiteSpace: "nowrap" }}>
                    🌙 {music.manca}
                  </span>
                )}
                {/* Cosa sta suonando, e la via per andare a sceglierne
                    un'altra. Il libro si chiude passando dalla porta di
                    sempre, non sparendo: la pagina va salvata come per ogni
                    altra uscita. */}
                <button
                  onClick={() => { handleClose(); onMusicRoom?.(); }}
                  title={`${music.current.name || "Musica di sottofondo"} — vai alla sala della musica`}
                  style={{
                    maxWidth: 150,
                    padding: "0 8px",
                    height: 40,
                    borderRadius: 10,
                    fontSize: 13,
                    color: C.muted,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  <span style={{ color: music.current.src ? C.accent : C.arcane, marginRight: 5 }}>
                    {music.current.src ? "♫" : "♪"}
                  </span>
                  {music.current.name || "Musica di sottofondo"}
                </button>
                <button onClick={onMusicToggle} style={barBtn(false)} aria-label={music.playing ? "Pausa musica" : "Riprendi musica"}>
                  {music.playing ? "⏸" : "▶"}
                </button>
                <button onClick={onMusicNext} style={{ ...barBtn(false), fontSize: 16 }} aria-label="Melodia successiva">
                  ⏭
                </button>
                {/* il volume qui e' quello della sola musica: sotto la lettura
                    si abbassa lei, non le notifiche e la sveglia del tablet */}
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round((music.volume ?? 1) * 100)}
                  onChange={(e) => onMusicVolume?.(parseInt(e.target.value, 10) / 100)}
                  aria-label="Volume della musica"
                  style={{ width: 64, flexShrink: 0, accentColor: C.accent }}
                />
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
            <button onClick={dovEravamo} style={barBtn(false)} aria-label="Dove eravamo rimasti">🧭</button>
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
              {quantoManca && (
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "0 10px" }}>
                  {quantoManca}
                </span>
              )}
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

          <div style={{ height: 1, background: C.border, margin: "14px 0 12px" }} />
          <button
            onClick={() => updateSettings({ ritaglia: settings.ritaglia === false })}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 10px",
              borderRadius: 10,
              border: `1px solid ${settings.ritaglia !== false ? C.accent : C.border}`,
              color: settings.ritaglia !== false ? C.accent : C.muted,
              fontSize: 14,
              textAlign: "left",
            }}
          >
            <span style={{ fontSize: 16 }}>{settings.ritaglia !== false ? "☑" : "☐"}</span>
            <span style={{ flex: 1 }}>Togli i margini bianchi</span>
          </button>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 6, lineHeight: 1.45 }}>
            {crop === null
              ? "Sto misurando i margini di questo tomo…"
              : vuoto(crop)
                ? "Questo tomo non ha margini da togliere."
                : `Qui se ne va ${Math.round((1 - (crop.r - crop.l) * (crop.b - crop.t)) * 100)}% di carta bianca.`}
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
                flashRef.current = { page: r.page, hit: r.hit };
                // pagina gia' aperta: nessun ridisegno in arrivo, si accende ora
                if (r.page === page) accendiRisultato(flashRef, textRef.current, null);
                else goToPage(r.page);
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

      {panel === "chi" && chi && (
        <Panel
          title={chi.nome ? `Chi è ${chi.nome}` : "Dove eravamo rimasti"}
          onClose={() => setPanel(null)}
        >
          <SchedaOracolo
            scheda={chi}
            attese={attese(chi)}
            vuoto={
              chi.nome
                ? `Non trovo «${chi.nome}» in quello che hai letto finora.`
                : "Non riesco a rileggere quello che hai letto finora."
            }
            onRiprova={() => (chi.nome ? chiE(chi.nome) : dovEravamo())}
          />
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
