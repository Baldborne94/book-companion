// LA SAGA DAL CATALOGO, quando nessun'altra strada la sa.
//
// Chiesto dal lettore: «perche' non hai riconosciuto la saga di Cook,
// Ruocchio e Lynch?». Nei loro titoli la saga non c'e' scritta («Empire of
// Silence», «Shadows Linger»), la tavola non li conosce, il file la collana
// non ce l'aveva, e la deduzione ha bisogno di un fratello che la saga ce
// l'abbia gia'. Quattro strade, tutte mute. Ma Open Library la sa: sulle
// EDIZIONI di un'opera chi cataloga scrive la collana — «The Black Company»
// su dodici edizioni su sedici, «The Sun Eater» su Ruocchio.
//
// QUI IL TITOLO ESCE DAL DISPOSITIVO, ed e' la stessa eccezione dichiarata
// per la quarta di copertina: la regola «i titoli non escono mai» riguarda
// il MODELLO, che riconoscerebbe il libro e risponderebbe a memoria — non
// un catalogo bibliografico. Google Books non serve: la collana non la
// espone, e la sua quota giornaliera e' gia' finita una volta.
//
// LA PARTE CHE SBAGLIA IN SILENZIO E' IL VOTO. Le edizioni portano di
// tutto: «Wheel of Time (1)», «Wheel of time -- bk.1», «A Roda do Tempo»,
// «Blanvalet -- 24292», «A Tom Doherty Associates book», «Daw book
// collectors -- no. 1792», «Fantasy». Una collana dell'EDITORE presa per
// saga mette il libro in una storia che non esiste. Quindi: ogni stringa
// si riduce a un nome piu' un numero, il rumore si scarta per forma, le
// grafie si contano insieme, e vince chi ha almeno DUE voti. Una collana
// vista da una sola edizione non si prende: e' il caso di «Howling Dark»
// (un voto) — e li' ci pensa la deduzione, perche' «Empire of Silence» i
// due voti ce li ha e i fratelli la ereditano.
import { varianti, autorePerIlCatalogo } from "./retroInRete.js";
import { chiaveSaga } from "./sagaBooks.js";
import { sagaDalTitolo } from "./sagaDalTitolo.js";

export const MIN_VOTI = 2;
const EDIZIONI = 50;

// la collana dell'editore si riconosce dalla forma: un nome di casa
// editrice, un numero di catalogo a quattro cifre, un intervallo di
// pagine, una parola sola che e' un genere
const RUMORE =
  /\b(collectors?|associates|heyne|blanvalet|penguin|pocket|presses?|spectra|bantam|gollancz|orbit|voyager|harper|mondadori|oscar|urania|classici|classics|cl[aá]sicos|editions?|éditions|verlag|reihe|taschenbuch|allgemeine|band|bd\.?|paperbacks?|library|omnibus)\b/i;
const GENERE = /^(fantasy|science fiction|sf|fiction|romans?|novels?|paperback|hardcover)$/i;
const PAROLE = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, uno: 1, due: 2, tre: 3, quattro: 4, cinque: 5 };

const numeroDa = (s) => {
  const t = String(s || "").toLowerCase();
  if (PAROLE[t] != null) return PAROLE[t];
  const n = parseFloat(t.replace(",", "."));
  return Number.isFinite(n) && n > 0 && n < 200 ? n : null;
};

