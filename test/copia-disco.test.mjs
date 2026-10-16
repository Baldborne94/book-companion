// LA COPIA DELLA BIBLIOTECA SUL DISCO. A ogni «Controlla il disco» si scrive
// accanto ai libri uno zip col solo indice (schede, lettura, segni, diario),
// che «Ripristina» legge come un archivio. Qui si prova il giro intero:
// dalla biblioteca allo zip sul disco, e dallo zip di nuovo alla biblioteca
// vuota — perche' e' li' che una chiave dimenticata sparisce in silenzio.

const memoria = {};
for (const [nome, fn] of Object.entries({
  getItem: (k) => (k in memoria ? memoria[k] : null),
  setItem: (k, v) => {
    memoria[k] = String(v);
  },
  removeItem: (k) => {
    delete memoria[k];
  },
})) {
  Object.defineProperty(memoria, nome, { value: fn, enumerable: false });
}
globalThis.localStorage = memoria;

const { default: JSZip } = await import("jszip");
const { indiceSoloSchede } = await import("../src/lib/exportLibrary.js");
const { scriviCopia, nomeCopia, COPIE } = await import("../src/lib/copiaDisco.js");
const { sbircia, restoreLibrary } = await import("../src/lib/restoreLibrary.js");
const { saveBooks, loadBooks, setProgress, getProgress, setStatus, getStatus } = await import("../src/lib/library.js");
const { setCfi, getCfi, saveMarks, getMarks } = await import("../src/lib/annotations.js");
const { saveFavorites, getFavoritesRaw, saveLists, getListsRaw } = await import("../src/lib/music.js");

// un disco finto: cartelle e file in memoria, con le stesse chiamate del
// browser. `tronca` scrive meno byte di quelli chiesti, come un disco pieno
function disco({ tronca = false } = {}) {
  const cartella = () => {
    const sotto = new Map();
    const file = new Map();
    return {
      sotto,
      file,
      async getDirectoryHandle(nome, { create } = {}) {
        if (!sotto.has(nome)) {
          if (!create) throw new Error("NotFoundError");
          sotto.set(nome, cartella());
        }
        return sotto.get(nome);
      },
      async getFileHandle(nome, { create } = {}) {
        if (!file.has(nome) && !create) throw new Error("NotFoundError");
        if (!file.has(nome)) file.set(nome, new Blob([]));
        return {
          async createWritable() {
            const pezzi = [];
            return {
              write: async (b) => pezzi.push(b),
              close: async () => {
                const tutto = new Blob(pezzi);
                file.set(nome, tronca ? tutto.slice(0, 10) : tutto);
              },
            };
          },
          getFile: async () => file.get(nome),
        };
      },
    };
  };
  return cartella();
}

export default async (t) => {
  saveBooks([
    { id: "mort", title: "Mort", author: "Terry Pratchett", saga: "Discworld", sagaOrder: 4, fileType: "epub", addedAt: 1 },
    { id: "kingdom5", title: "Kingdom v05", saga: "Kingdom", sagaOrder: 5, fileType: "cbz", addedAt: 2 },
  ]);
  setProgress("mort", 0.42);
  setStatus("mort", "reading");
  setCfi("mort", "epubcfi(/6/14!/4/2/1:0)");
  saveMarks("mort", [{ id: "m1", cfi: "epubcfi(/6/14!/4/2/1:0)", label: "la Morte", createdAt: 5 }]);
  setStatus("kingdom5", "read");
  saveFavorites([{ id: "pioggia", name: "Pioggia sul tetto", url: "https://www.youtube.com/watch?v=abc" }]);
  memoria.bc_obiettivi = JSON.stringify({ 2026: { n: 24, t: 1 } });
  saveLists([{ id: "notte", name: "Notte di lettura", brani: ["pioggia"] }]);
  memoria["bc_gloss_saga:malazan"] = JSON.stringify([{ t: "Warren", d: "i sentieri magici", addedAt: 1 }]);

  const casa = disco();
  const ora = new Date("2026-10-16T15:00:00Z");
  const fatto = await scriviCopia(casa, { indice: indiceSoloSchede(ora), JSZip, ora });
  t.eq("il nome dice il giorno", fatto.nome, "biblioteca-2026-10-16.zip");
  t.eq("e conta le schede", fatto.schede, 2);
  t.eq("e dice dove sta", fatto.percorso, "_Copie/biblioteca-2026-10-16.zip");
  const copie = casa.sotto.get(COPIE);
  t.c("la copia sta in «_Copie», accanto ai libri", !!copie?.file.get(nomeCopia(ora)));

  const zip = copie.file.get(nomeCopia(ora));
  const dentro = await JSZip.loadAsync(await zip.arrayBuffer());
  t.eq("dentro c'e' solo l'indice: i libri sul disco ci sono gia'", Object.keys(dentro.files).join(), "biblioteca.json");
  const indice = JSON.parse(await dentro.file("biblioteca.json").async("string"));
  t.eq("nessun libro porta il suo file", indice.books.filter((b) => b.file || b.cover).length, 0);

  // «Ripristina» la riconosce, e su una biblioteca vuota rimette tutto
  const visto = await sbircia(zip);
  t.eq("«Ripristina» la riconosce, coi suoi libri", visto.libri, 2);
  t.eq("…e dice prima che i file non ci sono", visto.soloSchede, true);
  t.eq("…e di che giorno e'", visto.quando, "2026-10-16T15:00:00.000Z");
  for (const k of Object.keys(memoria)) delete memoria[k];
  t.eq("biblioteca svuotata", loadBooks().length, 0);
  await restoreLibrary(zip);
  t.eq("tornano le schede", loadBooks().map((b) => b.id).sort().join(), "kingdom5,mort");
  t.eq("torna il progresso", getProgress("mort"), 0.42);
  t.eq("torna lo stato", getStatus("mort"), "reading");
  t.eq("…anche del letto", getStatus("kingdom5"), "read");
  t.eq("torna il punto di lettura", getCfi("mort"), "epubcfi(/6/14!/4/2/1:0)");
  t.eq("tornano i segnalibri", getMarks("mort")[0]?.label, "la Morte");
  t.eq("tornano le melodie", getFavoritesRaw().map((f) => f.name).join(), "Pioggia sul tetto");
  t.eq("tornano le raccolte", getListsRaw().map((r) => r.name).join(), "Notte di lettura");
  t.c("torna il glossario", /Warren/.test(memoria["bc_gloss_saga:malazan"] || ""));
  t.eq("torna il diario (l'obiettivo dell'anno)", JSON.parse(memoria.bc_obiettivi || "null")?.[2026]?.n, 24);

  // una al giorno: oggi si riscrive, domani se ne aggiunge un'altra
  setProgress("mort", 0.5);
  await scriviCopia(casa, { indice: indiceSoloSchede(ora), JSZip, ora });
  t.eq("la copia di oggi si riscrive", copie.file.size, 1);
  const domani = new Date("2026-10-17T09:00:00Z");
  await scriviCopia(casa, { indice: indiceSoloSchede(domani), JSZip, ora: domani });
  t.eq("quella di ieri resta", [...copie.file.keys()].sort().join(), "biblioteca-2026-10-16.zip,biblioteca-2026-10-17.zip");

  // un disco che scrive a meta' non da' una copia fatta
  let guaio = null;
  await scriviCopia(disco({ tronca: true }), { indice: indiceSoloSchede(ora), JSZip, ora }).catch((e) => (guaio = e.message));
  t.c("una copia scritta a meta' e' un guaio detto", /pesa/.test(guaio || ""));
};
