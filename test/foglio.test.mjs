// LA GEOMETRIA DELLA SFOGLIATA, LETTA DAL FOGLIO DI STILE.
//
// Quattro giri di svolta sono passati da questo file — rotazione rigida,
// piega alla flipbook, e ora la sfogliata del Kindle, chiesta dal lettore
// col suo video — e la lezione che li attraversa tutti è una: i difetti
// erano SEGNI e ASSI, invisibili nel diff e visibili solo filmando. Un
// filmato non si mette in `npm test`; l'aritmetica sì.
//
// Le regole della sfogliata:
//  - l'asse è QUASI verticale ma inclinato (la componente x fa la piega
//    diagonale del Kindle), e ha il segno del suo verso;
//  - i gradi sono POSITIVI col cardine a sinistra: il bordo libero SI
//    ALLONTANA e il foglio rimpicciolisce mentre volta, come sul Kindle.
//    Il quadro decide il segno: una pagina a tutto schermo che viene
//    AVANTI si ingrandisce fino a riempire lo schermo di testo obliquo
//    («la svolta è stramba») — sbagliarlo si vede solo in un filmato;
//  - la corsa passa la verticale e arriva oltre (il rovescio specchiato,
//    che è il carattere del Kindle), e la dissolvenza comincia SOLO oltre
//    la verticale: fino a lì un foglio di carta non è trasparente;
//  - si anima SOLO `transform` e `opacity` — `left`/`width`/`clip-path`/
//    `filter` nei fotogrammi tornano sul filo principale, e sul tablet
//    l'animazione usciva a 4-5 fotogrammi invece di 18 (riprodotto al
//    banco con la CPU strozzata 8×). L'ombra sta ferma nella regola.
import { readFileSync } from "fs";

const CSS = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

// il blocco fra graffe che segue la prima riga contenente `capo`
function blocco(capo) {
  const i = CSS.indexOf(capo);
  if (i < 0) return "";
  const a = CSS.indexOf("{", i);
  if (a < 0) return "";
  let liv = 0;
  for (let j = a; j < CSS.length; j += 1) {
    if (CSS[j] === "{") liv += 1;
    else if (CSS[j] === "}") {
      liv -= 1;
      if (liv === 0) return CSS.slice(a + 1, j);
    }
  }
  return "";
}

const numeri = (testo, re) => [...testo.matchAll(re)].map((m) => Number(m[1]));

// i fotogrammi di un @keyframes come [{stop, css}]
function fotogrammi(nome) {
  const b = blocco(`@keyframes ${nome}`);
  return [...b.matchAll(/([\d.]+)%\s*\{([^}]*)\}/g)].map((m) => ({
    stop: Number(m[1]),
    css: m[2],
  }));
}
const prop = (css, nome) => {
  const m = css.match(new RegExp(`${nome}\\s*:\\s*([^;]+);`));
  return m ? m[1].trim() : null;
};
// rotate3d(x, y, z, Adeg) → {x, y, z, a}
const giro = (css) => {
  const m = (prop(css, "transform") || "").match(
    /rotate3d\((-?[\d.]+),\s*(-?[\d.]+),\s*(-?[\d.]+),\s*(-?[\d.]+)deg\)/
  );
  return m ? { x: Number(m[1]), y: Number(m[2]), z: Number(m[3]), a: Number(m[4]) } : null;
};

