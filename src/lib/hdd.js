// IL DISCO DEL COMPUTER (`lib/disco.js`: controllare, riordinare, aggiungere
// dal disco). La cartella si sceglie con `showDirectoryPicker`, che c'e' in
// Chrome ed Edge sul computer: Firefox non ce l'ha.

// IL DISCO E' DEL COMPUTER (segnalato dal lettore con la Manutenzione del
// tablet: Chrome per Android ora sa scegliere una cartella, e i tasti
// dell'HDD copiavano i volumi nella memoria del tablet). Telefono e tablet
// non hanno l'HDD della biblioteca, anche se il browser sa scrivere.
const inTasca = (w) => {
  const n = w?.navigator || {};
  const ua = n.userAgent || "";
  return /Android|iPhone|iPad/i.test(ua) || (/Macintosh/.test(ua) && n.maxTouchPoints > 1);
};
export const hddPossibile = (w = globalThis) => typeof w?.showDirectoryPicker === "function" && !inTasca(w);

// i nomi che Windows rifiuta: un titolo puo' essere «Batman: Year One»
export function nomeSicuro(n) {
  const s = String(n ?? "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/[. ]+$/, "")
    .trim();
  return s || "_";
}

export async function cartellaDentro(radice, segmenti) {
  let c = radice;
  for (const s of segmenti || []) c = await c.getDirectoryHandle(nomeSicuro(s), { create: true });
  return c;
}
