// IL TOCCO RISPONDE CON LA NOSTRA FACCIA, DOVUNQUE CADA.
//
// Chrome Android dipinge il suo rettangolo grigio-azzurro su qualunque
// elemento che risponda a un tocco. La regola che lo spegne stava sui soli
// `button`, e nel lettore dei fumetti — dove il tocco cade sul riquadro
// della pagina — ogni voltata era un lampo blu su tutta la tavola: visto
// nel video del lettore, circa 100ms pieni e 200ms di dissolvenza, e
// nessun errore lo dice. Adesso sta su `*`, e questo controllo tiene la
// riga dov'e': il CSS non si prova a mente, ma un selettore si legge.
import { readFileSync } from "node:fs";

export default async function (t) {
  const css = readFileSync("src/index.css", "utf8");
  const inizio = css.indexOf("\n* {");
  t.c("la regola su `*` c'e' ancora", inizio >= 0);
  const blocco = css.slice(inizio, css.indexOf("}", inizio));
  t.c(
    "e spegne il lampo di sistema su ogni elemento, non solo sui tasti",
    /-webkit-tap-highlight-color:\s*transparent/.test(blocco),
    blocco
  );
}
