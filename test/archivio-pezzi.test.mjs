// L'ARCHIVIO A PEZZI. Una biblioteca coi fumetti pesa giga, e l'archivio
// era UNO zip costruito in memoria: sul tablet la scheda si chiude prima di
// finire, cioe' l'unica rete che fumetti e melodie hanno si strappa proprio
// quando serve. Qui si prova che:
// - la spartizione tiene gli zip sotto il tetto e manda fuori grezzi i file
//   grossi, nell'ordine della biblioteca;
// - una biblioteca piccola resta UN file col nome di sempre;
// - i nomi si rileggono anche rinominati da Android;
// - il giro intero esporta → ripristina riporta byte, copertine e melodie;
// - un pezzo dimenticato non rompe niente: quei tomi entrano e aspettano il
//   file, che arriva scegliendo il pezzo dopo;
// - un grezzo rinominato si riconosce dalla misura, un file estraneo si
//   dice, e senza nessuno zip non si indovina;
// - e in tutto questo un grezzo non si legge MAI intero in memoria.

// ---- il finto localStorage (enumerabile come nel browser) --------------------
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

// ---- il finto IndexedDB: le quattro mosse che bookStore fa ------------------
const stores = new Map();
function finto() {
  const d = {
    objectStoreNames: { contains: (n) => stores.has(n) },
    createObjectStore: (n) => stores.set(n, new Map()),
    transaction: (nome) => {
      const tx = {};
      const m = stores.get(nome);
      const req = (fai) => {
        const r = {};
        setTimeout(() => {
          r.result = fai();
          r.onsuccess?.();
          tx.oncomplete?.();
        });
        return r;
      };
      tx.objectStore = () => ({
        put: (v, k) => req(() => m.set(k, v)),
        get: (k) => req(() => m.get(k)),
        delete: (k) => req(() => m.delete(k)),
        getAllKeys: () => req(() => [...m.keys()]),
      });
      return tx;
    },
  };
  return d;
}
globalThis.indexedDB = {
  open() {
    const r = {};
    setTimeout(() => {
      r.result = finto();
      r.onupgradeneeded?.();
      r.onsuccess?.();
    });
    return r;
  },
};
const svuota = () => {
  for (const m of stores.values()) m.clear();
  for (const k of Object.keys(memoria)) delete memoria[k];
};

// ---- lo scaricamento: si prende il Blob invece di cliccare un link ----------
const scaricati = [];
const perUrl = new Map();
URL.createObjectURL = (b) => {
  const u = `blob:finto/${perUrl.size}`;
  perUrl.set(u, b);
  return u;
};
URL.revokeObjectURL = () => {};
globalThis.document = {
  createElement: () => ({
    click() {
      scaricati.push({ nome: this.download, blob: perUrl.get(this.href) });
    },
  }),
};

const { default: JSZip } = await import("jszip");
const { pianoPezzi, nomePezzo, leggiNomePezzo, unisciSbirciate, frasePezzi, TETTO_PEZZO, GREZZO_DA } = await import(
  "../src/lib/archivioPezzi.js"
);
const { preparaArchivio, estensioneAudio } = await import("../src/lib/exportLibrary.js");
const { sbircia, restoreLibrary } = await import("../src/lib/restoreLibrary.js");
const { putFile, putCover, putTrack, getFile, getCover, getTrack } = await import("../src/lib/bookStore.js");
const { saveBooks, loadBooks } = await import("../src/lib/library.js");
const { saveFavorites, getFavoritesRaw } = await import("../src/lib/music.js");

const byte = (n, seme) => new Uint8Array(n).map((_, i) => (i * seme) % 251);
const uguali = async (blob, atteso) => {
  if (!blob) return false;
  const a = new Uint8Array(await blob.arrayBuffer());
  return a.length === atteso.length && a.every((x, i) => x === atteso[i]);
};

// la spia: un File che conta quante volte gli si chiedono i byte interi
class Spia extends File {
  constructor(parti, nome) {
    super(parti, nome);
    this.intere = 0;
  }
  arrayBuffer() {
    this.intere++;
    return super.arrayBuffer();
  }
}
const comeFile = (s, nome = s.nome) => new Spia([s.blob], nome);

