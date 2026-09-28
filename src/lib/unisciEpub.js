// RICUCIRE UN LIBRO SPEZZATO.
//
// Certi ePub — Guards! Guards! fra tutti — hanno il romanzo tagliato in
// piu' documenti, per comodita' dell'editore e non del lettore: nessuno
// di quei tagli e' un capitolo, e nell'indice il libro resta UNA voce.
// Il testo pero' non puo' scavalcare due documenti: l'ultima facciata di
// ognuno si ferma dove finisce il file e quella accanto resta bianca, a
// meta' scena. Misurato: facciata destra vuota, sinistra scritta per un
// quarto.
//
// Qui i pezzi si ricuciono PRIMA che il libro entri in biblioteca: i
// documenti che nessuna voce d'indice apre tornano dentro quello che li
// precede, e da lì il testo scorre. Cosa NON si tocca: i file di
// contorno (frontespizio, dedica, colophon), che una voce ce l'hanno e
// una pagina propria la meritano.
//
// Il prezzo, dichiarato: cambia la struttura del libro, quindi i CFI —
// segnalibri, evidenziazioni e punto di lettura — di un libro gia' letto
// non si ritroverebbero. Per questo si ricuce solo all'ingresso.

import { apriZipInMemoria } from "./zipAFette.js";

const XHTML = "application/xhtml+xml";

// I QUATTRO CONTI SUI PERCORSI SI ESPORTANO PER ESSERE PROVATI, come
// `contentStyles` e `ritaglioAvanzo` altrove. Non sono contorno: la
// ricucitura sposta i documenti dentro altre cartelle, e se uno di questi
// sbaglia il libro entra in biblioteca con TUTTE le immagini rotte e tutti
// i rimandi che portano da nessuna parte — in silenzio, perche' nessuno
// controlla che un `src` punti a qualcosa.
export const dir = (p) => p.replace(/[^/]*$/, "");

// percorso di `rel` visto da `base` (una cartella), senza URL assoluti
export function risolvi(base, rel) {
  if (!rel || /^[a-z][a-z0-9+.-]*:/i.test(rel) || rel.startsWith("#")) return null;
  const parti = (base + rel.split("#")[0]).split("/");
  const fuori = [];
  for (const p of parti) {
    if (!p || p === ".") continue;
    if (p === "..") fuori.pop();
    else fuori.push(p);
  }
  return fuori.join("/");
}

// Il parser XML e' severo e parecchi ePub non sono ben formati: se
// protesta si rilegge il documento come HTML, che perdona tutto.
function leggi(testo, tipo = XHTML) {
  const doc = new DOMParser().parseFromString(testo, tipo);
  if (!doc.querySelector("parsererror")) return doc;
  if (tipo === "application/xml") return null;
  return new DOMParser().parseFromString(testo, "text/html");
}
// IL TESTO DI UN DOCUMENTO, SENZA COSTRUIRNE L'ALBERO. Per decidere se un
// libro e' spezzato servono l'inizio e la fine del testo di OGNI capitolo,
// e costruirli con DOMParser era il grosso dell'import: su un romanzo sano
// da settanta capitoli, 1,5 dei 2,1 secondi col processore di un tablet
// (segnalato: «quando importi i file dal tablet e' veramente lento»). Qui
// si toglie il markup a stringa, e deve dire quello che direbbe
// `body.textContent`: i commenti e i marcatori CDATA non sono testo, un
// `>` dentro un attributo non chiude il tag, e le entita' si sciolgono —
// «&rdquo;» in fondo a un capitolo e' una virgoletta chiusa, e letta come
// «;» il capitolo sembrerebbe finire a meta' frase.
const ENTITA = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00a0",
  ldquo: "\u201c", rdquo: "\u201d", lsquo: "\u2018", rsquo: "\u2019",
  laquo: "\u00ab", raquo: "\u00bb", hellip: "\u2026", mdash: "\u2014", ndash: "\u2013",
};
const sciogli = (s) =>
  s.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (tutto, e) => {
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
const APRE_CORPO = /<body\b(?:"[^"]*"|'[^']*'|[^'">])*>/i;
const testoDi = (markup) =>
  sciogli(
    markup
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/<(?:"[^"]*"|'[^']*'|[^'">])*>/g, "")
  )
    .replace(/\s+/g, " ")
    .trim();
