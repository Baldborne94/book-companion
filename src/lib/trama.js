import { getFile } from "./bookStore.js";
import { pageText } from "./pdfSearch.js";
import { chiedi, getOracleKey, TETTO_SCHEDA } from "./oracle.js";
import { frontiera } from "./frontiera.js";

// «DOVE ERAVAMO RIMASTI» — la storia fin qui, e non una riga oltre.
//
// Riprendi un libro dopo tre settimane e non ti serve sapere chi è un
// personaggio: ti serve sapere cosa stava succedendo. È la stessa promessa
// della scheda di un personaggio, con la stessa difesa — al modello arriva
// solo quello che sta dentro la frontiera di lettura — ma raccolta al
// contrario: qui non si cerca un nome, si campiona la storia.
//
// Si chiede col dito, mai da sola all'apertura del libro. Un riassunto che
// parte da solo ogni volta che apri il tomo è una chiamata sprecata nove
// volte su dieci, ed è anche un'invadenza: chi sa benissimo dov'era rimasto
// vuole solo leggere.

// Sotto questa misura sono titoletti e monosillabi. La soglia sta bassa
// apposta: in un romanzo dialogato quasi ogni riga e' corta, e alzarla
// svuoterebbe proprio la coda — cioe' la scena che avevi sotto gli occhi.
const MIN_PARAGRAFO = 60;
const PARAGRAFO = 480;
// quanti paragrafi si tengono in mano per volume prima di diradare
const TETTO = 300;
// la finestra di coda resta a densità piena: è il «dove eri rimasto», e va
// letta di fila come una scena, non a campione
const CODA = 60;

const DA_APERTURA = 4;
const DA_CORPO = 8;
const DA_CODA = 12;
const DA_PRIMA = 6;
const APERTURA = 0.2;
// quanti paragrafi bastano per dire «siamo dentro la storia»: prima di
// questi, un titolo tipo «Indice» o «Copyright» e' materiale di TESTA e si
// salta; dopo, e' il materiale di coda e la storia e' finita li'
const DENTRO_LA_STORIA = 30;

const SISTEMA = [
  "Sei l'Oracolo di un'app di lettura. Il lettore riprende un libro dopo",
  "averlo lasciato lì per un po' e ti chiede dove eravamo rimasti. Gli mostri",
  "dei passaggi presi da quello che ha letto FINORA, in ordine di lettura.",
  "REGOLA ASSOLUTA: racconta soltanto ciò che si ricava da quei passaggi.",
  "Non usare nulla che sai di questo libro o di questa saga da altre fonti:",
  "quel che sai potrebbe venire da pagine che non ha ancora letto, e",
  "rovinargliele. Non anticipare MAI cosa succederà, nemmeno per accennarlo.",
  "LINGUA: scrivi SEMPRE IN ITALIANO, anche quando i passaggi sono in",
  "un'altra lingua — la scheda è parte di un'app italiana. Nomi di persone",
  "e di luoghi restano come stanno nei passaggi, senza tradurli. Scrivi un",
  "italiano curato e naturale, da lettore che racconta.",
  "FORMA: prosa, non un elenco. Due paragrafi brevi separati da una riga",
  "vuota, testo puro senza markdown, senza titoletti.",
  "Il primo paragrafo è la storia fin qui: da dove è partita, chi ci si muove",
  "dentro, cosa è successo di importante, come si è arrivati al punto in cui",
  "il lettore si è fermato.",
  "Il secondo paragrafo è dove si è fermato: la scena che aveva sotto gli",
  "occhi, chi c'era, cosa stava per succedere. Chiudilo lì, sulla soglia,",
  "senza dire una parola di quello che viene dopo.",
  "Se i passaggi non bastano a ricostruire il filo, dillo in una riga invece",
  "di inventare.",
].join(" ");

// Un paragrafo per volta, e la lista non cresce all'infinito: quando supera
// il tetto si dirada tenendo uno su due. Il passo raddoppia, la copertura
// resta distesa su tutto il letto, e la memoria non se ne accorge.
function nuovaRaccolta() {
  // `esteso` = quanto testo si e' scorso davvero: e' la misura del volume,
  // e serve a capire quanti LIBRI tiene dentro un file solo
  return { corpo: [], coda: [], passo: 1, visti: 0, esteso: 0 };
}

