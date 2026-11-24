// GLI INCHIOSTRI SECONDARI SI LEGGONO (i ritocchi al tema, novembre 2026).
//
// Due difetti trovati misurando, non a occhio. Il testo smorzato della notte
// stava a 5,95 sul fondo: passa la soglia dei testi grossi, ma gli autori e
// i conti sotto le copertine sono scritti nel corpo piu' piccolo della scala,
// e la sera non si leggevano. E quindici frasi intere (le spiegazioni sotto
// i comandi del reader, la spesa dell'Oracolo, il messaggio di un guasto)
// erano scritte in `C.dim`, che e' il colore dei binari vuoti e dei tasti
// spenti: 1,6 sul fondo, cioe' invisibili.
import { readFileSync, readdirSync } from "fs";
import { THEMES } from "../src/data/constants.js";

const lum = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrasto = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);

export default async (t) => {
  for (const [id, tema] of Object.entries(THEMES)) {
    const c = tema.colors;
    t.c(`«${id}»: il testo smorzato si legge sul fondo anche scritto piccolo`, contrasto(c.muted, c.bg) >= 7, contrasto(c.muted, c.bg).toFixed(2));
    t.c(`«${id}»: e resta secondario`, contrasto(c.text, c.bg) - contrasto(c.muted, c.bg) >= 4, contrasto(c.muted, c.bg).toFixed(2));
  }

  // un comando spento puo' stare in `C.dim` (`spento ? C.dim : …`); una frase no
  const cartella = new URL("../src/components/", import.meta.url);
  const colpevoli = [];
  for (const f of readdirSync(cartella).filter((n) => n.endsWith(".jsx"))) {
    readFileSync(new URL(f, cartella), "utf8").split("\n").forEach((riga, i) => {
      if (/color:\s*C\.dim\b/.test(riga)) colpevoli.push(`${f}:${i + 1}`);
    });
  }
  t.eq("nessuna frase è scritta col colore dei tasti spenti", colpevoli.join(" "), "");
};
