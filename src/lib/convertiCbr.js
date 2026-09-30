import { fraseConversione } from "./fumetto.js";
import { fraseCarico } from "./driveCore.js";

// TUTTI I CBR IN CBZ (chiesto dal lettore davanti a un CBR da 219 MB che
// scendeva intero a ogni apertura: «fai la prima, anche tutti insieme dalla
// manutenzione»). Un CBR da Drive non ha un indice: per trovare una pagina
// bisogna camminare l'archivio, quindi lo si scarica intero, e ogni volta.
// Un CBZ ha l'indice in coda e si legge a pezzi. La conversione
// (`convertiLibroInCbz`) costa UNA discesa, quella che si pagava comunque a
// ogni apertura. Qui le decisioni del giro, senza rete: si provano in Node.

// si converte un CBR i cui byte stanno da qualche parte, qui o su Drive: un
// libro di cui resta la sola scheda non ha niente da convertire
export function cbrDaConvertire(libri, { qui = new Set(), suDrive = new Set() } = {}) {
  return (libri || []).filter((b) => b?.fileType === "cbr" && (qui.has(b.id) || suDrive.has(b.id)));
}

// la chiave di Google scaduta non e' un intoppo di UN libro: lo sarebbe di
// tutti quelli dopo, quindi ferma il giro e aspetta un tocco
const chiaveScaduta = (e) => e?.name === "DriveScollegato" || /chiave di Google Drive/i.test(e?.message || "");

// Uno alla volta: due conversioni insieme si dividerebbero la rete e la
// memoria. Un intoppo su un libro e' di quel libro (la regola del giro della
// sincronizzazione), e quel che e' convertito resta convertito.
export async function convertiTutti(libri, { converti, applica, vivo = () => true, onProgress }) {
  const esito = { convertiti: 0, falliti: [], fermato: false, chiave: false };
  const totale = libri.length;
  for (const [i, b] of libri.entries()) {
    if (!vivo()) {
      esito.fermato = true;
      break;
    }
    onProgress?.({ i, totale, titolo: b.title, passo: null });
    try {
      const patch = await converti(b, (passo) => onProgress?.({ i, totale, titolo: b.title, passo }));
      applica(b.id, patch);
      esito.convertiti += 1;
    } catch (e) {
      if (chiaveScaduta(e)) {
        esito.chiave = true;
        break;
      }
      esito.falliti.push({ titolo: b.title, perche: e?.message || String(e) });
    }
  }
  return esito;
}

export function resocontoConversioni({ convertiti = 0, falliti = [], fermato = false, chiave = false } = {}) {
  const parti = [];
  if (convertiti) parti.push(`${convertiti === 1 ? "Un CBR convertito" : `${convertiti} CBR convertiti`} in CBZ ✓`);
  if (falliti.length) parti.push(`${falliti.length === 1 ? `«${falliti[0].titolo}» non si è convertito` : `${falliti.length} non si sono convertiti`} (${falliti[0].perche})`);
  if (chiave) parti.push("Google Drive aspetta un tocco: riprendi e continua da dove sei");
  if (fermato) parti.push("fermato: il resto lo converti riprendendo");
  return parti.join(" · ") || "Nessun CBR convertito";
}

// a che punto e' UNA conversione: prima la lettura del CBR, poi il CBZ che
// sale su Drive (`carico`)
export const fraseDelPasso = (p) => (p?.carico ? fraseCarico(p) : p?.misura ? fraseConversione(p) : "Preparo la conversione…");

// IL LAVORO SOPRAVVIVE ALL'APP CHIUSA (chiesto dal lettore: «tutti
// caricamenti e lavorazioni in generale possono sempre tenersi in
// background…?»). Un giro di settantacinque volumi dura ore, e il tablet
// congela una pagina messa in secondo piano; chiusa l'app, il giro muore.
// Si ricorda QUALI libri il lettore ha chiesto di convertire, e alla
// riapertura si offre di riprendere: quelli gia' convertiti sono CBZ e non
// ci sono piu' fra i CBR da fare, quindi si riparte dal primo che manca.
const LAVORO_KEY = "bc_lavoro_cbr";
export function ricordaLavoro(ids, st = globalThis.localStorage) {
  try {
    st.setItem(LAVORO_KEY, JSON.stringify(ids));
  } catch {
    /* senza memoria il lavoro non si riprende, ma si fa */
  }
}
export function lavoroSospeso(st = globalThis.localStorage) {
  try {
    const ids = JSON.parse(st.getItem(LAVORO_KEY));
    return Array.isArray(ids) && ids.length ? ids : null;
  } catch {
    return null;
  }
}
export function dimenticaLavoro(st = globalThis.localStorage) {
  try {
    st.removeItem(LAVORO_KEY);
  } catch {
    /* niente */
  }
}
// dei libri ricordati, quelli ancora da convertire, nell'ordine di prima
export function restantiDelLavoro(ids, daFare) {
  const perId = new Map((daFare || []).map((b) => [b.id, b]));
  return (ids || []).map((id) => perId.get(id)).filter(Boolean);
}

// la riga del lavoro in corso, fuori dalla Libreria
export const fraseLavoro = ({ i = 0, totale = 0, passo = null } = {}) =>
  `🔁 CBR in CBZ: ${i + 1} di ${totale}${passo?.carico ? " · sale su Drive" : passo?.misura ? ` · ${Math.floor((passo.letti / passo.misura) * 100)}%` : ""}`;

// COSA FARE, DECISO SULLO STATO DEI FILE e non sulla scheda (trovato al
// banco: chiusa l'app fra «il CBZ e' salito su Drive» e «la scheda dice
// CBZ», alla ripresa si provava a convertire uno zip, e falliva per
// sempre). `qui` e `lassu`: il formato vero dei byte sul tablet e su Drive
// ("cbr", "cbz", o null se li' non c'e'). Si legge da qui se c'e' (niente
// rete), si converte solo un RAR, e su Drive si sostituisce solo un RAR.
export function pianoConversione({ qui = null, lassu = null } = {}) {
  const sorgente = qui ? "qui" : lassu ? "lassu" : null;
  if (!sorgente) return null;
  return { sorgente, converti: (qui || lassu) !== "cbz", sostituisci: lassu === "cbr" };
}
