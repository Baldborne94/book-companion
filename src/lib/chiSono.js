import { getFile } from "./bookStore.js";
import { pageText, findMatches } from "./pdfSearch.js";
import { chiedi, getOracleKey, TETTO_SCHEDA } from "./oracle.js";
import { varianti, regexNome, nuovoRegistro, annota, decidi } from "./nomi.js";
import { frontiera } from "./frontiera.js";

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
// quota per OGNI volume gia' finito, non in tutto: con sei passaggi da
// spartire sull'intera saga, a quattro libri finiti toccava un passaggio e
// mezzo a testa — troppo poco perche' ne uscissero gli eventi principali.
// Il tetto tiene a bada le saghe lunghe.
const DA_VOLUME_PRIMA = 4;
const MAX_PRIMA = 16;
// Quante menzioni si tengono per libro. NON e' un punto d'arresto: al
// tetto la raccolta SI DIRADA — una su due, e il passo raddoppia — e il
// giro prosegue fino in fondo al volume. Fermarsi qui voleva dire, in un
// tomo che tiene dentro tre romanzi, riempire il tetto col primo e non
// aprire mai gli altri due: gli incontri di la' sparivano, e nessuna quota
// avrebbe potuto ripescarli perche' non erano stati nemmeno raccolti.
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
  "LINGUA: scrivi SEMPRE IN ITALIANO, anche quando i passaggi sono in",
  "un'altra lingua — la scheda è parte di un'app italiana, e leggerne una",
  "metà in inglese e una in italiano stona. Nomi di persone e di luoghi",
  "restano come stanno nei passaggi, senza tradurli; se citi una frase del",
  "libro lasciala nella sua lingua fra virgolette. Scrivi un italiano",
  "curato e naturale, da lettore che racconta, non da traduttore.",
  "FORMA: tre parti, divise da una riga che contiene solo tre trattini",
  "(---). Testo puro: niente markdown, niente titoletti, niente elenchi —",
  "i titoli li mette l'app. Dentro ogni parte scrivi in prosa, come un",
  "lettore che racconta a voce a un amico, con frasi intere e distese.",
  "MISURA: una scheda compatta, non un saggio. In tutto sulle 250 parole.",
  "Chi la legge vuole rimettersi in pari in mezzo minuto, non rileggere il",
  "libro: scegli i fatti che contano e lascia stare le scene minori.",
  "PRIMA PARTE, il ritratto: com'è fatto e che aria ha — aspetto, modi,",
  "come parla — ma solo quello che i passaggi mostrano. Due o tre frasi.",
  "SECONDA PARTE, la storia fin qui: non i suoi tratti ma che cosa gli è",
  "successo, e per mano di chi. Chi era prima, che cosa ha perso, che cosa",
  "vuole adesso e perché lo vuole. I torti subiti, i tradimenti, le",
  "alleanze e le rivalità sono la parte che conta, e chiama le persone",
  "coinvolte con i nomi che compaiono nei passaggi.",
  "PASSA PER TUTTI I VOLUMI in cui i passaggi lo mostrano, in ordine di",
  "lettura, a cominciare da dove il lettore lo ha incontrato la PRIMA",
  "volta: bastano una o due frasi per volume, ma non saltarne nessuno e non",
  "spendere tutto sul volume dove compare di più. Dove accadono le cose",
  "dillo scrivendo proprio «Volume 1», «Volume 2», come sono etichettati i",
  "passaggi: l'app mostrerà al lettore i titoli veri.",
  "TERZA PARTE, dove il lettore lo ha lasciato: una o due frasi su cosa sta",
  "facendo nei passaggi più recenti.",
  "Se i passaggi non bastano a dire chi è, dillo in una riga invece di",
  "inventare; se non bastano su un punto, taci su quel punto.",
  "NIENTE PREMESSE: attacca subito col ritratto. Non aprire spiegando da",
  "quali volumi vengono i passaggi o quali non li mostrano — da dove viene",
  "la risposta lo dichiara l'app, sotto la scheda, e ripeterlo ruba le",
  "prime righe a quello che il lettore ti ha chiesto.",
].join(" ");

// I tre movimenti della scheda: i titoletti sono dell'app (e in italiano,
// come il resto dell'interfaccia), al modello si chiedono solo i divisori.
// Se i movimenti non tornano tre, la prosa si mostra nuda: meglio senza
// titoli che con un titolo sul pezzo sbagliato.
export const TITOLETTI = ["Il ritratto", "La storia fin qui", "Dove l'hai lasciato"];

