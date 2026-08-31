// IL GUSCIO NON PUO' ESSERE PIU' ALTO DI QUEL CHE SI VEDE.
//
// La barra di navigazione sta in fondo al guscio, e il guscio ha
// `overflow: hidden`: se il guscio viene più alto dell'area davvero
// visibile, la barra atterra sotto il bordo dello schermo e SPARISCE. Non
// è un'ipotesi — è successo sul tablet del lettore («che è successo alla
// barra sotto?») e il meccanismo è stato riprodotto in browser: guscio 830
// dentro un'area visibile di 730, e il fondo della barra a 830.
//
// La cura è una riga di CSS, e sta tutta NELL'ORDINE: le tre altezze sono
// una scala di ripiego e vince l'ultima che il browser capisce, quindi
// `svh` — il viewport PICCOLO, quello che c'è sempre — deve venire per
// ultimo. Scritto per primo perderebbe contro `dvh`, che è proprio quello
// che su Android può crescere oltre il visibile, e il difetto tornerebbe
// IDENTICO senza che niente lo dica: la regola c'è, il valore no.
//
// Il CSS non si prova a mente, ma questo controllo non ha bisogno di un
// browser: guarda l'ordine, che è la cosa che si rompe in silenzio. Che la
// barra poi si veda davvero è stato misurato a mano, in tre formati.
import { readFileSync } from "node:fs";

export default async function (t) {
  const css = readFileSync("src/index.css", "utf8");
  const blocco = css.slice(css.indexOf(".bc-shell"), css.indexOf(".bc-scroll"));
  t.c("il guscio c'è ancora", blocco.length > 0 && blocco.includes("height"));

  const altezze = [...blocco.matchAll(/height:\s*(100(?:d|s|l)?vh)/g)].map((m) => m[1]);
  t.c("il guscio si misura sull'altezza del viewport", altezze.length > 0, altezze.join(" "));
  t.eq("e l'ULTIMA parola è al viewport piccolo", altezze[altezze.length - 1], "100svh");
  t.c(
    "col ripiego per i browser che non lo capiscono",
    altezze.includes("100vh"),
    altezze.join(" ")
  );
  t.c(
    "e `dvh` non viene dopo `svh`, o rivincerebbe lui",
    !altezze.includes("100dvh") || altezze.indexOf("100dvh") < altezze.indexOf("100svh"),
    altezze.join(" ")
  );

  // il guscio taglia quel che sborda: è questo a rendere invisibile — non
  // solo fuori posto — una barra finita sotto il bordo
  t.c("e il guscio taglia quel che esce", /overflow:\s*hidden/.test(blocco), blocco);
}
