// GLI ULTIMI LIBRI LETTI DA LONTANO RESTANO IN MEMORIA PER LA SESSIONE.
//
// Da quando i libri si leggono da Drive senza scriverli sul tablet (la
// «situazione pulita»), ogni apertura di un libro che qui non c'e' e' uno
// scaricamento intero — anche se l'hai chiuso un minuto fa per guardare
// l'indice della Libreria o la scheda del libro dopo. Qui si tengono gli
// ultimi file presi, in memoria e SOLO in memoria: riaprirli e' immediato,
// e il tablet resta pulito come il lettore l'ha chiesto. Chiusa l'app, se
// ne vanno.
//
// Tre regole, e sono quelle che sbagliano in silenzio:
// 1. IL FILE DEV'ESSERE LO STESSO: si tiene con la firma della sua copia
//    lassu' (l'id su Drive e la misura), e un file cambiato lassu' — un
//    libro sostituito a mano, rimesso su Drive — non si serve dalla memoria.
// 2. LA MEMORIA HA UN TETTO, in libri e in byte: un tablet che tiene in
//    memoria cinque fumetti da un giga si fa chiudere la scheda. Chi e'
//    troppo grande da solo non si tiene affatto.
// 3. SI TIENE CHI E' STATO USATO PER ULTIMO: riaprire un libro lo rimette
//    in cima, e al tetto se ne va quello toccato meno di recente.

export const MAX_LIBRI = 3;
export const MAX_BYTE = 120 * 1024 * 1024;

export function nuovaMemoria({ maxLibri = MAX_LIBRI, maxByte = MAX_BYTE } = {}) {
  const voci = new Map(); // id -> { firma, blob, byte } — l'ordine e' quello d'uso
  const misura = (blob) => Number(blob?.size) || 0;
  return {
    prendi(id, firma) {
      const v = voci.get(id);
      if (!v || v.firma !== firma) return null;
      voci.delete(id);
      voci.set(id, v);
      return v.blob;
    },
    tieni(id, firma, blob) {
      if (!id || !blob) return;
      const byte = misura(blob);
      voci.delete(id);
      if (!byte || byte > maxByte) return;
      voci.set(id, { firma, blob, byte });
      let totale = 0;
      for (const x of voci.values()) totale += x.byte;
      for (const [k, x] of voci) {
        if (voci.size <= maxLibri && totale <= maxByte) break;
        voci.delete(k);
        totale -= x.byte;
      }
    },
    dimentica(id) {
      voci.delete(id);
    },
    ids: () => [...voci.keys()],
  };
}

// la firma della copia lassu': cambia se il file su Drive e' un altro
export const firmaLontana = (voce) => `${voce?.id || ""}:${voce?.byte ?? ""}`;
