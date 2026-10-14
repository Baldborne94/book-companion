import { fraseConversione } from "./fumetto.js";

// TUTTI I CBR IN CBZ (chiesto dal lettore davanti a un CBR da 219 MB che
// scendeva intero a ogni apertura: «fai la prima, anche tutti insieme dalla
// manutenzione»). Un CBR non ha un indice: per trovare una pagina bisogna
// camminare l'archivio. Un CBZ ha l'indice in coda e si legge a pezzi. Qui
// le decisioni del giro, senza rete: si provano in Node.

// si converte un CBR i cui byte stanno qui: un libro di cui resta la sola
// scheda non ha niente da convertire
export function cbrDaConvertire(libri, { qui = new Set() } = {}) {
  return (libri || []).filter((b) => b?.fileType === "cbr" && qui.has(b.id));
}

// Uno alla volta: due conversioni insieme si dividerebbero la rete e la
// memoria. Un intoppo su un libro e' di quel libro (la regola del giro della
// sincronizzazione), e quel che e' convertito resta convertito.
export async function convertiTutti(libri, { converti, applica, vivo = () => true, onProgress }) {
  const esito = { convertiti: 0, falliti: [], fermato: false };
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
      esito.falliti.push({ titolo: b.title, perche: e?.message || String(e) });
    }
  }
  return esito;
}

export function resocontoConversioni({ convertiti = 0, falliti = [], fermato = false } = {}) {
  const parti = [];
  if (convertiti) parti.push(`${convertiti === 1 ? "Un CBR convertito" : `${convertiti} CBR convertiti`} in CBZ ✓`);
  if (falliti.length) parti.push(`${falliti.length === 1 ? `«${falliti[0].titolo}» non si è convertito` : `${falliti.length} non si sono convertiti`} (${falliti[0].perche})`);
  if (fermato) parti.push("fermato: il resto lo converti riprendendo");
  return parti.join(" · ") || "Nessun CBR convertito";
}

// a che punto e' UNA conversione
export const fraseDelPasso = (p) => (p?.misura ? fraseConversione(p) : "Preparo la conversione…");

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
export const fraseLavoro = ({ i = 0, totale = 0, passo = null, da = null } = {}) =>
  `🔁 CBR in CBZ${da === "disco" ? " sul disco" : ""}: ${i + 1} di ${totale}${passo?.misura ? ` · ${Math.floor((passo.letti / passo.misura) * 100)}%` : ""}`;

// COSA FARE, DECISO SUI BYTE e non sulla scheda (trovato al banco: chiusa
// l'app fra «il CBZ e' scritto» e «la scheda dice CBZ», alla ripresa si
// provava a convertire uno zip, e falliva per sempre). `qui` e' il formato
// vero dei byte sul dispositivo ("cbr", "cbz", o null se non ci sono).
export function pianoConversione({ qui = null } = {}) {
  if (!qui) return null;
  return { sorgente: "qui", converti: qui !== "cbz" };
}

// la riga di un'importazione (dal dispositivo o dal disco)
export function fraseImport({ fatti = 0, totale = 0, conversione = null } = {}) {
  const quale = totale > 1 ? `${fatti + 1} di ${totale}` : "";
  if (conversione) return `${quale ? `${quale} · ` : ""}${fraseConversione(conversione)}`;
  return quale ? `Rilego ${quale}…` : "Sto rilegando i tomi…";
}