function raccogli(r, testo) {
  const t = String(testo || "").replace(/\s+/g, " ").trim();
  if (t.length < MIN_PARAGRAFO) return;
  r.esteso += t.length;
  const pezzo = t.length > PARAGRAFO ? `${t.slice(0, PARAGRAFO)}…` : t;
  r.coda.push(pezzo);
  if (r.coda.length > CODA) r.coda.shift();
  if (r.visti++ % r.passo === 0) r.corpo.push(pezzo);
  if (r.corpo.length > TETTO) {
    r.corpo = r.corpo.filter((_, i) => i % 2 === 0);
    r.passo *= 2;
  }
}

// il paragrafo sta oltre il segno? Un paragrafo che non sa dire dove si trova
// si considera oltre: nel dubbio si taglia, perche' qui l'errore per
// generosita' e' uno spoiler.
function oltre(doc, item, cfi, el, fino) {
  try {
    const range = doc.createRange();
    range.selectNodeContents(el);
    return cfi.compare(item.cfiFromRange(range), fino) > 0;
  } catch {
    return true;
  }
}

// LE ULTIME PAGINE DEL FILE NON SONO IL FINALE DELLA STORIA.
//
// In fondo a un romanzo ci sono l'elenco dei personaggi, i ringraziamenti,
// l'appendice, l'estratto del prossimo volume. La coda si prende dal
// FONDO del testo, e su un libro finito finiva dritta lì dentro: alla
// domanda «come si è chiuso?» la scheda rispondeva «le ultime pagine che
// ho sono un elenco di personaggi» (segnalato dal lettore). Da un elenco
// di nomi non si ricava una scena.
//
// Si riconosce dal titolo del documento o dalla sua prima intestazione:
// quando comincia il materiale di contorno, la storia è finita lì.
const CONTORNO =
  /^\s*(dramatis\s+personae|cast\s+of\s+characters|personaggi|acknowledge?ments?|ringraziamenti|appendix|appendice|glossary|glossario|about\s+the\s+author|l['’]autore|nota\s+dell['’]autore|author['’]s\s+note|note\s+dell['’]editore|extract|estratto|anteprima|excerpt|also\s+by|dello\s+stesso\s+autore|copyright|indice|contents|table\s+of\s+contents|bibliograf)/i;

function eContorno(doc) {
  const titolo = doc?.title || "";
  const testa = doc?.querySelector?.("h1, h2, h3, h4")?.textContent || "";
  return CONTORNO.test(titolo.trim()) || CONTORNO.test(testa.trim());
}

async function tramaDaEpub(libro, fino) {
  const blob = await getFile(libro.id);
  if (!blob) return null;
  const { default: ePub } = await import("epubjs");
  const eb = ePub(await blob.arrayBuffer());
  const r = nuovaRaccolta();
  let finito = false;
  try {
    await eb.ready;
    const cfi = new ePub.CFI();
    const spina = eb.spine.spineItems;
    for (let i = 0; i < spina.length && !finito; i++) {
      const item = spina[i];
      if (fino) {
        try {
          if (cfi.compare(`epubcfi(${item.cfiBase}!/0)`, fino) > 0) break;
        } catch { /* base illeggibile: si scorre e si filtra dopo */ }
      }
      // Il CFI di ogni paragrafo costa: si paga SOLO nel capitolo dove sta il
      // segno, cioe' quello dopo il quale la spina esce dalla frontiera. Negli
      // altri il capitolo intero e' dietro al segno e non c'e' niente da
      // tagliare — e sono quasi tutti.
      let taglia = false;
      if (fino) {
        const dopo = spina[i + 1];
        try {
          taglia = !dopo || cfi.compare(`epubcfi(${dopo.cfiBase}!/0)`, fino) > 0;
        } catch {
          taglia = true;
        }
      }
      try {
        await item.load(eb.load.bind(eb));
        const doc = item.document;
        // Il materiale di contorno chiude la storia: da lì in poi non è
        // più romanzo, e la coda deve fermarsi prima. Ma le stesse parole
        // stanno anche in TESTA a un libro — indice, copyright, «dello
        // stesso autore» — e fermarsi lì vorrebbe dire non raccogliere
        // niente: in apertura si salta e si tira dritto, in fondo si
        // chiude.
        if (eContorno(doc)) {
          if (r.corpo.length >= DENTRO_LA_STORIA) {
            finito = true;
          }
          continue;
        }
        if (doc?.body) {
          for (const el of doc.querySelectorAll("p, blockquote, dd")) {
            if (taglia && oltre(doc, item, cfi, el, fino)) break;
            raccogli(r, el.textContent);
          }
        }
      } catch { /* capitolo illeggibile: gli altri bastano */ } finally {
        try { item.unload(); } catch { /* gia' scaricato */ }
      }
    }
  } finally {
    try { eb.destroy(); } catch { /* gia' chiuso */ }
  }
  return r;
}

