// Le regole che il reader mette addosso al libro, misurate in un motore
// vero: il CSS non si prova a mente. Il foglio si accoda in fondo al
// documento, esattamente come fa epub.js, cosi' la gara di specificita'
// e' quella vera.
//
// Serve un browser. Senza, il file si dichiara SALTATO invece di fallire —
// ma saltare non e' passare: chi tocca `readerTheme.js` deve farlo girare.
import { contentStyles, spegniVuoti, togliStacco, staccaParagrafi, STACCO, spegniScenografia, rientrata, spaziatoriFitti,
  SEGNO_DI_SCENA, RIENTRO_MINIMO, QUANTI, CAMPIONE, SPAZIATORI_FITTI, ABBASTANZA_PARAGRAFI,
  PAGINA_SU_GIU, SCENA_COPRE, SCENA_TESTO_MINIMO } from "../src/lib/readerTheme.js";
import { READER_THEMES } from "../src/lib/readerSettings.js";
import { Saltato } from "./aiuto.mjs";
import { existsSync, readdirSync } from "node:fs";

// DOVE PLAYWRIGHT TIENE I SUOI BROWSER, quando non e' dove crede lui.
//
// `PLAYWRIGHT_BROWSERS_PATH` e' la cartella dove i browser stanno davvero,
// e la mettono sia le immagini gia' pronte sia chi installa a mano. Ma
// playwright chiede la SUA versione precisa (`chromium-1234`), e se sul
// disco c'e' la 1194 il lancio fallisce su un percorso che non esiste —
// mentre il browser buono e' li' accanto. E' il caso di ogni sessione da
// browser: il test si dichiarava saltato, e `readerTheme.js` restava senza
// guardia proprio dove nessuno se ne sarebbe accorto.
//
// Si guarda prima il collegamento `chromium`, che e' quello che le immagini
// pronte lasciano apposta, poi le cartelle versionate — le due disposizioni
// (`chrome-linux` e `chrome-linux64`) cambiano da una versione all'altra.
function browserSulDisco() {
  const casa = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!casa || !existsSync(casa)) return null;
  if (existsSync(`${casa}/chromium`)) return `${casa}/chromium`;
  let cartelle = [];
  try {
    cartelle = readdirSync(casa).filter((d) => d.startsWith("chromium-")).sort().reverse();
  } catch {
    return null;
  }
  for (const d of cartelle) {
    for (const dentro of ["chrome-linux/chrome", "chrome-linux64/chrome", "chrome-mac/Chromium.app/Contents/MacOS/Chromium"]) {
      if (existsSync(`${casa}/${d}/${dentro}`)) return `${casa}/${d}/${dentro}`;
    }
  }
  return null;
}

