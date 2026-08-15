// Le due cose che il reader fa al CONTENUTO del libro, tenute fuori da
// Reader.jsx perche' non hanno un grammo di JSX: cosi' si provano da sole,
// senza montare un reader intero (`test/tema.test.mjs`).
import { READER_THEMES, READER_FONTS } from "./readerSettings.js";

// I PARAGRAFI SENZA TESTO NON SONO PARAGRAFI, e il browser non lo sa.
//
// Un ePub convertito lascia in giro le ancore delle pagine di carta —
// `<p><a class="calibre3"></a></p>`, centocinquanta volte in un romanzo
// (contate su Guards! Guards!). Non hanno testo, ma sono `<p>`, e il libro
// non li veste con nessuna classe: entra allora il foglio del BROWSER, che
// ai paragrafi da' `margin: 1em 0`, e in mezzo a una scena si apre una
// riga bianca. Non e' il nostro tema (misurato: identico con e senza), e'
// che non normalizzavamo niente. Gli altri reader normalizzano, ed e' per
// questo che da loro lo stacco non c'e'.
//
// Si fa QUI e non in CSS perche' il CSS non sa dire «senza testo»:
// `p:has(> a:only-child:empty)` guarda i figli elemento e ignora il testo,
// quindi prende anche la battuta vera che si porta dietro un'ancora, e la
// schiaccia. Qui invece il testo si legge.
//
// Tre cose restano intoccabili: il paragrafo con testo, quello con dentro
// un'immagine, e lo stacco di scena voluto dal libro — che si riconosce
// perche' contiene uno spazio unificatore o un `<br>`, cioe' qualcuno ce
// l'ha messo apposta per aprire una riga.
export function spegniVuoti(doc) {
  if (!doc) return 0;
  let spenti = 0;
  for (const p of doc.querySelectorAll("p")) {
    const testo = p.textContent || "";
    // lo spazio unificatore si scrive per codice: a occhio, nel sorgente,
    // e' identico a uno spazio normale e la regola sembrerebbe assurda
    if (testo.includes("\u00a0") || p.querySelector("br")) continue;
    if (testo.trim()) continue;
    if (p.querySelector("img, svg, video, canvas, object, iframe")) continue;
    p.style.margin = "0";
    p.style.lineHeight = "0";
    spenti += 1;
  }
  return spenti;
}