export default async (t) => {
  // ---- la spartizione ---------------------------------------------------------
  const v = (id, b, specie = "libro") => ({ specie, id, byte: b, nome: id, ext: "epub", percorso: `libri/${id}` });
  const piccola = pianoPezzi([v("a", 10), v("b", 20)]);
  t.eq("una biblioteca piccola e' un pezzo solo", piccola.di, 1);
  t.eq("… e il pezzo e' uno zip", piccola.pezzi[0].tipo, "zip");
  const sp = pianoPezzi([v("a", 60), v("b", 50), v("big", 500), v("c", 30), v("d", 80)], { tetto: 120, grezzoDa: 100 });
  t.eq(
    "gli zip sotto il tetto, nell'ordine, e i grossi grezzi in fondo",
    sp.pezzi.map((p) => `${p.tipo}:${p.voci.map((x) => x.id).join("+")}`).join(" "),
    "zip:a+b zip:c+d grezzo:big"
  );
  t.c("nessuno zip supera il tetto", sp.pezzi.filter((p) => p.tipo === "zip").every((p) => p.byte <= 120));
  t.eq("i pezzi si numerano di seguito", sp.pezzi.map((p) => `${p.n}/${p.di}`).join(","), "1/3,2/3,3/3");
  t.eq("il totale e' la somma", sp.totale, 720);
  // un file piu' grande del tetto ma sotto la soglia dei grezzi sta da solo
  // in uno zip: il tetto e' per riempire, non per rifiutare
  t.eq("un file oltre il tetto sta in uno zip suo", pianoPezzi([v("a", 10), v("b", 150)], { tetto: 120, grezzoDa: 200 }).di, 2);
  const soloGrossi = pianoPezzi([v("x", 500)], { tetto: 120, grezzoDa: 100 });
  t.eq("il primo pezzo e' SEMPRE uno zip, anche vuoto: porta l'indice", soloGrossi.pezzi[0].tipo, "zip");
  t.eq("… e il grosso viene dopo", soloGrossi.pezzi[1].tipo, "grezzo");
  t.c("le soglie vere: zip piu' larghi dei grezzi", TETTO_PEZZO > GREZZO_DA);
  t.eq("una voce senza id non entra", pianoPezzi([{ byte: 5 }]).pezzi[0].voci.length, 0);

  // ---- i nomi -----------------------------------------------------------------
  const data = "2026-09-27";
  t.eq("un pezzo solo tiene il nome di sempre", nomePezzo({ data, n: 1, di: 1, tipo: "zip" }), "book-companion-backup-2026-09-27.zip");
  t.eq("uno zip di tanti dice «n di N»", nomePezzo({ data, n: 2, di: 5, tipo: "zip" }), "book-companion-backup-2026-09-27-2di5.zip");
  const nG = nomePezzo({ data, n: 5, di: 5, tipo: "grezzo", voce: { nome: "Hellboy: v03!", id: "0123abcd-ffff", ext: "cbz" } });
  t.eq("un grezzo dice chi e'", nG, "book-companion-backup-2026-09-27-5di5-Hellboy v03-0123abcd.cbz");
  const letto = leggiNomePezzo(nG);
  t.c("e si rilegge", letto?.grezzo && letto.id8 === "0123abcd" && letto.n === 5 && letto.di === 5 && letto.ext === "cbz");
  t.eq(
    "anche col «(1)» che Android aggiunge ai doppioni",
    leggiNomePezzo("book-companion-backup-2026-09-27-5di5-Hellboy v03-0123abcd (1).cbz")?.id8,
    "0123abcd"
  );
  t.eq("uno zip si rilegge come zip", leggiNomePezzo("book-companion-backup-2026-09-27-2di5.zip")?.grezzo, false);
  t.eq("un file chiamato a mano non e' un pezzo", leggiNomePezzo("Hellboy v03.cbz"), null);
  t.eq("un «grezzo» senza id non e' nostro", leggiNomePezzo("book-companion-backup-2026-09-27.cbz"), null);
  t.eq("l'estensione di una melodia dal tipo", estensioneAudio("audio/mpeg"), "mp3");
  t.eq("… e il tipo ignoto non inventa", estensioneAudio("audio/strano"), "bin");

  // ---- la frase ---------------------------------------------------------------
  t.eq("un archivio intero e di un pezzo non dice niente", frasePezzi({ di: 1, presenti: [1], mancanti: [] }), null);
  t.eq("tutti presenti", frasePezzi({ di: 3, presenti: [1, 2, 3], mancanti: [] }), "Pezzi 1, 2 e 3 di 3");
  t.eq(
    "manca uno, con cosa porta",
    frasePezzi({ di: 3, presenti: [1, 3], mancanti: [{ n: 2 }], tomiMancanti: 1, melodieMancanti: 2 }),
    "Pezzi 1 e 3 di 3 · manca il 2 (1 tomo e 2 melodie)"
  );

  // ---- il giro intero ---------------------------------------------------------
  const A = byte(1000, 3);
  const B = byte(1000, 5);
  const C = byte(6000, 7);
  const copA = byte(100, 11);
  // una melodia lunga esce grezza anche lei, col nome che il telefono apre
  const mel = byte(5200, 13);
  saveBooks([
    { id: "aaaaaaaa-1", title: "Alfa", author: "X", fileType: "epub", addedAt: 1 },
    { id: "bbbbbbbb-2", title: "Beta", author: "Y", fileType: "epub", addedAt: 2 },
    { id: "cccccccc-3", title: "Hellboy v03", author: "Mignola", fileType: "cbz", addedAt: 3 },
  ]);
  await putFile("aaaaaaaa-1", new Blob([A]));
  await putCover("aaaaaaaa-1", new Blob([copA]));
  await putFile("bbbbbbbb-2", new Blob([B]));
  await putFile("cccccccc-3", new Blob([C]));
  await putTrack("tr-1", new Blob([mel], { type: "audio/mpeg" }));
  saveFavorites([{ id: "eeeeeeee-5", name: "Pioggia", trackId: "tr-1", mime: "audio/mpeg", addedAt: 1, updatedAt: 1 }]);

  const prep = await preparaArchivio({ tetto: 1500, grezzoDa: 5000 });
  t.eq("quattro pezzi: due zip, il fumetto e la melodia grezzi", prep.piano.pezzi.map((p) => p.tipo).join(","), "zip,zip,grezzo,grezzo");
  for (const p of prep.piano.pezzi) await prep.scarica(p.n);
  t.eq("quattro scaricamenti", scaricati.length, 4);
  const [z1, z2, g3, g4] = scaricati;
  t.c("il grezzo esce col suo nome", /-3di4-Hellboy v03-cccccccc\.cbz$/.test(g3.nome), g3.nome);
  t.c("… e la melodia con la sua estensione", /-4di4-Pioggia-eeeeeeee\.mp3$/.test(g4.nome), g4.nome);
  t.c("e sono i byte del libro, com'erano", await uguali(g3.blob, C));
  // ogni zip porta l'indice intero, col suo numero
  const indice2 = JSON.parse(await (await JSZip.loadAsync(await z2.blob.arrayBuffer())).file("biblioteca.json").async("string"));
  t.eq("ogni zip porta l'indice intero", indice2.books.length, 3);
  t.eq("… e sa quale pezzo e'", `${indice2.pezzo.n}/${indice2.pezzo.di}`, "2/4");
  t.eq("… e cosa c'e' in ogni pezzo", indice2.pezzi.map((p) => `${p.libri.length}${p.melodie.length}`).join(","), "10,10,10,01");
  const inIndice = indice2.books.find((b) => b.id === "cccccccc-3");
  t.c("il libro grezzo nell'indice dice il nome, non un percorso", inIndice.grezzo === g3.nome && !inIndice.file && inIndice.pezzo === 3);

  // ---- ritorno completo, su un dispositivo vuoto --------------------------------
  svuota();
  const tutti = [comeFile(z1), comeFile(z2), comeFile(g3), comeFile(g4)];
  const dentro = await sbircia(tutti);
  t.eq("si contano i libri", dentro.libri, 3);
  t.eq("si dicono i pezzi", dentro.pezzi, "Pezzi 1, 2, 3 e 4 di 4");
  const r = await restoreLibrary(dentro);
  // prima di rileggere i byte: il finto IndexedDB non clona, e rileggere il
  // libro ripristinato vorrebbe dire leggere lo stesso File
  const intereGrezzo = tutti[2].intere;
  const intereZip = tutti[0].intere + tutti[1].intere;
  t.eq("tornano i tre libri", r.added, 3);
  t.eq("… coi loro file", r.files, 3);
  t.c("Alfa uguale", await uguali(await getFile("aaaaaaaa-1"), A));
  t.c("Beta uguale", await uguali(await getFile("bbbbbbbb-2"), B));
  t.c("Hellboy uguale", await uguali(await getFile("cccccccc-3"), C));
  t.c("la copertina torna", await uguali(await getCover("aaaaaaaa-1"), copA));
  t.c("la melodia torna", await uguali(await getTrack("tr-1"), mel));
  t.eq("… e sta in elenco", getFavoritesRaw().length, 1);
  t.c("nessun campo dell'archivio resta sul libro", !("grezzo" in loadBooks().find((b) => b.id === "cccccccc-3")));
  t.eq("il grezzo non si e' mai letto intero", intereGrezzo, 0);
  t.eq("… e nemmeno gli zip", intereZip, 0);

  // ---- un pezzo dimenticato ---------------------------------------------------
  svuota();
  const meta = await sbircia([comeFile(z1), comeFile(g3)]);
  t.eq("si dice quale manca e cosa porta", meta.pezzi, "Pezzi 1 e 3 di 4 · mancano i 2 e 4 (1 tomo e 1 melodia)");
  const r1 = await restoreLibrary(meta);
  t.eq("entrano tutt'e tre le schede", r1.added, 3);
  t.eq("… uno aspetta il file", r1.senzaFile, 1);
  t.eq("… e Beta e' davvero senza byte", await getFile("bbbbbbbb-2"), undefined);
  t.eq("la melodia senza byte non entra muta", getFavoritesRaw().length, 0);
  // piu' tardi: il pezzo 2 da solo (uno zip porta l'indice) riempie il buco
  const r2 = await restoreLibrary(await sbircia([comeFile(z2), comeFile(g4)]));
  t.eq("il secondo giro non aggiunge schede", r2.added, 0);
  t.c("… ma porta il file che mancava", await uguali(await getFile("bbbbbbbb-2"), B));
  t.eq("… e la melodia, dal suo grezzo", r2.melodie, 1);
  t.c("… coi suoi byte", await uguali(await getTrack("tr-1"), mel));

  // ---- rinominati, estranei, e senza indice ---------------------------------------
  svuota();
  const rinominato = comeFile(g3, "Hellboy v03.cbz");
  const conRinomina = await sbircia([comeFile(z1), comeFile(z2), rinominato, comeFile(g4), new File(["ciao"], "appunti.txt")]);
  t.eq("un grezzo rinominato si ritrova dalla misura", conRinomina.insieme.mancanti.length, 0);
  t.eq("un file estraneo si dice", conRinomina.estranei, 1);
  await restoreLibrary(conRinomina);
  t.c("… e il fumetto rinominato torna", await uguali(await getFile("cccccccc-3"), C));
  const doppio = comeFile(g3, g3.nome.replace(".cbz", " (1).cbz"));
  t.eq("anche col «(1)» di Android", (await sbircia([comeFile(z1), doppio])).insieme.grezzi.size, 1);
  const soloGrezzo = await sbircia([comeFile(g3)]).then(() => "", (e) => e.message);
  t.c("senza uno zip non si indovina: si dice cosa manca", /\.zip/.test(soloGrezzo), soloGrezzo);

  // due grezzi della stessa misura, rinominati tutt'e due: nessuno si
  // prende a caso il posto dell'altro
  const insieme = unisciSbirciate([
    { tipo: "zip", n: 1, di: 3, serie: "s", zip: { nomi: [] }, data: { books: [], pezzi: [{ n: 1, tipo: "zip" }, { n: 2, tipo: "grezzo", nome: "x", byte: 9 }, { n: 3, tipo: "grezzo", nome: "y", byte: 9 }] } },
    { tipo: "grezzo", byte: 9, file: "g1" },
  ]);
  t.eq("a misura doppia il grezzo senza nome resta fuori", insieme.estranei, 1);
  // due archivi diversi: vale il primo, il secondo si dice
  const misti = unisciSbirciate([
    { tipo: "zip", n: 1, di: 2, serie: "lunedi", zip: { nomi: [] }, data: { books: [], pezzi: [{ n: 1 }, { n: 2 }] } },
    { tipo: "zip", n: 2, di: 2, serie: "martedi", zip: { nomi: [] }, data: { books: [], pezzi: [{ n: 1 }, { n: 2 }] } },
  ]);
  t.c("un pezzo di un altro archivio non riempie il buco", misti.mancanti.length === 1 && misti.estranei === 1);

  // ---- l'archivio di prima, compresso e senza pezzi --------------------------------
  svuota();
  const vecchio = new JSZip();
  vecchio.file("biblioteca.json", JSON.stringify({ app: "book-companion", version: 5, books: [{ id: "dddddddd-4", title: "Vecchio", fileType: "epub", file: "libri/Vecchio-dddddddd.epub" }] }));
  vecchio.file("libri/Vecchio-dddddddd.epub", A, { compression: "DEFLATE" });
  const rv = await restoreLibrary(await vecchio.generateAsync({ type: "uint8array" }));
  t.eq("un archivio di prima si ripristina ancora", rv.files, 1);
  t.c("… e il file compresso esce giusto", await uguali(await getFile("dddddddd-4"), A));
};
