export const THEMES = {
  night: {
    id: "night",
    label: "Biblioteca Magica",
    icon: "🕯️",
    hint: "Notte profonda, candele e polvere di stelle",
    tagline: "La tua biblioteca, di notte",
    colors: {
      bg: "#0f0d1a",
      surface: "#151226",
      card: "#1c1730",
      border: "#332a4f",
      accent: "#d9a94e",
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
    foliage: false,
  },
  grove: {
    id: "grove",
    label: "Rifugio Silvano",
    icon: "🌿",
    hint: "Un'antica biblioteca tra le fronde, in pace",
    tagline: "La tua biblioteca, tra le fronde",
    colors: {
      bg: "#12170e",
      surface: "#1a2114",
      card: "#212a19",
      border: "#3c4b31",
      accent: "#dcb45f",
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
    foliage: true,
  },
};

export const DEFAULT_THEME = "night";

// Palette viva: i componenti leggono C al render, quindi mutarla e
// ridisegnare l'albero basta per cambiare tema senza un context.
export const C = { ...THEMES[DEFAULT_THEME].colors };

export function applyAppTheme(id) {
  const t = THEMES[id] || THEMES[DEFAULT_THEME];
  Object.assign(C, t.colors);
  if (typeof document !== "undefined") {
    document.body.style.background = t.colors.bg;
    document.body.style.color = t.colors.text;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", t.colors.bg);
  }
  return t;
}

export const FONT_TITLE = '"Cormorant Garamond", Georgia, serif';
export const FONT_BODY = '"EB Garamond", Georgia, serif';

export const SECTIONS = [
  { id: "home", label: "Ingresso", icon: "🕯️" },
  { id: "library", label: "Libreria", icon: "📚" },
  { id: "music", label: "Musica", icon: "🎵" },
];