export function movimenti(answer) {
  const parti = String(answer || "")
    .split(/\n\s*-{3,}\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parti.length === TITOLETTI.length ? parti : null;
}

// I numeri dei volumi tornano titoli QUI, sullo schermo: al modello i
// titoli non arrivano mai (riconoscerebbe la saga e risponderebbe a
// memoria), ma il lettore deve leggere il nome del suo libro, non un
// numero. Un numero fuori dalla frontiera resta com'e'.
export function conTitoli(testo, tappe) {
  if (!tappe?.length) return String(testo || "");
  return String(testo || "").replace(/\bvolume\s+(\d+)\b/gi, (tutto, n) => {
    const titolo = tappe[Number(n) - 1]?.libro?.title;
    return titolo ? `«${titolo}»` : tutto;
  });
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

// C'E' DEL NUOVO SU DI LUI, DA ALLORA?
//
// La scheda vale per il punto in cui l'hai chiesta. Ma se da allora il
// personaggio NON e' piu' comparso, quella scheda e' ancora esatta:
// rifarla vorrebbe dire pagare una chiamata per riscrivere le stesse
// cose (regola chiesta dal lettore). Se invece e' tornato in scena, e'
// vecchia e va rifatta.
//
// Si guarda solo il libro aperto, e solo il tratto letto DA ALLORA: e'
// l'unico pezzo di storia che si e' mosso.
async function nuoveDaEpub(libro, re, da, a) {
  const blob = await getFile(libro.id);
  if (!blob) return true;
  const { default: ePub } = await import("epubjs");
  const eb = ePub(await blob.arrayBuffer());
  try {
    await eb.ready;
    const cfi = new ePub.CFI();
    const spina = eb.spine.spineItems;
    for (let i = 0; i < spina.length; i++) {
      const item = spina[i];
      const inizio = `epubcfi(${item.cfiBase}!/0)`;
      try {
        // i capitoli che cominciano oltre il segno di adesso non li hai letti
        if (cfi.compare(inizio, a) > 0) break;
        // e quelli che finiscono prima di «allora» sono roba gia' pesata:
        // se il capitolo dopo comincia prima di «allora», questo e' tutto dietro
        const dopo = spina[i + 1];
        if (dopo && cfi.compare(`epubcfi(${dopo.cfiBase}!/0)`, da) <= 0) continue;
      } catch { /* segni illeggibili: si guarda dentro, per sicurezza */ }
      try {
        await item.load(eb.load.bind(eb));
        const doc = item.document;
        if (doc?.body) {
          const walker = doc.createTreeWalker(doc.body, 4);
          let node;
          while ((node = walker.nextNode())) {
            const text = node.textContent;
            if (!text || !text.trim()) continue;
            re.lastIndex = 0;
            const m = re.exec(text);
            if (!m) continue;
            try {
              const range = doc.createRange();
              range.setStart(node, m.index);
              range.setEnd(node, m.index + m[0].length);
              const c = item.cfiFromRange(range);
              if (cfi.compare(c, da) > 0 && cfi.compare(c, a) <= 0) return true;
            } catch { /* range fuori misura: si tira dritto */ }
          }
        }
      } catch { /* capitolo illeggibile: nel dubbio si continua */ } finally {
        try { item.unload(); } catch { /* gia' scaricato */ }
      }
    }
    return false;
  } finally {
    try { eb.destroy(); } catch { /* gia' chiuso */ }
  }
}

async function nuoveDaPdf(libro, nomi, da, a) {
  const blob = await getFile(libro.id);
  if (!blob) return true;
  const mod = await import("./pdfThumb.js");
  const pdf = await mod.loadPdf(await blob.arrayBuffer());
  try {
    const cache = new Map();
    const cercati = [...new Set([].concat(nomi).flatMap(varianti))];
    const primo = Math.max(1, (parseInt(da, 10) || 0) + 1);
    const ultimo = Math.min(parseInt(a, 10) || 0, pdf.numPages);
    for (let n = primo; n <= ultimo; n++) {
      let testoPag;
      try {
        testoPag = await pageText(pdf, n, cache);
      } catch {
        continue;
      }
      // basta trovarne una: qui non si raccoglie, si risponde si'/no
      for (const v of cercati) {
        if (findMatches(testoPag, v, 1, 0).length) return true;
      }
    }
    return false;
  } finally {
    try { pdf.destroy(); } catch { /* gia' chiuso */ }
  }
}

// `da` = il segno di quando la scheda e' stata fatta, `a` = dove sei
// adesso. Nel dubbio si risponde «si'»: una scheda vecchia mostrata come
// nuova e' peggio di una chiamata in piu'.
export async function nuoveMenzioni(libro, nomi, da, a) {
  if (!libro || !da || !a || da === a) return !da || !a;
  const elenco = [].concat(nomi).filter(Boolean);
  const re = regexNome(elenco);
  if (!re) return true;
  try {
    if (libro.fileType === "pdf") {
      // sei tornato indietro: la scheda di allora sa cose che adesso non
      // hai ancora letto, e mostrarla sarebbe uno spoiler
      if ((parseInt(a, 10) || 0) < (parseInt(da, 10) || 0)) return true;
      return await nuoveDaPdf(libro, elenco, da, a);
    }
    const { default: ePub } = await import("epubjs");
    try {
      if (new ePub.CFI().compare(a, da) < 0) return true;
    } catch { /* segni non confrontabili: decide la scansione */ }
    return await nuoveDaEpub(libro, re, da, a);
  } catch {
    return true;
  }
}

async function daEpub(libro, re, fino) {
  // null = il tomo non e' su questo dispositivo, e va detto; [] = c'e' ma
  // il nome non ci compare. Confonderli faceva sparire un volume intero
  // dalla scheda senza che nessuno se ne accorgesse.
  const blob = await getFile(libro.id);
  if (!blob) return null;
  const { default: ePub } = await import("epubjs");
  const eb = ePub(await blob.arrayBuffer());
  let out = [];
  // quanto testo si e' scorso davvero: e' la misura del volume, e serve a
  // dargli la sua quota (un tomo con tre romanzi dentro non e' un volume
  // come gli altri)
  let esteso = 0;
  let visti = 0;
  let passo = 1;
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
          while ((node = walker.nextNode())) {
            const text = node.textContent;
            if (!text || !text.trim()) continue;
            esteso += text.length;
            re.lastIndex = 0;
            // una menzione per nodo: il paragrafo attorno e' lo stesso
            const m = re.exec(text);
            if (!m) continue;
            visti += 1;
            if (visti % passo) continue;
            try {
              const range = doc.createRange();
              range.setStart(node, m.index);
              range.setEnd(node, m.index + m[0].length);
              const c = item.cfiFromRange(range);
              if (fino && !dentro(c)) continue;
              out.push({ libro, cfi: c, testo: paragrafo(node, m[0]) });
              if (out.length >= MAX_MENZIONI) {
                out = out.filter((_, i) => i % 2 === 0);
                passo *= 2;
              }
            } catch { /* range fuori misura: si passa oltre */ }
          }
        }
      } catch { /* capitolo illeggibile: gli altri bastano */ } finally {
        try { item.unload(); } catch { /* gia' scaricato */ }
      }
    }
  } finally {
    try { eb.destroy(); } catch { /* gia' chiuso */ }
  }
  return out.map((m) => ({ ...m, esteso }));
}

