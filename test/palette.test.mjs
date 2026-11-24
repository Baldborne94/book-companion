// LA PALETTE E' UN CONTRATTO, e finora nessuno lo faceva rispettare.
//
// Il tasto principale aveva il fondo del gradiente e il colore dell'inchiostro
// scritti a mano — `#b8893a` e `#241c0a`, l'oro della NOTTE — in dodici punti.
// Sugli altri due temi l'accento cambiava e quei due no: il tasto più
// importante dell'app sfumava verso un colore di un altro tema.
//
// Ora sono voci della palette. Il che apre la trappola opposta: un tema
// nuovo che se ne dimentica una scriverebbe `undefined` dentro uno stile, e
// il testo del tasto sparirebbe senza che nessun errore lo dica.
import { THEMES, DEFAULT_THEME, C } from "../src/data/constants.js";

// Contrasto WCAG: due colori e quanto si staccano. Sta qui e non in `src`
// perche' e' roba da prova, non da app.
const lum = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrasto = (a, b) => {
  const x = lum(a);
  const y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

export default async function (t) {
  const temi = Object.entries(THEMES);
  t.c("i temi ci sono", temi.length >= 2, `${temi.length}`);

  // ---- NESSUN TEMA PUO' DIMENTICARSI UNA VOCE ---------------------------
  // una voce mancante non esplode: finisce `undefined` in uno stile in
  // linea, e il colore semplicemente non c'e' — il modo peggiore di
  // sbagliare, perche' non lo dice nessuno
  const attese = Object.keys(THEMES[DEFAULT_THEME].colors);
  t.c("l'accento profondo è nel contratto", attese.includes("accentDeep"));
  t.c("e l'inchiostro sopra l'accento anche", attese.includes("onAccent"));

  for (const [id, tema] of temi) {
    for (const voce of attese) {
      const v = tema.colors[voce];
      t.c(`«${id}» dichiara ${voce}`, typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v), String(v));
    }
    t.c(`«${id}» non ha voci di troppo`, Object.keys(tema.colors).length === attese.length);
    t.c(`«${id}» ha il suo sfondo`, typeof tema.gradient === "string" && tema.gradient.length > 20);
    t.c(`«${id}» ha un nome da mostrare`, !!tema.label);
  }

  for (const [id, tema] of temi) {
    const c = tema.colors;
    // un tema monco l'ha già detto il giro di sopra: qui si tira dritto,
    // o esploderebbe e i temi dopo non verrebbero guardati affatto
    if (attese.some((v) => typeof c[v] !== "string")) continue;
    // ---- il gradiente del tasto deve SCENDERE --------------------------
    // accento sopra, accento profondo sotto: se il fondo fosse più chiaro
    // il tasto sembrerebbe illuminato da sotto, e stonerebbe con tutto il
    // resto della luce dell'app
    t.c(`«${id}»: l'accento profondo è più scuro dell'accento`, lum(c.accentDeep) < lum(c.accent),
      `${c.accentDeep} vs ${c.accent}`);
    // ma non troppo: un salto enorme non è più un gradiente, è una fascia
    t.c(`«${id}»: e non è un salto`, lum(c.accent) / Math.max(lum(c.accentDeep), 0.0001) < 3);

    // ---- e sopra ci si deve poter leggere ------------------------------
    t.c(`«${id}»: l'inchiostro sul tasto si legge`, contrasto(c.onAccent, c.accent) >= 4.5,
      contrasto(c.onAccent, c.accent).toFixed(2));
    // il testo normale, che è quello che leggi tutto il giorno
    t.c(`«${id}»: il testo sul fondo si legge`, contrasto(c.text, c.bg) >= 7,
      contrasto(c.text, c.bg).toFixed(2));
    // il testo smorzato è secondario ma non decorativo: date, conteggi,
    // righe d'avviso. Sotto 4.5 diventa un grigio che non si legge.
    t.c(`«${id}»: il testo smorzato si legge sulla scheda`, contrasto(c.muted, c.card) >= 4.5,
      contrasto(c.muted, c.card).toFixed(2));
    t.c(`«${id}»: l'accento si stacca dal fondo`, contrasto(c.accent, c.bg) >= 4.5,
      contrasto(c.accent, c.bg).toFixed(2));
  }

  // ---- la palette viva parte da quella di partenza ----------------------
  t.eq("C è il tema di default", C.accent, THEMES[DEFAULT_THEME].colors.accent);
  t.c("e ha anche le voci nuove", !!C.accentDeep && !!C.onAccent);
}