async function tramaDaPdf(libro, fino) {
  const blob = await getFile(libro.id);
  if (!blob) return null;
  const mod = await import("./pdfThumb.js");
  const pdf = await mod.loadPdf(await blob.arrayBuffer());
  const r = nuovaRaccolta();
  try {
    const limite = fino ? Math.min(parseInt(fino, 10) || pdf.numPages, pdf.numPages) : pdf.numPages;
    const cache = new Map();
    for (let n = 1; n <= limite; n++) {
      try {
        // nei PDF non c'e' un paragrafo: la pagina e' l'unita' piu' piccola
        // di cui si conosca con certezza il posto nella lettura
        raccogli(r, await pageText(pdf, n, cache));
      } catch { /* pagina illeggibile: le altre bastano */ }
    }
  } finally {
    try { pdf.destroy(); } catch { /* gia' chiuso */ }
  }
  return r;
}

// Come nella scheda personaggio: un tomo che non e' su questo dispositivo
// non si legge, e non dirlo significa dichiarare nella provenienza un
// volume che nessuno ha aperto.
export async function raccogliTrama(tappe, { vivo } = {}) {
  const attivo = vivo || (() => true);
  const out = [];
  const lontani = [];
  for (const t of tappe) {
    if (!attivo()) break;
    try {
      const fino = t.tutto ? null : t.fino;
      const r =
        t.libro.fileType === "pdf" ? await tramaDaPdf(t.libro, fino) : await tramaDaEpub(t.libro, fino);
      if (r) out.push({ libro: t.libro, ...r });
      else lontani.push(t.libro);
    } catch {
      /* tomo che non si apre: gli altri bastano */
      lontani.push(t.libro);
    }
  }
  return { raccolto: out, lontani };
}

function sparsi(lista, n) {
  if (n <= 0 || !lista.length) return [];
  if (lista.length <= n) return lista;
  if (n === 1) return [lista[0]];
  const passo = (lista.length - 1) / (n - 1);
  return [...new Set(Array.from({ length: n }, (_, i) => lista[Math.round(passo * i)]))];
}

// I volumi precedenti sono lo sfondo: quanto basta a non partire per aria.
// Il volume aperto e' la storia, e la sua coda e' il motivo per cui hai
// chiesto — quella si prende di fila, non a campione.
export function scegliTrama(raccolto) {
  if (!raccolto.length) return [];
  const qui = raccolto[raccolto.length - 1];
  const prima = raccolto.slice(0, -1);
  const fuori = sparsi(prima.flatMap((r) => r.corpo), DA_PRIMA).map((testo) => ({
    testo,
    quando: "prima",
  }));
  const coda = qui.coda.slice(-DA_CODA);
  // la coda sta gia' dentro il corpo: senza toglierla, le ultime scene
  // arriverebbero due volte e mangerebbero i posti dell'inizio
  const corpo = qui.corpo.filter((t) => !coda.includes(t));
  const taglio = Math.max(DA_APERTURA, Math.round(corpo.length * APERTURA));
  const scelti = [
    ...sparsi(corpo.slice(0, taglio), DA_APERTURA),
    ...sparsi(corpo.slice(taglio), DA_CORPO),
  ];
  return [
    ...fuori,
    ...scelti.map((testo) => ({ testo, quando: "qui" })),
    ...coda.map((testo) => ({ testo, quando: "coda" })),
  ];
}

