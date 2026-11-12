// IL NAS DI CASA (`lib/nas.js`), chiesto dal lettore per leggere anche fuori
// casa. Un NAS finto che risponde come nginx con `autoindex_format json`: le
// cartelle del disco, i file col peso, e i guasti che il lettore puo' vedere.
import { controllaNas, casaSulNas, normalizzaNas, cartellaNas, elencoNas, provaNas, libriSulNas, prendiDalNas, fraseNas, salvaLibriSulNas, leggiLibriSulNas, sulNas, salvaIndirizzoNas, indirizzoNas } from "../src/lib/nas.js";
import { elencaDisco, controllaDisco } from "../src/lib/disco.js";

const BASE = "https://nas.tail1234.ts.net/libri/";
const albero = {
  "": [{ name: "book-companion", type: "directory" }, { name: ".Trash", type: "directory" }],
  "book-companion/": [{ name: "Libri", type: "directory" }, { name: "Fumetti", type: "directory" }, { name: "_Doppioni", type: "directory" }],
  "book-companion/Libri/": [{ name: "The World of Elan", type: "directory" }, { name: "Neverwhere.epub", type: "file", size: 300 }],
  "book-companion/Libri/The%20World%20of%20Elan/": [{ name: "Age of Myth.epub", type: "file", size: 1200 }, { name: "note.txt", type: "file", size: 5 }],
  "book-companion/Fumetti/": [{ name: "Kingdom", type: "directory" }],
  "book-companion/Fumetti/Kingdom/": [{ name: "Kingdom v06.cbz", type: "file", size: 5000 }],
  "book-companion/_Doppioni/": [{ name: "Age of Myth.epub", type: "file", size: 1200 }],
};
const byte = { "book-companion/Libri/The%20World%20of%20Elan/Age%20of%20Myth.epub": 1200 };
const chieste = [];
const nas = async (url) => {
  chieste.push(url);
  const p = url.slice(BASE.length);
  if (p in albero) return { ok: true, status: 200, json: async () => albero[p] };
  if (p in byte) return { ok: true, status: 200, blob: async () => new Blob([new Uint8Array(byte[p])]) };
  return { ok: false, status: 404 };
};
const memoria = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};

