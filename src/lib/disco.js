// IL DISCO DEI LIBRI, CONTROLLATO E RIORDINATO (chiesto dal lettore: «ora su
// E:\book-companion abbiamo tutti i volumi? mi hai sistemato anche dentro le
// cartelle i file nel modo giusto per saga?»). No, e per due ragioni: un
// volume spostato sull'HDD e' sceso nella cartella della saga che la scheda
// aveva QUEL giorno (e le saghe sistemate dopo non lo spostano), e i file
// senza scheda sono scesi con le cartelle di Drive. Qui si guarda il disco
// com'e', lo si confronta con la biblioteca, e si dice: quali volumi ci sono,
// quali sono nella cartella sbagliata, quali mancano e dove stanno, quali
// file nessuna scheda riconosce. Riordinare sposta solo dentro il disco, e
// non copre mai un file.

import { nomeNudo, casaDelVolume } from "./driveCore.js";
import { nomeSicuro, cartellaDentro } from "./hdd.js";

const EST_DISCO = /\.(epub|pdf|cbz|cbr)$/i;
const chiave = (s) => String(s || "").trim().toLowerCase();

// la casa di `casaDelVolume`, coi nomi buoni per Windows: e' com'e' scritta
// sul disco, e si confronta con quella
export const casaDi = (b, tipo) => casaDelVolume(b, tipo).map(nomeSicuro);

// tutti i file di libri sotto `dir`, col percorso dalla casa
export async function elencaDisco(dir, via = []) {
  const out = [];
  for await (const [nome, h] of dir.entries()) {
    if (h.kind === "directory") out.push(...(await elencaDisco(h, [...via, nome])));
    else if (EST_DISCO.test(nome)) out.push({ cartelle: via, nome, byte: (await h.getFile()).size, handle: h, dir });
  }
  return out;
}

// QUALE FILE E' DI QUALE SCHEDA. Il file sul disco porta il nome che aveva su
// Drive, e la scheda il titolo che aveva all'ingresso: di solito lo stesso
// nome. Prima lo stesso nome, poi il titolo DENTRO il nome del file (un
// titolo ripulito: «Alpha & Omega» in «Locke & Key v06 - Alpha & Omega»),
// solo se il candidato e' uno e di una scheda sola — nel dubbio il file resta
// senza scheda, che si dice, e non si sposta.
function abbinaDisco(libri, file) {
  const perNome = new Map();
  for (const f of file) {
    const k = nomeNudo(f.nome);
    if (!perNome.has(k)) perNome.set(k, []);
    perNome.get(k).push(f);
  }
  const di = new Map();
  const presi = new Set();
  for (const b of libri) {
    const fs = perNome.get(nomeNudo(b.title));
    if (fs?.length) {
      di.set(b, fs);
      for (const f of fs) presi.add(f);
    }
  }
  const liberi = file.filter((f) => !presi.has(f));
  const candidati = new Map();
  for (const b of libri) {
    if (di.has(b)) continue;
    const t = nomeNudo(b.title);
    if (t.length < 4) continue;
    const c = liberi.filter((f) => ` ${nomeNudo(f.nome)} `.includes(` ${t} `));
    if (c.length === 1) candidati.set(b, c[0]);
  }
  const quanti = new Map();
  for (const f of candidati.values()) quanti.set(f, (quanti.get(f) || 0) + 1);
  for (const [b, f] of candidati) if (quanti.get(f) === 1) di.set(b, [f]);
  return di;
}

// Il rapporto. `tipoDi` dice la sezione di una scheda; `suDrive` e `qui` dove
// sta il file di un volume che sul disco non c'e'. Due schede dello stesso
// volume (doppioni) puntano allo stesso file: si sposta una volta, e solo se
// le due schede dicono la stessa casa. Due file per la stessa scheda: uno
// solo e' il volume, gli altri sono doppioni sul disco, e si dicono.
export function controllaDisco(libri, file, { tipoDi = () => "libri", suDrive = () => false, qui = () => false } = {}) {
  const vivi = (libri || []).filter((b) => b?.id);
  const di = abbinaDisco(vivi, file || []);
  const esito = { aPosto: [], daSpostare: [], doppioni: [], mancano: { drive: [], qui: [], altrove: [], nessuno: [] }, senzaScheda: [], byte: 0 };
  const case_ = new Map();
  const usati = new Set();
  for (const b of vivi) {
    const fs = di.get(b);
    if (!fs) {
      if (suDrive(b.id)) esito.mancano.drive.push(b);
      else if (qui(b.id)) esito.mancano.qui.push(b);
      else if (!b.fileTolto) esito.mancano.altrove.push(b);
      else esito.mancano.nessuno.push(b);
      continue;
    }
    const casa = casaDi(b, tipoDi(b));
    for (const f of fs) {
      if (!case_.has(f)) case_.set(f, { libri: [], case: new Set() });
      case_.get(f).libri.push(b);
      case_.get(f).case.add(casa.map(chiave).join("/"));
    }
    usati.add(fs);
  }
  // UNA COPIA IN PIU' HA LO STESSO PESO (segnalato dal lettore con lo
  // screenshot: dieci Blame! «0.cbz», «0 (2).cbz»… chiamati copie, ed erano
  // dieci volumi diversi che su Drive si chiamavano tutti «0»). Fra i file
  // con lo stesso nome, uno per peso e' un volume; uno con un peso gia' visto
  // e' una copia. Si tiene, per ogni peso, quello gia' nella sua casa.
  const aCasa = (f) => case_.get(f).case.has(f.cartelle.map(chiave).join("/"));
  for (const fs of usati) {
    const perPeso = new Map();
    for (const f of fs) {
      const g = perPeso.get(f.byte);
      if (!g || (!aCasa(g) && aCasa(f))) perPeso.set(f.byte, f);
    }
    const volumi = new Set(perPeso.values());
    for (const f of fs) if (!volumi.has(f)) esito.doppioni.push(f);
    for (const f of volumi) {
      esito.byte += f.byte;
      const c = case_.get(f);
      if (aCasa(f)) esito.aPosto.push({ libro: c.libri[0], file: f });
      else if (c.case.size === 1) {
        const b = c.libri[0];
        esito.daSpostare.push({ libro: b, file: f, a: casaDi(b, tipoDi(b)) });
      }
    }
  }
  const visti = new Set([...case_.keys()]);
  esito.senzaScheda = (file || []).filter((f) => !visti.has(f));
  return esito;
}

