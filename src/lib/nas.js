// IL NAS DI CASA, raggiungibile anche da fuori (chiesto dal lettore: «il
// nas proprio come nas locale», «vorrei leggere anche fuori casa», per un
// UGREEN NASync DXP2800 con Docker). L'app resta su Vercel: cambiare
// indirizzo vorrebbe dire un'altra memoria del browser e un APK che non la
// apre. Il NAS fa da server dei file: un nginx in Docker che elenca le
// cartelle in JSON (`autoindex_format json`), serve i file a pezzi (Range)
// e lascia entrare la nostra app (CORS, e la rete privata: `docs/NAS.md`),
// dietro Tailscale, che da' l'HTTPS e la strada da fuori casa.
//
// Le cartelle sono quelle del disco del computer (`casaDelVolume`): il NAS
// fa da cartella per `elencaDisco` e `controllaDisco`, che abbinano i file
// alle schede con le regole collaudate sui 1698 volumi del lettore. Un libro
// che qui non ha il file e sul NAS si', all'«Apri» scende e entra dalla
// porta di sempre (`daFuori`), nella sua scheda.
//
// La rete si passa da fuori (`chiedi`), come in `syncCore`: qui si decide.

export const CHIAVE_NAS = "bc_nas";
export const CHIAVE_LIBRI_NAS = "bc_nas_libri";

