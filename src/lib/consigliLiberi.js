// I CONSIGLI DAL CATALOGO, SENZA ORACOLO (`Catalogo` in
// `components/DaPrendere.jsx`, `test/consigli-liberi.test.mjs`; chiesto
// dal lettore: «per il da prendere devi per forza usare l'oracolo? non
// riesci a capire da solo cosa potrei leggere, come fa il Kindle?»).
//
// Il Kindle ha una cosa che noi non avremo mai: quel che hanno comprato
// milioni di altri lettori. Open Library pero' sa tre cose che bastano a
// fare quasi tutto il lavoro, gratis e senza chiave: le OPERE di un autore
// con l'anno, la COLLANA scritta sulle edizioni (la stessa lettura del
// catalogo delle saghe, che dice anche il numero), e ARGOMENTI e VOTI dei
// suoi lettori. Due sezioni — le tue saghe e «potrebbero piacerti» — con
// la stessa forma delle voci dell'Oracolo, cosi' la pagina le mostra con lo
// stesso componente. LA TERZA, «DAGLI AUTORI CHE LEGGI», E' STATA TOLTA
// (chiesto dal lettore: «dal catalogo mettimi solo consigli su quello che
// potrebbe piacermi e togli la parte degli autori che leggo»): gli altri
// libri di un autore che segui li conosci gia', e dal catalogo si vogliono
// le scoperte. L'Oracolo la sua sezione degli autori la tiene; e i
// consigli-autore di un giro salvato prima non si mostrano piu'
// (`SEZIONI_CATALOGO`, letta da `daMostrare`).
//
// LE SAGHE NON SI CHIEDONO PER NOME, ed e' misurato: la ricerca
// `series:"…"` di Open Library conosce 3 volumi su 10 del Malazan e
// nessuno della Prima Legge, quindi «il primo dopo l'ultimo letto» su
// quell'elenco salterebbe dal primo al terzo volume come se il secondo non
// esistesse — la peggiore delle risposte, perche' sembra giusta. Si parte
// invece dalle opere dell'AUTORE (quelle ci sono tutte) e si chiede a
// ognuna, in ordine d'uscita, se sta nella tua saga: `cercaSaga` legge la
// collana sulle edizioni e dice anche il posto («Deadhouse Gates» →
// Malazan n° 2). Costa due richieste per opera, quindi si guardano solo
// quelle uscite DOPO l'ultimo volume che hai letto (`MAX_PROVE` al
// massimo) e ci si ferma a `PER_SAGA` trovati.
//
// E NON SI INDOVINA: se l'ultimo volume letto non si ritrova fra le opere
// dell'autore e nessun numero dice dove sei, la saga TACE — proporre da un
// punto a caso vorrebbe dire proporre il volume sbagliato, che in una saga
// e' uno spoiler servito dall'app.
//
// I «POTREBBERO PIACERTI» SONO IL REPARTO DEBOLE, ed e' dichiarato sulla
// pagina: sono i libri meglio votati sugli argomenti dei libri che hai
// amato — i piu' amati del tuo genere, non quelli scelti per te. Filtrati
// perche' non siano rumore: almeno `MIN_VOTI` voti (con cinque voti un
// 4,8 non dice niente), autori che non hai gia' in biblioteca (una
// scoperta e' un nome nuovo), niente volumi delle saghe che segui (quelli
// li propone la sezione delle saghe, al posto giusto), e un libro per autore, il piu' vecchio fra
// quelli trovati — di solito il primo di una serie, non il quinto.
//
// Il catalogo non riceve mai la biblioteca intera: una domanda per saga,
// una per libro amato, una per genere — titolo e autore, come per il retro
// del libro (PRIVACY.md).
import { getStatus } from "./library.js";
import { sembraGiaLetto, giaInCasa } from "./importBook.js";
import { idTitolo } from "./daPrendere.js";
import { chiaveSaga, chiaveAutore } from "./sagaBooks.js";
import { cercaSaga, scegliOpera } from "./sagaDalCatalogo.js";
import { autorePerIlCatalogo } from "./retroInRete.js";
import { pezziDalTitolo } from "./sagaDalTitolo.js";

const KEY = "bc_consigli_catalogo";
const OL = "https://openlibrary.org/search.json";

export const MAX_SAGHE = 8;
export const PER_SAGA = 3;
export const MAX_PROVE = 6;
export const MAX_AMATI = 6;
export const MAX_GUSTI = 8;
// Le sezioni che il catalogo mostra, nell'ordine: le chiavi di `SEZIONI`
// di `consigli.js` che qui hanno un senso.
export const SEZIONI_CATALOGO = ["saghe", "stile", "gusti"];
export const MAX_STILE = 4;
export const PER_STILE = 3;
export const CANDIDATI_STILE = 10;
export const ANNO_MIN = 1900;
export const MIN_VOTI = 30;
// Una settimana: il catalogo cambia piano, e ogni giro sono decine di
// richieste. Prima si rifa' solo col tasto.
export const SCADENZA = 7 * 24 * 60 * 60 * 1000;

// Cofanetti, raccolte, guide e compagni: non sono un libro da leggere
// dopo, e con un titolo del genere nella lista si torna a casa con tre
// romanzi che hai gia'.
const RACCOLTA =
  /\b(box(ed)?\s*set|set of|collection|omnibus|companion|anthology|books?\s*\d+\s*(-|–|to|&|and)\s*\d+|complete (series|saga|collection)|series set|\d+\s*books?\b|sampler|summary of|study guide|coloring|colouring|calendar)\b|\s\/\s/i;
export const eRaccolta = (titolo) => RACCOLTA.test(String(titolo || ""));

