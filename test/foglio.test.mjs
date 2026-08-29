// LA GEOMETRIA DELLA SVOLTA, LETTA DAL FOGLIO DI STILE.
//
// Tre giri di rotazione sono stati bocciati dal lettore, e nessuno dei
// difetti si vedeva leggendo il diff: erano SEGNI e METÀ — il verso della
// rotazione rispetto al cardine, quale facciata gira, da che parte cade
// l'ombra. Si vedevano solo filmando l'app. Un filmato però non si può
// mettere in `npm test`, mentre queste regole sì, perché sono aritmetica.
//
// Dalla quarta versione la facciata doppia è una PIEGA alla flipbook
// (chiesta dal lettore col video di Flipsnack), e l'aritmetica sua è UNA:
// il bordo trascinato sta a P, la piega a (P+100)/2, quindi larghezza del
// lembo e ritaglio del fronte sono LO STESSO numero, (100−P)/2. Se i
// fotogrammi dei due livelli non dicono lo stesso P, la piega si scuce e
// fra lembo e fronte si apre una fessura — ed è esattamente il difetto
// che un ritocco a occhio introdurrebbe senza che nessun diff lo dica.
import { readFileSync } from "fs";
import { cartaInVolo, VOLO } from "../src/lib/readerTheme.js";
import { READER_THEMES } from "../src/lib/readerSettings.js";

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

// i fotogrammi di un @keyframes come [{stop, dichiarazioni}]
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
const pct = (v) => (v == null ? null : Number(String(v).replace("%", "")));

