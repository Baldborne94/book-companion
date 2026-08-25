// L'aritmetica del ritaglio dell'avanzo di riga. Sono quattro righe di
// codice e due trappole, e tutt'e due ci sono gia' cascate una volta: al
// primo tentativo il libro non si apriva affatto.
import { ritaglioAvanzo, flattenToc } from "../src/lib/readerLayout.js";
import { rientrata, RIENTRO_MINIMO } from "../src/lib/readerTheme.js";

export default async function (t) {
  // ---- il conto normale --------------------------------------------------
  t.eq("colonna 735, riga 24 → avanzo 15", ritaglioAvanzo({ colonna: 735, riga: 24 }), 15);
  t.eq("una colonna gia' multipla non ha avanzo", ritaglioAvanzo({ colonna: 720, riga: 24 }), 0);

  // ---- pixel interi contro interlinea frazionaria ------------------------
  // corpo grande: la riga e' 26,4px e il ritaglio dev'essere un intero
  const r = ritaglioAvanzo({ colonna: 700, riga: 26.4 });
  t.c("col corpo grande il ritaglio e' un intero", Number.isInteger(r), String(r));
  t.c("e arrotonda per eccesso", r >= (700 % 26.4), `${r} vs ${(700 % 26.4).toFixed(2)}`);

  // ---- la riga che ci sta non si porta via -------------------------------
  // a meno di un pixel dalla riga piena, quella riga ci sta: toglierla
  // sarebbe una riga di lettura buttata
  t.eq("mezzo pixel di avanzo non si toglie", ritaglioAvanzo({ colonna: 720.5, riga: 24 }), 0);
  t.eq("un capello sotto la riga piena non si toglie", ritaglioAvanzo({ colonna: 743.5, riga: 24 }), 0);
  t.c("ma un avanzo vero si toglie", ritaglioAvanzo({ colonna: 730, riga: 24 }) > 0);

  // ---- LA TRAPPOLA DEL CICLO ---------------------------------------------
  // tolto l'avanzo la colonna torna multipla: rimisurando l'altezza
  // CORRENTE il ritaglio si annullerebbe, poi tornerebbe, all'infinito.
  // Sommando `attuale` la misura sta ferma.
  const riga = 24;
  let colonnaPiena = 735;
  let taglio = ritaglioAvanzo({ colonna: colonnaPiena, riga });
  t.eq("primo giro", taglio, 15);
  // il reader toglie il ritaglio dalla colonna e rimisura
  for (let giro = 0; giro < 8; giro += 1) {
    const colonnaRidotta = colonnaPiena - taglio;
    const ancora = ritaglioAvanzo({ colonna: colonnaRidotta, riga, attuale: taglio });
    t.eq(`giro ${giro + 2}: la misura sta ferma`, ancora, taglio);
    taglio = ancora;
  }
  // e senza sommare `attuale` si rimpallerebbe: e' il guasto di allora
  const senzaMemoria = ritaglioAvanzo({ colonna: 735 - 15, riga });
  t.eq("(senza `attuale` invece tornerebbe a zero)", senzaMemoria, 0);

  // ---- quando non c'e' niente da misurare: `null`, non zero --------------
  // zero vuol dire «misurato, e non c'e' avanzo»; null vuol dire «non lo so»
  t.eq("colonna piu' bassa di una riga", ritaglioAvanzo({ colonna: 20, riga: 24 }), null);
  t.eq("colonna uguale a una riga", ritaglioAvanzo({ colonna: 24, riga: 24 }), null);
  t.eq("interlinea assurda", ritaglioAvanzo({ colonna: 700, riga: 0 }), null);
  t.eq("interlinea non numerica", ritaglioAvanzo({ colonna: 700, riga: NaN }), null);
  t.eq("colonna non numerica", ritaglioAvanzo({ colonna: NaN, riga: 24 }), null);
  t.eq("niente del tutto", ritaglioAvanzo(), null);
  t.eq("un `attuale` sballato non fa danni", ritaglioAvanzo({ colonna: 735, riga: 24, attuale: NaN }), 15);

  // ---- l'indice, da albero a elenco --------------------------------------
  const toc = flattenToc([
    { href: "c1", label: " Capitolo primo ", subitems: [{ href: "c1a", label: "Una scena" }] },
    { href: "c2", label: "" },
  ]);
  t.eq("quante voci", toc.length, 3);
  t.eq("il titolo si ripulisce", toc[0].label, "Capitolo primo");
  t.eq("il sottolivello e' rientrato", toc[1].depth, 1);
  t.eq("e torna al livello di prima", toc[2].depth, 0);
  t.eq("una voce senza titolo non resta muta", toc[2].label, "…");
  t.eq("un indice vuoto non esplode", flattenToc().length, 0);

  // ---- IL PARAGRAFO SI SEGNA UNA VOLTA SOLA ----------------------------
  // In «Eric» era segnato due volte, col rientro E con lo stacco, e la
  // pagina veniva ariosa dove un romanzo stampato è compatto. Ma lo stacco
  // si può togliere SOLO se il rientro c'è: senza, è l'unico segnale di
  // paragrafo che il libro ha, e toglierlo incolla il romanzo in un blocco.
  const tanti = (v, n = 10) => Array.from({ length: n }, () => v);

  t.c("un libro rientrato si riconosce", rientrata(tanti(19)));
  t.c("anche con un rientro piccolo ma vero", rientrata(tanti(RIENTRO_MINIMO)));
  // IL CASO DA NON ROVINARE: nessun rientro, lo stacco è il segnale
  t.c("un libro senza rientro NON si tocca", !rientrata(tanti(0)));
  t.c("e nemmeno con un rientro da arrotondamento", !rientrata(tanti(RIENTRO_MINIMO - 1)));

  // il primo paragrafo di capitolo quasi sempre non rientra: pretendere
  // l'unanimità vorrebbe dire non riconoscere mai un libro rientrato
  t.c("qualche paragrafo non rientrato non cambia il verdetto", rientrata([0, 19, 19, 19, 19, 19]));
  t.c("ma se la maggioranza non rientra, no", !rientrata([19, 19, 0, 0, 0, 0]));

  // un rientro NEGATIVO è comunque un rientro dichiarato (sporgente): il
  // libro ha scelto come segnare il paragrafo, e non è con lo stacco
  t.c("il rientro sporgente conta come rientro", rientrata(tanti(-19)));

  // ---- su troppo poco non si decide ------------------------------------
  // un documento di due righe — un frontespizio, una dedica — non dice
  // niente su come è impaginato il romanzo
  t.c("due paragrafi non bastano", !rientrata([19, 19]));
  t.c("nessun paragrafo nemmeno", !rientrata([]));
  t.c("e niente del tutto", !rientrata());
  // i valori che non sono numeri (`text-indent: inherit` su un browser
  // strano) non devono contare come «non rientrato»
  t.c("i non-numeri si scartano, non si contano contro", rientrata([NaN, NaN, 19, 19, 19]));
}
