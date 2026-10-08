// L'aritmetica del ritaglio dell'avanzo di riga. Sono quattro righe di
// codice e due trappole, e tutt'e due ci sono gia' cascate una volta: al
// primo tentativo il libro non si apriva affatto.
import { ritaglioAvanzo, flattenToc } from "../src/lib/readerLayout.js";
import {
  rientrata, spaziatoriFitti, SEGNO_DI_SCENA, RIENTRO_MINIMO, ABBASTANZA_PARAGRAFI,
  curaParagrafi, MODI_PARAGRAFI,
} from "../src/lib/readerTheme.js";

export default async function (t) {
  // ---- I TRE MODI DEL PARAGRAFO, E IL TERZO NON TOCCA NIENTE -----------
  // Chiesto dal lettore: «non si può avere il file originale com'è, e
  // quindi avere gli spazi dei paragrafi solo dove previsti dal libro?».
  // Le due cure di prima curano sempre; «libro» deve lasciare stare. È la
  // decisione che sbaglia in silenzio — un modo che cura quando non deve
  // non alza errori, reimpagina e basta — quindi si prova con due cure
  // finte che contano quante volte vengono chiamate.
  const conta = () => {
    const c = { togli: 0, stacca: 0 };
    return { c, cure: { togli: () => { c.togli += 1; }, stacca: () => { c.stacca += 1; } } };
  };
  const doc = {};
  {
    const { c, cure } = conta();
    t.eq("«libro» risponde libro", curaParagrafi(doc, "libro", cure), "libro");
    t.eq("e non toglie lo stacco", c.togli, 0);
    t.eq("e non stacca i paragrafi", c.stacca, 0);
  }
  {
    const { c, cure } = conta();
    t.eq("«stacco» risponde stacco", curaParagrafi(doc, "stacco", cure), "stacco");
    t.eq("e stacca una volta", c.stacca, 1);
    t.eq("senza togliere lo stacco", c.togli, 0);
  }
  {
    const { c, cure } = conta();
    t.eq("«rientro» risponde rientro", curaParagrafi(doc, "rientro", cure), "rientro");
    t.eq("e toglie lo stacco una volta", c.togli, 1);
    t.eq("senza staccare", c.stacca, 0);
  }
  // una preferenza scritta male non è nessuno dei tre e vale il modo di
  // partenza, come per la svolta: non deve spegnere la cura per sbaglio
  for (const storto of [undefined, null, "", true, "originale"]) {
    const { c, cure } = conta();
    t.eq(`«${String(storto)}» vale rientro`, curaParagrafi(doc, storto, cure), "rientro");
    t.eq(`e cura come rientro`, c.togli + c.stacca * 10, 1);
  }
  t.eq("i modi sono tre, e «libro» è fra loro", [...MODI_PARAGRAFI].sort().join(","), "libro,rientro,stacco");
  // e con le cure vere non esplode su un documento che non c'è
  t.eq("senza documento, «rientro» non esplode", curaParagrafi(null, "rientro"), "rientro");
  t.eq("senza documento, «stacco» non esplode", curaParagrafi(null, "stacco"), "stacco");

  // ---- il conto normale --------------------------------------------------
  t.eq("colonna 735, riga 24 → avanzo 15", ritaglioAvanzo({ colonna: 735, riga: 24 }), 15);
  t.eq("una colonna gia' multipla non ha avanzo", ritaglioAvanzo({ colonna: 720, riga: 24 }), 0);

  // ---- la riga del motore, non quella del foglio di stile ---------------
  // Chromium arrotonda l'interlinea per eccesso al 64° di pixel: con 23,04px
  // trenta righe vogliono 691,41px, e una colonna di 691 ne tiene ventinove
  // (misurato). Il caso del lettore: 90%, interlinea 1,6, 1280×768 — la
  // colonna senza ritaglio era 706, e togliendo 15 restavano 691: una riga
  // intera vuota in fondo.
  const passo = (riga) => Math.ceil(riga * 64) / 64;
  for (const [colonna, riga] of [[706, 23.04], [700, 26.4], [743.5, 24], [735, 24], [691.3, 23.04], [512.7, 21.6]]) {
    const via = ritaglioAvanzo({ colonna, riga });
    const resta = colonna - via;
    const righe = Math.floor(colonna / passo(riga));
    t.c(`colonna ${colonna}, riga ${riga}: il ritaglio è un intero`, Number.isInteger(via), String(via));
    t.c(`colonna ${colonna}, riga ${riga}: ci stanno ancora ${righe} righe`, resta >= righe * passo(riga) - 1e-9, `${resta} < ${righe * passo(riga)}`);
    t.c(`colonna ${colonna}, riga ${riga}: e in fondo resta meno di un pixel`, resta - righe * passo(riga) < 1, `${resta - righe * passo(riga)}`);
  }
  t.eq("il caso del lettore: 14 pixel, non 15", ritaglioAvanzo({ colonna: 706, riga: 23.04 }), 14);

  // ---- la riga che non ci sta si toglie ------------------------------------
  // mezzo pixel sotto la riga piena la riga NON ci sta (misurato: 719,8px con
  // righe da 24 ne tengono 29): quel che resta e' carta, e si toglie
  t.eq("mezzo pixel di avanzo non si toglie", ritaglioAvanzo({ colonna: 720.5, riga: 24 }), 0);
  t.eq("un capello sotto la riga piena si toglie: quella riga non ci sta", ritaglioAvanzo({ colonna: 743.5, riga: 24 }), 23);
  t.c("e un avanzo vero si toglie", ritaglioAvanzo({ colonna: 730, riga: 24 }) > 0);

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

  // ---- UNO SPAZIATORE DOPO OGNI PARAGRAFO NON È UNO STACCO DI SCENA ----
  // `spegniVuoti` conserva apposta i <p> con lo spazio unificatore: lì il
  // libro ha aperto una riga di proposito. Giusto — finché sono
  // occasionali. Ma certi ePub ne mettono uno dopo OGNI paragrafo, e
  // allora non sono pause, sono il modo in cui quel libro separa la prosa.
  // Misurato sul libro del lettore: 30 paragrafi veri, 30 spaziatori da
  // 24px l'uno — lo stacco che si vedeva sul tablet.
  t.c("uno per paragrafo è un separatore", spaziatoriFitti(30, 30));
  t.c("anche uno ogni due", spaziatoriFitti(30, 15));

  // GLI STACCHI DI SCENA VERI DEVONO SOPRAVVIVERE: in un romanzo sono una
  // decina ogni cento paragrafi, e la soglia sta larghissima da lì
  t.c("dieci su cento sono stacchi di scena", !spaziatoriFitti(100, 10));
  t.c("e anche venti su cento", !spaziatoriFitti(100, 20));
  t.c("nessuno spaziatore, niente da fare", !spaziatoriFitti(50, 0));

  // ---- su poco testo non si decide -------------------------------------
  // un frontespizio di tre righe con una riga vuota in mezzo sarebbe
  // «sistematico» per puro caso
  t.c("tre paragrafi non bastano", !spaziatoriFitti(3, 3));
  t.c("nemmeno appena sotto la soglia", !spaziatoriFitti(ABBASTANZA_PARAGRAFI - 1, 99));
  t.c("da lì in su sì", spaziatoriFitti(ABBASTANZA_PARAGRAFI, ABBASTANZA_PARAGRAFI));
  t.c("niente paragrafi, niente", !spaziatoriFitti(0, 0));

  // ---- UN SEGNO DI SCENA NON È UN PARAGRAFO ----------------------------
  // Certi libri separano le scene con una riga di asterischi invece che
  // con una riga vuota: ha testo, quindi non è «vuoto», ma lo spazio
  // attorno ce l'ha per mestiere. Da quando i margini si azzerano
  // sull'ELEMENTO — dove la specificità non protegge più niente — questa
  // è l'unica cosa che li tiene staccati dalla prosa.
  const segno = (t) => SEGNO_DI_SCENA.test(t);
  t.c("tre asterischi", segno("***"));
  t.c("con gli spazi", segno("* * *"));
  t.c("il fregio", segno("⁂"));
  t.c("le lineette", segno("— — —"));
  t.c("il rombo", segno("◆"));

  // E LA PROSA NON DEVE MAI PASSARE PER UN SEGNO DI SCENA, o resterebbe
  // con lo stacco che stiamo togliendo
  t.c("una battuta no", !segno("«Oook.»"));
  t.c("nemmeno cortissima", !segno("No."));
  t.c("né un numero di capitolo", !segno("12"));
  t.c("né una riga di puntini lunga", !segno("..............."), "");
  t.c("il vuoto non è un segno", !segno(""));
}
