import { useCallback, useEffect, useRef, useState } from "react";
import { C, FONT_TITLE, F, R } from "../data/constants.js";
import { getAux, putAux } from "../lib/bookStore.js";
import { ensureLocalFile } from "../lib/sync.js";
import {
  getCfi, setCfi, getMarks, saveMarks, getHighlights, saveHighlights,
} from "../lib/annotations.js";
import { getProgress, setProgress, setStatus, getStatus, loadBooks } from "../lib/library.js";
// il tetto alle schede tenute da parte sta col resto della cache, o le
// due copie prenderebbero strade diverse
import { leggiSchede, scriviSchede, riponi, tocca, daTenere, MAX_SCHEDE } from "../lib/schedeCache.js";
import { schedaChiE, nuoveMenzioni } from "../lib/chiSono.js";
import { schedaRiassunto } from "../lib/trama.js";
import { sembraUnNome } from "../lib/nomi.js";
import {
  READER_THEMES, READER_FONTS, HL_COLORS, loadReaderSettings, saveReaderSettings,
} from "../lib/readerSettings.js";
import { contentStyles, spegniVuoti, togliStacco } from "../lib/readerTheme.js";
import { ritaglioAvanzo, flattenToc } from "../lib/readerLayout.js";
import { searchBook } from "../lib/epubSearch.js";
import { lookup, lookupPhrase, wordCount, cleanWord } from "../lib/dictionary.js";
import { explain, termIndex, normalize, wikiUrl, haGlossario } from "../lib/glossary.js";
import { contextAround } from "../lib/oracle.js";
import { sillaba } from "../lib/hyphens.js";
import { leftoverScroll } from "../lib/spread.js";
import BookCover from "./BookCover.jsx";
import HighlightList from "./HighlightList.jsx";
import DictionaryCard from "./DictionaryCard.jsx";
import SchedaOracolo, { attese } from "./SchedaOracolo.jsx";

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
// fasce laterali del tocco: valgono su tutta la larghezza dello schermo,
// cornice e taglio delle pagine compresi, non solo dentro al capitolo
const TAP_PREV = 0.28;
const TAP_NEXT = 0.72;
// tetto ai segni per capitolo: la pagina resta una pagina, non un elenco
const MARKS_PER_CHAPTER = 60;
// Oltre questa lunghezza la selezione non e' piu' una frase ma un brano, e
// cercarci dentro un modo di dire non ha senso.
const NET_WORDS = 30;
// la selezione da capire e' spesso un paragrafo intero — il parlato
// biascicato si decifra tutto insieme — quindi il pulsante deve esserci
// anche li'.
const PHRASE_WORDS = 300;
// tre locations da 600 caratteri fanno all'incirca una facciata stampata
const POSIZIONI_PER_PAGINA = 3;
const isTouch = () => navigator.maxTouchPoints > 0;
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



const barBtn = (active) => ({
  width: 40,
  height: 40,
  borderRadius: R.piccolo,
  fontSize: F.titoletto,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: active ? C.accent : C.text,
  background: active ? `${C.accent}1a` : "transparent",
});

function Stepper({ label, value, onDec, onInc }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
      <span style={{ fontSize: F.nota, color: C.muted }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onDec} style={{ ...barBtn(false), border: `1px solid ${C.border}` }}>−</button>
        <span style={{ minWidth: 52, textAlign: "center", fontSize: F.corpo }}>{value}</span>
        <button onClick={onInc} style={{ ...barBtn(false), border: `1px solid ${C.border}` }}>＋</button>
      </div>
    </div>
  );
}

