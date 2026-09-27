import { apriZip } from "./zipAFette.js";

// L'ARCHIVIO A PEZZI.
//
// L'archivio era UNO zip costruito in memoria nel browser: bene finche' la
// biblioteca erano ePub da tre megabyte, ma un fumetto pesa 50-300 MB e
// venti manga fanno tre gigabyte — un solo zip cosi' fa chiudere la scheda
// sul tablet, cioe' l'unica rete che fumetti e melodie hanno si strappa
// proprio quando serve. Qui si decide COME spartire, e basta: niente
// IndexedDB, niente browser, cosi' un test lo prova con dei numeri.
//
// Due regole. (1) I file piccoli si mettono in zip che non superano un
// tetto: cosi' in memoria ce n'e' uno alla volta. (2) Da una certa misura in
// su il file NON si zippa: esce com'e', col nome che dice di quale
// archivio e' — un Blob di IndexedDB si scarica senza mai passare dalla
// memoria della pagina, e un CBZ e' gia' uno zip. (3) Il primo pezzo e'
// SEMPRE uno zip, anche se ha dentro solo l'indice: ogni zip porta l'indice
// intero, e senza un indice i file grezzi non saprebbero di chi sono.

// Uno zip non supera questo. Misurato su Chromium da scrivania, non sul
// tablet: JSZip tiene l'uscita in memoria mentre la costruisce, e sotto i
// 128 MB il picco resta sotto il mezzo giga anche con la copia del Blob.
export const TETTO_PEZZO = 128 * 1024 * 1024;
// Da qui in su un file esce grezzo. E' anche il tetto per oggetto del
// piano gratuito del cloud: quel che non sale lassu' e' proprio quel che
// qui deve uscire senza passare dalla memoria.
export const GREZZO_DA = 50 * 1024 * 1024;
export const PREFISSO = "book-companion-backup";

// `voci`: [{ specie: "libro"|"copertina"|"melodia", id, byte, nome, ext,
// percorso }] nell'ordine della biblioteca — la copertina subito dopo il
// suo libro, cosi' di norma finiscono nello stesso zip. Torna i pezzi numerati: prima gli zip, poi i grezzi,
// cosi' «i pezzi 1-3 sono zip, dal 4 in poi i fumetti» si dice in una riga.
export function pianoPezzi(voci, { tetto = TETTO_PEZZO, grezzoDa = GREZZO_DA } = {}) {
  const zips = [{ tipo: "zip", voci: [], byte: 0 }];
  const grezzi = [];
  for (const v of voci) {
    if (!v || !v.id) continue;
    const byte = Number(v.byte) || 0;
    if (byte >= grezzoDa) {
      grezzi.push({ tipo: "grezzo", voci: [v], byte });
      continue;
    }
    // primo che ci sta, nell'ordine: un pezzo a meta' non si riapre per
    // infilarci un file piu' avanti, o l'ordine della biblioteca si perde
    const ultimo = zips[zips.length - 1];
    if (ultimo.voci.length && ultimo.byte + byte > tetto) zips.push({ tipo: "zip", voci: [v], byte });
    else {
      ultimo.voci.push(v);
      ultimo.byte += byte;
    }
  }
  const pezzi = [...zips, ...grezzi].map((p, i) => ({ ...p, n: i + 1 }));
  const di = pezzi.length;
  return {
    di,
    totale: pezzi.reduce((s, p) => s + p.byte, 0),
    pezzi: pezzi.map((p) => ({ ...p, di })),
  };
}

const sicuro = (s) =>
  (s || "senza-titolo").replace(/[^\p{L}\p{N} _-]/gu, "").trim().slice(0, 60) || "senza-titolo";

