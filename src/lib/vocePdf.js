// LEGGI AD ALTA VOCE NEI PDF (scelto dal lettore fra le proposte). Le regole
// sono quelle dell'ePub (`lib/voce.js`): la pagina a schermo, a frasi, la
// frase che scavalca il bordo aspetta la pagina dopo, e la pagina si gira
// con lo stesso gesto del dito. Cambia da dove viene il testo: pdf.js lo da'
// per numero di pagina, riga per riga, e la pagina dopo si legge senza
// aspettare che epub.js abbia finito di voltare.
import { pezziDaLeggere, scegliVoce } from "./voce.js";

// IL TESTO DI UNA PAGINA dai pezzi di pdf.js (`getTextContent().items`).
// Ogni riga stampata finisce con `hasEOL`, e un a capo per `frasi` chiude
// la frase: lasciarli vorrebbe dire una pausa a ogni riga. Si va a capo solo
// dove c'e' uno stacco — un salto piu' largo del passo tipico delle righe
// di QUESTA pagina (l'interlinea cambia da un libro all'altro), un corpo
// diverso (un titolo), una colonna nuova — la parola spezzata col trattino
// si ricuce, e il numero di pagina da solo su una riga non si legge.
export function testoDellaPagina(items) {
  const righe = [];
  let r = { testo: "", y: null, h: 0 };
  const chiudi = () => {
    if (r.testo.trim()) righe.push({ ...r, testo: r.testo.replace(/\s+/g, " ").trim() });
    r = { testo: "", y: null, h: 0 };
  };
  for (const it of items || []) {
    const s = String(it?.str ?? "");
    if (s.trim() && r.y == null) {
      r.y = Number(it.transform?.[5]) || 0;
      r.h = Math.abs(Number(it.height)) || 0;
    }
    r.testo += s;
    if (it?.hasEOL) chiudi();
  }
  chiudi();
  const vere = righe.filter((r) => !/^\d{1,4}$/.test(r.testo));
  const salti = vere.slice(1).map((r, i) => vere[i].y - r.y).filter((x) => x > 0).sort((a, b) => a - b);
  const passo = salti.length ? salti[Math.floor((salti.length - 1) / 2)] : 0;
  let out = "";
  let prima = null;
  for (const riga of vere) {
    if (!prima) out = riga.testo;
    else {
      const salto = prima.y - riga.y;
      const corpo = Math.abs(prima.h - riga.h) > 0.2 * Math.max(prima.h, riga.h);
      if (salto < 0 || salto > passo * 1.4 || corpo) out += `\n${riga.testo}`;
      else if (/\p{L}-$/u.test(out) && /^\p{Ll}/u.test(riga.testo)) out = out.slice(0, -1) + riga.testo;
      else out += ` ${riga.testo}`;
    }
    prima = riga;
  }
  return out;
}

// LA LINGUA DAL TESTO: quella che il PDF dichiara e' spesso quella del
// programma che l'ha stampato (Chrome scrive «en-US» sotto un romanzo
// italiano), e una voce inglese che legge l'italiano non si ascolta. Si
// contano le parole piu' comuni di ogni lingua; nel dubbio, «».
const COMUNI = {
  it: ["il", "lo", "gli", "che", "non", "di", "e", "per", "una", "sono", "della", "del", "con", "come", "era", "nel"],
  en: ["the", "and", "of", "to", "that", "is", "was", "with", "he", "she", "it", "for", "his", "her", "not", "had"],
  fr: ["le", "les", "des", "est", "et", "une", "pas", "dans", "qui", "sur", "au", "du", "avec", "elle", "ce", "je"],
  es: ["el", "los", "las", "y", "una", "por", "con", "para", "del", "se", "su", "es", "no", "lo", "como", "pero"],
  de: ["der", "die", "das", "und", "ist", "nicht", "ein", "eine", "zu", "mit", "sich", "den", "auf", "dem", "ich", "sie"],
};
const INSIEMI = Object.entries(COMUNI).map(([l, p]) => [l, new Set(p)]);
export function linguaDelTesto(testo) {
  const parole = String(testo || "").toLowerCase().match(/\p{L}+/gu) || [];
  if (parole.length < 20) return "";
  const conti = INSIEMI.map(([l, set]) => [l, parole.filter((w) => set.has(w)).length]).sort((a, b) => b[1] - a[1]);
  const [[l, primo], [, secondo]] = conti;
  return primo >= parole.length * 0.08 && primo >= secondo * 1.5 ? l : "";
}

// Pagine di fila senza testo prima di arrendersi: un PDF fatto di sole
// scansioni sfoglierebbe il libro intero in un secondo, muto.
export const VUOTE_MAX = 3;

