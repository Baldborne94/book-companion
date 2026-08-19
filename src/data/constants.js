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
export const F = {
  minuscolo: 12, // conteggi e nuvolette sulle copertine
  piccolo: 13, // etichette dei campi, righe di servizio
  nota: 14, // testo secondario: date, autori, spiegazioni sotto
  corpo: 15, // il testo dell'interfaccia, tasti e campi
  rilievo: 17, // le voci che devono staccarsi dal resto
  titoletto: 19, // intestazioni di gruppo
  titolo: 22, // titoli di pannello
  grande: 27, // i titoli grossi delle schermate vuote
};

// Stessa storia per gli angoli: quattro raggi piu' il tondo.
export const R = {
  minimo: 3, // barrette di avanzamento e segni sottili
  piccolo: 10, // tasti e campi
  medio: 14, // schede e riquadri
  grande: 18, // i pannelli che si aprono sopra tutto
  tondo: 999, // pastiglie
};

export const SECTIONS = [
  { id: "home", label: "Ingresso" },
  { id: "library", label: "Libreria" },
  { id: "music", label: "Musica" },
];
