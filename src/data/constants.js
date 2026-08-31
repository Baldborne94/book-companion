export const THEMES = {
  night: {
    id: "night",
    label: "Biblioteca Magica",
    hint: "Notte profonda, candele e polvere di stelle",
    tagline: "La tua biblioteca, di notte",
    colors: {
      bg: "#0f0d1a",
      surface: "#151226",
      card: "#1c1730",
      border: "#332a4f",
      accent: "#d9a94e",
      accentDeep: "#b8893a",
      onAccent: "#241c0a",
      arcane: "#9b7fd4",
      text: "#e2dac9",
      muted: "#948aad",
      dim: "#3a3354",
      green: "#5fae7e",
      red: "#b25050",
    },
    gradient:
      "radial-gradient(ellipse 120% 80% at 50% 0%, #1a1530 0%, #0f0d1a 55%, #0b0914 100%)",
    motes: { char: "✦", anim: "bc-rise", size: [7, 13], from: "bottom" },
    decor: null,
  },
  grove: {
    id: "grove",
    label: "Rifugio Silvano",
    hint: "Un'antica biblioteca tra le fronde, in pace",
    tagline: "La tua biblioteca, tra le fronde",
    colors: {
      bg: "#12170e",
      surface: "#1a2114",
      card: "#212a19",
      border: "#3c4b31",
      accent: "#dcb45f",
      accentDeep: "#bb9247",
      onAccent: "#251d0c",
      arcane: "#84b16b",
      text: "#ece5cf",
      muted: "#a5ae93",
      dim: "#3e4b34",
      green: "#8bc48d",
      red: "#c2705a",
    },
    gradient:
      "radial-gradient(ellipse 85% 45% at 50% -14%, #3b4726 0%, #26301a 38%, #171d10 68%, #0d1109 100%)",
    motes: { char: "🍃", anim: "bc-drift", size: [9, 16], from: "top" },
    decor: "foliage",
  },
  citadel: {
    id: "citadel",
    label: "Archivio della Cittadella",
    hint: "Sale di pietra, pergamene e oro di candela",
    tagline: "La tua biblioteca, tra le pergamene",
    colors: {
      bg: "#141210",
      surface: "#1e1a15",
      card: "#26201a",
      border: "#4a3d2c",
      accent: "#e3bd76",
      accentDeep: "#c19959",
      onAccent: "#261f0f",
      arcane: "#b6bcc6",
      text: "#f0e7d3",
      muted: "#a99a80",
      dim: "#443a2b",
      green: "#7fae72",
      red: "#c2684e",
    },
    gradient:
      "radial-gradient(ellipse 95% 55% at 50% -8%, #3a2e20 0%, #251e15 42%, #17130e 74%, #100d09 100%)",
    motes: { char: "·", anim: "bc-motes", size: [13, 24], from: "bottom" },
    decor: "scrolls",
  },
};

export const DEFAULT_THEME = "night";

// Palette viva: i componenti leggono C al render, quindi mutarla e
// ridisegnare l'albero basta per cambiare tema senza un context.
export const C = { ...THEMES[DEFAULT_THEME].colors };

// Il tema vivo per intero — serve a chi ha bisogno di qualcosa che un
// colore non e', tipo lo SFONDO A GRADIENTE. Prima ogni pannello a tutto
// schermo se lo ridisegnava a mano coi viola della notte, e sugli altri
// due temi ci si ritrovava un alone viola in mezzo al verde.
export const TEMA = { ...THEMES[DEFAULT_THEME] };

// Il colore di fondo si ricorda anche fuori da React: `index.html` lo
// rilegge PRIMA che il bundle parta, o a ogni avvio a freddo comparirebbe
// un lampo del tema di default sotto quello scelto.
const BG_KEY = "bc_bg";

export function applyAppTheme(id) {
  const t = THEMES[id] || THEMES[DEFAULT_THEME];
  Object.assign(C, t.colors);
  Object.assign(TEMA, t);
  if (typeof document !== "undefined") {
    const root = document.documentElement;
    root.style.setProperty("--bc-bg", t.colors.bg);
    // l'accento serve al CSS per l'anello del fuoco, che inline non si puo'
    // scrivere: `:focus-visible` non esiste come stile in linea
    root.style.setProperty("--bc-accent", t.colors.accent);
    document.body.style.color = t.colors.text;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", t.colors.bg);
    try {
      localStorage.setItem(BG_KEY, t.colors.bg);
    } catch {
      /* niente localStorage: al prossimo avvio il lampo torna, e basta */
    }
  }
  return t;
}

export const FONT_TITLE = '"Cormorant Garamond", Georgia, serif';
export const FONT_BODY = '"EB Garamond", Georgia, serif';

