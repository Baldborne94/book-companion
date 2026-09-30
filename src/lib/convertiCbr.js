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
