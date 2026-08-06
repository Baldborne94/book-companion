import { useCallback, useEffect, useRef, useState } from "react";
import { C, FONT_TITLE } from "../data/constants.js";
import { getAux, putAux } from "../lib/bookStore.js";
import { ensureLocalFile } from "../lib/sync.js";
import {
  getCfi, setCfi, getMarks, saveMarks, getHighlights, saveHighlights,
} from "../lib/annotations.js";
import { getProgress, setProgress, setStatus } from "../lib/library.js";
import {
  READER_THEMES, READER_FONTS, HL_COLORS, loadReaderSettings, saveReaderSettings,
} from "../lib/readerSettings.js";
import { searchBook } from "../lib/epubSearch.js";
import { lookup, lookupPhrase, wordCount, cleanWord } from "../lib/dictionary.js";
import { explain, termIndex, normalize, wikiUrl, glossaryOf } from "../lib/glossary.js";
import { contextAround } from "../lib/oracle.js";
import { pushSample, medianMs, formatLeft, loadSamples, saveSamples } from "../lib/readingSpeed.js";
import { leftoverScroll } from "../lib/spread.js";
import { bakeHtml, rasterize, drawCurl } from "../lib/pageCurl.js";
import BookCover from "./BookCover.jsx";
import HighlightList from "./HighlightList.jsx";
import DictionaryCard from "./DictionaryCard.jsx";

// sotto i 7px la pila di fogli diventa un filo che sembra un difetto,
// non l'orlo delle pagine: il minimo deve leggersi come carta impilata
const EDGE_MIN = 7;
const EDGE_MAX = 17;
// la rilegatura visibile attorno alla carta
const FRAME = 6;
// Testa e piede della carta. Sono margini tipografici, non piu' lo spazio
// riservato alle barre: il testo deve riempire la pagina, e quando le barre
// compaiono coprono le prime e le ultime righe — scelta del lettore, che le
// tiene su il tempo di un tocco. Quello che NON deve cambiare e' la misura:
// resta fissa a barre accese e spente, o epub.js reimpagina e sposta tutto —
// punto di lettura, segnalibri, evidenziazioni. A questi si aggiungono i
// 20px che epub.js mette di suo sul body, inline e con !important: sono
// intoccabili da un foglio di stile, e fanno da margine minimo.
const HEAD = 8;
const FOOT = 8;
const EDGE_STRIPES =
  "repeating-linear-gradient(to right, #00000047 0 1px, #ffffff1f 1px 2px, #0000001c 2px 4px)";
// Finto piombo per i fogli in volo: righe di testo appena accennate, cinque
// per paragrafo, fatte solo di velature e vuoti cosi' non litigano con le
// ombre del foglio. Il contenuto vero vive nell'iframe di epub.js e non si
// puo' stampare qui; a questa velocita' l'occhio legge il ritmo, non le
// parole.
const PRINT_ROWS = (fg) =>
  `repeating-linear-gradient(to bottom, ` +
  `${fg}18 0 2px, transparent 2px 15px, ` +
  `${fg}18 15px 17px, transparent 17px 30px, ` +
  `${fg}18 30px 32px, transparent 32px 45px, ` +
  `${fg}18 45px 47px, transparent 47px 60px, ` +
  `${fg}18 60px 62px, transparent 62px 84px)`;

// In doppia pagina epub.js riporta solo il foglio di sinistra: il numero
// pari non compariva mai nel piede e sembrava saltato.
function pageLabel(d, spread) {
  const destra = spread === 2 && d.page < d.total ? d.page + 1 : null;
  return destra
    ? `pagine ${d.page}-${destra} di ${d.total} del capitolo`
    : `pag. ${d.page} di ${d.total} del capitolo`;
}

// fasce laterali del tocco: valgono su tutta la larghezza dello schermo,
// cornice e taglio delle pagine compresi, non solo dentro al capitolo
const TAP_PREV = 0.28;
const TAP_NEXT = 0.72;
// tetto ai segni per capitolo: la pagina resta una pagina, non un elenco
const MARKS_PER_CHAPTER = 60;
// Oltre questa lunghezza la selezione non e' piu' una frase ma un brano, e
// cercarci dentro un modo di dire non ha senso. Il tetto era 12 quando ogni
// sotto-frase costava una richiesta: ora ne basta una per tutte, quindi una
// frase lunga com'e' quella vera di un romanzo ci sta dentro.
const NET_WORDS = 30;
// la selezione da capire e' spesso un paragrafo intero — il parlato
// biascicato si decifra tutto insieme, non parola per parola — quindi il
// pulsante deve esserci anche li'. Fermarsi a poche parole lo rendeva
// inservibile proprio nei casi difficili.
const PHRASE_WORDS = 300;

const isTouch = () => navigator.maxTouchPoints > 0;
const isTablet = () =>
  isTouch() && Math.min(window.innerWidth, window.innerHeight) >= 520;
const reducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const GOOGLE_FONT_CSS =
  "@import url('https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&display=swap');";

// La parola sotto il dito, non il segno disegnato sopra: cosi' risponde ogni
// occorrenza e non solo quella marcata, e il tocco non deve contendersi
// l'evento con la fascia del cambio pagina.
function termAt(doc, x, y, ix) {
  let node = null;
  let offset = 0;
  if (doc.caretRangeFromPoint) {
    const r = doc.caretRangeFromPoint(x, y);
    if (r) {
      node = r.startContainer;
      offset = r.startOffset;
    }
  } else if (doc.caretPositionFromPoint) {
    const pos = doc.caretPositionFromPoint(x, y);
    if (pos) {
      node = pos.offsetNode;
      offset = pos.offset;
    }
  }
  if (!node || node.nodeType !== 3) return null;
  const text = node.nodeValue || "";
  const parola = /[\p{L}\p{N}'’-]/u;
  let da = offset;
  let a = offset;
  while (da > 0 && parola.test(text[da - 1])) da -= 1;
  while (a < text.length && parola.test(text[a])) a += 1;
  if (a <= da) return null;
  // un nome puo' essere composto: si guarda anche una parola prima e due dopo
  let sinistra = da;
  for (let i = 0; i < 1 && sinistra > 0; i++) {
    let j = sinistra - 1;
    while (j > 0 && !parola.test(text[j - 1]) && text[j - 1] === " ") j -= 1;
    while (j > 0 && parola.test(text[j - 1])) j -= 1;
    sinistra = j;
  }
  let destra = a;
  for (let i = 0; i < 2 && destra < text.length; i++) {
    let j = destra;
    while (j < text.length && text[j] === " ") j += 1;
    while (j < text.length && parola.test(text[j])) j += 1;
    destra = j;
  }
  const candidati = [
    text.slice(sinistra, destra),
    text.slice(da, destra),
    text.slice(sinistra, a),
    text.slice(da, a),
  ];
  for (const c of candidati) {
    const pulito = c.trim();
    if (!pulito) continue;
    const e = ix.map.get(normalize(pulito));
    // il nome proprio vale solo se nel testo e' scritto con la maiuscola
    if (e && (!/^\p{Lu}/u.test(e.t) || /^\p{Lu}/u.test(pulito))) return e;
  }
  return null;
}

function flattenToc(items, depth = 0, out = []) {
  for (const it of items || []) {
    out.push({ href: it.href, label: (it.label || "").trim() || "…", depth });
    if (it.subitems?.length) flattenToc(it.subitems, depth + 1, out);
  }
  return out;
}

function contentStyles(s) {
  const t = READER_THEMES[s.theme];
  const font = READER_FONTS.find((f) => f.id === s.font)?.css;
  const textSel =
    "p, div, span, li, td, th, dd, dt, blockquote, cite, em, strong, i, b, small, figcaption";
  const rules = {
    html: { background: `${t.bg} !important` },
    body: {
      background: `${t.bg} !important`,
      color: `${t.fg} !important`,
      "line-height": `${s.lineHeight} !important`,
    },
    [textSel]: {
      color: `${t.fg} !important`,
      "line-height": `${s.lineHeight} !important`,
    },
    "h1, h2, h3, h4, h5, h6": { color: `${t.fg} !important` },
    "a, a *": { color: `${t.link} !important` },
    img: { "max-width": "100% !important" },
  };
  if (font) {
    rules.body["font-family"] = `${font} !important`;
    rules[textSel]["font-family"] = `${font} !important`;
    rules["h1, h2, h3, h4, h5, h6"]["font-family"] = `${font} !important`;
  }
  return rules;
}

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

function Stepper({ label, value, onDec, onInc }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
      <span style={{ fontSize: 14.5, color: C.muted }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onDec} style={{ ...barBtn(false), border: `1px solid ${C.border}` }}>−</button>
        <span style={{ minWidth: 52, textAlign: "center", fontSize: 15 }}>{value}</span>
        <button onClick={onInc} style={{ ...barBtn(false), border: `1px solid ${C.border}` }}>＋</button>
      </div>
    </div>
  );
}

function Slider({ label, min, max, step, value, onChange }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14.5, color: C.muted, marginBottom: 4 }}>
        <span>{label}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: "100%", accentColor: C.accent }}
      />
    </div>
  );
}

