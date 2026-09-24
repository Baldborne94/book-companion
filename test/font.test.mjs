// I CARATTERI DEL READER. Due modi di sbagliare, tutt'e due muti: una
// famiglia scaricata col nome diverso da quello che il foglio di stile chiede
// (il font arriva e non si usa, il testo resta in Georgia) e un tasto che
// mostra l'anteprima in un carattere che la pagina non conosce.
import { readFileSync } from "fs";
import { READER_FONTS, importDelFont } from "../src/lib/readerSettings.js";

const radice = new URL("..", import.meta.url);
const leggi = (p) => readFileSync(new URL(p, radice), "utf8");

// «EB+Garamond:ital,wght@…» → «EB Garamond»
const famigliaGoogle = (g) => decodeURIComponent(g.split(":")[0]).replace(/\+/g, " ");
// «"EB Garamond", Georgia, serif» → «EB Garamond»
const primaFamiglia = (css) => css.split(",")[0].trim().replace(/^["']|["']$/g, "");

export default async function (t) {
  const ids = READER_FONTS.map((f) => f.id);
  t.eq("nessun id doppio", new Set(ids).size, ids.length);
  for (const id of ["original", "garamond", "serif", "sans"]) {
    t.c(`il carattere «${id}» c'è ancora (qualcuno l'ha salvato)`, ids.includes(id));
  }
  t.c("i due nuovi ci sono", ids.includes("literata") && ids.includes("atkinson"));
  t.eq("l'originale del libro resta il primo", READER_FONTS[0].id, "original");

  const scaricati = READER_FONTS.filter((f) => f.google);
  for (const f of scaricati) {
    t.eq(
      `«${f.label}»: la famiglia scaricata è quella che il foglio chiede`,
      famigliaGoogle(f.google),
      primaFamiglia(f.css)
    );
    t.c(`«${f.label}»: ha il corsivo`, /ital/.test(f.google) && /1,400/.test(f.google));
    const imp = importDelFont(f.id);
    t.c(`«${f.label}»: l'import punta a Google Fonts`, imp?.startsWith("@import url('https://fonts.googleapis.com/css2?family="));
    t.c(`«${f.label}»: l'import porta la sua famiglia`, imp?.includes(`family=${f.google}&`));
    t.c(`«${f.label}»: l'import chiede display=swap (niente testo invisibile)`, imp?.includes("display=swap"));
  }

  for (const id of ["original", "serif", "sans"]) {
    t.eq(`«${id}» non scarica niente`, importDelFont(id), null);
  }
  t.eq("un id che non esiste non fa un import rotto", importDelFont("boh"), null);
  t.eq("nemmeno senza id", importDelFont(undefined), null);

  // l'anteprima sui tasti usa `f.css` nella pagina dell'app, non nel
  // capitolo: la pagina deve conoscere la famiglia, o il tasto «Literata»
  // si disegnerebbe in Georgia e la scelta sarebbe alla cieca
  const indice = leggi("src/index.css");
  for (const f of scaricati) {
    t.c(`la pagina dell'app conosce «${f.label}» per l'anteprima`, indice.includes(`family=${f.google.split(":")[0]}`));
  }

  // la cache dei font deve tenere tutti i file che servono, o senza rete un
  // peso del carattere scelto torna Georgia
  const conf = leggi("vite.config.js");
  const m = conf.match(/cacheName:\s*"google-fonts-files"[\s\S]*?maxEntries:\s*(\d+)/);
  t.c("la cache dei font ha un tetto", !!m);
  t.c("e il tetto regge ogni famiglia scaricata coi suoi pesi", Number(m?.[1]) >= 15 * scaricati.length);
}
