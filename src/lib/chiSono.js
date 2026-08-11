import { getFile } from "./bookStore.js";
import { pageText, findMatches } from "./pdfSearch.js";
import { chiedi, getOracleKey } from "./oracle.js";

// «CHI È COSTUI?» — la scheda di un personaggio cucita su quello che hai
// letto, e su nient'altro.
//
// La difesa contro gli spoiler NON e' la frase che si dice al modello: e'
// quello che gli si mette davanti. Il modello queste saghe le conosce, e se
// gli si lascia spazio racconta volentieri il finale. Percio' riceve solo i
// passaggi che stanno dentro la frontiera di lettura, gli si chiede di non
// uscire da li', e gli stessi passaggi vengono mostrati al lettore: e' lui a
// poter controllare, invece di doversi fidare.

// Da ogni volume si prende dall'inizio (chi e' quando entra in scena), dal
// fondo (cosa sta facendo adesso) e dal MEZZO a passo regolare — e' li' che
// spesso stanno i fatti chiave, e prendendo solo capo e coda restavano
// fuori.
//
// Ma la quota e' PER VOLUME, e il volume aperto ha la sua. Con una quota
// sola sull'intera frontiera, il «capo» finiva nel primo volume della saga e
// la «coda» nelle scene recenti: l'INIZIO DEL LIBRO CHE STAI LEGGENDO non
// veniva campionato da nessuno dei due. Ed e' li' che sta la premessa — chi
// e' stato tradito, da chi, perche' vuole vendetta. La scheda usciva senza
// il fatto che regge il libro.
//
// E l'apertura non sono «le prime menzioni di fila»: quelle stanno tutte
// nella prima pagina del primo capitolo, dove il personaggio si sta ancora
// solo alzando dal letto. La scena che fonda il libro si svolge lungo tutto
// quel capitolo, e va campionata a passo largo (APERTURA) — altrimenti si
// raccoglie il buongiorno e si perde il tradimento.
const DA_CAPO = 5;
const DA_MEZZO = 5;
const DA_FONDO = 6;
// quanta parte del volume aperto conta come apertura
const APERTURA = 0.2;
// quanto spetta, in tutto, ai volumi precedenti: il passato serve, ma la
// storia che il lettore ha in mano adesso conta di piu'
const DA_PRIMA = 6;
// tetto di sicurezza per libro: oltre, e' un protagonista e le menzioni in
// piu' non cambiano la scelta
const MAX_MENZIONI = 240;
// quanto paragrafo si porta a casa attorno a ogni menzione
const PARAGRAFO = 480;

const SISTEMA = [
  "Sei l'Oracolo di un'app di lettura. Il lettore ti chiede chi è un",
  "personaggio (o cosa è un luogo, un oggetto, una casata) e ti mostra dei",
  "passaggi presi dai libri che ha letto FINORA.",
  "REGOLA ASSOLUTA: rispondi soltanto con ciò che si ricava da quei",
  "passaggi. Non usare nulla che sai di questo libro o di questa saga da",
  "altre fonti: quel che sai potrebbe venire da pagine che il lettore non ha",
  "ancora letto, e rovinargliele.",
  "Non anticipare MAI cosa succederà.",
  "LINGUA: scrivi nella stessa lingua dei passaggi. Se i passaggi sono in",
  "inglese rispondi in inglese, se sono in italiano rispondi in italiano.",
  "FORMA: prosa, non un elenco. Due o tre paragrafi brevi, separati da una",
  "riga vuota, testo puro senza markdown, senza trattini a capo, senza",
  "titoletti. Scrivi come un lettore che racconta a voce a un amico chi è",
  "quel personaggio, con frasi intere e distese.",
  "CONTENUTO: racconta la sua storia fino a qui, non i suoi tratti. Chi era",
  "prima, che cosa gli è successo e per mano di chi, che cosa ha perso, che",
  "cosa vuole adesso e perché lo vuole. I torti subiti, i tradimenti, le",
  "alleanze e le rivalità sono la parte che conta: se i passaggi li",
  "mostrano, raccontali per esteso e chiama le persone coinvolte con i nomi",
  "che compaiono nei passaggi. Serve a chi reincontra il personaggio dopo",
  "tanto tempo e deve rimettersi in pari.",
  "Chiudi con una frase su dove il lettore lo ha lasciato: cosa sta facendo",
  "nei passaggi più recenti.",
  "Se i passaggi non bastano a dire chi è, dillo in una riga invece di",
  "inventare; se non bastano su un punto, taci su quel punto.",
].join(" ");

