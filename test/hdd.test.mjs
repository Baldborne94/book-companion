// SPOSTARE SULL'HDD (chiesto dal lettore per lasciare i due tera di Drive):
// il file scende dritto sul disco, si guarda che sia arrivato intero, e solo
// allora la scheda resta senza file e Drive lo butta nel cestino.
import { daSpostareSuHdd } from "../src/lib/driveCore.js";
import { spostaSuHdd, nomeSicuro, hddPossibile, percheNoHdd, fraseHdd } from "../src/lib/hdd.js";

// un disco finto con la forma di File System Access: cartelle, file, e una
// scrittura che arriva nel file solo a `close` (come in Chrome)
function cartellaFinta(nome = "") {
  const dentro = new Map();
  const d = {
    kind: "directory",
    name: nome,
    dentro,
    async getDirectoryHandle(n, { create = false } = {}) {
      if (!dentro.has(n)) {
        if (!create) throw Object.assign(new Error("no"), { name: "NotFoundError" });
        dentro.set(n, cartellaFinta(n));
      }
      return dentro.get(n);
    },
    async getFileHandle(n, { create = false } = {}) {
      if (!dentro.has(n)) {
        if (!create) throw Object.assign(new Error("no"), { name: "NotFoundError" });
        dentro.set(n, fileFinto(n));
      }
      return dentro.get(n);
    },
  };
  return d;
}
function fileFinto(nome, byte = new Uint8Array(0)) {
  const f = {
    kind: "file",
    name: nome,
    byte,
    async getFile() {
      return { size: f.byte.length };
    },
    async createWritable() {
      const pezzi = [];
      return new WritableStream({
        write(p) {
          pezzi.push(p);
        },
        close() {
          const n = pezzi.reduce((a, p) => a + p.length, 0);
          const tutto = new Uint8Array(n);
          let o = 0;
          for (const p of pezzi) {
            tutto.set(p, o);
            o += p.length;
          }
          f.byte = tutto;
        },
      });
    },
  };
  return f;
}
const percorso = async (radice, ...nomi) => {
  let c = radice;
  for (const n of nomi.slice(0, -1)) c = c.dentro.get(n);
  return c?.dentro.get(nomi.at(-1));
};
const risposta = (n, { corto = 0 } = {}) => new Response(new Uint8Array(n - corto).fill(7));

