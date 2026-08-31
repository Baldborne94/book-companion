// I NOMI DI UNA PERSONA, TROVATI NEL LIBRO E NON IN UN ELENCO.
//
// Chi legge tocca una parola sola: «Monza». Ma nelle stesse pagine quella
// persona e' anche «Murcatto», «Monza Murcatto», «il Macellaio di Caprile».
// Cercando solo la parola toccata meta' della sua storia non viene raccolta,
// e la scheda esce monca proprio dove serviva piena.
//
// Il ponte fra i nomi NON si chiede al modello. Chiedergli «chi altro si
// chiama cosi'?» significa dirgli di che libro si tratta, e da li' in poi
// risponde a memoria — anche sulle pagine che il lettore non ha ancora
// letto. Il ponte si costruisce nel testo che il lettore ha gia' davanti,
// con due segnali che valgono in qualunque romanzo e in qualunque lingua:
//
//   1. i PEZZI DI NOME ATTACCATI: se da qualche parte c'e' scritto «Monza
//      Murcatto», allora «Murcatto» e' lei.
//   2. le FORMULE D'APPELLATIVO: «X, detto Y», «X, known as Y». Poche
//      parole-cerniera, le stesse in ogni libro di quella lingua.
//
// E un guardrail che pesa piu' dei due segnali messi insieme: UN COGNOME
// CONDIVISO NON SI PRENDE. Se «Lannister» sta dietro a cinque nomi diversi
// e' una famiglia, non una persona, e cercarlo tirerebbe dentro i fratelli —
// con le loro storie, che non sono la sua.

// Un nome, non una frase: la scheda ha senso su «Logen Novedita», non su
// mezzo paragrafo.
//
// LA MAIUSCOLA SI CHIEDE A UNICODE, non a un intervallo di caratteri. Qui
// c'era `[A-ZÀ-Þ]`, mentre tutto il resto del file — `utile`, `PAROLA`,
// `FILA` — usa gia' `\p{Lu}`: due modi di dire «maiuscola» nello stesso file,
// e quello stretto stava proprio sul cancello. Misurato: «Łukasz», «Šárka»,
// «Żeleński», «Ольга», «Δημήτρης» non offrivano la scheda affatto, IN
// SILENZIO — nessun errore, il tasto semplicemente non compariva — mentre
// `utile()` due righe sotto li avrebbe accettati senza storie. E l'intervallo
// prendeva per una lettera anche «×», che sta fra Ö e Ø.
export function sembraUnNome(s) {
  const t = String(s || "").trim();
  if (!t || t.length > 42) return false;
  const parole = t.split(/\s+/);
  if (parole.length > 4) return false;
  return parole.some((p) => /^\p{Lu}/u.test(p));
}

// Articoli, particelle e titoli: da soli acchiapperebbero mezzo libro, e come
// alias non dicono niente.
const GENERICHE = new Set([
  "the", "der", "die", "das", "los", "las", "van", "von", "mac",
  "del", "dei", "della", "dello", "don", "dom", "san", "santa", "ser",
  "sir", "lord", "lady", "king", "queen", "mister", "miss", "old",
  "duke", "duca", "conte", "count", "prince", "principe", "generale",
  "general", "captain", "capitano", "maestro", "master", "padre", "father",
]);

const utile = (p) => /^\p{Lu}/u.test(p) && p.length >= 3 && !GENERICHE.has(p.toLowerCase());

// Le parti del nome valgono da sole: selezioni «Logen Novedita» e le pagine
// dove e' scritto solo «Novedita» devono contare lo stesso.
export function varianti(nome) {
  const intero = String(nome || "").trim().replace(/\s+/g, " ");
  if (!intero) return [];
  return [...new Set([intero, ...intero.split(" ").filter(utile)])];
}

export const sfuggi = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// maiuscole rispettate: «Death» il personaggio, non «the death of kings»
export function regexNome(nomi) {
  const v = [...new Set([].concat(nomi).flatMap(varianti))];
  if (!v.length) return null;
  // i nomi lunghi per primi: «Monza Murcatto» prima di «Monza», o
  // l'alternanza si ferma al pezzo corto e il resto resta fuori dal colpo
  v.sort((a, b) => b.length - a.length);
  return new RegExp(`(?<![\\p{L}\\p{N}])(${v.map(sfuggi).join("|")})(?![\\p{L}\\p{N}])`, "gu");
}

// Una fila di parole maiuscole, con le particelle minuscole ammesse in mezzo:
// «Monza Murcatto», «Sand dan Glokta», «Caul Shivers».
const PAROLA = "\\p{Lu}[\\p{L}'’\\-]+";
const FILA = new RegExp(`${PAROLA}(?:[ \\u00a0](?:\\p{Ll}{1,3}[ \\u00a0])?${PAROLA})*`, "gu");

// Le cerniere che in una lingua qualunque annunciano un secondo nome. Solo
// quelle esplicite: l'apposizione («Monza, la generale di Orso») porta dentro
// i nomi degli ALTRI, ed e' esattamente quello che non deve succedere.
const CERNIERE = [
  "detto", "detta", "chiamato", "chiamata", "chiamavano", "soprannominato",
  "soprannominata", "noto come", "nota come", "conosciuto come", "conosciuta come",
  "known as", "called", "nicknamed", "goes by",
  "llamado", "llamada", "apodado", "conocido como",
  "surnommé", "surnommée", "appelé", "appelée", "genannt",
]
  .sort((a, b) => b.length - a.length)
  // niente flag «i» su tutta la regex: renderebbe \p{Lu} indifferente alle
  // maiuscole, e l'epiteto si mangerebbe le parole comuni che gli stanno
  // dietro. L'iniziale ballerina si scrive a mano, dove serve.
  .map((c) => c.replace(/^(\p{L})/u, (x) => `[${x.toUpperCase()}${x}]`));