export default async function (t) {
  for (const [nome, versoX, versoA, cardine] of [
    ["bc-sfoglia-next", 1, 1, "0% 50%"],
    ["bc-sfoglia-prev", -1, -1, "100% 50%"],
  ]) {
    const fs = fotogrammi(nome);
    t.c(`«${nome}» ha i suoi fotogrammi`, fs.length >= 5, `${fs.length}`);
    const giri = fs.map((f) => giro(f.css));
    t.c(`e ogni fotogramma è un rotate3d`, giri.every(Boolean));
    if (!giri.every(Boolean)) continue;

    // ---- L'ASSE ----------------------------------------------------------
    t.c(
      `l'asse è quasi verticale ma INCLINATO (la diagonale del Kindle)`,
      giri.every((g) => g.y === 1 && Math.abs(g.x) >= 0.05 && Math.abs(g.x) <= 0.35 && g.z === 0),
      JSON.stringify(giri[1])
    );
    t.c(
      `e l'inclinazione ha il verso del cardine`,
      giri.every((g) => Math.sign(g.x) === versoX)
    );
    t.c(
      `l'asse non cambia durante la corsa (l'oscillazione è un altro gesto)`,
      giri.every((g) => g.x === giri[0].x)
    );

    // ---- I GRADI ---------------------------------------------------------
    const angoli = giri.map((g) => g.a * versoA);
    t.c(
      `i gradi hanno il segno del cardine (${versoA < 0 ? "negativi" : "positivi"}, il foglio recede)`,
      giri.slice(1).every((g) => Math.sign(g.a) === versoA),
      giri.map((g) => g.a).join(", ")
    );
    t.c(`e crescono sempre, senza tornare indietro`,
      angoli.every((a, i) => i === 0 || a > angoli[i - 1]));
    t.c(`la corsa passa la verticale (il rovescio si vede)`,
      Math.max(...angoli) >= 140, `arriva a ${Math.max(...angoli)}`);

    // ---- LA DISSOLVENZA SOLO OLTRE LA VERTICALE --------------------------
    for (let i = 0; i < fs.length; i += 1) {
      const o = Number(prop(fs[i].css, "opacity"));
      if (angoli[i] <= 92) {
        t.c(`a ${angoli[i]}° il foglio è carta piena`, o === 1, `opacity ${o}`);
      }
    }
    t.eq(`e il fantasma specchiato si spegne in fondo`,
      Number(prop(fs[fs.length - 1].css, "opacity")), 0);

    // ---- SOLO COMPOSITORE ------------------------------------------------
    t.c(
      `nei fotogrammi solo transform e opacity`,
      fs.every((f) => !prop(f.css, "left") && !prop(f.css, "width")
        && !prop(f.css, "filter") && !prop(f.css, "clip-path"))
    );

    // ---- LA REGOLA CHE LO MONTA ------------------------------------------
    const verso = nome.endsWith("next") ? "next" : "prev";
    const regola = blocco(`.bc-volta-${verso}::view-transition-old(bc-pagina) {`);
    t.c(`a sfogliarsi è la pagina VECCHIA`, new RegExp(`animation:\\s*${nome}`).test(regola), regola.trim());
    t.c(`col cardine sul ${verso === "next" ? "dorso sinistro" : "bordo destro"}`,
      regola.includes(`transform-origin: ${cardine}`));
    // l'ombra cade verso il DORSO (parte opposta al bordo che recede) ed
    // e' un BOX-SHADOW: il drop-shadow e' un filtro e si ricalcola a ogni
    // fotogramma — misurato su Gecko, 22 fotogrammi su 179 col filtro
    // contro 32 con la scatola. Un filter su queste regole riporta a casa
    // lo scatto.
    t.c(`e l'ombra e' una scatola, dalla parte giusta`,
      /box-shadow/.test(regola)
        && numeri(regola, /box-shadow:\s*(-?[\d.]+)px/g).every((px) => Math.sign(px) === -versoA));
    t.c(`nessun filter sulla regola del foglio`, !/filter\s*:/.test(regola), regola.trim());
  }

  // ---- IL RESTO DELL'IMPALCATURA -----------------------------------------
  t.c(
    "la pagina nuova non si muove mai",
    !/::view-transition-new\(bc-pagina\)[^{]*\{[^}]*animation:\s*bc-/.test(CSS)
  );
  const base = blocco("::view-transition-old(bc-pagina),");
  t.c("la faccia posteriore si vede (è il rovescio del Kindle)",
    /backface-visibility:\s*visible/.test(base));
  // la prospettiva sta sulla COPPIA: sul gruppo non arriva al foglio e il
  // giro si disegna piatto — tre bocciature prima di scoprirlo
  const coppia = blocco("::view-transition-image-pair(bc-pagina) {");
  t.c("la prospettiva sta sulla coppia", /perspective:\s*var\(--bc-prof/.test(coppia), coppia.trim());
  t.c("con un valore di scorta", /var\(--bc-prof,\s*\d+px\)/.test(coppia));
  t.c("e il punto di fuga in mezzo", /perspective-origin:\s*50%\s+50%/.test(coppia));
  // ---- I VELI RESTANO ACCESI MENTRE SI SFOGLIA ---------------------------
  // il sipario delle View Transitions sta sopra i filtri del reader:
  // senza fotografia propria, ogni voltata era un lampo a piena luce per
  // chi legge di notte con la luminosita' abbassata
  for (const velo of ["bc-caldo", "bc-lume"]) {
    const gr = blocco(`::view-transition-group(${velo})`);
    t.c(`il velo «${velo}» sale sopra la pagina`,
      Number((gr.match(/z-index:\s*(\d+)/) || [])[1]) > 2, gr.trim());
    const nuovo = blocco(`::view-transition-new(${velo})`);
    t.c(`e sta fermo, senza dissolvenze del browser`, /animation:\s*none/.test(nuovo));
  }
  t.c("il velo caldo rimette la sua fusione (multiply non viaggia nella fotografia)",
    /::view-transition-new\(bc-caldo\)\s*\{[^}]*mix-blend-mode:\s*multiply/.test(CSS));

  // «meno animazioni» ferma la sfogliata
  const ridotto = CSS.slice(CSS.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
  t.c("col movimento ridotto non si sfoglia", /animation:\s*none/.test(ridotto));
}
