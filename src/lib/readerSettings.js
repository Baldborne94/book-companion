const KEY = "bc_reader";

// cover = la rilegatura che circonda le pagine
export const READER_THEMES = {
  night: { label: "Notte", bg: "#141120", fg: "#d9d2c2", link: "#b9a1e8", cover: "#2a2340" },
  sepia: { label: "Pergamena", bg: "#f2e4c8", fg: "#453521", link: "#8a5a18", cover: "#6d5233" },
  paper: { label: "Carta", bg: "#f7f3ea", fg: "#28251f", link: "#7a4f9e", cover: "#4b4640" },
  grove: { label: "Bosco", bg: "#ece7d1", fg: "#2f3524", link: "#4f7a3a", cover: "#41522f" },
  oled: { label: "Nero", bg: "#000000", fg: "#c9c2b2", link: "#a98fdd", cover: "#1b1b1b" },
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
    terms: true,
    // la colonna come in stampa: giustificata E sillabata, mai una sola
    justify: true,
    // Come si segna un paragrafo nuovo: col RIENTRO di prima riga (la
    // stampa) o con uno STACCO verticale (lo schermo). Di partenza vale
    // quel che dice il libro, che quasi sempre e' il rientro — cambiarlo
    // di nostra iniziativa vorrebbe dire reimpaginare ogni romanzo per una
    // preferenza che non ci ha chiesto nessuno.
    paragrafi: "rientro",
    // solo per i PDF: toglie i margini bianchi della carta
    ritaglia: true,
    // COME VOLTA LA PAGINA, e sono TRE, non due (chiesto dal lettore:
    // «l'animazione e' un po' scattosa, non si puo' rendere piu' fluida e
    // meno pesante?»). La spazzata e' bella e costa: misurata col
    // processore strozzato sei volte, una voltata blocca il filo
    // principale per ~510ms contro i ~140 di una voltata nuda, perche' le
    // View Transitions fotografano la pagina DUE volte — prima e dopo. La
    // dissolvenza non fotografa niente: il velo copre, la pagina cambia
    // sotto, il velo scende. Chi ha uno schermo che fatica sceglie quella
    // invece di restare senza niente.
    svolta: "spazzata",
    appTheme: "night",
  };
}

// LA SVOLTA ERA UN SÌ/NO E ADESSO SONO TRE MODI. Chi aveva già scelto se
// la ritrova scritta come un booleano — nelle preferenze qui e nel cloud,
// dove viaggia con tutto il resto — e un `true` confrontato con
// «spazzata» non e' «spazzata»: senza questa riga la levetta si
// ritroverebbe su nessuna delle tre, e la pagina volterebbe nuda.
export const modoSvolta = (v) => {
  if (v === true) return "spazzata";
  if (v === false) return "nessuna";
  return v === "dissolvenza" || v === "nessuna" ? v : "spazzata";
};

export function loadReaderSettings(shortSide) {
  const defaults = deviceDefaults(shortSide);
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "{}");
    const fuse = { ...defaults, ...saved };
    return { ...fuse, svolta: modoSvolta(fuse.svolta) };
  } catch {
    return defaults;
  }
}

export function saveReaderSettings(settings) {
  localStorage.setItem(KEY, JSON.stringify(settings));
  localStorage.setItem("bc_prefs_upd", String(Date.now()));
}