// Il giro intero, uguale per i due reader: cambia solo da dove arriva il
// segno vivo. `passo` racconta a che punto è, `vivo` permette di fermarlo.
export async function schedaRiassunto({ book, libri, statusOf, cfiOf, vivo, passo }) {
  const tappe = frontiera(book, libri, { statusOf, cfiOf });
  passo({ fase: "cerco", tappe });
  const { raccolto, lontani } = await raccogliTrama(tappe, { vivo });
  const scelti = scegliTrama(raccolto);
  if (!vivo()) return null;
  if (!scelti.length) return { fase: "vuoto", tappe, lontani, passaggi: [] };
  passo({ fase: "chiedo", tappe, lontani, passaggi: scelti });
  const res = await chiediRiassunto({ passaggi: scelti, tappe });
  if (!vivo()) return null;
  return { fase: res.answer ? "fatto" : "errore", tappe, lontani, passaggi: scelti, ...res };
}

// «PRIMA DI COMINCIARE» — cosa è successo nei volumi che vengono prima.
//
// Stessa raccolta di «Dove eravamo rimasti», ma su un libro che NON hai
// ancora aperto: la frontiera, non trovando un segno per il volume
// corrente, restituisce da sola i soli volumi precedenti. Non serve
// nessuna lista di saghe: vale per qualunque saga hai in libreria e per
// quelle che ci metterai, perche' l'ordine lo dici tu nella scheda del
// libro (saga + numero d'ordine).
//
// Il volume che stai per cominciare resta FUORI anche se ci hai messo il
// naso una volta: qui si chiede cosa viene prima, e una riga del libro
// nuovo sarebbe uno spoiler chiesto per sbaglio.
const SISTEMA_PRIMA = [
  "Sei l'Oracolo di un'app di lettura. Il lettore sta per cominciare un",
  "volume di una saga e vuole ricordarsi cosa è successo nei volumi",
  "precedenti, che ha già letto.",
  "REGOLA ASSOLUTA: racconta soltanto ciò che si ricava dai passaggi che",
  "ti mostro. Non usare nulla che sai di questa saga da altre fonti, e non",
  "dire una parola su cosa succederà nel volume che sta per aprire: non",
  "l'ha ancora letto, e rovinarglielo è il danno peggiore che puoi fare.",
  "LINGUA: scrivi SEMPRE IN ITALIANO, anche quando i passaggi sono in",
  "un'altra lingua. Nomi di persone e di luoghi restano come stanno.",
  "FORMA: prosa, non un elenco. Due o tre paragrafi brevi separati da una",
  "riga vuota, testo puro senza markdown e senza titoletti.",
  "MISURA: sulle 250 parole. Serve a rimettersi in pari in mezzo minuto.",
  "CONTENUTO: la storia com'è arrivata fin qui — da dove è partita, chi ci",
  "si muove dentro e cosa vuole, i fatti che contano e i conti rimasti",
  "aperti. Chiudi dicendo dove sono arrivate le cose alla fine dell'ultimo",
  "volume, che è il punto da cui riparte quello che ha in mano.",
  "NIENTE PREMESSE E NIENTE SCUSE: attacca dal racconto. Non aprire",
  "dicendo che i passaggi sono pochi o frammentari, non commentare il",
  "materiale che ti ho dato e non parlare di te — al lettore serve la",
  "storia, e da dove viene la risposta glielo dichiara già l'app.",
  "I passaggi sono un campione, non il libro intero: è normale che siano",
  "scene sparse. Ricava quello che si può ricavare e raccontalo con",
  "sicurezza, senza riempire i buchi con roba inventata; su quello che",
  "davvero non c'è, taci invece di segnalarlo.",
].join(" ");