// Una stringa di collana → { saga, n } o null. Il numero sta in coda in
// una delle forme che i catalogatori usano davvero: «(1)», «#1», «-- bk.1»,
// «. Book 1», «: Book 1», «, 1», «-- Book one».
const CODE = [
  /\s*\(\s*#?\s*(\d{1,3})\s*\)\s*$/,
  /\s*#\s*(\d{1,3}(?:\.\d)?)\s*$/,
  /\s*--\s*(?:bk\.?|book|vol\.?|volume|no\.?|n\.?)?\s*(\d{1,3}(?:\.\d)?|one|two|three|four|five|six|seven|eight|nine|ten)\s*\.?\s*$/i,
  /[\s.:,;]+(?:bk\.?|book|vol\.?|volume|libro|tome)\s*(\d{1,3}(?:\.\d)?|one|two|three|four|five|six|seven|eight|nine|ten|uno|due|tre|quattro|cinque)\s*\.?\s*$/i,
  /,\s*(\d{1,3})\s*$/,
];

export function candidato(stringa) {
  let s = String(stringa || "").replace(/\s+/g, " ").trim();
  if (!s) return null;
  let n = null;
  for (const re of CODE) {
    const m = re.exec(s);
    if (m) {
      n = numeroDa(m[1]);
      s = s.slice(0, m.index);
      break;
    }
  }
  s = s.replace(/[\s\-–—;:,.]+$/, "").trim();
  if (s.length < 3 || s.length > 60) return null;
  if (!/[a-z]/i.test(s)) return null;
  // un numero a quattro cifre e' un catalogo, un intervallo sono pagine
  if (/\d{4}/.test(s) || /\d+\s*-\s*\d+/.test(s)) return null;
  if (RUMORE.test(s) || GENERE.test(s)) return null;
  if (/^(a|an|the)\s.*\bbook$/i.test(s)) return null;
  return { saga: s[0].toUpperCase() + s.slice(1), n };
}

// spezza «The First Law #1, First Law World #1» e «A; B» in piu' voci —
// ma «The Goblin Emperor, #1» e' UNA voce: la virgola divide solo se quel
// che le sta prima ha gia' il suo «#N» (preso dal vivo: il numero restava
// da solo e si perdeva)
function spezza(s) {
  const fuori = [];
  for (const pezzo of String(s || "").split(";")) {
    for (const parte of pezzo.split(",")) {
      const prima = fuori[fuori.length - 1];
      if (prima != null && !/#\s*\d/.test(prima)) fuori[fuori.length - 1] = `${prima},${parte}`;
      else fuori.push(parte);
    }
  }
  return fuori;
}

// Le edizioni di un'opera → la saga piu' votata, col numero piu' votato
// fra chi l'ha votata. `null` se nessuna arriva a `MIN_VOTI`.
//
// E VOTANO ANCHE I TITOLI DELLE OPERE del catalogo (`titoli`): su Lynch le
// edizioni portano solo l'editore, ma l'opera si chiama «Red Seas Under
// Red Skies (Gentlemen Bastards #2)» — la saga sta nel titolo, nella forma
// che `sagaDalTitolo` legge gia'. E un titolo d'opera cosi' VALE DA SOLO
// (`MIN_VOTI` voti): e' lo stesso segnale che si accetta da solo sul
// titolo del lettore, e dal vivo Lynch ne ha una scheda sola — con un voto
// per titolo restava fuori lo stesso.
export function sagaDalleEdizioni(edizioni = [], titoli = []) {
  const voti = new Map();
  const vota = (c, peso = 1) => {
    const k = chiaveSaga(c.saga);
    if (!k) return;
    if (!voti.has(k)) voti.set(k, { voti: 0, grafie: new Map(), numeri: new Map() });
    const v = voti.get(k);
    v.voti += peso;
    v.grafie.set(c.saga, (v.grafie.get(c.saga) || 0) + peso);
    if (c.n != null) v.numeri.set(c.n, (v.numeri.get(c.n) || 0) + peso);
  };
  for (const e of edizioni) {
    for (const grezza of e?.series || []) {
      for (const pezzo of spezza(grezza)) {
        const c = candidato(pezzo);
        if (c) vota(c);
      }
    }
  }
  for (const titolo of titoli) {
    const letto = sagaDalTitolo({ title: titolo });
    if (letto?.saga) vota({ saga: letto.saga, n: letto.sagaOrder }, MIN_VOTI);
  }
  const piu = (m) => [...m.entries()].sort((a, b) => b[1] - a[1] || String(b[0]).length - String(a[0]).length || String(a[0]).localeCompare(String(b[0])))[0]?.[0];
  const vincente = [...voti.values()].sort(
    (a, b) => b.voti - a.voti || b.numeri.size - a.numeri.size || piu(b.grafie).length - piu(a.grafie).length
  )[0];
  if (!vincente || vincente.voti < MIN_VOTI) return null;
  const n = piu(vincente.numeri);
  // fra le grafie della stessa saga vince quella con piu' maiuscole: «The
  // first law. Book 1» e' la convenzione dei catalogatori (sei voti), «The
  // First Law» e' il nome — e sul ripiano ci va il nome
  const maiuscole = (s) => (s.match(/\p{Lu}/gu) || []).length;
  const grafia = [...vincente.grafie.entries()].sort(
    (a, b) => maiuscole(b[0]) - maiuscole(a[0]) || b[1] - a[1] || a[0].localeCompare(b[0])
  )[0][0];
  return { saga: grafia, sagaOrder: n ?? null, voti: vincente.voti };
}

const pulisci = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[^\p{L}\p{N}' ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

// L'opera giusta fra quelle che il catalogo propone: il titolo esatto
// prima, il prefisso poi, e l'autore — se lo sappiamo — deve comparire.
// E' la stessa scelta della quarta di copertina, e per la stessa ragione:
// la saga di un ALTRO libro e' peggio di nessuna.
//
// MA SE LA RICERCA ERA GIA' FILTRATA PER AUTORE (`filtrata`), l'autore non
// si ricontrolla: «The Goblin Emperor» sta nel catalogo sotto «Sarah
// Monette», il nome vero dietro lo pseudonimo Katherine Addison — il
// catalogo lo sa e la ricerca con l'autore lo trova, e la seconda guardia
// lo buttava via (preso dal vivo sui «Volumi soli» del lettore).
export function scegliOpera(docs = [], { title, author, filtrata = false } = {}) {
  const t = pulisci(title);
  if (!t) return null;
  const a = pulisci(autorePerIlCatalogo(author));
  const cognome = filtrata ? "" : a.split(" ").filter(Boolean).pop() || "";
  const buone = docs.filter((d) => {
    if (!d?.key) return false;
    if (!cognome) return true;
    const autori = (d.author_name || []).map(pulisci).join(" ");
    return !autori || autori.includes(cognome);
  });
  return (
    buone.find((d) => pulisci(d.title) === t) ||
    buone.find((d) => {
      const suo = pulisci(d.title);
      return suo.startsWith(t + " ") || t.startsWith(suo + " ");
    }) ||
    null
  );
}

async function json(f, url) {
  const r = await f(url);
  if (!r?.ok) throw new Error(`catalogo ${r?.status || "?"}`);
  return r.json();
}

// Un buco di rete ESPLODE, non torna `null`: `null` vuol dire «il catalogo
// non la sa», e su quello si scrive una memoria — sulla rete caduta no.
export async function cercaSaga({ title, author } = {}, fetcher) {
  const f = fetcher || fetch;
  const autore = autorePerIlCatalogo(author);
  for (const variante of varianti(title, author)) {
    const q = new URLSearchParams({ title: variante, fields: "key,title,author_name", limit: "5" });
    if (autore) q.set("author", autore);
    const risposta = await json(f, `https://openlibrary.org/search.json?${q}`);
    const docs = risposta?.docs || [];
    const opera = scegliOpera(docs, { title: variante, author, filtrata: !!autore });
    if (!opera) continue;
    const ed = await json(f, `https://openlibrary.org${opera.key}/editions.json?limit=${EDIZIONI}`);
    // i titoli di TUTTE le opere che rispondono al titolo cercato, non solo
    // di quella scelta: lo stesso romanzo sta spesso in piu' schede, e la
    // saga puo' stare nel titolo di una qualunque
    const titoli = docs.filter((d) => scegliOpera([d], { title: variante, author, filtrata: !!autore })).map((d) => d.title);
    const trovata = sagaDalleEdizioni(ed?.entries || [], titoli);
    if (trovata) return trovata;
  }
  return null;
}

// La passata sui libri senza saga, nella forma di ogni passata lunga: un
// tomo per volta, fermabile, quel che e' trovato resta. La memoria
// (`giaVista`/`segnaVista`) si scrive SOLO su una risposta del catalogo —
// trovata o «non la so» — mai su un buco di rete, che domani non c'e' piu'.
export async function ripassaCatalogo(libri = [], { cerca, onProgress, vivo, giaVista, segnaVista, nomeInCasa } = {}) {
  const attivo = vivo || (() => true);
  const esito = { trovate: 0, mute: 0, rete: 0, saltati: 0, fermato: false, campi: {} };
  const segna = async (b, cosa) => {
    try {
      await segnaVista?.(b, cosa);
    } catch {
      /* si richiedera' */
    }
  };
  const senza = libri.filter((b) => b && !String(b.saga || "").trim());
  const trovati = [];
  for (const [i, b] of senza.entries()) {
    if (!attivo()) {
      esito.fermato = true;
      break;
    }
    onProgress?.({ i, totale: senza.length, titolo: b.title });
    if (giaVista) {
      let vista = false;
      try {
        vista = !!(await giaVista(b));
      } catch {
        /* memoria illeggibile: si richiede, che e' il lato sicuro */
      }
      if (vista) {
        esito.saltati += 1;
        continue;
      }
    }
    let r;
    try {
      r = await cerca(b);
    } catch {
      esito.rete += 1;
      continue;
    }
    if (!r?.saga) {
      esito.mute += 1;
      await segna(b, { muta: true });
      continue;
    }
    const saga = nomeInCasa ? nomeInCasa(r.saga, [...libri, ...trovati]) : r.saga;
    const campi = { saga };
    if (b.sagaOrder == null && r.sagaOrder != null) campi.sagaOrder = r.sagaOrder;
    esito.campi[b.id] = campi;
    esito.trovate += 1;
    trovati.push({ ...b, ...campi });
    await segna(b, { saga });
  }
  return esito;
}
