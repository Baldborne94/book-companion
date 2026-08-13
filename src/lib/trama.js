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
  return { corpo: [], coda: [], passo: 1, visti: 0 };
}

function raccogli(r, testo) {
  const t = String(testo || "").replace(/\s+/g, " ").trim();
  if (t.length < MIN_PARAGRAFO) return;
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

async function tramaDaEpub(libro, fino) {
  const blob = await getFile(libro.id);
  if (!blob) return null;
  const { default: ePub } = await import("epubjs");
  const eb = ePub(await blob.arrayBuffer());
  const r = nuovaRaccolta();
  try {
    await eb.ready;
    const cfi = new ePub.CFI();
    const spina = eb.spine.spineItems;
    for (let i = 0; i < spina.length; i++) {
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
  "aperti. Chiudi dicendo come si è chiuso l'ultimo volume, che è il punto",
  "da cui riparte quello che ha in mano.",
  "Se i passaggi non bastano a ricostruire il filo, dillo in una riga",
  "invece di inventare.",
].join(" ");

export async function schedaPrima({ book, libri, statusOf, cfiOf, vivo, passo }) {
  const tappe = frontiera(book, libri, { statusOf, cfiOf }).filter((t) => t.libro.id !== book.id);
  if (!tappe.length) return { fase: "vuoto", tappe: [], lontani: [], passaggi: [] };
  passo({ fase: "cerco", tappe });
  const { raccolto, lontani } = await raccogliTrama(tappe, { vivo });
  const scelti = scegliTrama(raccolto);
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
    righe.push(
      "I passaggi [prima] sono pochi frammenti sparsi su interi volumi ancora precedenti: servono " +
        "solo a collocare nomi e luoghi che tornano. NON riassumere quei volumi da lì."
    );
  }
  const eti = { prima: "prima", qui: "inizio", coda: "ultime pagine" };
  passaggi.forEach((p, i) => {
    righe.push(`${i + 1}. [${eti[p.quando]}] «${p.testo}»`);
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
