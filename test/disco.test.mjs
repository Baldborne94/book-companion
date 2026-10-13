// IL DISCO DEI LIBRI, CONTROLLATO E RIORDINATO (chiesto dal lettore: «ora su
// E:\book-companion abbiamo tutti i volumi? mi hai sistemato anche dentro le
// cartelle i file nel modo giusto per saga?»).
import { casaDi, elencaDisco, controllaDisco, riordinaDisco, fraseRiordino } from "../src/lib/disco.js";
import { daSpostareSuHdd } from "../src/lib/driveCore.js";

// un disco finto: cartelle, file col loro peso, `move` facoltativo
function cartella(nome = "", { conMove = true } = {}) {
  const dentro = new Map();
  const d = {
    kind: "directory",
    name: nome,
    dentro,
    async getDirectoryHandle(n, { create = false } = {}) {
      if (!dentro.has(n)) {
        if (!create) throw Object.assign(new Error("no"), { name: "NotFoundError" });
        dentro.set(n, cartella(n, { conMove }));
      }
      return dentro.get(n);
    },
    async getFileHandle(n, { create = false } = {}) {
      if (!dentro.has(n)) {
        if (!create) throw Object.assign(new Error("no"), { name: "NotFoundError" });
        dentro.set(n, file(n, 0, d, { conMove }));
      }
      return dentro.get(n);
    },
    async removeEntry(n) {
      if (!dentro.delete(n)) throw new Error("non c'è");
    },
    async *entries() {
      for (const e of [...dentro.entries()]) yield e;
    },
  };
  return d;
}
let copie = 0;
function file(nome, peso, genitore, { conMove = true } = {}) {
  const f = {
    kind: "file",
    name: nome,
    peso,
    async getFile() {
      return { size: f.peso, stream: () => new Blob([new Uint8Array(f.peso)]).stream() };
    },
    async createWritable() {
      copie += 1;
      let n = 0;
      return new WritableStream({
        write(p) {
          n += p.length;
        },
        close() {
          f.peso = n;
        },
      });
    },
  };
  if (conMove)
    f.move = async (dir, nuovo) => {
      genitore.dentro.delete(f.name);
      f.name = nuovo;
      dir.dentro.set(nuovo, f);
      genitore = dir;
    };
  return f;
}
async function metti(radice, percorso, peso, op) {
  const pezzi = percorso.split("/");
  let c = radice;
  for (const p of pezzi.slice(0, -1)) c = await c.getDirectoryHandle(p, { create: true });
  c.dentro.set(pezzi.at(-1), file(pezzi.at(-1), peso, c, op));
}
async function voci(dir, via = "") {
  const out = [];
  for await (const [n, h] of dir.entries()) {
    if (h.kind === "directory") out.push(...(await voci(h, `${via}${n}/`)));
    else out.push(`${via}${n}:${h.peso}`);
  }
  return out;
}
const tutto = async (dir) => (await voci(dir)).sort().join(" ");