// Un nome, non una frase: la scheda ha senso su «Logen Novedita», non su
// mezzo paragrafo.
export function sembraUnNome(s) {
  const t = String(s || "").trim();
  if (!t || t.length > 42) return false;
  const parole = t.split(/\s+/);
  if (parole.length > 4) return false;
  return parole.some((p) => /^[A-ZÀ-Þ]/.test(p));
}

// Le parti del nome valgono da sole: selezioni «Logen Novedita» e le pagine
// dove e' scritto solo «Novedita» devono contare lo stesso. Fuori restano
// gli articoli e i titoli («The», «Lord»): da soli acchiapperebbero mezzo
// libro. Il ponte fra nome e soprannome («il Sanguinario» = Logen) invece
// non si puo' costruire senza dire al modello di che saga si tratta — e
// quello non si fa.
const GENERICHE = new Set([
  "the", "der", "die", "das", "los", "las", "van", "von", "mac",
  "del", "dei", "della", "dello", "don", "dom", "san", "santa", "ser",
  "sir", "lord", "lady", "king", "queen", "mister", "miss", "old",
]);

export function varianti(nome) {
  const intero = String(nome || "").trim().replace(/\s+/g, " ");
  if (!intero) return [];
  const parti = intero
    .split(" ")
    .filter((p) => /^[A-ZÀ-Þ]/.test(p) && p.length >= 3 && !GENERICHE.has(p.toLowerCase()));
  return [...new Set([intero, ...parti])];
}

const sfuggi = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// maiuscole rispettate: «Death» il personaggio, non «the death of kings»
export function regexNome(nome) {
  const v = varianti(nome);
  if (!v.length) return null;
  return new RegExp(`(?<![\\p{L}\\p{N}])(${v.map(sfuggi).join("|")})(?![\\p{L}\\p{N}])`, "gu");
}

// Il paragrafo attorno alla menzione, non mezzo rigo: «…alzo' lo sguardo
// verso…» non dice niente ne' al lettore ne' al modello.
function paragrafo(node, colpito, maxLen = PARAGRAFO) {
  const blocco =
    node.parentElement?.closest?.("p, li, blockquote, dd, td, h1, h2, h3") || node.parentElement;
  const tutto = String(blocco?.textContent || node.textContent || "").replace(/\s+/g, " ").trim();
  if (tutto.length <= maxLen) return tutto;
  const at = tutto.indexOf(colpito);
  const centro = at >= 0 ? at + colpito.length / 2 : tutto.length / 2;
  const from = Math.max(0, Math.min(Math.round(centro - maxLen / 2), tutto.length - maxLen));
  const pezzo = tutto.slice(from, from + maxLen);
  return (from > 0 ? "…" : "") + pezzo + (from + maxLen < tutto.length ? "…" : "");
}

async function daEpub(libro, re, fino) {
  const blob = await getFile(libro.id);
  if (!blob) return [];
  const { default: ePub } = await import("epubjs");
  const eb = ePub(await blob.arrayBuffer());
  const out = [];
  try {
    await eb.ready;
    const cfi = new ePub.CFI();
    const dentro = (c) => {
      try { return cfi.compare(c, fino) <= 0; } catch { return false; }
    };
    for (const item of eb.spine.spineItems) {
      // La spina e' in ordine di lettura: il primo capitolo che comincia
      // oltre il segno chiude il giro, e i capitoli dopo non si aprono
      // nemmeno. Prima si scorreva dall'inizio con un tetto sulle menzioni:
      // per un protagonista il tetto si esauriva nei primi capitoli e «gli
      // ultimi passaggi» venivano in realta' da meta' libro.
      if (fino) {
        try {
          if (cfi.compare(`epubcfi(${item.cfiBase}!/0)`, fino) > 0) break;
        } catch { /* base illeggibile: si scorre e filtra per menzione */ }
      }
      try {
        await item.load(eb.load.bind(eb));
        const doc = item.document;
        if (doc?.body) {
          const walker = doc.createTreeWalker(doc.body, 4 /* solo nodi di testo */);
          let node;
          while ((node = walker.nextNode()) && out.length < MAX_MENZIONI) {
            const text = node.textContent;
            if (!text || !text.trim()) continue;
            re.lastIndex = 0;
            // una menzione per nodo: il paragrafo attorno e' lo stesso
            const m = re.exec(text);
            if (!m) continue;
            try {
              const range = doc.createRange();
              range.setStart(node, m.index);
              range.setEnd(node, m.index + m[0].length);
              const c = item.cfiFromRange(range);
              if (fino && !dentro(c)) continue;
              out.push({ libro, cfi: c, testo: paragrafo(node, m[0]) });
            } catch { /* range fuori misura: si passa oltre */ }
          }
        }
      } catch { /* capitolo illeggibile: gli altri bastano */ } finally {
        try { item.unload(); } catch { /* gia' scaricato */ }
      }
      if (out.length >= MAX_MENZIONI) break;
    }
  } finally {
    try { eb.destroy(); } catch { /* gia' chiuso */ }
  }
  return out;
}

