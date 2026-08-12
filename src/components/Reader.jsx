import { useCallback, useEffect, useRef, useState } from "react";
import { C, FONT_TITLE } from "../data/constants.js";
import { getAux, putAux } from "../lib/bookStore.js";
import { ensureLocalFile } from "../lib/sync.js";
import {
  getCfi, setCfi, getMarks, saveMarks, getHighlights, saveHighlights,
} from "../lib/annotations.js";
import { getProgress, setProgress, setStatus, getStatus, loadBooks } from "../lib/library.js";
import { schedaChiE } from "../lib/chiSono.js";
import { schedaRiassunto } from "../lib/trama.js";
import { sembraUnNome } from "../lib/nomi.js";
import {
  READER_THEMES, READER_FONTS, HL_COLORS, loadReaderSettings, saveReaderSettings,
} from "../lib/readerSettings.js";
import { searchBook } from "../lib/epubSearch.js";
import { lookup, lookupPhrase, wordCount, cleanWord } from "../lib/dictionary.js";
import { explain, termIndex, normalize, wikiUrl, glossaryOf } from "../lib/glossary.js";
import { contextAround } from "../lib/oracle.js";
import { pushSample, medianMs, formatLeft, loadSamples, saveSamples } from "../lib/readingSpeed.js";
import { leftoverScroll } from "../lib/spread.js";
import { sillaba } from "../lib/hyphens.js";
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

