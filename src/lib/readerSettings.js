const KEY = "bc_reader";

export const READER_THEMES = {
  night: { label: "Notte", bg: "#141120", fg: "#d9d2c2", link: "#b9a1e8" },
  sepia: { label: "Pergamena", bg: "#f2e4c8", fg: "#453521", link: "#8a5a18" },
  paper: { label: "Carta", bg: "#f7f3ea", fg: "#28251f", link: "#7a4f9e" },
  oled: { label: "Nero", bg: "#000000", fg: "#c9c2b2", link: "#a98fdd" },
};

export const READER_FONTS = [
  { id: "original", label: "Originale del libro", css: null },
  { id: "garamond", label: "EB Garamond", css: '"EB Garamond", Georgia, "Noto Serif", serif' },
  { id: "serif", label: "Serif classico", css: 'Georgia, "Noto Serif", "Times New Roman", serif' },
  { id: "sans", label: "Moderno", css: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
];

export const HL_COLORS = [
  { id: "gold", label: "Oro", value: "#d9a94e" },
  { id: "arcane", label: "Arcano", value: "#9b7fd4" },
  { id: "green", label: "Bosco", value: "#5fae7e" },
  { id: "red", label: "Rubino", value: "#c26565" },
];

export function deviceDefaults(shortSide) {
  return {
    theme: "night",
    font: "original",
    fontSize: 100,
    lineHeight: 1.5,
    margin: 24,
    flow: "paginated",
    spread: shortSide < 520 ? "none" : "auto",
    warmth: 0,
    brightness: 1,
  };
}

export function loadReaderSettings(shortSide) {
  const defaults = deviceDefaults(shortSide);
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "{}");
    return { ...defaults, ...saved };
  } catch {
    return defaults;
  }
}

export function saveReaderSettings(settings) {
  localStorage.setItem(KEY, JSON.stringify(settings));
}