async function daPdf(libro, nome, fino) {
  const blob = await getFile(libro.id);
  if (!blob) return [];
  const mod = await import("./pdfThumb.js");
  const pdf = await mod.loadPdf(await blob.arrayBuffer());
  const out = [];
  try {
    // nei PDF il segno e' un numero di pagina: le pagine oltre non si
    // leggono proprio, ed e' anche questo che rende giusti gli «ultimi»
    const limite = fino ? Math.min(parseInt(fino, 10) || pdf.numPages, pdf.numPages) : pdf.numPages;
    const cache = new Map();
    const nomi = varianti(nome);
    for (let n = 1; n <= limite && out.length < MAX_MENZIONI; n++) {
      let testoPag;
      try {
        testoPag = await pageText(pdf, n, cache);
      } catch {
        continue;
      }
      const visti = new Set();
      for (const v of nomi) {
        for (const m of findMatches(testoPag, v, 2, 220)) {
          const chiave = `${m.before.slice(-24)}|${m.hit}`;
          if (visti.has(chiave)) continue;
          visti.add(chiave);
          out.push({
            libro,
            cfi: String(n),
            dove: `pag. ${n}`,
            testo: `${m.before}${m.hit}${m.after}`.trim(),
          });
        }
      }
    }
  } finally {
    try { pdf.destroy(); } catch { /* gia' chiuso */ }
  }
  return out;
}

export async function raccogliPassaggi(nome, tappe, { vivo } = {}) {
  const attivo = vivo || (() => true);
  const re = regexNome(nome);
  if (!re) return [];
  const tutti = [];
  // un tomo per volta, come la ricerca in biblioteca: su un tablet aprirli
  // tutti insieme vuol dire farsi chiudere la scheda
  for (const t of tappe) {
    if (!attivo()) break;
    try {
      const pezzi =
        t.libro.fileType === "pdf"
          ? await daPdf(t.libro, nome, t.tutto ? null : t.fino)
          : await daEpub(t.libro, re, t.tutto ? null : t.fino);
      tutti.push(...pezzi);
    } catch {
      /* tomo che non si apre: gli altri bastano */
    }
  }
  return tutti;
}

// Le menzioni fotocopia — «disse Logen», «Logen annui'» — sprecano i sei
// posti della scheda: i doppioni si scartano, e a parita' si preferiscono i
// passaggi dove attorno al nome c'e' sostanza.
const impronta = (t) =>
  t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().slice(0, 80);

export function ripulisci(menzioni) {
  const visti = new Set();
  const out = [];
  for (const m of menzioni) {
    const k = impronta(m.testo);
    if (!k || visti.has(k)) continue;
    visti.add(k);
    out.push(m);
  }
  return out;
}

const SOSTANZA = 90;

// n passaggi sparsi su tutta la lista, capo e coda compresi: e' cosi' che si
// riassumono i volumi gia' finiti, dove non c'e' un «adesso» da privilegiare.
// Non sono «i migliori» — non sappiamo giudicare cosa conta in una storia —
// ma sparsi, cosi' nessun tratto lungo resta muto.
function sparsi(lista, n) {
  if (n <= 0 || !lista.length) return [];
  if (lista.length <= n) return lista;
  if (n === 1) return [lista[0]];
  const passo = (lista.length - 1) / (n - 1);
  return [...new Set(Array.from({ length: n }, (_, i) => lista[Math.round(passo * i)]))];
}

