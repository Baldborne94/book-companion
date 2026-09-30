// UNA DISCESA PER FILE, ANCHE SE LA CHIEDONO IN DUE (trovato al banco
// riproducendo il CBR da Drive che «ci mette una vita a scaricarsi»:
// aprire un volume da 72 MB ne faceva scendere 144). Il lettore scarica il
// libro per mostrarlo, e intanto il libro diventa «in lettura» e il giro che
// tiene sul tablet i libri in lettura (`anticipaFile`) lo scarica di nuovo,
// in parallelo: due discese dello stesso file che si dividono la rete, e la
// prima pagina arriva al doppio del tempo. Adesso chi arriva mentre il file
// sta gia' scendendo si aggancia a quella discesa, e ne sente l'avanzamento.
export function unaPerChiave() {
  const inVolo = new Map();
  // `fai(avvisa)` avvia il lavoro e chiama `avvisa(passo)` mentre procede
  return (chiave, fai, { onProgress } = {}) => {
    let v = inVolo.get(chiave);
    if (!v) {
      const ascolta = new Set();
      v = { ascolta, promessa: null };
      v.promessa = Promise.resolve()
        .then(() => fai((passo) => ascolta.forEach((f) => f(passo))))
        .finally(() => inVolo.delete(chiave));
      inVolo.set(chiave, v);
    }
    if (onProgress) v.ascolta.add(onProgress);
    return v.promessa;
  };
}
