// COSTRUISCE IL DIZIONARIO OFFLINE: WordNet 3.0 piu' MultiWordNet.
//
// Si lancia a mano — `node scripts/dizionarioOffline.mjs` — e riscrive
// `public/dizionario/en.json.gz`. Non gira nella build: il file generato sta
// nel repository, cosi' chi distribuisce l'app non scarica niente. Le due
// fonti si prendono da GitHub la prima volta e restano in `scripts/.cache`
// (ignorata da git): se la rete non c'e' e la cache nemmeno, lo script dice
// cosa scaricare a mano invece di fallire con un errore di modulo.
//
// PERCHE' WORDNET 3.0 E NON `wordnet-db`. Il pacchetto npm porta la 3.1, e
// la prima versione di questo dizionario era costruita da li' — con
// «WordNet 3.0» scritto nel cartellino, che non era vero. E' venuto fuori
// cercando la resa italiana: MultiWordNet aggancia i suoi lemmi agli
// identificatori di synset della 3.0 (via Open Multilingual Wordnet), e fra
// 3.0 e 3.1 gli identificatori CAMBIANO — «02121808» e' «gatto domestico»
// nella 3.0 e non esiste nella 3.1. Quindi la 3.0 vera, dal deposito dei
// dati di NLTK, che ne tiene una copia identica a quella di Princeton.
//
// COSA CAMBIA RISPETTO A PRIMA, e perche' il lettore l'ha chiesto («il
// dizionario non mi piace com'e' fatto»):
// (1) LA RESA ITALIANA, senso per senso: MultiWordNet dice come si chiama
//     in italiano ogni synset — «cat» → «gatto», «run» (verbo) → «correre»
//     — ed e' un'informazione di dizionario, non una traduzione a macchina.
//     Copre 32.700 synset su 117.000: i comuni, cioe' quelli che si cercano.
// (2) I SENSI IN ORDINE DI FREQUENZA: prima si prendevano i primi tre nel
//     percorso del file dei dati, che e' l'ordine degli identificatori,
//     cioe' nessuno — «run» poteva uscire con tre sensi rari. L'indice di
//     WordNet elenca i synset di ogni lemma dal piu' frequente al meno, ed e'
//     da li' che si legge adesso; e il primo senso di ogni categoria
//     grammaticale viene prima del secondo di un'altra, o «run» sarebbe
//     tutto verbi.
//
// NEL FILE VA LA LETTERA della categoria, non la parola italiana: scriverla
// per intero la ripeterebbe quattrocentomila volte (misurato: quasi un
// megabyte compresso). Il nome per lo schermo lo mette il client.
//
// Le licenze viaggiano con OGNI copia: quella di WordNet lo chiede in
// chiaro, e MultiWordNet e' CC BY 3.0, che vuole l'attribuzione. Per
// questo i due file stanno accanto al dizionario e la scheda li nomina.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

const QUI = dirname(fileURLToPath(import.meta.url));
const FUORI = join(QUI, "..", "public", "dizionario");
const CACHE = join(QUI, ".cache");

const FONTI = {
  wordnet: {
    file: "wordnet-3.0.zip",
    url: "https://raw.githubusercontent.com/nltk/nltk_data/gh-pages/packages/corpora/wordnet.zip",
  },
  ita: {
    file: "wn-data-ita.tab",
    url: "https://raw.githubusercontent.com/omwn/omw-data/main/wns/ita/wn-data-ita.tab",
  },
};

// oltre un certo numero nessuno legge: la scheda ne mostra pochi e ripiega
// il resto
const SENSI_PER_CATEGORIA = 3;
const SENSI_PER_PAROLA = 5;
const ITALIANI_PER_SENSO = 4;

async function prendi({ file, url }) {
  const dove = join(CACHE, file);
  if (existsSync(dove)) return readFileSync(dove);
  mkdirSync(CACHE, { recursive: true });
  let res;
  try {
    res = await fetch(url);
  } catch (e) {
    throw new Error(`non riesco a scaricare ${url} (${e.message}): mettilo a mano in ${dove}`);
  }
  if (!res.ok) throw new Error(`${url} risponde ${res.status}: mettilo a mano in ${dove}`);
  const byte = Buffer.from(await res.arrayBuffer());
  writeFileSync(dove, byte);
  return byte;
}

