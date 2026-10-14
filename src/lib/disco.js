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

// dove andavano per un giorno i CBR convertiti sul disco: non sono volumi
// della biblioteca, il controllo non li conta e la si svuota
// (`cbrNeiConvertiti`, `svuotaConvertiti`)
export const CBR_CONVERTITI = "CBR convertiti";

// tutti i file di libri sotto `dir`, col percorso dalla casa
export async function elencaDisco(dir, via = []) {
  const out = [];
  for await (const [nome, h] of dir.entries()) {
    if (h.kind === "directory" && !via.length && nome === CBR_CONVERTITI) continue;
    if (h.kind === "directory") out.push(...(await elencaDisco(h, [...via, nome])));
    else if (EST_DISCO.test(nome)) out.push({ cartelle: via, nome, byte: (await h.getFile()).size, handle: h, dir });
  }
  return out;
}

// QUALE FILE E' DI QUALE SCHEDA. Il file sul disco porta il nome che aveva su
// Drive, e la scheda il titolo che aveva all'ingresso. Prima lo stesso nome;
// poi le PAROLE (segnalato col primo rapporto del disco del lettore: 76 volumi
// «senza file da nessuna parte» e 152 file «senza scheda» erano in gran parte
// gli stessi, scritti in due modi): «Abercrombie, Joe - The Heroes» e «The
// Heroes (Joe Abercrombie) (z-library.sk…)», «Spawn Origins Collection Vol.
// 24» e «… v24 (2022)», «The Golem's Eye» e «The Golems Eye», «Belgariad 4 :
// Castle of Wizardry» e «Castle of Wizardry (David Eddings)». Un file e'
// candidato di una scheda se ne contiene TUTTE le parole del titolo, in
// qualunque ordine, o tutte quelle di un suo pezzo («Castle of Wizardry»,
// separato da «:», « - », parentesi; un pezzo di una parola sola vale solo
// se e' lunga). Fra i candidati vince chi ha piu' parole in comune col
// titolo INTERO, rispetto a tutte quelle dei due (le targhe — z-library,
// digital, l'anno — non contano): «The Law: A Dresden Files Novella» e' «The
// Law - Dresden Files 17.2», non «The First Law 01», che ha solo «the law»
// (preso al banco coi nomi veri del lettore). Si assegna dalla coppia
// migliore in giu': una scheda un file, un file una scheda; a pari merito
// vince il file gia' nella casa della scheda, e due file uguali (stesso peso)
// non sono un dubbio, sono un volume e la sua copia.
const RUMORE = new Set(["digital", "ebook", "epub", "by", "etc", "dcp", "empire", "hd", "f"]);
// le parole che non dicono QUALE libro: un pezzo fatto solo di queste
// («La saga» di «Kane. La saga») trovava ogni file con «la saga» nel nome, e
// rubava quello di Elric
const GENERICHE = new Set(
  "the a an of and in on to for with from la il lo le gli i un una uno di da del della dei degli delle e ed in con per su nel nella saga ciclo trilogia trilogy series serie book books libro volume collection edition edizione complete completa omnibus illustrated".split(" ")
);
const piena = (w) => !w.startsWith("#") && w.length >= 3 && !GENERICHE.has(w) && !RUMORE.has(w);
function parole(s) {
  return String(s || "")
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/\s*\(\d{1,2}\)\s*$/, "")
    // le targhe dei siti, prima di spezzare: «1lib.sk» diventerebbe un «1»
    .replace(/\b(?:z-?library|1lib|z-lib)(?:\.(?:sk|org))?\b/gi, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’‘`]/g, "")
    .replace(/(\p{L})(\d)/gu, "$1 $2")
    .replace(/(\d)(\p{L})/gu, "$1 $2")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    // «Vol. 24», «v24», «#24», «Book 24», «24»: lo stesso volume
    .reduce((out, w, i, tutte) => {
      if (/^(v|vol|volume|tomo|n|no)$/.test(w) && /^\d+$/.test(tutte[i + 1] || "")) return out;
      out.push(/^\d+$/.test(w) ? `#${Number(w)}` : w);
      return out;
    }, []);
}
// «The Children of Húrin with illustrations by Alan Lee»: l'illustratore e'
// un pezzo a se', come quel che sta dopo i due punti
const pezziDi = (titolo) => {
  const tutti = String(titolo || "")
    .split(/\s*[:()[\]]\s*|\s+-\s+|\.\s+|\s+(?:with\s+)?illustrat\w*\s+by\s+/i)
    .map(parole)
    .filter((p) => p.length);
  return tutti.filter((p) => p.length >= 2 || (p[0] || "").length >= 6);
};
// una parola lunga del titolo che il nome scrive con una lettera sbagliata
// («andoidi» per «androidi») o tronca («Educated Rod» per «Rodents»)
const unaLettera = (a, b) => {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  return a.slice(i + 1) === b.slice(i + 1) || a.slice(i + 1) === b.slice(i) || a.slice(i) === b.slice(i + 1);
};
const sfumata = (w, ws) => w.length >= 6 && !w.startsWith("#") && [...ws].some((x) => x.length >= 3 && ((x.length < w.length && w.startsWith(x)) || unaLettera(w, x)));
// IL FILE COPRE UN PEZZO DEL TITOLO: ogni parola nel nome o nella cartella
// della saga (la prima di «Libri», «Fumetti», «Manga» non dice niente), al
// piu' una sfumata, i numeri esatti nel nome, e almeno una parola piena
// scritta proprio nel nome: «La Saga di Elric Di Melniboné» e' «Elric. La
// saga (Michael Moorcock)» nella cartella «Elric Di Melniboné»
function copre(p, ws, wc) {
  let sfumate = 0;
  for (const w of p) {
    if (ws.has(w) || (!w.startsWith("#") && wc.has(w))) continue;
    if (sfumate || !sfumata(w, ws)) return false;
    sfumate += 1;
  }
  return p.some((w) => piena(w) && ws.has(w));
}
// i numeri di un nome, senza gli anni
const numeri = (ws) => [...ws].filter((w) => w.startsWith("#") && !/^#(19|20)\d\d$/.test(w));
// UN ALTRO NUMERO E' UN ALTRO VOLUME (segnalato col terzo rapporto: «The
// Sandman - The Deluxe Edition Book 01» detto altra edizione del «Book 04»,
// perche' il pezzo «The Sandman» del titolo copre ogni file della saga). Se
// titolo e nome hanno numeri e nessuno in comune, il file non e' di quella
// scheda; un nome senza numeri («Castle of Wizardry») resta buono.
const altroNumero = (intero, ws) => {
  const nt = numeri(intero);
  const nf = numeri(ws);
  return nt.length > 0 && nf.length > 0 && !nt.some((n) => nf.includes(n));
};
// MA IL TITOLO VERO DEL VOLUME VALE PIU' DEL NUMERO (segnalato col quarto
// rapporto: «Dragonriders of Pern #03: Original 3 - The White Dragon» e il
// file «The White Dragon (Dragonriders of Pern Book 5)»: il numero della
// scheda e' l'ordine di lettura, quello del file l'ordine d'uscita). Il
// numero decide solo quando il file copre il titolo col nome della saga e
// basta: i pezzi che non sono la saga sono il titolo vero.
const pezziVeri = (titolo, saga) =>
  String(titolo || "")
    .split(/\s*:\s*|\s+-\s+|\.\s+|\s+(?:with\s+)?illustrat\w*\s+by\s+/i)
    .map(parole)
    .filter((p) => !p.every((w) => saga.has(w)));
const cartellaDi = (f) => new Set(f.cartelle.length >= 2 ? parole(f.cartelle.at(-1)) : []);
function abbinaDisco(libri, file, casaDi = () => null) {
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
  const insiemi = new Map(liberi.map((f) => [f, new Set(parole(f.nome))]));
  const cartelle = new Map(liberi.map((f) => [f, cartellaDi(f)]));
  // le coppie di tutte le schede: quelle gia' abbinate per nome servono a
  // riconoscere le loro altre edizioni
  const coppie = [];
  for (const b of libri) {
    const intero = parole(b.title);
    if (!intero.length || (intero.length === 1 && intero[0].length < 4)) continue;
    const pezzi = [intero, ...pezziDi(b.title)];
    const casa = casaDi(b);
    const suo = new Set(intero);
    const veri = pezziVeri(b.title, new Set(parole(b.saga)));
    for (const f of liberi) {
      const ws = insiemi.get(f);
      const wc = cartelle.get(f);
      if (!pezzi.some((p) => copre(p, ws, wc))) continue;
      if (altroNumero(intero, ws) && !veri.some((p) => copre(p, ws, wc))) continue;
      const contano = [...ws].filter((w) => !RUMORE.has(w) && !/^#(19|20)\d\d$/.test(w));
      const comuni = contano.filter((w) => suo.has(w)).length;
      const aCasa = casa && casa === f.cartelle.map((x) => x.toLowerCase()).join("/") ? 0.001 : 0;
      coppie.push({ b, f, punti: comuni / (suo.size + contano.length - comuni || 1) + aCasa });
    }
  }
  // a pari punti il file piu' grande per primo (vedi `stessoLibro`)
  coppie.sort((x, y) => y.punti - x.punti || y.f.byte - x.f.byte);
  const libro = new Set(di.keys());
  const preso = new Set();
  // nel dubbio niente: due file che coprono una scheda allo stesso modo (o due
  // schede lo stesso file) fermano tutt'e due, anche piu' in giu'
  const pari = (x, y) => Math.abs(x.punti - y.punti) < 1e-9;
  const uguali = (f, g) => f.byte === g.byte && estDi(f.nome) === estDi(g.nome);
  // MA DUE FILE CON LE STESSE PAROLE SONO LO STESSO LIBRO in due edizioni
  // («Neuromancer (William Gibson).epub» e «… (2).epub», «The Hobbit
  // (Tolkien, J R R)» e «The Hobbit (J. R. R. Tolkien)»): non un dubbio su
  // quale volume sia, e la scheda prende il piu' grande. «Spawn v24» e «v25»
  // hanno un numero diverso, e restano un dubbio.
  const firma = (f) => [...insiemi.get(f)].sort().join(" ");
  const stessoLibro = (f, g) => estDi(f.nome) === estDi(g.nome) && firma(f) === firma(g);
  for (const c of coppie) {
    if (libro.has(c.b) || preso.has(c.f)) continue;
    const rivale = coppie.find((d) => d !== c && pari(c, d) && ((d.b === c.b && !preso.has(d.f) && !uguali(d.f, c.f) && !stessoLibro(d.f, c.f)) || (d.f === c.f && !libro.has(d.b))));
    libro.add(c.b);
    preso.add(c.f);
    if (rivale) {
      libro.add(rivale.b);
      preso.add(rivale.f);
      continue;
    }
    di.set(c.b, [c.f]);
  }
  // le altre copie, stesso peso e stessa estensione di un file gia' preso:
  // vanno con lui (il rapporto le dice copie)
  const daPeso = new Map();
  for (const [b, fs] of di) for (const f of fs) daPeso.set(`${f.byte}|${estDi(f.nome)}`, b);
  const usato = (f) => [...di.values()].some((fs) => fs.includes(f));
  for (const f of liberi) {
    if (usato(f) || !(f.byte > 0)) continue;
    const b = daPeso.get(`${f.byte}|${estDi(f.nome)}`);
    if (b) di.set(b, [...di.get(b), f]);
  }
  // IL VOLUME CHE IL NOME NON DICE, MA LA SAGA E IL NUMERO SI': «Monsters Gonna
  // Monster», volume 10 di «I Hate Fairyland», e' «I Hate Fairyland v10 (2026)
  // (Collection)…». Solo un file con tutte le parole della saga (nel nome o
  // nella sua cartella) e il solo numero della scheda (gli anni non contano),
  // e solo se il file e' di quella scheda sola e la scheda ha quel file solo.
  const perSaga = [];
  for (const b of libri) {
    if (di.has(b) || !b.saga || !(Number(b.sagaOrder) > 0)) continue;
    const saga = parole(b.saga).filter((w) => !w.startsWith("#"));
    for (const f of liberi) {
      if (usato(f)) continue;
      const ws = insiemi.get(f);
      const n = numeri(ws);
      if (n.length === 1 && n[0] === `#${Number(b.sagaOrder)}` && saga.every((w) => ws.has(w) || cartelle.get(f).has(w))) perSaga.push({ b, f });
    }
  }
  for (const c of perSaga) if (perSaga.filter((d) => d.b === c.b || d.f === c.f).length === 1) di.set(c.b, [c.f]);
  // LE ALTRE EDIZIONI: un file rimasto che copre una scheda che il suo file ce
  // l'ha gia' non e' «senza scheda» (aggiungerlo farebbe un doppione): si
  // dice di chi e', se e' di una scheda sola
  const altre = new Map();
  for (const f of liberi) {
    if (usato(f)) continue;
    const suoi = coppie.filter((c) => c.f === f && di.has(c.b));
    if (!suoi.length) continue;
    const primo = suoi[0];
    if (suoi.some((c) => c.b !== primo.b && pari(c, primo))) continue;
    altre.set(f, primo.b);
  }
  return { di, altre };
}
const estDi = (n) => (/\.([a-z0-9]{2,5})$/i.exec(n || "")?.[1] || "").toLowerCase();

// Il rapporto. `tipoDi` dice la sezione di una scheda; `suDrive` e `qui` dove
// sta il file di un volume che sul disco non c'e'. Due schede dello stesso
// volume (doppioni) puntano allo stesso file: si sposta una volta, e solo se
// le due schede dicono la stessa casa. Due file per la stessa scheda: uno
// solo e' il volume, gli altri sono doppioni sul disco, e si dicono.
export function controllaDisco(libri, file, { tipoDi = () => "libri", suDrive = () => false, qui = () => false, leggendo = () => false } = {}) {
  const vivi = (libri || []).filter((b) => b?.id);
  // un file da 0 byte e' una copia rimasta a meta' (lo spostamento lo
  // riempie al giro dopo): non e' un volume, si dice a parte
  const pieni = (file || []).filter((f) => f.byte > 0);
  const { di, altre } = abbinaDisco(vivi, pieni, (b) => casaDi(b, tipoDi(b)).map(chiave).join("/"));
  const esito = { aPosto: [], daSpostare: [], doppioni: [], altreEdizioni: [], vuoti: (file || []).filter((f) => !(f.byte > 0)), mancano: { drive: [], qui: [], altrove: [], nessuno: [] }, senzaScheda: [], daSegnare: [], byte: 0 };
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
  // LA SCHEDA CHE CREDE PERSO UN VOLUME CHE E' SUL DISCO (segnalato dal
  // lettore: «A Time of Blood», «Morning Star» e altri 158 «ne' qui ne' nel
  // cloud», con 1665 volumi su 1673 sul disco). Scesi coi file che nessuna
  // scheda usava, o prima che il disco li sapesse riconoscere: la scheda non
  // era stata segnata, e restava senza file da nessuna parte. Si propongono
  // da segnare come quelle spostate sull'HDD (`fileTolto`) — solo chi non ha
  // il file qui ne' su Drive, e mai chi stai leggendo (resta su Drive).
  const segnati = new Set();
  for (const c of case_.values())
    for (const b of c.libri) if (!b.fileTolto && !suDrive(b.id) && !qui(b.id) && !leggendo(b.id) && !segnati.has(b)) segnati.add(b);
  esito.daSegnare = [...segnati];
  const visti = new Set([...case_.keys()]);
  for (const [f, b] of altre) if (!visti.has(f)) esito.altreEdizioni.push({ file: f, libro: b });
  const altreViste = new Set(esito.altreEdizioni.map((x) => x.file));
  esito.senzaScheda = pieni.filter((f) => !visti.has(f) && !altreViste.has(f));
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
  if (r.altreEdizioni?.length) righe.push(`Altre edizioni di volumi che hanno gia' il loro file (${r.altreEdizioni.length}):`, ...r.altreEdizioni.map((x) => `${file([x.file])[0]} -> ${x.libro.title}`));
  if (r.daSegnare?.length) righe.push(`Sul disco, ma la scheda li crede persi (${r.daSegnare.length}):`, ...titoli(r.daSegnare));
  if (r.vuoti?.length) righe.push(`File vuoti, copie rimaste a meta' (${r.vuoti.length}):`, ...file(r.vuoti));
  if (r.doppioni.length) righe.push(`Copie in piu', stesso nome e stesso peso (${r.doppioni.length}):`, ...file(r.doppioni));
  return righe.join("\n");
}

// IMPORTARE DAL DISCO, SENZA DRIVE (chiesto dal lettore: «preparami
// l'importazione solo dal disco senza drive»). I fumetti caricati a mano su
// Drive e mai entrati in biblioteca (Locke & Key, Head Lopper, Spawn…) sono
// scesi sul disco senza scheda; con «Aggiungi libri» i byte entrerebbero nel
// browser e il giro di Drive li ricaricherebbe lassu'. Qui entrano le sole
// schede: titolo, saga, copertina letti dal file del disco (la strada
// dell'import da Drive, `importaDaDrive`, con il file del disco al posto di
// quello lontano e nessun segno), ognuna gia' segnata come spostata
// sull'HDD (`fileTolto`): nessun byte nel browser, niente da caricare.
const SEZIONE = { manga: "manga", fumetti: "fumetti", libri: "libri" };
export function vociDalDisco(file) {
  return (file || []).map((f) => ({
    id: `disco:${[...f.cartelle, f.nome].join("/")}`,
    name: f.nome,
    size: f.byte,
    ...(SEZIONE[chiave(f.cartelle[0])] && SEZIONE[chiave(f.cartelle[0])] !== "libri" ? { tipo: SEZIONE[chiave(f.cartelle[0])] } : {}),
    handle: f.handle,
  }));
}
// le schede dopo l'import: le nuove e quelle a cui il file e' tornato sono
// tutte sul disco
export function schedeDalDisco(libri, esito) {
  const tornati = new Map((esito?.ritrovati || []).map((r) => [r.id, r]));
  const prima = (libri || []).map((b) => (tornati.has(b.id) ? { ...b, ...(tornati.get(b.id).impronta ? { impronta: tornati.get(b.id).impronta } : {}), fileTolto: true } : b));
  return [...prima, ...(esito?.added || []).map((b) => ({ ...b, fileTolto: true }))];
}

// QUEL CHE SI FA DAL DISCO, con i file del disco in mano (segnalato dal
// lettore: «vedo che mancano ancora copertine» e «ci sono file CBR che non
// mi fa mettere in CBZ»). Un volume spostato sull'HDD non e' ne' qui ne' su
// Drive: «Ritrova copertine» e «Converti in CBZ» non avevano niente da
// leggere, e dicevano «non sono su questo dispositivo». Con il disco
// controllato i file si hanno: le copertine che mancano si leggono da li', e
// i CBR delle schede che stanno solo sul disco si convertono li'.
export function lavoriDalDisco(r, { haCopertina = () => true } = {}) {
  const sul = [...(r?.aPosto || []), ...(r?.daSpostare || [])];
  return {
    copertine: sul.filter((v) => !haCopertina(v.libro.id)),
    cbr: sul.filter((v) => v.libro.fileTolto && /\.cbr$/i.test(v.file.nome)),
  };
}

// IL CBR DIVENTA CBZ NELLA CARTELLA DELLA SUA SAGA, e il CBR se ne va
// (segnalato dal lettore: «perche' vedo questa cartella in piu'? i CBR
// convertiti mettili nelle cartelle apposite, non crearne una a parte: ogni
// saga ha il suo posto dove stare»). Per un giorno il CBR finiva in
// «book-companion/CBR convertiti»; adesso il CBZ si scrive nella casa della
// scheda (`a`, se il volume era fuori posto) e il CBR si toglie **solo
// dopo** che il CBZ scritto ha il peso giusto e si apre (`apre`). Un CBZ con
// lo stesso nome e lo stesso peso c'e' gia' (una conversione a meta'), uno
// diverso non si copre («nome (2).cbz»). Un «.cbr» che dentro e' gia' uno
// ZIP non si converte: si copia col nome giusto.
export async function convertiSulDisco(voci, { radice, converti, eZip = async () => false, apre = async () => true, vivo = () => true, onProgress } = {}) {
  const esito = { convertiti: [], mancati: [], fermato: false };
  for (let i = 0; i < (voci || []).length; i++) {
    if (!vivo()) {
      esito.fermato = true;
      break;
    }
    const v = voci[i];
    onProgress?.({ i, totale: voci.length, titolo: v.libro.title, passo: null });
    try {
      const cbr = await v.file.handle.getFile();
      const cbz = (await eZip(cbr)) ? cbr : await converti(cbr, (p) => onProgress?.({ i, totale: voci.length, titolo: v.libro.title, passo: p }));
      if (!vivo()) {
        esito.fermato = true;
        break;
      }
      const dir = v.a ? await cartellaDentro(radice, v.a) : v.file.dir;
      const base = v.file.nome.replace(/\.cbr$/i, ".cbz");
      let nome = base;
      let gia = null;
      for (let n = 2; ; n++) {
        const c = await dir.getFileHandle(nome).catch(() => null);
        if (!c) break;
        if ((await c.getFile()).size === cbz.size) {
          gia = c;
          break;
        }
        if (n > 99) throw new Error("troppi file con lo stesso nome");
        nome = altroNome(base, n);
      }
      const h = gia || (await dir.getFileHandle(nome, { create: true }));
      if (!gia) {
        await cbz.stream().pipeTo(await h.createWritable());
        if ((await h.getFile()).size !== cbz.size) {
          await dir.removeEntry(nome).catch(() => {});
          throw new Error("il CBZ scritto sul disco non ha il peso giusto");
        }
      }
      if (!(await apre(await h.getFile()).catch(() => false))) {
        if (!gia) await dir.removeEntry(nome).catch(() => {});
        throw new Error("il CBZ scritto sul disco non si apre");
      }
      const cbrTenuto = await v.file.dir.removeEntry(v.file.nome).then(
        () => false,
        () => true
      );
      esito.convertiti.push({ libro: v.libro, cbz, nome, cbrTenuto });
    } catch (e) {
      esito.mancati.push({ libro: v.libro, perche: e?.message || String(e) });
    }
  }
  return esito;
}

// LA CARTELLA «CBR CONVERTITI» DI QUEL GIORNO SI SVUOTA DALL'APP: si tolgono
// i CBR il cui CBZ sta gia' sul disco (stesso nome, «.cbz», in qualunque
// cartella della biblioteca); quel che non ha il suo CBZ resta e si dice, e
// la cartella se ne va solo vuota.
export async function cbrNeiConvertiti(radice, file = []) {
  const cartella = await radice.getDirectoryHandle(CBR_CONVERTITI).catch(() => null);
  if (!cartella) return null;
  const cbz = new Set((file || []).filter((f) => /\.cbz$/i.test(f.nome)).map((f) => chiave(f.nome)));
  const dentro = await elencaDisco(cartella);
  const conCbz = dentro.filter((f) => cbz.has(chiave(f.nome.replace(/\.cbr$/i, ".cbz"))));
  return { conCbz, senza: dentro.filter((f) => !conCbz.includes(f)), byte: conCbz.reduce((n, f) => n + f.byte, 0) };
}
export async function svuotaConvertiti(r, radice) {
  let tolti = 0;
  for (const f of r?.conCbz || []) {
    if (await f.dir.removeEntry(f.nome).then(() => true, () => false)) tolti += 1;
  }
  const cartella = await radice.getDirectoryHandle(CBR_CONVERTITI).catch(() => null);
  const resta = cartella ? await elencaDisco(cartella) : [];
  if (cartella && !resta.length) await radice.removeEntry(CBR_CONVERTITI, { recursive: true }).catch(() => {});
  return { tolti, restano: resta.length };
}

export function fraseConvertitiDisco(e) {
  const parti = [];
  if (e.convertiti.length) parti.push(`🔁 ${quanti(e.convertiti.length, "Un CBR è diventato CBZ", "CBR sono diventati CBZ")} sul disco, nella cartella della sua saga`);
  const tenuti = e.convertiti.filter((c) => c.cbrTenuto).length;
  if (tenuti) parti.push(`${quanti(tenuti, "un CBR è rimasto", "CBR sono rimasti")} accanto al suo CBZ`);
  if (e.mancati.length) parti.push(`${quanti(e.mancati.length, "uno non si è convertito", "non si sono convertiti")}: ${e.mancati.slice(0, 3).map((m) => `«${m.libro.title}» (${m.perche})`).join(", ")}`);
  if (e.fermato) parti.push("fermato: il resto è com'era");
  return parti.join(" · ") || "Niente da convertire";
}