// Il nome dice tutto quel che serve a ritrovarsi: la data (che fa da serie),
// «n di N», e per un grezzo anche chi e' — titolo piu' i primi otto
// caratteri dell'id, che sono quel che basta a riconoscerlo senza indice.
// Un archivio da un pezzo solo tiene il nome di sempre, senza «1di1».
export function nomePezzo({ data, n, di, tipo, voce }) {
  const testa = di === 1 ? `${PREFISSO}-${data}` : `${PREFISSO}-${data}-${n}di${di}`;
  if (tipo !== "grezzo") return `${testa}.zip`;
  return `${testa}-${sicuro(voce.nome)}-${String(voce.id).slice(0, 8)}.${voce.ext || "bin"}`;
}

// Android rinomina i doppioni «nome (1).zip»: si accetta, o un pezzo
// scaricato due volte non si riconoscerebbe piu'.
const NOME = /^book-companion-backup-(\d{4}-\d{2}-\d{2})(?:-(\d+)di(\d+))?(?:-(.+)-([0-9a-f]{8}))?(?: \(\d+\))?\.([A-Za-z0-9]+)$/;

export function leggiNomePezzo(nome) {
  const m = NOME.exec(String(nome || "").trim());
  if (!m) return null;
  const [, data, n, di, titolo, id8, ext] = m;
  const grezzo = ext.toLowerCase() !== "zip";
  // un grezzo senza id non e' un grezzo nostro: era un file chiamato a mano
  if (grezzo && !id8) return null;
  return {
    data,
    n: n ? Number(n) : 1,
    di: di ? Number(di) : 1,
    grezzo,
    titolo: grezzo ? titolo : null,
    id8: grezzo ? id8 : null,
    ext: ext.toLowerCase(),
  };
}

// L'INDICE DI UN PEZZO. L'indice e' lo stesso in ogni zip — chi apre un
// pezzo solo sa di tutti gli altri — e cambia solo `pezzo`, che dice quale
// e' questo. Per ogni pezzo si scrive cosa porta: i libri il cui FILE sta
// li' dentro (le copertine non contano: sono un di piu', non il libro) e
// le melodie. Un grezzo porta anche il suo nome e la sua misura, che sono
// il modo di riconoscerlo quando torna.
export function mappaPezzi(piano, data) {
  return piano.pezzi.map((p) => ({
    n: p.n,
    tipo: p.tipo,
    libri: p.voci.filter((v) => v.specie === "libro").map((v) => v.id),
    melodie: p.voci.filter((v) => v.specie === "melodia").map((v) => v.id),
    ...(p.tipo === "grezzo"
      ? { nome: nomePezzo({ data, n: p.n, di: p.di, tipo: "grezzo", voce: p.voci[0] }), byte: p.byte }
      : {}),
  }));
}

// Uno zip del piano, costruito quando lo si chiede e non prima: in memoria
// c'e' un pezzo alla volta. L'indice entra per PRIMO e memorizzato, come
// tutto il resto — ePub, CBZ e JPEG sono gia' compressi, e comprimerli di
// nuovo costerebbe tempo al tablet senza togliere un megabyte.
export async function costruisciPezzo({ pezzo, indice, leggi, JSZip }) {
  const zip = new JSZip();
  zip.file("biblioteca.json", JSON.stringify({ ...indice, pezzo: { n: pezzo.n, di: pezzo.di } }, null, 2));
  for (const v of pezzo.voci) {
    const blob = await leggi(v);
    // un file sparito fra il piano e il pezzo (cancellato nel frattempo)
    // non si porta via il pezzo: nell'indice resta, e al ritorno manca
    if (!blob) continue;
    zip.file(v.percorso, await blob.arrayBuffer());
  }
  const tipo = JSZip.support?.blob ? "blob" : "uint8array";
  const out = await zip.generateAsync({ type: tipo });
  return tipo === "blob" ? out : new Blob([out], { type: "application/zip" });
}

const decodifica = new TextDecoder("utf-8");