let zip;
try {
  zip = await JSZip.loadAsync(await prendi(FONTI.wordnet));
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
const dentroZip = async (nome) => {
  const f = zip.file(`wordnet/${nome}`) || zip.file(nome);
  if (!f) throw new Error(`nel pacchetto di WordNet manca ${nome}`);
  return f.async("nodebuffer");
};
// i file di WordNet sono in Latin-1
const testo = async (nome) => (await dentroZip(nome)).toString("latin1");

// WordNet marca `s` gli aggettivi «satellite», che per un lettore sono
// aggettivi come gli altri
const POS = { n: "n", v: "v", a: "a", s: "a", r: "r" };
const ORDINE_POS = ["n", "v", "a", "r"];

// ---- le glosse, per identificatore di synset ------------------------------
const glosse = new Map(); // "02121808-n" → definizione
for (const [f, pos] of [["data.noun", "n"], ["data.verb", "v"], ["data.adj", "a"], ["data.adv", "r"]]) {
  for (const riga of (await testo(f)).split("\n")) {
    // l'intestazione di licenza si riconosce dai due spazi in testa
    if (!riga || riga.startsWith("  ")) continue;
    const taglio = riga.indexOf(" | ");
    if (taglio < 0) continue;
    const offset = riga.slice(0, 8);
    // la glossa e' «definizione; "esempio"; "altro esempio"»: gli esempi si
    // buttano — sono meta' del peso e la scheda non li mostra
    const definizione = riga.slice(taglio + 3).split(/;\s*"/)[0].trim();
    if (definizione) glosse.set(`${offset}-${pos}`, definizione);
  }
}

// ---- la resa italiana, per identificatore di synset ------------------------
// Il formato di Open Multilingual Wordnet: «02121808-n<TAB>ita:lemma<TAB>gatto».
// Gli aggettivi satellite stanno sotto `-a` anche li', quindi la chiave
// combacia con quella delle glosse senza tradurre niente.
const italiano = new Map(); // "02121808-n" → ["gatto", "gatto domestico"]
let righeIta;
try {
  righeIta = (await prendi(FONTI.ita)).toString("utf8").split("\n");
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
for (const riga of righeIta) {
  const [id, tipo, lemma] = riga.split("\t");
  if (tipo !== "ita:lemma" || !lemma) continue;
  const l = lemma.trim();
  // «GAP!» e' il segnaposto con cui MultiWordNet marca un synset che
  // l'italiano non copre: non e' una parola, e sullo schermo sembrerebbe
  // un guasto
  if (!l || /!/.test(l)) continue;
  const lista = italiano.get(id) || [];
  if (!lista.includes(l)) lista.push(l);
  italiano.set(id, lista);
}
// I NOMI SCIENTIFICI IN CODA: «Felis domesticus» e' un lemma vero di
// MultiWordNet ma nessuno cerca «cat» per sapere quello — dopo «gatto», non
// prima. Si riconoscono dalla maiuscola.
for (const [id, lista] of italiano) {
  lista.sort((a, b) => (/^\p{Lu}/u.test(a) ? 1 : 0) - (/^\p{Lu}/u.test(b) ? 1 : 0));
  italiano.set(id, lista.slice(0, ITALIANI_PER_SENSO));
}

// ---- i sensi di ogni parola, dall'INDICE, in ordine di frequenza -----------
// index.noun: «lemma pos synset_cnt p_cnt [ptr…] sense_cnt tagsense_cnt
// offset…» — gli offset stanno dal senso piu' frequente al meno.
const perParola = new Map(); // parola → { n: [id…], v: […], … }
for (const [f, pos] of [["index.noun", "n"], ["index.verb", "v"], ["index.adj", "a"], ["index.adv", "r"]]) {
  for (const riga of (await testo(f)).split("\n")) {
    if (!riga || riga.startsWith("  ")) continue;
    const campi = riga.trim().split(/\s+/);
    // «Ankh_Morpork» → «ankh morpork»
    const parola = campi[0].replace(/_/g, " ").toLowerCase();
    const quantiPuntatori = parseInt(campi[3], 10);
    const offsets = campi.slice(6 + quantiPuntatori);
    if (!parola || !offsets.length) continue;
    const voce = perParola.get(parola) || {};
    // quanti sensi di questa categoria sono stati VISTI in un corpus
    // annotato: e' il solo segnale che WordNet da' su quale categoria di
    // una parola si incontra davvero leggendo
    const taggati = parseInt(campi[5 + quantiPuntatori], 10) || 0;
    voce[pos] = { ids: offsets.slice(0, SENSI_PER_CATEGORIA).map((o) => `${o}-${pos}`), taggati };
    perParola.set(parola, voce);
  }
}

function sensiDi(parola) {
  const voce = perParola.get(parola);
  const out = [];
  // LE CATEGORIE IN ORDINE DI USO, e il primo senso di ognuna prima del
  // secondo di qualunque altra. «run» ha 41 sensi da verbo e uno solo si
  // incontra leggendo un romanzo: senza l'interleaving il sostantivo («a
  // run of luck») non comparirebbe mai; senza l'ordine per uso, il baseball
  // («a score made by a runner») verrebbe prima di «correre». E una
  // categoria MAI vista nel corpus («cat» come verbo, «silly» come
  // sostantivo) va in coda a tutte le altre, dopo i loro sensi secondari:
  // il suo primo senso non batte il secondo di una categoria vera.
  const categorie = ORDINE_POS.filter((p) => voce[p]).sort(
    (a, b) => voce[b].taggati - voce[a].taggati || ORDINE_POS.indexOf(a) - ORDINE_POS.indexOf(b)
  );
  const giri = [categorie.filter((p) => voce[p].taggati > 0), categorie.filter((p) => !voce[p].taggati)];
  for (const gruppo of giri) {
    for (let grado = 0; grado < SENSI_PER_CATEGORIA && out.length < SENSI_PER_PAROLA; grado++) {
      for (const pos of gruppo) {
        const id = voce[pos].ids[grado];
        if (!id) continue;
        const def = glosse.get(id);
        if (!def || out.some((s) => s[1] === def)) continue;
        const ita = italiano.get(id);
        out.push(ita ? [POS[pos], def, ita.join(", ")] : [POS[pos], def]);
        if (out.length >= SENSI_PER_PAROLA) break;
      }
    }
  }
  return out;
}

// L'ORDINE DELLE VOCI NEL FILE DECIDE QUANTO PESA, e costa un megabyte
// scoprirlo: WordNet ripete la stessa glossa per ogni parola di un synset
// («shut» e «close»), e gzip — che si guarda indietro di 32 KB — la
// riconosce solo se le due voci stanno vicine. Ordinate per parola
// finiscono a mezzo file di distanza. Si scrive quindi nell'ordine dei
// synset, come sta nei file dei dati: le parole dello stesso synset escono
// una dopo l'altra. Chi cerca non ne risente, la ricerca passa da una
// mappa.
const mappa = new Map();
for (const f of ["data.noun", "data.verb", "data.adj", "data.adv"]) {
  for (const riga of (await testo(f)).split("\n")) {
    if (!riga || riga.startsWith("  ")) continue;
    const taglio = riga.indexOf(" | ");
    if (taglio < 0) continue;
    const testa = riga.slice(0, taglio).split(" ");
    const quanti = parseInt(testa[3], 16);
    for (let i = 0; i < quanti; i++) {
      const parola = testa[4 + i * 2].replace(/_/g, " ").replace(/\(\w+\)$/, "").toLowerCase();
      if (!parola || mappa.has(parola) || !perParola.has(parola)) continue;
      const sensi = sensiDi(parola);
      if (sensi.length) mappa.set(parola, sensi);
    }
  }
}
// e chi sta nell'indice ma non si e' incontrato scorrendo i dati (non
// dovrebbe succedere, ma un dizionario che perde parole in silenzio e' il
// difetto peggiore che possa avere)
for (const parola of perParola.keys()) {
  if (mappa.has(parola)) continue;
  const sensi = sensiDi(parola);
  if (sensi.length) mappa.set(parola, sensi);
}

const oggetto = Object.fromEntries(mappa);
const crudo = Buffer.from(JSON.stringify(oggetto));
const compresso = gzipSync(crudo, { level: 9 });
let conItaliano = 0;
for (const sensi of mappa.values()) if (sensi.some((s) => s[2])) conItaliano++;

mkdirSync(FUORI, { recursive: true });
writeFileSync(join(FUORI, "en.json.gz"), compresso);
writeFileSync(join(FUORI, "LICENZA-WordNet.txt"), await dentroZip("LICENSE"));
writeFileSync(
  join(FUORI, "LICENZA-MultiWordNet.txt"),
  [
    "La resa italiana dei sensi viene da MultiWordNet 1.5 (Fondazione Bruno",
    "Kessler, http://multiwordnet.fbk.eu), distribuito attraverso l'Open",
    "Multilingual Wordnet (https://github.com/omwn/omw-data) con licenza",
    "Creative Commons Attribution 3.0 Unported (CC BY 3.0):",
    "https://creativecommons.org/licenses/by/3.0/",
    "",
    "Pianta, Emanuele, Luisa Bentivogli e Christian Girardi (2002).",
    "«MultiWordNet: developing an aligned multilingual database».",
    "Proceedings of the First International Conference on Global WordNet,",
    "Mysore, India, 293-302.",
    "",
    "Bond, Francis e Ryan Foster (2013). «Linking and extending an open",
    "multilingual wordnet». Proceedings of ACL 2013, 1352-1362.",
    "",
  ].join("\n")
);
// IL CARTELLINO LO SCRIVE CHI COSTRUISCE, non chi disegna il pannello:
// un numero scritto a mano in un componente mente al primo dizionario
// rifatto, e nessuno se ne accorge.
writeFileSync(
  join(FUORI, "meta.json"),
  JSON.stringify({
    voci: mappa.size,
    italiano: conItaliano,
    byte: compresso.length,
    fonte: "WordNet 3.0 + MultiWordNet 1.5",
  })
);

const mb = (n) => (n / 1048576).toFixed(2);
console.log(`voci: ${mappa.size}, con resa italiana: ${conItaliano}`);
console.log(`crudo: ${mb(crudo.length)} MB → compresso: ${mb(compresso.length)} MB`);
console.log(`scritto in ${FUORI}`);