// Il titolo senza l'etichetta dell'editore: «The Great Hunt (The Wheel of
// Time Book 2)» e' «The Great Hunt», e con l'etichetta non combacerebbe
// mai col libro che hai gia'.
// Una parentesi in coda che dichiara di essere un'etichetta (un numero, o
// «book/series/saga…» dentro) se ne va anche quando la forma non e' una di
// quelle che `pezziDalTitolo` legge: «Reaper's Gale (Malazan Book of
// Fallen 7) (Malazan Book of the Fallen)» ne ha due, una dietro l'altra.
const ETICHETTA_IN_CODA = /\s*[([](?:[^)\]]*\d[^)\]]*|[^)\]]*\b(?:book|books|series|saga|vol|volume|cycle|chronicles?|trilogy|novel)\b[^)\]]*)[)\]]\s*$/i;
export function titoloDi(doc) {
  let t = String(doc?.title || "").trim();
  const resto = pezziDalTitolo(t)?.resto;
  if (resto && /\p{L}/u.test(resto)) t = String(resto).trim();
  for (let i = 0; i < 3; i++) {
    const via = t.replace(ETICHETTA_IN_CODA, "").trim();
    if (via === t || !/\p{L}/u.test(via)) break;
    t = via;
  }
  return t;
}

const lettoO = (s) => s === "read" || s === "reading";
const puliti = (books) => {
  const out = books.map((b) => ({ ...b, title: titoloDi(b) }));
  out.grezzi = books;
  return out;
};
// `casa` e' la biblioteca coi titoli ripuliti: si guarda li' a titoli
// uguali, e sui titoli COME SONO SCRITTI a parole intere (`giaInCasa`).
const tuo = (titolo, autore, casa) =>
  !!sembraGiaLetto({ title: titolo, author: autore }, casa) || giaInCasa({ title: titolo, author: autore }, casa.grezzi || casa);