function contentStyles(s, lingua) {
  const t = READER_THEMES[s.theme];
  const font = READER_FONTS.find((f) => f.id === s.font)?.css;
  // L'INCHIOSTRO E' QUELLO DEL TEMA, SENZA ECCEZIONI.
  //
  // Prima si elencavano gli elementi da ricolorare, e chi non era in elenco
  // teneva il colore dell'editore: il primo paragrafo di un capitolo, un
  // <font> di un vecchio EPUB, una didascalia, una lettera capitale. Su
  // pergamena si notava appena; sul tema notte quel testo restava nero su
  // nero. Un elenco di tag e' una partita a rincorrere: qui si dice «tutto
  // quello che sta nel corpo», e i collegamenti si riprendono il loro colore
  // subito dopo (stessa specificita', vince la regola che arriva dopo).
  const textSel = "body *";
  // La colonna giustificata si prende solo la prosa. Non `div`, che spesso
  // avvolge anche i titoli: quelli il libro li centra o li allinea a modo
  // suo, e giustificarli e' il modo piu' rapido di far sembrare rotta una
  // pagina impaginata bene.
  const proseSel = "p, li, dd, blockquote";
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
  // GIUSTIFICATO E SILLABATO, o nessuno dei due.
  //
  // Giustificare senza poter spezzare le parole apre fiumi di bianco fra
  // una parola e l'altra: su una colonna stretta da tablet e' peggio del
  // bordo frastagliato che voleva togliere. E il browser sa sillabare solo
  // se sa in che lingua sta leggendo — se il libro non lo dichiara, qui non
  // si tocca niente e il pannello lo spiega.
  // Spenta, la levetta deve dire ESPLICITAMENTE «a bandiera», non limitarsi
  // a togliere la regola: epub.js accoda al foglio di stile del capitolo e
  // non lo ripulisce mai, quindi una regola tolta resta scritta e continua a
  // valere finche' il libro non viene rifatto da capo. Le regole che
  // arrivano dopo vincono, quelle che spariscono no.
  if (lingua) {
    rules[proseSel] = s.justify
      ? {
          "text-align": "justify !important",
          hyphens: "auto !important",
          "-webkit-hyphens": "auto !important",
          // mai spezzare dopo due lettere: sono le sillabazioni che si notano
          "hyphenate-limit-chars": "6 3 3",
        }
      : {
          // `start`, non `left`: cosi' regge anche un libro che si legge
          // da destra
          "text-align": "start !important",
          hyphens: "manual !important",
          "-webkit-hyphens": "manual !important",
        };
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

export default function Reader({ book, startCfi, nextBook, onReadNext, music, onMusicToggle, onMusicStop, onMusicVolume, onMusicNext, onMusicRoom, onAlive, onClose, notify }) {
  const viewerRef = useRef(null);
  const rootRef = useRef(null);
  const bookRef = useRef(null);
  const epubRef = useRef(null);
  const rendRef = useRef(null);
  const saveTimer = useRef(null);
  const snapTimer = useRef(null);
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
  const [snapPad, setSnapPad] = useState(0);
  const [isFs, setIsFs] = useState(false);
  const [displayed, setDisplayed] = useState(null);
  const [speed, setSpeed] = useState(() => medianMs(loadSamples()));
  const [dict, setDict] = useState(null);
  const [endCard, setEndCard] = useState(null);
  // il velo color carta sugli atterraggi in una sezione fresca: copre
  // l'assestamento (atterraggio provvisorio + scatto sul bersaglio) e
  // cade a misura ferma — vedi aCapitoloAssestato
  const [velo, setVelo] = useState(false);

  const anchor = useRef(null);
  const snapRef = useRef(0);
  const snapSeen = useRef(0);
  const markedRef = useRef(new Map());
  const termsRef = useRef(null);
  const termCfis = useRef([]);
  const reflowing = useRef(false);
  const reflowTimer = useRef(null);

  // Colonne INTERE o niente. Lasciando a epub.js il "100%" la larghezza
  // puo' uscire DISPARI: la colonna vale meta' larghezza meno la gola, si
  // porta dietro il mezzo pixel, Firefox lo arrotonda a modo suo e l'errore
  // si ACCUMULA lungo il capitolo — facciate appaiate pari-dispari, ultima
  // pagina mangiata, atterraggi sbagliati tornando indietro. La misura si
  // prende qui, si fa PARI, e si consegna a epub.js come NUMERO: cosi' il
  // motore smette anche di seguire da solo la finestra, e la barra di
  // Android che va e viene non reimpagina piu' niente.
  const misuraLibro = () => {
    const el = viewerRef.current;
    if (!el) return null;
    const cs = getComputedStyle(el);
    const cw = Math.floor(el.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0));
    const ch = Math.floor(el.clientHeight - (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0));
    if (cw < 40 || ch < 40) return null;
    return { w: cw % 2 ? cw - 1 : cw, h: ch };
  };
  const misuraData = useRef({ w: 0, h: 0 });

  // Le barre non toccano piu' la misura del libro, ma cambiare margine
  // reimpagina lo stesso. Lasciando ripartire epub.js dal CFI corrente si
  // arretrava di mezza pagina ogni volta, perche' allinea sempre all'inizio
  // della pagina che lo contiene: si riparte invece dall'ultima pagina
  // scelta dal lettore, che non si sposta da sola.
  const relayout = useCallback((cfi) => {
    const r = rendRef.current;
    if (cfi) reflowing.current = true;
    try {
      const m = misuraLibro();
      if (m) misuraData.current = { w: m.w, h: m.h };
      if (r) r.resize(m ? m.w : undefined, m ? m.h : undefined, cfi || undefined);
      else window.dispatchEvent(new Event("resize"));
    } catch {
      window.dispatchEvent(new Event("resize"));
    }
    // se la misura non cambia epub.js non riposiziona nulla e "relocated"
    // non arriva: la bandiera va tolta comunque
    clearTimeout(reflowTimer.current);
    reflowTimer.current = setTimeout(() => { reflowing.current = false; }, 1500);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const samplesRef = useRef(loadSamples());
  const lastTurnAt = useRef(0);
  const langRef = useRef("en");
  // La lingua DICHIARATA dal libro, che non e' la stessa cosa: `langRef`
  // ripiega sull'inglese per il dizionario, qui invece serve sapere se il
  // libro l'ha detta davvero — senza, il browser non sillaba.
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
      const m = misuraLibro();
      misuraData.current = m ? { w: m.w, h: m.h } : { w: 0, h: 0 };
      const r = eb.renderTo(viewerRef.current, {
        // misura esplicita e PARI, mai "100%": vedi misuraLibro
        width: m ? m.w : "100%",
        height: m ? m.h : "100%",
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

      // Saltando a un'ancora (indice, segnalibro) epub.js fa
      // floor(offset / facciata) sull'offset letto dai rettangoli, e
      // Firefox li riporta con un residuo sub-pixel: 55887,99998 al posto
      // di 55888 fa perdere una facciata secca. L'offset si arrotonda
      // PRIMA che il floor lo veda; sui numeri gia' interi non cambia nulla.
      r.started.then(() => {
        const man = r.manager;
        if (!man?.moveTo || man.bcTondo) return;
        man.bcTondo = true;
        const vero = man.moveTo.bind(man);
        man.moveTo = (offset, width) => vero(
          { ...offset, left: Math.round(offset?.left || 0), top: Math.round(offset?.top || 0) },
          width
        );
      });

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
        if (loc.start?.displayed?.total) setDisplayed(contaPagina(r, loc.start));
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
        // l'avanzo di riga si ricalcola qui: a misura stabile la funzione
        // esce subito, quindi non costa nulla a ogni voltata
        measureSnap();
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
      clearTimeout(snapTimer.current);
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

  // tolto l'avanzo, epub.js va rimesso al lavoro sulla misura nuova: si
  // riparte dall'ultima pagina scelta dal lettore, come per il margine
  useEffect(() => {
    if (snapSeen.current === snapPad) return;
    snapSeen.current = snapPad;
    relayout(anchor.current || live.current.cfi);
  }, [snapPad, relayout]);

  useEffect(() => {
    const onFs = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
    };
  }, []);

  // Rotazione e schermo intero cambiano davvero la misura del riquadro; la
  // barra del browser su Android invece balla SOLO l'altezza, decine di
  // volte MENTRE leggi. Il libro ha misura fissa (vedi misuraLibro), quindi
  // epub.js da solo non reimpagina piu': qui si decide QUANDO consegnargli
  // una misura nuova — mai per il balletto della barra, sempre per un
  // cambio vero, ripartendo dall'ultima pagina scelta dal lettore (letta
  // ADESSO, non a inizio raffica: se intanto hai voltato, il posto te lo
  // sei scelto tu e non va riavvolto).
  useEffect(() => {
    const el = bookRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    let primo = true;
    let timer = null;
    const ro = new ResizeObserver(() => {
      if (primo) { primo = false; return; }
      clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        const m = misuraLibro();
        if (!m || !rendRef.current) return;
        if (m.w === misuraData.current.w && Math.abs(m.h - misuraData.current.h) < 120) return;
        misuraData.current = { w: m.w, h: m.h };
        const dove = anchor.current || live.current.cfi;
        reflowing.current = true;
        clearTimeout(reflowTimer.current);
        reflowTimer.current = setTimeout(() => { reflowing.current = false; }, 1500);
        try { rendRef.current.resize(m.w, m.h, dove || undefined); }
        catch { reflowing.current = false; }
      }, 500);
    });
    ro.observe(el);
    return () => { ro.disconnect(); clearTimeout(timer); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      rootRef.current?.requestFullscreen?.().catch(() => notify("Schermo intero non disponibile qui"));
    }
  }

  // UN CAPITOLO APPENA COSTRUITO CRESCE SOTTO I PIEDI. epub.js atterra
  // misurando il capitolo prima che font incorporati e immagini abbiano
  // preso posto: qualche istante dopo il testo si allunga di colonne
  // intere e il punto scelto resta indietro. Tornando sulla pagina prima
  // di un capitolo si finiva «diverse pagine» prima dell'ultima
  // (misurato su Gecko: 4 facciate perse su un capitolo con immagine,
  // 10 sul monstre col font incorporato) — e li' si restava, perche' i
  // pixel di scorrimento non seguono la carta che si allunga. Ad assets
  // assestati si rifa' l'atterraggio sul bersaglio vero; se non c'era
  // niente da aspettare non succede nulla, e se il lettore ha gia'
  // rivoltato la correzione muore col suo gettone.
  // La prima versione aspettava le PROMESSE di font e immagini, ma il
  // momento del controllo tradisce: i font si chiedono al primo layout
  // che li usa, e interrogati un attimo prima `document.fonts` giura che
  // e' tutto carico. Qui invece si fa la guardia alla MISURA: per quattro
  // secondi si riguarda la larghezza del capitolo, e a ogni crescita si
  // ri-atterra — piu' un ri-atterraggio di conferma al primo giro utile,
  // che a bersaglio gia' centrato non muove niente e non si vede.
  // E IL LAVORO NON SI GUARDA: l'atterraggio provvisorio piu' lo scatto
  // sul bersaglio erano un glitch a vista. Chi atterra in una sezione
  // fresca passa un velo color carta sul libro (`scopri` lo toglie), che
  // si alza PRIMA del primo dipinto e cade quando la misura sta ferma da
  // due ronde — subito dopo l'atterraggio di conferma, cosi' si scopre
  // direttamente la pagina giusta. La guardia continua muta fino a ~3s
  // per la crescita ritardataria, e qualunque gesto del lettore la
  // uccide E toglie il velo.
  // il polso della guardia: fitto, perche' il velo dura quanto lei —
  // due ronde ferme e si scopre (circa un terzo di secondo)
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

  // avanti si scorre il residuo prima di cambiare capitolo, cosi' l'ultima
  // pagina scritta non viene saltata; indietro epub.js gia' atterra in
  // fondo — ma sul fondo di QUEL momento, da riprendere a capitolo fermo
  function step(r, dir) {
    assestamento.current++;
    setVelo(false);
    if (dir === "prev") {
      const b = bestView();
      const sez = b?.view?.section?.index;
      // al primo foglio della sezione il passo indietro attraversa il
      // confine: il capitolo che sta per nascere si copre PRIMA che
      // dipinga l'atterraggio provvisorio
      const base = b?.view?.element?.offsetLeft || 0;
      if ((r.manager?.container?.scrollLeft ?? 0) <= base) setVelo(true);
      const p = r.prev();
      p?.then?.(() => {
        const arrivo = bestView()?.view;
        if (rendRef.current !== r || !arrivo || arrivo.section?.index === sez) {
          setVelo(false);
          return;
        }
        const indice = arrivo.section.index;
        aCapitoloAssestato(() => {
          if (rendRef.current !== r) return;
          const cont = r.manager.container;
          // il fondo DI QUESTO capitolo, non del contenitore: epub.js puo'
          // tenerne montati due, e la fine del contenitore sarebbe la coda
          // di quello da cui siamo appena venuti — un balzo in avanti
          let el = null;
          r.manager.views?.forEach?.((v) => { if (v.section?.index === indice) el = v.element; });
          if (!el) return;
          const passo = r.manager.layout?.pageWidth || cont.clientWidth || 1;
          const ultima = el.offsetLeft + Math.max(0, el.offsetWidth - cont.clientWidth);
          r.manager.scrollTo(el.offsetLeft + Math.round((ultima - el.offsetLeft) / passo) * passo, 0, true);
          r.reportLocation();
        }, () => setVelo(false));
      });
      p?.catch?.(() => setVelo(false));
      return p;
    }
    const rest = leftoverScroll(r.manager);
    if (!rest) return r.next();
    r.manager.scrollBy(rest, 0, true);
    return r.reportLocation();
  }

  // IL CONTAPAGINE NON SI FIDA DEI RETTANGOLI. epub.js ricava la pagina
  // corrente da getBoundingClientRect, e Firefox riporta quei rettangoli
  // con un residuo sub-pixel (997,99998 per 998): il floor scende di
  // un'unita' e l'etichetta esce con la sinistra pari — numeri che si
  // ripetono, si sovrappongono, e il famoso «12-13 di 14» con la destra
  // vuota mentre il testo sta al posto giusto. Lo scorrimento del
  // contenitore e l'offset della vista invece sono INTERI: la pagina si
  // riconta da li', e l'arrotondamento chiude la porta al residuo.
  function contaPagina(r, start) {
    const displayed = start.displayed;
    try {
      if (live.current.settings.flow === "scrolled") return displayed;
      const man = r.manager;
      const sl = man?.container?.scrollLeft;
      const pw = man?.layout?.pageWidth;
      if (!(pw > 0) || !Number.isFinite(sl)) return displayed;
      let base = 0;
      man.views?.forEach?.((v) => {
        if ((v.section?.href || "") === (start.href || "")) base = v.element?.offsetLeft || 0;
      });
      const page = Math.round((sl - base) / pw) + 1;
      if (page < 1 || page > displayed.total) return displayed;
      return { ...displayed, page };
    } catch {
      return displayed;
    }
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

  // La gabbia di testo deve contenere un numero INTERO di righe.
  //
  // L'altezza disponibile non e' quasi mai un multiplo esatto dell'interlinea:
  // in fondo alla colonna avanza una frazione di riga. Che fine fa quella
  // frazione lo decide il motore, e i due non sono d'accordo: Chrome spinge la
  // riga alla colonna dopo (e lascia un vuoto in fondo alto fino a una riga,
  // diverso a ogni pagina), Firefox la disegna e la TAGLIA sul bordo della
  // colonna — la riga mozzata a meta' altezza in fondo a ogni facciata.
  // Nessuna delle due e' una pagina di libro.
  //
  // Si toglie quindi l'avanzo dal riquadro, una volta sola: la carta resta
  // larga uguale (lo sfondo e' del contenitore, non della gabbia), il margine
  // di piede cresce di quei pochi pixel e diventa lo stesso su ogni pagina.
  // La misura si prende dal documento vero e si somma indietro il ritaglio
  // gia' applicato, cosi' il conto e' lo stesso a ogni giro e non rincorre
  // se stesso.
  function measureSnap() {
    if (live.current.settings?.flow === "scrolled") {
      if (snapRef.current !== 0) {
        snapRef.current = 0;
        setSnapPad(0);
      }
      return;
    }
    try {
      const doc = bestView()?.view?.contents?.document;
      const body = doc?.body;
      if (!body) return;
      const cs = doc.defaultView.getComputedStyle(body);
      const passo = parseFloat(cs.lineHeight);
      const alto =
        body.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      if (!(passo > 4) || !(alto > passo)) return;
      const pieno = alto + snapRef.current;
      const avanzo = Math.round(pieno % passo);
      // meno di un pixel non vale una reimpaginazione
      if (Math.abs(avanzo - snapRef.current) < 1) return;
      snapRef.current = avanzo;
      setSnapPad(avanzo);
    } catch {
      /* vista non ancora pronta: si rimisura al prossimo approdo */
    }
  }

  // La voltata e' SECCA, per scelta: il foglio animato (palco di cloni,
  // fotografie del capitolo, velature) e' stato tolto per intero dopo mesi
  // di salti di pagina su tablet — non re-introdurlo senza una prova lunga
  // su Firefox Android.
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
      // corpo e interlinea cambiano il passo delle righe, quindi l'avanzo:
      // si rimisura a testo gia' ridisegnato
      clearTimeout(snapTimer.current);
      snapTimer.current = setTimeout(measureSnap, 320);
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

  // Le schede dell'Oracolo — «Chi è costui?» e «Dove eravamo rimasti» — si
  // cuciono su quello che hai letto e su nient'altro: la frontiera dice quali
  // volumi possono parlare e fin dove, i passaggi si raccolgono solo li'
  // dentro, e sono gli stessi che poi ti mostro — cosi' puoi controllare
  // invece di fidarti.
  const chiRun = useRef(0);
  const chiCache = useRef(new Map());
  // per il libro aperto vale il segno VIVO, non quello salvato: fra un flush
  // e l'altro passa qualche pagina, e sono pagine che hai letto
  const doveSono = () => ({
    book,
    libri: loadBooks(),
    statusOf: getStatus,
    cfiOf: (id) => (id === book.id ? live.current.cfi || getCfi(id) : getCfi(id)),
  });

  async function scheda(chiave, avvia) {
    setSelMenu(null);
    setPanel("chi");
    const gia = chiCache.current.get(chiave);
    if (gia) return setChi(gia);
    const mio = ++chiRun.current;
    const vivo = () => chiRun.current === mio;
    const finito = await avvia({ ...doveSono(), vivo, passo: (s) => vivo() && setChi(s) });
    if (!vivo() || !finito) return;
    // in cache solo le risposte: un errore di rete non deve restare
    // appiccicato alla parola per tutta la lettura
    if (finito.answer) chiCache.current.set(chiave, finito);
    setChi(finito);
  }

  const chiE = (nome) => scheda(`chi:${nome}`, (ctx) => schedaChiE({ nome, ...ctx }));
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
    assestamento.current++;
    setVelo(false);
    const arrivo = r.display(target);
    // un segnalibro in un capitolo non ancora costruito atterra con le
    // misure di prima che font e immagini prendessero posto: a capitolo
    // assestato si rifa' lo stesso display, che ormai costa niente
    arrivo?.then?.(() => aCapitoloAssestato(() => {
      if (rendRef.current === r) r.display(target);
    }));
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
  const pagesLeft = displayed ? Math.max(0, displayed.total - displayed.page) : 0;
  // speed e' il tempo fra un cambio pagina e l'altro, e in doppia pagina un
  // cambio ne avanza due: le pagine rimaste vanno divise per il foglio, non
  // moltiplicate — sbagliando verso la stima usciva quattro volte troppo lunga
  const turnsLeft = Math.ceil(pagesLeft / Math.max(1, pages));
  const chapterLeft = speed && turnsLeft > 0 ? formatLeft(turnsLeft * speed) : null;


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
          borderRadius: 12,
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
            padding: `${HEAD}px ${Math.max(settings.margin, EDGE_MAX + 8)}px calc(${FOOT + snapPad}px + env(safe-area-inset-bottom))`,
            boxSizing: "border-box",
            borderRadius: 3,
            // la carta arriva fino al bordo interno della rilegatura: senza,
            // il margine di lettura mostrava la copertina e staccava le
            // pagine impilate dal foglio
            background: theme.bg,
          }}
        />
        {velo && (
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: FRAME,
              zIndex: 6,
              borderRadius: 3,
              background: theme.bg,
              pointerEvents: "none",
            }}
          />
        )}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: FRAME,
            top: FRAME,
            bottom: FRAME,
            width: edgeRead,
            // SOPRA il canvas del cilindro e il velo della dissolvenza:
            // taglio, ombre e piega restano identici a se stessi per tutto
            // il giro, e le animazioni non devono ridipingerli — coperti,
            // sparivano di colpo al primo fotogramma (lo "sfarfallio")
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
                    sempre, non sparendo: il punto di lettura va salvato
                    come per ogni altra uscita. */}
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
                assestamento.current++;
                setVelo(false);
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
          {sembraUnNome(selMenu.text) && (
            <button
              onClick={() => chiE(selMenu.text.trim())}
              style={{
                marginLeft: 4,
                padding: "6px 12px",
                borderRadius: 999,
                border: `1px solid ${C.accent}88`,
                color: C.accent,
                fontSize: 14,
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
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 14.5, color: puoGiustificare ? C.muted : C.dim }}>Colonna come in stampa</span>
              <button
                onClick={() => updateSettings({ justify: !settings.justify })}
                disabled={!puoGiustificare}
                style={{
                  padding: "6px 16px",
                  borderRadius: 999,
                  fontSize: 14,
                  border: `1px solid ${settings.justify && puoGiustificare ? C.accent : C.border}`,
                  color: !puoGiustificare ? C.dim : settings.justify ? C.accent : C.muted,
                  background: settings.justify && puoGiustificare ? `${C.accent}14` : "transparent",
                }}
              >
                {!puoGiustificare ? "Non si può" : settings.justify ? "Attiva ✒" : "Spenta"}
              </button>
            </div>
            <p style={{ margin: "5px 0 0", fontSize: 12.5, color: C.dim, lineHeight: 1.45 }}>
              {puoGiustificare
                ? "Testo giustificato e parole sillabate a fine riga, come su carta."
                : !lingua?.dichiarata
                  ? "Questo tomo non dichiara la sua lingua, e senza lingua non si sillaba: giustificarlo aprirebbe fiumi di bianco fra le parole."
                  : "Questo browser non sa sillabare in questa lingua — l'ho provato qui, su questo dispositivo. Giustificare senza poter spezzare le parole aprirebbe fiumi di bianco, e allora meglio il bordo a bandiera."}
            </p>
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
          <p style={{ marginTop: 14, fontSize: 12.5, color: C.muted, textAlign: "center" }}>
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