// l'indirizzo come lo scrive il lettore: senza schema e' https (Tailscale lo
// da' cosi'), e finisce con «/» perche' e' una cartella
export function normalizzaNas(scritto) {
  let s = String(scritto || "").trim();
  if (!s) return null;
  if (!/^[a-z]+:\/\//i.test(s)) s = `https://${s}`;
  let u;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  u.hash = "";
  u.search = "";
  if (!u.pathname.endsWith("/")) u.pathname += "/";
  return u.href;
}

const leggi = (st, k) => {
  try {
    return st?.getItem(k) ?? null;
  } catch {
    return null;
  }
};
const scrivi = (st, k, v) => {
  try {
    if (v == null) st?.removeItem(k);
    else st?.setItem(k, v);
  } catch {
    /* senza memoria vale per adesso */
  }
};

export const indirizzoNas = (st = globalThis.localStorage) => normalizzaNas(leggi(st, CHIAVE_NAS));
export function salvaIndirizzoNas(scritto, st = globalThis.localStorage) {
  const url = normalizzaNas(scritto);
  scrivi(st, CHIAVE_NAS, url);
  return url;
}

// l'indirizzo di una cartella o di un file, dai pezzi del percorso
export const urlNas = (base, pezzi = [], cartella = false) => `${base}${pezzi.map(encodeURIComponent).join("/")}${cartella && pezzi.length ? "/" : ""}`;

// UNA CARTELLA DEL NAS CON LA FORMA DI UNA CARTELLA DEL DISCO: `entries()`
// da' [nome, maniglia], la maniglia di un file ha `getFile()` col peso. Il
// peso arriva gia' con l'elenco: nessuna richiesta in piu' per file (sul disco
// erano 1698 domande).
export function cartellaNas(base, pezzi = [], { chiedi = globalThis.fetch } = {}) {
  return {
    kind: "directory",
    name: pezzi.at(-1) || "",
    pezzi,
    async *entries() {
      for (const v of await elencoNas(base, pezzi, { chiedi })) {
        if (v.type === "directory") yield [v.name, cartellaNas(base, [...pezzi, v.name], { chiedi })];
        else if (v.type === "file") yield [v.name, { kind: "file", name: v.name, pezzi: [...pezzi, v.name], getFile: async () => ({ size: Number(v.size) || 0 }) }];
      }
    },
  };
}

export class GuastoNas extends Error {
  constructor(motivo, dettaglio = "") {
    super(`${motivo}${dettaglio ? `: ${dettaglio}` : ""}`);
    this.motivo = motivo;
  }
}

// l'elenco di una cartella, come lo da' nginx con `autoindex_format json`:
// [{ name, type: "directory" | "file", mtime, size }]
export async function elencoNas(base, pezzi = [], { chiedi = globalThis.fetch } = {}) {
  let r;
  try {
    r = await chiedi(urlNas(base, pezzi, true), { headers: { Accept: "application/json" } });
  } catch (e) {
    throw new GuastoNas("rete", e?.message);
  }
  if (r.status === 401 || r.status === 403) throw new GuastoNas("rifiuta", String(r.status));
  if (r.status === 404) throw new GuastoNas("manca", urlNas(base, pezzi, true));
  if (!r.ok) throw new GuastoNas("server", String(r.status));
  let j;
  try {
    j = await r.json();
  } catch {
    throw new GuastoNas("formato");
  }
  if (!Array.isArray(j)) throw new GuastoNas("formato");
  return j.filter((v) => v && typeof v.name === "string" && !v.name.startsWith("."));
}

// COSA DIRE AL LETTORE: il guasto con la sua strada, mai il testo grezzo
export function fraseNas(guasto) {
  const m = guasto?.motivo || guasto;
  if (m === "rete")
    return "Il NAS non risponde da qui. Fuori casa serve Tailscale acceso su questo dispositivo; se è acceso, controlla l'indirizzo e che il NAS lasci entrare l'app (CORS, in docs/NAS.md).";
  if (m === "rifiuta") return "Il NAS risponde ma non lascia entrare: controlla i permessi della cartella condivisa.";
  if (m === "manca") return "Il NAS risponde, ma a questo indirizzo non c'è la cartella dei libri.";
  if (m === "formato") return "Il NAS risponde, ma non con l'elenco delle cartelle: nella sua configurazione serve «autoindex_format json» (docs/NAS.md).";
  if (m === "server") return "Il NAS ha risposto con un guasto: riprova fra poco.";
  if (m === "senzaCasa") return "Il NAS risponde, ma qui dentro non c'è la cartella «book-companion»: scrivi l'indirizzo di quella che la contiene, o il suo.";
  if (m === "tagliato") return "Il file è arrivato dal NAS a metà: riprova.";
  return "Il NAS non ha risposto come doveva.";
}

// la prova del collegamento: risponde, e cosa c'e' in cima
export async function provaNas(base, { chiedi = globalThis.fetch } = {}) {
  if (!base) return { ok: false, frase: "Scrivi l'indirizzo del NAS." };
  try {
    const voci = await elencoNas(base, [], { chiedi });
    const cartelle = voci.filter((v) => v.type === "directory").map((v) => v.name);
    return { ok: true, cartelle, frase: cartelle.length ? `Il NAS risponde: ${cartelle.join(", ")}.` : "Il NAS risponde, ma la cartella è vuota." };
  } catch (e) {
    return { ok: false, motivo: e?.motivo || "rete", frase: fraseNas(e) };
  }
}

// I LIBRI CHE IL NAS HA, per scheda: dal rapporto di `controllaDisco`, chi ha
// il suo file (a posto o fuori posto). Si tiene sul dispositivo col giorno
// del controllo, e si rifa' quando il lettore controlla di nuovo.
export function libriSulNas(esito) {
  const out = {};
  for (const v of [...(esito?.aPosto || []), ...(esito?.daSpostare || [])]) {
    const id = v?.libro?.id;
    const f = v?.file;
    if (!id || !f?.nome) continue;
    out[id] = { pezzi: [...(f.cartelle || []), f.nome], byte: f.byte || 0 };
  }
  return out;
}
export function salvaLibriSulNas(mappa, quando = Date.now(), st = globalThis.localStorage) {
  scrivi(st, CHIAVE_LIBRI_NAS, JSON.stringify({ quando, libri: mappa || {} }));
}
export function leggiLibriSulNas(st = globalThis.localStorage) {
  try {
    const j = JSON.parse(leggi(st, CHIAVE_LIBRI_NAS) || "null");
    return j && typeof j.libri === "object" ? j : { quando: 0, libri: {} };
  } catch {
    return { quando: 0, libri: {} };
  }
}
export const sulNas = (id, st = globalThis.localStorage) => leggiLibriSulNas(st).libri[id] || null;

const TIPI = { epub: "application/epub+zip", pdf: "application/pdf", cbz: "application/vnd.comicbook+zip", cbr: "application/vnd.comicbook-rar" };

// UN LIBRO SCENDE DAL NAS come un file scelto dal lettore: un `File` col suo
// nome, che entra dalla porta di sempre. Un peso diverso da quello del
// controllo vuol dire un file cambiato o tagliato a meta': non entra.
export async function prendiDalNas(base, voce, { chiedi = globalThis.fetch, FileCtor = globalThis.File } = {}) {
  let r;
  try {
    r = await chiedi(urlNas(base, voce.pezzi));
  } catch (e) {
    throw new GuastoNas("rete", e?.message);
  }
  if (r.status === 401 || r.status === 403) throw new GuastoNas("rifiuta", String(r.status));
  if (r.status === 404) throw new GuastoNas("manca", voce.pezzi.join("/"));
  if (!r.ok) throw new GuastoNas("server", String(r.status));
  const blob = await r.blob();
  if (voce.byte && blob.size !== voce.byte) throw new GuastoNas("tagliato", `${blob.size} invece di ${voce.byte}`);
  const nome = voce.pezzi.at(-1);
  const est = (/\.([a-z0-9]+)$/i.exec(nome)?.[1] || "").toLowerCase();
  return new FileCtor([blob], nome, { type: TIPI[est] || blob.type || "application/octet-stream" });
}

// LA CASA DEI LIBRI SUL NAS: la cartella «book-companion», come sul disco.
// L'indirizzo puo' essere lei o la cartella che la contiene.
export async function casaSulNas(base, { chiedi = globalThis.fetch, radice = "book-companion" } = {}) {
  if (decodeURIComponent(new URL(base).pathname).replace(/\/$/, "").split("/").pop().toLowerCase() === radice) return cartellaNas(base, [], { chiedi });
  const cima = await elencoNas(base, [], { chiedi });
  const dentro = cima.find((v) => v.type === "directory" && v.name.toLowerCase() === radice);
  if (!dentro) throw new GuastoNas("senzaCasa");
  return cartellaNas(base, [dentro.name], { chiedi });
}

// IL CONTROLLO DEL NAS: le stesse regole del disco (`elencaDisco`,
// `controllaDisco`, iniettati: qui niente si importa che tocchi la rete), e
// la mappa dei libri che il NAS ha, col percorso intero dall'indirizzo
export async function controllaNas(libri, base, { chiedi = globalThis.fetch, elenca, controlla, tipoDi, onFile } = {}) {
  const casa = await casaSulNas(base, { chiedi });
  const file = await elenca(casa, [], { onFile });
  const esito = controlla(libri, file, { tipoDi });
  const mappa = {};
  for (const [id, v] of Object.entries(libriSulNas(esito))) mappa[id] = { ...v, pezzi: [...casa.pezzi, ...v.pezzi] };
  return { esito, mappa, file: file.length };
}

export function fraseRapportoNas(esito) {
  const loro = Object.keys(libriSulNas(esito)).length;
  const senza = esito?.senzaScheda?.length || 0;
  const parti = [`${loro === 1 ? "un libro" : `${loro} libri`} della biblioteca ${loro === 1 ? "ha" : "hanno"} il file sul NAS`];
  if (senza) parti.push(`${senza === 1 ? "un file" : `${senza} file`} senza scheda`);
  return `${parti.join(", ")}. Quelli che qui non hanno il file si prendono dal NAS toccando «Apri».`;
}