// Il documento di un archivio, letto dal solo indice. `null` se lo zip non
// e' nostro: un file qualunque scelto insieme ai pezzi non e' un errore
// dell'archivio, e' un file in piu'.
export async function indiceDi(zip) {
  if (!zip.nomi.includes("biblioteca.json")) return null;
  let data;
  try {
    data = JSON.parse(decodifica.decode(await zip.leggi("biblioteca.json")));
  } catch {
    throw new Error("L'indice dell'archivio è illeggibile");
  }
  if (data?.app !== "book-companion" || !Array.isArray(data.books)) return null;
  return data;
}

// Cosa c'e' in UN file scelto. Uno zip si riconosce dal contenuto e non dal
// nome — Android li rinomina, e un vecchio archivio ha il nome di sempre —
// mentre un grezzo si riconosce SOLO dal nome, perche' dentro e' un ePub o
// un CBZ come tanti: e' il nome che dice di quale archivio fa parte.
export async function sbirciaFile(file, { apri = apriZip } = {}) {
  if (file && !(file instanceof Blob)) file = new Blob([file]);
  let zip = null;
  try {
    zip = await apri(file);
  } catch {
    zip = null;
  }
  if (zip) {
    let data = null;
    try {
      data = await indiceDi(zip);
    } catch (e) {
      return { file, errore: e.message };
    }
    // un CBZ sciolto e' uno zip anche lui, ma senza il nostro indice: se il
    // nome dice che e' un nostro grezzo, lo e'
    if (data) {
      const pezzo = data.pezzo || { n: 1, di: 1 };
      return { file, tipo: "zip", zip, data, n: pezzo.n, di: pezzo.di, serie: data.exportedAt || null };
    }
  }
  const nome = leggiNomePezzo(file?.name);
  const byte = Number(file?.size) || 0;
  if (nome?.grezzo) return { file, tipo: "grezzo", id8: nome.id8, ext: nome.ext, byte };
  // un nome che non e' il nostro puo' essere un grezzo rinominato a mano:
  // si tiene come candidato, e lo decide la misura quando c'e' l'indice
  const ext = /\.([A-Za-z0-9]+)$/.exec(file?.name || "")?.[1]?.toLowerCase() || null;
  return { file, tipo: "grezzo", id8: null, ext, byte, ignoto: true };
}

// Un grezzo tornato si mette al suo posto: prima per nome (i primi otto
// caratteri dell'id e l'estensione, che Android non tocca rinominando un
// doppione), poi — se il nome l'ha cambiato qualcuno — per misura esatta,
// ma solo se quella misura non e' di due pezzi insieme.
function posto(grezzo, attesi, presi) {
  const liberi = attesi.filter((p) => p.tipo === "grezzo" && !presi.has(p.n));
  if (grezzo.id8) {
    const perNome = liberi.find((p) => leggiNomePezzo(p.nome)?.id8 === grezzo.id8 && leggiNomePezzo(p.nome)?.ext === grezzo.ext);
    if (perNome) return perNome.n;
  }
  const perMisura = liberi.filter(
    (p) => p.byte === grezzo.byte && (!grezzo.ext || leggiNomePezzo(p.nome)?.ext === grezzo.ext)
  );
  return perMisura.length === 1 ? perMisura[0].n : null;
}

