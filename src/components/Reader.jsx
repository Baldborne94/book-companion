import { useCallback, useEffect, useRef, useState } from "react";
import { C, FONT_TITLE, F, R, px } from "../data/constants.js";
import { getAux, putAux, getFile } from "../lib/bookStore.js";
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
import { contentStyles, spegniVuoti, togliStacco, staccaParagrafi, spegniScenografia } from "../lib/readerTheme.js";
import { ritaglioAvanzo, flattenToc, cfiLeggibile } from "../lib/readerLayout.js";
import { searchBook } from "../lib/epubSearch.js";
import { lookup, lookupPhrase, wordCount, cleanWord } from "../lib/dictionary.js";
import { explain, termIndex, normalize, wikiUrl, haGlossario } from "../lib/glossary.js";
import { contextAround } from "../lib/oracle.js";
import { sillaba } from "../lib/hyphens.js";
import { eNotaRef, risolviHref, trovaNota, pezziNota, piuVicina } from "../lib/nota.js";
import { controllaSpezzatura, saluteInCache, daRicucire, ricuciLibro, conSegni, taci } from "../lib/ricuci.js";
import { leftoverScroll, dentroIlCapitolo } from "../lib/spread.js";
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
// Oltre questo tempo dall'approdo la pagina si mostra comunque: la
// candela accesa copre tutto e si mangia i tocchi, quindi nessun ritardo
// puo' tenerla su all'infinito.
const SICUREZZA_CANDELA = 2500;
const HEAD = 8;
const FOOT = 8;
const EDGE_STRIPES =
  "repeating-linear-gradient(to right, #00000047 0 1px, #ffffff1f 1px 2px, #0000001c 2px 4px)";
// fasce laterali del tocco: valgono su tutta la larghezza dello schermo,
// cornice e taglio delle pagine compresi, non solo dentro al capitolo
const TAP_PREV = 0.28;
const TAP_NEXT = 0.72;
// Quanto puo' muoversi un dito e restare un tocco: sopra, sta trascinando.
const MOSSA = 12;
// e quanto puo' restare giu': sopra, sta selezionando una parola
const PRESSIONE = 500;
// la finestra in cui il `click` che segue un tocco e' lo STESSO gesto, e
// quindi si lascia cadere. Larga: il motore lo sintetizza con calma.
const DOPPIONE = 700;
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



