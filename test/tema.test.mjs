// Le regole che il reader mette addosso al libro, misurate in un motore
// vero: il CSS non si prova a mente. Il foglio si accoda in fondo al
// documento, esattamente come fa epub.js, cosi' la gara di specificita'
// e' quella vera.
//
// Serve un browser. Senza, il file si dichiara SALTATO invece di fallire —
// ma saltare non e' passare: chi tocca `readerTheme.js` deve farlo girare.
import { contentStyles, spegniVuoti } from "../src/lib/readerTheme.js";
import { READER_THEMES } from "../src/lib/readerSettings.js";
import { Saltato } from "./aiuto.mjs";

// il foglio di stile di un ePub vero: paragrafi attaccati col rientro, uno
// spaziatore sottile, un contenitore che detta l'interlinea sua, e lo
// stacco di scena voluto dal libro
const LIBRO = `
  p { margin: 0; text-indent: 1.2em; color: #111; }
  .sp { line-height: 0; }
  .fitta p { line-height: 1.1; }
  .scena { margin: 0; }
`;

const CORPO = `
  <h2 id="tit">Guards! Guards!</h2>
  <p id="a">And your daughter's hand in marriage, said <em id="em">Wonse</em>.</p>
  <p class="sp" id="sp">&nbsp;</p>
  <p id="b">I suppose an aunt isn't acceptable? the Patrician said hopefully.</p>
  <p id="ancora"><a class="calibre3"></a></p>
  <p class="calibre23" id="conAncora">Una battuta vera che si porta dietro un'ancora<a class="calibre3"></a></p>
  <p id="conImmagine"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" style="width:30px;height:30px"></p>
  <p id="conBr"><br></p>
  <p id="vuoto"></p>
  <p class="scena" id="scena">&nbsp;</p>
  <p id="lungo">Nel mezzo del cammin di nostra vita mi ritrovai per una selva oscura che
     la diritta via era smarrita, e quanto a dir qual era e cosa dura questa selva
     selvaggia e aspra e forte che nel pensier rinova la paura.</p>
  <div id="div">testo dentro un div, che certi ePub usano al posto di p</div>
  <font id="font">un font di un vecchio ePub</font>
  <table><tr><td id="td">una cella</td></tr></table>
  <figure><figcaption id="cap">una didascalia</figcaption></figure>
  <p><a id="link" href="#x">un collegamento</a></p>
  <div class="fitta"><p id="fitto">un paragrafo dentro un contenitore che detta l'interlinea</p></div>
  <p><img id="img" src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" style="width:4000px"></p>
`;

const BASE = { theme: "night", font: "serif", fontSize: 100, lineHeight: 1.6, margin: 24, justify: true };
const rgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};
const inCss = (rules) =>
  Object.entries(rules)
    .map(([sel, d]) => `${sel}{${Object.entries(d).map(([k, v]) => `${k}:${v};`).join("")}}`)
    .join("\n");

