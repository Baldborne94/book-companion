// La cartella Biblioteca del NAS, servita da Caddy sulla stessa origine
// dell'app (deploy/nas). Altrove (Vercel, dev) il percorso risponde con
// index.html e la funzione semplicemente non compare.
export const NAS_ROOT = "/biblioteca/";

const SUPPORTED = /\.(epub|pdf|cbz)$/i;
const TOP_GENRE = { fumetti: "Fumetti", manga: "Manga" };

export async function listNasDir(path = NAS_ROOT) {
  const res = await fetch(path, { headers: { Accept: "application/json" }, cache: "no-store" });
  if (!res.ok || !(res.headers.get("content-type") || "").includes("json")) {
    throw new Error("NAS non raggiungibile");
  }
  const list = await res.json();
  if (!Array.isArray(list)) throw new Error("risposta inattesa");
  return list
    .map((e) => {
      const name = String(e.name || "").replace(/\/$/, "");
      const isDir = !!e.is_dir;
      return { name, isDir, size: e.size || 0, path: path + encodeURIComponent(name) + (isDir ? "/" : "") };
    })
    .filter((e) => e.name && !e.name.startsWith(".") && !e.name.startsWith("@") && (e.isDir || SUPPORTED.test(e.name)))
    .sort((a, b) => (b.isDir - a.isDir) || a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
}

export async function nasAvailable() {
  try {
    await listNasDir();
    return true;
  } catch {
    return false;
  }
}

export async function fetchNasFile(entry) {
  const res = await fetch(entry.path);
  if (!res.ok) throw new Error(`download fallito (${res.status})`);
  return new File([await res.blob()], entry.name);
}

export const nasSegments = (path) =>
  path.slice(NAS_ROOT.length).split("/").filter(Boolean).map(decodeURIComponent);

// La posizione nella cartella dice gia' molto: la cartella di primo livello
// e' il genere (Manga → lettura da destra), la sottocartella e' la saga, il
// numero nel nome del file e' il volume.
export function metaFromNasPath(path) {
  const segs = nasSegments(path);
  const file = segs.pop() || "";
  const meta = { nasPath: path };
  const genre = TOP_GENRE[(segs[0] || "").toLowerCase()];
  if (genre) meta.genre = genre;
  if (segs.length >= 2) {
    meta.saga = segs[segs.length - 1];
    const base = file.replace(/\.[^.]+$/, "");
    const m = base.match(/(?:vol(?:ume)?|v|#|tomo|cap(?:itolo)?|ch)\.?\s*(\d+(?:\.\d+)?)/i) || base.match(/(\d+(?:\.\d+)?)(?!.*\d)/);
    if (m) meta.sagaOrder = parseFloat(m[1]);
  }
  return meta;
}

export const isRtl = (book) => (book?.genre || "").toLowerCase() === "manga";
