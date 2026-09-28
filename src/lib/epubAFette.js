// UN EPUB LETTO A PEZZI: titolo, autore, retro, collana e copertina senza
// avere il libro in mano.
//
// Serve ad «Aggiungi da Drive»: il libro sta lassu', e per metterlo sullo
// scaffale bastano l'OPF e un'immagine — poche centinaia di chilobyte su
// un file da venti megabyte (chiesto dal lettore: portare i libri sul
// tablet «ci mette una vita»). epub.js non si puo' usare, perche' vuole
// l'archivio intero; qui lo zip si legge a fette (`apriZip`) e l'OPF con le
// espressioni, e alla copertina si arriva dalla STESSA `trovaCopertina`
// dell'import, dandole un finto libro aperto con le tre cose che guarda.
// Due strade per la copertina che divergessero sarebbero due copertine
// diverse per lo stesso file, a seconda della porta da cui e' entrato.
import { apriZip } from "./zipAFette.js";
import { dir, risolvi } from "./unisciEpub.js";

const ENTITA = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const sciogli = (s) =>
  String(s ?? "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (tutto, e) => {
      if (e[0] === "#") {
        const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        try {
          return String.fromCodePoint(n);
        } catch {
          return tutto;
        }
      }
      return ENTITA[e.toLowerCase()] ?? tutto;
    });

const ATTR = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
function attributi(tag) {
  const fuori = {};
  let m;
  ATTR.lastIndex = 0;
  while ((m = ATTR.exec(tag))) fuori[m[1].toLowerCase()] = sciogli(m[2] ?? m[3] ?? "");
  return fuori;
}

// il primo elemento con quel nome, col prefisso che il file gli ha dato
// (`dc:title`, `dcterms:title`, o nessuno)
function primo(xml, nome) {
  const m = new RegExp(`<(?:[\\w-]+:)?${nome}\\b[^>]*>([\\s\\S]*?)</(?:[\\w-]+:)?${nome}\\s*>`, "i").exec(xml);
  return m ? sciogli(m[1]).trim() : "";
}

// un href e' un URI: gli spazi arrivano come %20, e il nome nello zip no.
// Si scioglie UNA volta, quando si cerca nello zip (`libroFinto`): ci
// arrivano sia i percorsi dell'OPF sia quelli delle pagine, e sciolti due
// volte un file che si chiama davvero «100%25» diventerebbe un altro
const decodifica = (h) => {
  try {
    return decodeURIComponent(h);
  } catch {
    return h;
  }
};

// Quel che epub.js legge dall'OPF, e nello stesso ordine: la copertina e'
// prima quella dichiarata alla EPUB 3 (`properties="cover-image"`), poi il
// `<meta name="cover">` di EPUB 2. I percorsi escono risolti dalla cartella
// dell'OPF, cioe' come stanno nell'archivio.
export function leggiOpf(opf, opfPath = "") {
  const xml = String(opf || "");
  const base = dir(opfPath);
  const voci = new Map();
  for (const m of xml.matchAll(/<(?:[\w-]+:)?item\b[^>]*>/gi)) {
    const a = attributi(m[0]);
    if (a.id && a.href) voci.set(a.id, { ...a, path: risolvi(base, a.href) });
  }
  const copertinaV3 = [...voci.values()].find((v) => /(^|\s)cover-image(\s|$)/.test(v.properties || ""));
  let idV2 = "";
  for (const m of xml.matchAll(/<(?:[\w-]+:)?meta\b[^>]*>/gi)) {
    const a = attributi(m[0]);
    if (a.name === "cover" && a.content) idV2 = a.content;
  }
  const copertina = copertinaV3?.path || voci.get(idV2)?.path || null;
  const spina = [];
  for (const m of xml.matchAll(/<(?:[\w-]+:)?itemref\b[^>]*>/gi)) {
    const v = voci.get(attributi(m[0]).idref);
    if (v?.path) spina.push(v.path);
  }
  return {
    title: primo(xml, "title"),
    creator: primo(xml, "creator"),
    description: primo(xml, "description"),
    copertina,
    spina,
  };
}

const TIPI = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml" };
const tipoDi = (p) => TIPI[(/\.([a-z0-9]+)$/i.exec(p) || [])[1]?.toLowerCase()] || "";

// il finto libro aperto: `loaded.cover`, `spine.items` e `archive`, che
// sono le sole cose che `trovaCopertina` tocca. I percorsi hanno lo slash
// davanti come quelli di epub.js, e si tolgono per cercare nello zip.
export function libroFinto(zip, info) {
  const nome = (p) => decodifica(String(p || "").replace(/^\/+/, ""));
  const utf8 = new TextDecoder("utf-8");
  return {
    loaded: { cover: Promise.resolve(info.copertina ? `/${info.copertina}` : null), spine: Promise.resolve() },
    spine: { items: info.spina.map((p) => ({ href: p, canonical: `/${p}` })) },
    archive: {
      getText: async (p) => utf8.decode(await zip.leggi(nome(p))),
      getBlob: async (p) => new Blob([await zip.leggi(nome(p))], { type: tipoDi(nome(p)) }),
    },
  };
}

// L'ePub aperto: `null` se non e' un ePub che si sappia leggere (niente
// container, niente OPF). L'OPF torna anche com'e' scritto, per la collana.
export async function apriEpubAFette(blob) {
  const zip = await apriZip(blob);
  const utf8 = new TextDecoder("utf-8");
  if (!zip.nomi.includes("META-INF/container.xml")) return null;
  const contenitore = utf8.decode(await zip.leggi("META-INF/container.xml"));
  const radice = /<(?:[\w-]+:)?rootfile\b[^>]*>/i.exec(contenitore);
  const opfPath = radice ? decodifica(attributi(radice[0])["full-path"] || "") : "";
  if (!opfPath || !zip.nomi.includes(opfPath)) return null;
  const opf = utf8.decode(await zip.leggi(opfPath));
  const info = leggiOpf(opf, opfPath);
  return { opf, info, libro: libroFinto(zip, info) };
}
