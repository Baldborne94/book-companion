// IL TESTO DI UNA PAGINA PER LA VOCE (`testoFra` in `lib/voce.js`), in un
// browser vero: e' DOM, e Node non ne ha uno. Sbaglia in silenzio: il
// paragrafo tagliato dal bordo della pagina si portava dietro il suo a
// capo, e la frase a meta' veniva detta come finita (misurato sull'app
// intera: «…and the night» e poi, girata la pagina, «was long and cold»).
import { readFileSync, existsSync } from "node:fs";
import { Saltato } from "./aiuto.mjs";

const CORPO = `
  <h2 id="tit">Capitolo primo</h2>
  <p id="a">Era notte e il vento <em id="em">soffiava</em> sulle torri del castello.</p>
  <p id="b">Nessuno dormiva<sup>1</sup> quella sera</p>
  <p id="c">Poi venne l'alba.</p>
  <div><p id="d">Fine del giorno</p><p id="e">Inizio della notte.</p></div>
`;

export default async function (t) {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    throw new Saltato("manca playwright");
  }
  const casa = process.env.PLAYWRIGHT_BROWSERS_PATH;
  const strade = [{}, casa && existsSync(`${casa}/chromium`) ? { executablePath: `${casa}/chromium` } : null].filter(Boolean);
  let browser = null;
  for (const s of strade) {
    try {
      browser = await chromium.launch(s);
      break;
    } catch {
      /* la prossima strada */
    }
  }
  if (!browser) throw new Saltato("nessun Chromium da lanciare");
  try {
    const p = await browser.newPage();
    await p.setContent(`<!doctype html><html><body>${CORPO}</body></html>`);
    const sorgente = readFileSync(new URL("../src/lib/voce.js", import.meta.url), "utf8").replace(/^export /gm, "");
    await p.addScriptTag({ content: `${sorgente}\nwindow.__testoFra = testoFra;` });
    const fra = (da, a) =>
      p.evaluate(([da, a]) => {
        const nodo = (id, i = 0) => document.getElementById(id).childNodes[i];
        const pt = ([id, i, off]) => {
          const n = nodo(id, i);
          return { container: n, offset: off === "fine" ? n.length : off };
        };
        return window.__testoFra(document, pt(da), pt(a));
      }, [da, a]);

    const tagliata = await fra(["tit", 0, 0], ["a", 0, 12]);
    t.c("un paragrafo tagliato dal bordo non finisce con un a capo", !/\n$/.test(tagliata), JSON.stringify(tagliata));
    t.c("…ma i blocchi interi sì", /Capitolo primo\n/.test(tagliata), JSON.stringify(tagliata));

    const chiusa = await fra(["tit", 0, 0], ["a", 2, "fine"]);
    t.c("la pagina che finisce col paragrafo lo chiude", /castello\.\n$/.test(chiusa), JSON.stringify(chiusa));

    const senzaPunto = await fra(["a", 0, 0], ["b", 2, "fine"]);
    t.c("…anche senza punto in fondo", /quella sera\n$/.test(senzaPunto), JSON.stringify(senzaPunto));
    t.c("il richiamo di nota non si dice", !/dormiva1/.test(senzaPunto) && /dormiva quella/.test(senzaPunto), JSON.stringify(senzaPunto));

    const dentroEm = await fra(["a", 0, 0], ["em", 0, "fine"]);
    t.c("finire in fondo a un corsivo non è finire il paragrafo", !/\n$/.test(dentroEm), JSON.stringify(dentroEm));

    // molti ePub scrivono i paragrafi attaccati, senza spazi fra un tag e
    // l'altro: senza un a capo per blocco «giorno» e «Inizio» sarebbero
    // una frase sola
    const attaccati = await fra(["d", 0, 0], ["e", 0, "fine"]);
    t.c("i paragrafi attaccati restano due", /giorno\nInizio/.test(attaccati), JSON.stringify(attaccati));

    const aMetaParola = await fra(["a", 0, 0], ["a", 0, 7]);
    t.eq("il bordo dentro una parola la lascia alla pagina dopo", aMetaParola, "Era");
  } finally {
    await browser.close();
  }
}