// il foglio di stile di un ePub vero: paragrafi attaccati col rientro, uno
// spaziatore sottile, un contenitore che detta l'interlinea sua, e lo
// stacco di scena voluto dal libro
const LIBRO = `
  p { margin: 0; text-indent: 1.2em; color: #111; }
  .sp { line-height: 0; }
  .fitta p { line-height: 1.1; }
  .scena { margin: 0; }
  /* L'EDITORE COLORA ANCHE QUELLO CHE NON E' UN PARAGRAFO, ed e' tutto il
     punto della lezione 1: se l'inchiostro nostro va su un ELENCO di tag
     invece che su «body *», chi resta fuori dall'elenco tiene questo nero
     e sul tema notte sparisce. Senza queste due righe la lezione non era
     coperta da niente: div, font, td e didascalia non avevano un colore
     dell'editore da battere, ereditavano da «body» e passavano comunque. */
  div, td, figcaption { color: #111; }
  font { color: #333; }
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

  // PIU' STRADE PER UN BROWSER, e si provano in ordine. Playwright si porta
  // dietro un Chromium di una versione precisa, e se sul disco c'e' quello
  // di un'altra installazione il lancio fallisce con un percorso che non
  // esiste — succede sul serio, e il file si dichiarava saltato per un
  // motivo che con `readerTheme.js` non c'entra niente. Il Chrome di
  // sistema fa lo stesso lavoro, e il browser che sta dentro
  // `PLAYWRIGHT_BROWSERS_PATH` pure: quella cartella e' proprio il posto
  // dove i browser stanno, e non guardarci era il buco piu' grosso.
  const sulDisco = browserSulDisco();
  const strade = [
    process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : null,
    {},
    sulDisco ? { executablePath: sulDisco } : null,
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
  // `togliStacco` si porta dietro `rientrata` e le tre costanti: si compone
  // la sorgente coi valori VERI, cosi' cambiarli in `readerTheme.js` cambia
  // anche il test invece di lasciarlo a difendere dei numeri inventati
  const sorgenteStacco = `
    const RIENTRO_MINIMO = ${RIENTRO_MINIMO};
    const QUANTI = ${QUANTI};
    const CAMPIONE = ${CAMPIONE};
    const SPAZIATORI_FITTI = ${SPAZIATORI_FITTI};
    const ABBASTANZA_PARAGRAFI = ${ABBASTANZA_PARAGRAFI};
    const rientrata = ${rientrata.toString()};
    const spaziatoriFitti = ${spaziatoriFitti.toString()};
    const SEGNO_DI_SCENA = ${SEGNO_DI_SCENA.toString()};
    return (${togliStacco.toString()});
  `;
  const staccaVia = () => p.evaluate(([src]) => new Function(src)()(document), [sorgenteStacco]);
  // la gemella: toglie il rientro e mette il respiro
  const sorgenteParagrafi = `
    const STACCO = ${JSON.stringify(STACCO)};
    const SEGNO_DI_SCENA = ${SEGNO_DI_SCENA.toString()};
    return (${staccaParagrafi.toString()});
  `;
  const staccaParagrafiVia = () =>
    p.evaluate(([src]) => new Function(src)()(document), [sorgenteParagrafi]);
  // la distanza fra due elementi, che e' quello che il lettore vede
  const fra = (a, b) =>
    p.evaluate(([x, y]) => {
      const u = document.getElementById(x).getBoundingClientRect();
      const v = document.getElementById(y).getBoundingClientRect();
      return Math.round(v.top - u.bottom);
    }, [a, b]);
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

    // ---- LO STACCO DI TROPPO, quando il rientro c'è già ------------------
    // «Eric» segna il paragrafo DUE volte, col rientro e con lo stacco, e la
    // pagina viene ariosa dove un romanzo stampato è compatto («perché vedo
    // tutti questi spazi?»). Qui si misura la cura in un motore vero, e
    // soprattutto quello che la cura NON deve toccare.
    const PAGINA = (foglio) => `<!doctype html><html><head><style>
      ${foglio}
      .scena { margin: 2em 0; }
    </style></head><body>
      <p id="u">He sat back and beamed.</p>
      <p id="d">The rest of the council exchanged glances.</p>
      <p class="scena" id="sc">&nbsp;</p>
      <p id="t">The Bursar scowled at him.</p>
    </body></html>`;

    // (a) il libro tace sui margini: parla il foglio del BROWSER
    await p.setContent(PAGINA("p { text-indent: 1.2em; }"));
    const primaA = await fra("u", "d");
    t.c("col rientro, lo stacco del browser c'è", primaA > 8, `${primaA}px`);
    t.c("e si riconosce un libro rientrato", await staccaVia());
    t.eq("lo stacco fra paragrafi se ne va", await fra("u", "d"), 0);
    // LA RIGA CHE RENDE LA CURA ACCETTABILE: la pausa fra due scene resta.
    // Vince perché è una CLASSE e noi scriviamo senza `!important`.
    const scenaA = await fra("d", "sc");
    t.c("ma lo stacco di SCENA resta intatto", scenaA >= 30, `${scenaA}px`);

    // (b) il libro se li mette da sé, insieme al rientro: stessa storia
    await p.setContent(PAGINA("p { text-indent: 1.2em; margin: 0.8em 0; }"));
    t.c("anche i margini del libro si tolgono", await staccaVia());
    t.eq("e il paragrafo si attacca", await fra("u", "d"), 0);
    t.c("la scena resta anche qui", (await fra("d", "sc")) >= 30);

    // (c) IL CASO DA NON ROVINARE: nessun rientro, lo stacco È il segnale.
    // Togliere i margini qui incollerebbe il romanzo in un blocco unico.
    await p.setContent(PAGINA("p { margin: 1em 0; }"));
    const primaC = await fra("u", "d");
    t.c("senza rientro non si tocca niente", !(await staccaVia()));
    t.eq("e lo stacco resta quello del libro", await fra("u", "d"), primaC);
    t.c("che è uno stacco vero", primaC > 8, `${primaC}px`);

    // un documento troppo corto — un frontespizio, una dedica — non dice
    // niente su come è impaginato il romanzo: non si decide
    await p.setContent(`<!doctype html><html><head><style>p{text-indent:1.2em}</style></head>
      <body><p id="u">Solo</p><p id="d">due righe</p></body></html>`);
    t.c("su due paragrafi non si decide", !(await staccaVia()));

    // e il foglio si scrive una volta sola: chiamarla due volte non deve
    // impilare fogli dentro il documento
    await p.setContent(PAGINA("p { text-indent: 1.2em; }"));
    await staccaVia();
    await staccaVia();
    t.eq(
      "il foglio non si impila",
      await p.evaluate(() => document.querySelectorAll("style[data-bc=stacco]").length),
      1
    );

    // I PARAGRAFI VUOTI NON VOTANO. Un ePub convertito ne lascia in giro
    // centocinquanta (le ancore delle pagine di carta), e il libro spesso
    // li veste con una classe che azzera il rientro. Se contassero nel
    // campione, affogherebbero i paragrafi veri e un libro rientrato non
    // verrebbe più riconosciuto — la cura non scatterebbe mai proprio sui
    // libri che ne hanno più bisogno.
    await p.setContent(`<!doctype html><html><head><style>
      p { text-indent: 1.2em; }
      .ancora { text-indent: 0; }
    </style></head><body>
      <p id="u">He sat back and beamed.</p>
      ${'<p class="ancora"><a></a></p>'.repeat(12)}
      <p id="d">The rest of the council exchanged glances.</p>
      <p>The Bursar scowled at him.</p>
      <p>The Archchancellor nodded.</p>
    </body></html>`);
    t.c("le ancore vuote non affogano i paragrafi veri", await staccaVia());
    t.eq("e lo stacco se ne va lo stesso", await fra("u", "d"), 0);

    // ---- GLI SPAZIATORI FITTI, misurati nel motore -------------------
    // Il libro del lettore metteva un <p>&nbsp;</p> dopo OGNI paragrafo:
    // trenta veri e trenta spaziatori da 24px, ed è lo stacco che si
    // vedeva sul tablet. La cura dei margini non li toccava, perché non
    // sono margini — sono paragrafi alti una riga.
    const CON = (quanti, spaziatori) => `<!doctype html><html><head><style>
      p { text-indent: 1.2em; margin: 0; }
    </style></head><body>${Array.from({ length: quanti }, (_, i) =>
      `<p id="p${i}">Paragrafo numero ${i}, con abbastanza parole da occupare una riga intera.</p>` +
      (i < spaziatori ? "<p>&#160;</p>" : "")
    ).join("")}</body></html>`;

    await p.setContent(CON(10, 10));
    const primaFitti = await fra("p0", "p1");
    t.c("con uno spaziatore per paragrafo lo stacco c'è", primaFitti > 8, `${primaFitti}px`);
    await staccaVia();
    t.eq("e la cura lo spegne", await fra("p0", "p1"), 0);

    // GLI STACCHI DI SCENA VERI SOPRAVVIVONO: in un romanzo sono una
    // decina ogni cento paragrafi, e lì il libro ha aperto una riga
    // apposta — spegnerli vorrebbe dire incollare due scene diverse
    await p.setContent(CON(10, 1));
    const scenaPrima = await fra("p0", "p1");
    await staccaVia();
    t.eq("uno stacco occasionale resta intatto", await fra("p0", "p1"), scenaPrima);
    t.c("ed è uno stacco vero", scenaPrima > 8, `${scenaPrima}px`);

    // e senza rientro non si tocca niente, come per i margini: lì lo
    // spaziatore è l'unico segnale di paragrafo che il libro ha
    await p.setContent(CON(10, 10).replace("text-indent: 1.2em;", ""));
    const senzaRientro = await fra("p0", "p1");
    t.c("senza rientro gli spaziatori non si toccano", !(await staccaVia()));
    t.eq("e restano com'erano", await fra("p0", "p1"), senzaRientro);

    // ---- I MARGINI MESSI DA UNA CLASSE, che il foglio non batte -------
    // Calibre veste ogni paragrafo con una classe, e una classe batte un
    // tag: la regola `p { margin: 0 }` perdeva, e lo stacco restava tutto.
    // È la seconda causa dello stacco che il lettore vedeva ancora.
    const CALIBRE = `<!doctype html><html><head><style>
      .calibre2 { text-indent: 1.2em; margin-top: 0.6em; margin-bottom: 0.6em; }
    </style></head><body>
      ${Array.from({ length: 8 }, (_, i) =>
        `<p class="calibre2" id="p${i}">Paragrafo ${i}, abbastanza lungo da occupare una riga.</p>`
      ).join("")}
      <p class="calibre2" id="segno">* * *</p>
      <p class="calibre2" id="dopo">La scena dopo il segno.</p>
    </body></html>`;

    await p.setContent(CALIBRE);
    const primaClasse = await fra("p0", "p1");
    t.c("i margini della classe ci sono", primaClasse > 5, `${primaClasse}px`);
    await staccaVia();
    t.eq("e adesso se ne vanno", await fra("p0", "p1"), 0);

    // MA IL SEGNO DI SCENA TIENE IL SUO SPAZIO: ha testo, quindi non è un
    // «vuoto», e da quando i margini si azzerano sull'elemento è l'unica
    // cosa che lo tiene staccato dalla prosa
    const attornoAlSegno = await fra("p7", "segno");
    t.c("«* * *» resta staccato dalla prosa", attornoAlSegno > 5, `${attornoAlSegno}px`);
    t.c("da tutt'e due i lati", (await fra("segno", "dopo")) > 5);

    t.c("niente documento, niente da fare", !togliStacco(null));
    t.c("e un documento senza vista nemmeno", !togliStacco({ querySelectorAll: () => [] }));

    // ---- L'ALTRA META': I PARAGRAFI STACCATI ---------------------------
    //
    // La strada opposta, chiesta dal lettore guardando un Pratchett: via il
    // rientro che il libro si porta dietro, e il respiro al suo posto. Il
    // rientro arriva da una CLASSE (`.calibre2 { text-indent: 1.2em }`),
    // che un foglio di stile senza `!important` non batte: per questo la
    // cura lavora sugli elementi, e questo è il controllo che lo prova.
    await p.setContent(CALIBRE);
    const rientroPrima = await stile("p0", "textIndent");
    t.c("il rientro del libro c'è", parseFloat(rientroPrima) > 5, rientroPrima);
    const quanti = await staccaParagrafiVia();
    t.c("la cura passa su tutti i paragrafi di prosa", quanti >= 8, `${quanti}`);
    t.eq("il rientro se ne va, malgrado la classe", await stile("p0", "textIndent"), "0px");
    // E IL RESPIRO ARRIVA INSIEME: senza rientro e senza stacco la prosa
    // diventerebbe un muro, perché non resterebbe nessun segnale di
    // paragrafo — la cura sarebbe peggio del difetto.
    const respiro = await fra("p0", "p1");
    t.c("e al suo posto c'è il respiro", respiro > 8, `${respiro}px`);
    // e il respiro è il NOSTRO, non quello che il libro aveva già: su un
    // libro coi margini azzerati — il caso del lettore — restare senza
    // vorrebbe dire un muro di testo
    const quantoRespiro = await p.evaluate(([q]) => {
      const el = document.createElement("p");
      el.style.marginTop = q;
      document.body.appendChild(el);
      const v = getComputedStyle(el).marginTop;
      el.remove();
      return v;
    }, [STACCO]);
    t.eq("ed è quello della cura, non quello del libro", await stile("p0", "marginTop"), quantoRespiro);
    // uno stacco solo fra due paragrafi: il margine di sotto è azzerato
    // apposta, o i due si sommerebbero
    t.eq("il margine di sotto resta a zero", await stile("p0", "marginBottom"), "0px");

    // il segno di scena non si tocca: un respiro attorno ce l'ha per
    // mestiere, e il rientro glielo lascia il libro
    t.c(
      "il segno di scena resta come il libro l'ha vestito",
      parseFloat(await stile("segno", "textIndent")) > 5,
      await stile("segno", "textIndent")
    );

    // e gli spaziatori restano spaziatori: sono la pausa fra due scene, e
    // un margine nostro addosso li trasformerebbe in un buco
    await p.setContent(`<!doctype html><html><body>
      <p id="q0">Un paragrafo vero, lungo abbastanza da valere una riga.</p>
      <p id="sp2">&nbsp;</p>
      <p id="q1">Un altro paragrafo vero, lungo abbastanza da valere una riga.</p>
    </body></html>`);
    const spazioPrima = await stile("sp2", "marginTop");
    await staccaParagrafiVia();
    t.eq("lo spaziatore resta com'era", await stile("sp2", "marginTop"), spazioPrima);
    t.eq("i paragrafi veri prendono lo stesso respiro", await stile("q1", "marginTop"), await stile("q0", "marginTop"));
    t.c("e il respiro non è zero", parseFloat(await stile("q0", "marginTop")) > 8);

    t.eq("niente documento, niente paragrafi staccati", staccaParagrafi(null), 0);
    t.eq("e un documento senza query nemmeno", staccaParagrafi({}), 0);

    // I 20px DI EPUB.JS DENTRO LA PAGINA. Li mette lui, in orizzontale,
    // e sono 40px di carta bianca per facciata che nessuno ha scelto: su
    // una colonna che non è multipla dell'altezza di riga valgono fino a
    // due righe di lettura (misurato). Si battono con `!important`,
    // perché epub.js li scrive in linea SENZA.
    await p.setContent(`<!doctype html><html><body><p id="uno">uno</p></body></html>`);
    await p.evaluate(() => {
      document.body.style.paddingTop = "20px";
      document.body.style.paddingBottom = "20px";
    });
    await p.addStyleTag({ content: inCss(contentStyles(BASE, "en")) });
    const pad = await p.evaluate(() => {
      const c = getComputedStyle(document.body);
      return [c.paddingTop, c.paddingBottom];
    });
    t.eq("il padding di epub.js perde sopra", pad[0], `${PAGINA_SU_GIU}px`);
    t.eq("e sotto", pad[1], `${PAGINA_SU_GIU}px`);
    // IN SCORRIMENTO NON SI TOCCA: lì epub.js usa l'asse verticale e quei
    // due valori sono metà del `column-gap`, un'altra cosa
    t.c(
      "in scorrimento il padding resta di epub.js",
      !("padding-top" in contentStyles({ ...BASE, flow: "scrolled" }, "en").body)
    );
    t.c(
      "e in paginato invece c'è",
      "padding-bottom" in contentStyles({ ...BASE, flow: "paginated" }, "en").body
    );

    // ---- LA SCENOGRAFIA SI SPEGNE ------------------------------------
    // L'Eric del lettore, convertito da un flipbook, dipinge un libro
    // finto (dorso, pile di pagine) dietro il testo di OGNI capitolo,
    // ancorato alla finestra. Il tema gli cambia solo il colore, e
    // un'immagine copre un colore. Qui si misura la cura — e soprattutto
    // le tre cose che NON deve toccare: il fregio piccolo, la tavola
    // statica nel flusso, la pagina senza testo dove l'immagine E' il
    // contenuto.
    const GIF = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
    const sorgenteScena = `
      const SCENA_COPRE = ${SCENA_COPRE};
      const SCENA_TESTO_MINIMO = ${SCENA_TESTO_MINIMO};
      return (${spegniScenografia.toString()});
    `;
    const spegniScena = () => p.evaluate(([src]) => new Function(src)()(document), [sorgenteScena]);
    const PROSA = Array.from({ length: 8 }, (_, i) =>
      `<p>Riga di prosa numero ${i}: il Bibliotecario dondolava fresco nel vapore gelido sopra i libri erotici.</p>`
    ).join("");
    await p.setContent(`<!doctype html><html><head><style>
      #scena { position: fixed; inset: 0; background: #d8c8a8 url(${GIF}) center / cover no-repeat; z-index: -1; }
      #fregio { height: 32px; background: url(${GIF}) center no-repeat; }
      #murale { background: url(${GIF}); min-height: 100vh; }
    </style></head><body>
      <div id="scena"></div>
      <img id="volante" src="${GIF}" style="position:absolute;inset:0;width:100%;height:100%">
      <div id="murale">${PROSA}</div>
      <div id="fregio"></div>
      <p><img id="tavola" src="${GIF}" style="width:200px;height:850px"></p>
    </body></html>`);
    const scene = await spegniScena();
    t.c("qualcosa si e' spento", scene >= 3, `${scene}`);
    t.eq("la scena fissa non dipinge piu'", await stile("scena", "backgroundImage"), "none");
    t.eq("nemmeno la sua carta cotta nell'immagine",
      await stile("scena", "backgroundColor"), "rgba(0, 0, 0, 0)");
    t.eq("il murale dietro la prosa nemmeno", await stile("murale", "backgroundImage"), "none");
    t.eq("la figura volante si spegne", await stile("volante", "visibility"), "hidden");
    t.c("ma il fregio piccolo resta", (await stile("fregio", "backgroundImage")).includes("url"));
    t.eq("e la tavola nel flusso resta visibile", await stile("tavola", "visibility"), "visible");

    // la pagina SENZA testo — copertina, frontespizio illustrato — non si
    // tocca: li' l'immagine e' il contenuto
    await p.setContent(`<!doctype html><html><head><style>
      #cop { position: fixed; inset: 0; background: url(${GIF}) center / cover no-repeat; }
    </style></head><body><div id="cop"></div><p>Eric</p></body></html>`);
    t.eq("sulla pagina di sola immagine non si spegne niente", await spegniScena(), 0);
    t.c("e la copertina dipinta resta", (await stile("cop", "backgroundImage")).includes("url"));
  } finally {
    await browser.close();
  }
}