export default async (t) => {
  t.eq("la casa: tipo, saga, parte", casaDi({ saga: "JoJo's Bizarre Adventure", series: "Parte 7" }, "manga").join("/"), "Manga/JoJo's Bizarre Adventure/Parte 7");
  t.eq("un volume a sé sta nel suo tipo", casaDi({}, "libri").join("/"), "Libri");
  t.eq("la parte senza saga non fa una cartella", casaDi({ series: "Parte 7" }, "manga").join("/"), "Manga");
  t.eq("un ciclo che si chiama come la saga non si ripete", casaDi({ saga: "Hellboy", series: "hellboy" }, "fumetti").join("/"), "Fumetti/Hellboy");
  t.eq("nomi buoni per Windows", casaDi({ saga: "Batman: Year One" }, "fumetti").join("/"), "Fumetti/Batman_ Year One");
  t.eq("e chi sposta da Drive usa la stessa casa", daSpostareSuHdd([{ id: "b", saga: "Hellboy", series: "B.P.R.D." }], { b: { id: "f" } }, [{ id: "f", name: "x.cbz", size: "5" }], { tipoDi: () => "fumetti" })[0].cartelle.join("/"), "Fumetti/Hellboy/B.P.R.D.");

  const radice = cartella("book-companion");
  await metti(radice, "Manga/JoJo's_Bizarre_Adventure/Parte 7/Volume 20 - Love Train.cbz", 70);
  await metti(radice, "Manga/Kagurabachi 100.cbz", 10);
  await metti(radice, "Manga/Kagurabachi/Kagurabachi 101.cbz", 11);
  await metti(radice, "Fumetti/The Deluxe Edition Book/The Sandman Book 02.cbz", 20);
  await metti(radice, "Fumetti/The Sandman/The Sandman Book 02.cbz", 20);
  await metti(radice, "Fumetti/Locke & Key v06 - Alpha & Omega (2014).cbz", 30);
  await metti(radice, "Fumetti/Nessuno.cbz", 5);
  await metti(radice, "Libri/note.txt", 1);
  const file = await elencaDisco(radice);
  t.eq("si elencano i soli libri, col percorso", file.map((f) => `${f.cartelle.join("/")}|${f.nome}|${f.byte}`).sort().join(" "), "Fumetti/The Deluxe Edition Book|The Sandman Book 02.cbz|20 Fumetti/The Sandman|The Sandman Book 02.cbz|20 Fumetti|Locke & Key v06 - Alpha & Omega (2014).cbz|30 Fumetti|Nessuno.cbz|5 Manga/JoJo's_Bizarre_Adventure/Parte 7|Volume 20 - Love Train.cbz|70 Manga/Kagurabachi|Kagurabachi 101.cbz|11 Manga|Kagurabachi 100.cbz|10");

  const libri = [
    { id: "j", title: "Volume 20 - Love Train", saga: "JoJo's Bizarre Adventure", series: "Parte 7", tipo: "manga" },
    { id: "k100", title: "Kagurabachi 100", saga: "Kagurabachi", tipo: "manga" },
    { id: "k101", title: "Kagurabachi 101", saga: "Kagurabachi", tipo: "manga" },
    { id: "s", title: "The Sandman Book 02", saga: "The Sandman", tipo: "fumetti" },
    { id: "l", title: "Alpha & Omega", saga: "Locke & Key", tipo: "fumetti" },
    { id: "d", title: "Su Drive", tipo: "libri" },
    { id: "q", title: "Qui", tipo: "libri" },
    { id: "a", title: "Sul tablet", tipo: "libri" },
    { id: "n", title: "Perso", tipo: "libri", fileTolto: true },
  ];
  const r = controllaDisco(libri, file, { tipoDi: (b) => b.tipo, suDrive: (id) => id === "d", qui: (id) => id === "q" });
  const sp = Object.fromEntries(r.daSpostare.map((v) => [v.libro.id, `${v.file.cartelle.join("/")} → ${v.a.join("/")}`]));
  t.eq("JoJo dalle cartelle di Drive alla sua saga e parte", sp.j, "Manga/JoJo's_Bizarre_Adventure/Parte 7 → Manga/JoJo's Bizarre Adventure/Parte 7");
  t.eq("Kagurabachi sciolto va nella sua saga", sp.k100, "Manga → Manga/Kagurabachi");
  t.eq("il titolo ripulito si ritrova dentro il nome del file", sp.l, "Fumetti → Fumetti/Locke & Key");
  t.c("chi è già a posto non si sposta", r.aPosto.some((x) => x.libro.id === "k101") && !sp.k101);
  t.c("dei due Sandman si tiene quello a posto", r.aPosto.some((x) => x.libro.id === "s" && x.file.cartelle.join("/") === "Fumetti/The Sandman") && !sp.s);
  t.eq("e l'altro è un doppione sul disco", r.doppioni.map((f) => f.cartelle.join("/")).join(), "Fumetti/The Deluxe Edition Book");
  t.eq("dove sta chi manca", `${r.mancano.drive.map((b) => b.id)}|${r.mancano.qui.map((b) => b.id)}|${r.mancano.altrove.map((b) => b.id)}|${r.mancano.nessuno.map((b) => b.id)}`, "d|q|a|n");
  t.eq("il file che nessuna scheda riconosce", r.senzaScheda.map((f) => f.nome).join(), "Nessuno.cbz");
  t.eq("il peso dei volumi sul disco, un doppione una volta", r.byte, 70 + 10 + 11 + 20 + 30);
  // un titolo corto o di due file non si abbina per contenimento
  const ambiguo = controllaDisco([{ id: "x", title: "Omega" }], [{ nome: "Alpha Omega 1.cbz", cartelle: [], byte: 1 }, { nome: "Omega Red.cbz", cartelle: [], byte: 1 }]);
  t.c("due candidati: nessuno", ambiguo.mancano.altrove.length === 1);
  const dueSchede = controllaDisco([{ id: "x", title: "Alpha" }, { id: "y", title: "Omega" }], [{ nome: "Alpha Omega.cbz", cartelle: [], byte: 1 }]);
  t.c("un file per due schede: nessuna", dueSchede.senzaScheda.length === 1);
  // due schede dello stesso volume con case diverse: non si sposta
  const doppie = controllaDisco([{ id: "x", title: "Mort", saga: "Discworld" }, { id: "y", title: "Mort" }], [{ nome: "Mort.epub", cartelle: ["Libri", "Altro"], byte: 1 }]);
  t.c("due schede, due case: si lascia stare", !doppie.daSpostare.length && !doppie.senzaScheda.length);

  t.c("un titolo di tre lettere non si cerca dentro i nomi", controllaDisco([{ id: "x", title: "It" }], [{ nome: "It Follows.cbz", cartelle: [], byte: 1 }]).senzaScheda.length === 1);
  const unaDelleDue = controllaDisco([{ id: "x", title: "Mort", saga: "Discworld" }, { id: "y", title: "Mort" }], [{ nome: "Mort.epub", cartelle: ["Libri"], byte: 1 }]);
  t.c("nella casa di una delle due schede è a posto", unaDelleDue.aPosto.length === 1);

  // riordinare: con `move`, che sposta nel posto senza copiare
  copie = 0;
  const e = await riordinaDisco(r.daSpostare, { radice });
  t.eq("con move non si copia niente", copie, 0);
  t.eq("tutti spostati", e.spostati, 3);
  const dopo = await tutto(radice);
  t.c("JoJo nella sua parte", dopo.includes("Manga/JoJo's Bizarre Adventure/Parte 7/Volume 20 - Love Train.cbz:70"));
  t.c("e non più nella cartella di Drive", !dopo.includes("JoJo's_Bizarre_Adventure/Parte 7/Volume"));
  t.c("Kagurabachi 100 nella saga", dopo.includes("Manga/Kagurabachi/Kagurabachi 100.cbz:10") && !dopo.includes("Manga/Kagurabachi 100.cbz"));
  t.c("il doppione resta dov'era", dopo.includes("Fumetti/The Deluxe Edition Book/The Sandman Book 02.cbz:20"));
  t.c("e si dice", /3 volumi nella cartella della sua saga/.test(fraseRiordino(e)));

  // senza `move`: copia, peso, poi via l'originale
  const r2 = cartella("book-companion", { conMove: false });
  await metti(r2, "Manga/Kagurabachi 100.cbz", 10, { conMove: false });
  await metti(r2, "Manga/Kagurabachi/Kagurabachi 102.cbz", 12, { conMove: false });
  await metti(r2, "Manga/Kagurabachi 102.cbz", 12, { conMove: false });
  await metti(r2, "Manga/Kagurabachi/Kagurabachi 103.cbz", 99, { conMove: false });
  await metti(r2, "Manga/Kagurabachi 103.cbz", 13, { conMove: false });
  const lib2 = ["100", "102", "103"].map((n) => ({ id: n, title: `Kagurabachi ${n}`, saga: "Kagurabachi" }));
  const c2 = controllaDisco(lib2, await elencaDisco(r2), { tipoDi: () => "manga" });
  // 102: due file uguali, uno già a posto → doppione, niente da spostare
  t.eq("da spostare senza move", c2.daSpostare.map((v) => v.libro.id).sort().join(), "100");
  const e2 = await riordinaDisco([...c2.daSpostare, { libro: lib2[2], file: c2.daSpostare[0] && (await elencaDisco(r2)).find((f) => f.nome === "Kagurabachi 103.cbz" && !f.cartelle.includes("Kagurabachi")), a: ["Manga", "Kagurabachi"] }], { radice: r2 });
  const dopo2 = await tutto(r2);
  t.c("copiato e tolto l'originale", dopo2.includes("Manga/Kagurabachi/Kagurabachi 100.cbz:10") && !/Manga\/Kagurabachi 100\.cbz/.test(dopo2));
  t.c("un altro file con lo stesso nome non si copre: «(2)»", dopo2.includes("Manga/Kagurabachi/Kagurabachi 103.cbz:99") && dopo2.includes("Manga/Kagurabachi/Kagurabachi 103 (2).cbz:13"));
  t.eq("e si contano", e2.spostati, 2);

  // un file con lo stesso nome e peso già nella casa: non si tocca
  const r3 = cartella("book-companion");
  await metti(r3, "Manga/Kagurabachi/Kagurabachi 104.cbz", 14);
  await metti(r3, "Manga/Altro/Kagurabachi 104.cbz", 14);
  const f3 = (await elencaDisco(r3)).find((f) => f.cartelle.includes("Altro"));
  const e3 = await riordinaDisco([{ libro: {}, file: f3, a: ["Manga", "Kagurabachi"] }], { radice: r3 });
  t.c("lo stesso volume già là: resta anche dov'era, e si dice", e3.doppioni.length === 1 && (await tutto(r3)).includes("Manga/Altro/Kagurabachi 104.cbz:14") && /era già là/.test(fraseRiordino(e3)));

  // una copia che non arriva intera non toglie l'originale
  const r4 = cartella("book-companion", { conMove: false });
  await metti(r4, "Manga/Kagurabachi 105.cbz", 15, { conMove: false });
  const f4 = (await elencaDisco(r4))[0];
  f4.handle.getFile = async () => ({ size: 15, stream: () => new Blob([new Uint8Array(3)]).stream() });
  const e4 = await riordinaDisco([{ libro: {}, file: f4, a: ["Manga", "Kagurabachi"] }], { radice: r4 });
  const dopo4 = await tutto(r4);
  t.c("copia corta: l'originale resta e la copia va via", e4.mancati.length === 1 && dopo4.includes("Manga/Kagurabachi 105.cbz:15") && !dopo4.includes("Kagurabachi/Kagurabachi 105"));
  // `move` che non riesce: si copia
  const r5 = cartella("book-companion");
  await metti(r5, "Manga/Kagurabachi 106.cbz", 16);
  const f5 = (await elencaDisco(r5))[0];
  f5.handle.move = async () => {
    throw new Error("NotSupported");
  };
  await riordinaDisco([{ libro: {}, file: f5, a: ["Manga", "Kagurabachi"] }], { radice: r5 });
  const dopo5 = await tutto(r5);
  t.c("move rifiutato: si copia", dopo5.includes("Manga/Kagurabachi/Kagurabachi 106.cbz:16") && !dopo5.includes("Manga/Kagurabachi 106.cbz"));
  // fermato
  const e6 = await riordinaDisco([{ libro: {}, file: f5, a: ["X"] }], { radice: r5, vivo: () => false });
  t.c("fermato prima: niente", e6.fermato && !e6.spostati);
};
