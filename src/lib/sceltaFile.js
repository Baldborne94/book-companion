// SCEGLIERE IL FILE DI UN LIBRO CHE QUI NON C'E' (chiesto dal lettore: «se
// clicco apri il libro puoi portarmi alle cartelle locali cosi posso gia
// decidere se importarlo da li»). Sul computer il selettore dei file parte
// dalla cartella del disco scelta l'ultima volta («🔍 Controlla il disco»
// usa lo stesso `id`); altrove (il tablet) resta l'input dei libri.
import { hddPossibile } from "./hdd.js";

export const ID_DISCO = "bc-hdd";
const TIPI = [{ description: "Libri e fumetti", accept: { "application/octet-stream": [".epub", ".pdf", ".cbz", ".cbr"] } }];

// null: questo browser non ha il selettore, si usa l'input. []: scelta annullata.
export async function scegliDalDisco(w = globalThis) {
  if (!hddPossibile(w)) return null;
  try {
    const scelti = await w.showOpenFilePicker({ id: ID_DISCO, types: TIPI });
    return await Promise.all(scelti.map((h) => h.getFile()));
  } catch (e) {
    return e?.name === "AbortError" ? [] : null;
  }
}