async function daPdf(libro, nomi, fino) {
  const blob = await getFile(libro.id);
  if (!blob) return null;
  const mod = await import("./pdfThumb.js");
  const pdf = await mod.loadPdf(await blob.arrayBuffer());
  let out = [];
  let esteso = 0;
  let contate = 0;
  let passo = 1;
  try {
    // nei PDF il segno e' un numero di pagina: le pagine oltre non si
    // leggono proprio, ed e' anche questo che rende giusti gli «ultimi»
    const limite = fino ? Math.min(parseInt(fino, 10) || pdf.numPages, pdf.numPages) : pdf.numPages;
    const cache = new Map();
    const cercati = [...new Set([].concat(nomi).flatMap(varianti))];
    for (let n = 1; n <= limite; n++) {
      let testoPag;
      try {
        testoPag = await pageText(pdf, n, cache);
      } catch {
        continue;
      }
      esteso += testoPag.length;
      const visti = new Set();
      for (const v of cercati) {
        for (const m of findMatches(testoPag, v, 2, 220)) {
          const chiave = `${m.before.slice(-24)}|${m.hit}`;
          if (visti.has(chiave)) continue;
          visti.add(chiave);
          contate += 1;
          if (contate % passo) continue;
          out.push({
            libro,
            cfi: String(n),
            dove: `pag. ${n}`,
            testo: `${m.before}${m.hit}${m.after}`.trim(),
          });
          if (out.length >= MAX_MENZIONI) {
            out = out.filter((_, i) => i % 2 === 0);
            passo *= 2;
          }
        }
      }
    }
  } finally {
    try { pdf.destroy(); } catch { /* gia' chiuso */ }
  }
  return out.map((m) => ({ ...m, esteso }));
}