// Il riquadro segue la scritta che ci sta dentro: con `F.titoletto` a due
// volte la scala il glifo e' 38px in una scatola da 40, cioe' un tasto
// scritto male proprio nella barra dove si sta piu' a lungo. I margini
// della PAGINA (HEAD/FOOT) restano fermi e non si scalano mai: li' un
// pixel in piu' reimpagina ogni libro, ed e' da li' che erano cominciati
// i salti.
const barBtn = (active) => ({
  width: px(40),
  height: px(40),
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


// quel che serve a riconoscere un rimando di nota, letto dall'ancora:
// la dichiarazione (epub:type / role) o il testo-segno (vedi lib/nota.js)
const infoRimando = (a) => ({
  href: a.getAttribute("href") || "",
  testo: a.textContent || "",
  tipo: a.getAttribute("epub:type") || a.getAttributeNS?.("http://www.idpf.org/2007/ops", "type") || "",
  ruolo: a.getAttribute("role") || "",
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
          <h3 style={{ fontFamily: FONT_TITLE, fontSize: F.titoletto, fontWeight: 600, color: C.text }}>{title}</h3>
          <button onClick={onClose} style={barBtn(false)}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function Reader({ book, startCfi, nextBook, onReadNext, music, onMusicToggle, onMusicStop, onMusicVolume, onMusicNext, onMusicRoom, onAlive, onClose, notify, indietro }) {
  const viewerRef = useRef(null);
  const rootRef = useRef(null);
  const bookRef = useRef(null);
  // L'ORA DELL'ULTIMO TOCCO SERVITO, UNA SOLA PER TUTTO IL READER.
  //
  // Era una variabile chiusa dentro il gestore dell'iframe, e li' bastava
  // finche' il tocco fuori dal libro non esisteva. Ma i due posti non sono
  // separati: un dito che si posa sul testo puo' far nascere un `click`
  // sintetico che atterra sulla CORNICE, e con due guardiani distinti quel
  // click passerebbe per un tocco nuovo — le barre si accenderebbero e si
  // rispegnerebbero nello stesso gesto, cioe' di nuovo «non succede
  // niente», che e' il difetto che stiamo curando.
  const ditoRef = useRef(0);
  // dove si e' posato il dito sulla cornice, per distinguere il tocco dal
  // trascinamento e dalla pressione lunga
  const asideRef = useRef(null);
  const epubRef = useRef(null);
  const rendRef = useRef(null);
  const saveTimer = useRef(null);
  const turnRef = useRef(() => {});
  const moved = useRef(false);
  // IL SEGNO NON SI PERDE PER UN'APERTURA ANDATA STORTA.
  //
  // `display(cfi)` puo' fallire — un CFI che parla di una struttura che il
  // libro non ha piu' — e li' si ripiegava sull'inizio del libro IN
  // SILENZIO. Il guaio vero non e' ritrovarsi a pagina uno: e' che dopo un
  // secondo e mezzo `relocated` porta il flush a scrivere QUELLA posizione
  // sopra il segno buono, che a quel punto e' perso per sempre. Chiudere e
  // riaprire non lo riporta indietro, perche' non c'e' piu'.
  //
  // Finche' questa mira tiene un CFI, il flush non scrive: il segno salvato
  // resta quello, e riaprendo il libro si riprova. Si libera solo quando il
  // lettore si sposta APPOSTA — voltata, indice, segnalibro, cursore — che
  // e' il momento in cui ha scelto lui da dove leggere.
  const segnoDaTenere = useRef(null);
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
  // il tablet in piedi: la doppia pagina li' non esiste, e la levetta che
  // la governa non ha niente da governare
  const [inPiedi, setInPiedi] = useState(() => window.innerWidth < window.innerHeight);
  // il velo color carta sul passo indietro oltre il confine: copre la
  // ricostruzione del capitolo (vedi step) e cade a misura ferma
  const [velo, setVelo] = useState(false);
  const [dict, setDict] = useState(null);
  const [endCard, setEndCard] = useState(null);
  // la nota a piè di pagina, letta SUL POSTO: il testo della nota o null.
  // Niente navigazione: chiusa la scheda sei dove eri (chiesto dal
  // lettore: «vorrei che poi letto mi riporti al punto in cui ero»)
  const [nota, setNota] = useState(null);
  const apriNotaRef = useRef(() => {});
  // LO STANDARD DELLA LETTURA: il testo copre la pagina. Alla prima
  // apertura si guarda (una volta, verdetto su disco) se il libro è
  // spezzato; senza segni da proteggere si ricuce da sé, con un segno si
  // offre il tasto — e dopo la cura il segno torna alla stessa
  // percentuale, perché il CFI vecchio parla di file che non ci sono più.
  const [cucitura, setCucitura] = useState(null);
  const [ritornoFallito, setRitornoFallito] = useState(false);
  const [giro, setGiro] = useState(0);
  const saltaPct = useRef(null);

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
  // QUANTO DIVERGE LA PAGINA DAL SUO RIQUADRO. Sul tablet la PWA apre il
  // libro mentre Android sta ancora ritirando le sue barre: epub.js misura
  // il riquadro in quell'attimo, e la finestra non manda MAI un `resize`
  // (è il riquadro che cambia, non la finestra) — così ogni pagina restava
  // corta di quel tanto, con una fascia vuota in fondo, finché una
  // rotazione non forzava la rimisura (segnalato dal lettore, confermato:
  // «ruotando la fascia sparisce»). Il confronto non è «prima/dopo» ma
  // «riquadro di ADESSO contro iframe che epub.js ha costruito»: prende
  // ogni misura stantia, qualunque cosa l'abbia prodotta.
  const scartoRiquadro = useCallback(() => {
    if (live.current.settings.flow === "scrolled") return 0;
    const el = viewerRef.current;
    const fr = el?.querySelector("iframe");
    if (!el || !fr) return 0;
    const cs = getComputedStyle(el);
    const utileH = el.clientHeight - parseFloat(cs.paddingTop || 0) - parseFloat(cs.paddingBottom || 0);
    const utileW = el.clientWidth - parseFloat(cs.paddingLeft || 0) - parseFloat(cs.paddingRight || 0);
    const r = fr.getBoundingClientRect();
    return Math.max(Math.abs(r.height - utileH), Math.abs(r.width - utileW));
  }, []);

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
  // LA CANDELA NON PUO' DIPENDERE DA UN TIMER CHE ALTRI AZZERANO. Il giro
  // che la spegne aspettava sul timer dell'avanzo, e `chiediAvanzo` lo
  // azzera per mestiere: bastava che una rimisura (schermo che si assesta,
  // margine cambiato, barre di Android che rientrano) cadesse in quella
  // finestra e il velo «Apro il tomo…» restava acceso PER SEMPRE — a
  // schermo intero, z-20, e con lui ogni tocco moriva lì: le note, il
  // dizionario, la voltata. Timer suo, e una rete di sicurezza sotto.
  const prontoTimer = useRef(null);
  const sicurezzaTimer = useRef(null);
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
    // il ritorno al punto e' fallito: la posizione di ripiego non deve
    // scrivere sopra il segno buono (vedi `segnoDaTenere`)
    if (segnoDaTenere.current) return;
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
        // Il paragrafo si segna UNA volta sola, e qui si sceglie come.
        // «Staccati» toglie il rientro che il libro si porta dietro e mette
        // il respiro al suo posto; «rientrati» — quel che il libro dice —
        // toglie invece lo stacco di troppo dove il rientro c'e' gia'. Si
        // decide per DOCUMENTO e non una volta per libro apposta: il
        // frontespizio quasi mai rientra, e li' lo stacco e' l'unico
        // segnale che ha — deve restare.
        if (s.paragrafi === "stacco") staccaParagrafi(contents?.document);
        else togliStacco(contents?.document);
        // e la scena che certi ePub si portano dentro — il libro finto
        // dipinto dietro il testo di ogni capitolo: la carta e' del tema
        spegniScenografia(contents?.document);
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
        // LE NOTE SI LEGGONO SUL POSTO: epub.js su un rimando salterebbe
        // alla pagina delle note in fondo al libro — il segno si sposta e
        // tornare indietro è un'impresa. Qui non ci si muove affatto: la
        // nota arriva in una scheda, chiusa la scheda sei dove eri.
        // epub.js aggancia il suo salto su `onclick`: si riscrive quello,
        // sullo stesso gancio, e i collegamenti veri (indice, rimandi a
        // capitoli) restano a epub.js come prima.
        for (const a of doc.querySelectorAll("a[href]")) {
          if (!eNotaRef(infoRimando(a))) continue;
          a.onclick = () => {
            apriNotaRef.current(a.getAttribute("href") || "", doc, view.section?.href || "");
            return false;
          };
        }
        // IL DITO NON PASSA SEMPRE DAL `click`.
        //
        // Segnalato dal lettore sul tablet: toccando il testo non succedeva
        // NIENTE — ne' la voltata ne' le barre che si nascondono. Qui su
        // Chromium, col tocco vero, funziona in ogni combinazione (pagina
        // singola, doppia, a schermo intero, in mezzo a un capitolo): il
        // `click` sintetizzato dopo il tocco e' un favore che il motore fa,
        // non una garanzia, e dentro un iframe traslato di trentamila
        // pixel — quello delle colonne di epub.js — puo' non arrivare mai.
        //
        // Allora il tocco si serve DA SE': `touchend` e' l'evento che il
        // dito alza davvero. Le soglie tengono fuori quello che tocco non
        // e': un trascinamento (piu' di MOSSA px) e una pressione lunga
        // (piu' di PRESSIONE ms), che e' come si seleziona una parola.
        //
        // E i due eventi non devono servire lo stesso tocco due volte, o le
        // barre si nasconderebbero e ricomparirebbero nello stesso gesto:
        // servito dal dito, il `click` che segue si lascia cadere.
        let giu = null;
        const selezione = () => {
          try { return view.contents.window.getSelection(); } catch { return null; }
        };
        const tocco = (bersaglio, x, y) => {
          if (bersaglio?.closest?.("a")) return;
          // LA SELEZIONE NON HA VOCE IN CAPITOLO SUL TOCCO BREVE, e la
          // ragione l'ha detta il lettore in una riga: «tanto per la
          // selezione del testo e del dizionario devo tenere premuto».
          //
          // Qui c'e' stato un difetto lungo quattro segnalazioni. Prima la
          // riga era `if (sel.toString()) return` — «se c'e' una selezione
          // questo tocco non e' per noi» — ragionevole guardando Chromium,
          // dove un tocco breve sul testo non seleziona niente. Su Firefox
          // Android invece toccare del testo una selezione la CREA, quindi
          // si usciva sempre, e per sempre, perche' quella selezione
          // restava li'. (Il «a due pagine bastava cliccare al centro» che
          // ha sbloccato la diagnosi: li' il centro dello schermo e' il
          // corridoio fra le colonne, spazio vuoto, niente da selezionare.)
          // Poi la domanda e' stata portata al passato — «c'era una
          // selezione PRIMA che il dito si posasse?» — che curava il caso
          // ma teneva in piedi un ramo dove il tocco poteva ancora morire.
          //
          // Adesso non c'e' nessun ramo: **un tocco breve fa sempre
          // qualcosa**, e cio' che fa lo dice solo DOVE cade — ai bordi la
          // pagina volta, altrove le barre vanno e vengono. Si puo' perche'
          // selezionare vuole la pressione lunga, che `scattato` scarta
          // gia' prima di arrivare qui (`PRESSIONE`, 500ms) insieme al
          // trascinamento (`MOSSA`, 12px): il gesto della selezione e
          // quello del tocco non si incontrano mai.
          //
          // Restano fuori tre cose, e sono tutte VISIBILI sotto il dito, non
          // stati invisibili: un collegamento (sopra), un termine segnato
          // del glossario e un rimando di nota. Chi non li vuole ha la
          // levetta «Segna i termini della saga».
          //
          // Quel che il browser si e' selezionato da solo si disfa, o il
          // lettore si ritroverebbe le maniglie di selezione addosso a ogni
          // tocco.
          const sel = selezione();
          if (sel?.toString()) { try { sel.removeAllRanges(); } catch { /* selezione non disfabile */ } }
          const ix = termsRef.current;
          if (ix) {
            const hit = termAt(doc, x, y, ix);
            if (hit) return openTerm(hit);
          }
          // l'asterisco è un bersaglio da pochi pixel, e pretendere il
          // tocco esatto su un tablet è pretendere una mira che non c'è
          // (segnalato: «come mai non riesco a cliccare l'asterisco?»):
          // un tocco caduto a un soffio da un rimando è per il rimando,
          // non per la voltata
          const vicino = piuVicina(
            [...doc.querySelectorAll("a[href]")]
              .filter((el) => eNotaRef(infoRimando(el)))
              .map((el) => {
                const rc = el.getBoundingClientRect();
                return { left: rc.left, top: rc.top, right: rc.right, bottom: rc.bottom, href: el.getAttribute("href") || "" };
              }),
            x,
            y
          );
          if (vicino) return apriNotaRef.current(vicino.href, doc, view.section?.href || "");
          if (isTouch() && live.current.settings.flow !== "scrolled") {
            // dentro il capitolo le coordinate vivono nello spazio delle
            // colonne, largo quanto tutto il testo: vanno riportate allo
            // schermo, dove le fasce sono le stesse del bordo del libro
            const frameEl = view.contents.window.frameElement;
            if (frameEl && window.innerWidth) {
              const rel = (frameEl.getBoundingClientRect().left + x) / window.innerWidth;
              if (rel < TAP_PREV) return turnRef.current("prev");
              if (rel > TAP_NEXT) return turnRef.current("next");
            }
          }
          setChrome((v) => !v);
        };
        // TRE CANALI PER LO STESSO GESTO, e il primo che arriva vince.
        //
        // Il lettore ha segnalato due volte che toccando il testo non
        // succede niente, e qui su Chromium — tocco vero, pagina singola,
        // in piedi e sdraiato — succede sempre. Non e' una cosa che si
        // indovina: si copre. `pointerup` e' l'evento unificato dei
        // browser moderni, `touchend` quello del dito, `click` quello che
        // il motore sintetizza dopo — e quel terzo e' un favore, non una
        // garanzia. Basta che ne arrivi UNO.
        //
        // Il guardiano e' l'ora dell'ultimo servito: gli altri due, che
        // per lo stesso gesto arrivano subito dopo, si lasciano cadere. Se
        // saltasse, un tocco solo nasconderebbe e rimostrerebbe le barre
        // nello stesso gesto — cioe' di nuovo «non succede niente».
        const scattato = (bersaglio, x, y, partenza) => {
          if (!partenza) return;
          if (Math.abs(x - partenza.x) > MOSSA || Math.abs(y - partenza.y) > MOSSA) return;
          if (Date.now() - partenza.quando > PRESSIONE) return;
          if (Date.now() - ditoRef.current < DOPPIONE) return;
          ditoRef.current = Date.now();
          tocco(bersaglio, x, y);
        };
        doc.addEventListener(
          "pointerdown",
          (e) => {
            if (e.isPrimary === false) return;
            giu = { x: e.clientX, y: e.clientY, quando: Date.now() };
          },
          { passive: true }
        );
        doc.addEventListener(
          "pointerup",
          (e) => {
            const p = giu;
            giu = null;
            if (e.isPrimary === false) return;
            scattato(e.target, e.clientX, e.clientY, p);
          },
          { passive: true }
        );
        doc.addEventListener(
          "touchstart",
          (e) => {
            if (e.touches.length !== 1) { giu = null; return; }
            // il `pointerdown` di solito e' gia' passato: si tiene il piu'
            // vecchio dei due, che e' quello dove il dito si e' posato
            giu = giu || { x: e.touches[0].clientX, y: e.touches[0].clientY, quando: Date.now() };
          },
          { passive: true }
        );
        doc.addEventListener(
          "touchend",
          (e) => {
            const p = giu;
            giu = null;
            if (e.changedTouches.length !== 1) return;
            const t = e.changedTouches[0];
            scattato(t.target || e.target, t.clientX, t.clientY, p);
          },
          { passive: true }
        );
        doc.addEventListener("click", (e) => {
          if (Date.now() - ditoRef.current < DOPPIONE) return;
          ditoRef.current = Date.now();
          tocco(e.target, e.clientX, e.clientY);
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
      // UN CFI STORTO ESPLODE IN MODO SINCRONO, E COSI' SCAVALCA IL `catch`.
      // E' la stessa trappola gia' presa in `ripassaImpronte`: `display` non
      // torna una promessa rifiutata, LANCIA mentre la analizza, quindi il
      // `.catch` qui sotto non si attaccava nemmeno. L'errore risaliva fino
      // al giro che apre il libro e il lettore si vedeva «questo tomo non si
      // lascia aprire… il file potrebbe essere danneggiato»: un romanzo
      // perfettamente sano dichiarato rotto per colpa di un segnalibro, con
      // l'unica via d'uscita di cancellare il libro e reimportarlo. Il giro
      // per `Promise.resolve()` fa diventare rifiuto anche lo scoppio
      // sincrono, e da li' in poi c'e' un solo modo di fallire da gestire.
      Promise.resolve()
        .then(() => r.display(target || undefined))
        .catch(() => {
          // non si e' potuto tornare dov'era: si riparte dall'inizio, ma il
          // segno salvato resta intatto e il lettore lo viene a sapere
          if (target) {
            segnoDaTenere.current = target;
            setRitornoFallito(true);
          }
          return r.display();
        })
        .then(() => {
          if (rendRef.current !== r) return setStatusUi("ready");
          // solo ADESSO epub.js e' fermo: la misura dell'avanzo puo'
          // entrare senza trovarlo a meta' del montaggio. E la candela
          // resta accesa finche' il ritaglio non ha fatto il suo giro:
          // altrimenti la pagina compare lunga e si riassesta sotto gli
          // occhi del lettore — un'apertura che si corregge da sola.
          avanzoPronto.current = true;
          clearTimeout(prontoTimer.current);
          prontoTimer.current = setTimeout(() => {
            const ritagliato = rendRef.current === r && misuraAvanzoRef.current();
            if (!ritagliato) return setStatusUi("ready");
            prontoTimer.current = setTimeout(() => setStatusUi("ready"), 300);
          }, 350);
          // e comunque, qualunque cosa succeda: passato questo tempo la
          // pagina si mostra. Un velo che resta e' peggio di una pagina
          // che si assesta sotto gli occhi.
          clearTimeout(sicurezzaTimer.current);
          sicurezzaTimer.current = setTimeout(() => setStatusUi("ready"), SICUREZZA_CANDELA);
        });
      if (target) {
        const fix = () => {
          if (moved.current || rendRef.current !== r) return;
          if (live.current.cfi === target) return;
          anchor.current = target;
          reflowing.current = true;
          clearTimeout(reflowTimer.current);
          reflowTimer.current = setTimeout(() => { reflowing.current = false; }, 1500);
          // stessa cura del primo `display`: uno scoppio sincrono qui
          // lascerebbe `reflowing` acceso per sempre
          Promise.resolve()
            .then(() => r.display(target))
            .catch(() => { reflowing.current = false; });
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
        // il segno si controlla PRIMA di darlo a epub.js: uno storto non si
        // puo' prendere, si puo' solo non consegnare (vedi `cfiLeggibile`)
        if (live.current.cfi && !cfiLeggibile(ePub.CFI, live.current.cfi)) {
          segnoDaTenere.current = live.current.cfi;
          live.current.cfi = null;
          setRitornoFallito(true);
        }
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
        // la misura stantia dell'apertura si riprende QUI, sotto la
        // candela ancora accesa: il lettore non vede nessuno scatto
        if (scartoRiquadro() >= 8) {
          relayout(anchor.current || live.current.cfi);
          chiediAvanzo(400);
        }
        // e un secondo sguardo poco dopo: le barre di Android possono
        // rientrare anche a candela già spenta, senza che il riquadro
        // cambi — l'osservatore lì non vede niente, questo sì
        setTimeout(() => {
          if (dead || scartoRiquadro() < 8) return;
          relayout(anchor.current || live.current.cfi);
          chiediAvanzo(400);
        }, 2500);
        // LO STANDARD (il testo copre la pagina) NON STA PIU' SULLA STRADA
        // DELL'APERTURA: prima il verdetto si prendeva PRIMA di rendere,
        // e sulla prima apertura voleva dire leggere tutto il libro con
        // la candela accesa (segnalato: «come mai ci mette così tanto ad
        // aprire il tomo?»). Ora la pagina compare subito e il controllo
        // gira dietro, SU UN'ISTANZA USA-E-GETTA — caricare e scaricare i
        // capitoli dell'istanza che sta rendendo le tirerebbe il tappeto.
        // Se c'è da ricucire un libro senza segni, si ricuce e si riapre:
        // la candela torna un attimo, una volta nella vita del libro.
        (async () => {
          let ebScan = null;
          try {
            let salute = await saluteInCache(book.id, blob.size);
            if (!salute) {
              ebScan = ePub(await blob.arrayBuffer());
              await ebScan.ready;
              salute = await controllaSpezzatura(book.id, ebScan, blob.size);
            }
            if (dead || !salute || !daRicucire(salute)) return;
            if (conSegni(book.id)) {
              if (!salute.taciuto) setCucitura("offri");
              return;
            }
            const r = await ricuciLibro(book.id, blob);
            if (!r?.blob || dead) return;
            notify?.("Questo libro era spezzato: l'ho ricucito 🪡");
            saltaPct.current = live.current.progress || 0;
            setStatusUi("loading");
            setGiro((g) => g + 1);
          } catch {
            /* un controllo che fallisce non tocca la lettura */
          } finally {
            try { ebScan?.destroy(); } catch { /* già chiuso */ }
          }
        })();
        if (live.current.cfi) {
          const p = eb.locations.percentageFromCfi(live.current.cfi);
          if (Number.isFinite(p)) {
            live.current.progress = p;
            setProgressUi(p);
          }
        }
        // il segno rimesso dopo una ricucitura: il CFI vecchio parlava di
        // file che non esistono più, la percentuale invece è del romanzo.
        // NON si salta subito: epub.js sta ancora montando la prima
        // display, e rientrargli adesso è la trappola già pagata
        // dall'avanzo — si aspetta che l'approdo si sia assestato.
        if (saltaPct.current != null) {
          const pct = Math.min(Math.max(saltaPct.current, 0), 0.999);
          saltaPct.current = null;
          let dove = eb.locations.cfiFromPercentage(pct);
          // `cfiFromPercentage` torna un CFI A INTERVALLO (con la virgola),
          // e `display` su quello non si muove: si ripiega sul suo inizio
          try {
            const c = new ePub.CFI(dove);
            c.collapse(true);
            dove = c.toString();
          } catch { /* già un punto */ }
          // L'ANCORA SI SPOSTA SUBITO, prima ancora del salto: il ritaglio
          // dell'avanzo era già in coda col suo reimpaginamento, e
          // atterrando sull'ancora vecchia (l'inizio) si rimangiava il
          // salto un attimo dopo. Con l'ancora già sul segno, qualunque
          // reimpaginamento successivo atterra lì da solo.
          if (dove) {
            anchor.current = dove;
            live.current.cfi = dove;
            // atterraggio RIPETUTO, come al confine di capitolo: la prima
            // display puo' venire assorbita dall'assestamento del montaggio
            for (const ritardo of [1200, 2400]) {
              setTimeout(() => {
                try { goTo(dove); } catch { /* il libro resta apribile */ }
              }, ritardo);
            }
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
    // IL TASTO INDIETRO DEL DISPOSITIVO, che App ci gira: stessa fila
    // dell'Escape — prima il menu della selezione, poi il pannello, e solo
    // quando non c'e' piu' niente sopra si chiude il libro, dalla porta di
    // sempre, o il punto di lettura non verrebbe salvato. `true` significa
    // «l'ho chiuso io e il libro resta aperto»: la' fuori serve a sapere
    // che la guardia va rimessa, perche' qui dentro non e' cambiato niente
    // che faccia rifare un giro ad App. Le mire su `live` sono gia' in
    // pari a ogni render, quindi questa funzione si registra una volta
    // sola e legge sempre lo stato di adesso.
    if (indietro) {
      indietro.current = () => {
        if (live.current.selMenu) { setSelMenu(null); return true; }
        if (live.current.panel) { setPanel(null); return true; }
        handleClose();
        return false;
      };
    }
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("beforeunload", flush);
    window.addEventListener("keydown", onKey);
    return () => {
      dead = true;
      if (indietro) indietro.current = null;
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("beforeunload", flush);
      window.removeEventListener("keydown", onKey);
      clearTimeout(saveTimer.current);
      clearTimeout(reflowTimer.current);
      clearTimeout(avanzoTimer.current);
      clearTimeout(prontoTimer.current);
      clearTimeout(sicurezzaTimer.current);
      fixTimers.current.forEach(clearTimeout);
      flush();
      try { rendRef.current?.destroy(); } catch { /* già distrutto */ }
      try { epubRef.current?.destroy(); } catch { /* già distrutto */ }
    };
    // `giro` cresce solo quando una ricucitura ha riscritto i byte: il
    // libro si riapre da capo su quelli nuovi
  }, [giro]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // IL RIQUADRO SI GUARDA DA SÉ. Il vecchio ResizeObserver decideva LUI
  // quando reimpaginare ed è stato tolto con la pulizia del reader; questo
  // non decide niente: nota solo che pagina e riquadro DIVERGONO (le barre
  // di sistema rientrate dopo l'apertura, uno schermo diviso) e riprende
  // la misura sotto il velo color carta — il lettore non deve vedere lo
  // scatto («sta cosa che fa uno scatto per aggiustarsi non mi piace»).
  // Mai durante il montaggio (regola dell'avanzo): prima delle locations
  // ci pensa il controllo sotto la candela.
  const roTimer = useRef(null);
  useEffect(() => {
    const el = viewerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      clearTimeout(roTimer.current);
      roTimer.current = setTimeout(() => {
        if (!live.current.locReady || !rendRef.current) return;
        if (scartoRiquadro() < 8) return;
        setVelo(true);
        setTimeout(() => {
          relayout(anchor.current || live.current.cfi);
          chiediAvanzo(700);
          setTimeout(() => setVelo(false), 700);
        }, 110);
      }, 300);
    });
    ro.observe(el);
    return () => {
      clearTimeout(roTimer.current);
      ro.disconnect();
    };
  }, [scartoRiquadro, relayout, chiediAvanzo]);



  useEffect(() => {
    const onFs = () => setIsFs(!!document.fullscreenElement);
    const onGira = () => setInPiedi(window.innerWidth < window.innerHeight);
    window.addEventListener("resize", onGira);
    window.addEventListener("orientationchange", onGira);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      window.removeEventListener("resize", onGira);
      window.removeEventListener("orientationchange", onGira);
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
  // LA SVOLTA DELLA PAGINA, e perché stavolta si può fare.
  //
  // Il foglio animato di allora fotografava la pagina in un canvas a ogni
  // voltata, e quella fotografia era il costo che l'ha fatto togliere.
  // Oggi la fotografia la fa il BROWSER, sul compositore: le View
  // Transitions congelano lo stato vecchio e quello nuovo da sole, e a noi
  // resta solo da dire come il vecchio deve andarsene — una rotazione
  // attorno al dorso, che è la svolta di un foglio.
  //
  // Lo scorrimento laterale è stato provato e TOLTO su richiesta del
  // lettore («o fai l'effetto svolta pagina oppure niente»): non
  // rimetterlo. E lo scivolo non è nemmeno un ripiego onesto qui, perché
  // il lettore ha chiesto o la svolta o la dissolvenza di sempre.
  const svoltaViva = useRef(null);
  const svoltaGuardia = useRef(null);
  // il gettone della dissolvenza: l'ultimo gesto comanda
  const dissolvenza = useRef(0);
  // quanto ci mette il velo a coprire davvero. La transizione in CSS dura
  // 90ms: si aspetta un soffio in piu', o la pagina cambierebbe mentre il
  // velo e' ancora trasparente — cioe' a vista.
  const VELO_SU = 110;
  // oltre questo la svolta si considera persa e il reader torna a voltare
  // e basta: una pagina che non gira e' un peccato, una pagina che non
  // volta piu' e' un reader rotto
  const SVOLTA_GUARDIA = 1500;

  // `dopo` e' il lavoro che NON deve correre insieme alla piega:
  // `reportLocation` fa scattare `relocated`, che aggiorna lo stato e fa
  // ridisegnare React — e sul tablet quel lavoro occupava il filo
  // principale proprio nei 600ms dell'animazione, che usciva a scatti
  // (misurato: 4-5 fotogrammi al posto di 18, riprodotto al banco con la
  // CPU strozzata 8×). La pagina e' GIA' voltata quando la piega parte —
  // la fotografia nuova la fa il browser — quindi il conteggio puo'
  // aspettare la fine senza che nessuno se ne accorga.
  function laSvolta(r, dir, fai, dopo) {
    const doc = document;
    const radice = doc.documentElement;
    const subito = () => {
      fai();
      dopo?.();
    };
    // senza View Transitions (o con «meno animazioni» acceso nel sistema)
    // si volta e basta: niente effetto, nessun difetto
    if (typeof doc.startViewTransition !== "function" || riduciMovimento()) return subito();
    if (live.current.settings.svolta === "nessuna") return subito();
    // LA DISSOLVENZA NON FOTOGRAFA NIENTE, ed e' tutta la differenza.
    //
    // La spazzata e' bella e costa: le View Transitions fotografano la
    // pagina due volte — prima e dopo il cambio — e ognuna e' un'immagine
    // grande quanto lo schermo per la densita' dello schermo. Misurato col
    // processore strozzato sei volte: ~510ms di filo principale occupato
    // per voltata, contro i ~140 di una voltata nuda. Il tempo in piu' non
    // si vede come uno scatto dentro il movimento (quello corre sul
    // compositore) ma come un'ATTESA prima che il movimento cominci.
    //
    // Qui invece il velo color carta sale in un soffio, la pagina cambia
    // sotto di lui — l'attesa e' coperta, che e' esattamente il mestiere
    // di un velo — e poi scende piano. Nessuna fotografia, nessun tempo
    // in piu': la voltata costa quanto voltare.
    if (live.current.settings.svolta === "dissolvenza") {
      const mio = ++dissolvenza.current;
      setVelo(true);
      setTimeout(() => {
        // un gesto piu' recente comanda: due dissolvenze accavallate
        // lascerebbero il velo alzato sulla pagina sbagliata
        if (mio !== dissolvenza.current) return;
        subito();
        setVelo(false);
      }, VELO_SU);
      return;
    }
    // una voltata mentre l'altra gira: si fa senza effetto, o le due
    // fotografie si accavallano
    if (svoltaViva.current) return subito();
    radice.classList.add(dir === "next" ? "bc-volta-next" : "bc-volta-prev");
    const pulisci = () => {
      // puo' arrivarci due volte (la guardia E la promessa): il lavoro
      // rimandato deve girare una volta sola
      if (!svoltaViva.current) return;
      clearTimeout(svoltaGuardia.current);
      svoltaGuardia.current = null;
      svoltaViva.current = null;
      radice.classList.remove("bc-volta-next", "bc-volta-prev");
      dopo?.();
    };
    let vt;
    try {
      vt = doc.startViewTransition(fai);
    } catch {
      // la guardia di `pulisci` qui non aiuta (la transizione non e' mai
      // esistita): le classi appese si tolgono a mano
      radice.classList.remove("bc-volta-next", "bc-volta-prev");
      return subito();
    }
    svoltaViva.current = vt;
    // LA RETE DI SICUREZZA, e non e' pignoleria: se per qualunque ragione
    // la transizione non si chiude, senza questa il segnaposto resterebbe
    // occupato per sempre e da li' in poi OGNI voltata prenderebbe la
    // strada del «ne sta gia' girando una» — cioe' nessuna pagina
    // girerebbe mai piu'. E' successo davvero (vedi il commento sulla
    // coda di epub.js qui sotto).
    svoltaGuardia.current = setTimeout(pulisci, SVOLTA_GUARDIA);
    vt.finished.then(pulisci, pulisci);
  }

  // «meno animazioni» del sistema si rispetta: chi l'ha acceso ha le sue
  // ragioni, e una pagina che gira e' esattamente cio' che ha chiesto di
  // non vedere
  function riduciMovimento() {
    try {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      return false;
    }
  }

  const inAttesa = useRef(null);
  function step(r, dir) {
    if (inAttesa.current) {
      const subito = inAttesa.current;
      inAttesa.current = null;
      subito();
    }

    // LA PAGINA SVOLTA DENTRO IL CAPITOLO, AL CONFINE RESTA IL VELO. Non
    // sono due lingue per capriccio: dentro il capitolo la pagina dopo è
    // già impaginata di fianco e la voltata è istantanea, quindi si può
    // far girare il foglio sopra a un risultato che non cambierà più; al
    // confine il capitolo si smonta e la misura balla finché non arrivano
    // i font, e far girare un foglio che poi si riassesta sotto gli occhi
    // è proprio il difetto che il velo era venuto a curare.
    //
    // L'AVANZO DI CARTA SI CHIEDE PER PRIMO. È il caso in cui epub.js
    // cederebbe il passo al capitolo dopo pur restando una striscia di
    // testo da leggere: `dentroIlCapitolo` risponde «no» — e ha ragione,
    // perché è la SUA domanda — ma quella striscia è carta di questo
    // capitolo, già impaginata di fianco, e svolta come tutte le altre.
    const resto = settings.svolta !== "nessuna" && dir === "next" ? leftoverScroll(r.manager) : 0;
    if (resto) {
      laSvolta(r, dir, () => {
        r.manager.scrollBy(resto, 0, true);
      }, () => r.reportLocation());
      return;
    }
    if (settings.svolta !== "nessuna" && dentroIlCapitolo(r.manager, dir)) {
      // LA VOLTATA QUI DENTRO NON PASSA DALLA CODA DI EPUB.JS, e non e'
      // una scorciatoia: e' l'unico modo che funzioni. `rendition.next()`
      // mette il lavoro in coda e la coda gira dentro un
      // `requestAnimationFrame`; ma `startViewTransition` SOSPENDE il
      // rendering finche' il suo callback non ha finito, quindi il rAF
      // non arriva mai, la coda non gira mai e la promessa non si chiude
      // mai. Uno stallo pulito: nessun errore, la prima pagina non gira e
      // da li' in poi non gira piu' niente.
      //
      // Dentro il capitolo `manager.next()` e' una riga sincrona — sposta
      // `scrollLeft` di una facciata — e `reportLocation` e' quello che
      // `rendition.next()` farebbe dopo. Si fa quello, dentro il
      // callback, e la transizione si chiude nello stesso istante.
      laSvolta(r, dir, () => {
        if (dir === "next") r.manager.next();
        else r.manager.prev();
      }, () => r.reportLocation());
      return;
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
    segnoDaTenere.current = null;
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
    // `paragrafi` sta con gli altri tre: la cura vive in `hooks.content`,
    // che gira quando un documento si carica — senza rifare la rendition
    // la levetta non si vedrebbe fino al capitolo dopo.
    if ("flow" in patch || "spread" in patch || "font" in patch || "paragrafi" in patch) makeRendition(next);
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

  // La nota si estrae dal documento che la ospita: stesso file = la pagina
  // che hai davanti; un file a parte (le note in fondo al libro) si apre e
  // si richiude senza che la vista si muova. Se non c'è niente da estrarre
  // si ripiega sul salto di prima: un rimando muto è peggio di un salto.
  // LA NOTA SI CERCA DOVE STA, NON DOVE CI ASPETTIAMO CHE STIA. Il
  // rimando dice un frammento; il documento che lo ospita puo' essere
  // quello aperto, quello dichiarato nell'href, o — nei libri convertiti
  // da Mobi, dove i `filepos` puntano a ancore sparse — un altro
  // qualunque della spina. Si guarda in quest'ordine, e si smette al
  // primo che risponde: un capitolo alla volta, aperto e RICHIUSO.
  //
  // La nota si prende in PEZZI, non come stringa: dentro può esserci un
  // altro rimando (Pratchett le annida), e da una stringa quel rimando
  // non si può più toccare. I pezzi si costruiscono PRIMA dello
  // `unload()`: scaricato il capitolo, il documento non c'è più.
  async function notaDaSpina(frammento, saltando) {
    const eb = epubRef.current;
    const voci = eb?.spine?.spineItems || eb?.spine?.items || [];
    for (const item of voci) {
      if (!item || item.href === saltando) continue;
      let trovato = null;
      try {
        await item.load(eb.load.bind(eb));
        const el = trovaNota(item.document, frammento);
        if (el) trovato = { pezzi: pezziNota(el), base: item.href };
      } catch {
        trovato = null;
      } finally {
        try { item.unload(); } catch { /* già scaricato */ }
      }
      if (trovato?.pezzi.length) return trovato;
    }
    return null;
  }

  apriNotaRef.current = async (href, doc, base, incatena = false) => {
    const { file, frammento } = risolviHref(href, base);
    const capo = String(base).split("#")[0];
    // 1. la pagina che hai davanti: e' il caso comune e non costa niente
    let trovata = null;
    const qui = trovaNota(doc, frammento);
    if (qui) trovata = { pezzi: pezziNota(qui), base: capo };
    // Il capitolo si salta SOLO se l'abbiamo davvero già guardato. Aprendo
    // una nota da DENTRO un'altra il documento non c'è più (il capitolo è
    // stato scaricato), e senza questa distinzione una nota annidata che
    // sta nello stesso file non veniva trovata da nessuno dei due passi:
    // il passo 2 la saltava per «è il file che hai davanti», il passo 3 la
    // saltava per «l'ha già vista il passo 2».
    const giaVisto = doc ? capo : null;
    // 2. il documento che il rimando dichiara
    if (!trovata?.pezzi.length && file && file !== giaVisto) {
      const eb = epubRef.current;
      const item = eb?.spine?.get?.(file);
      if (item) {
        try {
          await item.load(eb.load.bind(eb));
          const el = trovaNota(item.document, frammento);
          if (el) trovata = { pezzi: pezziNota(el), base: file };
        } catch {
          trovata = null;
        } finally {
          try { item.unload(); } catch { /* già scaricato */ }
        }
      }
    }
    // 3. tutto il resto del libro, un capitolo alla volta
    if (!trovata?.pezzi.length && frammento) trovata = await notaDaSpina(frammento, giaVisto);
    // 4. non c'e': si DICE. Un tocco che non fa niente sembra un tasto
    //    rotto — e per il lettore lo e'.
    const nuova = trovata?.pezzi.length
      ? trovata
      : {
          pezzi: [
            {
              tipo: "testo",
              testo: "Questa nota non si trova nel file del libro: il rimando punta a un punto che non c'è.",
            },
          ],
          base: capo,
        };
    // una nota aperta DA DENTRO un'altra impila: il ↩ riporta a quella di
    // prima, non chiude tutto — la nota di partenza è il contesto in cui
    // il rimando aveva un senso
    setNota((prima) => ({ ...nuova, sotto: incatena && prima ? [...(prima.sotto || []), prima] : [] }));
  };

  // il ↩ della nota annidata: si torna di un piano, non alla pagina
  function tornaNota() {
    setNota((n) => {
      const sotto = n?.sotto || [];
      if (!sotto.length) return null;
      const prima = sotto[sotto.length - 1];
      return { ...prima, sotto: sotto.slice(0, -1) };
    });
  }

  // il consenso dal banner: si ricuce ADESSO, si tiene la percentuale come
  // segno (il CFI vecchio parla di file morti), e il libro si riapre da
  // capo sui byte nuovi con la candela accesa
  async function ricuciOra() {
    if (cucitura === "cucio") return;
    setCucitura("cucio");
    const bytes = await getFile(book.id).catch(() => null);
    const r = bytes && (await ricuciLibro(book.id, bytes).catch(() => null));
    if (!r?.blob) {
      setCucitura(null);
      notify?.("La ricucitura non ha trovato pezzi da unire: reimporta il file");
      return;
    }
    saltaPct.current = live.current.progress || getProgress(book.id) || 0;
    live.current.cfi = null;
    try { localStorage.removeItem(`bc_cfi_${book.id}`); } catch { /* resterà, e verrà riscritto */ }
    setCucitura(null);
    setStatusUi("loading");
    setGiro((g) => g + 1);
  }

  function piuTardi() {
    setCucitura(null);
    // «più tardi» si rispetta: niente banner alla prossima apertura, la
    // cura resta nella visita
    taci(book.id);
  }

  function goTo(target, flash) {
    const r = rendRef.current;
    if (!r) return;
    moved.current = true;
    segnoDaTenere.current = null;
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
  // E QUI FUORI VALEVA ANCORA LA REGOLA VECCHIA. Dentro l'iframe il tocco
  // si serve da se' da tre canali (`pointerup`, `touchend`, `click`) da
  // quando si e' scoperto che col dito il `click` e' un favore del motore e
  // non una garanzia. Questa meta' era rimasta indietro col solo `onClick`,
  // e nessuno se n'era accorto perche' il difetto si vede uguale da tutt'e
  // due le parti: tocchi e non succede niente.
  //
  // Ed e' la meta' che spiega il «a pagina singola», che sembrava un
  // dettaglio e invece era l'indizio: a colonna singola il libro e' piu'
  // stretto e attorno resta piu' cornice, quindi molti tocchi cadono
  // proprio qui — dove c'era solo il canale fragile. A due pagine il libro
  // riempie la larghezza e quasi tutti i tocchi finiscono sul testo, dove
  // la cura c'era gia'.
  function decidiAside(target, clientX) {
    const root = rootRef.current;
    if (target !== root && !bookRef.current?.contains(target)) return;
    if (selMenu) return setSelMenu(null);
    if (paginated && status === "ready") {
      const rel = clientX / (window.innerWidth || 1);
      if (rel < TAP_PREV) return turn("prev");
      if (rel > TAP_NEXT) return turn("next");
    }
    setChrome((v) => !v);
  }

  function tapAside(e) {
    if (Date.now() - ditoRef.current < DOPPIONE) return;
    ditoRef.current = Date.now();
    decidiAside(e.target, e.clientX);
  }

  function asideGiu(e) {
    asideRef.current =
      e.touches?.length === 1
        ? { x: e.touches[0].clientX, y: e.touches[0].clientY, quando: Date.now() }
        : null;
  }

  // Qui NON si sfoglia: la sfogliata col dito vive dentro il capitolo, dove
  // c'e' il testo. Qui si riconosce solo il tocco fermo e breve, con le
  // stesse due soglie di dentro — oltre `MOSSA` stava trascinando, oltre
  // `PRESSIONE` stava premendo per selezionare.
  function asideSu(e) {
    const p0 = asideRef.current;
    asideRef.current = null;
    if (!p0) return;
    const t = e.changedTouches?.[0];
    if (!t) return;
    if (Math.abs(t.clientX - p0.x) > MOSSA || Math.abs(t.clientY - p0.y) > MOSSA) return;
    if (Date.now() - p0.quando > PRESSIONE) return;
    if (Date.now() - ditoRef.current < DOPPIONE) return;
    ditoRef.current = Date.now();
    decidiAside(t.target || e.target, t.clientX);
  }

  // LA LINGUETTA DELLA BARRA: UN INTERRUTTORE, NON MEZZO.
  //
  // Terza forma, e le prime due erano sbagliate per due ragioni diverse che
  // il lettore ha detto meglio di come le direi io. (1) Un trattino sfumato
  // in cima: «ma dove sarebbe quello che hai fatto?» — c'era, e non si
  // trovava. (2) Una pastiglia ben visibile, sempre in cima: «non ha alcun
  // senso in quella posizione perche' viene coperto dalla barra quando
  // aperta e non posso farlo scomparire, inoltre e' troppo visibile».
  //
  // La seconda critica smaschera l'errore vero: **stava in un posto fisso
  // mentre comandava una cosa che si muove**. A barre aperte finiva SOTTO
  // la barra, quindi apriva e non chiudeva — mezzo interruttore. E per
  // farsi trovare a barre chiuse doveva gridare, perche' non aveva nessun
  // contesto attorno a cui appoggiarsi.
  //
  // Adesso e' la linguetta della barra, e sta in DUE posti perche' e' la
  // stessa cosa in due stati: appesa al bordo inferiore della barra quando
  // e' aperta (`top: 100%`, cosi' scende con lei senza che nessuno debba
  // sapere quanto e' alta — dipende dal suo contenuto e non e' una
  // costante), e sul bordo dello schermo quando e' chiusa. Non e' coperta
  // mai. La freccia dice il verso, come la maniglia di un cassetto.
  //
  // E puo' tornare discreta proprio perche' ha una FORMA: una linguetta si
  // riconosce anche in penombra, una riga sottile no — che era il difetto
  // della prima versione. A barre aperte fa parte della barra, a barre
  // chiuse resta appena accennata. Bersaglio pieno (44px), come sempre.
  const linguetta = () => (
    <button
      onClick={() => setChrome((v) => !v)}
      aria-label={chrome ? "Nascondi le barre" : "Mostra le barre"}
      style={{
        position: "absolute",
        top: chrome ? "100%" : 0,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 24,
        width: 76,
        height: 44,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        background: "transparent",
        border: "none",
        padding: 0,
      }}
    >
      <span
        style={{
          display: "block",
          width: 46,
          padding: "3px 0 4px",
          textAlign: "center",
          borderRadius: `0 0 ${R.piccolo}px ${R.piccolo}px`,
          background: C.surface,
          borderBottom: `1px solid ${C.border}`,
          borderLeft: `1px solid ${C.border}`,
          borderRight: `1px solid ${C.border}`,
          color: C.muted,
          fontSize: F.minuscolo,
          lineHeight: 1,
          opacity: chrome ? 1 : 0.5,
        }}
      >
        {chrome ? "\u2303" : "\u2304"}
      </span>
    </button>
  );

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
      onTouchStart={asideGiu}
      onTouchEnd={asideSu}
      onTouchCancel={() => {
        asideRef.current = null;
      }}
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
        {/* IL NOME STA SUL GUSCIO CHE CONTIENE ANCHE I VELI, e non e' un
            dettaglio: e' la cura definitiva del lampo di luce. I veli
            fotografati a parte hanno tradito su TUTT'E DUE i motori, in
            fasi diverse del sipario (su Gecko la fotografia nuova arriva
            in ritardo, su Chromium la vecchia e' vuota e la fase d'attesa
            mostra la pagina nuda: misurato, 100-200ms di piena luce a
            ogni voltata). Coi veli DENTRO l'elemento fotografato, le
            fotografie nascono gia' velate: non esiste piu' nessuna fase
            in cui la pagina giri senza la sua luce. Prezzo dichiarato:
            le barre — translucide e quasi sempre nascoste — non si
            scuriscono piu' coi filtri. */}
        <div
          style={{
            position: "absolute",
            inset: FRAME,
            borderRadius: R.minimo,
            overflow: "hidden",
            ...(settings.svolta === "spazzata" ? { viewTransitionName: "bc-pagina" } : {}),
          }}
        >
          <div
            ref={viewerRef}
            style={{
              position: "absolute",
              inset: 0,
              // l'avanzo si toglie da SOTTO: cosi' il testo resta ancorato in
              // alto e la pagina non balla quando la misura cambia
              padding: `${HEAD}px ${paginated ? Math.max(settings.margin, EDGE_MAX + 8) : settings.margin}px calc(${FOOT + avanzo}px + env(safe-area-inset-bottom))`,
              boxSizing: "border-box",
              // la carta arriva fino al bordo interno della rilegatura: senza,
              // il margine di lettura mostrava la copertina e staccava le
              // pagine impilate dal foglio
              background: theme.bg,
            }}
          />
          {/* i veli del libro: l'alfa sta nel colore (un riempimento
              uniforme rgba e' identico a tinta+opacity, ma i pixel
              semi-trasparenti viaggiano fedeli in ogni fotografia) */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              zIndex: 9,
              background: `rgba(255, 154, 60, ${settings.warmth})`,
              mixBlendMode: "multiply",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              zIndex: 9,
              background: `rgba(0, 0, 0, ${1 - settings.brightness})`,
            }}
          />
        </div>
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
        {/* IL TAGLIO DELLE PAGINE NON HA SENSO IN SCORRIMENTO, e la
            domanda l'ha fatta il lettore guardando lo schermo: «quando e' in
            mod scorrimento ha senso tenere le pagine ai lati?».
            No. Queste due pile fanno DUE lavori, e in scorrimento solo uno
            regge. Non sono simmetriche: la sinistra si ingrossa man mano che
            leggi (`edgeRead`), la destra si assottiglia — cioe' sono il
            progresso disegnato come lo spessore di un libro, e quello resta
            vero anche scorrendo. Ma quel progresso e' gia' scritto altre due
            volte, nella percentuale e nella barra in basso. Il lavoro UNICO
            delle pile e' l'illusione del volume rilegato con le facciate di
            fianco — ed e' esattamente cio' che lo scorrimento contraddice:
            li' non c'e' una facciata, c'e' un nastro. Resta solo la parte
            che mente, e si toglie.
            La cornice invece resta: quella e' la rilegatura, e un libro
            scorrevole e' pur sempre un libro. */}
        {/* tolte le pile, in scorrimento il rientro laterale torna a
            essere quello scelto dal lettore: quei 25px per lato esistevano
            solo per non finirci sotto */}
        {paginated && (
          <>
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
          </>
        )}
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

      {/* i nomi sui due veli non sono decorazione: il sipario delle View
          Transitions sta sopra TUTTO, filtri compresi, e senza fotografia
          propria ogni voltata era un lampo a piena luce per chi legge di
          notte con la luminosita' abbassata */}
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

      {/* fuori dalla barra: la linguetta da sola, sul bordo dello schermo */}
      {status === "ready" && !chrome && linguetta()}

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
            {/* appesa al bordo di sotto della barra: scende con lei */}
            {linguetta()}
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
                    maxWidth: px(150),
                    padding: "0 8px",
                    height: px(40),
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
                segnoDaTenere.current = null;
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
            {/* IN PIEDI LA DOPPIA PAGINA NON ESISTE, e la levetta non
                decide niente: `minSpreadWidth` sta a metà fra il lato
                corto e quello lungo dello schermo, quindi col tablet in
                verticale la facciata è una sola comunque sia messa. Un
                comando che non cambia nulla e' peggio di un comando che
                manca (chiesto dal lettore di toglierlo). Sdraiando il
                tablet ricompare da solo. */}
            {!inPiedi && (
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
            )}
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
          {/* Come si segna un paragrafo nuovo. Il rientro lo mette il
              LIBRO, non noi: su una pagina di dialoghi diventa una scaletta
              di righe che partono tutte spostate, e da lì è nata la
              domanda del lettore. */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: F.nota, color: C.muted }}>Paragrafi</span>
              <button
                onClick={() =>
                  updateSettings({ paragrafi: settings.paragrafi === "stacco" ? "rientro" : "stacco" })
                }
                style={{
                  padding: "6px 16px",
                  borderRadius: R.tondo,
                  fontSize: F.nota,
                  border: `1px solid ${settings.paragrafi === "stacco" ? C.accent : C.border}`,
                  color: settings.paragrafi === "stacco" ? C.accent : C.muted,
                  background: settings.paragrafi === "stacco" ? `${C.accent}14` : "transparent",
                }}
              >
                {settings.paragrafi === "stacco" ? "Staccati" : "Rientrati"}
              </button>
            </div>
            <p style={{ margin: "5px 0 0", fontSize: F.minuscolo, color: C.dim, lineHeight: 1.45 }}>
              {settings.paragrafi === "stacco"
                ? "Tutte le righe partono dallo stesso punto, e fra un paragrafo e l'altro c'è un respiro."
                : "La prima riga rientra, come in un romanzo stampato: è il rientro che il libro si porta dietro."}
            </p>
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: F.nota, color: C.muted }}>La pagina svolta</span>
              <div style={{ display: "flex", gap: 6 }}>
                {[
                  ["spazzata", "Spazzata"],
                  ["dissolvenza", "Dissolvenza"],
                  ["nessuna", "Nessuna"],
                ].map(([id, nome]) => (
                  <button
                    key={id}
                    onClick={() => updateSettings({ svolta: id })}
                    style={{
                      padding: "6px 12px",
                      borderRadius: R.tondo,
                      fontSize: F.nota,
                      border: `1px solid ${settings.svolta === id ? C.accent : C.border}`,
                      color: settings.svolta === id ? C.accent : C.muted,
                      background: settings.svolta === id ? `${C.accent}14` : "transparent",
                    }}
                  >
                    {nome}
                  </button>
                ))}
              </div>
            </div>
            <p style={{ margin: "5px 0 0", fontSize: F.minuscolo, color: C.dim, lineHeight: 1.45 }}>
              {settings.svolta === "spazzata"
                ? "Il foglio scorre via come sfogliato. È la più bella e la più cara: il browser fotografa la pagina due volte, e su uno schermo che fatica l'attesa prima del movimento si sente."
                : settings.svolta === "dissolvenza"
                  ? "Un velo color carta copre, la pagina cambia sotto, il velo scende. Non fotografa niente: costa quanto voltare e basta."
                  : "La pagina cambia e via. Al cambio di capitolo resta comunque il velo: lì la misura si assesta, e mostrarla mentre si assesta sarebbe peggio."}
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

      {/* NON SONO TORNATO DOV'ERI, E TE LO DICO. Un ripiego silenzioso è la
          metà peggiore del difetto: senza questa riga il lettore si ritrova
          a pagina uno e non ha modo di sapere se il suo segno è ancora da
          qualche parte — e col vecchio flush infatti non c'era più. */}
      {ritornoFallito && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            bottom: px(84),
            zIndex: 26,
            width: "min(640px, 92vw)",
            padding: "12px 16px",
            borderRadius: R.medio,
            border: `1px solid ${C.border}`,
            background: C.card,
            boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
            animation: "bc-fade-in 0.25s ease-out",
          }}
        >
          <p style={{ margin: 0, fontSize: F.nota, color: C.text, lineHeight: 1.5 }}>
            🔖 Non sono riuscito a tornare al punto dov'eri, e riparto dall'inizio.{" "}
            <strong>Il tuo segno è ancora salvato</strong>: chiudi e riapri il libro per riprovare.
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <button
              onClick={() => {
                // adottare questa posizione è una scelta, e va fatta a mano:
                // da qui in poi il segno vecchio non serve più
                segnoDaTenere.current = null;
                setRitornoFallito(false);
              }}
              style={{
                padding: "8px 14px",
                borderRadius: R.tondo,
                border: `1px solid ${C.arcane}66`,
                color: C.arcane,
                fontSize: F.piccolo,
              }}
            >
              Riparto da qui
            </button>
            <button
              onClick={() => setRitornoFallito(false)}
              style={{
                padding: "8px 14px",
                borderRadius: R.tondo,
                border: `1px solid ${C.border}`,
                color: C.muted,
                fontSize: F.piccolo,
              }}
            >
              Ho capito
            </button>
          </div>
        </div>
      )}

      {/* il libro spezzato si dice DOVE si legge, non in un referto da
          andare a cercare: è lo standard che il testo copra la pagina */}
      {cucitura && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            bottom: 84,
            zIndex: 26,
            width: "min(640px, 92vw)",
            padding: "12px 16px",
            borderRadius: R.medio,
            border: `1px solid ${C.border}`,
            background: C.card,
            boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
            animation: "bc-fade-in 0.25s ease-out",
          }}
        >
          <p style={{ margin: 0, fontSize: F.nota, color: C.text, lineHeight: 1.5 }}>
            📖 Questo libro è spezzato in più pezzi: le pagine possono finire a metà frase, con un
            vuoto sotto.
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <button
              onClick={ricuciOra}
              disabled={cucitura === "cucio"}
              style={{
                padding: "8px 14px",
                borderRadius: R.tondo,
                border: `1px solid ${C.arcane}66`,
                color: cucitura === "cucio" ? C.muted : C.arcane,
                fontSize: F.piccolo,
              }}
            >
              {cucitura === "cucio" ? "🪡 Ricucio…" : "🪡 Ricucilo ora — il segno resta dov'è"}
            </button>
            <button
              onClick={piuTardi}
              style={{
                padding: "8px 14px",
                borderRadius: R.tondo,
                border: `1px solid ${C.border}`,
                color: C.muted,
                fontSize: F.piccolo,
              }}
            >
              Più tardi
            </button>
          </div>
        </div>
      )}
      {/* la nota a piè di pagina, sul posto: la pagina sotto non si è
          mossa, quindi «tornare al punto in cui ero» è chiudere la scheda */}
      {nota && (
        <Panel title="Nota a piè di pagina" onClose={() => setNota(null)}>
          <p style={{ margin: 0, fontSize: F.corpo, lineHeight: 1.6, color: C.text }}>
            {nota.pezzi.map((p, i) =>
              p.tipo === "testo" ? (
                <span key={i}>{p.testo}</span>
              ) : (
                // il rimando annidato resta AL SUO POSTO nella frase, dove
                // l'autore l'ha messo: un segno di nota spostato altrove non
                // vuol dire più niente. Il bersaglio però si allarga, come
                // sulla pagina — un asterisco è alto dieci pixel.
                <button
                  key={i}
                  onClick={() => apriNotaRef.current(p.href, null, nota.base, true)}
                  style={{
                    // il bersaglio è largo (il segno è alto dieci pixel),
                    // ma i margini negativi glielo tolgono di dosso otticamente:
                    // un asterisco staccato dalla frase da mezzo centimetro
                    // non sembra più il segno di quella frase
                    padding: "8px 9px",
                    margin: "-8px -7px",
                    verticalAlign: "baseline",
                    color: C.accent,
                    fontSize: F.corpo,
                    lineHeight: 1.6,
                  }}
                >
                  {p.segno}
                </button>
              )
            )}
          </p>
          {nota.sotto?.length > 0 && (
            <button
              onClick={tornaNota}
              style={{
                marginTop: 12,
                padding: "8px 14px",
                borderRadius: R.tondo,
                border: `1px solid ${C.border}`,
                color: C.text,
                fontSize: F.piccolo,
              }}
            >
              ↩ Torna alla nota di prima
            </button>
          )}
          <p style={{ margin: "12px 0 0", fontSize: F.minuscolo, color: C.muted }}>
            Chiudi e sei esattamente dove eri: la pagina non si è mossa.
          </p>
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
            // L'ULTIMO MESSO STA IN CIMA (chiesto dal lettore). L'elenco
            // seguiva l'ordine di inserimento, quindi il segnalibro appena
            // riposto finiva in fondo, sotto tutti quelli di mesi fa —
            // e quello che si va a riprendere quasi sempre è l'ultimo.
            // Si ordina solo per mostrare: nello storage l'ordine di
            // nascita resta, ed è quello su cui si fondono i dispositivi.
            [...marks]
              .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
              .map((m) => {
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
