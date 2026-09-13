// ORDINA UNA CARTELLA DI LIBRI PER SAGA, sul disco.
//
//   node scripts/ordinaLibri.mjs "E:\Libri"              → mostra il piano, non tocca niente
//   node scripts/ordinaLibri.mjs "E:\Libri" --sposta     → esegue gli spostamenti
//   node scripts/ordinaLibri.mjs "E:\Libri" --catalogo   → chiede anche a Open Library
//
// Per ogni .epub legge titolo, autore e collana dall'OPF (i .pdf hanno solo
// il nome del file), riconosce la saga con la stessa catena dell'app
// (`src/lib/ordinaCartella.js`) e sposta ogni libro in `<cartella>/<Saga>/`.
// Chi non ha una saga resta dov'e'. Non sovrascrive mai un file.
//
// `--catalogo` manda titolo e autore a Open Library per i libri che le
// strade locali non riconoscono: e' la stessa eccezione dichiarata
// nell'app (un catalogo bibliografico, non un modello), e si accende solo
// a richiesta.
import { readdir, readFile, mkdir, rename, stat } from "node:fs/promises";
import path from "node:path";
import { assegnaSaghe, pianifica } from "../src/lib/ordinaCartella.js";
import { collana } from "../src/lib/collana.js";
import { deduciSaghe, unificaSaghe, nomeInBiblioteca } from "../src/lib/sagaBooks.js";

const argomenti = process.argv.slice(2);
const radice = argomenti.find((a) => !a.startsWith("--"));
const sposta = argomenti.includes("--sposta");
const catalogo = argomenti.includes("--catalogo");

if (!radice) {
  console.error('Uso: node scripts/ordinaLibri.mjs "<cartella>" [--sposta] [--catalogo]');
  process.exit(1);
}

const LIBRO = /\.(epub|pdf)$/i;

async function elenca(dir) {
  const out = [];
  for (const voce of await readdir(dir, { withFileTypes: true })) {
    if (voce.name.startsWith(".")) continue;
    const p = path.join(dir, voce.name);
    if (voce.isDirectory()) out.push(...(await elenca(p)));
    else if (LIBRO.test(voce.name)) out.push(p);
  }
  return out;
}

const testo = (s) =>
  String(s || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

// L'OPF si trova da container.xml, come fa epub.js. Un archivio rotto o
// senza OPF torna un libro col solo nome del file, mai un'eccezione: un
// file storto non deve fermare il giro sugli altri.
async function leggiEpub(p) {
  try {
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(await readFile(p));
    const container = await zip.file("META-INF/container.xml")?.async("string");
    const percorso = container?.match(/full-path\s*=\s*["']([^"']+)["']/i)?.[1];
    const opf = percorso ? await zip.file(percorso)?.async("string") : null;
    if (!opf) return {};
    return {
      title: testo(opf.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i)?.[1]),
      author: testo(opf.match(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/i)?.[1]),
      collana: collana(opf),
    };
  } catch {
    return {};
  }
}

const inizio = await stat(radice).catch(() => null);
if (!inizio?.isDirectory()) {
  console.error(`Non trovo la cartella: ${radice}`);
  process.exit(1);
}

const percorsi = await elenca(radice);
console.log(`${percorsi.length} libri in ${radice}\n`);

const libri = [];
for (const p of percorsi) {
  const fileName = path.basename(p);
  const meta = /\.epub$/i.test(fileName) ? await leggiEpub(p) : {};
  libri.push({
    id: p,
    path: p,
    fileName,
    title: meta.title || fileName.replace(LIBRO, ""),
    author: meta.author || "",
    collana: meta.collana || null,
  });
}

let assegnati = assegnaSaghe(libri);

if (catalogo) {
  const { cercaSaga } = await import("../src/lib/sagaDalCatalogo.js");
  let chiesti = 0;
  for (const b of assegnati) {
    if (b.saga) continue;
    chiesti += 1;
    process.stdout.write(`  🌐 ${b.title} … `);
    try {
      const r = await cercaSaga({ title: b.title, author: b.author });
      if (r?.saga) {
        b.saga = nomeInBiblioteca(r.saga, assegnati);
        if (r.sagaOrder != null) b.sagaOrder = r.sagaOrder;
        b.fonte = "catalogo";
        console.log(`«${b.saga}»`);
      } else console.log("il catalogo non la sa");
    } catch {
      console.log("manca la rete");
    }
  }
  if (chiesti) {
    // imparata una saga dal catalogo, i fratelli la ereditano
    const { campi } = deduciSaghe(assegnati);
    for (const b of assegnati) {
      if (b.saga || !campi[b.id]?.saga) continue;
      b.saga = campi[b.id].saga;
      b.fonte = "fratelli";
    }
    const { campi: unite } = unificaSaghe(assegnati);
    for (const b of assegnati) if (unite[b.id]?.saga) b.saga = unite[b.id].saga;
    console.log("");
  }
}

const piano = pianifica(assegnati, radice, path);
const FONTE = { tavola: "tavola", file: "collana nel file", titolo: "titolo", fratelli: "dai fratelli", catalogo: "catalogo" };

for (const [cartella, n] of [...piano.saghe.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  console.log(`📚 ${cartella} · ${n}`);
  const dentro = [...piano.mosse, ...piano.ferme]
    .filter((b) => b.cartella === cartella)
    .sort((a, b) => (a.sagaOrder ?? 999) - (b.sagaOrder ?? 999));
  for (const b of dentro) {
    const n = b.sagaOrder != null ? `${b.sagaOrder}. ` : "";
    const stato = b.da ? "→" : "=";
    console.log(`   ${stato} ${n}${b.fileName}  (${FONTE[b.fonte] || b.fonte})`);
  }
}
if (piano.senza.length) {
  console.log(`\n— ${piano.senza.length} senza saga, restano dove sono:`);
  for (const b of piano.senza) console.log(`   ${b.fileName}`);
}
if (piano.doppioni.length) {
  console.log(`\n⚠ ${piano.doppioni.length} non si spostano: nella cartella di arrivo c'è già un file con lo stesso nome`);
  for (const b of piano.doppioni) console.log(`   ${b.path}`);
}

console.log(`\n${piano.mosse.length} da spostare · ${piano.ferme.length} già a posto · ${piano.senza.length} senza saga`);

if (!sposta) {
  if (piano.mosse.length) console.log("\nNiente è stato toccato. Per eseguire: aggiungi --sposta");
  process.exit(0);
}

let fatte = 0;
for (const m of piano.mosse) {
  try {
    await mkdir(path.dirname(m.a), { recursive: true });
    if (await stat(m.a).catch(() => null)) {
      console.log(`⚠ esiste già, salto: ${m.a}`);
      continue;
    }
    await rename(m.da, m.a);
    fatte += 1;
  } catch (e) {
    console.log(`⚠ non riesco a spostare ${m.da}: ${e.message}`);
  }
}
console.log(`\n✓ ${fatte} libri spostati`);