// QUI I VOLUMI PRECEDENTI SONO IL SOGGETTO, NON LO SFONDO.
//
// `scegliTrama` è fatta per «dove eravamo rimasti»: il libro in mano è la
// storia, e ai volumi di prima bastano sei frammenti a collocare i nomi.
// Con quella spartizione questa scheda usciva fatta di schegge — «nomi e
// luoghi da tenere a mente, non una storia» (parole sue, e aveva ragione).
//
// Qui la proporzione si rovescia: l'ultimo volume finito è quello da cui
// riparti e prende la parte grossa, compresa la sua chiusura vera; i più
// vecchi hanno ciascuno la propria quota, non una in comune.
const PRIMA_APERTURA = 5;
const PRIMA_CORPO = 14;
const PRIMA_CODA = 10;
const PRIMA_VECCHI = 10;
// Il tetto e' sui libri-equivalenti, non sui file: un cofanetto da tre
// romanzi ne vale tre, e il suo spazio deve poterci stare. Sta largo
// abbastanza da non stringere prima dei sette libri: con cinque
// volumi-tipo (un cofanetto piu' due romanzi) tagliava gia', e le saghe
// lunghe sono proprio quelle in cui questa scheda serve di piu'.
const PRIMA_TETTO_VECCHI = 72;

// E UN COFANETTO NON E' UN VOLUME COME GLI ALTRI.
//
// Con una quota fissa per volume, il tomo che tiene dentro tre romanzi
// riceveva quanto una raccolta di racconti: dieci paragrafi sparsi su un
// milione e mezzo di caratteri, cioe' niente. La scheda finiva per
// saltare quei romanzi, e di loro restava solo l'eco nei ricordi dei
// personaggi dei volumi dopo (segnalato dal lettore: «sembra che ti sei
// saltato totalmente gli eventi della prima trilogia»).
//
// Si contano i libri in «volumi tipo», con la MEDIANA dei precedenti come
// unita' — la stessa misura della scheda personaggio — e la quota va a
// libri-equivalenti, non a file.
function quantiLibri(vecchi) {
  const pesi = vecchi.map((r) => Math.max(1, r.esteso || 1));
  const ordinate = [...pesi].sort((a, b) => a - b);
  const unita = ordinate[Math.floor(ordinate.length / 2)] || 1;
  return pesi.map((p) => Math.max(1, Math.round(p / unita)));
}

// IL TETTO DEVE ESSERE UN TETTO, E LA VICINANZA CONTA.
//
// Con un minimo fisso per volume il tetto era una raccomandazione: tredici
// volumi davano 78 passaggi su 72, quaranta ne davano 160 — novantamila
// caratteri davanti al modello. E la spartizione era piatta: prima di
// aprire il quattordicesimo, il primo libro pesava quanto il tredicesimo,
// mentre quello che serve per ripartire sta soprattutto negli ultimi.
//
// Qui i posti si assegnano ESATTAMENTE quanti sono, col metodo del resto
// piu' grande: un posto garantito a testa finche' bastano — nessun volume
// resta muto — e il resto a peso, dove il peso e' quanti libri tiene il
// volume, sfumato dalla distanza. Una saga da quaranta libri sta nel
// tetto come una da tre.
const VICINANZA = 0.85;
// oltre questi volumi la saga e' «lunga»: passarli tutti in rassegna
// diventa un elenco di titoli, e si cambia richiesta al modello
const SAGA_CORTA = 5;

function spartisci(pesi, budget) {
  const n = pesi.length;
  if (!n || budget <= 0) return pesi.map(() => 0);
  const minimo = budget >= n ? 1 : 0;
  const somma = pesi.reduce((a, b) => a + b, 0) || 1;
  const resto = Math.max(0, budget - minimo * n);
  const grezzi = pesi.map((p) => minimo + (resto * p) / somma);
  const quote = grezzi.map((g) => Math.floor(g));
  // i posti avanzati dall'arrotondamento vanno a chi ha il resto piu' grosso
  const ordine = grezzi
    .map((g, i) => ({ i, r: g - Math.floor(g) }))
    .sort((a, b) => b.r - a.r);
  let avanzo = budget - quote.reduce((a, b) => a + b, 0);
  for (let k = 0; avanzo > 0; k = (k + 1) % n) {
    quote[ordine[k % n].i] += 1;
    avanzo -= 1;
  }
  return quote;
}

