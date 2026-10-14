// IL DISCO DEI LIBRI, CONTROLLATO E RIORDINATO (chiesto dal lettore: «ora su
// E:\book-companion abbiamo tutti i volumi? mi hai sistemato anche dentro le
// cartelle i file nel modo giusto per saga?»).
import { casaDi, elencaDisco, controllaDisco, riordinaDisco, fraseRiordino, rapportoDisco, vociDalDisco, schedeDalDisco, lavoriDalDisco, convertiSulDisco, fraseConvertitiDisco, CBR_CONVERTITI, cbrNeiConvertiti, svuotaConvertiti } from "../src/lib/disco.js";
import { importaDaDrive } from "../src/lib/importBook.js";
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
  const ambiguo = controllaDisco([{ id: "x", title: "Omega" }], [{ nome: "Omega Alpha.cbz", cartelle: [], byte: 1 }, { nome: "Omega Red.cbz", cartelle: [], byte: 2 }]);
  t.c("due candidati che lo coprono uguale: nessuno", ambiguo.mancano.altrove.length === 1 && ambiguo.senzaScheda.length === 2);
  const meglio = controllaDisco([{ id: "x", title: "Omega" }], [{ nome: "Alpha Omega 1.cbz", cartelle: [], byte: 1 }, { nome: "Omega Red.cbz", cartelle: [], byte: 2 }]);
  t.eq("uno lo copre meglio: quello", meglio.aPosto.concat(meglio.daSpostare).map((x) => x.file.nome).join(), "Omega Red.cbz");
  const dueSchede = controllaDisco([{ id: "x", title: "Alpha" }, { id: "y", title: "Omega" }], [{ nome: "Alpha Omega.cbz", cartelle: [], byte: 1 }]);
  t.c("un file per due schede: nessuna", dueSchede.senzaScheda.length === 1);
  // due schede dello stesso volume con case diverse: non si sposta
  const doppie = controllaDisco([{ id: "x", title: "Mort", saga: "Discworld" }, { id: "y", title: "Mort" }], [{ nome: "Mort.epub", cartelle: ["Libri", "Altro"], byte: 1 }]);
  t.c("due schede, due case: si lascia stare", !doppie.daSpostare.length && !doppie.senzaScheda.length);

  t.c("un titolo di tre lettere non si cerca dentro i nomi", controllaDisco([{ id: "x", title: "It" }], [{ nome: "It Follows.cbz", cartelle: [], byte: 1 }]).senzaScheda.length === 1);
  const unaDelleDue = controllaDisco([{ id: "x", title: "Mort", saga: "Discworld" }, { id: "y", title: "Mort" }], [{ nome: "Mort.epub", cartelle: ["Libri"], byte: 1 }]);
  t.c("nella casa di una delle due schede è a posto", unaDelleDue.aPosto.length === 1);

  // dieci volumi che su Drive si chiamavano tutti «0»: non sono copie
  const blame = controllaDisco(
    [{ id: "b1", title: "0", saga: "Blame!" }, { id: "b2", title: "0", saga: "Blame!" }],
    [
      { nome: "0.cbz", cartelle: ["Manga", "Blame!"], byte: 100 },
      { nome: "0 (2).cbz", cartelle: ["Manga", "Blame!"], byte: 200 },
      { nome: "0 (3).cbz", cartelle: ["Manga"], byte: 300 },
      { nome: "0 (4).cbz", cartelle: ["Manga"], byte: 100 },
    ],
    { tipoDi: () => "manga" }
  );
  t.eq("stesso nome, pesi diversi: volumi diversi", `${blame.aPosto.length} a posto, ${blame.daSpostare.length} da spostare`, "2 a posto, 1 da spostare");
  t.eq("stesso nome e stesso peso: quella è una copia, e resta quella fuori casa", blame.doppioni.map((f) => f.nome).join(), "0 (4).cbz");
  t.eq("il peso conta ogni volume una volta", blame.byte, 600);
  const testo = rapportoDisco(r);
  t.c("il rapporto da copiare dice tutto, coi percorsi", testo.includes("Manga / JoJo's_Bizarre_Adventure / Parte 7 -> Manga / JoJo's Bizarre Adventure / Parte 7") && testo.includes("senza file da nessuna parte (1):\n  - Perso") && testo.includes("Fumetti / Nessuno.cbz (5 byte)") && testo.includes("Copie in piu'"));

  // I NOMI VERI DEL PRIMO RAPPORTO DEL LETTORE: titolo e file scritti in due modi
  const zl = " (z-library.sk, 1lib.sk, z-lib.sk)";
  const veri = [
    { id: "h", title: "Abercrombie, Joe - The Heroes", saga: "Circle of the World" },
    { id: "s24", title: "Spawn Origins Collection Vol. 24", saga: "Spawn Origins Collection", tipo: "fumetti" },
    { id: "g", title: "Stroud, Jonathan - Bartimaeus 02 - The Golem's Eye", saga: "Bartimaeus" },
    { id: "c", title: "Belgariad 4 : Castle of Wizardry", saga: "The Belgariad" },
    { id: "law", title: "The Law: A Dresden Files Novella", saga: "Dresden Files" },
    { id: "nl", title: "Night Lords Omnibus", saga: "Warhammer 40K" },
    { id: "ty", title: "The Tyranny of Faith", saga: "Empire of the Wolf" },
    { id: "st1", title: "Shadows of Treachery", saga: "Warhammer 40K" },
    { id: "st2", title: "Shadows of Treachery", saga: "The Horus Heresy" },
  ];
  const fv = (via, byte) => {
    const p = via.split("/");
    return { cartelle: p.slice(0, -1), nome: p.at(-1), byte };
  };
  const fileVeri = [
    fv(`Libri/Circle of the World/The Heroes (Joe Abercrombie)${zl}.epub`, 10),
    fv("Fumetti/Spawn Origins Collection/Spawn Origins Collection v24 (2022) (digital) (DrVink-DCP).cbz", 24),
    fv("Fumetti/Spawn Origins Collection/Spawn Origins Collection v25 (2023) (digital) (DrVink-DCP).cbz", 25),
    fv(`Libri/Bartimaeus/The Golems Eye - Bartimaeus 02 (Stroud, Jonathan)${zl}.epub`, 11),
    fv(`Libri/The Belgariad/Castle of Wizardry (David Eddings)${zl}.epub`, 12),
    fv(`Libri/The Belgariad/Belgariad 3 Magicians Gambit (Eddings David)${zl}.epub`, 13),
    fv("Libri/Circle of the World/Abercrombie, Joe - The First Law 01 (Abercrombie, Joe).epub", 14),
    fv(`Libri/Dresden Files/The Law - Dresden Files 17.2 (Jim Butcher)${zl}.epub`, 15),
    fv("Libri/Warhammer 40K/Night Lords Omnibus (Aaron Dembski-Bowden).epub", 16),
    fv("Libri/Warhammer 40K/Night Lords Omnibus Aaron Dembski-Bowden Z-Library.epub", 16),
    fv("Libri/The Tyranny of Faith (Richard Swan).epub", 17),
    fv(`Libri/Empire of the Wolf/The Tyranny of Faith (Richard Swan)${zl}.epub`, 18),
    fv("Libri/The Horus Heresy/Shadows of Treachery (Christian Dunn [Dunn, Christian]).epub", 19),
    fv("Libri/Warhammer 40K/Shadows of Treachery (The Horus Heresy 22) (Dunn Christian Kyme Nick (Editor)).epub", 20),
    fv("Fumetti/The Sandman/The_Sandman_-_The_Deluxe_Edition_Book_03.cbz", 0),
  ];
  const rv = controllaDisco(veri, fileVeri, { tipoDi: (b) => b.tipo || "libri" });
  const di = Object.fromEntries([...rv.aPosto, ...rv.daSpostare].map((x) => [x.libro.id, x.file.nome]));
  t.eq("le parole in un altro ordine", di.h, `The Heroes (Joe Abercrombie)${zl}.epub`);
  t.eq("«Vol. 24» è «v24», e non il 25", di.s24, "Spawn Origins Collection v24 (2022) (digital) (DrVink-DCP).cbz");
  t.eq("l'apostrofo che il nome del file non ha", di.g, `The Golems Eye - Bartimaeus 02 (Stroud, Jonathan)${zl}.epub`);
  t.eq("un pezzo del titolo", di.c, `Castle of Wizardry (David Eddings)${zl}.epub`);
  t.eq("«The Law» dei Dresden, non «The First Law»", di.law, `The Law - Dresden Files 17.2 (Jim Butcher)${zl}.epub`);
  t.c("due file uguali non sono un dubbio: un volume e la sua copia", !!di.nl && rv.doppioni.some((f) => /Night Lords Omnibus Aaron/.test(f.nome)));
  t.eq("a pari parole vince il file già nella casa della scheda", di.ty, `The Tyranny of Faith (Richard Swan)${zl}.epub`);
  t.c("due schede dello stesso titolo: ognuna il file nella sua saga", /Horus Heresy 22/.test(di.st1) && /Dunn, Christian/.test(di.st2));
  const uno = (titolo, nomi) => {
    const r1 = controllaDisco([{ id: "x", title: titolo }], nomi.map((nome, i) => ({ nome, cartelle: [], byte: i + 1 })));
    return [...r1.aPosto, ...r1.daSpostare].map((x) => x.file.nome).join() || "niente";
  };
  t.eq("l'apostrofo da solo", uno("Shadow's Edge", ["Shadows Edge (Brent Weeks).epub"]), "Shadows Edge (Brent Weeks).epub");
  t.eq("«5» è «05», e non il 4", uno("Kill Six Billion Demons 5", ["Kill Six Billion Demons v04.cbz", "Kill Six Billion Demons v05.cbz"]), "Kill Six Billion Demons v05.cbz");
  t.eq("un pezzo corto («It») non basta", uno("Mort (It)", ["It (Stephen King).epub"]), "niente");
  t.eq("le targhe non contano: «digital», «ebook»", uno("Mort", ["Mort (digital) (ebook).epub", "Mort Cinder.epub"]), "Mort (digital) (ebook).epub");
  t.eq("un file da 0 byte è una copia rimasta a metà, a parte", rv.vuoti.map((f) => f.nome).join() + "|" + rv.senzaScheda.some((f) => f.byte === 0), "The_Sandman_-_The_Deluxe_Edition_Book_03.cbz|false");
  t.c("e il rapporto lo dice", /File vuoti, copie rimaste a meta' \(1\)/.test(rapportoDisco(rv)));

  // I NOMI VERI DEL RAPPORTO DOPO: 8 schede «senza file da nessuna parte» e
  // 22 file «senza scheda», in gran parte gli stessi
  const rd = controllaDisco(
    [
      { id: "el", title: "La Saga di Elric Di Melniboné", saga: "Elric Di Melniboné" },
      { id: "ka", title: "Kane. La saga", saga: "Kane" },
      { id: "pk", title: "Ma gli andoidi sognano pecore elettriche?" },
      { id: "ne", title: "Neuromancer", saga: "The Sprawl Trilogy" },
      { id: "ho", title: "The Hobbit", saga: "Tolkienverse" },
      { id: "hu", title: "The Children of Húrin with illustrations by Alan Lee", saga: "Tolkienverse" },
      { id: "ih", title: "Monsters Gonna Monster", saga: "I Hate Fairyland", sagaOrder: 10, tipo: "fumetti" },
      { id: "m1", title: "Manacled 1", saga: "Manacled" },
      { id: "m2", title: "Manacled 2", saga: "Manacled" },
      { id: "cj", title: "Carpe Jugulum", saga: "Discworld" },
      { id: "am", title: "The Amazing Maurice and His Educated Rodents", saga: "Discworld" },
      { id: "hb", title: "Hellboy Omnibus v01 - Seed of Destruction", saga: "Hellboy", tipo: "fumetti" },
      { id: "bt", title: "Batman Year One (Digital)", tipo: "fumetti" },
    ],
    [
      fv("Libri/Elric Di Melniboné/Elric. La saga (Michael Moorcock).epub", 2241901),
      fv(`Libri/Ma gli androidi sognano pecore elettriche (Philip K. Dick)${zl}.epub`, 409962),
      fv("Libri/The Sprawl Trilogy/Neuromancer (William Gibson) (2).epub", 821453),
      fv("Libri/The Sprawl Trilogy/Neuromancer (William Gibson).epub", 1878585),
      fv("Libri/Tolkienverse/The Hobbit (Tolkien, J R R).epub", 3337418),
      fv("Libri/Tolkienverse/The Hobbit (J. R. R. Tolkien).epub", 8140510),
      fv("Libri/Tolkienverse/The Children of Húrin (J. R. R. Tolkien, Christopher Tolkien).epub", 2460851),
      fv("Fumetti/I Hate Fairyland/I Hate Fairyland v10 (2026) (Collection) (Image) (Digital) (LeDuch-DCP).cbz", 149656006),
      fv("Libri/Manacled/Manacled 1.epub", 3000000),
      fv("Libri/Manacled/Manacled 1 (Senlinyu).epub", 3821653),
      fv("Libri/Discworld/Carpe Jugulum.epub", 400000),
      fv("Libri/Discworld/Carpe Jugulum - Terry Pratchett.epub", 457494),
      fv("Libri/Discworld/Pratchett, Terry - [Discworld 23] - Carpe Jugulum (2010, Corgi, 9780613277617).epub", 457494),
      fv("Libri/Discworld/The Amazing Maurice and His Educated Rodents.epub", 280000),
      fv("Libri/Discworld/The Amazing Maurice and His Educated Rod - Terry Pratchett.epub", 289587),
      fv("Fumetti/Hellboy/Hellboy Omnibus v01 - Seed of Destruction.cbr", 300000000),
      fv("Fumetti/Hellboy/Hellboy Omnibus v01 - Seed of Destruction (2018) (digital) (F) (Son of Ultron-Empire).cbz", 357537567),
      fv("Fumetti/Bone/Bone - One Volume Edition (2004 (phaze-DCP).cbz", 310253556),
    ],
    { tipoDi: (b) => b.tipo || "libri" }
  );
  const dd = Object.fromEntries([...rd.aPosto, ...rd.daSpostare].map((x) => [x.libro.id, x.file.nome]));
  t.eq("Elric: il resto del titolo sta nella cartella della saga", dd.el, "Elric. La saga (Michael Moorcock).epub");
  t.c("e «La saga» di Kane non gli ruba il file", !dd.ka && rd.mancano.altrove.some((b) => b.id === "ka"));
  const kane = controllaDisco([{ id: "ka", title: "Kane. La saga" }], [fv("Libri/Elric Di Melniboné/Elric. La saga (Michael Moorcock).epub", 1)]);
  t.c("nemmeno da solo: «La saga» non dice quale libro", kane.mancano.altrove.length === 1);
  const tutta = controllaDisco([{ id: "x", title: "Elric Di Melniboné" }], [fv("Libri/Elric Di Melniboné/Stormbringer (Michael Moorcock).epub", 1)]);
  t.c("la cartella della saga non basta: una parola piena sta nel nome", tutta.mancano.altrove.length === 1);
  const sezione = controllaDisco([{ id: "x", title: "Fumetti pazzi" }], [fv("Fumetti/Pazzi.cbz", 1)]);
  t.c("«Fumetti», «Libri», «Manga» non sono parole del file", sezione.mancano.altrove.length === 1);
  t.eq("una parola corta non si sfuma", uno("Mort Rising", ["Mart Rising.epub"]), "niente");
  t.eq("un pezzo di due lettere non è una parola tronca", uno("Rodents of Unusual Size", ["Ro of Unusual Size.epub"]), "niente");
  t.eq("i numeri non si sfumano", uno("Carpe Jugulum 9780613277617", ["Carpe Jugulum 9780613277618.epub"]), "niente");
  t.eq("due parole storte sono troppe", uno("Ma gli andoidi sognano pecore eletriche", ["Ma gli androidi sognano pecore elettriche.epub"]), "niente");
  t.eq("«andoidi» è «androidi»", dd.pk, `Ma gli androidi sognano pecore elettriche (Philip K. Dick)${zl}.epub`);
  t.eq("due edizioni con le stesse parole: il file più grande", dd.ne, "Neuromancer (William Gibson).epub");
  t.eq("anche con l'autore scritto in due modi", dd.ho, "The Hobbit (J. R. R. Tolkien).epub");
  t.eq("l'illustratore è un pezzo a sé", dd.hu, "The Children of Húrin (J. R. R. Tolkien, Christopher Tolkien).epub");
  t.eq("il volume che il nome non dice: saga e numero", dd.ih, "I Hate Fairyland v10 (2026) (Collection) (Image) (Digital) (LeDuch-DCP).cbz");
  t.c("«Manacled 2» non prende «Manacled 1»", !dd.m2);
  t.c("«(Digital)» non è un pezzo che trova un file", !dd.bt);
  const ad = Object.fromEntries(rd.altreEdizioni.map((x) => [x.file.nome, x.libro.id]));
  t.eq(
    "le altre edizioni, ognuna col suo volume",
    Object.entries(ad).map(([n, id]) => `${id}:${n.slice(0, 18)}`).sort().join(" | "),
    ["am:The Amazing Mauric", "cj:Carpe Jugulum - Te", "cj:Pratchett, Terry -", "hb:Hellboy Omnibus v0", "ho:The Hobbit (Tolkie", "m1:Manacled 1 (Senlin", "ne:Neuromancer (Willi"].join(" | ")
  );
  t.eq("e senza scheda resta solo quel che nessuna scheda copre", rd.senzaScheda.map((f) => f.nome).join(), "Bone - One Volume Edition (2004 (phaze-DCP).cbz");
  t.c("il rapporto le dice a parte, col volume", /Altre edizioni di volumi che hanno gia' il loro file \(7\):[\s\S]*Manacled 1 \(Senlinyu\)\.epub \(3821653 byte\) -> Manacled 1/.test(rapportoDisco(rd)));
  const fraDue = controllaDisco(
    [{ id: "a", title: "Alpha" }, { id: "o", title: "Omega" }],
    [fv("Fumetti/Alpha.cbz", 1), fv("Fumetti/Omega.cbz", 2), fv("Fumetti/Alpha Omega.cbz", 3)]
  );
  t.c("un'edizione che copre due volumi uguale: resta senza scheda", !fraDue.altreEdizioni.length && fraDue.senzaScheda.map((f) => f.nome).join() === "Alpha Omega.cbz");
  const saga = controllaDisco([{ id: "s", title: "Fuga", saga: "Saga", sagaOrder: 10, tipo: "fumetti" }], [fv("Fumetti/Saga/Volume 10 (2024) (digital).cbz", 1), fv("Fumetti/Saga/Volume 09 (2022) (digital).cbz", 2)], { tipoDi: () => "fumetti" });
  t.c("anche una saga che si chiama «Saga», scritta solo nella cartella", saga.aPosto.length === 1 && /Volume 10/.test(saga.aPosto[0].file.nome));
  const giaPreso = controllaDisco([{ id: "a", title: "Monsters Gonna Monster", saga: "I Hate Fairyland", sagaOrder: 10 }, { id: "b", title: "I Hate Fairyland 10" }], [fv("Fumetti/I Hate Fairyland/I Hate Fairyland v10 (2026).cbz", 1)]);
  t.c("il file già di un'altra scheda non si prende per saga e numero", giaPreso.mancano.altrove.map((b) => b.id).join() === "a");
  const suo = controllaDisco([{ id: "a", title: "Monsters Gonna Monster", saga: "I Hate Fairyland", sagaOrder: 10 }], [fv("Fumetti/I Hate Fairyland/Monsters Gonna Monster.cbz", 1), fv("Fumetti/I Hate Fairyland/I Hate Fairyland v10 (2026).cbz", 2)]);
  t.eq("chi ha già il suo file lo tiene", [...suo.aPosto, ...suo.daSpostare].map((x) => x.file.nome).join(), "Monsters Gonna Monster.cbz");
  const dueDieci = controllaDisco(
    [{ id: "x", title: "Monsters Gonna Monster", saga: "I Hate Fairyland", sagaOrder: 10 }],
    [fv("Fumetti/I Hate Fairyland/I Hate Fairyland v10 (2026).cbz", 1), fv("Fumetti/I Hate Fairyland/I Hate Fairyland #10 (2024).cbz", 2)]
  );
  t.c("due file col numero della scheda: nessuno", dueDieci.mancano.altrove.length === 1);
  const isbn = controllaDisco([{ id: "x", title: "Monsters", saga: "Discworld", sagaOrder: 23 }], [fv("Libri/Discworld/Pratchett, Terry - [Discworld 23] - Carpe Jugulum (2010, Corgi, 9780613277617).epub", 1)]);
  t.c("un altro numero nel nome (l'ISBN): nessuno", isbn.mancano.altrove.length === 1);

  // la scheda che crede perso un volume che è sul disco
  const persi = [
    { id: "p1", title: "A Time of Blood" },
    { id: "p2", title: "Morning Star", fileTolto: true },
    { id: "p3", title: "Su Drive" },
    { id: "p4", title: "Qui" },
    { id: "p5", title: "In lettura" },
    { id: "p6", title: "Non sul disco" },
  ];
  const fp = ["A Time of Blood", "Morning Star", "Su Drive", "Qui", "In lettura"].map((n, i) => ({ nome: `${n}.epub`, cartelle: ["Libri"], byte: i + 1 }));
  const rp = controllaDisco(persi, fp, { suDrive: (id) => id === "p3", qui: (id) => id === "p4", leggendo: (id) => id === "p5" });
  t.eq("sul disco ma la scheda non lo sa: solo chi non ha il file altrove e non è in lettura", rp.daSegnare.map((b) => b.id).join(), "p1");
  t.c("e il rapporto lo dice", /la scheda li crede persi \(1\):\n  - A Time of Blood/.test(rapportoDisco(rp)));

  // IMPORTARE DAL DISCO, SENZA DRIVE
  const sciolti = [
    { nome: "Locke & Key v01 - Welcome to Lovecraft (2008).epub", cartelle: ["Fumetti", "Locke & Key"], byte: 5 },
    { nome: "Kingdom v08v2.epub", cartelle: ["Manga", "Kingdom"], byte: 6 },
    { nome: "Elric. La saga.epub", cartelle: ["Libri", "Elric"], byte: 7 },
  ];
  const vd = vociDalDisco(sciolti);
  t.eq("dal disco: il tipo dalla sezione, un libro senza tipo", vd.map((v) => v.tipo || "-").join(), "fumetti,manga,-");
  t.eq("e un id che dice da dove", vd[0].id, "disco:Fumetti/Locke & Key/Locke & Key v01 - Welcome to Lovecraft (2008).epub");
  const segni = [];
  const preso = await importaDaDrive(vd, [{ id: "vecchia", title: "Elric. La saga", fileTolto: true }], {
    apri: () => new Blob([new Uint8Array(5)]),
    segna: async (...a) => (segni.push(a), true),
    leggi: async () => ({ titolo: false, copertina: false }),
    senzaFile: (id) => id === "vecchia",
    segnato: () => false,
  });
  const dopoImport = schedeDalDisco([{ id: "vecchia", title: "Elric. La saga", fileTolto: false }, { id: "altra", title: "Altro" }], preso);
  const nuove = dopoImport.filter((b) => !["vecchia", "altra"].includes(b.id));
  t.eq("entrano le schede nuove, tutte già sul disco", nuove.map((b) => `${b.title}|${b.tipo || "-"}|${b.fileTolto}`).join(" "), "Locke & Key v01 - Welcome to Lovecraft (2008)|fumetti|true Kingdom v08v2|manga|true");
  t.c("con la saga letta dal titolo", nuove[0].saga === "Locke & Key" && nuove[0].sagaOrder === 1);
  t.c("il file che una scheda aveva perso torna a lei, e anche lei è sul disco", dopoImport.find((b) => b.id === "vecchia").fileTolto === true && !dopoImport.some((b) => b.id !== "vecchia" && b.title === "Elric. La saga"));
  t.c("le altre schede non si toccano", dopoImport.find((b) => b.id === "altra").fileTolto === undefined);

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
  // 103: lo stesso nome con un altro peso è un altro file, e si sposta anche lui
  t.eq("da spostare senza move", c2.daSpostare.map((v) => v.libro.id).sort().join(), "100,103");
  t.eq("e il 102 uguale a quello a posto è una copia", c2.doppioni.map((f) => f.cartelle.join("/")).join(), "Manga");
  const e2 = await riordinaDisco(c2.daSpostare, { radice: r2 });
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

  // LE COPERTINE E I CBR DAL DISCO (segnalato: «mancano ancora copertine» e
  // «ci sono file CBR che non mi fa mettere in CBZ» — i volumi spostati
  // sull'HDD non sono ne' qui ne' su Drive). I nomi sono quelli del lettore.
  // E il CBZ va nella cartella della sua saga, senza cartelle a parte
  // («ogni saga ha il suo posto dove stare»).
  const r7 = cartella("book-companion");
  await metti(r7, "Fumetti/Spawn Origins Collection/Spawn Origins Collection v29 (2024) (digital) (Son of Ultron-Empire).cbr", 40);
  await metti(r7, "Fumetti/Spawn Origins Collection/Spawn Origins Collection v30 (2025) (digital) (Son of Ultron-Empire).cbr", 50);
  await metti(r7, "Fumetti/Spawn Origins Collection v31 (2025) (digital) (Son of Ultron-Empire).cbr", 60);
  await metti(r7, "Fumetti/Spawn Origins Collection/Spawn Origins Collection v28 (2024) (digital) (DrVink-HD-DCP).cbz", 60);
  await metti(r7, "Fumetti/Locke & Key/Locke & Key v01 - Welcome to Lovecraft (2008) (Digital) (Zone-Empire).cbr", 30);
  const spw = (n, ext) => ({ id: `s${n}`, title: `Spawn Origins Collection v${n}`, saga: "Spawn Origins Collection", sagaOrder: n, fileType: ext, tipo: "fumetti", fileTolto: true });
  const libri7 = [spw(29, "cbr"), spw(30, "cbr"), spw(31, "cbr"), spw(28, "cbz"), { id: "lk", title: "Locke & Key v01 - Welcome to Lovecraft (2008) (Digital) (Zone-Empire)", saga: "Locke & Key", fileType: "cbr", tipo: "fumetti" }];
  const rap7 = controllaDisco(libri7, await elencaDisco(r7), { tipoDi: () => "fumetti" });
  const l7 = lavoriDalDisco(rap7, { haCopertina: (id) => id === "s28" });
  t.eq("copertine: chi non ce l'ha, col suo file", l7.copertine.map((v) => v.libro.id).sort().join(), "lk,s29,s30,s31");
  t.eq("CBR: solo le schede che stanno sul disco", l7.cbr.map((v) => v.libro.id).sort().join(), "s29,s30,s31");
  // e intanto, nella cartella del v30, un CBZ diverso con lo stesso nome
  await metti(r7, "Fumetti/Spawn Origins Collection/Spawn Origins Collection v30 (2025) (digital) (Son of Ultron-Empire).cbz", 7);
  const aperti = [];
  const e7 = await convertiSulDisco(l7.cbr, {
    radice: r7,
    converti: async (f) => new Blob([new Uint8Array(f.size / 10)]),
    apre: async (f) => aperti.push(f.size) > 0,
  });
  const v7 = await voci(r7);
  t.eq("tre convertiti", e7.convertiti.length, 3);
  t.c("il CBZ nella cartella della saga, col peso giusto", v7.includes("Fumetti/Spawn Origins Collection/Spawn Origins Collection v29 (2024) (digital) (Son of Ultron-Empire).cbz:4"));
  t.c("anche chi stava fuori posto: il CBZ va nella casa della scheda", v7.includes("Fumetti/Spawn Origins Collection/Spawn Origins Collection v31 (2025) (digital) (Son of Ultron-Empire).cbz:6"));
  t.c("un CBZ diverso con lo stesso nome non si copre", v7.includes("Fumetti/Spawn Origins Collection/Spawn Origins Collection v30 (2025) (digital) (Son of Ultron-Empire).cbz:7") && v7.includes("Fumetti/Spawn Origins Collection/Spawn Origins Collection v30 (2025) (digital) (Son of Ultron-Empire) (2).cbz:5"));
  t.c("i CBR convertiti se ne vanno", !v7.some((x) => /Spawn Origins Collection v(29|30|31) .*\.cbr:/.test(x)));
  t.c("nessuna cartella a parte", !v7.some((x) => x.startsWith(CBR_CONVERTITI)));
  t.eq("ogni CBZ scritto si è aperto, prima di togliere il CBR", aperti.sort().join(), "4,5,6");
  t.c("il Locke & Key fuori dal disco non si tocca", v7.includes("Fumetti/Locke & Key/Locke & Key v01 - Welcome to Lovecraft (2008) (Digital) (Zone-Empire).cbr:30"));
  t.c("la frase lo dice", /3 CBR sono diventati CBZ sul disco, nella cartella della sua saga/.test(fraseConvertitiDisco(e7)));
  // un CBZ che non si apre: via lui, il CBR resta
  const r8 = cartella("book-companion");
  await metti(r8, "Fumetti/Gamma Saga/Gamma Saga v01.cbr", 20);
  const rap8 = controllaDisco([{ id: "g", title: "Gamma Saga v01", saga: "Gamma Saga", fileType: "cbr", fileTolto: true }], await elencaDisco(r8), { tipoDi: () => "fumetti" });
  const e8 = await convertiSulDisco(lavoriDalDisco(rap8).cbr, { radice: r8, converti: async () => new Blob([new Uint8Array(2)]), apre: async () => false });
  t.c("il CBZ che non si apre si toglie, il CBR resta", e8.mancati.length === 1 && (await voci(r8)).join() === "Fumetti/Gamma Saga/Gamma Saga v01.cbr:20");
  // la conversione gia' fatta (stesso nome, stesso peso) non si rifa', e il CBR se ne va
  await metti(r8, "Fumetti/Gamma Saga/Gamma Saga v01.cbz", 2);
  const e8b = await convertiSulDisco(lavoriDalDisco(controllaDisco([{ id: "g", title: "Gamma Saga v01", saga: "Gamma Saga", fileType: "cbr", fileTolto: true }], (await elencaDisco(r8)).filter((f) => f.nome.endsWith(".cbr")), { tipoDi: () => "fumetti" })).cbr, { radice: r8, converti: async () => new Blob([new Uint8Array(2)]) });
  t.c("la conversione già fatta non si rifà", e8b.convertiti.length === 1 && (await voci(r8)).join() === "Fumetti/Gamma Saga/Gamma Saga v01.cbz:2");
  // un CBZ che c'era gia' e non si apre non e' nostro: non si cancella
  await metti(r8, "Fumetti/Gamma Saga/Gamma Saga v02.cbr", 20);
  await metti(r8, "Fumetti/Gamma Saga/Gamma Saga v02.cbz", 2);
  const g2 = lavoriDalDisco(controllaDisco([{ id: "g2", title: "Gamma Saga v02", saga: "Gamma Saga", fileType: "cbr", fileTolto: true }], (await elencaDisco(r8)).filter((f) => f.nome.endsWith(".cbr")), { tipoDi: () => "fumetti" })).cbr;
  await convertiSulDisco(g2, { radice: r8, converti: async () => new Blob([new Uint8Array(2)]), apre: async () => false });
  t.c("il CBZ che c'era già resta, anche se non si apre", (await voci(r8)).includes("Fumetti/Gamma Saga/Gamma Saga v02.cbz:2") && (await voci(r8)).includes("Fumetti/Gamma Saga/Gamma Saga v02.cbr:20"));
  // il CBR che il disco non lascia togliere resta accanto al suo CBZ, e si dice
  const fermo = g2.map((v) => ({ ...v, file: { ...v.file, dir: Object.assign(Object.create(v.file.dir), { removeEntry: async () => { throw new Error("no"); } }) } }));
  const e8c = await convertiSulDisco(fermo, { radice: r8, converti: async () => new Blob([new Uint8Array(2)]) });
  t.c("il CBR rimasto si dice", e8c.convertiti[0]?.cbrTenuto && /un CBR è rimasto accanto al suo CBZ/.test(fraseConvertitiDisco(e8c)));
  // un «.cbr» che dentro e' uno ZIP si copia col nome giusto, senza convertire
  const r9 = cartella("book-companion");
  await metti(r9, "Fumetti/Zeta Saga/Zeta Saga v01.cbr", 9);
  const rap9 = controllaDisco([{ id: "z", title: "Zeta Saga v01", saga: "Zeta Saga", fileType: "cbr", fileTolto: true }], await elencaDisco(r9), { tipoDi: () => "fumetti" });
  let chiamata = false;
  await convertiSulDisco(lavoriDalDisco(rap9).cbr, { radice: r9, eZip: async () => true, converti: async () => (chiamata = true) });
  t.c("uno ZIP non si converte", !chiamata && (await voci(r9)).join() === "Fumetti/Zeta Saga/Zeta Saga v01.cbz:9");
  // una conversione che fallisce e' di quel volume
  const r10 = cartella("book-companion");
  await metti(r10, "Fumetti/Alpha Saga/Alpha Saga v01.cbr", 9);
  await metti(r10, "Fumetti/Alpha Saga/Alpha Saga v02.cbr", 9);
  const rap10 = controllaDisco([{ id: "a1", title: "Alpha Saga v01", saga: "Alpha Saga", fileType: "cbr", fileTolto: true }, { id: "a2", title: "Alpha Saga v02", saga: "Alpha Saga", fileType: "cbr", fileTolto: true }], await elencaDisco(r10), { tipoDi: () => "fumetti" });
  const e10 = await convertiSulDisco(lavoriDalDisco(rap10).cbr, { radice: r10, converti: async (f) => { if (f.size === 9 && !e10ok.length) { e10ok.push(1); throw new Error("rotto"); } return new Blob([new Uint8Array(1)]); } });
  t.c("un intoppo è di quel volume, l'altro si converte", e10.mancati.length === 1 && e10.convertiti.length === 1);
  t.c("e il CBR rotto resta dov'era", (await voci(r10)).filter((x) => x.startsWith("Fumetti/Alpha Saga/") && x.endsWith(".cbr:9")).length === 1);
  const e11 = await convertiSulDisco(lavoriDalDisco(rap10).cbr, { radice: r10, vivo: () => false, converti: async () => new Blob([]) });
  t.c("fermato prima: niente", e11.fermato && !e11.convertiti.length);
  // fermato mentre convertiva: il CBZ non si scrive
  let giri = 0;
  const r12 = cartella("book-companion");
  await metti(r12, "Fumetti/Beta Saga/Beta Saga v01.cbr", 9);
  const rap12 = controllaDisco([{ id: "b1", title: "Beta Saga v01", saga: "Beta Saga", fileType: "cbr", fileTolto: true }], await elencaDisco(r12), { tipoDi: () => "fumetti" });
  const e12 = await convertiSulDisco(lavoriDalDisco(rap12).cbr, { radice: r12, vivo: () => giri++ < 1, converti: async () => new Blob([new Uint8Array(3)]) });
  t.c("fermato a conversione finita: niente scritto", e12.fermato && !(await voci(r12)).some((x) => x.endsWith(".cbz:3")));
  // il CBZ scritto corto non resta, e il CBR nemmeno se ne va
  const corto = { size: 10, stream: () => new Blob([new Uint8Array(1)]).stream() };
  const e13 = await convertiSulDisco(lavoriDalDisco(rap12).cbr, { radice: r12, converti: async () => corto });
  t.c("un CBZ col peso sbagliato si toglie", e13.mancati.length === 1 && (await voci(r12)).join() === "Fumetti/Beta Saga/Beta Saga v01.cbr:9");

  // LA CARTELLA «CBR CONVERTITI» DI QUEL GIORNO SI SVUOTA: via i CBR il cui
  // CBZ sta gia' sul disco; chi non ce l'ha resta, e la cartella solo vuota se ne va
  const r14 = cartella("book-companion");
  await metti(r14, `${CBR_CONVERTITI}/Fumetti/Spawn Origins Collection/Spawn Origins Collection v29 (2024).cbr`, 40);
  await metti(r14, `${CBR_CONVERTITI}/Fumetti/Spawn Origins Collection/Spawn Origins Collection v30 (2025).cbr`, 50);
  await metti(r14, "Fumetti/Spawn Origins Collection/Spawn Origins Collection v29 (2024).cbz", 4);
  const c14 = await cbrNeiConvertiti(r14, await elencaDisco(r14));
  t.eq("col suo CBZ uno, senza uno", `${c14.conCbz.map((f) => f.nome).join()}|${c14.senza.map((f) => f.nome).join()}|${c14.byte}`, "Spawn Origins Collection v29 (2024).cbr|Spawn Origins Collection v30 (2025).cbr|40");
  const s14 = await svuotaConvertiti(c14, r14);
  t.c("tolto il CBR col CBZ, l'altro resta, e la cartella pure", s14.tolti === 1 && s14.restano === 1 && (await voci(r14)).includes(`${CBR_CONVERTITI}/Fumetti/Spawn Origins Collection/Spawn Origins Collection v30 (2025).cbr:50`));
  await metti(r14, "Fumetti/Spawn Origins Collection/Spawn Origins Collection v30 (2025).cbz", 5);
  const s14b = await svuotaConvertiti(await cbrNeiConvertiti(r14, await elencaDisco(r14)), r14);
  t.c("vuota, la cartella se ne va", s14b.tolti === 1 && !s14b.restano && !(await voci(r14)).some((x) => x.startsWith(CBR_CONVERTITI)) && !r14.dentro.has(CBR_CONVERTITI));
  t.eq("senza la cartella, niente da dire", await cbrNeiConvertiti(cartella("book-companion"), []), null);
};
const e10ok = [];