function corpoDi(xml) {
  const s = String(xml || "");
  const apre = APRE_CORPO.exec(s.replace(/<!--[\s\S]*?-->/g, (c) => " ".repeat(c.length)));
  if (!apre) return null;
  const da = apre.index + apre[0].length;
  const chiude = /<\/body\s*>/i.exec(s.slice(da));
  return s.slice(da, chiude ? da + chiude.index : s.length);
}
export function testoDelCorpo(xml) {
  const corpo = corpoDi(xml);
  return corpo == null ? "" : testoDi(corpo);
}

// E DI UN CAPITOLO SERVONO SOLO I DUE CAPI. `tagliaAMetaFrase` guarda come
// finisce un documento e come comincia il successivo, piu' una misura
// minima: il mezzo non lo legge nessuno, e ripulirlo era ancora un terzo
// del controllo. Oltre `CAPO` caratteri di markup per parte si tengono la
// testa e la coda, e in mezzo tre puntini — che non sono ne' un inizio ne'
// una fine. La coda puo' cominciare dentro un tag o un'entita' tagliati a
// meta': quel residuo si butta, o finirebbe contato come testo.
export const CAPO = 8000;
export function capiDelCorpo(xml, capo = CAPO) {
  const corpo = corpoDi(xml);
  if (corpo == null) return "";
  if (corpo.length <= capo * 2) return testoDi(corpo);
  let coda = corpo.slice(-capo);
  const segno = coda.search(/[<>]/);
  if (segno >= 0 && coda[segno] === ">") coda = coda.slice(segno + 1);
  coda = coda.replace(/^[^\s<&;]*;/, "");
  const testa = testoDi(corpo.slice(0, capo));
  const fine = testoDi(coda);
  // un capo senza testo (una tavola grande in testa o in fondo) non dice
  // come comincia o come finisce il capitolo: li' serve tutto
  if (!testa || !fine) return testoDi(corpo);
  return `${testa} … ${fine}`;
}
const scrivi = (doc) => new XMLSerializer().serializeToString(doc);
const HTML_NS = "http://www.w3.org/1999/xhtml";

// gli attributi che possono portare un percorso dentro un documento
const ATTR = ["src", "href", "xlink:href", "poster", "data"];

function attributiConPercorso(el) {
  const out = [];
  for (const nome of ATTR) {
    const v = nome === "xlink:href"
      ? el.getAttributeNS("http://www.w3.org/1999/xlink", "href")
      : el.getAttribute(nome);
    if (v) out.push([nome, v]);
  }
  return out;
}

function scriviAttributo(el, nome, valore) {
  if (nome === "xlink:href") el.setAttributeNS("http://www.w3.org/1999/xlink", "href", valore);
  else el.setAttribute(nome, valore);
}

// I TITOLI DELL'INDICE, in EPUB3 (nav) e in EPUB2 (ncx): sono loro a dire
// quali documenti sono unita' vere e quali sono continuazioni.
function bersagliIndice(navDoc, cartellaNav) {
  const fuori = new Set();
  if (!navDoc) return fuori;
  for (const a of navDoc.querySelectorAll("a[href], content[src]")) {
    const grezzo = a.getAttribute("href") || a.getAttribute("src");
    const p = risolvi(cartellaNav, grezzo);
    if (p) fuori.add(p);
  }
  return fuori;
}