// LA SCALA. Prima c'erano ventisette corpi diversi — 12,5 · 13 · 13,5 · 14
// · 14,5 · 15, sei gradini in due punti e mezzo — e tredici raggi. Nessuno
// di quei mezzi punti comunicava una gerarchia: comunicavano che ogni
// componente aveva scelto per conto suo, e la differenza si vede quando ne
// metti due schermate accanto.
//
// Otto gradini, ognuno con un mestiere. Il valore in se' conta meno del
// fatto che sia UNO SOLO: adesso ritoccare tutta l'app e' cambiare un
// numero qui, non rincorrerne duecento nei file.
// I gradini a grandezza naturale. Restano il metro: la levetta della
// dimensione li moltiplica, non li riscrive, cosi' la gerarchia fra un
// gradino e l'altro e' la stessa a ogni misura.
const SCALA_BASE = {
  minuscolo: 12, // conteggi e nuvolette sulle copertine
  piccolo: 13, // etichette dei campi, righe di servizio
  nota: 14, // testo secondario: date, autori, spiegazioni sotto
  corpo: 15, // il testo dell'interfaccia, tasti e campi
  rilievo: 17, // le voci che devono staccarsi dal resto
  titoletto: 19, // intestazioni di gruppo
  titolo: 22, // titoli di pannello
  grande: 27, // i titoli grossi delle schermate vuote
};

// Scala viva, come `C`: i componenti la leggono al render, quindi mutarla
// e ridisegnare basta a cambiare misura senza un context.
export const F = { ...SCALA_BASE };

// Stessa storia per gli angoli: quattro raggi piu' il tondo.
const RAGGI_BASE = {
  minimo: 3, // barrette di avanzamento e segni sottili
  piccolo: 10, // tasti e campi
  medio: 14, // schede e riquadri
  grande: 18, // i pannelli che si aprono sopra tutto
  tondo: 999, // pastiglie
};

export const R = { ...RAGGI_BASE };

// ---------------------------------------------------------------------------
// QUANTO E' GRANDE L'INTERFACCIA.
//
// Tutti i corpi sono in pixel fissi e non hanno mai guardato lo schermo. Su
// un tablet dove un pixel CSS e' un pixel VERO — densita' 1, che sui tablet
// da 1280×800 e' la norma — quei 15px sono fisicamente la meta' di quanto
// sarebbero su uno schermo a densita' doppia, e l'app si legge piccola
// (segnalato dal lettore: «come mai e' piu' piccolo rispetto a prima?»).
// Il libro una levetta ce l'aveva gia'; tutto il resto dell'app no.
//
// SI MOLTIPLICA LA SCALA, NON SI ZOOMA LA PAGINA. Un `zoom` sul guscio
// prenderebbe anche le copertine e le spaziature — sarebbe piu' completo —
// ma andrebbe a toccare `100dvh`, i pannelli in `position: fixed` e
// soprattutto il reader, dove epub.js misura il riquadro in pixel e ci
// costruisce le colonne, l'avanzo di riga e il ritaglio. Quella e' proprio
// la macchina che non si puo' provare da qui, perche' il motore del lettore
// e' Gecko e qui c'e' solo Chromium. Numeri diversi invece si comportano
// allo stesso modo su ogni motore: e' la strada che si puo' garantire.
// Prezzo dichiarato: cresce la scrittura, non le copertine.
export const SCALE_UI = [
  { id: "normale", label: "Normale", fattore: 1 },
  { id: "grande", label: "Grande", fattore: 1.15 },
  { id: "piuGrande", label: "Più grande", fattore: 1.3 },
  { id: "enorme", label: "Molto grande", fattore: 1.5 },
];

export const SCALA_DEFAULT = "normale";

// STA SUL DISPOSITIVO, e non nelle preferenze che viaggiano nel cloud —
// come il volume della musica e per la stessa ragione. Questa levetta non
// dice come vedi tu: dice quanto e' fitto QUESTO schermo. Lo stesso lettore
// sul telefono a densita' tripla e sul tablet a densita' uno vuole due
// valori diversi, e sincronizzarla porterebbe su un dispositivo il rimedio
// del difetto di un altro.
const SCALA_KEY = "bc_ui_scala";

export const scalaDi = (id) => SCALE_UI.find((s) => s.id === id) || SCALE_UI[0];

// Il corpo del testo a un fattore qualunque, che non e' quello in vigore:
// serve ai tasti della levetta, dove ognuno si scrive nella misura che
// offre. Sta qui e non nel componente perche' il valore di partenza deve
// restare in UN posto solo — scriverci 15 a mano la' sarebbe l'inizio dello
// sfarinamento che la scala e' venuta a fermare.
export const corpoAlFattore = (fattore) => Math.round(SCALA_BASE.corpo * fattore);

export function leggiScalaUI() {
  try {
    const v = localStorage.getItem(SCALA_KEY);
    return SCALE_UI.some((s) => s.id === v) ? v : SCALA_DEFAULT;
  } catch {
    return SCALA_DEFAULT;
  }
}

// Il `tondo` NON si scala: 999 non e' una misura, e' il modo di dire
// «pastiglia» al browser. Moltiplicarlo darebbe un numero piu' grosso e
// nessuna differenza, cioe' un valore che sembra vivo e non lo e'.
export function applicaScalaUI(id) {
  const s = scalaDi(id);
  for (const k of Object.keys(SCALA_BASE)) F[k] = Math.round(SCALA_BASE[k] * s.fattore);
  for (const k of Object.keys(RAGGI_BASE)) {
    R[k] = k === "tondo" ? RAGGI_BASE[k] : Math.round(RAGGI_BASE[k] * s.fattore);
  }
  try {
    localStorage.setItem(SCALA_KEY, s.id);
  } catch {
    /* storage negato: la misura vale per questa sessione, e basta */
  }
  return s;
}

export const SECTIONS = [
  { id: "home", label: "Ingresso" },
  { id: "library", label: "Libreria" },
  { id: "music", label: "Musica" },
];