const ARTICOLI = "(?:[Ii]l|[Ll]o|[Ll]a|[Gg]li|[Ll]e|[Tt]he|[Ee]l|[Ll]os|[Ll]as|[Dd]er|[Dd]ie|[Dd]as|[Ll]es)";

export function nuovoRegistro(nome) {
  return {
    cercati: new Set(varianti(nome).flatMap((v) => v.split(" ")).map((p) => p.toLowerCase())),
    conta: new Map(),
    insieme: new Map(),
    estranei: new Map(),
    epiteti: new Map(),
    // fra il nome e la cerniera ci sta il resto del nome per esteso: quasi
    // sempre il libro scrive «Logen Novedita, detto il Sanguinario», non
    // «Logen, detto il Sanguinario». Dopo l'epiteto si guarda se segue un
    // possessivo, e in quel caso non e' un nome ma un ruolo — «l'uomo del
    // Sanguinario» e' un altro, e prenderlo vorrebbe dire cucire insieme due
    // personaggi diversi.
    cerniera: new RegExp(
      `(?<![\\p{L}\\p{N}])(?:${varianti(nome).map(sfuggi).join("|")})(?:[ \\u00a0]${PAROLA}){0,3}` +
        `[^\\p{L}\\p{N}]{0,3}(?:${CERNIERE.join("|")})[^\\p{L}\\p{N}]{1,3}` +
        `(?:${ARTICOLI}[^\\p{L}\\p{N}]{1,2})?(${PAROLA}(?:[ \\u00a0](?:\\p{Ll}{1,3}[ \\u00a0])?${PAROLA})*)` +
        `(['’]s)?`,
      "gu"
    ),
  };
}

const piu = (mappa, k, n = 1) => mappa.set(k, (mappa.get(k) || 0) + n);

// Si chiama su ogni capitolo (o pagina) dentro la frontiera. Non costruisce
// paragrafi e non tocca i CFI: e' una passata di sola conta, e per questo si
// puo' permettere di guardare tutto il volume.
export function annota(reg, testo) {
  const t = String(testo || "");
  if (!t) return;
  FILA.lastIndex = 0;
  let m;
  while ((m = FILA.exec(t))) {
    const parole = m[0].split(/[\s ]+/).filter((p) => /^\p{Lu}/u.test(p));
    const nostro = parole.some((p) => reg.cercati.has(p.toLowerCase()));
    let precedente = null;
    for (const p of parole) {
      const suo = reg.cercati.has(p.toLowerCase());
      if (utile(p) && !suo) {
        piu(reg.conta, p);
        if (nostro) piu(reg.insieme, p);
        // chi gli sta davanti: «Lannister» dietro a Cersei, Jaime e Tywin e'
        // di una casata, non di una persona
        else if (precedente && !reg.cercati.has(precedente.toLowerCase())) piu(reg.estranei, p);
      }
      precedente = p;
    }
  }
  reg.cerniera.lastIndex = 0;
  while ((m = reg.cerniera.exec(t))) {
    // «l'uomo del Sanguinario» non e' il Sanguinario: un epiteto che finisce
    // in possessivo dice di chi sei, non come ti chiami, e prenderlo vorrebbe
    // dire cucire insieme due personaggi diversi
    if (m[2] || /['’]s$/u.test(m[1])) continue;
    const e = m[1].trim().replace(/[^\p{L}\p{N}]+$/u, "");
    if (e && !reg.cercati.has(e.split(" ")[0].toLowerCase())) piu(reg.epiteti, e);
  }
}

const MAX_ALIAS = 6;

export function decidi(reg) {
  const fuori = new Set(reg.cercati);
  const scelti = [];
  for (const [p, n] of [...reg.insieme].sort((a, b) => b[1] - a[1])) {
    if (n < 2 || fuori.has(p.toLowerCase())) continue;
    // il conto decide, non l'esistenza di un'eccezione: un fratello che
    // porta lo stesso cognome non lo rende della casata, cinque parenti si.
    // «Murcatto» sta dietro a Monza cento volte e a Benna dieci: e' suo.
    if ((reg.estranei.get(p) || 0) > n) continue;
    scelti.push(p);
    fuori.add(p.toLowerCase());
    if (scelti.length >= MAX_ALIAS) return scelti;
  }
  // un soprannome vero ritorna: se la formula lo annuncia una volta e poi non
  // si rivede piu', era una frase di passaggio e non un secondo nome
  for (const [e] of [...reg.epiteti].sort((a, b) => b[1] - a[1])) {
    const capo = e.split(" ").find(utile);
    if (!capo || fuori.has(capo.toLowerCase())) continue;
    if ((reg.conta.get(capo) || 0) < 3) continue;
    scelti.push(e);
    fuori.add(capo.toLowerCase());
    if (scelti.length >= MAX_ALIAS) break;
  }
  return scelti;
}