// Unisce quel che si e' sbirciato in piu' file scelti insieme. Ogni zip
// porta l'indice intero, quindi basta UNO zip per sapere di tutti gli
// altri: chi c'e', chi manca, e quanti tomi stanno nel pezzo che manca.
export function unisciSbirciate(sbirciate) {
  const buone = sbirciate.filter((s) => s && !s.errore);
  const zips = buone.filter((s) => s.tipo === "zip").sort((a, b) => a.n - b.n);
  const estranei = sbirciate.length - buone.length;
  if (!zips.length) {
    return {
      senzaIndice: true,
      // i soli file coi nomi nostri: un file qualunque non dice che manca
      // uno zip, dice che non e' un archivio
      grezzi: buone.filter((s) => s.tipo === "grezzo" && !s.ignoto).length,
      estranei,
      presenti: [],
      mancanti: [],
    };
  }
  const base = zips[0];
  const data = base.data;
  const attesi = Array.isArray(data.pezzi) && data.pezzi.length ? data.pezzi : [{ n: 1, tipo: "zip", libri: [], melodie: [] }];
  // due archivi diversi scelti insieme: vale quello del primo pezzo, e
  // gli altri si dicono estranei invece di mescolarli
  const zipSuoi = zips.filter((z) => z.serie === base.serie && z.di === base.di);
  const perN = new Map();
  for (const z of zipSuoi) if (!perN.has(z.n)) perN.set(z.n, z);
  const presi = new Set(perN.keys());
  const grezzi = new Map();
  let fuori = zips.length - zipSuoi.length;
  for (const g of buone.filter((s) => s.tipo === "grezzo")) {
    const n = posto(g, attesi, presi);
    if (n == null) fuori++;
    else {
      presi.add(n);
      grezzi.set(n, g.file);
    }
  }
  const presenti = attesi.map((p) => p.n).filter((n) => presi.has(n));
  const mancanti = attesi
    .filter((p) => !presi.has(p.n))
    .map((p) => ({ n: p.n, tipo: p.tipo, libri: (p.libri || []).length, melodie: (p.melodie || []).length }));
  return {
    senzaIndice: false,
    data,
    serie: base.serie,
    di: attesi.length,
    presenti,
    mancanti,
    tomiMancanti: mancanti.reduce((s, p) => s + p.libri, 0),
    melodieMancanti: mancanti.reduce((s, p) => s + p.melodie, 0),
    zips: [...perN.values()].map((z) => z.zip),
    grezzi,
    estranei: estranei + fuori,
  };
}

// Il modo di ritrovare i byte di un libro, di una copertina o di una
// melodia in un insieme di pezzi. Un percorso si cerca in TUTTI gli zip:
// l'indice dice in quale pezzo sta, ma i nomi dentro gli zip sono unici e
// cercarli dappertutto regge anche un archivio di prima dei pezzi.
export function sorgente(insieme) {
  const dove = new Map();
  for (const z of insieme.zips || []) for (const n of z.nomi) if (!dove.has(n)) dove.set(n, z);
  const nomi = [...dove.keys()];
  return {
    nomi,
    zip: (percorso) => (percorso && dove.has(percorso) ? dove.get(percorso).blob(percorso) : Promise.resolve(null)),
    grezzo: (n) => insieme.grezzi?.get(n) || null,
  };
}

// «Pezzi 1, 2 e 4 di 5 · manca il 3 (12 tomi)»: la riga del pannello.
export function frasePezzi(insieme) {
  if (!insieme || insieme.senzaIndice) return null;
  if (insieme.di <= 1 && !insieme.mancanti.length) return null;
  const elenco = (ns) => (ns.length <= 1 ? ns.join("") : `${ns.slice(0, -1).join(", ")} e ${ns[ns.length - 1]}`);
  const testa = `${insieme.presenti.length === 1 ? "Pezzo" : "Pezzi"} ${elenco(insieme.presenti)} di ${insieme.di}`;
  if (!insieme.mancanti.length) return testa;
  const cosa = [
    insieme.tomiMancanti ? `${insieme.tomiMancanti} ${insieme.tomiMancanti === 1 ? "tomo" : "tomi"}` : null,
    insieme.melodieMancanti ? `${insieme.melodieMancanti} ${insieme.melodieMancanti === 1 ? "melodia" : "melodie"}` : null,
  ].filter(Boolean);
  const quali = insieme.mancanti.map((p) => p.n);
  return `${testa} · ${quali.length === 1 ? "manca il" : "mancano i"} ${elenco(quali)}${cosa.length ? ` (${cosa.join(" e ")})` : ""}`;
}