export default async function (t) {
  // ---- LA PIEGA, avanti ---------------------------------------------------
  const lemboN = fotogrammi("bc-lembo-next");
  const fronteN = fotogrammi("bc-fronte-next");
  const piegaN = fotogrammi("bc-piega-next");
  t.c("il lembo avanti ha i suoi fotogrammi", lemboN.length >= 5, `${lemboN.length}`);
  t.c("e il fronte pure", fronteN.length >= 5, `${fronteN.length}`);
  t.c("e la banda della piega", piegaN.length >= 5, `${piegaN.length}`);

  // IL CONTO UNICO: larghezza del lembo = (100 − P)/2, con P = il suo left
  for (const f of lemboN) {
    const P = pct(prop(f.css, "left"));
    const w = pct(prop(f.css, "width"));
    t.c(
      `lembo avanti al ${f.stop}%: la piega sta a metà strada`,
      P != null && w != null && Math.abs(w - (100 - P) / 2) < 0.01,
      `left ${P}, width ${w}, atteso ${(100 - P) / 2}`
    );
  }
  // e il fronte si ritaglia della STESSA misura, fotogramma per fotogramma
  t.eq("lembo e fronte hanno gli stessi fermi", lemboN.length, fronteN.length);
  for (let i = 0; i < Math.min(lemboN.length, fronteN.length); i += 1) {
    const w = pct(prop(lemboN[i].css, "width"));
    const clip = prop(fronteN[i].css, "clip-path") || "";
    const m = clip.match(/inset\(0\s+([\d.]+)%\s+0\s+50%\)/);
    t.c(
      `fronte avanti al ${fronteN[i].stop}%: ritaglia quanto il lembo copre`,
      m && Math.abs(Number(m[1]) - w) < 0.01,
      `clip «${clip}», lembo ${w}`
    );
  }
  // la corsa è intera: si parte dal bordo e si atterra sul dorso
  t.eq("il lembo parte dal bordo libero", pct(prop(lemboN[0].css, "left")), 100);
  t.eq("e atterra sulla facciata di sinistra", pct(prop(lemboN[lemboN.length - 1].css, "left")), 0);
  t.eq("largo quanto la facciata", pct(prop(lemboN[lemboN.length - 1].css, "width")), 50);

  // UN FOGLIO DI CARTA NON È TRASPARENTE: il velo del lembo resta pieno
  // per tutta la corsa e si spegne SOLO all'atterraggio, quando sotto c'è
  // già esattamente il testo su cui sta posando
  for (const f of lemboN.slice(0, -1)) {
    const o = Number(prop(f.css, "opacity"));
    t.c(`il lembo resta carta al ${f.stop}%`, o >= 0.9, `opacity ${o}`);
  }
  t.eq("e si spegne solo atterrato", Number(prop(lemboN[lemboN.length - 1].css, "opacity")), 0);
  // l'ombra c'è, e cade verso il dorso (a sinistra: offset negativo)
  const ombreN = lemboN.map((f) => prop(f.css, "filter") || "");
  t.c("il lembo fa ombra", ombreN.every((o) => o.includes("drop-shadow")));
  t.c(
    "e l'ombra cade verso il dorso",
    lemboN.slice(0, -1).every((f) => numeri(f.css, /drop-shadow\((-?[\d.]+)px/g).every((x) => x < 0)),
    ombreN.join(" | ")
  );

  // ---- LA PIEGA, indietro: lo specchio ------------------------------------
  const lemboP = fotogrammi("bc-lembo-prev");
  const fronteP = fotogrammi("bc-fronte-prev");
  t.c("il lembo indietro ha i suoi fotogrammi", lemboP.length >= 5);
  for (const f of lemboP) {
    const P = pct(prop(f.css, "right"));
    const w = pct(prop(f.css, "width"));
    t.c(
      `lembo indietro al ${f.stop}%: stessa piega, specchiata`,
      P != null && w != null && Math.abs(w - (100 - P) / 2) < 0.01,
      `right ${P}, width ${w}`
    );
  }
  for (let i = 0; i < Math.min(lemboP.length, fronteP.length); i += 1) {
    const w = pct(prop(lemboP[i].css, "width"));
    const clip = prop(fronteP[i].css, "clip-path") || "";
    const m = clip.match(/inset\(0\s+50%\s+0\s+([\d.]+)%\)/);
    t.c(
      `fronte indietro al ${fronteP[i].stop}%: ritaglia dal SUO lato`,
      m && Math.abs(Number(m[1]) - w) < 0.01,
      `clip «${clip}», lembo ${w}`
    );
  }
  t.c(
    "indietro l'ombra cade verso il SUO dorso (a destra)",
    lemboP.slice(0, -1).every((f) => numeri(f.css, /drop-shadow\((-?[\d.]+)px/g).every((x) => x > 0))
  );

  // ---- CHI FA COSA --------------------------------------------------------
  const dNext = blocco(".bc-doppia.bc-volta-next::view-transition-old(bc-pagina) {");
  const dPrev = blocco(".bc-doppia.bc-volta-prev::view-transition-old(bc-pagina) {");
  t.c("a doppia il fronte è la pagina VECCHIA", /animation:\s*bc-fronte-next/.test(dNext), dNext.trim());
  t.c("anche indietro", /animation:\s*bc-fronte-prev/.test(dPrev));
  const lemboRegNext = blocco(".bc-doppia.bc-volta-next::view-transition-new(bc-carta) {");
  const lemboRegPrev = blocco(".bc-doppia.bc-volta-prev::view-transition-new(bc-carta) {");
  t.c("il lembo è la CARTA, non il contenuto", /animation:\s*bc-lembo-next/.test(lemboRegNext));
  t.c("anche indietro", /animation:\s*bc-lembo-prev/.test(lemboRegPrev));
  // il lembo si ritaglia con la scatola: un clip-path gli mangerebbe l'ombra
  t.c(
    "niente clip-path sul lembo, o l'ombra sparisce",
    !/clip-path/.test(lemboRegNext) && !/clip-path/.test(lemboRegPrev)
      && !/clip-path/.test(blocco("@keyframes bc-lembo-next"))
      && !/clip-path/.test(blocco("@keyframes bc-lembo-prev"))
  );
  // e la scatola si chiude, o la fotografia deborda (misurato col righello)
  t.c(
    "il lembo taglia davvero la sua fotografia",
    /overflow:\s*hidden/.test(lemboRegNext) && /overflow:\s*hidden/.test(lemboRegPrev)
  );

  // ---- LA CARTA NON SI VEDE MAI A RIPOSO ----------------------------------
  // i rettangoli di bc-carta esistono a OGNI voltata, anche singola: senza
  // lo zero di partenza coprirebbero il libro
  t.c(
    "la carta parte spenta",
    /::view-transition-old\(bc-carta\),\s*\n?::view-transition-new\(bc-carta\)\s*\{\s*[^}]*opacity:\s*0/.test(CSS)
  );
  const gruppoCarta = blocco("::view-transition-group(bc-carta) {");
  const gruppoPagina = blocco("::view-transition-group(bc-pagina) {");
  t.c(
    "e quando vola, vola SOPRA la pagina",
    Number((gruppoCarta.match(/z-index:\s*(\d+)/) || [])[1]) > Number((gruppoPagina.match(/z-index:\s*(\d+)/) || [])[1])
  );
  // «meno animazioni»: fermare la carta non basta, va rimessa a zero
  const ridotto = CSS.slice(CSS.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
  t.c("col movimento ridotto la carta torna a zero", /bc-carta[^{]*\{[^}]*opacity:\s*0/s.test(ridotto));

  // ---- PAGINA SINGOLA: la rotazione resta, con le sue lezioni -------------
  const sx = blocco("@keyframes bc-foglio-sx");
  const dx = blocco("@keyframes bc-foglio-dx");
  const gradiSx = numeri(sx, /rotateY\((-?[\d.]+)deg\)/g);
  const gradiDx = numeri(dx, /rotateY\((-?[\d.]+)deg\)/g);
  t.c(
    "col cardine a sinistra il foglio viene AVANTI (gradi negativi)",
    gradiSx.length >= 4 && gradiSx.every((g) => g <= 0),
    `visti ${gradiSx.join(", ")}`
  );
  t.c(
    "col cardine a destra il foglio viene AVANTI (gradi positivi)",
    gradiDx.length >= 4 && gradiDx.every((g) => g >= 0)
  );
  t.c("si arriva di taglio", Math.min(...gradiSx) <= -88 && Math.max(...gradiDx) >= 88);
  const next1 = blocco(".bc-volta-next::view-transition-old(bc-pagina) {");
  const prev1 = blocco(".bc-volta-prev::view-transition-old(bc-pagina) {");
  t.c("a pagina singola avanti gira il foglio vecchio dal cardine sinistro",
    /animation:\s*bc-foglio-sx/.test(next1) && /transform-origin:\s*0%\s+50%/.test(next1));
  t.c("e indietro dal cardine destro",
    /animation:\s*bc-foglio-dx/.test(prev1) && /transform-origin:\s*100%\s+50%/.test(prev1));
  t.c(
    "la pagina nuova non gira mai",
    !/::view-transition-new\(bc-pagina\)[^{]*\{[^}]*animation:\s*bc-/.test(CSS)
  );
  // la prospettiva sta sulla COPPIA: sul gruppo non arriva al foglio, e il
  // rotateY si disegna piatto (tre bocciature di fila)
  const coppia = blocco("::view-transition-image-pair(bc-pagina) {");
  t.c("la prospettiva sta sulla coppia", /perspective:\s*var\(--bc-prof/.test(coppia), coppia.trim());
  t.c("e non sul gruppo", !/perspective:/.test(gruppoPagina));
  t.c("con un valore di scorta", /var\(--bc-prof,\s*\d+px\)/.test(coppia));

  // ---- LA CARTA IN VOLO PRENDE LUCE ---------------------------------------
  // il lembo dipinto col fondo del tema, sulla notte, e' nero che vola sul
  // nero: la mescola con l'inchiostro deve muoverlo DAVVERO, su ogni tema
  const luma = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).reduce((a, b) => a + b, 0);
  for (const [nome, tema] of Object.entries(READER_THEMES)) {
    const volo = cartaInVolo(tema.bg, tema.fg);
    t.c(`sul tema «${nome}» il lembo non e' il fondo`, volo !== tema.bg, volo);
    const scuro = luma(tema.bg) < luma(tema.fg);
    t.c(
      `e si muove VERSO l'inchiostro (${scuro ? "piu' chiaro" : "piu' scuro"})`,
      scuro ? luma(volo) > luma(tema.bg) : luma(volo) < luma(tema.bg),
      `${tema.bg} → ${volo}`
    );
  }
  t.c("la quota e' un soffio, non un altro colore", VOLO > 0 && VOLO <= 0.2, `${VOLO}`);
  t.eq("un colore che non e' esadecimale torna com'era", cartaInVolo("red", "#ffffff"), "red");
}