export function contentStyles(s, lingua) {
  const t = READER_THEMES[s.theme];
  const font = READER_FONTS.find((f) => f.id === s.font)?.css;
  // L'INCHIOSTRO E' QUELLO DEL TEMA, SENZA ECCEZIONI.
  //
  // Prima si elencavano gli elementi da ricolorare, e chi non era in elenco
  // teneva il colore dell'editore: il primo paragrafo di un capitolo, un
  // <font> di un vecchio EPUB, una didascalia, una lettera capitale. Su
  // pergamena si notava appena; sul tema notte quel testo restava nero su
  // nero. Un elenco di tag e' una partita a rincorrere: qui si dice «tutto
  // quello che sta nel corpo», e i collegamenti si riprendono il loro colore
  // subito dopo (stessa specificita', vince la regola che arriva dopo).
  //
  // MA L'INCHIOSTRO SI', L'INTERLINEA NO. Il colore su ogni elemento non
  // sposta niente; l'interlinea si'. Molti ePub fanno gli stacchi con un
  // paragrafo spaziatore a `line-height: 0`, e riportarglielo a interlinea
  // piena trasforma un capello in una riga bianca in mezzo a una scena
  // (misurato: +24px, ed e' lo stacco che il lettore vedeva da noi e non
  // negli altri reader, che l'interlinea non la forzano su tutto).
  //
  // L'interlinea sta quindi su `body`, da cui tutto eredita, e sulla prosa
  // — e sulla prosa **senza `!important`**, che e' l'altra meta' della
  // cura: lo spaziatore e' quasi sempre un `<p>`, quindi una regola sulla
  // prosa lo riprenderebbe comunque. Senza `!important` la gara la decide
  // la specificita': il `p { line-height }` del libro perde perche' il
  // nostro foglio arriva dopo — ed e' il caso comune, la levetta continua
  // a comandare — mentre `.sp { line-height: 0 }` vince, perche' una
  // classe batte un tag. Ed e' giusto: quella classe e' uno spaziatore
  // voluto. Il prezzo, accettato: anche `.chapter p { line-height: 1.1 }`
  // vince li' sulla levetta.
  const textSel = "body *";
  // La colonna giustificata si prende solo la prosa. Non `div`, che spesso
  // avvolge anche i titoli: quelli il libro li centra o li allinea a modo
  // suo, e giustificarli e' il modo piu' rapido di far sembrare rotta una
  // pagina impaginata bene.
  const proseSel = "p, li, dd, blockquote";
  const rules = {
    html: { background: `${t.bg} !important` },
    body: {
      background: `${t.bg} !important`,
      color: `${t.fg} !important`,
      "line-height": `${s.lineHeight} !important`,
    },
    [textSel]: {
      color: `${t.fg} !important`,
    },
    [proseSel]: {
      "line-height": `${s.lineHeight}`,
    },
    "h1, h2, h3, h4, h5, h6": { color: `${t.fg} !important` },
    "a, a *": { color: `${t.link} !important` },
    img: { "max-width": "100% !important" },
    // I PARAGRAFI VUOTI NON SONO PARAGRAFI, e il browser non lo sa.
    //
    // Un ePub convertito lascia in giro le ancore delle pagine di carta:
    // `<p><a class="calibre3"></a></p>`, centocinquantacinque volte in un
    // solo romanzo (misurato su Guards! Guards!). Non hanno testo, ma sono
    // `<p>`, e il libro non li veste con nessuna classe: entra allora il
    // foglio di stile del BROWSER, che ai paragrafi da' `margin: 1em 0` —
    // 16px di riga bianca in mezzo a una scena. Non e' colpa del nostro
    // tema (misurato: identico con e senza), e' che non normalizzavamo
    // niente e il default passava. Gli altri reader normalizzano, ed e'
    // per questo che da loro lo stacco non si vede.
    //
    // Si azzerano SOLO i paragrafi senza testo, mai i paragrafi veri: un
    // libro che separa la prosa con i margini invece che col rientro deve
    // continuare a farlo. E si azzerano i margini, non `display: none`,
    // perche' quelle ancore possono essere il bersaglio di un rimando e
    // devono restare raggiungibili.
    // Qui sta solo il caso che il CSS sa dire davvero: un `<p>` senza
    // NIENTE dentro. Tutto il resto — l'ancora vuota dentro un paragrafo
    // altrimenti vuoto — lo fa `spegniVuoti` a mano, perche' il CSS non
    // sa distinguere «paragrafo senza testo» da «paragrafo con testo che
    // contiene anche un'ancora vuota»: `p:has(> a:only-child:empty)`
    // prende tutti e due, e sul secondo schiaccia una battuta vera (130
    // paragrafi rovinati in questo libro, presi da un test e non dalla
    // lettura del diff).
    "p:empty": { margin: "0", "line-height": "0" },
  };
  if (font) {
    rules.body["font-family"] = `${font} !important`;
    rules[textSel]["font-family"] = `${font} !important`;
    rules["h1, h2, h3, h4, h5, h6"]["font-family"] = `${font} !important`;
  }
  // GIUSTIFICATO E SILLABATO, o nessuno dei due.
  //
  // Giustificare senza poter spezzare le parole apre fiumi di bianco fra
  // una parola e l'altra: su una colonna stretta da tablet e' peggio del
  // bordo frastagliato che voleva togliere. E il browser sa sillabare solo
  // se sa in che lingua sta leggendo — se il libro non lo dichiara, qui non
  // si tocca niente e il pannello lo spiega.
  // Spenta, la levetta deve dire ESPLICITAMENTE «a bandiera», non limitarsi
  // a togliere la regola: epub.js accoda al foglio di stile del capitolo e
  // non lo ripulisce mai, quindi una regola tolta resta scritta e continua a
  // valere finche' il libro non viene rifatto da capo. Le regole che
  // arrivano dopo vincono, quelle che spariscono no.
  if (lingua) {
    // si AGGIUNGE alla prosa, non si riscrive: li' c'e' gia' l'interlinea,
    // e un `=` la porterebbe via insieme alla levetta che la governa
    Object.assign(rules[proseSel], s.justify
      ? {
          "text-align": "justify !important",
          hyphens: "auto !important",
          "-webkit-hyphens": "auto !important",
          // mai spezzare dopo due lettere: sono le sillabazioni che si notano
          "hyphenate-limit-chars": "6 3 3",
        }
      : {
          // `start`, non `left`: cosi' regge anche un libro che si legge
          // da destra
          "text-align": "start !important",
          hyphens: "manual !important",
          "-webkit-hyphens": "manual !important",
        });
  }
  return rules;
}
