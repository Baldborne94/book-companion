import { getFile } from "./bookStore.js";
import { searchBook } from "./epubSearch.js";
import { searchPdf } from "./pdfSearch.js";
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

// Due dall'inizio e quattro dal fondo: i primi dicono chi e' quando entra in
// scena, gli ultimi cosa sta facendo adesso. Il mezzo di una saga lunga
// aggiunge parole e non aggiunge risposta.
const DA_CAPO = 2;
const DA_FONDO = 4;
const PER_LIBRO = 12;

const SISTEMA = [
  "Sei l'Oracolo di un'app di lettura. Il lettore ti chiede chi è un",
  "personaggio (o cosa è un luogo, un oggetto, una casata) e ti mostra dei",
  "passaggi presi dai libri che ha letto FINORA.",
  "REGOLA ASSOLUTA: rispondi soltanto con ciò che si ricava da quei",
  "passaggi. Non usare nulla che sai di questo libro o di questa saga da",
  "altre fonti: quel che sai potrebbe venire da pagine che il lettore non ha",
  "ancora letto, e rovinargliele. Se i passaggi non bastano a dire chi è,",
  "dillo in una riga invece di inventare o completare a memoria.",
  "Non anticipare MAI cosa succederà. Rispondi in italiano, da 2 a 6 frasi,",
  "tono da amico che ha letto il libro con lui, senza markdown né elenchi.",
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

async function daEpub(libro, nome, fino) {
  const blob = await getFile(libro.id);
  if (!blob) return [];
  const { default: ePub } = await import("epubjs");
  const eb = ePub(await blob.arrayBuffer());
  try {
    await eb.ready;
    const trovati = await searchBook(eb, nome, PER_LIBRO * 3);
    const cfi = new ePub.CFI();
    // il taglio al segnalibro e' il cuore della faccenda: un passaggio che
    // sta una riga oltre e' un passaggio che non hai letto
    const dentro = fino
      ? trovati.filter((r) => {
          try { return cfi.compare(r.cfi, fino) <= 0; } catch { return false; }
        })
      : trovati;
    return dentro.slice(0, PER_LIBRO).map((r) => ({ libro, cfi: r.cfi, testo: r.excerpt }));
  } finally {
    try { eb.destroy(); } catch { /* gia' chiuso */ }
  }
}

async function daPdf(libro, nome, fino) {
  const blob = await getFile(libro.id);
  if (!blob) return [];
  const mod = await import("./pdfThumb.js");
  const pdf = await mod.loadPdf(await blob.arrayBuffer());
  try {
    const limite = fino ? parseInt(fino, 10) || 0 : 0;
    const { results } = await searchPdf(pdf, nome, { limit: PER_LIBRO * 3 });
    const dentro = limite ? results.filter((r) => r.page <= limite) : results;
    return dentro.slice(0, PER_LIBRO).map((r) => ({
      libro,
      cfi: String(r.page),
      dove: `pag. ${r.page}`,
      testo: `${r.before}${r.hit}${r.after}`.trim(),
    }));
  } finally {
    try { pdf.destroy(); } catch { /* gia' chiuso */ }
  }
}

export async function raccogliPassaggi(nome, tappe, { vivo } = {}) {
  const attivo = vivo || (() => true);
  const tutti = [];
  // un tomo per volta, come la ricerca in biblioteca: su un tablet aprirli
  // tutti insieme vuol dire farsi chiudere la scheda
  for (const t of tappe) {
    if (!attivo()) break;
    try {
      const pezzi =
        t.libro.fileType === "pdf"
          ? await daPdf(t.libro, nome, t.tutto ? null : t.fino)
          : await daEpub(t.libro, nome, t.tutto ? null : t.fino);
      tutti.push(...pezzi);
    } catch {
      /* tomo che non si apre: gli altri bastano */
    }
  }
  return tutti;
}

export function scegliPassaggi(tutti) {
  if (tutti.length <= DA_CAPO + DA_FONDO) return tutti;
  return [...tutti.slice(0, DA_CAPO), ...tutti.slice(-DA_FONDO)];
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
    `Ha letto ${tappe.length} ${tappe.length === 1 ? "volume" : "volumi"} di una saga, ` +
      "l'ultimo solo in parte. Non ti dico quale saga né quali titoli, apposta: " +
      "devi rispondere da questi passaggi e non da quello che ricordi."
  );
  righe.push("Passaggi in cui compare, in ordine di lettura:");
  passaggi.forEach((p, i) => {
    righe.push(`${i + 1}. [${eti.get(p.libro.id) || "Volume"}] «${p.testo}»`);
  });
  return chiedi({ system: SISTEMA, user: righe.join("\n") }, fetcher);
}
