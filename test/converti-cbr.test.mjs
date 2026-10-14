// TUTTI I CBR IN CBZ (`lib/convertiCbr.js`; chiesto dal lettore: «fai la
// prima, anche tutti insieme dalla manutenzione»). Il giro sbaglia in
// silenzio in tre modi: propone un libro che non ha byte qui, si ferma al
// primo intoppo (e gli altri restano CBR), o conta convertito chi non lo e'.
import { fraseConversione } from "../src/lib/fumetto.js";
import { cbrDaConvertire, convertiTutti, resocontoConversioni, fraseDelPasso, ricordaLavoro, lavoroSospeso, dimenticaLavoro, restantiDelLavoro, fraseLavoro, pianoConversione, fraseImport } from "../src/lib/convertiCbr.js";

export default async (t) => {
  const libri = [
    { id: "a", title: "Lobster Johnson", fileType: "cbr" },
    { id: "b", title: "Hellboy", fileType: "cbr" },
    { id: "c", title: "Saga", fileType: "cbz" },
    { id: "d", title: "Solo la scheda", fileType: "cbr" },
    { id: "e", title: "Un romanzo", fileType: "epub" },
  ];
  const scelti = cbrDaConvertire(libri, { qui: new Set(["b", "c", "e"]) });
  t.eq("i CBR coi byte qui", scelti.map((b) => b.id).join(), "b");
  t.eq("senza sapere niente, nessuno", cbrDaConvertire(libri).length, 0);

  // ---- il giro -------------------------------------------------------------------
  const applicati = [];
  const detti = [];
  const esito = await convertiTutti(libri.slice(0, 3), {
    converti: async (b, onProgress) => {
      onProgress({ letti: 1, misura: 2, pagine: 1 });
      if (b.id === "b") throw new Error("archivio rotto");
      return { fileType: "cbz", impronta: `imp-${b.id}` };
    },
    applica: (id, patch) => applicati.push([id, patch.fileType, patch.impronta]),
    onProgress: (p) => detti.push(p),
  });
  t.eq("un intoppo su un libro e' di quel libro: gli altri vanno avanti", applicati.map((x) => x[0]).join(), "a,c");
  t.eq("…e la scheda riceve quel che la conversione ha detto", applicati[0].join(), "a,cbz,imp-a");
  t.eq("si contano i convertiti", esito.convertiti, 2);
  t.eq("…e i falliti col perche'", `${esito.falliti[0]?.titolo}: ${esito.falliti[0]?.perche}`, "Hellboy: archivio rotto");
  t.c("l'avanzamento dice quale, e a che punto", detti.some((p) => p.i === 1 && p.totale === 3 && p.titolo === "Hellboy" && p.passo?.misura === 2));

  let giri = 0;
  const fermato = await convertiTutti(libri.slice(0, 3), {
    converti: async () => ({ fileType: "cbz" }),
    applica: () => {},
    vivo: () => giri++ < 1,
  });
  t.c("fermato a mano: quel che e' fatto resta, il resto no", fermato.fermato && fermato.convertiti === 1);

  // ---- le frasi ------------------------------------------------------------------
  t.eq("il resoconto", resocontoConversioni(esito), "2 CBR convertiti in CBZ ✓ · «Hellboy» non si è convertito (archivio rotto)");
  t.eq("…uno solo", resocontoConversioni({ convertiti: 1 }), "Un CBR convertito in CBZ ✓");
  t.c("…fermato si dice", /fermato/.test(resocontoConversioni(fermato)));
  t.eq("…niente da dire", resocontoConversioni({}), "Nessun CBR convertito");
  t.eq("il passo prima di cominciare", fraseDelPasso({}), "Preparo la conversione…");
  t.eq("il passo mentre legge il CBR", fraseDelPasso({ letti: 45, misura: 100, pagine: 12 }), "Converto in CBZ: 45% · 12 pagine");

  // ---- il lavoro ricordato: l'app chiusa a meta' riprende ---------------------------
  const mem = {};
  const st = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => (mem[k] = String(v)), removeItem: (k) => delete mem[k] };
  t.eq("niente ricordato, niente da riprendere", lavoroSospeso(st), null);
  ricordaLavoro(["a", "b", "x"], st);
  t.eq("i libri chiesti si ricordano", lavoroSospeso(st).join(), "a,b,x");
  const daFare = [libri[1], libri[0]];
  t.eq("restano quelli ancora CBR, nell'ordine di prima", restantiDelLavoro(lavoroSospeso(st), daFare).map((b) => b.id).join(), "a,b");
  t.eq("un libro gia' convertito (non piu' fra i da fare) non resta", restantiDelLavoro(["a", "b"], [libri[1]]).map((b) => b.id).join(), "b");
  dimenticaLavoro(st);
  t.eq("dimenticato, non si offre piu'", lavoroSospeso(st), null);
  mem.bc_lavoro_cbr = "[]";
  t.eq("una lista vuota non e' un lavoro", lavoroSospeso(st), null);
  mem.bc_lavoro_cbr = "{rotto";
  t.eq("un ricordo rotto non rompe l'avvio", lavoroSospeso(st), null);

  t.eq("la riga fuori dalla Libreria", fraseLavoro({ i: 11, totale: 75, passo: { letti: 396, misura: 1000 } }), "🔁 CBR in CBZ: 12 di 75 · 39%");
  // l'importazione: la riga che stava sul tasto della Libreria
  t.eq("un libro solo", fraseImport({ fatti: 0, totale: 1 }), "Sto rilegando i tomi…");
  t.eq("a che punto del giro", fraseImport({ fatti: 3, totale: 24 }), "Rilego 4 di 24…");
  t.eq("un CBR che si converte", fraseImport({ fatti: 3, totale: 24, conversione: { letti: 50, misura: 200, pagine: 30 } }), `4 di 24 · ${fraseConversione({ letti: 50, misura: 200, pagine: 30 })}`);
  t.eq("senza niente in mano", fraseImport(), "Sto rilegando i tomi…");
  t.eq("…prima di cominciare", fraseLavoro({ i: 0, totale: 2 }), "🔁 CBR in CBZ: 1 di 2");
  // il giro del disco si dice suo (segnalato: «perché i fermo qui non corrispondono?»)
  t.eq("…e quello del disco si dice", fraseLavoro({ i: 2, totale: 9, da: "disco" }), "🔁 CBR in CBZ sul disco: 3 di 9");

  // ---- cosa fare, dallo stato dei file ------------------------------------------------
  const piano = (x) => JSON.stringify(pianoConversione(x));
  t.eq("un CBR qui si converte", piano({ qui: "cbr" }), '{"sorgente":"qui","converti":true}');
  t.eq("chiusa a meta', i byte sono gia' CBZ: solo la scheda", piano({ qui: "cbz" }), '{"sorgente":"qui","converti":false}');
  t.eq("i byte non ci sono: niente", pianoConversione({}), null);
};
