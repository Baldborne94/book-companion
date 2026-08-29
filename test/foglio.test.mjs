// LA GEOMETRIA DELLA SPAZZATA, LETTA DAL FOGLIO DI STILE.
//
// Sei geometrie sono passate da questo file, e la lezione che le
// attraversa tutte è una: i difetti erano SEGNI, ASSI e CORSIE DEL
// COMPOSITORE — invisibili nel diff, visibili solo filmando. Un filmato
// non si mette in `npm test`; l'aritmetica sì.
//
// Le regole della spazzata:
//  - è PIATTA APPOSTA: `translateX` + `rotate` + `scale`, mai `rotate3d`
//    né `perspective` — il 3D con prospettiva butta Gecko fuori dal
//    compositore (misurato: 30 fotogrammi su 179 contro 42 in 2D) e sul
//    tablet la voltata ticchettava un fotogramma sì e uno no;
//  - il foglio SCIVOLA VERSO IL DORSO inclinandosi (il rotate è la
//    diagonale del Kindle) e RIMPICCIOLISCE (il recedere);
//  - la dissolvenza solo in uscita: carta piena finché il foglio è in
//    scena, si spegne mentre esce;
//  - l'ombra è un `box-shadow` FERMO nella regola: un `filter` si
//    ricalcola a ogni fotogramma (misurato: 22 contro 32 su 179);
//  - NESSUN velo nel sipario: i veli vivono dentro l'elemento
//    fotografato (Reader.jsx), perche' fotografati a parte tradivano su
//    tutt'e due i motori — il lampo di piena luce a ogni voltata.
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
// translateX(T%) rotate(Rdeg) scale(S) → {t, r, sc}
const mossa = (css) => {
  const m = (prop(css, "transform") || "").match(
    /translateX\((-?[\d.]+)%\)\s+rotate\((-?[\d.]+)deg\)\s+scale\(([\d.]+)\)/
  );
  return m ? { t: Number(m[1]), r: Number(m[2]), sc: Number(m[3]) } : null;
};

export default async function (t) {
  for (const [nome, verso, cardine] of [
    ["bc-sfoglia-next", -1, "0% 50%"],
    ["bc-sfoglia-prev", 1, "100% 50%"],
  ]) {
    const fs = fotogrammi(nome);
    t.c(`«${nome}» ha i suoi fotogrammi`, fs.length >= 4, `${fs.length}`);
    const giri = fs.map((f) => mossa(f.css));
    t.c(`e ogni fotogramma è translateX + rotate + scale`, giri.every(Boolean));
    if (!giri.every(Boolean)) continue;

    // ---- IL VERSO ---------------------------------------------------------
    const tx = giri.map((g) => g.t * verso);
    t.c(`il foglio scivola verso il ${verso < 0 ? "dorso (sinistra)" : "bordo (destra)"}`,
      giri.slice(1).every((g) => Math.sign(g.t) === verso), giri.map((g) => g.t).join(", "));
    t.c(`e non torna mai indietro`, tx.every((v, i) => i === 0 || v > tx[i - 1]));
    t.c(`esce davvero di scena`, Math.max(...tx) >= 105, `arriva a ${Math.max(...tx)}`);
    // l'inclinazione: la diagonale del Kindle, dallo stesso lato dello scivolo
    t.c(`il foglio si inclina mentre scivola`,
      giri.slice(1).every((g) => Math.sign(g.r) === verso && Math.abs(g.r) <= 12),
      giri.map((g) => g.r).join(", "));
    // il recedere: rimpicciolisce, mai sotto un scorcio credibile
    const scale = giri.map((g) => g.sc);
    t.c(`e rimpicciolisce (recede)`,
      scale.every((v, i) => i === 0 || v <= scale[i - 1]) && scale[scale.length - 1] < 1 && scale[scale.length - 1] >= 0.85,
      scale.join(", "));

    // ---- CARTA PIENA FINCHE' IN SCENA ------------------------------------
    for (const f of fs.slice(0, -1)) {
      const o = Number(prop(f.css, "opacity"));
      t.c(`al ${f.stop}% il foglio è carta (opacity ≥ 0.9)`, o >= 0.9, `${o}`);
    }
    t.eq(`e si spegne solo uscendo`, Number(prop(fs[fs.length - 1].css, "opacity")), 0);

    // ---- SOLO LA CORSIA DEL COMPOSITORE ----------------------------------
    t.c(`nei fotogrammi solo transform e opacity`,
      fs.every((f) => !prop(f.css, "left") && !prop(f.css, "width")
        && !prop(f.css, "filter") && !prop(f.css, "clip-path")));
    t.c(`e niente 3D: rotate3d o perspective riportano lo scatto`,
      fs.every((f) => !/rotate3d|perspective|matrix3d/.test(f.css)));

    // ---- LA REGOLA CHE LO MONTA ------------------------------------------
    const dir = nome.endsWith("next") ? "next" : "prev";
    const regola = blocco(`.bc-volta-${dir}::view-transition-old(bc-pagina) {`);
    t.c(`a spazzarsi via è la pagina VECCHIA`, new RegExp(`animation:\\s*${nome}`).test(regola), regola.trim());
    t.c(`col cardine giusto`, regola.includes(`transform-origin: ${cardine}`));
    t.c(`e l'ombra è una scatola ferma, dalla parte giusta`,
      /box-shadow/.test(regola) && !/filter\s*:/.test(regola)
        && numeri(regola, /box-shadow:\s*(-?[\d.]+)px/g).every((px) => Math.sign(px) === verso));
  }

  // ---- L'IMPALCATURA ------------------------------------------------------
  t.c("la pagina nuova non si muove mai",
    !/::view-transition-new\(bc-pagina\)[^{]*\{[^}]*animation:\s*bc-/.test(CSS));
  t.c("nessuna prospettiva sul sipario: la spazzata è piatta apposta",
    !/::view-transition[^{]*\{[^}]*perspective/.test(CSS));

  // ---- NESSUN VELO NEL SIPARIO --------------------------------------------
  // i veli fotografati a parte hanno tradito su TUTT'E DUE i motori, in
  // fasi diverse (Gecko: fotografia nuova in ritardo; Chromium: vecchia
  // vuota e fase d'attesa nuda — 100-200ms di piena luce a voltata). I
  // veli del libro vivono DENTRO l'elemento fotografato (Reader.jsx), e
  // un nome di View Transition su un velo riapre il lampo.
  t.c("nessun velo ha un nome nel sipario",
    !/::view-transition[^{]*\((?:bc-caldo|bc-lume)\)/.test(CSS));

  // «meno animazioni» ferma la spazzata
  const ridotto = CSS.slice(CSS.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
  t.c("col movimento ridotto non si spazza", /animation:\s*none/.test(ridotto));
}