function Slider({ label, min, max, step, value, onChange }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: F.nota, color: C.muted, marginBottom: 4 }}>
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
          <h3 style={{ fontFamily: FONT_TITLE, fontSize: F.titoletto, fontWeight: 600, color: C.text }}>{title}</h3>
          <button onClick={onClose} style={barBtn(false)}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function Reader({ book, startCfi, nextBook, onReadNext, music, onMusicToggle, onMusicStop, onMusicVolume, onMusicNext, onMusicRoom, onAlive, onClose, notify }) {
  const viewerRef = useRef(null);
  const rootRef = useRef(null);
  const bookRef = useRef(null);
  const epubRef = useRef(null);
  const rendRef = useRef(null);
  const saveTimer = useRef(null);
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
  const [isFs, setIsFs] = useState(false);
  // il velo color carta sul passo indietro oltre il confine: copre la
  // ricostruzione del capitolo (vedi step) e cade a misura ferma
  const [velo, setVelo] = useState(false);
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
    clearTimeout(reflowTimer.current);
    reflowTimer.current = setTimeout(() => { reflowing.current = false; }, 1500);
  }, []);

  // L'AVANZO DI RIGA: i pixel che restano in fondo alla colonna quando la
  // sua altezza non e' un multiplo esatto dell'altezza di riga. Si toglie
  // quell'avanzo dal riquadro, cosi' la colonna finisce dove finisce una
  // riga e non a meta' dello spazio della successiva.
  //
  // E' una delle meccaniche tolte quando il reader e' stato spogliato:
  // rimessa da sola, su richiesta esplicita del lettore. Le tre regole che
  // la tengono innocua stanno qui sotto, e sono quelle che mancavano al
  // primo tentativo — che impediva al libro di aprirsi.
  const [avanzo, setAvanzo] = useState(0);
  const avanzoRef = useRef(0);
  const avanzoTimer = useRef(null);
  // (1) MAI MENTRE EPUB.JS STA MONTANDO. Misurare da dentro `rendered` e
  // rientrargli con un resize mentre la `display` e' ancora per aria gli
  // distrugge le viste sotto i piedi: "this.resources is undefined", e il
  // libro non si apriva affatto. Questo interruttore si alza solo quando
  // la prima `display` ha finito, e si riabbassa a ogni rendition nuova.
  const avanzoPronto = useRef(false);
  // (2) UNA VOLTA PER LIBRO, come il ritaglio dei margini nei PDF: ogni
  // capitolo ha i suoi orli, e rimisurare a ogni capitolo farebbe cambiare
  // misura al foglio a ogni voltata. Percio' la misura NON sta appesa a
  // `rendered` ne' a `relocated`: si chiama a mano nei quattro momenti in
  // cui la griglia cambia davvero — apertura, corpo/interlinea, margine,
  // schermo che gira — e in nessun altro.

  // torna `true` se ha davvero ritagliato: chi apre il libro se ne serve
  // per tenere accesa la candela finche' la pagina non si e' assestata
  const misuraAvanzo = useCallback(() => {
    if (!avanzoPronto.current) return false;
    const doc = viewerRef.current?.querySelector("iframe")?.contentDocument;
    if (!doc?.body) return false;
    const orli = getComputedStyle(doc.body);
    const campione = doc.querySelector("p, li, dd, blockquote") || doc.body;
    const riga = parseFloat(getComputedStyle(campione).lineHeight);
    const cornice = parseFloat(orli.paddingTop) + parseFloat(orli.paddingBottom);
    // l'altezza che il testo puo' davvero occupare: la colonna meno gli
    // orli che il libro si mette da solo col suo foglio di stile
    const colonna = doc.body.clientHeight - (Number.isFinite(cornice) ? cornice : 0);
    // (3) l'aritmetica sta in `lib/readerLayout.js`, con le due trappole
    // gia' cascate una volta: si misura sull'altezza SENZA ritaglio, o si
    // rimpalla all'infinito, e a meno di un pixel dalla riga piena non si
    // toglie niente
    const resto = ritaglioAvanzo({ colonna, riga, attuale: avanzoRef.current });
    if (resto === null || resto === avanzoRef.current) return false;
    avanzoRef.current = resto;
    setAvanzo(resto);
    // il margine si scrive SUBITO nel riquadro, a mano: aspettando il
    // render di React, epub.js si rimisurerebbe sul riquadro di prima e il
    // ritaglio resterebbe nel padding senza mai entrare nella colonna
    viewerRef.current.style.paddingBottom = `calc(${FOOT + resto}px + env(safe-area-inset-bottom))`;
    relayout(anchor.current || live.current.cfi);
    return true;
  }, [relayout]);

  // il ritardo lascia finire a epub.js il reimpaginamento che ha gia' per
  // le mani: si misura sopra il suo risultato, non mentre lo scrive
  const chiediAvanzo = useCallback((ritardo) => {
    clearTimeout(avanzoTimer.current);
    avanzoTimer.current = setTimeout(misuraAvanzo, ritardo);
  }, [misuraAvanzo]);
  // chiamata da dentro `makeRendition`, che non deve cambiare identita' a
  // ogni render: passa da un ref, non dalle dipendenze
  const misuraAvanzoRef = useRef(null);
  misuraAvanzoRef.current = misuraAvanzo;

  // La lingua per il vocabolario, che ripiega sull'inglese perche' una
  // ricerca va fatta comunque.
  const langRef = useRef("en");
  // La lingua DICHIARATA dal libro, che non e' la stessa cosa: qui serve
  // sapere se l'ha detta davvero — senza, il browser non sillaba.
  const linguaRef = useRef(null);
  const [lingua, setLingua] = useState(null);
  const aliveRef = useRef(null);
  aliveRef.current = onAlive;
  const [chi, setChi] = useState(null);
  // i passaggi-fonte stanno ripiegati: la risposta e' quella che conta, e il
  // controllo dev'essere possibile, non obbligatorio
  const rotella = useRef(0);

  live.current.settings = settings;
  live.current.panel = panel;
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
    rendition.themes.default(contentStyles(s, linguaRef.current));
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
      setVelo(false);
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
      // Le ancore delle pagine di carta si spengono PRIMA che il capitolo
      // venga impaginato: `content` gira a documento caricato e a misura
      // non ancora presa, quindi non c'e' niente da reimpaginare dopo — e
      // non si rientra in epub.js mentre monta, che e' la lezione che il
      // ritaglio dell'avanzo ha gia' pagato.
      r.hooks.content.register((contents) => {
        spegniVuoti(contents?.document);
        // e lo stacco di troppo, quando il libro il paragrafo lo segna
        // gia' col rientro. Si decide per DOCUMENTO e non una volta per
        // libro apposta: il frontespizio quasi mai rientra, e li' lo
        // stacco e' l'unico segnale che ha — deve restare.
        togliStacco(contents?.document);
      });
      applyStyles(r, s);

      r.on("relocated", (loc) => {
        const st = live.current;
        // una voltata e' la prova che qualcuno sta leggendo: e' da qui che
        // lo schermo si guadagna un altro quarto d'ora di veglia
        aliveRef.current?.();
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
        clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(flush, 1500);
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
        // La sillabazione nasce dalla lingua, e parecchi capitoli non la
        // dichiarano nemmeno quando il libro la dichiara nel suo indice:
        // qui gliela si presta. Tocca un attributo di <html>, non la
        // struttura, quindi i CFI salvati non si muovono di un pelo.
        if (linguaRef.current) {
          const el = doc.documentElement;
          if (!el.getAttribute("lang")) el.setAttribute("lang", linguaRef.current);
          if (!el.getAttribute("xml:lang")) {
            try { el.setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:lang", linguaRef.current); }
            catch { /* documento che non vuole il namespace: basta `lang` */ }
          }
        }
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
        // La rotellina volta la pagina col mouse. In pagine impaginate
        // l'iframe non scorre, quindi il gesto e' libero — e a differenza di
        // un click non ruba niente alla selezione.
        if (!isTouch()) {
          let ultimo = 0;
          doc.addEventListener(
            "wheel",
            (e) => {
              if (live.current.settings.flow === "scrolled") return;
              if (Math.abs(e.deltaY) < 4) return;
              const ora = Date.now();
              if (ora - ultimo < 300) return;
              ultimo = ora;
              turnRef.current(e.deltaY > 0 ? "next" : "prev");
            },
            { passive: true }
          );
        }
        // sfogliare col dito come su carta: soglie strette per non rubare
        // il gesto alla selezione del testo o allo scroll verticale
        let sw = null;
        doc.addEventListener(
          "touchstart",
          (e) => {
            sw = e.touches.length === 1
              ? { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() }
              : null;
          },
          { passive: true }
        );
        doc.addEventListener("touchcancel", () => { sw = null; }, { passive: true });
        doc.addEventListener(
          "touchend",
          (e) => {
            const s0 = sw;
            sw = null;
            if (!s0 || live.current.settings.flow === "scrolled") return;
            const selNow = view.contents.window.getSelection();
            if (selNow && selNow.toString()) return;
            const t = e.changedTouches[0];
            const dx = t.clientX - s0.x;
            const dy = t.clientY - s0.y;
            if (Date.now() - s0.t > 600 || Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
            turnRef.current(dx < 0 ? "next" : "prev");
          },
          { passive: true }
        );
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
      avanzoPronto.current = false;
      r.display(target || undefined)
        .catch(() => r.display())
        .then(() => {
          if (rendRef.current !== r) return setStatusUi("ready");
          // solo ADESSO epub.js e' fermo: la misura dell'avanzo puo'
          // entrare senza trovarlo a meta' del montaggio. E la candela
          // resta accesa finche' il ritaglio non ha fatto il suo giro:
          // altrimenti la pagina compare lunga e si riassesta sotto gli
          // occhi del lettore — un'apertura che si corregge da sola.
          avanzoPronto.current = true;
          clearTimeout(avanzoTimer.current);
          avanzoTimer.current = setTimeout(() => {
            const ritagliato = rendRef.current === r && misuraAvanzoRef.current();
            if (!ritagliato) return setStatusUi("ready");
            avanzoTimer.current = setTimeout(() => setStatusUi("ready"), 300);
          }, 350);
        });
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
        // non basta che il libro dichiari la lingua: serve che il browser
        // sappia sillabarla, e quello si misura sul posto
        const dichiarata = /^[a-z]{2}$/.test(lang) ? lang : null;
        linguaRef.current = dichiarata && sillaba(dichiarata) ? dichiarata : null;
        setLingua({ dichiarata, sillababile: !!linguaRef.current });
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
      // scrivendo in un campo (ricerca, chiave dell'Oracolo, cursore) le
      // frecce muovono il cursore, non il libro
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
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
      clearTimeout(reflowTimer.current);
      clearTimeout(avanzoTimer.current);
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
    chiediAvanzo(500);
  }, [settings.margin, relayout, chiediAvanzo]);

  // lo schermo che gira cambia l'altezza della colonna, quindi l'avanzo di
  // prima non vale piu'. Il reimpaginamento lo fa gia' epub.js da solo: qui
  // si aspetta che abbia finito e si rimisura sopra il suo risultato.
  useEffect(() => {
    // due colpi, non uno: se al primo epub.js non ha ancora rimisurato il
    // corpo, la misura torna quella di prima e il ritaglio resterebbe
    // tarato sullo schermo vecchio. Il secondo e' gratis quando il primo
    // ha gia' fatto centro — trova l'avanzo giusto e non tocca niente.
    let secondo = null;
    const onSize = () => {
      chiediAvanzo(700);
      clearTimeout(secondo);
      secondo = setTimeout(() => chiediAvanzo(0), 1600);
    };
    window.addEventListener("resize", onSize);
    window.addEventListener("orientationchange", onSize);
    return () => {
      clearTimeout(secondo);
      window.removeEventListener("resize", onSize);
      window.removeEventListener("orientationchange", onSize);
    };
  }, [chiediAvanzo]);



  useEffect(() => {
    const onFs = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
    };
  }, []);


  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      rootRef.current?.requestFullscreen?.().catch(() => notify("Schermo intero non disponibile qui"));
    }
  }

  // LE DUE CURE DEL CONFINE — le sole rimesse dopo la pulizia, chieste
  // dal lettore («arrivando al capitolo nuovo mi salta l'ultima pagina,
  // e tornando indietro atterro tre pagine prima»). Tutto il resto della
  // voltata e' epub.js nudo.
  //
  // INDIETRO: il capitolo precedente non esiste piu' impaginato e va
  // ricostruito li' per li'; Firefox lo impagina col font di ripiego
  // mentre quello vero si carica, epub.js atterra sul fondo provvisorio
  // e il testo poi si allunga — restavi pagine prima dell'ultima. Si fa
  // la guardia alla LARGHEZZA del capitolo (le promesse dei font mentono:
  // chieste un attimo prima del layout giurano che e' tutto carico) e a
  // ogni crescita si ri-atterra sul fondo del capitolo giusto, allineato
  // alla facciata. Il lavoro sta sotto un velo color carta che cade a
  // misura ferma; ogni gesto del lettore uccide guardia e velo.
  const PASSO = 120;
  const assestamento = useRef(0);
  function aCapitoloAssestato(azione, scopri) {
    const gettone = ++assestamento.current;
    let sw0 = rendRef.current?.manager?.container?.scrollWidth || 0;
    let giri = 0;
    let stabile = 0;
    let confermato = false;
    let coperto = !!scopri;
    const fine = () => {
      if (coperto) {
        coperto = false;
        scopri();
      }
    };
    const ronda = () => {
      if (gettone !== assestamento.current) return fine();
      const cont = rendRef.current?.manager?.container;
      if (!cont) return fine();
      giri += 1;
      if (cont.scrollWidth !== sw0) {
        sw0 = cont.scrollWidth;
        stabile = 0;
        try { azione(); } catch { /* la vista puo' essere gia' sparita */ }
      } else {
        stabile += 1;
      }
      if (!confermato && stabile >= 2) {
        confermato = true;
        try { azione(); } catch { /* la vista puo' essere gia' sparita */ }
        fine();
      }
      if (giri < 20) setTimeout(ronda, PASSO);
      else fine();
    };
    setTimeout(ronda, PASSO);
  }

  // la vista montata (il manager ne tiene una): serve a capire se il
  // passo indietro sta per attraversare un confine
  function vistaCorrente() {
    let out = null;
    rendRef.current?.manager?.views?.forEach?.((v) => {
      if (v?.section) out = v;
    });
    return out;
  }

  // LA VOLTATA E' UNA DISSOLVENZA, chiesta dal lettore: il velo color
  // carta si alza (90ms), la pagina cambia sotto il velo pieno, e il velo
  // ricade in 300ms sulla pagina nuova. Cosi' il confine di capitolo —
  // che sotto il velo ci stava gia' per necessita' — e le voltate comuni
  // parlano la stessa lingua, e il confine non e' piu' un caso speciale:
  // lo si riconosce solo DOPO la voltata, dalla sezione cambiata, e li'
  // il velo resta su finche' la misura non si ferma. Un secondo tocco
  // durante l'attesa sbriga subito la voltata in coda: due tocchi svelti
  // valgono due pagine, nessuna si perde.
  const inAttesa = useRef(null);
  function step(r, dir) {
    if (inAttesa.current) {
      const subito = inAttesa.current;
      inAttesa.current = null;
      subito();
    }
    const gettone = ++assestamento.current;
    const cala = () => {
      if (gettone === assestamento.current) setVelo(false);
    };
    setVelo(true);
    const via = () => {
      inAttesa.current = null;
      if (gettone !== assestamento.current || rendRef.current !== r) return;
      volta();
    };
    inAttesa.current = via;
    setTimeout(() => {
      if (inAttesa.current === via) via();
    }, PASSO);

    function volta() {
      if (dir === "prev") {
        const sez = vistaCorrente()?.section?.index;
        const p = r.prev();
        p?.then?.(() => {
          if (gettone !== assestamento.current) return;
          const arrivo = vistaCorrente();
          if (rendRef.current !== r || !arrivo || arrivo.section?.index === sez) {
            cala();
            return;
          }
          // confine attraversato: il capitolo ricostruito cresce quando
          // arriva il font incorporato e l'atterraggio provvisorio resta
          // corto. A ogni crescita si ri-atterra sul fondo del capitolo
          // giusto, allineato alla facciata.
          const indice = arrivo.section.index;
          aCapitoloAssestato(() => {
            if (rendRef.current !== r) return;
            const cont = r.manager.container;
            // il fondo di QUESTO capitolo: la fine del contenitore
            // potrebbe essere la coda di un'altra vista
            let el = null;
            r.manager.views?.forEach?.((v) => { if (v.section?.index === indice) el = v.element; });
            if (!el) return;
            const facciata = r.manager.layout?.delta || cont.clientWidth || 1;
            const ultima = el.offsetLeft + Math.max(0, el.offsetWidth - cont.clientWidth);
            r.manager.scrollTo(el.offsetLeft + Math.round((ultima - el.offsetLeft) / facciata) * facciata, 0, true);
            r.reportLocation();
          }, () => setVelo(false));
        });
        p?.catch?.(cala);
        if (!p || !p.then) cala();
        return;
      }
      // AVANTI: epub.js cede il passo al capitolo nuovo quando l'avanzo e'
      // piu' corto di una facciata, ANCHE se non l'hai ancora letta —
      // l'ultima pagina scritta spariva. Se resta carta la si scorre.
      const rest = leftoverScroll(r.manager);
      if (rest) {
        r.manager.scrollBy(rest, 0, true);
        r.reportLocation();
        cala();
        return;
      }
      const sez = vistaCorrente()?.section?.index;
      const p = r.next();
      p?.then?.(() => {
        if (gettone !== assestamento.current) return;
        const arrivo = vistaCorrente();
        if (rendRef.current !== r || !arrivo || arrivo.section?.index === sez) {
          cala();
          return;
        }
        // confine attraversato: si atterra all'INIZIO del capitolo nuovo,
        // che non si muove quando la carta cresce — niente da correggere,
        // il velo aspetta solo che la misura si fermi
        aCapitoloAssestato(() => {}, () => setVelo(false));
      });
      p?.catch?.(cala);
      if (!p || !p.then) cala();
    }
  }

  // Niente foglio animato (palco di cloni, fotografie del capitolo): tolto
  // per intero dopo mesi di salti di pagina su tablet, non re-introdurlo
  // senza una prova lunga su Firefox Android. La dissolvenza di velo qui
  // sopra e' l'UNICO movimento concesso.
  function turn(dir) {
    const r = rendRef.current;
    if (!r || status !== "ready") return;
    moved.current = true;
    step(r, dir);
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
    if ("flow" in patch || "spread" in patch || "font" in patch) makeRendition(next);
    else if (rendRef.current && ("theme" in patch || "fontSize" in patch || "lineHeight" in patch || "justify" in patch)) {
      applyStyles(rendRef.current, next);
      // corpo e interlinea cambiano l'altezza di RIGA: il ritaglio di prima
      // era tagliato su una griglia che non c'e' piu'
      if ("fontSize" in patch || "lineHeight" in patch) chiediAvanzo(500);
    }
  }

  function addMark() {
    if (!live.current.cfi) return;
    // capitolo e pagina, non la percentuale: quella si ricalcola dal CFI a
    // ogni apertura del pannello, mentre un'etichetta congelata in un
    // omnibus arrotondava a "0%" per decine di pagine
    const base = (live.current.href || "").split("#")[0];
    const chap = toc.find((t) => (t.href || "").split("#")[0] === base)?.label || "";
    const label = [chap, `${Math.round((live.current.progress || 0) * 100)}%`]
      .filter(Boolean)
      .join(" · ") || "Segnalibro";
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

  // Le schede dell'Oracolo — «Chi è costui?» e «Dove eravamo rimasti» — si
  // cuciono su quello che hai letto e su nient'altro: la frontiera dice quali
  // volumi possono parlare e fin dove, i passaggi si raccolgono solo li'
  // dentro, e sono gli stessi che poi ti mostro — cosi' puoi controllare
  // invece di fidarti.
  const chiRun = useRef(0);
  const chiCache = useRef(new Map());
  // LA CACHE SOPRAVVIVE AL LIBRO CHIUSO. La regola «si rifà solo se di lui
  // è successo qualcosa di nuovo» aveva bisogno di una scheda vecchia con
  // cui confrontarsi: in un `useRef` non ce n'era più nessuna il giorno
  // dopo, e la regola sembrava scritta senza funzionare mai.
  useEffect(() => {
    let vivo = true;
    leggiSchede(book.id).then((voci) => {
      if (!vivo) return;
      for (const v of voci) if (!chiCache.current.has(v.chiave)) chiCache.current.set(v.chiave, v);
    });
    return () => {
      vivo = false;
    };
  }, [book.id]);

  // Si posa su disco solo quel che vale la pena ritrovare, e l'ordine
  // d'uso è quello vero: `riponi` butta la meno usata di recente.
  const posa = (chiave, voce) => {
    if (!daTenere(chiave)) return;
    leggiSchede(book.id)
      .then((voci) => scriviSchede(book.id, riponi(voci, { chiave, ...voce })))
      .catch(() => {});
  };

  // per il libro aperto vale il segno VIVO, non quello salvato: fra un flush
  // e l'altro passa qualche pagina, e sono pagine che hai letto
  const doveSono = () => ({
    book,
    libri: loadBooks(),
    statusOf: getStatus,
    cfiOf: (id) => (id === book.id ? live.current.cfi || getCfi(id) : getCfi(id)),
  });

  const segnoOra = () => live.current.cfi || getCfi(book.id) || "";

  // DA DOVE SI CONTA IL NUOVO: dalla menzione che avevi TOCCATO.
  //
  // Non da dove eri (la parola che hai toccato è più avanti del segno di
  // pagina, e conterebbe come novità la volta dopo), non da fin dove la
  // scheda aveva letto (che si ferma prima di quella parola, stessa
  // trappola al contrario). Si conta dalla menzione toccata: se fra
  // quella e la pagina dove sei adesso non ce n'è nessun'altra, di lui
  // non è successo niente di nuovo e la scheda di allora è ancora esatta.
  // La menzione che stai toccando ADESSO sta oltre il segno di pagina, e
  // resta fuori dal conto da sola.
  const daDoveContare = (gia) => gia.tocco || gia.segno;

  async function scheda(chiave, avvia, riusa, tocco) {
    setSelMenu(null);
    setPanel("chi");
    const gia = chiCache.current.get(chiave);
    if (gia && (!riusa || (await riusa(gia)))) {
      // rileggerla conta come usarla, o una scheda buona per settimane
      // resterebbe la prima da buttare
      if (daTenere(chiave)) {
        leggiSchede(book.id).then((v) => scriviSchede(book.id, tocca(v, chiave))).catch(() => {});
      }
      return setChi(gia.dato);
    }
    const mio = ++chiRun.current;
    const vivo = () => chiRun.current === mio;
    const finito = await avvia({ ...doveSono(), vivo, passo: (s) => vivo() && setChi(s) });
    if (!vivo() || !finito) return;
    // in cache solo le risposte: un errore di rete non deve restare
    // appiccicato alla parola per tutta la lettura
    if (finito.answer) {
      const voce = { dato: finito, segno: segnoOra(), tocco };
      chiCache.current.set(chiave, voce);
      if (chiCache.current.size > MAX_SCHEDE) {
        chiCache.current.delete(chiCache.current.keys().next().value);
      }
      posa(chiave, voce);
    }
    setChi(finito);
  }

  // LA SCHEDA E' DEL PUNTO IN CUI SEI, non della parola — ma si rifà solo
  // se c'è del nuovo da raccontare.
  //
  // Prima la risposta restava sotto il solo nome, e duecento pagine dopo
  // tornava quella di allora: il contrario di quello che serve. Rifarla a
  // ogni pagina però costerebbe una chiamata per riscrivere le stesse
  // cose. La regola giusta, chiesta dal lettore, sta in mezzo: se da
  // allora il personaggio NON è più comparso, quella scheda è ancora
  // esatta e si riusa; se è tornato in scena, se ne fa una nuova.
  const chiE = (nome, tocco) =>
    scheda(
      `chi:${nome}`,
      (ctx) => schedaChiE({ nome, ...ctx }),
      async (gia) => {
        setChi({ ...gia.dato, fase: "cerco" });
        return !(await nuoveMenzioni(
          book,
          [nome, ...(gia.dato.alias || [])],
          daDoveContare(gia),
          segnoOra()
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
  // appena c'e'; il vocabolario in rete arriva dopo e completa la scheda.
  // Su una frase lunga la rete non serve a nulla: e' il modo di dire che si
  // vuole capire, e quello sta nel glossario.
  async function defineSelection() {
    const raw = selMenu?.text || "";
    const context = selMenu?.context || "";
    const word = cleanWord(raw);
    if (!word) return;
    setSelMenu(null);
    const frase = wordCount(raw) > 1;
    setDict({ word, raw, context, loading: true });
    setPanel("dict");
    const mio = raw;
    const local = await explain(raw, book);
    // la selezione puo' essere gia' cambiata sotto: la risposta vecchia non
    // deve riscrivere la scheda nuova
    setDict((d) => (d && d.raw === mio ? { ...d, ...local } : d));
    if (wordCount(raw) > NET_WORDS) {
      setDict((d) => (d && d.raw === mio ? { ...d, loading: false, frase } : d));
      return;
    }
    const res = await (frase ? lookupPhrase(raw, langRef.current) : lookup(word, langRef.current))
      .catch(() => ({ entries: [], offline: true }));
    setDict((d) =>
      d && d.raw === mio
        ? {
            ...d,
            word: res.word || word,
            loading: false,
            frase,
            lang: langRef.current,
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
    assestamento.current++;
    setVelo(false);
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
  const puoGiustificare = !!lingua?.sillababile;
  const paginated = settings.flow !== "scrolled";
  const twoUp = paginated && pages === 2;
  const p = Math.min(1, Math.max(0, progress || 0));
  const edgeRead = EDGE_MIN + Math.round((EDGE_MAX - EDGE_MIN) * p);
  const edgeLeftToRead = EDGE_MIN + Math.round((EDGE_MAX - EDGE_MIN) * (1 - p));
  // LE PAGINE SI CONTANO SUL TESTO, NON SULLO SCHERMO. Le locations sono
  // pezzi di testo di 600 caratteri, contati una volta su tutto il libro:
  // tre fanno all'incirca una facciata stampata. Il numero che ne esce non
  // e' la facciata che hai davanti — cambia il corpo del testo e resta lo
  // stesso, com'e' giusto — ma sale sempre, non riparte a ogni documento e
  // su un altro dispositivo e' identico. Misurare le facciate vere voleva
  // dire interrogare l'impaginazione a ogni voltata, ed e' da li' che sono
  // arrivati mesi di numeri ballerini.
  const pagine = (() => {
    if (!locReady || !epubRef.current || !live.current.cfi) return null;
    try {
      const tutte = epubRef.current.locations.length();
      const qui = epubRef.current.locations.locationFromCfi(live.current.cfi);
      if (!tutte || !Number.isFinite(qui) || qui < 0) return null;
      return {
        n: Math.floor(qui / POSIZIONI_PER_PAGINA) + 1,
        tot: Math.max(1, Math.round(tutte / POSIZIONI_PER_PAGINA)),
      };
    } catch {
      return null;
    }
  })();
  // il nome del capitolo, come lo chiama l'indice del libro
  const capitolo = (() => {
    const base = (live.current.href || "").split("#")[0];
    if (!base) return null;
    return toc.find((t) => (t.href || "").split("#")[0] === base)?.label || null;
  })();

  return (
    <div
      ref={rootRef}
      onClick={tapAside}
      onWheel={(e) => {
        // la stessa rotellina anche fuori dall'iframe: sul margine attorno
        // al libro il gesto deve rispondere uguale
        if (isTouch() || !paginated || status !== "ready") return;
        if (Math.abs(e.deltaY) < 4) return;
        const ora = Date.now();
        if (ora - rotella.current < 300) return;
        rotella.current = ora;
        turn(e.deltaY > 0 ? "next" : "prev");
      }}
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
          borderRadius: R.piccolo,
          background: theme.cover || theme.bg,
          border: "1px solid #00000066",
          boxShadow: `0 14px 44px #000000b3, 0 0 0 1px ${C.accent}22, inset 0 0 30px #00000026`,
          overflow: "hidden",
          touchAction: "manipulation",
        }}
      >
        <div
          ref={viewerRef}
          style={{
            position: "absolute",
            inset: FRAME,
            // l'avanzo si toglie da SOTTO: cosi' il testo resta ancorato in
            // alto e la pagina non balla quando la misura cambia
            padding: `${HEAD}px ${Math.max(settings.margin, EDGE_MAX + 8)}px calc(${FOOT + avanzo}px + env(safe-area-inset-bottom))`,
            boxSizing: "border-box",
            borderRadius: R.minimo,
            // la carta arriva fino al bordo interno della rilegatura: senza,
            // il margine di lettura mostrava la copertina e staccava le
            // pagine impilate dal foglio
            background: theme.bg,
          }}
        />
        {/* il velo sta SOTTO il filtro caldo e la luminosita' (che vivono
            in cima al reader, zIndex 5): dipinto sopra usciva pergamena
            pura contro una pagina filtrata — misurato sul video del
            lettore, ed era il lampo. Viaggia di opacita': entra in 90ms
            per coprire in tempo, esce in 300 che e' la parte che si vede. */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: FRAME,
            zIndex: 4,
            borderRadius: R.minimo,
            background: theme.bg,
            pointerEvents: "none",
            opacity: velo ? 1 : 0,
            transition: `opacity ${velo ? 90 : 300}ms ease-in-out`,
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
            zIndex: 7,
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
            zIndex: 7,
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
            zIndex: 7,
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
            zIndex: 7,
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
              // una piega stretta, non un'ombra larga: il solco del libro
              // vero sta a ridosso della cucitura e muore in fretta
              width: 100,
              transform: "translateX(-50%)",
              zIndex: 7,
              pointerEvents: "none",
              background:
                "linear-gradient(90deg, transparent, #0000000f 30%, #0000002e 46%, #0000003d 50%, #0000002e 54%, #0000000f 70%, transparent)",
            }}
          />
        )}
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
            style={{ padding: "10px 22px", borderRadius: R.piccolo, border: `1px solid ${C.border}`, color: C.muted }}
          >
            Torna alla Libreria
          </button>
        </div>
      )}

      {/* Col mouse NON ci sono piu' i due bottoni invisibili sulle fasce
          laterali. Coprivano quasi meta' della pagina e stavano SOPRA il
          testo: nelle fasce non si poteva selezionare una parola, cliccarci
          voltava e basta. E' lo stesso motivo per cui erano gia' spariti sul
          tocco. Al loro posto la rotellina, che non litiga con la selezione,
          piu' le frecce e il margine attorno al libro. */}

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
                fontSize: F.rilievo,
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
                  <span title="Quanto manca allo spegnimento della musica" style={{ fontSize: F.minuscolo, color: C.muted, whiteSpace: "nowrap" }}>
                    🌙 {music.manca}
                  </span>
                )}
                {/* Cosa sta suonando, e la via per andare a sceglierne
                    un'altra. Il libro si chiude passando dalla porta di
                    sempre, non sparendo: il punto di lettura va salvato
                    come per ogni altra uscita. */}
                <button
                  onClick={() => { handleClose(); onMusicRoom?.(); }}
                  title={`${music.current.name || "Musica di sottofondo"} — vai alla sala della musica`}
                  style={{
                    maxWidth: 150,
                    padding: "0 8px",
                    height: 40,
                    borderRadius: R.piccolo,
                    fontSize: F.piccolo,
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
                <button onClick={onMusicNext} style={{ ...barBtn(false), fontSize: F.corpo }} aria-label="Melodia successiva">
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
                <button onClick={onMusicStop} style={{ ...barBtn(false), fontSize: F.corpo, color: C.muted }} aria-label="Spegni musica">
                  🔇
                </button>
              </>
            )}
            <button onClick={() => setPanel(panel === "search" ? null : "search")} style={barBtn(panel === "search")} aria-label="Cerca">🔍</button>
            <button onClick={() => setPanel(panel === "toc" ? null : "toc")} style={barBtn(panel === "toc")} aria-label="Indice">☰</button>
            <button onClick={() => setPanel(panel === "marks" ? null : "marks")} style={barBtn(panel === "marks")} aria-label="Segnalibri">📑</button>
            <button onClick={() => setPanel(panel === "hl" ? null : "hl")} style={barBtn(panel === "hl")} aria-label="Evidenziazioni">🖍️</button>
            <button onClick={dovEravamo} style={barBtn(false)} aria-label="Dove eravamo rimasti">🧭</button>
            {document.fullscreenEnabled && (
              <button onClick={toggleFullscreen} style={barBtn(isFs)} aria-label={isFs ? "Esci da schermo intero" : "Schermo intero"}>
                {isFs ? "⛶" : "⛶"}
              </button>
            )}
            <button onClick={() => setPanel(panel === "settings" ? null : "settings")} style={{ ...barBtn(panel === "settings"), fontFamily: FONT_TITLE, fontSize: F.rilievo }} aria-label="Impostazioni">Aa</button>
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
                assestamento.current++;
                setVelo(false);
                if (cfi) rendRef.current?.display(cfi);
              }}
              style={{ width: "100%", accentColor: C.accent }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: F.minuscolo, color: C.muted, marginTop: 2 }}>
              <span>{locReady ? `${pct}%` : "misuro le pagine…"}</span>
              <span>
                {[
                  capitolo,
                  settings.flow === "scrolled"
                    ? "scorrimento"
                    : pagine
                      ? `pag. ${pagine.n} di ${pagine.tot}`
                      : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "…"}
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
            borderRadius: R.medio,
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
          {sembraUnNome(selMenu.text) && (
            <button
              onClick={() => chiE(selMenu.text.trim(), selMenu.cfi)}
              style={{
                marginLeft: 4,
                padding: "6px 12px",
                borderRadius: R.tondo,
                border: `1px solid ${C.accent}88`,
                color: C.accent,
                fontSize: F.nota,
                whiteSpace: "nowrap",
              }}
            >
              👤 Chi è
            </button>
          )}
          {wordCount(selMenu.text) <= PHRASE_WORDS && (
            <button
              onClick={defineSelection}
              style={{
                marginLeft: 4,
                padding: "6px 12px",
                borderRadius: R.tondo,
                border: `1px solid ${C.arcane}88`,
                color: C.arcane,
                fontSize: F.nota,
                whiteSpace: "nowrap",
              }}
            >
              {wordCount(selMenu.text) > 1 ? "🔎 Significato" : "📖 Definisci"}
            </button>
          )}
          <button onClick={() => setSelMenu(null)} style={{ color: C.muted, fontSize: F.nota, marginLeft: 4 }}>
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
                  borderRadius: R.piccolo,
                  background: t.bg,
                  color: t.fg,
                  fontSize: F.piccolo,
                  border: `2px solid ${settings.theme === id ? C.accent : C.border}`,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div style={{ marginBottom: 14 }}>
            <span style={{ display: "block", fontSize: F.nota, color: C.muted, marginBottom: 6 }}>Carattere</span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {READER_FONTS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => updateSettings({ font: f.id })}
                  style={{
                    padding: "7px 14px",
                    borderRadius: R.tondo,
                    fontSize: F.nota,
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
                flex: 1, padding: "9px 0", borderRadius: R.piccolo, fontSize: F.nota,
                border: `1px solid ${paginated ? C.accent : C.border}`,
                color: paginated ? C.accent : C.muted,
              }}
            >
              Pagine
            </button>
            <button
              onClick={() => updateSettings({ flow: "scrolled" })}
              style={{
                flex: 1, padding: "9px 0", borderRadius: R.piccolo, fontSize: F.nota,
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
                flex: 1, padding: "9px 0", borderRadius: R.piccolo, fontSize: F.nota,
                border: `1px solid ${C.border}`,
                color: paginated ? C.muted : C.dim,
              }}
            >
              {settings.spread === "auto" ? "Doppia: auto" : "Pagina singola"}
            </button>
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: F.nota, color: puoGiustificare ? C.muted : C.dim }}>Colonna come in stampa</span>
              <button
                onClick={() => updateSettings({ justify: !settings.justify })}
                disabled={!puoGiustificare}
                style={{
                  padding: "6px 16px",
                  borderRadius: R.tondo,
                  fontSize: F.nota,
                  border: `1px solid ${settings.justify && puoGiustificare ? C.accent : C.border}`,
                  color: !puoGiustificare ? C.dim : settings.justify ? C.accent : C.muted,
                  background: settings.justify && puoGiustificare ? `${C.accent}14` : "transparent",
                }}
              >
                {!puoGiustificare ? "Non si può" : settings.justify ? "Attiva ✒" : "Spenta"}
              </button>
            </div>
            <p style={{ margin: "5px 0 0", fontSize: F.minuscolo, color: C.dim, lineHeight: 1.45 }}>
              {puoGiustificare
                ? "Testo giustificato e parole sillabate a fine riga, come su carta."
                : !lingua?.dichiarata
                  ? "Questo tomo non dichiara la sua lingua, e senza lingua non si sillaba: giustificarlo aprirebbe fiumi di bianco fra le parole."
                  : "Questo browser non sa sillabare in questa lingua — l'ho provato qui, su questo dispositivo. Giustificare senza poter spezzare le parole aprirebbe fiumi di bianco, e allora meglio il bordo a bandiera."}
            </p>
          </div>
          {haGlossario(book) && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <span style={{ fontSize: F.nota, color: C.muted }}>Segna i termini della saga</span>
              <button
                onClick={() => updateSettings({ terms: !settings.terms })}
                style={{
                  padding: "6px 16px",
                  borderRadius: R.tondo,
                  fontSize: F.nota,
                  border: `1px solid ${settings.terms ? C.arcane : C.border}`,
                  color: settings.terms ? C.arcane : C.muted,
                  background: settings.terms ? `${C.arcane}14` : "transparent",
                }}
              >
                {settings.terms ? "Attivo 📖" : "Spento"}
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
          {/* Il timbro della build ANCHE qui, non solo in fondo alla
              Libreria: il service worker sta in modalita' prompt e il
              banner della nuova versione non compare mai a lettore aperto,
              quindi si puo' restare indietro di parecchi rilasci proprio
              mentre si giudica una modifica al lettore. Qui si legge senza
              uscire dal libro. */}
          <p style={{ marginTop: 14, fontSize: F.minuscolo, color: C.muted, textAlign: "center" }}>
            versione {typeof __BC_VERSIONE__ !== "undefined" ? __BC_VERSIONE__ : "?"}
          </p>
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
                  fontSize: F.corpo,
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
                  style={{ flex: 1, textAlign: "left", padding: "11px 6px", fontSize: F.corpo, color: C.text }}
                >
                  {title}
                  <span style={{ display: "block", fontSize: F.minuscolo, color: C.muted }}>
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
            <div
              style={{
                fontFamily: FONT_TITLE,
                fontWeight: 600,
                fontSize: F.rilievo,
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
                borderRadius: R.piccolo,
                border: `1px solid ${C.border}`,
                background: C.card,
                color: C.text,
                fontSize: F.corpo,
                outline: "none",
              }}
            />
            <button
              onClick={runSearch}
              style={{ padding: "0 18px", borderRadius: R.piccolo, background: `linear-gradient(180deg, ${C.accent}, ${C.accentDeep})`, color: C.onAccent, fontWeight: 600 }}
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
                fontSize: F.nota,
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