export default async (t) => {
  t.eq("l'indirizzo come lo scrive il lettore: https e la barra in fondo", normalizzaNas(" nas.tail1234.ts.net/libri "), BASE);
  t.eq("…e uno con lo schema resta com'e'", normalizzaNas("http://192.168.1.20:8080/libri/"), "http://192.168.1.20:8080/libri/");
  t.eq("…e uno che non e' un indirizzo no", normalizzaNas("ftp://nas/libri"), null);
  const st = memoria();
  salvaIndirizzoNas("nas.tail1234.ts.net/libri", st);
  t.eq("l'indirizzo si ricorda sul dispositivo", indirizzoNas(st), BASE);

  t.eq("l'elenco nasconde i file col punto", (await elencoNas(BASE, [], { chiedi: nas })).map((v) => v.name).join(), "book-companion");

  // la cartella del NAS ha la forma di una cartella del disco: «Controlla il
  // disco» ci gira sopra cosi' com'e'
  chieste.length = 0;
  const casa = cartellaNas(BASE, ["book-companion"], { chiedi: nas });
  const file = await elencaDisco(casa);
  t.eq("i file dei libri, col percorso e il peso, senza _Doppioni", file.map((f) => `${[...f.cartelle, f.nome].join("/")}=${f.byte}`).join(" | "), "Libri/The World of Elan/Age of Myth.epub=1200 | Libri/Neverwhere.epub=300 | Fumetti/Kingdom/Kingdom v06.cbz=5000");
  t.c("i pesi arrivano con l'elenco: nessuna domanda per file", chieste.every((u) => u.endsWith("/")));
  const libri = [
    { id: "am", title: "Age of Myth", author: "Michael J. Sullivan", saga: "The World of Elan", series: "Legends of the First Empire", sagaOrder: 1, fileType: "epub" },
    { id: "k6", title: "Kingdom v06", saga: "Kingdom", sagaOrder: 6, fileType: "cbz", tipo: "manga" },
    { id: "zz", title: "Un libro che il NAS non ha", fileType: "epub" },
  ];
  const esito = controllaDisco(libri, file, { tipoDi: (b) => (b.tipo === "manga" ? "manga" : b.fileType === "cbz" ? "fumetti" : "libri") });
  const mappa = libriSulNas(esito);
  t.eq("i libri che il NAS ha, col percorso dalla cartella dell'app", Object.entries(mappa).map(([id, v]) => `${id}:${v.pezzi.join("/")}`).sort().join(" | "), "am:Libri/The World of Elan/Age of Myth.epub | k6:Fumetti/Kingdom/Kingdom v06.cbz");
  t.c("…e non quello che non ha", !mappa.zz);
  salvaLibriSulNas(mappa, 5, st);
  t.eq("si ricorda sul dispositivo", `${leggiLibriSulNas(st).quando} ${sulNas("am", st)?.byte}`, "5 1200");

  // un libro scende come un file scelto dal lettore, col suo nome e il suo tipo
  const voce = { pezzi: ["book-companion", ...mappa.am.pezzi], byte: mappa.am.byte };
  const f = await prendiDalNas(BASE, voce, { chiedi: nas });
  t.eq("il libro scende col suo nome, il tipo e il peso", `${f.name} ${f.type} ${f.size}`, "Age of Myth.epub application/epub+zip 1200");
  let tagliato = null;
  await prendiDalNas(BASE, { ...voce, byte: 999 }, { chiedi: nas }).catch((e) => (tagliato = e.motivo));
  t.eq("un peso diverso dal controllo non entra", tagliato, "tagliato");

  // il controllo intero: dall'indirizzo che contiene «book-companion», o da lei
  const tipoDi = (b) => (b.tipo === "manga" ? "manga" : b.fileType === "cbz" ? "fumetti" : "libri");
  const tutto = await controllaNas(libri, BASE, { chiedi: nas, elenca: elencaDisco, controlla: controllaDisco, tipoDi });
  t.eq("il controllo del NAS: i file e il percorso intero dall'indirizzo", `${tutto.file} ${tutto.mappa.am.pezzi.join("/")}`, "3 book-companion/Libri/The World of Elan/Age of Myth.epub");
  t.eq("…e il libro scende da quel percorso", (await prendiDalNas(BASE, tutto.mappa.am, { chiedi: nas })).size, 1200);
  t.eq("l'indirizzo puo' essere la cartella stessa", (await casaSulNas(`${BASE}book-companion/`, { chiedi: nas })).pezzi.length, 0);
  let senzaCasa = null;
  await casaSulNas(`${BASE}book-companion/Libri/`, { chiedi: nas }).catch((e) => (senzaCasa = e.motivo));
  t.eq("un indirizzo senza «book-companion» lo dice", senzaCasa, "senzaCasa");

  // i guasti si dicono con la loro strada
  t.eq("fuori casa senza Tailscale", (await provaNas(BASE, { chiedi: async () => { throw new TypeError("Failed to fetch"); } })).motivo, "rete");
  t.c("…e la frase dice Tailscale", /Tailscale/.test(fraseNas("rete")));
  t.eq("una cartella sbagliata", (await provaNas(`${BASE}sbagliata/`, { chiedi: nas })).motivo, "manca");
  t.eq("un NAS che non elenca in JSON", (await provaNas(BASE, { chiedi: async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError("<html>"); } }) })).motivo, "formato");
  t.eq("un NAS che risponde JSON ma non un elenco", (await provaNas(BASE, { chiedi: async () => ({ ok: true, status: 200, json: async () => ({ error: "no index" }) }) })).motivo, "formato");
  t.eq("un NAS che non lascia entrare", (await provaNas(BASE, { chiedi: async () => ({ ok: false, status: 403 }) })).motivo, "rifiuta");
  const ok = await provaNas(BASE, { chiedi: nas });
  t.eq("il NAS che risponde dice cosa c'e' in cima", `${ok.ok} ${ok.frase}`, "true Il NAS risponde: book-companion.");
};
