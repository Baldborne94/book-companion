// N ALLA VOLTA, e i risultati nell'ordine degli ingressi: uno per volta
// ogni richiesta aspetta la sua latenza con la banda ferma (il giro dei
// consigli durava quaranta secondi davanti a una pagina ferma; le copertine
// del primo giro di un telefono, novantanove).
export async function aGruppi(voci = [], fn, insieme = 4) {
  const out = new Array(voci.length);
  let prossima = 0;
  const lavora = async () => {
    while (prossima < voci.length) {
      const i = prossima++;
      out[i] = await fn(voci[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(insieme, voci.length) }, lavora));
  return out;
}
