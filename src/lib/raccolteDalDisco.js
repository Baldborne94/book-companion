import { nomeInBiblioteca } from "./sagaBooks.js";

// LE SCHEDE SENZA SAGA PRENDONO QUELLA DELLA LORO CARTELLA, quando il
// lettore lo conferma (`daRaccogliere` di `controllaDisco`: «0 (1)» dentro
// «Manga/BLAME!»). Si scrive solo cio' che manca: una serie o un numero gia'
// scritti a mano restano. La saga prende la grafia che la biblioteca usa gia'
// (`nomeInBiblioteca`), o «BLAME!» e «Blame!» sarebbero due ripiani.
export function raccogliDallaCartella(libri, voci) {
  const per = new Map((voci || []).map((v) => [v.libro.id, v]));
  return (libri || []).map((b) => {
    const v = per.get(b?.id);
    if (!v || String(b.saga || "").trim() || b.sagaTolta) return b;
    return {
      ...b,
      saga: nomeInBiblioteca(v.saga, libri),
      ...(v.ciclo && !String(b.series || "").trim() ? { series: v.ciclo } : {}),
      ...(b.sagaOrder == null && v.sagaOrder != null ? { sagaOrder: v.sagaOrder } : {}),
    };
  });
}

export const fraseRaccogliere = (n) =>
  n === 1
    ? "Un volume senza raccolta sta nella cartella della sua saga: mettilo in quella raccolta."
    : `${n} volumi senza raccolta stanno nella cartella della loro saga: mettili in quelle raccolte.`;
