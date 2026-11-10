// LA BARRA DI SCORRIMENTO DEL TEMA (chiesto dal lettore, con la foto del PC:
// «così fa un po' schifo e non ci azzecca con lo stile dell'app»). Quella di
// Windows era bianca, grigia e con le frecce. Le regole: solo dove c'è un
// mouse (sul tablet resta quella sottile del sistema), il colore del tema e
// non un colore scritto, niente frecce.
import { readFileSync } from "fs";

const CSS = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

function blocco(capo) {
  const i = CSS.indexOf(capo);
  if (i < 0) return "";
  const a = CSS.indexOf("{", i);
  let liv = 0;
  for (let j = a; j < CSS.length; j += 1) {
    if (CSS[j] === "{") liv += 1;
    else if (CSS[j] === "}" && --liv === 0) return CSS.slice(a + 1, j);
  }
  return "";
}

export default async function (t) {
  const mouse = blocco("@media (hover: hover) and (pointer: fine)");
  t.c("la barra si disegna solo dove c'è un mouse", /::-webkit-scrollbar\s*\{/.test(mouse));
  const fuori = CSS.replace(mouse, "");
  t.c("…e mai fuori da lì (sul tablet resta quella del sistema)", !/::-webkit-scrollbar/.test(fuori));
  const pollice = blocco("::-webkit-scrollbar-thumb {");
  t.c("il pollice ha il colore del tema, non uno scritto", /var\(--bc-accent/.test(pollice), pollice);
  t.c("…arrotondato", /border-radius/.test(pollice));
  t.c("il binario è trasparente: si vede il fondo del tema", /background:\s*transparent/.test(blocco("::-webkit-scrollbar-track")));
  t.c("niente frecce", /display:\s*none/.test(blocco("::-webkit-scrollbar-button")));
}