// Il posto nella saga dice la stessa saga anche scritta un po' diversa:
// «Malazan» nella tua scheda, «The Malazan Book of the Fallen» sulle
// edizioni. A parole intere, o «Law» starebbe dentro «First Law».
export function stessaSaga(a, b) {
  const x = chiaveSaga(a);
  const y = chiaveSaga(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [corta, lunga] = x.length < y.length ? [x, y] : [y, x];
  return ` ${lunga} `.includes(` ${corta} `);
}

// ---- chi guardare -----------------------------------------------------------

// QUANTO TI E' PIACIUTO UN LIBRO, in un numero solo: e' la misura su cui
// si decide da CHI partire (quali saghe, quali generi). Il
// voto pesa piu' di tutto, il cuore quanto un voto pieno, un libro letto e
// basta un po'; un abbandono toglie. Chiesto dal lettore: «cerca in base ai
// miei autori, libri e saghe preferiti, cosi' sai gia' cosa prediligo».
export function pesoLibro(b, st) {
  let p = 0;
  if (b?.rating > 0) p += b.rating - 2.5;
  else if (st === "read") p += 1;
  if (b?.fav) p += 2.5;
  if (st === "abandoned") p -= 3;
  return p;
}

// Le saghe cominciate: almeno un volume letto o in lettura. L'autore e'
// quello che ne ha scritti di piu' — l'Eresia a venti mani si segue
// dall'autore del volume piu' avanti, ed e' un ripiego dichiarato.
//
// E L'ORDINE E' QUELLO DEI TUOI GUSTI, non dei volumi letti: con piu' di
// `MAX_SAGHE` saghe in corso il taglio decide quali si chiedono al
// catalogo, e contare i volumi farebbe vincere la saga lunga che trascini
// su quella che ami. Il gusto e' la somma di `pesoLibro` sui suoi volumi;
// a parita' decidono i volumi letti.
export function saghePartite(books = [], { statusOf = getStatus } = {}) {
  const per = new Map();
  for (const b of books) {
    const s = String(b?.saga || "").trim();
    if (!s || !b.title) continue;
    const k = chiaveSaga(s);
    if (!per.has(k)) per.set(k, { saga: s, libri: [] });
    per.get(k).libri.push({ b, st: statusOf(b.id) });
  }
  const out = [];
  for (const g of per.values()) {
    const letti = g.libri.filter((x) => lettoO(x.st));
    if (!letti.length) continue;
    const conti = new Map();
    for (const { b } of g.libri) {
      const a = autorePerIlCatalogo(b.author);
      if (a) conti.set(a, (conti.get(a) || 0) + 1);
    }
    const autore = [...conti].sort((x, y) => y[1] - x[1])[0]?.[0];
    if (!autore) continue;
    const ordini = letti.map((x) => Number(x.b.sagaOrder)).filter((n) => Number.isFinite(n));
    out.push({
      saga: g.saga,
      autore,
      letti: letti.map((x) => x.b),
      ordine: ordini.length ? Math.max(...ordini) : null,
      peso: letti.length,
      gusto: g.libri.reduce((t, x) => t + pesoLibro(x.b, x.st), 0),
      preferita: g.libri.some((x) => x.b.fav),
    });
  }
  return out
    .sort((a, b) => b.gusto - a.gusto || b.peso - a.peso || a.saga.localeCompare(b.saga))
    .slice(0, MAX_SAGHE);
}

// Quanto un libro amato pesa nella scelta dei GENERI: il cuore il doppio,
// e il mezzo punto sopra il quattro in piu'. Un cinque col cuore vale tre
// quattro senza — i generi devono essere quelli dei tuoi preferiti, non
// quelli dei libri che ti sono piaciuti in tanti.
export const pesoGusto = (b) => (b?.fav ? 2 : 1) + Math.max(0, (b?.rating || 0) - 4);

// I libri che dicono i tuoi gusti: preferiti e votati alti per primi.
export function libriAmati(books = [], { statusOf = getStatus } = {}) {
  const peso = (b) => (b.fav ? 10 : 0) + (b.rating || 0);
  return books
    .filter((b) => b?.title && (b.fav || b.rating >= 4))
    .filter((b) => statusOf(b.id) !== "abandoned")
    .sort((a, b) => peso(b) - peso(a))
    .slice(0, MAX_AMATI);
}

// ---- l'autore giusto ----------------------------------------------------------

// Il catalogo cerca l'autore per NOME, e i nomi hanno degli omonimi: fra
// le opere di «Glen Cook» c'era un manuale sull'allevamento dei maiali, e
// stava per finire fra i consigli di chi legge la Compagnia Nera (preso dal
// vivo, non immaginato). L'autore giusto e' quello che ha scritto i libri
// che HAI: la sua chiave vince, e le opere degli altri se ne vanno. Se
// nessun tuo libro si ritrova, vince la chiave piu' frequente.
export function soloDellAutore(docs = [], books = [], autore = "") {
  const casa = puliti(books.filter((b) => chiaveAutore(autorePerIlCatalogo(b.author)) === chiaveAutore(autore)));
  const voti = new Map();
  const tutti = new Map();
  for (const d of docs) {
    for (const k of d?.author_key || []) {
      tutti.set(k, (tutti.get(k) || 0) + 1);
      if (tuo(titoloDi(d), "", casa)) voti.set(k, (voti.get(k) || 0) + 1);
    }
  }
  const scegli = (m) => [...m].sort((a, b) => b[1] - a[1])[0]?.[0];
  const chiave = scegli(voti) || scegli(tutti);
  return chiave ? docs.filter((d) => (d.author_key || []).includes(chiave)) : docs;
}

// ---- la copertina ----------------------------------------------------------------

// Il catalogo la dice come un numero (`cover_i`), e l'immagine sta su un
// altro indirizzo. Si salva il NUMERO, non l'indirizzo: e' quel che il
// catalogo ha detto, e l'indirizzo si costruisce quando si disegna. Solo
// interi positivi: un id storto farebbe un'immagine rotta sulla voce.
export function copertinaDi(d) {
  const n = Number(d?.cover_i);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// IL TITOLO ITALIANO DELLA STESSA OPERA, quando il catalogo ce l'ha. Con
// `lang=it` Open Library mette in testa l'edizione italiana se esiste, ma
// se non esiste ne mette un'altra — misurato: «The Way of Kings» torna
// tedesco — quindi vale solo quella che dichiara l'italiano, e solo se il
// titolo e' davvero un altro. Misurato su otto opere note: l'italiano c'e'
// per due («Il nome del vento», «Il Grande Inverno»); per il resto resta
// `stessoPosto`, che la lingua non la guarda.
export function titoliTradotti(d) {
  const originale = idTitolo(titoloDi(d), "");
  const fuori = [];
  for (const e of d?.editions?.docs || []) {
    const lingue = Array.isArray(e?.language) ? e.language : [];
    const t = typeof e?.title === "string" ? e.title.trim() : "";
    if (!t || !lingue.includes("ita")) continue;
    if (idTitolo(t, "") === originale || fuori.includes(t)) continue;
    fuori.push(t);
  }
  return fuori;
}

export function urlCopertina(id, misura = "M") {
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? `https://covers.openlibrary.org/b/id/${n}-${misura}.jpg` : null;
}

// ---- le saghe -------------------------------------------------------------------

// Le opere dell'autore, dalla piu' vecchia: senza raccolte, una per titolo.
export function opereInOrdine(docs = []) {
  const viste = new Set();
  return docs
    .filter((d) => d?.title && !eRaccolta(d.title))
    .map((d) => ({ ...d, pulito: titoloDi(d) }))
    .sort((a, b) => (a.first_publish_year || 9999) - (b.first_publish_year || 9999))
    .filter((d) => {
      const k = idTitolo(d.pulito, "");
      if (viste.has(k)) return false;
      viste.add(k);
      return true;
    });
}

// Da dove si guarda: l'anno del piu' recente fra i tuoi volumi letti che si
// ritrova nelle opere. `null` = non ritrovato.
export function annoDiPartenza(saga, opere) {
  const casa = puliti(saga.letti);
  const anni = opere
    .filter((d) => d.first_publish_year && tuo(d.pulito, saga.autore, casa))
    .map((d) => d.first_publish_year);
  return anni.length ? Math.max(...anni) : null;
}

export async function prossimiDellaSaga(saga, opere, books, { sagaDi = cercaSaga } = {}) {
  const anno = annoDiPartenza(saga, opere);
  if (anno == null && saga.ordine == null) return { voci: [], membri: [] };
  const casa = puliti(books);
  const candidati = opere.filter(
    (d) => !tuo(d.pulito, saga.autore, casa) && (anno == null || (d.first_publish_year || 0) >= anno)
  );
  const membri = [];
  let prove = 0;
  for (const d of candidati) {
    if (membri.length >= PER_SAGA || prove >= MAX_PROVE) break;
    // la saga scritta nel titolo del catalogo si legge gratis
    const nelTitolo = pezziDalTitolo(d.title);
    let trovata = nelTitolo?.saga ? { saga: nelTitolo.saga, sagaOrder: nelTitolo.sagaOrder } : null;
    if (!trovata || !stessaSaga(trovata.saga, saga.saga)) {
      prove++;
      trovata = await sagaDi({ title: d.pulito, author: saga.autore });
    }
    if (!trovata?.saga || !stessaSaga(trovata.saga, saga.saga)) continue;
    const n = Number(trovata.sagaOrder);
    const numero = Number.isFinite(n) && n > 0 ? n : null;
    // dove i numeri ci sono tutt'e due, sono loro a dire se e' «dopo»
    if (numero != null && saga.ordine != null && numero <= saga.ordine) continue;
    membri.push({ d, numero });
  }
  const scelti = inFila(membri, saga.ordine);
  const ultimo = saga.letti.reduce(
    (m, b) => (m == null || (Number(b.sagaOrder) || 0) > (Number(m.sagaOrder) || 0) ? b : m),
    null
  );
  const voci = scelti.map(({ d, numero }) => ({
    id: idTitolo(d.pulito, saga.autore),
    titolo: d.pulito,
    autore: saga.autore,
    saga: saga.saga,
    numero,
    copertina: copertinaDi(d),
    altri: titoliTradotti(d),
    perche: ultimo ? `dopo «${titoloDi(ultimo)}», che hai letto${saga.preferita ? " · fra le tue saghe preferite" : ""}` : "",
  }));
  return { voci, membri: membri.map((m) => m.d) };
}

// UN BUCO NELLA FILA E' UN VOLUME SALTATO, E SI TACE DA LI' IN POI.
// Misurato dal vivo sulla Ruota del Tempo: le edizioni del terzo volume
// non dicevano la collana, e la proposta usciva «n° 2, n° 4, n° 5» — cioe'
// ti mandava in libreria a comprare il quarto senza il terzo. Dove i
// numeri ci sono comandano loro, si parte dal primo dopo il tuo e ci si
// ferma al primo che manca; una novella a mezzo numero (2,5) sta in fila.
// I volumi senza numero valgono solo dove nessuno ne ha uno: mescolati
// agli altri non si saprebbe dove metterli («The Alloy of Law» e' Mistborn
// ma di un'altra era, e dopo il secondo volume non ci va).
export function inFila(membri = [], ordine = null) {
  const numerati = membri.filter((m) => m.numero != null).sort((a, b) => a.numero - b.numero);
  if (!numerati.length) return membri.slice(0, PER_SAGA);
  let atteso = ordine != null ? Math.floor(ordine) + 1 : null;
  const out = [];
  for (const m of numerati) {
    if (atteso != null && m.numero > atteso) break;
    out.push(m);
    if (Number.isInteger(m.numero)) atteso = m.numero + 1;
    else if (atteso == null) atteso = Math.ceil(m.numero);
    if (out.length >= PER_SAGA) break;
  }
  return out;
}

// ---- i seguiti ------------------------------------------------------------------

// UN SEGUITO NON E' UNA SCOPERTA. «House of Chains» e' il quarto Malazan e
// «The Blood of Olympus» il quinto di un ciclo: proposti da soli dicono
// «comincia da qui» su un libro che comincia a meta' di una storia. Il
// titolo spesso non lo dice, le edizioni si': si chiede al catalogo e si
// tiene solo chi non sta in una saga, chi e' il primo della sua, o chi
// non si e' lasciato leggere (il catalogo non ha tutto, e tacere su un
// buon libro per un'edizione muta sarebbe peggio). Resta fuori anche il
// volume di una saga che stai gia' seguendo: quello e' mestiere della
// sezione delle saghe, che lo propone nel posto giusto. Ogni domanda sono
// due giri di rete, quindi ci si ferma a `max` tenuti o `prove` fatte.
export async function primiDiSerie(voci = [], { sagaDi = cercaSaga, saghe = [], max = MAX_GUSTI, prove = 4 } = {}) {
  const out = [];
  let fatte = 0;
  for (const v of voci) {
    if (out.length >= max || fatte >= prove) break;
    fatte++;
    let trovata = null;
    try {
      trovata = await sagaDi({ title: v.titolo, author: v.autore });
    } catch {
      trovata = null;
    }
    if (trovata?.saga) {
      // la TUA saga a lettere uguali: «World of the First Law» contiene
      // «First Law» ed e' un'altra serie, e «Best Served Cold» e' il suo primo
      if (saghe.some((s) => chiaveSaga(s) === chiaveSaga(trovata.saga))) continue;
      const n = Number(trovata.sagaOrder);
      if (Number.isFinite(n) && n > 1) continue;
    }
    out.push(v);
  }
  return out;
}

// ---- lo stile dei tuoi autori ------------------------------------------------------

// NELLO STILE DEI TUOI AUTORI (chiesto dal lettore: «suggeriscimi anche
// altri libri, non per forza delle mie saghe, basta che siano inerenti ai
// generi che mi piacciono o allo stile dei miei autori preferiti»).
//
// Il catalogo non sa cosa sia uno stile, ma per ogni AUTORE sa gli
// argomenti che tornano nei suoi libri (`top_subjects`): Abercrombie porta
// «Kings and rulers», Pratchett «Fiction, humorous», Lynch «Swindlers and
// swindling». Da li' si chiedono i libri piu' letti che portano il GENERE
// dell'autore E uno dei suoi argomenti distintivi — due condizioni insieme,
// mai una (`domandeStile`) — e di chi li ha scritto si controlla solo che
// scriva nello stesso genere. Misurato dal vivo: dietro Lynch Skovron e
// Asprin, dietro Pratchett Adams e Klune, dietro Abercrombie Martin e
// Sanderson. Con una condizione sola uscivano Dostoevskij e Dorian Gray, e
// confrontando le impronte intere degli autori si perdeva Skovron. Il
// catalogo misura gli argomenti e non la scrittura, e la pagina lo dice.

// Via cio' che non distingue un autore da un altro, e cio' che e' di UNA
// sua saga: «Discworld (Imaginary place)» direbbe che somiglia a Pratchett
// solo chi scrive del Mondo Disco.
const NON_IMPRONTA = /^series:|imaginary place|fictitious character|^english|^american|^literature$|^fiction, general$/i;

export function improntaDi(argomenti = []) {
  const out = [];
  const visti = new Set();
  for (const a of argomenti || []) {
    const nome = String(a || "").trim();
    // «FICTION / Fantasy / Epic» e «Fiction, fantasy, epic» sono la stessa
    // voce scritta da due cataloghi diversi
    const k = nome.toLowerCase().replace(/\s*\/\s*/g, ", ");
    if (!nome || GENERICI.test(nome) || NON_IMPRONTA.test(k) || visti.has(k)) continue;
    visti.add(k);
    out.push({ nome, k });
  }
  return out;
}

// IL GENERE e' la famiglia, e da solo non distingue niente: «Fantasy» e'
// mezzo catalogo. Si riconosce su tutti gli argomenti dell'autore, anche su
// quelli generici («Fiction, fantasy, general» dice fantasy e basta).
const FAMIGLIE = ["fantasy", "science fiction", "horror", "humorous", "mystery", "detective", "thrillers", "historical", "romance"];
const FAMIGLIA_RE = new RegExp(`\\b(${FAMIGLIE.join("|")})\\b`, "gi");
const RUMORE_GENERE = /\b(fiction|general|and|&)\b|[,/]/gi;

export function famiglieDi(argomenti = []) {
  const conti = new Map();
  for (const a of argomenti || []) {
    for (const m of String(a || "").toLowerCase().matchAll(FAMIGLIA_RE)) conti.set(m[1], (conti.get(m[1]) || 0) + 1);
  }
  return [...conti].sort((a, b) => b[1] - a[1]).map(([f]) => f);
}

// Un argomento DISTINTIVO dice qualcosa oltre al genere: tolti «fiction»,
// il genere e la punteggiatura, resta una parola («epic», «Kings and
// rulers», «Swindlers and swindling»). «Fantasy fiction» non lascia niente.
export const distintivo = (x) => !!String(x?.k || x || "").toLowerCase().replace(FAMIGLIA_RE, " ").replace(RUMORE_GENERE, " ").trim();

// Le domande al catalogo per un autore: SEMPRE due condizioni insieme, mai
// una sola — con una sola i piu' letti erano Dostoevskij e Dorian Gray
// (misurato). Prima il genere con ognuno dei due argomenti distintivi piu'
// frequenti, POI i due generi insieme se sono due: per Pratchett, che
// distintivi non ne ha, fantasy E umoristico e' proprio la sua nicchia;
// per Bakker fantasy E fantascienza sono Dune e Dracula, quindi in coda.
// Ogni domanda si porta il suo PERCHE', che e' quel che la voce dira'.
export function domandeStile(impronta = [], famiglie = []) {
  const q = (x) => `subject:"${String(x).replace(/"/g, "")}"`;
  const out = [];
  const dist = impronta.filter(distintivo).slice(0, 2);
  if (famiglie.length) for (const d of dist) out.push({ q: `${q(famiglie[0])} AND ${q(d.nome)}`, perche: [famiglie[0], d.nome] });
  else if (dist.length >= 2) out.push({ q: `${q(dist[0].nome)} AND ${q(dist[1].nome)}`, perche: [dist[0].nome, dist[1].nome] });
  if (famiglie.length >= 2) out.push({ q: `${q(famiglie[0])} AND ${q(famiglie[1])}`, perche: [famiglie[0], famiglie[1]] });
  return out;
}

// I tuoi autori, ordinati per quanto ti piacciono: la somma di `pesoLibro`
// sui loro libri. Chi non ha niente di positivo (solo libri mai aperti o
// abbandonati) non e' un autore preferito.
export function autoriPreferiti(books = [], { statusOf = getStatus, max = MAX_STILE } = {}) {
  const per = new Map();
  for (const b of books) {
    const autore = autorePerIlCatalogo(b?.author);
    const k = chiaveAutore(autore);
    if (!k || !b.title) continue;
    const g = per.get(k) || { autore, gusto: 0, preferito: false };
    g.gusto += pesoLibro(b, statusOf(b.id));
    if (b.fav) g.preferito = true;
    per.set(k, g);
  }
  return [...per.values()]
    .filter((g) => g.gusto > 0)
    .sort((a, b) => b.gusto - a.gusto || a.autore.localeCompare(b.autore))
    .slice(0, max);
}

// L'autore giusto fra gli omonimi: stesso nome, e fra quelli chi ha scritto
// di piu' (il «Glen Cook» con un libro solo e' un altro).
export function autoreDelCatalogo(docs = [], nome = "") {
  const k = chiaveAutore(nome);
  return (
    (docs || [])
      .filter((d) => d?.name && chiaveAutore(d.name) === k)
      .sort((a, b) => (b.work_count || 0) - (a.work_count || 0))[0] || null
  );
}

// Dai libri che il catalogo propone sull'impronta, gli autori da mettere a
// confronto: nell'ordine in cui arrivano (i piu' letti per primi), uno per
// autore, senza chi hai gia' in casa e senza i libri per ragazzi. Per
// ognuno si tiene il libro piu' vecchio fra quelli trovati — di solito il
// primo, non il quinto di una serie.
export function candidatiStile(docs = [], books = [], { escludi = new Set(), max = CANDIDATI_STILE } = {}) {
  const casa = puliti(books);
  const autoriCasa = new Set(books.map((b) => chiaveAutore(autorePerIlCatalogo(b.author))).filter(Boolean));
  const per = new Map();
  for (const d of docs || []) {
    const autore = d?.author_name?.[0];
    if (!d?.title || !autore || eRaccolta(d.title)) continue;
    const ka = chiaveAutore(autore);
    if (!ka || autoriCasa.has(ka) || escludi.has(ka)) continue;
    if ((d.subject || []).some((x) => PER_RAGAZZI.test(x))) continue;
    const n = Number(pezziDalTitolo(d.title)?.sagaOrder);
    if (Number.isFinite(n) && n > 1) continue;
    // un classico dell'Ottocento non e' «nello stile» di nessuno dei tuoi:
    // Moby Dick porta «Fiction, fantasy, epic» nel catalogo (misurato)
    if (d.first_publish_year && d.first_publish_year < ANNO_MIN) continue;
    const titolo = titoloDi(d);
    if (tuo(titolo, autore, casa)) continue;
    if (!per.has(ka)) {
      if (per.size >= max) continue;
      per.set(ka, { autore, libro: { ...d, titolo }, perche: d.perche || [] });
    } else if ((d.first_publish_year || 9999) < (per.get(ka).libro.first_publish_year || 9999)) {
      per.get(ka).libro = { ...d, titolo };
    }
  }
  return [...per.values()];
}

export function vocePerStile(c, di) {
  const cosa = (c.perche || []).map((x) => String(x).toLowerCase()).join(" e ");
  return {
    id: idTitolo(c.libro.titolo, c.autore),
    titolo: c.libro.titolo,
    autore: c.autore,
    saga: "",
    numero: null,
    copertina: copertinaDi(c.libro),
    perche: cosa ? `Se ti piace ${di} · ${cosa}` : `Se ti piace ${di}`,
  };
}

// ---- i gusti ---------------------------------------------------------------------

// Argomenti che dicono tutto e quindi niente, o che non sono argomenti.
const GENERICI =
  /^(.*,\s*general|fiction|fiction,? general|general|novel|novels|literature|english literature|american literature|large type books|accessible book|protected daisy|in library|lending library|open library staff picks|reading level.*|nyt:.*|new york times.*|bestseller.*|textual|translations.*|juvenile.*|english fiction|american fiction)$/i;

// I tre argomenti piu' pesanti fra i libri amati, contati una volta per
// libro: un libro con venti argomenti non deve votare venti volte lo stesso.
// Ogni libro vota col suo PESO (`pesoGusto`, un elenco nudo vale uno), e
// l'argomento si ricorda da quali libri e' venuto, il piu' amato per primo:
// e' quel titolo che il perche' della scoperta nomina.
export function argomentiPesati(elenchi = [], quanti = 3) {
  const conti = new Map();
  for (const voce of elenchi) {
    const argomenti = Array.isArray(voce) ? voce : voce?.argomenti;
    const peso = Array.isArray(voce) ? 1 : Number(voce?.peso) > 0 ? Number(voce.peso) : 1;
    const titolo = Array.isArray(voce) ? "" : voce?.titolo || "";
    const visti = new Set();
    for (const a of argomenti || []) {
      const s = String(a || "").trim();
      const k = s.toLowerCase();
      if (!s || GENERICI.test(s) || visti.has(k)) continue;
      visti.add(k);
      const c = conti.get(k) || { nome: s, peso: 0, fonti: [] };
      c.peso += peso;
      if (titolo) c.fonti.push({ titolo, peso });
      conti.set(k, c);
    }
  }
  return [...conti.values()]
    .sort((a, b) => b.peso - a.peso || a.nome.localeCompare(b.nome))
    .slice(0, quanti)
    .map((c) => ({ nome: c.nome, peso: c.peso, fonti: c.fonti.sort((x, y) => y.peso - x.peso).map((f) => f.titolo) }));
}
export const argomentiComuni = (elenchi = [], quanti = 3) => argomentiPesati(elenchi, quanti).map((c) => c.nome);

// Ordinati per voto, i primi della lista sono libri per ragazzi e fumetti:
// hanno lettori entusiasti e tanti voti, e a chi legge Erikson non dicono
// niente. Il catalogo li marca negli argomenti — ma gli argomenti sono
// scritti da tanti, e «The Name of the Wind» porta «Adult books for young
// adults» e «Homeless children»: una parola cercata DENTRO l'argomento lo
// buttava fuori (misurato). Si riconosce solo l'etichetta intera.
const PER_RAGAZZI =
  /^(.*,\s*)?juvenile (fiction|literature)$|^children'?s (fiction|stories|literature|books)|^comic books|^comics\b|^graphic novels?\b|^young adult fiction|^picture books/i;

const voto = (r) => Math.round(r * 10) / 10;

// UN ARGOMENTO SOLO NON E' UN GUSTO: «epic» e' Malazan e anche «Les
// Misérables», «Fantasy» e' Erikson e anche «The Raven» di Poe — tutt'e due
// usciti dal vivo. Dove gli argomenti sono piu' d'uno si vuole un libro che
// ne porti almeno DUE, contati sui suoi argomenti e non sulla domanda che
// l'ha trovato (lo stesso libro risponde a una domanda sola e ne porta tre).
//
// E I GENERI DEI PREFERITI CONTANO DI PIU': un risultato porta il `peso`
// del suo argomento, e un candidato che tocca l'argomento dei tuoi libri
// col cuore sale sopra uno che tocca quello di un quattro stelle. Con i
// pesi tutti uguali il conto torna quello di prima. Il perche' nomina il
// libro amato da cui quel genere e' venuto («come «Gardens of the Moon»»),
// che e' la ragione vera del consiglio.
export function daGusti(risultati = [], books = []) {
  const casa = puliti(books);
  const scelti0 = risultati.map((r) => r.argomento);
  const pesi = new Map(risultati.map((r) => [r.argomento, Number(r.peso) > 0 ? Number(r.peso) : 1]));
  const fonti = new Map(risultati.map((r) => [r.argomento, r.fonti || []]));
  const pesoMax = Math.max(1, ...pesi.values());
  const serve = scelti0.length >= 2 ? 2 : 1;
  const autoriCasa = new Set(books.map((b) => chiaveAutore(autorePerIlCatalogo(b.author))).filter(Boolean));
  const perAutore = new Map();
  for (const { argomento, docs } of risultati) {
    for (const d of docs || []) {
      const autore = d?.author_name?.[0];
      if (!d?.title || !autore || eRaccolta(d.title)) continue;
      if ((d.ratings_count || 0) < MIN_VOTI) continue;
      if ((d.subject || []).some((x) => PER_RAGAZZI.test(x))) continue;
      const ka = chiaveAutore(autore);
      if (autoriCasa.has(ka)) continue;
      const n = Number(pezziDalTitolo(d.title)?.sagaOrder);
      if (Number.isFinite(n) && n > 1) continue;
      const suoi = new Set((d.subject || []).map((x) => String(x).toLowerCase()));
      const colpiti = scelti0.filter((a) => a === argomento || suoi.has(a.toLowerCase()));
      if (colpiti.length < serve) continue;
      const titolo = titoloDi(d);
      if (tuo(titolo, autore, casa)) continue;
      const g = perAutore.get(ka) || { autore, libri: new Map(), argomenti: new Set() };
      for (const a of colpiti) g.argomenti.add(a);
      const kt = idTitolo(titolo, "");
      if (!g.libri.has(kt)) g.libri.set(kt, { ...d, titolo });
      perAutore.set(ka, g);
    }
  }
  const scelti = [...perAutore.values()].map((g) => {
    const libri = [...g.libri.values()];
    const primo = libri.sort((a, b) => (a.first_publish_year || 9999) - (b.first_publish_year || 9999))[0];
    const media = Math.max(...libri.map((l) => l.ratings_average || 0));
    const colpo = [...g.argomenti].reduce((t, a) => t + pesi.get(a) / pesoMax, 0);
    // la fonte del genere piu' pesante fra quelli toccati
    const via = [...g.argomenti].sort((a, b) => pesi.get(b) - pesi.get(a)).map((a) => fonti.get(a)?.[0]).find(Boolean);
    return { g, primo, via, punti: media + 0.3 * (colpo - 1) };
  });
  return scelti
    .sort((a, b) => b.punti - a.punti || a.g.autore.localeCompare(b.g.autore))
    .slice(0, MAX_GUSTI * 2)
    .map(({ g, primo, via }) => ({
      id: idTitolo(primo.titolo, g.autore),
      titolo: primo.titolo,
      autore: g.autore,
      saga: "",
      numero: null,
      copertina: copertinaDi(primo),
      perche: `★ ${String(voto(primo.ratings_average || 0)).replace(".", ",")} su Open Library · ${[...g.argomenti].join(", ")}${via ? ` · come «${via}»` : ""}`,
    }));
}

// ---- il giro ---------------------------------------------------------------------

// Quattro alla volta, e i risultati nell'ordine degli ingressi: uno per
// volta il giro durava quaranta secondi davanti a una pagina ferma.
export async function aGruppi(voci = [], fn, insieme = 4) {
  const out = new Array(voci.length);
  let prossima = 0;
  const lavora = async () => {
    while (prossima < voci.length) {
      const i = prossima++;
      out[i] = await fn(voci[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(insieme, voci.length) }, lavora));
  return out;
}

const AUTORI = "https://openlibrary.org/search/authors.json";

async function leggi(f, params, dove = OL) {
  const r = await f(`${dove}?${new URLSearchParams(params)}`);
  if (!r?.ok) throw new Error(`catalogo ${r?.status || "?"}`);
  const j = await r.json();
  return j?.docs || [];
}

// Il giro intero. Ogni domanda nel suo `try`: un buco di rete costa quella
// domanda, non le altre; se non ne e' arrivata NESSUNA la risposta e'
// «rete», che non e' «nessun consiglio».
export async function consigliDalCatalogo(books = [], { fetcher, sagaDi, statusOf = getStatus, onFase } = {}) {
  const f = fetcher || fetch;
  const cerca = sagaDi || ((q) => cercaSaga(q, f));
  let riuscite = 0;
  let mancate = 0;
  const prova = async (fn) => {
    try {
      const r = await fn();
      riuscite++;
      return r;
    } catch {
      mancate++;
      return null;
    }
  };
  // la promessa, non il risultato: due saghe dello stesso autore in
  // parallelo farebbero la stessa domanda due volte
  const opere = new Map();
  const opereDi = async (autore) => {
    const k = chiaveAutore(autore);
    if (!opere.has(k))
      opere.set(
        k,
        prova(() =>
          leggi(f, {
            author: autore,
            sort: "editions",
            limit: "100",
            fields: "key,title,author_name,author_key,first_publish_year,edition_count,cover_i,editions,editions.title,editions.language",
            // l'edizione che il catalogo mette in testa a ogni opera: con
            // `lang` preferisce quella italiana, e il suo titolo serve a
            // riconoscere il volume che hai in casa tradotto
            lang: "it",
          })
        )
      );
    return soloDellAutore((await opere.get(k)) || [], books, autore);
  };
  const avanti = (passo, n) => {
    let fatte = 0;
    onFase?.(passo, 0, n);
    return () => onFase?.(passo, ++fatte, n);
  };

  const saghe = saghePartite(books, { statusOf });
  const consigli = { saghe: [], stile: [], gusti: [] };
  let tick = avanti("saghe", saghe.length);
  const perSaga = await aGruppi(saghe, async (s) => {
    const docs = await opereDi(s.autore);
    // qui le domande sono quelle della collana: una che esplode costa la
    // saga, e non conta come risposta del catalogo
    let r = null;
    try {
      r = await prossimiDellaSaga(s, opereInOrdine(docs), books, { sagaDi: cerca });
    } catch {
      r = null;
    }
    tick();
    return r;
  });
  for (const r of perSaga) consigli.saghe.push(...(r?.voci || []));

  // LO STILE: per ogni autore preferito, la sua impronta, i libri piu'
  // letti che ne toccano gli argomenti, e il confronto con l'impronta di chi
  // li ha scritti. Le impronte si chiedono una volta per autore anche se
  // tornano in piu' confronti.
  const preferiti = autoriPreferiti(books, { statusOf });
  const impronte = new Map();
  const improntaAutore = (nome) => {
    const k = chiaveAutore(nome);
    if (!impronte.has(k))
      impronte.set(
        k,
        prova(() => leggi(f, { q: nome, limit: "5" }, AUTORI)).then((docs) => {
          const tutti = autoreDelCatalogo(docs || [], nome)?.top_subjects || [];
          return docs ? { impronta: improntaDi(tutti), famiglie: famiglieDi(tutti) } : null;
        })
      );
    return impronte.get(k);
  };
  tick = avanti("stile", preferiti.length);
  const giaStile = new Set(preferiti.map((p) => chiaveAutore(p.autore)));
  const perStile = await aGruppi(
    preferiti,
    async (p) => {
      const { impronta: mia, famiglie } = (await improntaAutore(p.autore)) || { impronta: [], famiglie: [] };
      const domande = domandeStile(mia, famiglie);
      if (!domande.length) {
        tick();
        return [];
      }
      const risposte = await Promise.all(
        domande.map((d) =>
          prova(() => leggi(f, { q: d.q, sort: "readinglog", limit: "40", fields: "title,author_name,first_publish_year,subject,cover_i" }))
        )
      );
      // NELL'ORDINE DELLE DOMANDE, non a turno: la prima e' la piu'
      // precisa, e un argomento arrivato da un omonimo dell'autore
      // («Hiking» sotto Scott Lynch) sta in fondo e non si prende i posti
      const docs = risposte.flatMap((r, i) => (r || []).map((d) => ({ ...d, perche: domande[i].perche })));
      const trovati = [];
      for (const c of candidatiStile(docs, books, { escludi: giaStile })) {
        if (trovati.length >= PER_STILE) break;
        // il libro risponde gia' a due condizioni; all'autore si chiede
        // solo di scrivere nello stesso genere — confrontare le impronte
        // intere scartava Skovron dopo Lynch, che e' la proposta giusta
        const sue = (await improntaAutore(c.autore))?.famiglie || [];
        if (sue.some((x) => famiglie.includes(x))) trovati.push(vocePerStile(c, p.autore));
      }
      tick();
      return trovati;
    },
    2
  );
  // uno per autore anche fra due preferiti diversi: vince il preferito piu'
  // amato, che sta prima
  const autoriStile = new Set();
  const stile = [];
  for (const v of perStile.flat()) {
    const ka = chiaveAutore(v.autore);
    if (autoriStile.has(ka)) continue;
    autoriStile.add(ka);
    stile.push(v);
  }
  // e i seguiti se ne vanno come fra i gusti: di Adams il catalogo dava
  // «Life, the Universe and Everything», che e' il terzo (preso dal vivo)
  consigli.stile = await primiDiSerie(stile, { sagaDi: cerca, saghe: saghe.map((s) => s.saga), max: MAX_STILE * PER_STILE, prove: stile.length });

  const amati = libriAmati(books, { statusOf });
  tick = avanti("gusti", amati.length);
  const elenchi = await aGruppi(amati, async (b) => {
    const a = autorePerIlCatalogo(b.author);
    const docs = await prova(() =>
      leggi(f, { title: titoloDi(b), ...(a ? { author: a } : {}), fields: "key,title,author_name,subject", limit: "5" })
    );
    tick();
    const argomenti = scegliOpera(docs || [], { title: titoloDi(b), author: b.author, filtrata: !!a })?.subject;
    return argomenti ? { argomenti, peso: pesoGusto(b), titolo: titoloDi(b) } : null;
  });
  const risultati = (
    await aGruppi(argomentiPesati(elenchi.filter(Boolean)), async ({ nome: argomento, peso, fonti }) => {
      const docs = await prova(() =>
        leggi(f, {
          q: `subject:"${argomento.replace(/"/g, "")}"`,
          sort: "rating",
          limit: "50",
          fields: "title,author_name,first_publish_year,ratings_average,ratings_count,subject,cover_i",
        })
      );
      return docs ? { argomento, peso, fonti, docs } : null;
    })
  ).filter(Boolean);
  onFase?.("scoperte");
  // un autore gia' proposto per lo stile non si ripropone fra i gusti: e'
  // la stessa scoperta, e il perche' dello stile e' il piu' preciso dei due
  consigli.gusti = await primiDiSerie(daGusti(risultati, books).filter((v) => !autoriStile.has(chiaveAutore(v.autore))), {
    sagaDi: cerca,
    saghe: saghe.map((s) => s.saga),
    max: MAX_GUSTI,
    prove: MAX_GUSTI * 2,
  });

  if (!riuscite && mancate) return { error: "rete" };
  return { consigli, quando: Date.now(), mancate };
}

export const scaduti = (giro, ora = Date.now()) => !giro?.quando || ora - giro.quando > SCADENZA;

export function leggiConsigliLiberi() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    return v && v.consigli ? v : null;
  } catch {
    return null;
  }
}

export function scriviConsigliLiberi(giro) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ consigli: giro.consigli, quando: giro.quando, mancate: giro.mancate || 0 }));
  } catch {
    /* storage pieno: restano fino alla chiusura */
  }
}