const altroNome = (nome, n) => {
  const i = nome.lastIndexOf(".");
  return i > 0 ? `${nome.slice(0, i)} (${n})${nome.slice(i)}` : `${nome} (${n})`;
};

// RIORDINARE: ogni file nella casa della sua scheda, dentro lo stesso disco.
// Un file con lo stesso nome e lo stesso peso gia' la' e' lo stesso volume:
// non si tocca niente e si dice (doppione). Con un altro peso e' un altro
// file: «nome (2)». Si sposta con `move` (Chrome lo fa nel posto); dove non
// c'e' o non riesce, si copia, si guarda il peso, e solo allora si toglie
// l'originale. Un intoppo e' di quel file.
export async function riordinaDisco(voci, { radice, vivo = () => true, onProgress } = {}) {
  const esito = { spostati: 0, doppioni: [], mancati: [], fermato: false };
  for (let i = 0; i < (voci || []).length; i++) {
    if (!vivo()) {
      esito.fermato = true;
      break;
    }
    const v = voci[i];
    onProgress?.({ i, totale: voci.length, nome: v.file.nome, presi: 0, byte: 0 });
    try {
      const dir = await cartellaDentro(radice, v.a);
      let nome = v.file.nome;
      let doppione = false;
      for (let n = 2; ; n++) {
        const gia = await dir.getFileHandle(nome).catch(() => null);
        if (!gia) break;
        if ((await gia.getFile()).size === v.file.byte) {
          doppione = true;
          break;
        }
        if (n > 99) throw new Error("troppi file con lo stesso nome");
        nome = altroNome(v.file.nome, n);
      }
      if (doppione) {
        esito.doppioni.push(v);
        continue;
      }
      let mosso = false;
      if (typeof v.file.handle.move === "function") {
        mosso = await v.file.handle.move(dir, nome).then(
          () => true,
          () => false
        );
      }
      if (!mosso) {
        const nuovo = await dir.getFileHandle(nome, { create: true });
        await (await v.file.handle.getFile()).stream().pipeTo(await nuovo.createWritable());
        if ((await nuovo.getFile()).size !== v.file.byte) {
          await dir.removeEntry(nome).catch(() => {});
          esito.mancati.push(v);
          continue;
        }
        await v.file.dir.removeEntry(v.file.nome);
      }
      esito.spostati += 1;
    } catch {
      esito.mancati.push(v);
    }
  }
  return esito;
}

const quanti = (n, uno, molti) => (n === 1 ? uno : `${n} ${molti}`);
export function fraseRiordino(e) {
  const parti = [];
  if (e.spostati) parti.push(`🗂 ${quanti(e.spostati, "Un volume", "volumi")} nella cartella della sua saga`);
  if (e.doppioni.length) parti.push(`${quanti(e.doppioni.length, "uno era già là", "erano già là")} con lo stesso peso: ${e.doppioni.length === 1 ? "è rimasto" : "sono rimasti"} anche dov'${e.doppioni.length === 1 ? "era" : "erano"}`);
  if (e.mancati.length) parti.push(`${quanti(e.mancati.length, "uno non si è spostato", "non si sono spostati")}`);
  if (e.fermato) parti.push("fermato: il resto è dov'era");
  return parti.join(" · ") || "Niente da riordinare";
}

// IL RAPPORTO INTERO, da copiare (il pannello taglia le liste lunghe: «e altri
// 140»). Titoli e percorsi: e' il lettore che lo legge, o lo manda a chi lo
// aiuta; non parte da solo verso nessuno.
export function rapportoDisco(r) {
  const righe = [];
  const titoli = (bs) => bs.map((b) => `  - ${b.title}${b.saga ? ` [${b.saga}]` : ""}`);
  const file = (fs) => fs.map((f) => `  - ${[...f.cartelle, f.nome].join(" / ")} (${f.byte} byte)`);
  righe.push(`Volumi sul disco: ${r.aPosto.length + r.daSpostare.length}, byte ${r.byte}`);
  if (r.daSpostare.length) righe.push(`Da riordinare (${r.daSpostare.length}):`, ...r.daSpostare.map((v) => `  - ${v.libro.title}: ${v.file.cartelle.join(" / ") || "book-companion"} -> ${v.a.join(" / ")}`));
  const m = r.mancano;
  for (const [bs, dove] of [[m.drive, "ancora su Google Drive"], [m.qui, "solo su questo dispositivo"], [m.altrove, "ne' qui ne' su Drive"], [m.nessuno, "senza file da nessuna parte"]])
    if (bs.length) righe.push(`Mancano dal disco, ${dove} (${bs.length}):`, ...titoli(bs));
  if (r.senzaScheda.length) righe.push(`File senza scheda (${r.senzaScheda.length}):`, ...file(r.senzaScheda));
  if (r.doppioni.length) righe.push(`Copie in piu', stesso nome e stesso peso (${r.doppioni.length}):`, ...file(r.doppioni));
  return righe.join("\n");
}
