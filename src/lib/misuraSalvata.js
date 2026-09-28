// LA MISURA DELLE PAGINE DICE DI QUALE FILE E'.
//
// Le posizioni che epub.js calcola (`loc_<id>` in IndexedDB) stavano
// scritte sotto il solo id del libro, quindi nessuno sapeva di QUALE file
// fossero — quello com'era o quello ricucito — e chi ricuciva doveva
// buttarle per sicurezza. Sul libro spezzato letto da Drive, che si ricuce
// in memoria a ogni apertura, voleva dire buttarle a ogni apertura: il conto
// delle pagine si rifaceva ogni volta anche se il ricucito era sempre lo
// stesso (misurato: «misuro le pagine…» acceso ~700 ms in piu' per ogni
// riapertura, col processore rallentato quattro volte).
//
// Adesso la misura porta la grandezza del file misurato (`di`), e una misura
// di un altro file si scarta da se'. Una misura scritta prima — una stringa
// nuda, senza grandezza — vale come prima: non si sa di chi e', e chi
// ricuce continua a buttarla.

export const misuraDaSalvare = (locations, byte) => ({ di: Number(byte) || 0, locations });

// quel che si da' a `locations.load`, o `null` se la misura non e' di
// questo file (o non c'e')
export function misuraBuona(salvata, byte) {
  if (salvata == null) return null;
  if (typeof salvata === "string") return salvata;
  if (typeof salvata !== "object" || salvata.locations == null) return null;
  return Number(salvata.di) === Number(byte) ? salvata.locations : null;
}

// chi ricuce in memoria butta solo cio' che non sa di chi e': una misura
// con la grandezza si scarta da se' al confronto
export const daButtareRicucendo = (salvata) => typeof salvata === "string";
