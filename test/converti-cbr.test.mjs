// TUTTI I CBR IN CBZ (`lib/convertiCbr.js`; chiesto dal lettore: «fai la
// prima, anche tutti insieme dalla manutenzione»). Il giro sbaglia in
// silenzio in quattro modi: propone un libro che non ha byte da nessuna
// parte, si ferma al primo intoppo (e gli altri restano CBR), va avanti a
// chiave scaduta (ogni libro dopo fallisce uguale), o conta convertito chi
// non lo e'.
import { cbrDaConvertire, convertiTutti, resocontoConversioni, fraseDelPasso, ricordaLavoro, lavoroSospeso, dimenticaLavoro, restantiDelLavoro, fraseLavoro, pianoConversione } from "../src/lib/convertiCbr.js";

export default async (t) => {
  const libri = [
    { id: "a", title: "Lobster Johnson", fileType: "cbr" },
    { id: "b", title: "Hellboy", fileType: "cbr" },
    { id: "c", title: "Saga", fileType: "cbz" },
    { id: "d", title: "Solo la scheda", fileType: "cbr" },
    { id: "e", title: "Un romanzo", fileType: "epub" },
  ];
  const scelti = cbrDaConvertire(libri, { qui: new Set(["b", "e"]), suDrive: new Set(["a", "c"]) });
  t.eq("i CBR coi byte qui o su Drive", scelti.map((b) => b.id).join(), "a,b");
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

  // la chiave scaduta ferma il giro: i libri dopo fallirebbero tutti uguali
  let provati = 0;
  const scollegato = Object.assign(new Error("Google Drive non collegato"), { name: "DriveScollegato" });
  const chiave = await convertiTutti(libri.slice(0, 3), {
    converti: async () => {
      provati += 1;
      throw scollegato;
    },
    applica: () => {},
  });
  t.c("chiave scaduta: il giro si ferma al primo", chiave.chiave && provati === 1);
  const aMeta = await convertiTutti(libri.slice(0, 2), {
    converti: async () => {
      throw new Error("la chiave di Google Drive e' scaduta a meta' conversione");
    },
    applica: () => {},
  });
  t.c("…anche quando scade a meta' conversione, nel worker", aMeta.chiave && !aMeta.falliti.length);

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
  t.c("…la chiave dice cosa fare", /aspetta un tocco/.test(resocontoConversioni(chiave)));
  t.c("…fermato si dice", /fermato/.test(resocontoConversioni(fermato)));
  t.eq("…niente da dire", resocontoConversioni({}), "Nessun CBR convertito");
  t.eq("il passo prima di cominciare", fraseDelPasso({}), "Preparo la conversione…");
  t.eq("il passo mentre legge il CBR", fraseDelPasso({ letti: 45, misura: 100, pagine: 12 }), "Converto in CBZ: 45% · 12 pagine");
  t.eq("il passo mentre il CBZ sale", fraseDelPasso({ carico: true, presi: 120 * 1048576, totale: 350 * 1048576 }), "Carico su Google Drive: 120 di 350 MB");

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
  t.eq("…mentre sale su Drive", fraseLavoro({ i: 0, totale: 2, passo: { carico: true, presi: 1, totale: 2 } }), "🔁 CBR in CBZ: 1 di 2 · sale su Drive");
  t.eq("…prima di cominciare", fraseLavoro({ i: 0, totale: 2 }), "🔁 CBR in CBZ: 1 di 2");

  // ---- cosa fare, dallo stato dei file ------------------------------------------------
  const piano = (x) => JSON.stringify(pianoConversione(x));
  t.eq("CBR solo su Drive: si legge da li', si converte, si sostituisce", piano({ lassu: "cbr" }), '{"sorgente":"lassu","converti":true,"sostituisci":true}');
  t.eq("CBR qui e su Drive: si legge da qui, niente rete per convertire", piano({ qui: "cbr", lassu: "cbr" }), '{"sorgente":"qui","converti":true,"sostituisci":true}');
  t.eq("CBR solo qui: si converte qui, Drive non si tocca", piano({ qui: "cbr" }), '{"sorgente":"qui","converti":true,"sostituisci":false}');
  t.eq("chiusa a meta', su Drive e' gia' CBZ: solo la scheda", piano({ lassu: "cbz" }), '{"sorgente":"lassu","converti":false,"sostituisci":false}');
  t.eq("convertito qui ma non salito: sale, senza riconvertire", piano({ qui: "cbz", lassu: "cbr" }), '{"sorgente":"qui","converti":false,"sostituisci":true}');
  t.eq("i byte non ci sono da nessuna parte: niente", pianoConversione({}), null);
};