export default async (t) => {
  const cartelle = [
    { id: "R", name: "book-companion", parents: ["root"] },
    { id: "F", name: "Fumetti", parents: ["R"] },
    { id: "H", name: "Hellboy", parents: ["F"] },
    { id: "X", name: "Altrove", parents: ["root"] },
  ];
  const file = [
    { id: "f1", name: "Hellboy v01.cbz", size: "3000", parents: ["H"] },
    { id: "f2", name: "Hellboy: Year 2.cbz", size: "2000", parents: ["H"] },
    { id: "f3", name: "Sciolto.epub", size: "500", parents: ["X"] },
    { id: "f4", name: "Senza peso.pdf", parents: ["H"] },
    { id: "f5", name: "Buttato.cbz", size: "10", parents: ["H"], trashed: true },
  ];
  const libri = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }, { id: "e" }, { id: "g" }];
  const mappa = { a: { id: "f1" }, b: { id: "f2" }, c: { id: "f3" }, d: { id: "f4" }, e: { id: "f5" }, g: { id: "sparito" } };
  const voci = daSpostareSuHdd(libri, mappa, file, cartelle);
  t.eq("si spostano i file che ci sono e hanno un peso", voci.map((v) => v.bookId).join(), "a,b,c");
  t.eq("le cartelle sotto book-companion si rifanno", voci[0].cartelle.join("/"), "Fumetti/Hellboy");
  t.eq("fuori da book-companion il percorso è intero", voci[2].cartelle.join("/"), "Altrove");
  t.eq("dice file, nome e peso", `${voci[0].fileId} ${voci[0].nome} ${voci[0].byte}`, "f1 Hellboy v01.cbz 3000");

  t.eq("i nomi che Windows rifiuta", nomeSicuro('Hellboy: Year 2?.cbz'), "Hellboy_ Year 2_.cbz");
  t.eq("niente punto in fondo", nomeSicuro("Fine. "), "Fine");
  t.c("senza showDirectoryPicker (Firefox) non si offre", !hddPossibile({}) && hddPossibile({ showDirectoryPicker() {} }));
  const ff = { navigator: { userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0" } };
  t.c("Firefox sul computer: si dice perché", /Chrome o Edge/.test(percheNoHdd(ff) || ""));
  t.c("col tasto possibile non si dice niente", percheNoHdd({ ...ff, showDirectoryPicker() {} }) === null);
  t.c("sul tablet non si dice niente", percheNoHdd({ navigator: { userAgent: "Mozilla/5.0 (Linux; Android 10; K) Chrome/154.0 Mobile Safari/537.36" } }) === null);
  t.c("nemmeno sull'iPad che si dice Mac", percheNoHdd({ navigator: { userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15", maxTouchPoints: 5 } }) === null);

  // il giro: scende, si guarda il peso, poi scheda e cestino in quest'ordine
  const radice = cartellaFinta();
  const fatto = [];
  const esito = await spostaSuHdd(voci, {
    radice,
    apri: async (id) => risposta(id === "f3" ? 500 : id === "f1" ? 3000 : 2000, { corto: id === "f2" ? 1 : 0 }),
    segna: async (v) => fatto.push(`segna ${v.bookId}`),
    cestina: async (v) => fatto.push(`cestina ${v.fileId}`),
  });
  t.eq("sul disco, nella sua cartella, intero", (await percorso(radice, "Fumetti", "Hellboy", "Hellboy v01.cbz"))?.byte.length, 3000);
  t.eq("prima la scheda, poi il cestino; chi non arriva intero resta su Drive", fatto.join(), "segna a,cestina f1,segna c,cestina f3");
  t.eq("e si dice", `${esito.fatti} ${esito.byte} ${esito.mancati.map((v) => v.bookId)}`, "2 3500 b");

  // ripreso dopo un giro fermato: il file gia' arrivato non riscende
  let scese = 0;
  const di = await spostaSuHdd([voci[0]], { radice, apri: async () => (scese++, risposta(3000)), segna: async () => {}, cestina: async () => {} });
  t.c("quel che è già sul disco non riscende", scese === 0 && di.fatti === 1);

  // un altro file con lo stesso nome non si copre
  const r2 = cartellaFinta();
  const sotto = await (await r2.getDirectoryHandle("Fumetti", { create: true })).getDirectoryHandle("Hellboy", { create: true });
  sotto.dentro.set("Hellboy v01.cbz", fileFinto("Hellboy v01.cbz", new Uint8Array(42)));
  await spostaSuHdd([voci[0]], { radice: r2, apri: async () => risposta(3000), segna: async () => {}, cestina: async () => {} });
  t.c("un file diverso con lo stesso nome resta, il nuovo si chiama (2)", sotto.dentro.get("Hellboy v01.cbz").byte.length === 42 && sotto.dentro.get("Hellboy v01 (2).cbz")?.byte.length === 3000);

  // il posto vuoto lasciato da una discesa andata storta si riusa
  const r3 = cartellaFinta();
  const s3 = await (await r3.getDirectoryHandle("Fumetti", { create: true })).getDirectoryHandle("Hellboy", { create: true });
  s3.dentro.set("Hellboy v01.cbz", fileFinto("Hellboy v01.cbz"));
  await spostaSuHdd([voci[0]], { radice: r3, apri: async () => risposta(3000), segna: async () => {}, cestina: async () => {} });
  t.c("un file vuoto si riempie, niente (2)", s3.dentro.get("Hellboy v01.cbz").byte.length === 3000 && !s3.dentro.has("Hellboy v01 (2).cbz"));

  // un intoppo e' di quel volume; il cestino che non riesce lascia il file in due posti
  const segnati = [];
  const e3 = await spostaSuHdd(voci, {
    radice: cartellaFinta(),
    apri: async (id) => {
      if (id === "f1") throw new Error("rete");
      return risposta(id === "f3" ? 500 : 2000);
    },
    segna: async (v) => segnati.push(v.bookId),
    cestina: async () => {
      throw new Error("403");
    },
  });
  t.eq("un intoppo è di quel volume", segnati.join(), "b,c");
  t.eq("il cestino che non riesce si dice", `${e3.restati.length} ${e3.byte}`, "2 0");

  // la chiave scaduta ferma il giro
  class Scollegato extends Error {}
  const e4 = await spostaSuHdd(voci, { radice: cartellaFinta(), apri: async () => { throw new Scollegato(); }, segna: async () => {}, cestina: async () => {}, ferma: (e) => e instanceof Scollegato });
  const visti = [];
  const e4b = await spostaSuHdd(voci, { radice: cartellaFinta(), apri: async (id) => risposta(id === "f3" ? 500 : id === "f1" ? 3000 : 2000), segna: async (v) => visti.push(v.bookId), cestina: async () => { throw new Scollegato(); }, ferma: (e) => e instanceof Scollegato });
  t.c("anche dal cestino: il volume è sul disco, il giro si ferma", e4b.scollegato && visti.join() === "a" && e4b.fatti === 1);
  t.c("scollegato ferma il giro", e4.scollegato instanceof Scollegato && e4.mancati.length === 0);

  // «Ferma»: a meta' discesa non si scrive niente e non si segna niente
  let vivo = true;
  const r5 = cartellaFinta();
  const segnati5 = [];
  const e5 = await spostaSuHdd([voci[0]], {
    radice: r5,
    vivo: () => vivo,
    apri: async () =>
      new Response(
        new ReadableStream({
          pull(c) {
            c.enqueue(new Uint8Array(1000));
            vivo = false;
          },
        })
      ),
    segna: async (v) => segnati5.push(v),
    cestina: async () => {},
  });
  t.c("fermato a metà non segna e non lascia un file a metà", e5.fermato && !segnati5.length && (await percorso(r5, "Fumetti", "Hellboy", "Hellboy v01.cbz"))?.byte.length === 0);

  // «Ferma» fra un volume e l'altro: quello gia' sul disco non si segna
  let vivo6 = true;
  const segnati6 = [];
  const e6 = await spostaSuHdd([voci[2], voci[0]], { radice, vivo: () => vivo6, apri: async () => risposta(500), segna: async (v) => (segnati6.push(v.bookId), (vivo6 = false)), cestina: async () => {} });
  t.c("fermato fra due volumi, il secondo non si tocca", e6.fermato && segnati6.join() === "c");

  t.c("la frase dice il disco e il cestino", /2 volumi sull'HDD · 3 MB liberati/.test(fraseHdd({ fatti: 2, byte: 3 * 1024 * 1024, mancati: [], restati: [], fermato: false })));
  t.c("e chi non è arrivato", /uno non è arrivato/.test(fraseHdd({ fatti: 0, byte: 0, mancati: [1], restati: [], fermato: false })));
};