// LA VOCE DEL PDF. Il gettone e' il guardiano, come nell'ePub: ogni frase e
// ogni lettura sa di che giro e', e una fermata o una pagina girata a mano
// fanno cadere quel che era in volo. `vista(n)` si chiama a ogni pagina a
// schermo: se l'ha girata la voce la sta gia' leggendo, se l'ha girata il
// dito la voce ricomincia da li'.
export function creaVoce({
  sintesi,
  Frase,
  testo,
  gira,
  pagine,
  lingua = () => "",
  velocita = () => 1,
  cambia = () => {},
  avvisa = () => {},
  sottovoce = () => {},
}) {
  const v = { stato: null, frasi: [], i: 0, coda: "", gettone: 0, pagina: 0, vuote: 0, frase: null, girate: new Set(), lingua: "" };
  const metti = (s) => {
    v.stato = s;
    cambia(s);
  };

  function taci(perche) {
    v.gettone += 1;
    v.frasi = [];
    v.coda = "";
    v.vuote = 0;
    v.girate.clear();
    sintesi.cancel();
    sottovoce(false);
    metti(null);
    if (perche) avvisa(perche);
  }

  async function leggi(n) {
    const mio = ++v.gettone;
    v.pagina = n;
    let t;
    try {
      t = await testo(n);
    } catch {
      if (mio === v.gettone) taci("🔇 Non trovo il testo di questa pagina");
      return;
    }
    // una fermata, una pausa o il dito arrivati mentre il testo scendeva
    if (mio !== v.gettone) return;
    const ultima = n >= pagine();
    const { frasi, coda } = pezziDaLeggere(t, v.coda);
    v.frasi = ultima && coda ? [...frasi, coda] : frasi;
    v.coda = coda;
    v.i = 0;
    // la lingua si decide sul testo, e una pagina con poche parole non la cambia
    v.lingua = linguaDelTesto(t) || v.lingua;
    v.vuote = String(t || "").trim() ? 0 : v.vuote + 1;
    if (v.vuote >= VUOTE_MAX) return taci("🔇 Queste pagine sono immagini: non c'è testo da leggere");
    parla();
  }

  function parla() {
    if (v.stato !== "legge") return;
    if (v.i >= v.frasi.length) return avanti();
    const mio = v.gettone;
    const u = new Frase(v.frasi[v.i]);
    const l = v.lingua || lingua();
    u.lang = l || "en";
    const scelta = scegliVoce(sintesi.getVoices?.() || [], l);
    if (scelta) u.voice = scelta;
    u.rate = velocita();
    u.onend = () => {
      if (mio !== v.gettone) return;
      v.i += 1;
      parla();
    };
    u.onerror = (e) => {
      if (mio !== v.gettone || e?.error === "interrupted" || e?.error === "canceled") return;
      taci(`🔇 La voce si è fermata (${e?.error || "errore"})`);
    };
    // Chrome butta la frase se nessuno la tiene in mano, e `onend` non
    // arriva mai (vedi il reader ePub)
    v.frase = u;
    sintesi.speak(u);
  }

  function avanti() {
    if (v.pagina >= pagine()) return taci("📖 Fine del libro");
    // le pagine girate dalla voce si ricordano: la loro voltata arriva a
    // `vista` quando la voce puo' essere gia' oltre (pagine senza testo
    // passano in un lampo), e non e' il dito
    const n = v.pagina + 1;
    v.girate.add(n);
    gira(n);
    leggi(n);
  }

  return {
    get stato() {
      return v.stato;
    },
    comincia(n) {
      sintesi.cancel();
      metti("legge");
      sottovoce(true);
      // riprendere dopo la pausa: dalla frase in cui si era
      if (v.pagina === n && v.i < v.frasi.length) {
        v.gettone += 1;
        return parla();
      }
      v.coda = "";
      v.vuote = 0;
      leggi(n);
    },
    pausa() {
      v.gettone += 1;
      metti("pausa");
      sintesi.cancel();
      sottovoce(false);
    },
    taci,
    vista(n) {
      if (!v.stato) return;
      if (v.girate.has(n)) {
        // React puo' unire due voltate in un disegno: quelle prima di questa
        // non arriveranno piu'
        for (const g of v.girate) if (g <= n) v.girate.delete(g);
        return;
      }
      v.girate.clear();
      v.gettone += 1;
      sintesi.cancel();
      v.coda = "";
      v.frasi = [];
      v.vuote = 0;
      v.pagina = n;
      leggi(n);
    },
    // la frase in corso riparte alla velocita' nuova
    rifrasa() {
      if (v.stato !== "legge") return;
      v.gettone += 1;
      sintesi.cancel();
      parla();
    },
    chiudi() {
      v.gettone += 1;
      if (v.stato) {
        sintesi.cancel();
        sottovoce(false);
      }
    },
  };
}