// La pagina vera sul foglio che gira: la fotografia del capitolo rinasce in
// un iframe muto e senza script, rimesso dove stava l'originale rispetto al
// libro. `base` e' il bordo sinistro, nel libro, della meta' che la faccia
// copre: cosi' il ritaglio combacia col testo a schermo.
// L'iframe resta MONTATO per sempre nel suo posto sul palco: spostarlo nel
// DOM lo ricaricherebbe, e ricostruirlo al tocco costava lampi bianchi e
// facce nude sul tablet. Il documento si prepara nei momenti morti (park)
// e il clone resta invisibile finche' non ha davvero finito di dipingersi.
function StageFrame({ park, shown, x, y, base }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(false);
  }, [park?.html]);
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        // contain:paint obbliga il compositore a rispettare il taglio: dentro
        // il 3D, overflow e clip-path sugli antenati vengono lasciati cadere
        // su Android, e le colonne del capitolo sbucavano sopra la pagina —
        // la "sovrapposizione che compare e scompare"
        contain: "paint",
        isolation: "isolate",
      }}
    >
      <iframe
        aria-hidden="true"
        tabIndex={-1}
        sandbox="allow-same-origin"
        scrolling="no"
        srcDoc={park?.html || "<html></html>"}
        onLoad={() => requestAnimationFrame(() => setReady(true))}
        style={{
          position: "absolute",
          left: (x ?? 0) - base,
          top: (y ?? 0) - FRAME,
          width: park?.w ?? 10,
          height: park?.h ?? 10,
          border: 0,
          pointerEvents: "none",
          opacity: ready && shown ? 1 : 0,
        }}
      />
    </div>
  );
}

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