// GLI ALTRI NOMI DELLA STESSA PERSONA.
//
// Si cercano SOLO nel volume che il lettore ha aperto, e fin dove e'
// arrivato. Non e' una rinuncia: la parola l'ha toccata su quella pagina,
// quindi in quel volume c'e' di sicuro, ed e' li' che il libro la presenta
// per esteso. Aprire tutta la saga per trovare un cognome vorrebbe dire
// raddoppiare l'attesa su ogni scheda.
//
// E' una passata di sola conta — niente CFI, niente paragrafi — quindi costa
// una frazione della raccolta vera. Nel capitolo dove sta il segno si legge
// tutto il capitolo: un nome non e' un fatto, e i passaggi restano comunque
// tagliati sul segno.
async function aliasDaEpub(libro, reg, fino) {
  const blob = await getFile(libro.id);
  if (!blob) return;
  const { default: ePub } = await import("epubjs");
  const eb = ePub(await blob.arrayBuffer());
  try {
    await eb.ready;
    const cfi = new ePub.CFI();
    for (const item of eb.spine.spineItems) {
      if (fino) {
        try {
          if (cfi.compare(`epubcfi(${item.cfiBase}!/0)`, fino) > 0) break;
        } catch { /* base illeggibile: si tira dritto */ }
      }
      try {
        await item.load(eb.load.bind(eb));
        annota(reg, item.document?.body?.textContent);
      } catch { /* capitolo illeggibile: gli altri bastano */ } finally {
        try { item.unload(); } catch { /* gia' scaricato */ }
      }
    }
  } finally {
    try { eb.destroy(); } catch { /* gia' chiuso */ }
  }
}

async function aliasDaPdf(libro, reg, fino) {
  const blob = await getFile(libro.id);
  if (!blob) return;
  const mod = await import("./pdfThumb.js");
  const pdf = await mod.loadPdf(await blob.arrayBuffer());
  try {
    const limite = fino ? Math.min(parseInt(fino, 10) || pdf.numPages, pdf.numPages) : pdf.numPages;
    const cache = new Map();
    for (let n = 1; n <= limite; n++) {
      try {
        annota(reg, await pageText(pdf, n, cache));
      } catch { /* pagina illeggibile: le altre bastano */ }
    }
  } finally {
    try { pdf.destroy(); } catch { /* gia' chiuso */ }
  }
}

export async function trovaAlias(nome, tappa) {
  if (!tappa?.libro) return [];
  const reg = nuovoRegistro(nome);
  try {
    const fino = tappa.tutto ? null : tappa.fino;
    if (tappa.libro.fileType === "pdf") await aliasDaPdf(tappa.libro, reg, fino);
    else await aliasDaEpub(tappa.libro, reg, fino);
  } catch {
    return [];
  }
  return decidi(reg);
}

