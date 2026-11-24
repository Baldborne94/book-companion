// LA COPERTINA GRANDE (`lib/copertinaGrande.js`): dal file del libro alla
// misura dello schermo, con la copertina salvata come ripiego e quella
// messa a mano che resta. Chiesto dal lettore: «riesci a rendermi
// l'immagine full HD?».
import { copertinaGrande, dimenticaGrande, aMano, segnaAMano, LATO_GRANDE, TENUTE } from "../src/lib/copertinaGrande.js";
import { LATO } from "../src/lib/copertina.js";

const memoria = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};

export default async function (t) {
  const grande = { size: 900000, nome: "grande" };
  const piccola = { size: 60000, nome: "piccola" };
  const conta = { file: 0, cover: 0, estrai: 0 };
  const deps = (opzioni = {}) => ({
    leggiFile: async (id) => (conta.file++, id === "senzafile" ? null : { id }),
    leggiCover: async () => (conta.cover++, piccola),
    estrai: async (libro, bytes, max) => (conta.estrai++, opzioni.estrai ? opzioni.estrai(libro, bytes, max) : grande),
    mano: () => false,
    ...opzioni,
  });

  dimenticaGrande();
  t.c("il tetto grande e' piu' dello schermo del tablet (1999) e piu' della copertina salvata", LATO_GRANDE >= 2000 && LATO_GRANDE > LATO);
  t.eq("dal file, alla misura grande", (await copertinaGrande({ id: "a" }, deps())).nome, "grande");
  t.eq("…e la misura chiesta e' quella grande", await copertinaGrande({ id: "a2" }, deps({ estrai: async (l, b, max) => ({ nome: String(max) }) })).then((b) => b.nome), String(LATO_GRANDE));
  t.eq("senza il file qui, quella salvata", (await copertinaGrande({ id: "senzafile" }, deps())).nome, "piccola");
  t.eq("un file senza copertina dentro, quella salvata", (await copertinaGrande({ id: "b" }, deps({ estrai: async () => null }))).nome, "piccola");
  t.eq("un'estrazione che esplode, quella salvata", (await copertinaGrande({ id: "c" }, deps({ estrai: async () => { throw new Error("boom"); } }))).nome, "piccola");
  t.eq("senza niente, niente", await copertinaGrande({ id: "d" }, deps({ estrai: async () => null, leggiCover: async () => null })), null);
  t.eq("senza libro, niente", await copertinaGrande(null, deps()), null);
  // la copertina messa a mano resta quella, senza nemmeno aprire il file
  const prima = conta.file;
  t.eq("messa a mano: la salvata, e il file non si apre", (await copertinaGrande({ id: "e" }, deps({ mano: () => true }))).nome, "piccola");
  t.eq("…davvero non si apre", conta.file, prima);
  t.eq("con un tetto non piu' grande della salvata non si estrae", (await copertinaGrande({ id: "f" }, deps({ max: LATO }))).nome, "piccola");
  // la memoria: lo stesso libro non si riestrae, e si tengono le ultime
  dimenticaGrande();
  await copertinaGrande({ id: "a" }, deps());
  const n = conta.estrai;
  await copertinaGrande({ id: "a" }, deps());
  t.eq("lo stesso libro non si riestrae", conta.estrai, n);
  dimenticaGrande("a");
  await copertinaGrande({ id: "a" }, deps());
  t.eq("dimenticata, si riestrae", conta.estrai, n + 1);
  dimenticaGrande();
  for (const id of ["x1", "x2", "x3"]) await copertinaGrande({ id }, deps());
  const m = conta.estrai;
  await copertinaGrande({ id: "x1" }, deps());
  t.eq(`oltre ${TENUTE} la piu' vecchia si lascia andare`, conta.estrai, m + 1);
  await copertinaGrande({ id: "x3" }, deps());
  t.eq("…e l'ultima resta", conta.estrai, m + 1);
  // il segno della mano
  const st = memoria();
  t.c("di partenza nessuna copertina e' a mano", !aMano("k", st));
  segnaAMano("k", true, st);
  t.c("segnata, lo resta", aMano("k", st));
  segnaAMano("k", false, st);
  t.c("tolta, non lo e' piu'", !aMano("k", st));
  t.c("una memoria rotta vuol dire non a mano", !aMano("k", { getItem: () => { throw new Error("no"); } }));
}
