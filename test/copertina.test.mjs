// La misura della copertina rimessa a mano. E' l'unico pezzo di
// `copertina.js` che si puo' provare senza un canvas, ed e' anche l'unico
// dove si sbaglia in silenzio: una copertina schiacciata si nota subito,
// ma un errore di un pixel no.
import { misura, LATO, copertinaDaEpub, primaImmagine, risolviAccanto } from "../src/lib/copertina.js";

const rapporto = (m) => m.w / m.h;

export default async function (t) {
  // ---- si rimpicciolisce, e il lato lungo comanda -----------------------
  const alta = misura(1200, 1800);
  t.eq("il lato lungo arriva al tetto", alta.h, LATO);
  t.c("e l'altro scende con lui", alta.w === Math.round(1200 * (LATO / 1800)), String(alta.w));
  const larga = misura(2400, 1000);
  t.eq("vale anche per un'immagine sdraiata", larga.w, LATO);

  // ---- LE PROPORZIONI NON SI TOCCANO MAI --------------------------------
  for (const [w, h] of [[1200, 1800], [2400, 1000], [1000, 1000], [3000, 4000], [901, 1301]]) {
    const m = misura(w, h);
    t.c(
      `${w}×${h} tiene le proporzioni`,
      Math.abs(rapporto(m) - w / h) < 0.01,
      `${m.w}×${m.h} → ${rapporto(m).toFixed(3)} invece di ${(w / h).toFixed(3)}`
    );
  }

  // ---- un'immagine gia' piccola non si gonfia ---------------------------
  // ingrandirla non aggiunge dettaglio, aggiunge solo byte
  const piccola = misura(300, 450);
  t.eq("la larghezza resta la sua", piccola.w, 300);
  t.eq("e l'altezza pure", piccola.h, 450);
  t.eq("nemmeno esattamente al tetto", misura(LATO, LATO).w, LATO);

  // ---- mai un lato a zero ------------------------------------------------
  // un canvas largo zero non disegna niente, e la copertina sparirebbe
  // 4000×1 rimpicciolita di cinque volte darebbe un'altezza di 0,2px, che
  // arrotondata e' ZERO: senza la guardia il canvas sarebbe alto niente
  const striscia = misura(4000, 1);
  t.c("un lato sottilissimo resta almeno uno", striscia.h >= 1, `${striscia.w}×${striscia.h}`);
  t.eq("e il lato lungo e' quello giusto", striscia.w, LATO);

  // ---- quello che non e' una misura -------------------------------------
  t.eq("larghezza zero", misura(0, 100), null);
  t.eq("altezza negativa", misura(100, -5), null);
  t.eq("non numeri", misura(NaN, 100), null);
  t.eq("niente del tutto", misura(), null);
  // un tetto assurdo non deve azzerare l'immagine: meglio tenerla com'e'
  t.eq("un tetto a zero lascia stare", misura(1200, 1800, 0).h, 1800);

  // ---- LA COPERTINA DENTRO L'ePub ---------------------------------------
  // `copertinaDaEpub` prende un libro GIA' aperto, quindi qui basta un
  // finto: le due strade, il ripiego e la chiusura si provano tutte senza
  // tirarsi dietro epub.js e un romanzo vero.
  const DENTRO = { finto: "dai byte dell'archivio" };
  const DA_URL = { finto: "scaricata dall'url" };
  globalThis.fetch = async () => ({ blob: async () => DA_URL });

  const libro = (opts = {}) => {
    const eb = {
      chiuso: false,
      loaded: { cover: opts.percorso ?? null, spine: Promise.resolve() },
      spine: { items: opts.spina ?? [] },
      archive:
        opts.archivio === false
          ? null
          : {
              getBlob: async (dove) =>
                opts.dentro ? opts.dentro[dove] ?? null : opts.blob ?? null,
              getText: async (dove) => (opts.pagine ? opts.pagine[dove] ?? null : null),
            },
      coverUrl: async () => opts.url ?? null,
      destroy() {
        eb.chiuso = true;
      },
    };
    return eb;
  };

  // la strada normale: il percorso c'è e l'archivio lo consegna
  let eb = libro({ percorso: "OEBPS/cover.jpg", blob: DENTRO });
  t.c("la copertina viene dall'archivio", (await copertinaDaEpub(eb)) === DENTRO);
  t.c("e il libro si chiude", eb.chiuso);

  // il ripiego: nessun percorso dichiarato, ma `coverUrl` risponde
  eb = libro({ url: "blob:qualcosa" });
  t.c("senza percorso si ripiega su coverUrl", (await copertinaDaEpub(eb)) === DA_URL);

  // percorso dichiarato ma archivio muto: si ripiega lo stesso, non ci si
  // ferma — è un ePub scritto male, non un ePub senza copertina
  eb = libro({ percorso: "OEBPS/cover.jpg", blob: null, url: "blob:qualcosa" });
  t.c("un archivio che tace non blocca il ripiego", (await copertinaDaEpub(eb)) === DA_URL);

  // il libro che una copertina non ce l'ha davvero: `null`, e allora il
  // dorso disegnato è lo stato di partenza
  eb = libro({});
  t.eq("nessuna copertina, nessun ripiego", await copertinaDaEpub(eb), null);
  t.c("e si chiude comunque", eb.chiuso);

  // UNA STRADA CHE ESPLODE NON SI PORTA VIA LE ALTRE. Prima le tre stavano
  // sotto un `try` solo: un archivio rotto sulla PRIMA strada faceva uscire
  // l'errore, e il ripiego — che avrebbe funzionato — non veniva nemmeno
  // provato. Il lettore si ritrovava il libro col titolo giusto e il dorso
  // disegnato, senza che niente lo dicesse.
  eb = libro({ percorso: "x", url: "blob:qualcosa" });
  const rotto = {
    getBlob: async () => {
      throw new Error("archivio rotto");
    },
    getText: async () => null,
  };
  eb.archive = rotto;
  t.c("un archivio rotto lascia lavorare il ripiego", (await copertinaDaEpub(eb)) === DA_URL);
  t.c("e il libro è stato chiuso lo stesso", eb.chiuso);
  // rotto e senza ripiego: `null`, mai un'eccezione in faccia alla scheda
  eb = libro({ percorso: "x" });
  eb.archive = rotto;
  t.eq("rotto e senza ripiego non esplode", await copertinaDaEpub(eb), null);
  t.c("e si chiude anche lì", eb.chiuso);

  t.eq("niente libro, niente copertina", await copertinaDaEpub(null), null);
  // un finto senza i metodi non deve buttare giù la scheda
  t.eq("un libro monco non esplode", await copertinaDaEpub({}), null);

  // ---- LA TERZA STRADA: LA PAGINA DI COPERTINA --------------------------
  // Misurato in un browser vero su due ePub costruiti apposta: un file che
  // NON dichiara la copertina nei metadati fa fallire tutt'e due le strade
  // di prima (`loaded.cover` non torna niente, `coverUrl()` torna null)
  // mentre titolo e autore si leggono benissimo. È esattamente quello che
  // il lettore ha visto sull'Eresia. Ma l'immagine c'è: è nella prima
  // pagina della spina, che è proprio la copertina.
  const DA_PAGINA = { finto: "presa dalla pagina di copertina" };
  eb = libro({
    spina: [{ href: "cover.xhtml", canonical: "/OEBPS/cover.xhtml" }],
    pagine: { "/OEBPS/cover.xhtml": `<body><img src="images/cover.jpg" alt=""/></body>` },
    dentro: { "/OEBPS/images/cover.jpg": DA_PAGINA },
  });
  t.c("niente metadati, ma la pagina ce l'ha", (await copertinaDaEpub(eb)) === DA_PAGINA);
  t.c("e il libro si chiude", eb.chiuso);

  // l'ePub che la copertina la mette in un SVG a tutta pagina: sono tanti,
  // e lì non c'è nessun `<img>` da trovare
  eb = libro({
    spina: [{ href: "titlepage.xhtml", canonical: "/OEBPS/titlepage.xhtml" }],
    pagine: {
      "/OEBPS/titlepage.xhtml": `<svg viewBox="0 0 600 900"><image xlink:href="cover.jpeg" width="600"/></svg>`,
    },
    dentro: { "/OEBPS/cover.jpeg": DA_PAGINA },
  });
  t.c("anche dentro un SVG", (await copertinaDaEpub(eb)) === DA_PAGINA);

  // CHI SI CHIAMA «cover» HA LA PRECEDENZA: è la stessa pagina, ma detta.
  // Senza l'ordine si prenderebbe il logo dell'editore del frontespizio.
  const LOGO = { finto: "il logo dell'editore" };
  eb = libro({
    spina: [
      { href: "frontespizio.xhtml", canonical: "/f.xhtml" },
      { href: "cover.xhtml", canonical: "/c.xhtml" },
    ],
    pagine: {
      "/f.xhtml": `<p><img src="logo.png"/></p>`,
      "/c.xhtml": `<p><img src="vera.jpg"/></p>`,
    },
    dentro: { "/logo.png": LOGO, "/vera.jpg": DA_PAGINA },
  });
  t.c("la pagina che si chiama copertina viene prima", (await copertinaDaEpub(eb)) === DA_PAGINA);

  // una pagina che l'immagine non ce l'ha non ferma il giro: si guarda la
  // prossima, sempre restando in testa al libro
  eb = libro({
    spina: [
      { href: "a.xhtml", canonical: "/a.xhtml" },
      { href: "b.xhtml", canonical: "/b.xhtml" },
    ],
    pagine: { "/a.xhtml": `<p>Solo parole.</p>`, "/b.xhtml": `<p><img src="x.jpg"/></p>` },
    dentro: { "/x.jpg": DA_PAGINA },
  });
  t.c("una pagina senza immagini non ferma il giro", (await copertinaDaEpub(eb)) === DA_PAGINA);

  // e un romanzo che comincia col testo resta senza: il dorso disegnato è
  // lo stato di partenza, non un guasto
  eb = libro({
    spina: [{ href: "cap1.xhtml", canonical: "/cap1.xhtml" }],
    pagine: { "/cap1.xhtml": `<h1>Capitolo primo</h1><p>Era una notte buia.</p>` },
  });
  t.eq("un libro che comincia col testo resta senza", await copertinaDaEpub(eb), null);

  // ---- LA PRIMA IMMAGINE DI UNA PAGINA ----------------------------------
  t.eq("un `img` normale", primaImmagine(`<p><img src="c.jpg"/></p>`), "c.jpg");
  t.eq("con gli apici singoli", primaImmagine(`<img src='c.jpg'>`), "c.jpg");
  t.eq("e con altri attributi davanti", primaImmagine(`<img alt="x" class="y" src="c.jpg">`), "c.jpg");
  t.eq("lo spazio attorno all'uguale", primaImmagine(`<img src = "c.jpg">`), "c.jpg");
  t.eq("l'`image` di un SVG", primaImmagine(`<image xlink:href="c.jpg"/>`), "c.jpg");
  t.eq("anche senza il prefisso", primaImmagine(`<image href="c.jpg"/>`), "c.jpg");
  // l'`img` ha la precedenza sull'`image`: se ci sono tutt'e due, quella
  // vera è la prima
  t.eq("l'`img` viene prima", primaImmagine(`<img src="a.jpg"><image href="b.jpg"/>`), "a.jpg");
  t.eq("una pagina di solo testo", primaImmagine(`<p>niente</p>`), null);
  t.eq("niente pagina", primaImmagine(null), null);
  // UN ATTRIBUTO CHE FINISCE PER «src» NON È `src`: gli ePub convertiti
  // mettono spesso un segnaposto in `data-src`, e senza lo spazio davanti
  // sarebbe quello a vincere — la copertina diventerebbe l'immagine vuota
  // che sta lì solo ad aspettare
  t.eq(
    "un `data-src` non ruba il posto",
    primaImmagine(`<img data-src="segnaposto.gif" src="vera.jpg">`),
    "vera.jpg"
  );

  // ---- IL PERCORSO È RELATIVO AL DOCUMENTO ------------------------------
  t.eq("accanto al documento", risolviAccanto("/OEBPS/cover.xhtml", "images/c.jpg"), "/OEBPS/images/c.jpg");
  t.eq("un piano più su", risolviAccanto("/OEBPS/text/cover.xhtml", "../images/c.jpg"), "/OEBPS/images/c.jpg");
  t.eq("il punto non è una cartella", risolviAccanto("/OEBPS/cover.xhtml", "./c.jpg"), "/OEBPS/c.jpg");
  t.eq("un percorso già assoluto resta com'è", risolviAccanto("/OEBPS/cover.xhtml", "/altro/c.jpg"), "/altro/c.jpg");
  // quello che nell'archivio non c'è: un'immagine presa dalla rete o
  // scritta dentro la pagina non si va a cercare fra i file
  t.eq("un indirizzo in rete", risolviAccanto("/c.xhtml", "https://esempio/c.jpg"), null);
  t.eq("un'immagine scritta dentro", risolviAccanto("/c.xhtml", "data:image/png;base64,AAA"), null);
  t.eq("niente da risolvere", risolviAccanto("/c.xhtml", ""), null);
  t.eq("e niente documento", risolviAccanto(null, "c.jpg"), "c.jpg");
}