// I TOMI CHE NON SONO SU QUESTO DISPOSITIVO SI DICHIARANO.
//
// I byte di un libro possono stare solo nel cloud: `getFile` allora non
// torna nulla e quel volume non viene sfogliato. Prima succedeva in
// silenzio, e la scheda continuava a dichiarare nella provenienza un
// volume che non era mai stato aperto — il lettore leggeva «basata su
// tutta la saga» mentre la risposta veniva da un libro solo. Come la
// ricerca in biblioteca, i tomi lontani si contano e si dicono; scaricarli
// per una domanda sola, su una connessione da tablet, non si fa.
export async function raccogliPassaggi(nomi, tappe, { vivo } = {}) {
  const attivo = vivo || (() => true);
  const tutti = [];
  const lontani = [];
  const elenco = [].concat(nomi);
  const re = regexNome(elenco);
  if (!re) return { tutti, lontani };
  // un tomo per volta, come la ricerca in biblioteca: su un tablet aprirli
  // tutti insieme vuol dire farsi chiudere la scheda
  for (const t of tappe) {
    if (!attivo()) break;
    try {
      const pezzi =
        t.libro.fileType === "pdf"
          ? await daPdf(t.libro, elenco, t.tutto ? null : t.fino)
          : await daEpub(t.libro, re, t.tutto ? null : t.fino);
      // niente byte, niente lettura: e' un volume muto, non un volume
      // dove il personaggio non compare
      if (pezzi === null) lontani.push(t.libro);
      else tutti.push(...pezzi);
    } catch {
      /* tomo che non si apre: gli altri bastano */
      lontani.push(t.libro);
    }
  }
  return { tutti, lontani };
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

// Ai volumi finiti la quota si da' UNO PER UNO, a giri: un posto a testa
// finche' la quota non si esaurisce, e chi non ha piu' menzioni lascia il
// suo giro ai volumi ricchi. Con una lista sola, il volume dove il
// personaggio e' protagonista si mangiava la quota di quelli dove compare
// di sfuggita — ed erano proprio gli incontri che la scheda non raccontava.
// QUANTI LIBRI SONO, non quanti file.
//
// Un cofanetto e' un file solo e tre romanzi: contarlo per uno voleva dire
// dare a tre libri la quota di uno. Si misura in «volumi tipo», e il
// volume tipo e' la MEDIANA di quelli che il lettore ha finito — cosi' non
// serve sapere quanto e' lungo un romanzo, lo dice la sua biblioteca. La
// mediana regge anche se un tomo e' enorme o se una raccolta e' minuta.
function quantiLibri(passaggi, idCorrente) {
  const misure = new Map();
  for (const m of passaggi) {
    if (m.libro.id === idCorrente) continue;
    if (!misure.has(m.libro.id)) misure.set(m.libro.id, Math.max(1, m.esteso || 1));
  }
  const e = [...misure.values()];
  if (!e.length) return 0;
  const ordinate = [...e].sort((a, b) => a - b);
  const unita = ordinate[Math.floor(ordinate.length / 2)];
  return e.reduce((n, x) => n + Math.max(1, Math.round(x / unita)), 0);
}

// E LA QUOTA E' A PESO, NON A TESTA.
//
// Un cofanetto che tiene dentro tre romanzi aveva gli stessi posti di una
// raccolta di racconti, e gli incontri di la' non arrivavano nella scheda.
//
// Il peso e' QUANTO DEL PERSONAGGIO c'e' in quel volume — le sue menzioni,
// gia' ripulite dai doppioni — non quanto e' lungo il libro. Si era
// provato con la lunghezza (`esteso`, che resta a dire quanti libri tiene
// un file), ma su una scheda-personaggio e' la misura sbagliata: il
// cofanetto vinceva perche' e' spesso, e il volume dove il personaggio e'
// PROTAGONISTA prendeva un quarto dei suoi posti (segnalato dal lettore
// su Best Served Cold e Monza Murcatto). Dove compare di piu', li' c'e'
// la sua storia.
function perVolume(prima, n) {
  if (n <= 0 || !prima.length) return [];
  const ordine = [...new Set(prima.map((m) => m.libro.id))];
  const gruppi = ordine.map((id) => prima.filter((m) => m.libro.id === id));
  const pesi = gruppi.map((g) => g.length);
  const somma = pesi.reduce((a, b) => a + b, 0);
  // un posto garantito a testa finche' i posti bastano: un volume dove il
  // personaggio compare di sfuggita va detto lo stesso, ed e' proprio
  // l'incontro che il lettore non ricorda
  const minimo = n >= gruppi.length ? 1 : 0;
  const conteggi = gruppi.map((g, i) =>
    Math.min(g.length, Math.max(minimo, Math.round((n * pesi[i]) / somma)))
  );
  let totale = conteggi.reduce((a, b) => a + b, 0);
  // l'avanzo di chi non ha piu' menzioni passa agli altri, a giri
  while (totale < n) {
    let dato = false;
    for (let i = 0; i < gruppi.length && totale < n; i++) {
      if (conteggi[i] < gruppi[i].length) {
        conteggi[i] += 1;
        totale += 1;
        dato = true;
      }
    }
    if (!dato) break;
  }
  // e se l'arrotondamento ha sforato, si toglie a chi ne ha di piu'
  while (totale > n) {
    const i = conteggi.indexOf(Math.max(...conteggi));
    if (conteggi[i] <= minimo) break;
    conteggi[i] -= 1;
    totale -= 1;
  }
  return gruppi.flatMap((g, i) => sparsi(g, conteggi[i]));
}

// La quota si spartisce fra il volume aperto e quelli di prima, e il volume
// aperto la sua ce l'ha sempre: e' li' che sta la premessa del libro che il
// lettore ha in mano. Quello che un lato non usa passa all'altro.
export function scegliPassaggi(tutti, idCorrente) {
  const puliti = ripulisci(tutti);
  const ricchi = puliti.filter((m) => m.testo.length >= SOSTANZA);
  const perQui = DA_CAPO + DA_MEZZO + DA_FONDO;
  const totale = perQui + Math.min(quantiLibri(puliti, idCorrente) * DA_VOLUME_PRIMA, MAX_PRIMA);
  // se di passaggi sostanziosi non ce n'e' abbastanza, meglio i magri che
  // il silenzio
  const base = ricchi.length >= totale ? ricchi : puliti;
  if (base.length <= totale) return base;

  // NEL LIBRO APERTO IL PERSONAGGIO PUO' NON ESSERE ANCORA COMPARSO.
  //
  // Succede sempre quando un libro e' appena cominciato, ed e' proprio
  // allora che la scheda serve di piu'. Prima, in quel caso, si buttava
  // via tutta la spartizione per volume e si trattava la frontiera come
  // se fosse un volume solo: il tomo con piu' menzioni si prendeva quasi
  // tutti i posti e i volumi dove il personaggio e' PROTAGONISTA
  // sparivano dalla scheda (segnalato: «perche' non hai considerato Best
  // Served Cold e il suo ruolo con Monza?»).
  //
  // Il rimedio: il ruolo di «volume dove sei adesso» passa all'ULTIMO in
  // cui compare — e' li' che l'hai lasciato — e tutti quelli prima si
  // spartiscono la loro quota a peso, come sempre.
  const qui = idCorrente ? base.filter((m) => m.libro.id === idCorrente) : [];
  const idFinale = qui.length ? idCorrente : base[base.length - 1]?.libro.id;
  const ultimo = qui.length ? qui : base.filter((m) => m.libro.id === idFinale);
  const prima = base.filter((m) => m.libro.id !== idFinale);
  if (!ultimo.length) return volumeAperto(base, perQui);

  const nPrima = Math.min(prima.length, totale - Math.min(ultimo.length, perQui));
  const nUltimo = Math.min(ultimo.length, totale - nPrima);
  return [...perVolume(prima, nPrima), ...volumeAperto(ultimo, nUltimo)];
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

// Il giro intero, uguale per i due reader: cambia solo da dove arriva il
// segno vivo (CFI nell'EPUB, numero di pagina nel PDF).
export async function schedaChiE({ nome, book, libri, statusOf, cfiOf, vivo, passo }) {
  const tappe = frontiera(book, libri, { statusOf, cfiOf });
  passo({ nome, fase: "nomi", tappe });
  // prima gli ALTRI nomi: nel libro la stessa persona e' anche il suo cognome
  // e il suo soprannome, e cercando solo la parola toccata meta' della sua
  // storia non verrebbe raccolta
  const alias = await trovaAlias(nome, tappe[tappe.length - 1]);
  if (!vivo()) return null;
  passo({ nome, alias, fase: "cerco", tappe });
  const { tutti, lontani } = await raccogliPassaggi([nome, ...alias], tappe, { vivo });
  const scelti = scegliPassaggi(tutti, book.id);
  if (!vivo()) return null;
  if (!scelti.length) return { nome, alias, fase: "vuoto", tappe, lontani, passaggi: [] };
  passo({ nome, alias, fase: "chiedo", tappe, lontani, passaggi: scelti });
  const res = await chiediChiE({ nome, alias, passaggi: scelti, tappe });
  if (!vivo()) return null;
  return {
    nome,
    alias,
    fase: res.answer ? "fatto" : "errore",
    tappe,
    lontani,
    passaggi: scelti,
    ...res,
  };
}

export async function chiediChiE({ nome, alias = [], passaggi, tappe }, fetcher) {
  if (!getOracleKey()) return { error: "chiave" };
  if (!passaggi.length) return { error: "nessunPassaggio" };
  const eti = etichette(tappe);
  const righe = [`Il lettore chiede: chi è «${nome}»?`];
  // gli altri nomi vengono dal testo che il lettore ha letto, non da fuori:
  // dirglieli non apre nessuna porta, e senza di quelli meta' dei passaggi
  // sembrerebbero parlare di un'altra persona
  if (alias.length) {
    righe.push(
      `Nei passaggi la stessa persona è chiamata anche: ${alias.map((a) => `«${a}»`).join(", ")}. ` +
        "Sono tutti lei: trattali come un nome solo."
    );
  }
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
  return chiedi({ system: SISTEMA, user: righe.join("\n"), tetto: TETTO_SCHEDA }, fetcher);
}