export function scegliPrima(raccolto) {
  if (!raccolto.length) return [];
  const ultimo = raccolto[raccolto.length - 1];
  const vecchi = raccolto.slice(0, -1);
  const libri = vecchi.length ? quantiLibri(vecchi) : [];
  const totLibri = libri.reduce((a, b) => a + b, 0);
  const budget = Math.min(PRIMA_TETTO_VECCHI, PRIMA_VECCHI * totLibri);
  // il peso: quanti libri tiene il volume, sfumato da quanto è lontano
  const quote = spartisci(
    libri.map((n, i) => n * Math.pow(VICINANZA, vecchi.length - 1 - i)),
    budget
  );
  // Ogni passaggio dei volumi vecchi si porta dietro il suo NUMERO di
  // volume: senza, i frammenti arrivano al modello tutti mescolati sotto
  // un'etichetta sola, e non puo' raccontarli in ordine nemmeno volendo.
  // Il numero torna titolo sullo schermo (`conTitoli`), mai al modello.
  const fuori = vecchi.flatMap((r, i) =>
    sparsi(r.corpo, quote[i]).map((testo) => ({
      testo,
      quando: "prima",
      volume: i + 1,
    }))
  );
  const coda = ultimo.coda.slice(-PRIMA_CODA);
  const corpo = ultimo.corpo.filter((t) => !coda.includes(t));
  const taglio = Math.max(PRIMA_APERTURA, Math.round(corpo.length * APERTURA));
  const scelti = [
    ...sparsi(corpo.slice(0, taglio), PRIMA_APERTURA),
    ...sparsi(corpo.slice(taglio), PRIMA_CORPO),
  ];
  return [
    ...fuori,
    ...scelti.map((testo) => ({ testo, quando: "qui" })),
    ...coda.map((testo) => ({ testo, quando: "coda" })),
  ];
}

// «PRIMA» VUOL DIRE LA STESSA STORIA, NON LO STESSO MONDO.
//
// Una saga grande e' divisa in cicli: nel Mondo Disco, chi apre un
// romanzo delle Guardie vuole sapere cosa e' successo nelle Guardie, non
// negli altri quaranta libri dell'universo (segnalato dal lettore). Se il
// volume dichiara una serie, i precedenti sono quelli della SUA serie; se
// non la dichiara, resta l'universo intero — che e' il caso di una saga
// senza cicli, dove i due raggruppamenti coincidono.
//
// Vale qui e non nella scheda personaggio: li' il campo largo aiuta —
// chiedere di Vetinari leggendo le Streghe deve poter pescare dalle
// Guardie — e la difesa dagli spoiler regge lo stesso, perche' i volumi
// dopo il corrente restano fuori in ogni caso.
export function soloDellaSerie(book, tappe) {
  const serie = (book.series || "").trim().toLowerCase();
  if (!serie) return tappe;
  return tappe.filter((t) => (t.libro.series || "").trim().toLowerCase() === serie);
}

export async function schedaPrima({ book, libri, statusOf, cfiOf, vivo, passo }) {
  const tappe = soloDellaSerie(
    book,
    frontiera(book, libri, { statusOf, cfiOf }).filter((t) => t.libro.id !== book.id)
  );
  if (!tappe.length) return { fase: "vuoto", tappe: [], lontani: [], passaggi: [] };
  passo({ fase: "cerco", tappe });
  const { raccolto, lontani } = await raccogliTrama(tappe, { vivo });
  const scelti = scegliPrima(raccolto);
  if (!vivo()) return null;
  if (!scelti.length) return { fase: "vuoto", tappe, lontani, passaggi: [] };
  passo({ fase: "chiedo", tappe, lontani, passaggi: scelti });
  const res = await chiediPrima({ passaggi: scelti, tappe });
  if (!vivo()) return null;
  return { fase: res.answer ? "fatto" : "errore", tappe, lontani, passaggi: scelti, ...res };
}