export default function Reader({ book, startCfi, nextBook, onReadNext, music, onMusicToggle, onMusicStop, onClose, notify }) {
  const viewerRef = useRef(null);
  const rootRef = useRef(null);
  const bookRef = useRef(null);
  const epubRef = useRef(null);
  const rendRef = useRef(null);
  const saveTimer = useRef(null);
  const turnTimer = useRef(null);
  const swapTimer = useRef(null);
  const parkTimer = useRef(null);
  const turningRef = useRef(null);
  const texRef = useRef(null);
  const curlBroken = useRef(false);
  const curlCanvasRef = useRef(null);
  const curlRun = useRef(null);
  const turnRef = useRef(() => {});
  const moved = useRef(false);
  const fixTimers = useRef([]);
  const live = useRef({ cfi: startCfi || getCfi(book.id), progress: getProgress(book.id), locReady: false, settings: null });

  const [settings, setSettings] = useState(() =>
    loadReaderSettings(Math.min(window.innerWidth, window.innerHeight))
  );
  const [status, setStatusUi] = useState("loading");
  const [chrome, setChrome] = useState(() => !isTouch());
  const [panel, setPanel] = useState(null);
  const [progress, setProgressUi] = useState(() => getProgress(book.id));
  const [locReady, setLocReady] = useState(false);
  const [toc, setToc] = useState([]);
  const [marks, setMarks] = useState(() => getMarks(book.id));
  const [hls, setHls] = useState(() => getHighlights(book.id));
  const [selMenu, setSelMenu] = useState(null);
  const [query, setQuery] = useState("");
  const [searchState, setSearchState] = useState({ busy: false, results: null });
  const [pages, setPages] = useState(1);
  const [turning, setTurning] = useState(null);
  const [park, setPark] = useState(null);
  const [isFs, setIsFs] = useState(false);
  const [displayed, setDisplayed] = useState(null);
  const [speed, setSpeed] = useState(() => medianMs(loadSamples()));
  const [dict, setDict] = useState(null);
  const [endCard, setEndCard] = useState(null);

  const anchor = useRef(null);
  const markedRef = useRef(new Map());
  const termsRef = useRef(null);
  const termCfis = useRef([]);
  const reflowing = useRef(false);
  const reflowTimer = useRef(null);

  // Le barre non toccano piu' la misura del libro, ma cambiare margine
  // reimpagina lo stesso. Lasciando ripartire epub.js dal CFI corrente si
  // arretrava di mezza pagina ogni volta, perche' allinea sempre all'inizio
  // della pagina che lo contiene: si riparte invece dall'ultima pagina
  // scelta dal lettore, che non si sposta da sola.
  const relayout = useCallback((cfi) => {
    const r = rendRef.current;
    if (cfi) reflowing.current = true;
    try {
      if (r) r.resize(undefined, undefined, cfi || undefined);
      else window.dispatchEvent(new Event("resize"));
    } catch {
      window.dispatchEvent(new Event("resize"));
    }
    // se la misura non cambia epub.js non riposiziona nulla e "relocated"
    // non arriva: la bandiera va tolta comunque
    clearTimeout(reflowTimer.current);
    reflowTimer.current = setTimeout(() => { reflowing.current = false; }, 1500);
  }, []);

  const samplesRef = useRef(loadSamples());
  const lastTurnAt = useRef(0);
  const langRef = useRef("en");

  live.current.settings = settings;
  live.current.panel = panel;
  turningRef.current = turning;
  live.current.selMenu = selMenu;
  const theme = READER_THEMES[settings.theme];

  const flush = useCallback(() => {
    const s = live.current;
    if (s.cfi) setCfi(book.id, s.cfi);
    setProgress(book.id, s.progress || 0);
  }, [book.id]);

  const handleClose = useCallback(() => {
    clearTimeout(saveTimer.current);
    flush();
    if ((live.current.progress || 0) >= 0.97) setStatus(book.id, "read");
    onClose();
  }, [book.id, flush, onClose]);

  const applyStyles = useCallback((rendition, s) => {
    rendition.themes.default(contentStyles(s));
    rendition.themes.fontSize(`${s.fontSize}%`);
  }, []);

  // I termini si segnano con le annotazioni di epub.js, che disegnano SOPRA
  // la pagina: avvolgerli in uno <span> cambierebbe la struttura del capitolo
  // e con lei i percorsi dei CFI, mandando fuori posto segnalibri ed
  // evidenziazioni gia' salvati. Solo la prima occorrenza per capitolo: con
  // «Vimes» e «Ankh-Morpork» a ogni riga la pagina diventerebbe illeggibile.
  const markTerms = useCallback(
    async (view) => {
      if (!live.current.settings?.terms) return;
      const ix = await termIndex(book);
      termsRef.current = ix;
      const doc = view?.contents?.document;
      if (!ix || !doc || !view.contents) return;
      const href = (view.section?.href || "").split("#")[0];
      let done = markedRef.current.get(href);
      if (!done) markedRef.current.set(href, (done = new Set()));
      const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) =>
          n.parentElement?.closest("a, script, style")
            ? NodeFilter.FILTER_REJECT
            : NodeFilter.FILTER_ACCEPT,
      });
      let left = MARKS_PER_CHAPTER - done.size;
      for (let node = walker.nextNode(); node && left > 0; node = walker.nextNode()) {
        const text = node.nodeValue;
        if (!text || text.length < 4) continue;
        ix.re.lastIndex = 0;
        for (let m = ix.re.exec(text); m && left > 0; m = ix.re.exec(text)) {
          const entry = ix.map.get(normalize(m[1]));
          if (!entry || done.has(entry.t)) continue;
          // «Death» il personaggio, non «the death of the king»
          if (/^\p{Lu}/u.test(entry.t) && !/^\p{Lu}/u.test(m[1])) continue;
          const range = doc.createRange();
          range.setStart(node, m.index);
          range.setEnd(node, m.index + m[1].length);
          let cfi = null;
          try {
            cfi = view.contents.cfiFromRange(range);
          } catch {
            /* nodo che epub.js non sa indirizzare: si lascia stare */
          }
          if (!cfi) continue;
          done.add(entry.t);
          termCfis.current.push(cfi);
          left -= 1;
          try {
            rendRef.current?.annotations.highlight(cfi, { bcTerm: entry.t }, undefined, "bc-term", {
              fill: C.arcane,
              "fill-opacity": "0.22",
            });
          } catch {
            /* annotazione rifiutata: il termine resta comunque cercabile */
          }
        }
      }
    },
    [book] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const addAnnotation = useCallback((rendition, h) => {
    rendition.annotations.highlight(h.cfi, {}, () => setPanel("hl"), "bc-hl", {
      fill: h.color,
      "fill-opacity": "0.35",
      "mix-blend-mode": "multiply",
    });
  }, []);

  const makeRendition = useCallback(
    (s) => {
      const eb = epubRef.current;
      if (!eb || !viewerRef.current) return;
      if (rendRef.current) {
        try { rendRef.current.destroy(); } catch { /* già distrutto */ }
      }
      viewerRef.current.innerHTML = "";
      texRef.current = null;
      const r = eb.renderTo(viewerRef.current, {
        width: "100%",
        height: "100%",
        flow: s.flow === "scrolled" ? "scrolled-doc" : "paginated",
        // in scorrimento non esistono facciate: senza questo, in orizzontale
        // epub.js dichiara comunque un layout a due colonne e compare il dorso
        spread: s.flow === "scrolled" ? "none" : s.spread,
        // le due facciate solo col tablet sdraiato: la soglia sta a meta'
        // fra il lato corto e quello lungo dello schermo, cosi' "auto"
        // diventa "solo in orizzontale" e la rotazione cambia layout da sola
        minSpreadWidth: Math.ceil((window.innerWidth + window.innerHeight) / 2),
        allowScriptedContent: false,
      });
      rendRef.current = r;
      applyStyles(r, s);

      r.on("relocated", (loc) => {
        const st = live.current;
        st.cfi = loc.start.cfi;
        st.href = loc.start.href;
        // l'ancora segue solo le pagine scelte dal lettore: quelle rese da un
        // reimpaginamento sono un ripiego e non devono diventare il nuovo "li'"
        if (reflowing.current) reflowing.current = false;
        else anchor.current = loc.start.cfi;
        if (st.locReady) {
          const p = eb.locations.percentageFromCfi(loc.start.cfi);
          if (Number.isFinite(p)) {
            st.progress = p;
            setProgressUi(p);
          }
        }
        if (loc.atEnd) {
          setStatus(book.id, "read");
          setEndCard((v) => (v === null ? "shown" : v));
        }
        if (loc.start?.displayed?.total) setDisplayed(loc.start.displayed);
        const now = Date.now();
        if (lastTurnAt.current) {
          const next = pushSample(samplesRef.current, now - lastTurnAt.current);
          if (next !== samplesRef.current) {
            samplesRef.current = next;
            saveSamples(next);
            setSpeed(medianMs(next));
          }
        }
        lastTurnAt.current = now;
        clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(flush, 1500);
        // il palco si prepara nei momenti morti: a ogni approdo si
        // rinfresca la fotografia del capitolo per il prossimo giro
        schedulePark();
      });

      r.on("layout", (layout) => setPages(layout.divisor > 1 ? 2 : 1));

      r.on("selected", (cfiRange, contents) => {
        const sel = contents.window.getSelection();
        const text = sel?.toString() || "";
        // il paragrafo attorno si prende ora: al tocco sul menu la selezione
        // e' gia' sparita, e all'Oracolo serve il contesto, non la frase sola
        if (text.trim()) setSelMenu({ cfi: cfiRange, text, context: contextAround(sel) });
      });

      r.on("rendered", (_section, view) => {
        const doc = view?.contents?.document;
        if (!doc) return;
        if (live.current.settings.font === "garamond") {
          try { view.contents.addStylesheetCss(GOOGLE_FONT_CSS, "bc-font"); } catch { /* offline: fallback serif */ }
        }
        // Su touch il cambio pagina nasce da qui, non da bottoni sovrapposti:
        // quelli intercettavano il tocco prolungato e rendevano impossibile
        // selezionare una parola nelle fasce laterali.
        markTerms(view);
        doc.addEventListener("click", (e) => {
          if (e.target.closest?.("a")) return;
          const sel = view.contents.window.getSelection();
          if (sel && sel.toString()) return;
          const ix = termsRef.current;
          if (ix) {
            const hit = termAt(doc, e.clientX, e.clientY, ix);
            if (hit) return openTerm(hit);
          }
          if (isTouch() && live.current.settings.flow !== "scrolled") {
            // dentro il capitolo le coordinate vivono nello spazio delle
            // colonne, largo quanto tutto il testo: vanno riportate allo
            // schermo, dove le fasce sono le stesse del bordo del libro
            const frameEl = view.contents.window.frameElement;
            if (frameEl && window.innerWidth) {
              const rel = (frameEl.getBoundingClientRect().left + e.clientX) / window.innerWidth;
              if (rel < TAP_PREV) return turnRef.current("prev");
              if (rel > TAP_NEXT) return turnRef.current("next");
            }
          }
          setChrome((v) => !v);
        });
      });

      r.on("keydown", (e) => {
        if (e.key === "ArrowRight") turnRef.current("next");
        if (e.key === "ArrowLeft") turnRef.current("prev");
      });

      // Il capitolo si impagina col font di ripiego e solo dopo arriva
      // quello vero: le misure cambiano, epub.js ricolloca dal pixel e il
      // punto chiesto scivola indietro di una-due pagine — che poi venivano
      // risalvate come "ultima pagina letta". Finche' il lettore non sfoglia
      // il punto buono resta quello chiesto: ci si torna sopra quando le
      // misure si sono assestate.
      moved.current = false;
      fixTimers.current.forEach(clearTimeout);
      const target = live.current.cfi;
      r.display(target || undefined)
        .catch(() => r.display())
        .then(() => setStatusUi("ready"));
      if (target) {
        const fix = () => {
          if (moved.current || rendRef.current !== r) return;
          if (live.current.cfi === target) return;
          anchor.current = target;
          reflowing.current = true;
          clearTimeout(reflowTimer.current);
          reflowTimer.current = setTimeout(() => { reflowing.current = false; }, 1500);
          r.display(target).catch(() => { reflowing.current = false; });
        };
        fixTimers.current = [setTimeout(fix, 1500), setTimeout(fix, 3500)];
      }

      getHighlights(book.id).forEach((h) => addAnnotation(r, h));
    },
    [addAnnotation, applyStyles, book.id, flush]
  );

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const blob = await ensureLocalFile(book);
        if (!blob) throw new Error("file mancante");
        const { default: ePub } = await import("epubjs");
        const eb = ePub(await blob.arrayBuffer());
        epubRef.current = eb;
        await eb.ready;
        if (dead) return;
        const lang = (eb.packaging?.metadata?.language || "").slice(0, 2).toLowerCase();
        langRef.current = lang || "en";
        eb.loaded.navigation.then((nav) => !dead && setToc(flattenToc(nav.toc)));
        makeRendition(live.current.settings);
        const cached = await getAux(`loc_${book.id}`);
        if (dead) return;
        if (cached) eb.locations.load(cached);
        else {
          await eb.locations.generate(600);
          putAux(`loc_${book.id}`, eb.locations.save());
        }
        if (dead) return;
        live.current.locReady = true;
        setLocReady(true);
        if (live.current.cfi) {
          const p = eb.locations.percentageFromCfi(live.current.cfi);
          if (Number.isFinite(p)) {
            live.current.progress = p;
            setProgressUi(p);
          }
        }
      } catch {
        if (!dead) setStatusUi("error");
      }
    })();

    const onVis = () => {
      if (document.visibilityState === "hidden") flush();
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        if (live.current.selMenu) setSelMenu(null);
        else if (live.current.panel) setPanel(null);
        else handleClose();
      }
      if (e.key === "ArrowRight") turnRef.current("next");
      if (e.key === "ArrowLeft") turnRef.current("prev");
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("beforeunload", flush);
    window.addEventListener("keydown", onKey);
    return () => {
      dead = true;
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("beforeunload", flush);
      window.removeEventListener("keydown", onKey);
      clearTimeout(saveTimer.current);
      clearTimeout(swapTimer.current);
      clearTimeout(turnTimer.current);
      clearTimeout(reflowTimer.current);
      clearTimeout(parkTimer.current);
      curlRun.current = null;
      fixTimers.current.forEach(clearTimeout);
      flush();
      try { rendRef.current?.destroy(); } catch { /* già distrutto */ }
      try { epubRef.current?.destroy(); } catch { /* già distrutto */ }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const marginSeen = useRef(settings.margin);
  useEffect(() => {
    if (marginSeen.current === settings.margin) return;
    marginSeen.current = settings.margin;
    relayout(anchor.current || live.current.cfi);
  }, [settings.margin, relayout]);

  useEffect(() => {
    const onFs = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      clearTimeout(turnTimer.current);
    };
  }, []);

  // Schermo intero, rotazione e barre di sistema cambiano la misura del
  // riquadro senza passare dalle impostazioni: epub.js reimpagina da solo e
  // si riallinea all'INIZIO della pagina che contiene il punto corrente —
  // mezzo passo indietro a ogni cambio. Quella posizione arretrata finiva
  // salvata, e spostava segnalibri e "ultima pagina letta" a seconda della
  // modalita'. Il punto va fotografato al primo segnale di resize, quando
  // l'ancora e' ancora quella scelta dal lettore, e a giro finito ci si
  // torna sopra esplicitamente.
  useEffect(() => {
    const el = bookRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    let primo = true;
    let foto = null;
    let timer;
    const ro = new ResizeObserver(() => {
      if (primo) { primo = false; return; }
      if (!foto) foto = anchor.current || live.current.cfi;
      clearTimeout(timer);
      timer = setTimeout(() => {
        const dove = foto;
        foto = null;
        if (!dove || !rendRef.current) return;
        anchor.current = dove;
        reflowing.current = true;
        clearTimeout(reflowTimer.current);
        reflowTimer.current = setTimeout(() => { reflowing.current = false; }, 1500);
        rendRef.current.display(dove).catch(() => { reflowing.current = false; });
      }, 500);
    });
    ro.observe(el);
    return () => { ro.disconnect(); clearTimeout(timer); };
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      rootRef.current?.requestFullscreen?.().catch(() => notify("Schermo intero non disponibile qui"));
    }
  }

  // avanti si scorre il residuo prima di cambiare capitolo, cosi' l'ultima
  // pagina scritta non viene saltata; indietro epub.js gia' atterra in fondo
  function step(r, dir) {
    if (dir === "prev") return r.prev();
    const rest = leftoverScroll(r.manager);
    if (!rest) return r.next();
    r.manager.scrollBy(rest, 0, true);
    return r.reportLocation();
  }

  // La vista che il lettore sta davvero guardando: con piu' capitoli in
  // piedi (epub.js precarica il prossimo) la "prima vista" puo' essere
  // quella fuori schermo — conta la piu' sovrapposta al libro.
  function bestView() {
    const host = bookRef.current;
    if (!host) return null;
    const rh = host.getBoundingClientRect();
    let out = null;
    let meglio = 0;
    rendRef.current?.manager?.views?.forEach?.((v) => {
      const f = v?.iframe || v?.element?.querySelector?.("iframe");
      if (!f || !v?.contents?.document) return;
      const r = f.getBoundingClientRect();
      const visibile = Math.min(r.right, rh.right) - Math.max(r.left, rh.left);
      if (visibile > meglio) {
        meglio = visibile;
        out = { view: v, ri: r, rh };
      }
    });
    return out;
  }

  // Solo misure, niente serializzazioni: si legge al tocco, deve costare
  // quanto un getBoundingClientRect.
  function snapRects() {
    try {
      const b = bestView();
      if (!b) return null;
      return {
        href: (b.view.section?.href || "").split("#")[0],
        // frazionari, non arrotondati: mezzo pixel di scarto si vede come
        // testo doppio nella dissolvenza d'atterraggio
        x: b.ri.left - b.rh.left,
        y: b.ri.top - b.rh.top,
        hw: b.rh.width,
      };
    } catch {
      return null;
    }
  }

  // La fotografia del capitolo — stili inline di epub.js compresi, quindi
  // stesse colonne e stessi caratteri. Costa una serializzazione: si fa nei
  // momenti morti dopo un cambio pagina (park), MAI al tocco — sul tablet
  // il clone montato in corsa arrivava tardi e il foglio girava nudo.
  function snapPark() {
    try {
      const b = bestView();
      const doc = b?.view?.contents?.document;
      if (!b || !doc) return null;
      // epub.js inietta tema e interlinea via CSSOM (insertRule): il tag
      // <style> nel markup resta vuoto e outerHTML non li porta con se'.
      // Senza queste regole il clone reimpagina diverso e la finestra di
      // testo non combacia piu': si serializzano a mano e si imbarcano.
      let css = "";
      for (const sheet of doc.styleSheets) {
        try {
          for (const rule of sheet.cssRules) css += `${rule.cssText}\n`;
        } catch { /* foglio di un'altra origine: illeggibile e non nostro */ }
      }
      const style = `<style>${css.replace(/<\//g, "<\\/")}</style>`;
      const raw = doc.documentElement.outerHTML;
      const html = /<\/head>/i.test(raw)
        ? raw.replace(/<\/head>/i, `${style}</head>`)
        : style + raw;
      // due sapori della stessa fotografia: HTML per gli iframe del palco,
      // XML per l'immagine SVG del cilindro (dentro foreignObject i tag non
      // chiusi e le & nude fanno fallire il parser)
      const styleXml = `<style>${css.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</style>`;
      const rawXml = new XMLSerializer().serializeToString(doc.documentElement);
      const xml = /<\/head>/i.test(rawXml)
        ? rawXml.replace(/<\/head>/i, `${styleXml}</head>`)
        : styleXml + rawXml;
      return {
        html,
        xml,
        w: Math.round(b.ri.width),
        h: Math.round(b.ri.height),
        href: (b.view.section?.href || "").split("#")[0],
      };
    } catch {
      return null;
    }
  }

  const schedulePark = useCallback(() => {
    clearTimeout(parkTimer.current);
    parkTimer.current = setTimeout(async () => {
      const p = snapPark();
      if (!p) return;
      setPark((old) => (old && old.html === p.html ? old : p));
      if (!live.current.settings?.curl) return;
      // la texture per la voltata di carta vera si cuoce da fermi: font
      // incorporati e doppia pagina rasterizzata, pronta prima del tocco
      try {
        const geo = snapRects();
        const host = bookRef.current;
        if (!geo || !host) return;
        const rh = host.getBoundingClientRect();
        const baked = await bakeHtml(p.xml);
        const outW = Math.round(rh.width) - FRAME * 2;
        const outH = Math.round(rh.height) - FRAME * 2;
        // nitido alla densita' dello schermo, ma senza far esplodere la
        // memoria: tre finestre restano in vita per tutta la lettura
        let sc = Math.min(2, window.devicePixelRatio || 1);
        if (outW * outH * sc * sc > 8_000_000) sc = 1;
        const finestra = (offsetX) =>
          rasterize({ baked, w: p.w, h: p.h, offsetX, offsetY: FRAME - geo.y, outW, outH, scale: sc });
        const qui = FRAME - geo.x;
        const img = await finestra(qui);
        texRef.current = { img, baked, w: p.w, h: p.h, x: geo.x, href: p.href, sc, next: null, prev: null };
        // anche le finestre del giro dopo si cuociono da fermi: il layout
        // dell'intero capitolo e' troppo lento per i 400ms del giro, e il
        // retro senza texture atterrava carta nuda
        const delta = rendRef.current?.manager?.layout?.delta;
        if (delta > 0) {
          const mio = texRef.current;
          finestra(qui + delta).then((im) => { if (texRef.current === mio) mio.next = im; }).catch(() => {});
          finestra(qui - delta).then((im) => { if (texRef.current === mio) mio.prev = im; }).catch(() => {});
        }
      } catch {
        texRef.current = null;
      }
    }, 450);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // fa partire il cilindro sul canvas e restituisce la maniglia del giro;
  // il disegno vive fuori da React: sessanta fotogrammi al secondo di
  // colonne che si piegano non sono roba da re-render
  function startCurl(dir, tex, key) {
    try {
      const host = bookRef.current;
      const cv = curlCanvasRef.current;
      if (!host || !cv || curlBroken.current) return null;
      const rh = host.getBoundingClientRect();
      const Wc = Math.round(rh.width) - FRAME * 2;
      const Hc = Math.round(rh.height) - FRAME * 2;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Wc * dpr;
      cv.height = Hc * dpr;
      const ctx = cv.getContext("2d");
      if (!ctx) return null;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // il primo fotogramma si disegna QUI, prima di dichiarare il giro su
      // canvas: se drawImage esplode (certe GPU Android con le immagini
      // SVG), si torna null e parte il palco DOM come se nulla fosse
      const stato = {
        oldImg: tex.img,
        newImg: dir === "next" ? tex.next : tex.prev,
        sc: tex.sc || 1,
        dir,
        start: performance.now(),
        Wc,
        Hc,
      };
      const DUR = 1200;
      const paper = theme.bg;
      const rows = `${theme.fg}14`;
      drawCurl(ctx, { oldImg: stato.oldImg, newImg: stato.newImg, t: 0, dir, Wc, Hc, paper, rows, sc: stato.sc });
      cv.style.display = "block";
      curlRun.current = stato;
      const spegni = () => {
        try { ctx.clearRect(0, 0, Wc, Hc); } catch { /* niente da pulire */ }
        cv.style.display = "none";
        if (curlRun.current === stato) curlRun.current = null;
      };
      const frame = (now) => {
        if (curlRun.current !== stato) return;
        const t = (now - stato.start) / DUR;
        if (t >= 1) {
          spegni();
          return;
        }
        try {
          drawCurl(ctx, { oldImg: stato.oldImg, newImg: stato.newImg, t, dir, Wc, Hc, paper, rows, sc: stato.sc });
        } catch {
          // il canvas ha tradito a giro in corso: si spegne, il palco DOM
          // prende il testimone su questo stesso giro, e per il resto della
          // sessione si vola solo col palco
          curlBroken.current = true;
          spegni();
          setTurning((v) => {
            if (!v || v.key !== key) return v;
            const geo = snapRects();
            return { dir, key, x: geo?.x, y: geo?.y, hw: geo?.hw, href: geo?.href, x2: null, href2: null };
          });
          return;
        }
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
      return stato;
    } catch {
      curlBroken.current = true;
      if (curlCanvasRef.current) curlCanvasRef.current.style.display = "none";
      return null;
    }
  }

  function turn(dir) {
    const r = rendRef.current;
    if (!r || status !== "ready") return;
    moved.current = true;
    const animate =
      isTablet() && settings.flow !== "scrolled" && settings.pageTurn && !reducedMotion();
    // un tocco durante un giro e' fretta: si cambia pagina secco, senza
    // accavallare animazioni (rimontare il palco ricaricherebbe i cloni)
    if (!animate || turningRef.current) {
      step(r, dir);
      return;
    }
    const key = Date.now();
    const geo = snapRects();
    // la strada maestra e' il cilindro di carta vera: parte solo se la
    // texture parcheggiata e' fresca (stesso capitolo, stessa posizione)
    const tex = texRef.current;
    const curl =
      false &&
      pages === 2 &&
      tex &&
      geo &&
      tex.href === geo.href &&
      Math.abs(tex.x - geo.x) < 1;
    if (curl) {
      const stato = startCurl(dir, tex, key);
      if (stato) {
        setTurning({ dir, key, curl: true });
        clearTimeout(turnTimer.current);
        turnTimer.current = setTimeout(() => setTurning(null), 1200);
        swapTimer.current = setTimeout(() => {
          swapTimer.current = null;
          step(r, dir);
          // il retro e' lo stesso capitolo gia' cotto: a scambio avvenuto
          // serve solo la nuova finestra, e il retro resta nascosto ancora
          // per mezzo giro
          setTimeout(async () => {
            try {
              const g2 = snapRects();
              if (!g2 || g2.href !== tex.href) {
                stato.newImg = null;
                return;
              }
              // ai confini di capitolo epub.js scorre di un passo diverso:
              // se la finestra precotta non e' quella vera, si ricuoce
              const delta = rendRef.current?.manager?.layout?.delta || 0;
              const atteso = dir === "next" ? tex.x - delta : tex.x + delta;
              if (stato.newImg && Math.abs(g2.x - atteso) < 1) return;
              const img2 = await rasterize({
                baked: tex.baked,
                w: tex.w,
                h: tex.h,
                offsetX: FRAME - g2.x,
                offsetY: FRAME - g2.y,
                outW: stato.Wc,
                outH: stato.Hc,
                scale: stato.sc,
              });
              if (curlRun.current === stato) stato.newImg = img2;
            } catch { /* il retro restera' carta con righe accennate */ }
          }, 120);
        }, 95);
        return;
      }
    }
    setTurning({ dir, key, x: geo?.x, y: geo?.y, hw: geo?.hw, href: geo?.href, x2: null, href2: null });
    clearTimeout(turnTimer.current);
    turnTimer.current = setTimeout(() => setTurning(null), 1200);
    const doSwap = () => {
      swapTimer.current = null;
      step(r, dir);
      // il retro del foglio mostra la pagina che sta arrivando: il testo e'
      // lo stesso capitolo gia' preparato, serve solo la nuova posizione —
      // una misura, letta a scambio avvenuto, col retro ancora nascosto
      setTimeout(() => {
        const g2 = snapRects();
        if (g2) setTurning((t) => (t && t.key === key ? { ...t, x2: g2.x, href2: g2.href } : t));
      }, 150);
    };
    // il foglio e la copertura sono opachi a 80ms: lo scambio resta invisibile
    swapTimer.current = setTimeout(doSwap, 95);
  }
  turnRef.current = turn;

  function updateSettings(patch) {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveReaderSettings(next);
    if ("terms" in patch) {
      live.current.settings = next;
      clearTerms();
      // i segni si tolgono e si rimettono sulle viste gia' a schermo: non
      // vale la pena rifare il libro da capo per un interruttore
      if (next.terms) rendRef.current?.manager?.views?.forEach?.((v) => markTerms(v));
    }
    if ("curl" in patch) {
      // acceso l'interruttore, le texture del rotolo vanno cotte subito:
      // altrimenti il primo giro parte ancora col palco DOM
      live.current.settings = next;
      texRef.current = null;
      if (next.curl) schedulePark();
    }
    if ("flow" in patch || "spread" in patch || "font" in patch) makeRendition(next);
    else if (rendRef.current && ("theme" in patch || "fontSize" in patch || "lineHeight" in patch)) {
      applyStyles(rendRef.current, next);
      texRef.current = null;
      schedulePark();
    }
  }

  function addMark() {
    if (!live.current.cfi) return;
    // capitolo e pagina, non la percentuale: quella si ricalcola dal CFI a
    // ogni apertura del pannello, mentre un'etichetta congelata in un
    // omnibus arrotondava a "0%" per decine di pagine
    const base = (live.current.href || "").split("#")[0];
    const chap = toc.find((t) => (t.href || "").split("#")[0] === base)?.label || "";
    const label =
      [chap, displayed ? `pag. ${displayed.page}` : ""].filter(Boolean).join(" · ") || "Segnalibro";
    const m = { id: crypto.randomUUID(), cfi: live.current.cfi, label, createdAt: Date.now() };
    const next = [...marks, m];
    setMarks(next);
    saveMarks(book.id, next);
    notify("Segnalibro riposto tra le pagine 📑");
  }

  function markPct(cfi) {
    const eb = epubRef.current;
    if (!eb || !locReady) return null;
    try {
      const p = eb.locations.percentageFromCfi(cfi);
      if (!Number.isFinite(p)) return null;
      const v = p * 100;
      return (v < 10 ? v.toFixed(1) : String(Math.round(v))).replace(".", ",");
    } catch {
      return null;
    }
  }

  function removeMark(m) {
    const next = marks.filter((x) => x.id !== m.id);
    setMarks(next);
    saveMarks(book.id, next);
  }

  function applyHighlight(color) {
    if (!selMenu) return;
    const h = {
      id: crypto.randomUUID(),
      cfi: selMenu.cfi,
      text: selMenu.text.slice(0, 400),
      color,
      createdAt: Date.now(),
    };
    addAnnotation(rendRef.current, h);
    const next = [...hls, h];
    setHls(next);
    saveHighlights(book.id, next);
    setSelMenu(null);
  }

  // Il segno nel testo apre la stessa scheda della selezione, senza passare
  // dalla rete: la voce ce l'abbiamo gia' in mano.
  function openTerm(e) {
    setDict({
      word: e.t,
      loading: false,
      entries: [],
      gloss: { ...e, wiki: wikiUrl(e.t) },
      found: [e],
    });
    setPanel("dict");
  }

  function clearTerms() {
    for (const cfi of termCfis.current) {
      try { rendRef.current?.annotations.remove(cfi, "highlight"); } catch { /* vista gia' smontata */ }
    }
    termCfis.current = [];
    markedRef.current.clear();
    // spenti i segni, il tocco sulla parola torna a essere un cambio pagina
    termsRef.current = null;
  }

  // Il glossario di casa risponde subito e anche offline, quindi si mostra
  // appena c'e'; il dizionario in rete arriva dopo e completa la scheda.
  // Su una frase lunga la rete non serve a nulla: e' il modo di dire che si
  // vuole capire, e quello sta nel glossario.
  async function defineSelection() {
    const raw = selMenu?.text || "";
    const context = selMenu?.context || "";
    const word = cleanWord(raw);
    if (!word) return;
    setSelMenu(null);
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

  function saveNotes(next) {
    setHls(next);
    saveHighlights(book.id, next);
  }

  function removeHighlight(h) {
    try { rendRef.current?.annotations.remove(h.cfi, "highlight"); } catch { /* vista non montata */ }
    const next = hls.filter((x) => x.id !== h.id);
    setHls(next);
    saveHighlights(book.id, next);
  }

  async function runSearch() {
    const q = query.trim();
    if (!q || searchState.busy) return;
    setSearchState({ busy: true, results: null });
    const results = await searchBook(epubRef.current, q);
    setSearchState({ busy: false, results });
  }

  function goTo(target, flash) {
    const r = rendRef.current;
    if (!r) return;
    moved.current = true;
    const arrivo = r.display(target);
    setPanel(null);
    if (!flash) return;
    // il risultato trovato si accende per qualche secondo: serve solo a far
    // atterrare l'occhio sul punto, poi la pagina torna pulita
    arrivo?.then?.(() => {
      try {
        r.annotations.highlight(target, {}, undefined, "bc-found", {
          fill: C.accent,
          "fill-opacity": "0.4",
        });
        setTimeout(() => {
          try { r.annotations.remove(target, "highlight"); } catch { /* vista smontata */ }
        }, 2600);
      } catch {
        /* cfi senza range: si arriva comunque alla pagina */
      }
    });
  }

  // Fuori dal capitolo il tocco moriva: cornice, taglio delle pagine e
  // margine attorno al libro non voltavano nulla, proprio dove il pollice
  // si appoggia tenendo il tablet. Qui arrivano solo i tocchi sul libro o
  // sullo sfondo — barre, pannelli e menu sono altri elementi e si fermano
  // da soli, altrimenti ogni loro bottone avrebbe cambiato pagina.
  function tapAside(e) {
    if (!isTouch()) return;
    const root = rootRef.current;
    const target = e.target;
    if (target !== root && !bookRef.current?.contains(target)) return;
    if (selMenu) return setSelMenu(null);
    if (paginated && status === "ready") {
      const rel = e.clientX / (window.innerWidth || 1);
      if (rel < TAP_PREV) return turn("prev");
      if (rel > TAP_NEXT) return turn("next");
    }
    setChrome((v) => !v);
  }

  const pct = Math.round((progress || 0) * 100);
  const paginated = settings.flow !== "scrolled";
  const twoUp = paginated && pages === 2;
  const p = Math.min(1, Math.max(0, progress || 0));
  const edgeRead = EDGE_MIN + Math.round((EDGE_MAX - EDGE_MIN) * p);
  const edgeLeftToRead = EDGE_MIN + Math.round((EDGE_MAX - EDGE_MIN) * (1 - p));
  const pagesLeft = displayed ? Math.max(0, displayed.total - displayed.page) : 0;
  // speed e' il tempo fra un cambio pagina e l'altro, e in doppia pagina un
  // cambio ne avanza due: le pagine rimaste vanno divise per il foglio, non
  // moltiplicate — sbagliando verso la stima usciva quattro volte troppo lunga
  const turnsLeft = Math.ceil(pagesLeft / Math.max(1, pages));
  const chapterLeft = speed && turnsLeft > 0 ? formatLeft(turnsLeft * speed) : null;

  // il palco della voltata resta sempre montato: la geometria segue la
  // direzione dell'ultimo giro (o "next" da fermo, tanto e' invisibile)
  const stage = turning && !turning.curl ? turning : null;
  const dirNow = stage?.dir || "next";
  const leafGeom =
    dirNow === "next"
      ? {
          left: twoUp ? "50%" : FRAME,
          right: FRAME,
          transformOrigin: "left center",
          borderRadius: "4px 6px 6px 4px",
          backgroundImage:
            "linear-gradient(115deg, #ffffff0d, transparent 45%), linear-gradient(to right, #00000030, transparent 28%, transparent 62%, #00000012 86%, #00000024 100%)",
          boxShadow: "-26px 0 70px #0000003d",
          animationName: "bc-leaf-next",
        }
      : {
          left: FRAME,
          right: twoUp ? "50%" : FRAME,
          transformOrigin: "right center",
          borderRadius: "6px 4px 4px 6px",
          backgroundImage:
            "linear-gradient(245deg, #ffffff0d, transparent 45%), linear-gradient(to left, #00000030, transparent 28%, transparent 62%, #00000012 86%, #00000024 100%)",
          boxShadow: "26px 0 70px #0000003d",
          animationName: "bc-leaf-prev",
        };
  // niente attore parte nudo: il clone si mostra solo se la fotografia
  // pronta e' del capitolo giusto per quella faccia
  const anim = (name) => (stage ? `${name} 1.1s ease-in-out forwards` : "none");
  const frontOk = !!(stage && park && stage.href && park.href === stage.href);
  const backOk = !!(stage && park && stage.href2 && park.href === stage.href2 && stage.x2 !== null);

  return (
    <div
      ref={rootRef}
      onClick={tapAside}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 45,
        background: "linear-gradient(165deg, #171322 0%, #0b0914 70%)",
        animation: "bc-fade-in 0.45s ease-out",
        overflow: "hidden",
      }}
    >
      <div
        ref={bookRef}
        style={{
          position: "absolute",
          left: "clamp(3px, 0.9vw, 10px)",
          right: "clamp(3px, 0.9vw, 10px)",
          // il libro non si muove mai: le barre vanno e vengono sopra i
          // margini di testa e piede, che restano vuoti apposta
          top: "clamp(3px, 0.9vw, 10px)",
          bottom: "clamp(3px, 0.9vw, 10px)",
          borderRadius: 12,
          background: theme.cover || theme.bg,
          border: "1px solid #00000066",
          boxShadow: `0 14px 44px #000000b3, 0 0 0 1px ${C.accent}22, inset 0 0 30px #00000026`,
          overflow: "hidden",
          perspective: 1500,
          touchAction: "manipulation",
        }}
      >
        <div
          ref={viewerRef}
          style={{
            position: "absolute",
            inset: FRAME,
            padding: `${HEAD}px ${Math.max(settings.margin, EDGE_MAX + 8)}px calc(${FOOT}px + env(safe-area-inset-bottom))`,
            boxSizing: "border-box",
            borderRadius: 3,
            // la carta arriva fino al bordo interno della rilegatura: senza,
            // il margine di lettura mostrava la copertina e staccava le
            // pagine impilate dal foglio
            background: theme.bg,
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: FRAME,
            top: FRAME,
            bottom: FRAME,
            width: edgeRead,
            zIndex: 4,
            pointerEvents: "none",
            // stessa altezza e stesso raggio della carta: staccata anche di
            // pochi px, la pila lasciava toppe scoperte verso gli angoli
            borderRadius: "3px 2px 2px 3px",
            backgroundColor: theme.bg,
            backgroundImage: EDGE_STRIPES,
            boxShadow: "inset -7px 0 9px -7px #00000066, 1px 0 2px #00000033",
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            right: FRAME,
            top: FRAME,
            bottom: FRAME,
            width: edgeLeftToRead,
            zIndex: 4,
            pointerEvents: "none",
            borderRadius: "2px 3px 3px 2px",
            backgroundColor: theme.bg,
            backgroundImage: EDGE_STRIPES,
            boxShadow: "inset 7px 0 9px -7px #00000066, -1px 0 2px #00000033",
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: FRAME,
            bottom: FRAME,
            left: FRAME,
            width: 16,
            zIndex: 4,
            pointerEvents: "none",
            background: "linear-gradient(90deg, #00000033, transparent)",
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: FRAME,
            bottom: FRAME,
            right: FRAME,
            width: 16,
            zIndex: 4,
            pointerEvents: "none",
            background: "linear-gradient(270deg, #00000033, transparent)",
          }}
        />
        {twoUp && (
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: FRAME,
              bottom: FRAME,
              left: "50%",
              width: 150,
              transform: "translateX(-50%)",
              zIndex: 4,
              pointerEvents: "none",
              background:
                "linear-gradient(90deg, transparent, #0000000d 18%, #0000001c 32%, #00000030 42%, #00000042 50%, #00000030 58%, #0000001c 68%, #0000000d 82%, transparent)",
            }}
          />
        )}
        {twoUp && (
          <>
            <div
              data-cover={dirNow}
              aria-hidden="true"
              style={{
                position: "absolute",
                top: FRAME,
                bottom: FRAME,
                ...(dirNow === "next" ? { left: FRAME, right: "50%" } : { left: "50%", right: FRAME }),
                zIndex: 5,
                pointerEvents: "none",
                visibility: stage ? "visible" : "hidden",
                opacity: 0,
                backgroundColor: theme.bg,
                backgroundImage:
                  dirNow === "next"
                    ? "linear-gradient(to right, transparent 70%, #0000001f)"
                    : "linear-gradient(to left, transparent 70%, #0000001f)",
                animation: anim("bc-cover-half"),
                // stessi angoli con cui il foglio si posa: dagli spigoli
                // quadri della copertura sbucava il testo vecchio
                clipPath: `inset(0 round ${dirNow === "next" ? "6px 4px 4px 6px" : "4px 6px 6px 4px"})`,
                overflow: "hidden",
              }}
            >
              <div
                aria-hidden="true"
                style={{ position: "absolute", inset: "7% 9%", backgroundImage: PRINT_ROWS(theme.fg) }}
              />
              <StageFrame
                park={park}
                shown={frontOk}
                x={stage?.x}
                y={stage?.y}
                base={dirNow === "next" ? FRAME : (stage?.hw ?? 0) / 2}
              />
              {/* il taglio delle pagine non deve sparire mentre la faccia
                  copre il bordo: si replica sul lato esterno */}
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  ...(dirNow === "next" ? { left: 0 } : { right: 0 }),
                  width: dirNow === "next" ? edgeRead : edgeLeftToRead,
                  backgroundColor: theme.bg,
                  backgroundImage: EDGE_STRIPES,
                }}
              />
            </div>
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                top: FRAME,
                bottom: FRAME,
                ...(dirNow === "next" ? { left: FRAME, right: "50%" } : { left: "50%", right: FRAME }),
                zIndex: 5,
                pointerEvents: "none",
                visibility: stage ? "visible" : "hidden",
                opacity: 0,
                background:
                  dirNow === "next"
                    ? "linear-gradient(to left, #00000047, #00000024 34%, #0000000f 58%, transparent 88%)"
                    : "linear-gradient(to right, #00000047, #00000024 34%, #0000000f 58%, transparent 88%)",
                animation: anim("bc-cast"),
              }}
            />
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                top: FRAME,
                bottom: FRAME,
                left: "50%",
                width: 240,
                transform: "translateX(-50%)",
                zIndex: 5,
                pointerEvents: "none",
                visibility: stage ? "visible" : "hidden",
                opacity: 0,
                background:
                  "linear-gradient(90deg, transparent, #00000012 22%, #00000026 38%, #00000030 50%, #00000026 62%, #00000012 78%, transparent)",
                animation: anim("bc-spine-pulse"),
              }}
            />
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: FRAME,
                zIndex: 6,
                pointerEvents: "none",
                visibility: stage ? "visible" : "hidden",
                // L'involucro presta solo la prospettiva, e deve coprire il
                // libro INTERO: il punto di fuga sta al suo centro, cioe' sul
                // dorso. Stretto su meta' pagina il fuoco cadeva fuori asse e
                // il foglio, arrivando, si posava una spanna piu' in la' della
                // pagina — sotto restava la striscia di quella vecchia.
                // Qualsiasi opacita' qui (anche agli estremi della
                // dissolvenza) appiattisce la scena e stampa le due facce una
                // sopra l'altra.
                //
                // Il punto di vista sta LONTANO. Da vicino (1500) il foglio,
                // ruotando, si avvicinava all'occhio e cresceva fino a meta'
                // in piu': il testo diventava piu' grande di quello della
                // pagina e sbordava sopra e sotto, tagliato dalla cornice.
                // Da qui la crescita resta sotto il margine bianco della
                // pagina, quindi il ritaglio non tocca il testo — e il foglio
                // non va rimpicciolito per stare dentro, cosa che si vedeva
                // subito: sembrava una paginetta diversa dalle altre.
                perspective: 6800,
              }}
            >
              <div
                data-flip={dirNow}
                aria-hidden="true"
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  ...(dirNow === "next" ? { left: "50%", right: 0 } : { left: 0, right: "50%" }),
                  transformOrigin: leafGeom.transformOrigin,
                  // niente overflow ne' opacita' qui: appiattirebbero il 3D
                  // e le due facce diventerebbero una sola
                  transformStyle: "preserve-3d",
                  willChange: "transform",
                  animation: stage
                    ? `${leafGeom.animationName} 1.1s cubic-bezier(0.3, 0.45, 0.35, 1) forwards`
                    : "none",
                }}
              >
                {/* l'ombra portata sta su un piano suo: il clip-path delle
                    facce la taglierebbe via insieme a tutto cio' che sborda */}
                <div
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    inset: 0,
                    // mezzo pixel dietro le facce: piani coincidenti in 3D
                    // si contendono la profondita' e sfarfallano sulla GPU
                    transform: "translateZ(-0.5px)",
                    borderRadius: leafGeom.borderRadius,
                    boxShadow: leafGeom.boxShadow,
                    opacity: 0,
                    animation: anim("bc-leaf-fade"),
                  }}
                />
                {/* faccia davanti: la pagina che sta partendo. La dissolvenza
                    vive qui, sulle facce piatte, e il ritaglio degli angoli
                    e' clip-path: overflow+raggio non vengono onorati
                    sull'iframe composito dentro il 3D */}
                <div
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    inset: 0,
                    overflow: "hidden",
                    borderRadius: leafGeom.borderRadius,
                    clipPath: `inset(0 round ${leafGeom.borderRadius})`,
                    backfaceVisibility: "hidden",
                    // bordo trasparente: senza, i bordi ruotati escono
                    // seghettati dal compositore Android
                    outline: "1px solid transparent",
                    transform: "translateZ(0.5px)",
                    backgroundColor: theme.bg,
                    backgroundImage: leafGeom.backgroundImage,
                    opacity: 0,
                    // due animazioni sulla stessa faccia: quando si accende,
                    // e come si incurva il bordo libero mentre gira
                    animation: anim("bc-leaf-front"),
                  }}
                >
                  <div
                    aria-hidden="true"
                    style={{ position: "absolute", inset: "7% 9%", backgroundImage: PRINT_ROWS(theme.fg) }}
                  />
                  <StageFrame
                    park={park}
                    shown={frontOk}
                    x={stage?.x}
                    y={stage?.y}
                    base={dirNow === "next" ? (stage?.hw ?? 0) / 2 : FRAME}
                  />
                  <div
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      top: 0,
                      bottom: 0,
                      ...(dirNow === "next" ? { right: 0 } : { left: 0 }),
                      width: dirNow === "next" ? edgeLeftToRead : edgeRead,
                      backgroundColor: theme.bg,
                      backgroundImage: EDGE_STRIPES,
                    }}
                  />
                  <div
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      inset: 0,
                      opacity: 0,
                      background:
                        dirNow === "next"
                          ? "linear-gradient(to right, #00000052, #00000026)"
                          : "linear-gradient(to left, #00000052, #00000026)",
                      animation: anim("bc-leaf-shade"),
                    }}
                  />
                  {/* il riflesso che rotola: la luce scorre da un bordo
                      all'altro e la carta smette di sembrare una tavola */}
                  <div
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      top: 0,
                      bottom: 0,
                      left: "-30%",
                      width: "60%",
                      opacity: 0,
                      background:
                        "linear-gradient(90deg, transparent, #fff6e055 38%, #fff6e07a 50%, #fff6e055 62%, transparent)",
                      animation: stage
                        ? `bc-leaf-gloss-${dirNow} 1.1s cubic-bezier(0.3, 0.45, 0.35, 1) forwards`
                        : "none",
                    }}
                  />
                  <div
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      top: 0,
                      bottom: 0,
                      ...(dirNow === "next" ? { right: 0 } : { left: 0 }),
                      width: 7,
                      background:
                        dirNow === "next"
                          ? "linear-gradient(to left, #00000038, transparent)"
                          : "linear-gradient(to right, #00000038, transparent)",
                    }}
                  />
                </div>
                {/* faccia dietro: la pagina che sta arrivando — stesso
                    capitolo gia' preparato, solo la posizione post-scambio;
                    il rotateY(180) della faccia annulla lo specchio della
                    rotazione del foglio */}
                <div
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    inset: 0,
                    overflow: "hidden",
                    borderRadius: leafGeom.borderRadius,
                    clipPath: `inset(0 round ${leafGeom.borderRadius})`,
                    backfaceVisibility: "hidden",
                    outline: "1px solid transparent",
                    transform: "rotateY(180deg) translateZ(0.5px)",
                    backgroundColor: theme.bg,
                    backgroundImage: leafGeom.backgroundImage,
                    opacity: 0,
                    animation: anim("bc-leaf-back"),
                  }}
                >
                  <div
                    aria-hidden="true"
                    style={{ position: "absolute", inset: "7% 9%", backgroundImage: PRINT_ROWS(theme.fg) }}
                  />
                  <StageFrame
                    park={park}
                    shown={backOk}
                    x={stage?.x2}
                    y={stage?.y}
                    base={dirNow === "next" ? FRAME : (stage?.hw ?? 0) / 2}
                  />
                  <div
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      top: 0,
                      bottom: 0,
                      ...(dirNow === "next" ? { left: 0 } : { right: 0 }),
                      width: dirNow === "next" ? edgeRead : edgeLeftToRead,
                      backgroundColor: theme.bg,
                      backgroundImage: EDGE_STRIPES,
                    }}
                  />
                  <div
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      inset: 0,
                      opacity: 0,
                      background:
                        dirNow === "next"
                          ? "linear-gradient(to left, #00000052, #00000026)"
                          : "linear-gradient(to right, #00000052, #00000026)",
                      animation: anim("bc-leaf-shade"),
                    }}
                  />
                  {/* il riflesso che rotola: la luce scorre da un bordo
                      all'altro e la carta smette di sembrare una tavola */}
                  <div
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      top: 0,
                      bottom: 0,
                      left: "-30%",
                      width: "60%",
                      opacity: 0,
                      background:
                        "linear-gradient(90deg, transparent, #fff6e055 38%, #fff6e07a 50%, #fff6e055 62%, transparent)",
                      animation: stage
                        ? `bc-leaf-gloss-${dirNow} 1.1s cubic-bezier(0.3, 0.45, 0.35, 1) forwards`
                        : "none",
                    }}
                  />
                </div>
              </div>
            </div>
          </>
        )}
        {paginated && !twoUp && (
          <div
            data-flip={dirNow}
            aria-hidden="true"
            style={{
              position: "absolute",
              top: FRAME,
              bottom: FRAME,
              left: FRAME,
              right: FRAME,
              zIndex: 6,
              pointerEvents: "none",
              visibility: stage ? "visible" : "hidden",
              opacity: 0,
              borderRadius: 3,
              backgroundColor: theme.bg,
              overflow: "hidden",
              willChange: "opacity",
              animation: stage ? "bc-sheet-fade 0.5s ease-out forwards" : "none",
            }}
          >
            {/* il velo porta la pagina che parte: la dissolvenza diventa un
                incrocio fra testo vero e testo vero */}
            <StageFrame park={park} shown={frontOk} x={stage?.x} y={stage?.y} base={FRAME} />
          </div>
        )}
        {/* il cilindro di carta vera: quando la texture e' pronta il giro
            si disegna qui, colonna per colonna, e il palco DOM riposa */}
        <canvas
          ref={curlCanvasRef}
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: FRAME,
            width: `calc(100% - ${FRAME * 2}px)`,
            height: `calc(100% - ${FRAME * 2}px)`,
            zIndex: 6,
            pointerEvents: "none",
            display: "none",
          }}
        />
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
            background: theme.bg,
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
            background: theme.bg,
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

      {paginated && status === "ready" && !isTouch() && (
        <>
          <button
            aria-label="Pagina precedente"
            onClick={() => turn("prev")}
            style={{ position: "absolute", left: 0, top: "12%", bottom: "12%", width: "22%", zIndex: 10, cursor: "w-resize", touchAction: "manipulation" }}
          />
          <button
            aria-label="Pagina successiva"
            onClick={() => turn("next")}
            style={{ position: "absolute", right: 0, top: "12%", bottom: "12%", width: "26%", zIndex: 10, cursor: "e-resize", touchAction: "manipulation" }}
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
            <button onClick={() => setPanel(panel === "search" ? null : "search")} style={barBtn(panel === "search")} aria-label="Cerca">🔍</button>
            <button onClick={() => setPanel(panel === "toc" ? null : "toc")} style={barBtn(panel === "toc")} aria-label="Indice">☰</button>
            <button onClick={() => setPanel(panel === "marks" ? null : "marks")} style={barBtn(panel === "marks")} aria-label="Segnalibri">📑</button>
            <button onClick={() => setPanel(panel === "hl" ? null : "hl")} style={barBtn(panel === "hl")} aria-label="Evidenziazioni">🖍️</button>
            {document.fullscreenEnabled && (
              <button onClick={toggleFullscreen} style={barBtn(isFs)} aria-label={isFs ? "Esci da schermo intero" : "Schermo intero"}>
                {isFs ? "⛶" : "⛶"}
              </button>
            )}
            <button onClick={() => setPanel(panel === "settings" ? null : "settings")} style={{ ...barBtn(panel === "settings"), fontFamily: FONT_TITLE, fontSize: 17 }} aria-label="Impostazioni">Aa</button>
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
              max={1000}
              value={Math.round((progress || 0) * 1000)}
              disabled={!locReady}
              onChange={(e) => {
                if (!locReady) return;
                const cfi = epubRef.current.locations.cfiFromPercentage(parseInt(e.target.value, 10) / 1000);
                moved.current = true;
                if (cfi) rendRef.current?.display(cfi);
              }}
              style={{ width: "100%", accentColor: C.accent }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: C.muted, marginTop: 2 }}>
              <span>{locReady ? `${pct}%` : "misuro le pagine…"}</span>
              <span>
                {settings.flow === "scrolled"
                  ? "scorrimento"
                  : [
                      displayed ? pageLabel(displayed, pages) : null,
                      chapterLeft
                        ? `${chapterLeft.startsWith("meno") ? "" : "~"}${chapterLeft} alla fine`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "pagine"}
              </span>
            </div>
          </div>
        </>
      )}

      {selMenu && (
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
            boxShadow: `0 8px 30px #00000088`,
            animation: "bc-fade-in 0.2s ease-out",
          }}
        >
          {HL_COLORS.map((c) => (
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
          {wordCount(selMenu.text) <= PHRASE_WORDS && (
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
              {wordCount(selMenu.text) > 1 ? "🔎 Significato" : "📖 Definisci"}
            </button>
          )}
          <button onClick={() => setSelMenu(null)} style={{ color: C.muted, fontSize: 14, marginLeft: 4 }}>
            Annulla
          </button>
        </div>
      )}

      {panel === "settings" && (
        <Panel title="Il tuo modo di leggere" onClose={() => setPanel(null)}>
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            {Object.entries(READER_THEMES).map(([id, t]) => (
              <button
                key={id}
                onClick={() => updateSettings({ theme: id })}
                style={{
                  flex: 1,
                  padding: "12px 4px",
                  borderRadius: 10,
                  background: t.bg,
                  color: t.fg,
                  fontSize: 13.5,
                  border: `2px solid ${settings.theme === id ? C.accent : C.border}`,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div style={{ marginBottom: 14 }}>
            <span style={{ display: "block", fontSize: 14.5, color: C.muted, marginBottom: 6 }}>Carattere</span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {READER_FONTS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => updateSettings({ font: f.id })}
                  style={{
                    padding: "7px 14px",
                    borderRadius: 999,
                    fontSize: 14,
                    fontFamily: f.css || "inherit",
                    border: `1px solid ${settings.font === f.id ? C.accent : C.border}`,
                    color: settings.font === f.id ? C.accent : C.muted,
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <Stepper
            label="Dimensione testo"
            value={`${settings.fontSize}%`}
            onDec={() => updateSettings({ fontSize: Math.max(70, settings.fontSize - 10) })}
            onInc={() => updateSettings({ fontSize: Math.min(180, settings.fontSize + 10) })}
          />
          <Stepper
            label="Interlinea"
            value={settings.lineHeight.toFixed(1)}
            onDec={() => updateSettings({ lineHeight: Math.max(1.1, +(settings.lineHeight - 0.1).toFixed(1)) })}
            onInc={() => updateSettings({ lineHeight: Math.min(2.2, +(settings.lineHeight + 0.1).toFixed(1)) })}
          />
          <Stepper
            label="Margini"
            value={`${settings.margin}px`}
            onDec={() => updateSettings({ margin: Math.max(0, settings.margin - 12) })}
            onInc={() => updateSettings({ margin: Math.min(96, settings.margin + 12) })}
          />
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <button
              onClick={() => updateSettings({ flow: "paginated" })}
              style={{
                flex: 1, padding: "9px 0", borderRadius: 10, fontSize: 14,
                border: `1px solid ${paginated ? C.accent : C.border}`,
                color: paginated ? C.accent : C.muted,
              }}
            >
              Pagine
            </button>
            <button
              onClick={() => updateSettings({ flow: "scrolled" })}
              style={{
                flex: 1, padding: "9px 0", borderRadius: 10, fontSize: 14,
                border: `1px solid ${!paginated ? C.accent : C.border}`,
                color: !paginated ? C.accent : C.muted,
              }}
            >
              Scorrimento
            </button>
            <button
              onClick={() => updateSettings({ spread: settings.spread === "auto" ? "none" : "auto" })}
              disabled={!paginated}
              style={{
                flex: 1, padding: "9px 0", borderRadius: 10, fontSize: 14,
                border: `1px solid ${C.border}`,
                color: paginated ? C.muted : C.dim,
              }}
            >
              {settings.spread === "auto" ? "Doppia: auto" : "Pagina singola"}
            </button>
          </div>
          {glossaryOf(book) && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <span style={{ fontSize: 14.5, color: C.muted }}>Segna i termini della saga</span>
              <button
                onClick={() => updateSettings({ terms: !settings.terms })}
                style={{
                  padding: "6px 16px",
                  borderRadius: 999,
                  fontSize: 14,
                  border: `1px solid ${settings.terms ? C.arcane : C.border}`,
                  color: settings.terms ? C.arcane : C.muted,
                  background: settings.terms ? `${C.arcane}14` : "transparent",
                }}
              >
                {settings.terms ? "Attivo 📖" : "Spento"}
              </button>
            </div>
          )}
          {isTablet() && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <span style={{ fontSize: 14.5, color: C.muted }}>Voltapagina animato</span>
              <button
                onClick={() => updateSettings({ pageTurn: !settings.pageTurn })}
                style={{
                  padding: "6px 16px",
                  borderRadius: 999,
                  fontSize: 14,
                  border: `1px solid ${settings.pageTurn ? C.accent : C.border}`,
                  color: settings.pageTurn ? C.accent : C.muted,
                  background: settings.pageTurn ? `${C.accent}14` : "transparent",
                }}
              >
                {settings.pageTurn ? "Attivo ✨" : "Spento"}
              </button>
            </div>
          )}
          <Slider
            label="Filtro notte caldo"
            min={0} max={0.45} step={0.05}
            value={settings.warmth}
            onChange={(v) => updateSettings({ warmth: v })}
          />
          <Slider
            label="Luminosità"
            min={0.4} max={1} step={0.05}
            value={settings.brightness}
            onChange={(v) => updateSettings({ brightness: v })}
          />
        </Panel>
      )}

      {panel === "toc" && (
        <Panel title="Indice" onClose={() => setPanel(null)}>
          {toc.length === 0 ? (
            <p style={{ color: C.muted }}>Questo tomo non ha un indice.</p>
          ) : (
            toc.map((t, i) => (
              <button
                key={i}
                onClick={() => goTo(t.href)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 6px",
                  paddingLeft: 6 + t.depth * 18,
                  fontSize: 15,
                  color: t.depth === 0 ? C.text : C.muted,
                  borderBottom: `1px solid ${C.border}44`,
                }}
              >
                {t.label}
              </button>
            ))
          )}
        </Panel>
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
            marks.map((m) => {
              const pct = markPct(m.cfi);
              const stale = /^Segnalibro( al \d+%)?$/.test(m.label);
              const title = stale && pct ? `Segnalibro al ${pct}%` : m.label;
              const sub = [
                pct && !stale ? `al ${pct}%` : "",
                new Date(m.createdAt).toLocaleString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
              ].filter(Boolean).join(" · ");
              return (
              <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, borderBottom: `1px solid ${C.border}44` }}>
                <button
                  onClick={() => goTo(m.cfi)}
                  style={{ flex: 1, textAlign: "left", padding: "11px 6px", fontSize: 15, color: C.text }}
                >
                  {title}
                  <span style={{ display: "block", fontSize: 12.5, color: C.muted }}>
                    {sub}
                  </span>
                </button>
                <button onClick={() => removeMark(m)} aria-label="Elimina segnalibro" style={{ color: C.muted, padding: 8 }}>🗑</button>
              </div>
              );
            })
          )}
        </Panel>
      )}

      {panel === "hl" && (
        <Panel title="Evidenziazioni" onClose={() => setPanel(null)}>
          <HighlightList
            highlights={hls}
            onGoTo={(h) => goTo(h.cfi)}
            onChange={saveNotes}
            onRemove={removeHighlight}
            empty="Seleziona un passaggio nel testo per evidenziarlo: lo ritroverai qui."
          />
        </Panel>
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

      {panel === "dict" && (
        <DictionaryCard dict={dict} book={book} bottom={chrome ? 92 : 26} onClose={() => setPanel(null)} />
      )}
      {panel === "search" && (
        <Panel title="Cerca nel libro" onClose={() => setPanel(null)}>
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
              {searchState.busy ? "…" : "Cerca"}
            </button>
          </div>
          {searchState.busy && <p style={{ color: C.muted }}>Sfoglio le pagine…</p>}
          {searchState.results && searchState.results.length === 0 && (
            <p style={{ color: C.muted }}>Nessuna traccia di «{query}» in questo tomo.</p>
          )}
          {searchState.results?.map((r, i) => (
            <button
              key={i}
              onClick={() => goTo(r.cfi, true)}
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
              {r.excerpt}
            </button>
          ))}
        </Panel>
      )}
    </div>
  );
}
