// COSTRUISCE IL DIZIONARIO OFFLINE, da WordNet.
//
// Si lancia a mano — `node scripts/dizionarioOffline.mjs` — e riscrive
// `public/dizionario/en.json.gz`. Non gira nella build: il file generato sta
// nel repository, cosi' chi distribuisce l'app non ha bisogno dei 35 MB di
// `wordnet-db`, che serve solo a chi rifa' il dizionario.
//
// Vale la regola di `test/tema.test.mjs`: se il pacchetto manca, si dice
// come averlo invece di fallire con un errore di modulo.
//
// PERCHE' WORDNET E NON WIKTIONARY. Wiktionary e' la fonte in rete e resta
// la migliore — locuzioni, verbi frasali, rimandi delle forme flesse — ma
// non esiste in una forma scaricabile che stia in pochi megabyte. WordNet
// e' un dizionario vero, con le definizioni in inglese, e ridotto a
// «parola → definizioni» sta in poco piu' di tre megabyte compressi. E le
// definizioni restano IN LINGUA, che e' gia' la scelta dell'app: la glossa
// non si traduce a macchina (vedi la cura del dizionario in CLAUDE.md).
//
// La licenza di WordNet (Princeton) chiede che la nota di copyright e il
// disclaimer viaggino con OGNI copia: per questo il file della licenza si
// copia accanto al dizionario, e non e' un dettaglio burocratico.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const QUI = dirname(fileURLToPath(import.meta.url));
const FUORI = join(QUI, "..", "public", "dizionario");
// oltre tre sensi nessuno legge, e la scheda ne mostra otto in tutto
const SENSI_PER_PAROLA = 3;

const require = createRequire(import.meta.url);
let radice;
try {
  radice = dirname(require.resolve("wordnet-db"));
} catch {
  console.error(
    "Manca `wordnet-db`, che serve solo a rifare il dizionario:\n" +
      "  npm i -D wordnet-db\n" +
      "Il file gia' costruito sta in public/dizionario/ e non ha bisogno di niente."
  );
  process.exit(1);
}

const DICT = join(radice, "dict");
// WordNet marca `s` gli aggettivi «satellite», che per un lettore sono
// aggettivi come gli altri. NEL FILE VA LA LETTERA, non la parola italiana:
// scrivere «sostantivo» dentro il dato lo ripete quattrocentomila volte, e
// misurato costava **quasi un megabyte compresso** — il nome per lo schermo
// lo mette il client, che e' anche il posto giusto perche' e' lingua di
// interfaccia, non dizionario.
const POS = { n: "n", v: "v", a: "a", s: "a", r: "r" };

const mappa = new Map();
for (const f of ["data.noun", "data.verb", "data.adj", "data.adv"]) {
  // i file di WordNet sono in Latin-1 e cominciano con l'intestazione di
  // licenza, che si riconosce dai due spazi in testa
  for (const riga of readFileSync(join(DICT, f), "latin1").split("\n")) {
    if (!riga || riga.startsWith("  ")) continue;
    const taglio = riga.indexOf(" | ");
    if (taglio < 0) continue;
    const testa = riga.slice(0, taglio).split(" ");
    // la glossa e' «definizione; "esempio"; "altro esempio"»: gli esempi si
    // buttano — sono meta' del peso e la scheda non li mostra
    const definizione = riga.slice(taglio + 3).split(/;\s*"/)[0].trim();
    if (!definizione) continue;
    const tipo = POS[testa[2]] || testa[2];
    const quanti = parseInt(testa[3], 16);
    for (let i = 0; i < quanti; i++) {
      // «Ankh_Morpork» → «ankh morpork»; il numero fra parentesi che WordNet
      // attacca agli omografi («bass(1)») non e' parte della parola
      const parola = testa[4 + i * 2].replace(/_/g, " ").replace(/\(\w+\)$/, "").toLowerCase();
      if (!parola) continue;
      const sensi = mappa.get(parola) || [];
      if (sensi.length >= SENSI_PER_PAROLA) continue;
      if (sensi.some((s) => s[1] === definizione)) continue;
      sensi.push([tipo, definizione]);
      mappa.set(parola, sensi);
    }
  }
}

// NON SI ORDINA PER PAROLA, e costa un megabyte scoprirlo. WordNet ripete
// la STESSA glossa per ogni parola di un synset («shut» e «close» portano
// la stessa definizione parola per parola): nell'ordine del file quei
// doppioni sono adiacenti e gzip, che si guarda indietro di 32 KB, li
// riconosce; ordinati per parola finiscono a mezzo file di distanza e non
// li vede piu' nessuno. Misurato: 4,48 MB ordinato contro 3,35 MB com'e'.
// Chi cerca non ne risente — la ricerca passa da una mappa, non da una
// scansione — e il client raggruppa comunque per prefisso.
const oggetto = Object.fromEntries(mappa);
const crudo = Buffer.from(JSON.stringify(oggetto));
const compresso = gzipSync(crudo, { level: 9 });

mkdirSync(FUORI, { recursive: true });
writeFileSync(join(FUORI, "en.json.gz"), compresso);
copyFileSync(join(radice, "LICENSE"), join(FUORI, "LICENZA-WordNet.txt"));
// IL CARTELLINO LO SCRIVE CHI COSTRUISCE, non chi disegna il pannello.
// «147.478 voci · 3,4 MB» scritto a mano in un componente e' un numero che
// mente al primo dizionario rifatto, e nessuno se ne accorge.
writeFileSync(
  join(FUORI, "meta.json"),
  JSON.stringify({ voci: mappa.size, byte: compresso.length, fonte: "WordNet 3.0" })
);

const mb = (n) => (n / 1048576).toFixed(2);
console.log(`voci: ${mappa.size}`);
console.log(`crudo: ${mb(crudo.length)} MB → compresso: ${mb(compresso.length)} MB`);
console.log(`scritto in ${FUORI}`);