const utf8 = new TextDecoder("utf-8");
export async function unisciPezzi(blob) {
  const { tagliaAMetaFrase } = await import("./visita.js");
  // LA DIAGNOSI SI LEGGE A FETTE, LA CURA CON JSZIP. Quasi ogni libro
  // importato e' sano, e per saperlo basta leggere i capitoli: lo fa
  // `apriZipInMemoria` col decompressore del browser, che e' codice nativo, mentre
  // JSZip scioglie in JavaScript — su un tablet era un altro terzo
  // dell'import. JSZip si carica solo se c'e' davvero da ricucire, perche'
  // e' lui che sa riscrivere l'archivio; e se lo zip non si lascia leggere
  // a fette, si torna a lui per tutto.
  const archivio = await apriZipInMemoria(blob).catch(() => null);
  const presenti = archivio ? new Set(archivio.nomi) : null;
  let JSZip = null;
  let zip = null;
  const conJSZip = async () => {
    if (!zip) {
      JSZip = (await import("jszip")).default;
      zip = await JSZip.loadAsync(blob);
    }
    return zip;
  };
  if (!archivio) await conJSZip();
  const esiste = (nome) => (presenti ? presenti.has(nome) : !!zip.file(nome));
  const leggiTesto = async (nome) => {
    if (!esiste(nome)) return null;
    if (presenti) return utf8.decode(await archivio.leggi(nome));
    return zip.file(nome).async("string");
  };

  const contenitore = await leggiTesto("META-INF/container.xml");
  if (!contenitore) return null;
  const opfPath = leggi(contenitore, "application/xml")
    ?.querySelector("rootfile")?.getAttribute("full-path");
  if (!opfPath || !esiste(opfPath)) return null;
  const opfDir = dir(opfPath);
  const opf = leggi(await leggiTesto(opfPath), "application/xml");
  if (!opf) return null;

  // manifesto e spina, con i percorsi veri dentro l'archivio
  const perId = new Map();
  for (const it of opf.querySelectorAll("manifest > item")) {
    const href = it.getAttribute("href");
    perId.set(it.getAttribute("id"), {
      el: it,
      href,
      path: risolvi(opfDir, href),
      tipo: it.getAttribute("media-type") || "",
      proprieta: it.getAttribute("properties") || "",
    });
  }
  const spina = [...opf.querySelectorAll("spine > itemref")].map((ref) => ({
    ref,
    id: ref.getAttribute("idref"),
    voce: perId.get(ref.getAttribute("idref")),
  })).filter((s) => s.voce && /xhtml|html/.test(s.voce.tipo));
  if (spina.length < 2) return null;

  // l'indice: prima il nav di EPUB3, poi l'ncx di EPUB2
  let navVoce = [...perId.values()].find((v) => /\bnav\b/.test(v.proprieta));
  if (!navVoce) {
    const idNcx = opf.querySelector("spine")?.getAttribute("toc");
    navVoce = idNcx ? perId.get(idNcx) : [...perId.values()].find((v) => /dtbncx/.test(v.tipo));
  }
  let bersagli = new Set();
  if (navVoce && esiste(navVoce.path)) {
    const testo = await leggiTesto(navVoce.path);
    bersagli = bersagliIndice(leggi(testo), dir(navVoce.path));
  }
  if (!bersagli.size) return null;

  // IL TAGLIO A META' FRASE SCAVALCA L'INDICE. Calibre mette spesso una
  // voce d'indice DENTRO lo split — col frammento, per il titolo del
  // capitolo che ci abita — e il pezzo risultava «aperto dall'indice» e
  // non si toccava: il lettore, gia' «ricucito», rivedeva la stessa
  // pagina tagliata a meta' frase. Ma un documento che comincia in
  // minuscola dopo uno che finisce senza punteggiatura e' la
  // continuazione della stessa frase, comunque la pensi l'indice; e le
  // voci d'indice sopravvivono, perche' il giro in fondo riscrive anche
  // loro, frammento compreso.
  const testi = new Map(
    await Promise.all(
      spina.map(async (s) => [s.voce.path, capiDelCorpo(await leggiTesto(s.voce.path).catch(() => ""))])
    )
  );
  // i gruppi: un documento che l'indice non apre — o che comincia a meta'
  // frase — e' la continuazione del precedente
  const gruppi = [];
  let precedente = null;
  for (const s of spina) {
    const continua =
      gruppi.length &&
      (!bersagli.has(s.voce.path) ||
        tagliaAMetaFrase(testi.get(precedente?.voce.path), testi.get(s.voce.path)));
    if (continua) gruppi[gruppi.length - 1].push(s);
    else gruppi.push([s]);
    precedente = s;
  }
  const daCucire = gruppi.filter((g) => g.length > 1);
  if (!daCucire.length) return null;
  await conJSZip();

  const rinominati = new Map(); // path#idVecchio -> idNuovo
  let cuciti = 0;

  for (const gruppo of daCucire) {
    const capo = gruppo[0];
    const capoDir = dir(capo.voce.path);
    const docCapo = leggi(await zip.file(capo.voce.path).async("string"));
    if (!docCapo) continue;
    const corpoCapo = docCapo.querySelector("body");
    const testaCapo = docCapo.querySelector("head");
    if (!corpoCapo) continue;
    const idPresi = new Set([...docCapo.querySelectorAll("[id]")].map((e) => e.id));
    const fogliPresi = new Set(
      [...docCapo.querySelectorAll("link[rel~=stylesheet]")].map((l) => l.getAttribute("href"))
    );

    for (const pezzo of gruppo.slice(1)) {
      const file = zip.file(pezzo.voce.path);
      if (!file) continue;
      const doc = leggi(await file.async("string"));
      const corpo = doc?.querySelector("body");
      if (!corpo) continue;
      const suaDir = dir(pezzo.voce.path);

      // i fogli di stile suoi che il capo non ha
      for (const l of doc.querySelectorAll("link[rel~=stylesheet]")) {
        const href = l.getAttribute("href");
        const risolto = risolvi(suaDir, href);
        const comeDalCapo = risolto && risolto.startsWith(capoDir)
          ? risolto.slice(capoDir.length)
          : href;
        if (fogliPresi.has(comeDalCapo)) continue;
        fogliPresi.add(comeDalCapo);
        const nuovo = docCapo.createElementNS(HTML_NS, "link");
        nuovo.setAttribute("rel", "stylesheet");
        nuovo.setAttribute("type", l.getAttribute("type") || "text/css");
        nuovo.setAttribute("href", comeDalCapo);
        testaCapo?.appendChild(nuovo);
      }

      // gli id che si pestano i piedi: si rinominano e si segna dov'erano
      for (const el of doc.querySelectorAll("[id]")) {
        const vecchio = el.getAttribute("id");
        if (!idPresi.has(vecchio)) {
          idPresi.add(vecchio);
          continue;
        }
        let nuovo = `${vecchio}-bc${cuciti}`;
        let n = 2;
        while (idPresi.has(nuovo)) nuovo = `${vecchio}-bc${cuciti}-${n++}`;
        el.setAttribute("id", nuovo);
        idPresi.add(nuovo);
        rinominati.set(`${pezzo.voce.path}#${vecchio}`, nuovo);
      }

      // i percorsi: visti dalla cartella del capo, e i rimandi ai
      // documenti che stiamo cucendo diventano semplici frammenti
      for (const el of doc.querySelectorAll("*")) {
        for (const [nome, valore] of attributiConPercorso(el)) {
          if (valore.startsWith("#")) continue;
          const risolto = risolvi(suaDir, valore);
          if (!risolto) continue;
          const frammento = valore.includes("#") ? valore.slice(valore.indexOf("#") + 1) : "";
          const dentroAlGruppo = gruppo.find((g) => g.voce.path === risolto);
          if (dentroAlGruppo) {
            const rinominato = rinominati.get(`${risolto}#${frammento}`);
            const ancora = rinominato || frammento || ancoraDi(risolto);
            scriviAttributo(el, nome, `#${ancora}`);
          } else if (risolto.startsWith(capoDir)) {
            scriviAttributo(el, nome, risolto.slice(capoDir.length) + (frammento ? `#${frammento}` : ""));
          } else {
            // fuori dalla cartella del capo: si risale quanto serve
            scriviAttributo(el, nome, relativo(capoDir, risolto) + (frammento ? `#${frammento}` : ""));
          }
        }
      }

      // il punto di sutura porta il nome del vecchio file: l'indice ci si
      // aggancia, e i rimandi interni pure
      const cucitura = docCapo.createElementNS(HTML_NS, "div");
      cucitura.setAttribute("id", ancoraDi(pezzo.voce.path));
      // il nodo si STACCA prima di copiarlo: importNode fa una copia e
      // lascia l'originale dov'e', quindi «finche' c'e' un primo figlio»
      // non finiva mai — il libro non entrava piu' e il browser restava li'
      while (corpo.firstChild) {
        const nodo = corpo.firstChild;
        corpo.removeChild(nodo);
        cucitura.appendChild(docCapo.importNode(nodo, true));
      }
      corpoCapo.appendChild(cucitura);

      // il pezzo esce dalla spina, il file resta nell'archivio (il
      // manifesto lo pretende) ma non lo apre piu' nessuno
      pezzo.ref.parentNode.removeChild(pezzo.ref);
      cuciti += 1;
    }
    zip.file(capo.voce.path, scrivi(docCapo));
  }

  if (!cuciti) return null;

  // l'indice va rifatto: le voci che puntavano ai pezzi cuciti ora
  // puntano al capo, sull'ancora della sutura
  const cucitiPer = new Map();
  for (const gruppo of daCucire) {
    for (const pezzo of gruppo.slice(1)) cucitiPer.set(pezzo.voce.path, gruppo[0].voce.path);
  }
  // E NON SOLO L'INDICE: anche i documenti sopravvissuti — il capo per
  // primo — possono avere rimandi ai pezzi cuciti via. È il caso delle
  // NOTE a piè di pagina nei libri Calibre: il capitolo rimanda al suo
  // «split» delle note, la ricucitura fonde lo split nel capitolo, e il
  // rimando restava puntato a un file che non esiste più — l'asterisco
  // non faceva NIENTE, su nessun dispositivo (segnalato dal lettore).
  // I pezzi cuciti si saltano: i loro rimandi sono già stati sistemati.
  for (const voce of perId.values()) {
    if (!/xhtml|html|dtbncx/.test(voce.tipo) || !zip.file(voce.path)) continue;
    if (cucitiPer.has(voce.path)) continue;
    const testo = await zip.file(voce.path).async("string");
    const doc = leggi(testo);
    if (!doc) continue;
    const suaDir = dir(voce.path);
    let toccato = false;
    for (const a of doc.querySelectorAll("a[href], content[src]")) {
      const nome = a.hasAttribute("href") ? "href" : "src";
      const valore = a.getAttribute(nome);
      const risolto = risolvi(suaDir, valore);
      const capo = risolto && cucitiPer.get(risolto);
      if (!capo) continue;
      const frammento = valore.includes("#") ? valore.slice(valore.indexOf("#") + 1) : "";
      const ancora = rinominati.get(`${risolto}#${frammento}`) || frammento || ancoraDi(risolto);
      // dal capo verso un suo pezzo cucito basta il frammento nudo
      const dove = capo === voce.path ? "" : relativo(suaDir, capo);
      a.setAttribute(nome, `${dove}#${ancora}`);
      toccato = true;
    }
    if (toccato) zip.file(voce.path, scrivi(doc));
  }

  zip.file(opfPath, scrivi(opf));

  // l'archivio si riscrive da capo: «mimetype» vuole stare per primo e
  // senza compressione, ed e' l'unica regola di forma che un ePub ha
  const fuori = new JSZip();
  fuori.file("mimetype", "application/epub+zip", { compression: "STORE" });
  for (const [nome, f] of Object.entries(zip.files)) {
    if (nome === "mimetype" || f.dir) continue;
    fuori.file(nome, await f.async("uint8array"));
  }
  const bytes = await fuori.generateAsync({
    type: "blob",
    mimeType: "application/epub+zip",
    compression: "DEFLATE",
  });
  return { blob: bytes, cuciti };
}

export const ancoraDi = (path) => `bc-${path.replace(/[^a-zA-Z0-9]+/g, "-")}`;

// da una cartella a un file, risalendo quanto serve
export function relativo(daDir, aPath) {
  const a = daDir.split("/").filter(Boolean);
  const b = aPath.split("/").filter(Boolean);
  let i = 0;
  while (i < a.length && i < b.length - 1 && a[i] === b[i]) i += 1;
  return "../".repeat(a.length - i) + b.slice(i).join("/");
}
