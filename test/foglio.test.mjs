// LA GEOMETRIA DELLA SVOLTA, LETTA DAL FOGLIO DI STILE.
//
// Tre giri di questa animazione sono stati bocciati dal lettore, e nessuno
// dei tre difetti si vedeva leggendo il diff: erano SEGNI e META' — il
// verso della rotazione rispetto al cardine, quale delle due facciate
// gira, da che parte cade l'ombra. Si vedevano solo filmando l'app. Un
// filmato però non si può mettere in `npm test`, mentre queste quattro
// regole sì, perché sono aritmetica: col cardine a sinistra i gradi
// devono essere negativi o il foglio sprofonda dentro lo schermo invece di
// sollevarsi, e l'ombra deve cadere dalla parte verso cui il foglio si
// piega o non è l'ombra di quel foglio.
//
// E il `clip-path`: guardarlo qui non è pignoleria di stile. Il `filter` si
// applica PRIMA del ritaglio, quindi un ritaglio sulla metà del foglio si
// porta via anche la `drop-shadow`, che per forza cade fuori. È il difetto
// per cui il foglio girava senza ombra («ancora non ci siamo»), e chi
// rimettesse un `clip-path` per ritagliare la facciata lo rimetterebbe
// tale e quale.
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

export default async function (t) {
  // ---- i due fotogrammi-chiave esistono ----------------------------------
  const sx = blocco("@keyframes bc-foglio-sx");
  const dx = blocco("@keyframes bc-foglio-dx");
  t.c("c'è la svolta col cardine a sinistra", sx.length > 0);
  t.c("e quella col cardine a destra", dx.length > 0);

  // ---- IL VERSO -----------------------------------------------------------
  // `rotateY` positivo manda indietro quello che sta a DESTRA dell'origine.
  // Cardine a sinistra: tutto il foglio sta a destra del cardine, quindi
  // col più sprofonda e serve il MENO. Cardine a destra: il contrario.
  const gradiSx = numeri(sx, /rotateY\((-?[\d.]+)deg\)/g);
  const gradiDx = numeri(dx, /rotateY\((-?[\d.]+)deg\)/g);
  t.c("il cardine a sinistra ha gradi da girare", gradiSx.length >= 4, `trovati ${gradiSx.length}`);
  t.c("e quello a destra pure", gradiDx.length >= 4, `trovati ${gradiDx.length}`);
  t.c(
    "col cardine a sinistra il foglio viene AVANTI (gradi negativi)",
    gradiSx.every((g) => g <= 0),
    `visti ${gradiSx.join(", ")}`
  );
  t.c(
    "col cardine a destra il foglio viene AVANTI (gradi positivi)",
    gradiDx.every((g) => g >= 0),
    `visti ${gradiDx.join(", ")}`
  );
  // e la corsa arriva davvero di taglio: fermarsi a mezza strada lascia
  // una lastra ferma sopra la pagina nuova
  t.c("si arriva di taglio a sinistra", Math.min(...gradiSx) <= -88, `il più lontano è ${Math.min(...gradiSx)}`);
  t.c("e di taglio a destra", Math.max(...gradiDx) >= 88, `il più lontano è ${Math.max(...gradiDx)}`);
  // il tempo sta dove il foglio si vede: a metà corsa dev'essere già oltre
  // i venti gradi, o la parte che racconta se ne va in coda
  t.c("a sinistra il sollevarsi non è tutto in coda", gradiSx.some((g) => g <= -25 && g >= -55));
  t.c("a destra nemmeno", gradiDx.some((g) => g >= 25 && g <= 55));

  // ---- L'OMBRA ------------------------------------------------------------
  // cade dalla parte verso cui il foglio si piega, e non è decorazione: è
  // il segnale per cui l'occhio legge «carta che si stacca» invece di
  // «rettangolo che ruota»
  const ombreSx = numeri(sx, /drop-shadow\((-?[\d.]+)px/g);
  const ombreDx = numeri(dx, /drop-shadow\((-?[\d.]+)px/g);
  t.c("il foglio col cardine a sinistra fa ombra", ombreSx.length >= 4, `trovate ${ombreSx.length}`);
  t.c("e quello col cardine a destra pure", ombreDx.length >= 4, `trovate ${ombreDx.length}`);
  t.c("a sinistra l'ombra cade a sinistra", ombreSx.every((x) => x <= 0), `viste ${ombreSx.join(", ")}`);
  t.c("a destra l'ombra cade a destra", ombreDx.every((x) => x >= 0), `viste ${ombreDx.join(", ")}`);

  // ---- CHI GIRA -----------------------------------------------------------
  // sempre la pagina VECCHIA, sopra quella nuova ferma: se girasse la nuova
  // il prezzo delle due sole fotografie si pagherebbe dal lato sbagliato
  const avanti = blocco(".bc-volta-next::view-transition-old(bc-pagina) {");
  const indietro = blocco(".bc-volta-prev::view-transition-old(bc-pagina) {");
  t.c("avanti gira il foglio vecchio", /animation:\s*bc-foglio-sx/.test(avanti), avanti.trim());
  t.c("e il suo cardine è a sinistra", /transform-origin:\s*0%\s+50%/.test(avanti));
  t.c("indietro gira il foglio vecchio", /animation:\s*bc-foglio-dx/.test(indietro), indietro.trim());
  t.c("e il suo cardine è a destra", /transform-origin:\s*100%\s+50%/.test(indietro));
  t.c(
    "la pagina nuova non gira mai",
    !/::view-transition-new\(bc-pagina\)[^{]*\{[^}]*animation:\s*bc-foglio/.test(CSS)
  );

  // ---- QUALE META' ---------------------------------------------------------
  // a facciata doppia il dorso sta in mezzo: avanti si alza la facciata di
  // DESTRA, indietro quella di SINISTRA. Girare quella sbagliata è il gesto
  // opposto, e all'occhio la pagina sembra mangiata dal lato storto.
  const dueAvanti = blocco(".bc-doppia.bc-volta-next::view-transition-old(bc-pagina) {");
  const dueIndietro = blocco(".bc-doppia.bc-volta-prev::view-transition-old(bc-pagina) {");
  t.c("a doppia, avanti gira mezzo foglio", /width:\s*50%/.test(dueAvanti));
  t.c("ed è la metà di DESTRA", /object-position:\s*100%\s+0/.test(dueAvanti), dueAvanti.trim());
  t.c("indietro gira mezzo foglio", /width:\s*50%/.test(dueIndietro));
  t.c("ed è la metà di SINISTRA", /object-position:\s*0\s+0/.test(dueIndietro), dueIndietro.trim());
  // la metà si ritaglia con la SCATOLA, non con `clip-path`
  t.c("la mezza facciata si mostra con object-fit", /object-fit:\s*none/.test(dueAvanti) && /object-fit:\s*none/.test(dueIndietro));
  // e senza `overflow` la fotografia deborda: il ritaglio non ritaglia
  t.c(
    "la metà che avanza si taglia davvero",
    /overflow:\s*hidden/.test(dueAvanti) && /overflow:\s*hidden/.test(dueIndietro)
  );

  // ---- NIENTE `clip-path` SUL FOGLIO --------------------------------------
  // si porterebbe via l'ombra insieme al ritaglio
  const regoleFoglio = [...CSS.matchAll(/::view-transition-(?:old|new)\(bc-pagina\)[^{]*\{([^}]*)\}/g)].map((m) => m[1]);
  t.c("ci sono regole sul foglio da controllare", regoleFoglio.length >= 4, `trovate ${regoleFoglio.length}`);
  t.c(
    "nessun clip-path sul foglio: mangerebbe l'ombra",
    regoleFoglio.every((r) => !/clip-path/.test(r))
  );

  // ---- LA PROSPETTIVA -----------------------------------------------------
  // STA SULLA COPPIA, non sul gruppo: `perspective` vale per i figli
  // DIRETTI, e fra il gruppo e il foglio c'è la coppia di mezzo. Messa sul
  // gruppo non arriva al foglio, il `rotateY` viene disegnato piatto, e
  // quello che si vede è una pagina che si stringe invece di girare — il
  // difetto bocciato tre volte di fila.
  const coppia = blocco("::view-transition-image-pair(bc-pagina) {");
  t.c("la prospettiva sta sulla coppia", /perspective:\s*var\(--bc-prof/.test(coppia), coppia.trim());
  t.c("e non sul gruppo, dove non arriverebbe al foglio", !/perspective:/.test(blocco("::view-transition-group(bc-pagina) {")));
  // e si misura, non si sceglie: un numero fisso vale per uno schermo solo
  t.c("con un valore di scorta", /var\(--bc-prof,\s*\d+px\)/.test(coppia));
  t.c("e il punto di fuga in mezzo al libro", /perspective-origin:\s*50%\s+50%/.test(coppia));
}
