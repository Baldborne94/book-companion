// SPOSTARE SULL'HDD (vedi `daSpostareSuHdd`): il file di ogni volume scende
// da Drive DRITTO sul disco del lettore, a flusso, senza mai stare tutto in
// memoria (un fumetto pesa un giga). Solo quando sul disco c'e' il file con
// il peso che Drive dice, la scheda resta senza file (`segna`) e il file di
// Drive va nel cestino (`cestina`), in quest'ordine: un intoppo a meta'
// lascia il file in due posti, mai in nessuno.
//
// Il disco si sceglie con `showDirectoryPicker`, che c'e' in Chrome ed Edge
// sul computer: Firefox non ce l'ha.

import { fmtGoogle } from "./bytes.js";

export const hddPossibile = (w = globalThis) => typeof w?.showDirectoryPicker === "function";

// sul computer senza la cartella da scegliere (Firefox) si dice perche';
// sul tablet no: li' il disco esterno non si sceglie in nessun browser, e
// la frase sarebbe in ogni raccolta per niente
export function percheNoHdd(w = globalThis) {
  if (hddPossibile(w)) return null;
  const n = w?.navigator || {};
  const ua = n.userAgent || "";
  if (/Android|iPhone|iPad/i.test(ua) || (/Macintosh/.test(ua) && n.maxTouchPoints > 1)) return null;
  return "Per spostare questi volumi su un disco serve Chrome o Edge sul computer: questo browser non sa scrivere in una cartella.";
}

// i nomi che Windows rifiuta: un file di Drive puo' chiamarsi «Batman: Year One»
export function nomeSicuro(n) {
  const s = String(n ?? "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/[. ]+$/, "")
    .trim();
  return s || "_";
}

export async function cartellaDentro(radice, segmenti) {
  let c = radice;
  for (const s of segmenti || []) c = await c.getDirectoryHandle(nomeSicuro(s), { create: true });
  return c;
}

const altroNome = (nome, n) => {
  const i = nome.lastIndexOf(".");
  return i > 0 ? `${nome.slice(0, i)} (${n})${nome.slice(i)}` : `${nome} (${n})`;
};

// Dove va il file: un file con lo stesso nome e lo STESSO peso e' gia'
// arrivato (un giro fermato a meta' riparte da li'); con un altro peso e'
// un altro file, e non si copre — si prova «nome (2)». La scrittura di
// Chrome finisce nel file solo a `close`: un file a meta' sul disco non c'e'.
async function posto(dir, nome, byte) {
  for (let n = 1; n < 100; n++) {
    const prova = n === 1 ? nome : altroNome(nome, n);
    const fh = await dir.getFileHandle(prova).catch(() => null);
    if (!fh) return { fh: await dir.getFileHandle(prova, { create: true }), nome: prova, gia: false };
    const ha = (await fh.getFile()).size;
    // vuoto e' il posto lasciato da una discesa andata storta
    if (ha === 0 || ha === byte) return { fh, nome: prova, gia: ha === byte };
  }
  throw new Error("troppi file con lo stesso nome");
}

const MB = 1024 * 1024;

export async function spostaSuHdd(voci, { radice, apri, segna, cestina, ferma = () => false, vivo = () => true, onProgress } = {}) {
  const esito = { fatti: 0, byte: 0, mancati: [], restati: [], fermato: false, scollegato: null };
  for (let i = 0; i < (voci || []).length; i++) {
    if (!vivo()) {
      esito.fermato = true;
      break;
    }
    const v = voci[i];
    onProgress?.({ i, totale: voci.length, nome: v.nome, presi: 0, byte: v.byte });
    try {
      const dir = await cartellaDentro(radice, v.cartelle);
      const p = await posto(dir, nomeSicuro(v.nome), v.byte);
      if (!p.gia) {
        const r = await apri(v.fileId);
        let scesi = 0;
        const conta = new TransformStream({
          transform(pezzo, ctl) {
            if (!vivo()) return ctl.error(new Error("fermato"));
            const prima = scesi;
            scesi += pezzo.byteLength;
            if (Math.floor(prima / MB) !== Math.floor(scesi / MB)) onProgress?.({ i, totale: voci.length, nome: v.nome, presi: scesi, byte: v.byte });
            ctl.enqueue(pezzo);
          },
        });
        await r.body.pipeThrough(conta).pipeTo(await p.fh.createWritable());
      }
      if ((await p.fh.getFile()).size !== v.byte) {
        esito.mancati.push(v);
        continue;
      }
      await segna(v);
      esito.fatti += 1;
      try {
        await cestina(v);
        esito.byte += v.byte;
      } catch (e) {
        if (ferma(e)) throw e;
        esito.restati.push(v);
      }
    } catch (e) {
      if (!vivo()) {
        esito.fermato = true;
        break;
      }
      if (ferma(e)) {
        esito.scollegato = e;
        break;
      }
      esito.mancati.push(v);
    }
  }
  return esito;
}

const quanti = (n, uno, molti) => (n === 1 ? uno : `${n} ${molti}`);

export function fraseHdd(e) {
  const parti = [];
  if (e.fatti) parti.push(`📦 ${quanti(e.fatti, "Un volume", "volumi")} sull'HDD${e.byte ? ` · ${fmtGoogle(e.byte)} liberati su Google Drive (nel cestino per 30 giorni)` : ""}`);
  if (e.restati.length) parti.push(`${quanti(e.restati.length, "uno è sull'HDD ma è rimasto", "sono sull'HDD ma sono rimasti")} anche su Drive`);
  if (e.mancati.length) parti.push(`${quanti(e.mancati.length, "uno non è arrivato", "non sono arrivati")} intero sul disco: resta su Drive`);
  if (e.fermato) parti.push("fermato: il resto è ancora su Drive");
  return parti.join(" · ") || (e.scollegato ? "" : "Niente da spostare: i volumi di questa raccolta non sono su Google Drive");
}