export default async function (t) {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    throw new Saltato("manca playwright — `npm i -D playwright && npx playwright install chromium`");
  }

  // TRE STRADE PER UN BROWSER, e si provano in ordine. Playwright si porta
  // dietro un Chromium di una versione precisa, e se sul disco c'e' quello
  // di un'altra installazione il lancio fallisce con un percorso che non
  // esiste — succede sul serio, e il file si dichiarava saltato per un
  // motivo che con `readerTheme.js` non c'entra niente. Il Chrome di
  // sistema fa lo stesso lavoro.
  const strade = [
    process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : null,
    {},
    { channel: "chrome" },
    { channel: "chromium" },
  ].filter(Boolean);
  let browser;
  let ultimo = "";
  for (const opzioni of strade) {
    try {
      browser = await chromium.launch(opzioni);
      break;
    } catch (e) {
      ultimo = String(e.message).split("\n")[0];
    }
  }
  if (!browser) {
    throw new Saltato(
      `il browser non parte (${ultimo}) — `
        + "`npx playwright install chromium`, oppure PLAYWRIGHT_CHROMIUM=/percorso/al/chrome"
    );
  }
  const p = await browser.newPage({ viewport: { width: 900, height: 900 } });

  // le regole si calcolano in Node (sono una funzione pura) e si accodano
  // alla pagina; `spegniVuoti` invece vuole un DOM, e viaggia come sorgente
  async function applica(s = BASE, lingua = "en") {
    await p.setContent(`<!doctype html><html><head><style>${LIBRO}</style></head><body>${CORPO}</body></html>`);
    await p.addStyleTag({ content: inCss(contentStyles(s, lingua)) });
    await p.evaluate(([src]) => new Function(`return ${src}`)()(document), [spegniVuoti.toString()]);
  }
  const stile = (id, prop) => p.evaluate(([i, k]) => getComputedStyle(document.getElementById(i))[k], [id, prop]);
  const scatola = (id) =>
    p.evaluate(([i]) => {
      const el = document.getElementById(i);
      const cs = getComputedStyle(el);
      return Math.round(parseFloat(cs.marginTop) + parseFloat(cs.marginBottom) + el.getBoundingClientRect().height);
    }, [id]);
  const stacco = () =>
    p.evaluate(() => {
      const a = document.getElementById("a").getBoundingClientRect();
      const b = document.getElementById("b").getBoundingClientRect();
      return Math.round(b.top - a.bottom);
    });

  const tema = READER_THEMES[BASE.theme];

  try {
    // ---- lo spaziatore del libro resta sottile ---------------------------
    await applica();
    t.eq("lo spaziatore non gonfia lo stacco", await stacco(), 0);
    t.eq("e resta a interlinea zero", await stile("sp", "lineHeight"), "0px");

    // ---- le ancore di pagina non sono paragrafi --------------------------
    t.eq("il paragrafo con la sola ancora vuota non occupa niente", await scatola("ancora"), 0);
    t.eq("il paragrafo vuoto nemmeno", await scatola("vuoto"), 0);
    t.c("ma lo stacco di scena del libro resta una riga", (await scatola("scena")) > 10);
    t.c("i paragrafi veri non si toccano", (await scatola("a")) > 10 && (await scatola("lungo")) > 10);
    // i tre casi su cui la versione CSS sbagliava
    t.c("una battuta con l'ancora dentro resta leggibile", (await scatola("conAncora")) > 10, `${await scatola("conAncora")}px`);
    t.c("il paragrafo con la sola immagine resta", (await scatola("conImmagine")) > 10);
    t.c("il paragrafo col solo <br> resta (stacco voluto)", (await scatola("conBr")) > 10);

    // ---- l'interlinea fa ancora il suo mestiere --------------------------
    const corpoPx = parseFloat(await stile("a", "fontSize"));
    t.vicino("la prosa ha l'interlinea della levetta", parseFloat(await stile("a", "lineHeight")), corpoPx * 1.6);
    t.vicino("e l'eredita chi sta dentro il paragrafo", parseFloat(await stile("em", "lineHeight")), corpoPx * 1.6);
    t.vicino("il body pure", parseFloat(await stile("div", "lineHeight")), corpoPx * 1.6);

    await applica({ ...BASE, lineHeight: 2.2 });
    t.vicino("la levetta muove davvero l'interlinea", parseFloat(await stile("a", "lineHeight")), corpoPx * 2.2);
    const alto = await p.evaluate(() => document.getElementById("lungo").getBoundingClientRect().height);
    await applica({ ...BASE, lineHeight: 1.3 });
    const basso = await p.evaluate(() => document.getElementById("lungo").getBoundingClientRect().height);
    t.c("e il paragrafo cambia altezza davvero", alto > basso + 10, `${alto} vs ${basso}`);

    // ---- lezione 1: l'inchiostro arriva ovunque --------------------------
    await applica();
    for (const id of ["a", "em", "div", "font", "td", "cap", "tit", "b", "lungo"])
      t.eq(`l'inchiostro del tema su «${id}»`, await stile(id, "color"), rgb(tema.fg));
    t.eq("il collegamento tiene il colore link", await stile("link", "color"), rgb(tema.link));

    // ---- giustificato e sillabato, o nessuno dei due ---------------------
    t.eq("prosa giustificata", await stile("a", "textAlign"), "justify");
    t.eq("e sillabata", await stile("a", "hyphens"), "auto");
    t.eq("il div NON si giustifica", await stile("div", "textAlign"), "start");
    await applica({ ...BASE, justify: false });
    t.eq("a bandiera, detto esplicitamente", await stile("a", "textAlign"), "start");
    t.eq("e senza sillabazione", await stile("a", "hyphens"), "manual");
    await applica(BASE, null);
    t.c("senza lingua non si giustifica", ["start", "left"].includes(await stile("a", "textAlign")));
    t.eq("ne' si sillaba", await stile("a", "hyphens"), "manual");

    // ---- il prezzo dichiarato, e il caso comune --------------------------
    await applica();
    t.vicino("il libro che detta l'interlinea per CLASSE vince (prezzo accettato)",
      parseFloat(await stile("fitto", "lineHeight")), corpoPx * 1.1);
    await p.evaluate(() => {
      const st = document.createElement("style");
      st.textContent = "p { line-height: 1.15; }";
      document.head.insertBefore(st, document.head.firstChild);
    });
    t.vicino("ma sul selettore per TAG, il caso comune, vinciamo noi",
      parseFloat(await stile("a", "lineHeight")), corpoPx * 1.6);

    // ---- il resto del tema, intatto --------------------------------------
    await applica();
    t.eq("lo sfondo del corpo e' quello del tema",
      await p.evaluate(() => getComputedStyle(document.body).backgroundColor), rgb(tema.bg));
    const largh = await p.evaluate(() => document.getElementById("img").getBoundingClientRect().width);
    t.c("l'immagine gigante sta nella pagina", largh <= 900, `${largh}px`);
  } finally {
    await browser.close();
  }
}