export async function chiediPrima({ passaggi, tappe }, fetcher) {
  if (!getOracleKey()) return { error: "chiave" };
  if (!passaggi.length) return { error: "nessunPassaggio" };
  const righe = ["Il lettore chiede: cosa è successo nei volumi precedenti?"];
  righe.push(
    tappe.length === 1
      ? "Ha letto il volume che viene prima di quello che sta per aprire. Non ti dico quale libro né quale saga, apposta: devi rispondere da questi passaggi e non da quello che ricordi."
      : `Ha letto ${tappe.length} volumi che vengono prima. ` +
        "Non ti dico quale saga né quali titoli, apposta: devi rispondere da questi passaggi e non da quello che ricordi."
  );
  righe.push(
    "Passaggi in ordine di lettura. [inizio] e [ultime pagine] vengono dal volume più recente, " +
      "quello che ha appena finito: le [ultime pagine] sono come si è chiuso, ed è da lì che riparte."
  );
  if (tappe.length > 1) {
    // Su una saga corta si può passare per ogni volume. Su una da dieci o
    // quaranta no: chiederlo in duecentocinquanta parole vorrebbe dire un
    // elenco di titoli, e chi sta per aprire il quattordicesimo vuole
    // sapere soprattutto come si è arrivati fin qui.
    righe.push(
      tappe.length <= SAGA_CORTA
        ? "I passaggi marcati «Volume N» vengono dai volumi ancora precedenti, campionati lungo tutto " +
            "il loro corso. PASSA PER OGNI VOLUME, in ordine, dal primo: bastano poche frasi a testa, " +
            "ma non saltarne nessuno e non spendere tutto sull'ultimo."
        : `I passaggi marcati «Volume N» vengono dai ${tappe.length - 1} volumi precedenti, campionati ` +
            "lungo tutto il loro corso. È una saga lunga e non ci stanno tutti: tieni il filo che arriva " +
            "fino a qui — da dove è partita, cosa si trascina dietro — e racconta con più agio i volumi " +
            "più recenti, quelli da cui il lettore riparte davvero. Dei più lontani basta quello che " +
            "serve a capire il presente."
    );
    righe.push(
      "Quando dici dove accade una cosa, scrivi proprio «Volume 1», «Volume 2»: l'app mostrerà al " +
        "lettore i titoli veri. Racconta quello che i passaggi mostrano, senza dedurne fatti che non " +
        "ci sono."
    );
  }
  const eti = { qui: "inizio", coda: "ultime pagine" };
  passaggi.forEach((p, i) => {
    const dove = p.quando === "prima" ? `Volume ${p.volume}` : eti[p.quando];
    righe.push(`${i + 1}. [${dove}] «${p.testo}»`);
  });
  return chiedi({ system: SISTEMA_PRIMA, user: righe.join("\n"), tetto: TETTO_SCHEDA }, fetcher);
}

export async function chiediRiassunto({ passaggi, tappe }, fetcher) {
  if (!getOracleKey()) return { error: "chiave" };
  if (!passaggi.length) return { error: "nessunPassaggio" };
  const righe = ["Il lettore chiede: dove eravamo rimasti?"];
  righe.push(
    tappe.length === 1
      ? "Sta leggendo un libro ed è arrivato a un certo punto. Non ti dico quale libro, apposta: devi rispondere da questi passaggi e non da quello che ricordi."
      : `Ha letto ${tappe.length} volumi di una saga, l'ultimo solo in parte. ` +
        "Non ti dico quale saga né quali titoli, apposta: devi rispondere da questi passaggi e non da quello che ricordi."
  );
  righe.push(
    "Passaggi in ordine di lettura. [inizio] viene dal libro che ha in mano, [ultime pagine] da " +
      "subito prima del punto in cui si è fermato: il racconto sta lì, ed è lì che deve stare la tua risposta."
  );
  // I volumi di prima arrivano come pochi frammenti sparsi su interi romanzi:
  // riassumerli da quelli sarebbe inventare. Dirlo al modello e' l'unico modo
  // di impedirglielo — senza, quei frammenti li tratta come una sinossi.
  if (tappe.length > 1) {
    righe.push(
      "I passaggi [prima] sono pochi frammenti sparsi su interi volumi precedenti: servono solo a " +
        "collocare nomi e luoghi che tornano. NON riassumere quei volumi da lì e non dedurne la trama."
    );
  }
  const eti = { prima: "prima", qui: "inizio", coda: "ultime pagine" };
  passaggi.forEach((p, i) => {
    righe.push(`${i + 1}. [${eti[p.quando]}] «${p.testo}»`);
  });
  // stesso tetto della scheda personaggio: la risposta e' corta, ma il
  // ragionamento su decine di passaggi attinge allo stesso budget
  return chiedi({ system: SISTEMA, user: righe.join("\n"), tetto: TETTO_SCHEDA }, fetcher);
}