// Il volume aperto: l'apertura sparsa su tutto il primo quinto (e' li' che
// il libro dichiara la sua premessa, e ci vuole un capitolo intero per
// dichiararla), il corpo sparso su quel che segue, e la coda fitta e di
// fila — quella e' il «dove eri rimasto», e li' i passaggi vicini fra loro
// servono, perche' raccontano una scena sola.
function volumeAperto(qui, n) {
  const nFondo = Math.min(DA_FONDO, Math.floor(n / 2));
  const resto = n - nFondo;
  const nCapo = Math.min(DA_CAPO, Math.ceil(resto / 2));
  const coda = nFondo ? qui.slice(qui.length - nFondo) : [];
  const prima = qui.slice(0, qui.length - nFondo);
  const taglio = Math.max(nCapo, Math.round(prima.length * APERTURA));
  return [
    ...new Set([
      ...sparsi(prima.slice(0, taglio), nCapo),
      ...sparsi(prima.slice(taglio), resto - nCapo),
      ...coda,
    ]),
  ];
}

// La quota si spartisce fra il volume aperto e quelli di prima, e il volume
// aperto la sua ce l'ha sempre: e' li' che sta la premessa del libro che il
// lettore ha in mano. Quello che un lato non usa passa all'altro.
export function scegliPassaggi(tutti, idCorrente) {
  const puliti = ripulisci(tutti);
  const ricchi = puliti.filter((m) => m.testo.length >= SOSTANZA);
  const perQui = DA_CAPO + DA_MEZZO + DA_FONDO;
  const totale = perQui + DA_PRIMA;
  // se di passaggi sostanziosi non ce n'e' abbastanza, meglio i magri che
  // il silenzio
  const base = ricchi.length >= totale ? ricchi : puliti;
  if (base.length <= totale) return base;

  const qui = idCorrente ? base.filter((m) => m.libro.id === idCorrente) : [];
  // nel volume aperto il nome non compare: allora e' tutto passato, e si
  // tratta la frontiera intera come fosse un volume solo
  if (!qui.length) return volumeAperto(base, perQui);
  const prima = base.filter((m) => m.libro.id !== idCorrente);

  const nPrima = Math.min(prima.length, totale - Math.min(qui.length, perQui));
  const nQui = Math.min(qui.length, totale - nPrima);
  return [...sparsi(prima, nPrima), ...volumeAperto(qui, nQui)];
}

// I TITOLI NON ESCONO DAL DISPOSITIVO.
//
// Dire al modello «questo e' il secondo volume della Prima Legge» significa
// consegnargli la trama intera: da li' in poi puo' rispondere a memoria
// invece che dai passaggi, e la memoria comprende i libri che il lettore non
// ha ancora letto. I volumi si numerano e basta — al modello serve l'ordine,
// non il nome. Il nome lo vede il lettore nella scheda, che e' l'unico posto
// dove non fa danno.
const etichette = (tappe) => {
  const m = new Map();
  tappe.forEach((t, i) => {
    m.set(t.libro.id, i === tappe.length - 1 ? `Volume ${i + 1}, dove sta leggendo` : `Volume ${i + 1}`);
  });
  return m;
};

export async function chiediChiE({ nome, passaggi, tappe }, fetcher) {
  if (!getOracleKey()) return { error: "chiave" };
  if (!passaggi.length) return { error: "nessunPassaggio" };
  const eti = etichette(tappe);
  const righe = [`Il lettore chiede: chi è «${nome}»?`];
  righe.push(
    tappe.length === 1
      ? "Sta leggendo un libro ed è arrivato a un certo punto. Non ti dico quale libro, apposta: devi rispondere da questi passaggi e non da quello che ricordi."
      : `Ha letto ${tappe.length} volumi di una saga, l'ultimo solo in parte. ` +
        "Non ti dico quale saga né quali titoli, apposta: devi rispondere da questi passaggi e non da quello che ricordi."
  );
  righe.push(
    "Passaggi in cui compare, in ordine di lettura. L'ultimo volume è quello che ha in mano adesso: " +
      "i suoi primi passaggi vengono dall'apertura del libro — è lì che di solito si capisce cosa è successo " +
      "al personaggio e perché fa quello che fa — e gli ultimi da dove il lettore si è fermato. " +
      "I passaggi dei volumi precedenti sono il suo passato."
  );
  passaggi.forEach((p, i) => {
    righe.push(`${i + 1}. [${eti.get(p.libro.id) || "Volume"}] «${p.testo}»`);
  });
  return chiedi({ system: SISTEMA, user: righe.join("\n") }, fetcher);
}
