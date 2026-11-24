// LE PAROLE PER OGNI ANELLO ROTTO di «Prima di cominciare». `perchePrimaTace`
// dice QUALE anello si è rotto (provato in `prima.test.mjs`); qui si prova
// che ogni anello abbia una frase che dice cosa manca E dove si mette a
// posto. Stava nella scheda del libro, fuori dalla portata di ogni test, e
// sbaglia in silenzio: una causa senza frase non alza errori, scrive
// «undefined» dentro una riga in italiano e il lettore legge un mistero
// spiegato con un altro mistero.
import { fraseTace, PERCHE_TACE, perchePrimaTace } from "../src/lib/trama.js";

const libro = (id, saga, ordine, extra = {}) => ({ id, title: id, saga, sagaOrder: ordine, ...extra });

export default async function (t) {
  // ---- OGNI CAUSA HA UNA FRASE, E NESSUNA DICE «undefined» ----------------
  const esempio = {
    soli: { perche: "soli", saga: "Malazan" },
    senzaNumero: { perche: "senzaNumero", saga: "Discworld" },
    numeri: { perche: "numeri", saga: "Discworld", ordine: 9 },
    stato: { perche: "stato", saga: "Discworld", quanti: 3 },
    serie: { perche: "serie", serie: "Rincewind", quanti: 3 },
  };
  t.eq("l'elenco delle cause è quello che la scheda conosce", PERCHE_TACE.join(","), Object.keys(esempio).join(","));
  for (const perche of PERCHE_TACE) {
    const f = fraseTace(esempio[perche]);
    t.c(`«${perche}» ha una frase`, typeof f === "string" && f.length > 20, f);
    t.c(`«${perche}» non scrive undefined`, !/undefined|null|NaN/.test(f), f);
  }

  // ---- OGNI FRASE DICE COSA MANCA E DOVE SI METTE A POSTO ------------------
  t.c("«soli» nomina la saga cercata", fraseTace(esempio.soli).includes("«Malazan»"));
  t.c("e manda a guardare le schede degli altri", /schede/.test(fraseTace(esempio.soli)));
  t.c("«senzaNumero» parla del numero di lettura", /numero di lettura/.test(fraseTace(esempio.senzaNumero)));
  t.c("«numeri» dice il numero di questo volume", /minore di 9\b/.test(fraseTace(esempio.numeri)));
  t.c("e la saga", fraseTace(esempio.numeri).includes("«Discworld»"));
  t.c("«stato» conta i volumi", /nessuno dei 3 volumi/.test(fraseTace(esempio.stato)));
  t.c("e dice cosa vuol dire «letto» qui", /«Letto»/.test(fraseTace(esempio.stato)) && /segno di pagina/.test(fraseTace(esempio.stato)));
  t.c("«serie» nomina la serie pretesa", fraseTace(esempio.serie).includes("«Rincewind»"));
  t.c("conta i volumi", /i 3 volumi precedenti/.test(fraseTace(esempio.serie)));
  t.c("e offre tutt'e due le strade: correggere la loro o svuotare questa", /correggi/.test(fraseTace(esempio.serie)) && /svuota/.test(fraseTace(esempio.serie)));

  // ---- IL SINGOLARE NON È «1 volumi» ----------------------------------------
  const unoStato = fraseTace({ perche: "stato", quanti: 1 });
  t.c("un volume solo, al singolare", /^il volume precedente/.test(unoStato), unoStato);
  t.c("e senza numero in vista", !/\b1\b/.test(unoStato), unoStato);
  const unaSerie = fraseTace({ perche: "serie", serie: "Rincewind", quanti: 1 });
  t.c("anche per la serie", /^il volume precedente letto dichiara/.test(unaSerie), unaSerie);
  t.c("e il plurale resta plurale a due", /^i 2 volumi precedenti letti dichiarano/.test(fraseTace({ perche: "serie", serie: "X", quanti: 2 })));

  // ---- UNA CAUSA CHE NON SI RICONOSCE NON SI TRAVESTE DA «serie» ----------
  // era il ramo di ripiego: un anello nuovo in `perchePrimaTace` senza
  // frase avrebbe scritto «dichiarano una Serie diversa da «undefined»»
  const ignota = fraseTace({ perche: "boh" });
  t.c("una causa ignota ha comunque una riga", typeof ignota === "string" && ignota.length > 20, ignota);
  t.c("che non parla di una serie che non c'entra", !/Serie diversa/.test(ignota), ignota);
  t.c("e non scrive undefined", !/undefined/.test(ignota), ignota);

  // ---- LE DUE FUNZIONI SI PARLANO: quel che l'una produce, l'altra sa dire
  // Gli stessi casi di `prima.test.mjs`, passati per intero dalla causa
  // alla frase: è l'unico modo di vedere che i campi che la frase legge
  // (saga, ordine, quanti, serie) sono quelli che la causa scrive.
  const eric = libro("eric", "Discworld", 9, { series: "Rincewind" });
  const letti = [
    libro("com", "Discworld", 1, { series: "Rincewind" }),
    libro("tlf", "Discworld", 2, { series: "Rincewind" }),
    libro("sourcery", "Discworld", 5, { series: "Rincewind" }),
  ];
  const stati = (mappa) => ({ statusOf: (id) => mappa[id] || "unread", cfiOf: () => null });
  const tuttiLetti = stati({ com: "read", tlf: "read", sourcery: "read" });
  const casi = [
    ["soli", perchePrimaTace(libro("x", "Malazan", 3), [eric, ...letti], tuttiLetti), /«Malazan»/],
    ["senzaNumero", perchePrimaTace(libro("x", "Discworld", null), [eric, ...letti], tuttiLetti), /numero di lettura/],
    ["numeri", perchePrimaTace(eric, [eric, ...letti.map((b) => ({ ...b, sagaOrder: null }))], tuttiLetti), /«Discworld».*minore di 9/],
    ["stato", perchePrimaTace(eric, [eric, ...letti], stati({})), /nessuno dei 3 volumi/],
    ["serie", perchePrimaTace(eric, [eric, ...letti.map((b) => ({ ...b, series: "The Witches" }))], tuttiLetti), /i 3 volumi.*«Rincewind»/],
  ];
  for (const [atteso, causa, forma] of casi) {
    t.eq(`la catena produce «${atteso}»`, causa?.perche, atteso);
    t.c(`ed è fra le cause note`, PERCHE_TACE.includes(causa?.perche));
    const f = fraseTace(causa);
    t.c(`e la frase di «${atteso}» porta i suoi numeri`, forma.test(f) && !/undefined/.test(f), f);
  }
}
