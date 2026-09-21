import DISCWORLD, { SAGA, CICLI_NOSTRI } from "../data/discworldBooks.js";
import HORUS, { SAGA as SAGA_HH } from "../data/horusHeresy.js";
import APOCALISSE, { SAGA as SAGA_SA, FUORI as FUORI_BAKKER } from "../data/secondApocalypse.js";
import { sagaDalTitolo } from "./sagaDalTitolo.js";

// Riconoscere il romanzo dal titolo: i metadati degli EPUB sono spesso vuoti,
// storti o pieni di roba dell'editore («Guards! Guards! (Discworld Novels
// Book 8)»), e senza saga il glossario non si accende e il «prossimo della
// saga» non sa dove andare. Il titolo invece nel nome del file c'e' quasi
// sempre, in una forma o nell'altra.

const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// dentro una stringa piu' lunga, ma solo a confine di parola: «Mort» sta in
// «Mortal Engines» come sequenza di lettere, non come titolo
function contiene(testo, chiave) {
  const i = testo.indexOf(chiave);
  if (i < 0) return false;
  const prima = i === 0 ? " " : testo[i - 1];
  const dopo = i + chiave.length >= testo.length ? " " : testo[i + chiave.length];
  return !/[a-z0-9']/.test(prima) && !/[a-z0-9']/.test(dopo);
}

// Pratchett ha scritto parecchio fuori dal Disco: senza questa lista, il
// ripiego sull'autore darebbe il glossario del Mondo Disco anche a Good
// Omens o alla Lunga Terra, dove non c'entra niente.
const FUORI_SAGA = [
  "good omens", "nation", "dodger", "the long earth", "the long war",
  "the long mars", "the long utopia", "the long cosmos", "truckers", "diggers",
  "wings", "the carpet people", "strata", "the dark side of the sun",
  "only you can save mankind", "johnny and the dead", "johnny and the bomb",
];

// LE TAVOLE. Una per saga, e da qui in poi il codice non sa piu' quale sta
// guardando: aggiungerne una terza e' scrivere un file in `data/` e una
// riga qui.
//
// Le due che ci sono adesso pero' NON si riconoscono allo stesso modo, e la
// differenza sta nell'autore. Pratchett ha scritto quasi solo Mondo Disco,
// quindi il ripiego «l'autore lo conosco, la saga gliela do lo stesso» ci
// azzecca quasi sempre (e i suoi fuori-saga stanno in un elenco). L'Eresia
// di Horus la scrivono venti autori che scrivono anche moltissimo altro:
// col ripiego sull'autore, i Gaunt's Ghosts di Abnett diventerebbero
// Eresia. Per questo `autore` li' e' `null`.
// esportate perche' il CAMMINO (`lib/cammino.js`) mostra la guida INTERA,
// non i soli libri che hai: gli serve la tavola, non il riconoscimento
export const TAVOLE = [
  { saga: SAGA, libri: DISCWORLD, ordine: (b) => b.n, autore: "pratchett", fuori: FUORI_SAGA, stretta: false },
  // `o` e non `n`: l'ordine e' quello del percorso CD8D, non la numerazione
  // della collana. Vedi il commento in testa a `horusHeresy.js`.
  // `parti: true` = il campo `c` di questa tavola non sono CICLI ma i
  // capitoli di una storia sola, letti in fila. Lo dichiara la tavola
  // perche' dai dati non si distingue (vedi `parteDiUnaStoria`).
  { saga: SAGA_HH, libri: HORUS, ordine: (b) => b.o, autore: null, fuori: [], stretta: true, parti: true },
  // Bakker sta in mezzo ai due: ha scritto quasi solo questa saga — quindi
  // il ripiego sull'autore vale, coi suoi thriller in `fuori` — ma i titoli
  // non sono insegne inconfondibili («The Great Ordeal»), quindi il
  // riconoscimento per titolo resta `stretto` e chiede l'autore.
  { saga: SAGA_SA, libri: APOCALISSE, ordine: (b) => b.n, autore: "bakker", fuori: FUORI_BAKKER, stretta: true },
];

// I capitoli di tutte le guide, in minuscolo: `parteDiUnaStoria` guarda
// qui per sapere se una Serie scritta su un libro e' una parte di un
// cammino nostro o un ciclo del lettore. Si costruisce una volta sola
// dalle tavole, cosi' una guida nuova entra da se'.
// E IL VALORE E' IL POSTO NELLA GUIDA, non un semplice «c'e'». I capitoli
// hanno un ordine — il loro, quello in cui la storia li incontra — e non e'
// quello dei volumi che possiedi: i racconti un numero di lettura non ce
// l'hanno, quindi ordinando i capitoli sul primo volume numerato «Part 12»
// finiva prima di «Part 4» (preso al banco, non rileggendo il codice).
// L'ordine della tavola invece e' la guida stessa.
export const PARTI_DI_GUIDA = new Map(
  TAVOLE.filter((t) => t.parti)
    .flatMap((t) => t.libri.map((v) => String(v.c || "").trim().toLowerCase()))
    .filter(Boolean)
    .map((nome, i) => [nome, i])
    .filter(([nome], i, tutti) => tutti.findIndex(([n]) => n === nome) === i)
);

// I titoli lunghi per primi, e da TUTTE le tavole insieme: «Garro» non
// deve prendersi «Garro: Knight of the Grey». Oggi quella coppia la
// fermerebbe anche la regola della copertura — l'antologia non porta
// l'autore, e «garro» copre un quinto di quel campo — ma l'ordine e' la
// difesa che vale anche per le tavole LARGHE, dove la copertura non si
// applica: nel Mondo Disco una coppia cosi' non c'e', e il giorno che
// arriva non deve dipendere dall'ordine con cui e' scritto un file.
// UN LIBRO PUO' AVERE PIU' NOMI, e si dichiarano a mano. Il titolo si cerca
// DENTRO il campo, quindi «The Darkness That Comes Before» non combacia con
// un file che si chiama «Darkness That Comes Before» — che e' esattamente
// come e' scritto quello del lettore. Togliere l'articolo a TUTTI i titoli
// sarebbe la cura sbagliata: «The Truth» del Mondo Disco diventerebbe
// «truth», che sta dentro qualunque titolo. Gli alias invece li mette chi
// scrive la tavola, uno per uno, dove sa che sono innocui.
const INDICE = TAVOLE.flatMap((tav) =>
  tav.libri.flatMap((b) =>
    [b.t, ...(b.alias || [])].map((nome) => ({ ...b, k: norm(nome), tav }))
  )
).sort((a, b) => b.k.length - a.k.length);

// QUANDO IL CONTENIMENTO NON BASTA.
//
// Il Mondo Disco se la cava col solo contenimento: i titoli sono
// distintivi e c'e' il ripiego sull'autore a raccogliere quel che scappa.
// L'Eresia no. Sedici delle sue voci sono parole comuni — «Scars»,
// «Mortis», «Betrayer», «Fulgrim» — e venti autori diversi la scrivono
// mentre scrivono anche moltissimo altro: presa per contenimento, «Scars»
// si mangerebbe «Scars of the Past» di chiunque.
//
// Le tavole `strette` chiedono un secondo segnale, e ne basta uno dei due:
// o l'AUTORE conferma, o il titolo e' il GROSSO di quello che c'e' scritto.
// L'autore si cerca anche nel campo, perche' nei nomi dei file ci sta quasi
// sempre e nei metadati quasi mai.
const cognome = (a) => norm(a).split(" ").filter(Boolean).pop() || "";

// Il rumore dell'editore e del file — «(The Horus Heresy Book 24)»,
// «.epub», il numero della collana — non e' titolo, e non deve contare
// quando si misura quanto del campo il titolo copre. Senza questa
// ripulita, «Betrayer (Horus Heresy 24).epub» non si riconoscerebbe: il
// titolo sarebbe un terzo di quel che c'e' scritto.
// «The Horus Heresy» nel nome del file si scrive in tutt'e due i modi, e
// spesso senza l'articolo: cercando la forma intera, «Betrayer (Horus
// Heresy 24).epub» restava con mezza saga attaccata al titolo e non si
// riconosceva piu'.
const senzaArticolo = (s) => norm(s).replace(/^(the|il|lo|la|i|gli|le)\s+/, "");

const senzaRumore = (campo, saga) =>
  campo
    .replace(senzaArticolo(saga), " ")
    .replace(/\b(book|vol|volume|no|n)\s*\d+\b/g, " ")
    .replace(/\b(epub|mobi|azw3|pdf|retail|ebook)\b/g, " ")
    .replace(/\b\d+\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// meta' e' la soglia: sotto, quel titolo e' una citazione dentro una frase
// piu' lunga, non il titolo del libro che hai in mano
const COPERTURA = 0.5;

function combacia(campo, voce, autoreNorm) {
  if (!contiene(campo, voce.k)) return false;
  if (!voce.tav.stretta) return true;
  const cogn = voce.a ? cognome(voce.a) : "";
  const suo = cogn && (autoreNorm.includes(cogn) || campo.includes(cogn));
  if (suo) return true;
  // UN AUTORE SBAGLIATO E' UNA PROVA; UN AUTORE MANCANTE NON E' NIENTE.
  // Se sappiamo di chi e' il libro e chi ce lo porta dice un altro nome,
  // non e' quello: «Betrayer» di chiunque altro non e' il Betrayer
  // dell'Eresia. Ma meta' degli ePub l'autore non ce l'ha, e li' il
  // silenzio non deve valere come smentita.
  if (cogn && autoreNorm) return false;
  const nudo = senzaRumore(campo, voce.tav.saga);
  return voce.k.length >= nudo.length * COPERTURA;
}

// IL CAPITOLO COL SUO POSTO NELLA GUIDA, pronto per lo scaffale. Sta qui e
// non nel componente per la ragione di sempre: un test in Node non importa
// un `.jsx`, e qui c'e' qualcosa da difendere — l'ordine dei capitoli non
// si puo' prendere dai volumi che possiedi (un racconto non ha numero di
// lettura, e il suo capitolo scivolerebbe in fondo) ne' dai nomi (in
// alfabetico «Part 12» viene prima di «Part 4»).
export const capitoloDi = (riconosciuto) => {
  const nome = String(riconosciuto?.parte || "").trim();
  if (!nome) return null;
  return { nome, ordine: PARTI_DI_GUIDA.get(nome.toLowerCase()) ?? null };
};

export function riconosci({ title, author, fileName } = {}) {
  const campi = [title, fileName].filter(Boolean).map(norm);
  const chiAutore = norm(author);
  for (const campo of campi) {
    for (const b of INDICE) {
      if (combacia(campo, b, chiAutore)) {
        return {
          saga: b.tav.saga,
          sagaOrder: b.tav.ordine(b) ?? null,
          // UNA GUIDA SA DUE COSE DIVERSE, E IL CAMPO SERIE NE TIENE UNA SOLA.
        //
        // Chiesto dal lettore guardando il suo scaffale: «vorrei che questi
        // libri fossero identificati come parte della Horus Heresy
        // dell'universo 40K, ma che comunque ce ne sono altre di serie al
        // suo interno e non solo quella, e potrei volerle aggiungere in
        // futuro». Sono TRE livelli — universo, storia, capitoli — e i campi
        // sono DUE: `saga` e `series`.
        //
        // Finche' le tredici parti stavano in `series`, il posto per dire
        // «questa e' l'Eresia» non c'era: se lo prendevano loro. E il giorno
        // che sotto «Warhammer 40K» arrivano i Gaunt's Ghosts, «Prima di
        // cominciare» — che restringe il racconto alla SERIE — sull'Eresia
        // ripiegherebbe sulla saga intera e racconterebbe anche quelli.
        //
        // Quindi nel campo va la STORIA (il nome della tavola) e il CAPITOLO
        // torna a essere quel che e': un fatto della guida, che si legge
        // dalla tavola quando serve — sullo scaffale, come terzo livello.
        // E' la stessa regola di `tipo`: quel che la guida sa non si scrive
        // addosso al libro, si chiede alla guida.
          ciclo: b.tav.parti ? b.tav.saga : b.c,
          parte: b.tav.parti ? b.c || null : null,
          titolo: b.t,
        };
      }
    }
  }
  // il titolo non si riconosce ma l'autore si': saga senza numero, che e'
  // comunque meglio di niente — il glossario si accende lo stesso. Vale solo
  // per le tavole che un autore proprio ce l'hanno.
  for (const tav of TAVOLE) {
    if (!tav.autore || !chiAutore.includes(tav.autore)) continue;
    if (campi.some((campo) => tav.fuori.some((t) => contiene(campo, t)))) continue;
    return { saga: tav.saga, sagaOrder: null, ciclo: null, parte: null, titolo: null };
  }
  return null;
}

// L'autore lo conosciamo, ma QUESTO titolo sta fuori dalla sua saga. Serve
// alla deduzione dalla biblioteca: senza, a Good Omens finirebbe «Discworld»
// solo perche' tutti gli altri Pratchett ce l'hanno scritto.
export function fuoriSaga({ title, author, fileName } = {}) {
  if (!norm(author).includes("pratchett")) return false;
  return [title, fileName]
    .filter(Boolean)
    .map(norm)
    .some((campo) => FUORI_SAGA.some((t) => contiene(campo, t)));
}

// «Abercrombie, Joe» e «Joe Abercrombie» sono la stessa persona, e negli
// ePub capitano tutt'e due: si confrontano le parole del nome, ordinate.
export const chiaveAutore = (a) => norm(a).split(" ").filter(Boolean).sort().join(" ");

// UNA SAGA TOLTA A MANO RESTA TOLTA.
//
// Segnalato dal lettore per la seconda volta sullo stesso libro: «devi
// smettere di dedurre automaticamente che Between Two Fires fa parte della
// saga The Blacktongue Thief». Aveva ragione alla lettera, e il difetto non
// era dove l'avevamo curato.
//
// La regola di casa dice da sempre che «quello che il lettore ha scritto a
// mano non si tocca mai», e vale per ogni campo — ma il CAMPO SVUOTATO NON
// SI VEDE: un libro senza saga perche' il lettore gliel'ha tolta e uno senza
// saga perche' nessuno gliel'ha mai data sono lo stesso identico record, e
// le cinque strade della saga guardano proprio quello per decidere chi
// servire. Toglierla era percio' un gesto che durava fino alla prossima
// apertura della Libreria.
//
// La veto del catalogo (`senzaTraccia`) curava il caso, ma solo con la RETE
// e solo dopo: un tomo che una saga ce l'ha non viene mai chiesto al
// catalogo — quella memoria non esiste — quindi appena svuotato il campo la
// deduzione lo ritrovava senza nessuno che la fermasse, e su un tablet
// offline la ritrovera' per sempre. Il vuoto voluto va scritto, o non lo sa
// nessuno.
//
// E' l'unico segnale che l'app non puo' dedurre da se': il lettore sa che
// quel romanzo sta da solo, noi no. Vale contro TUTTE le strade — tavola,
// collana nel file, titolo, catalogo, fratelli — perche' su questo campo
// l'ultima parola e' sua, e una strada lasciata fuori rimetterebbe la saga
// esattamente come prima.
//
// IL SEGNO PARLA SOLO DEL VUOTO: se una saga c'e' — riscritta a mano qui, o
// arrivata dall'altro dispositivo — comanda lei, e il segno non blocca
// niente. Cosi' un segno rimasto addosso per una fusione non puo' mai
// spegnere una saga viva.
export const nienteSaga = (b) => !!b?.sagaTolta && !String(b?.saga || "").trim();

// Quel che la scheda del libro scrive quando tocchi il campo Saga. Il
// segno si accende svuotando un campo che qualcosa conteneva — quello e' il
// gesto che dice «questo romanzo sta da solo» — e si spegne appena ci
// riscrivi dentro.
//
// APRIRE LA SCHEDA E CHIUDERLA NON E' UN GESTO: su un libro che la saga non
// ce l'aveva gia' prima non si accende niente e il segno che c'era resta
// dov'e'. Senza questa riga bastava aprire una scheda per cancellare la
// scelta di ieri — in silenzio, e con la saga di ritorno al giro dopo.
//
// `false` e non un campo tolto: deve poter spegnere un `true` sceso
// dall'altro dispositivo, come il cuore dei preferiti.
export function scritturaSaga(libro = {}, scritta = "") {
  const saga = String(scritta || "").trim();
  if (saga) return { saga, sagaTolta: false };
  const aveva = !!String(libro.saga || "").trim();
  return { saga: "", sagaTolta: aveva || !!libro.sagaTolta };
}

// LA SAGA SI IMPARA DALLA TUA BIBLIOTECA, non da una tabella.
//
// La tabella conosce un autore solo (Pratchett) e non potra' mai conoscerli
// tutti. Ma la saga di un libro spesso e' gia' scritta — da te — su un
// altro libro dello stesso autore: se hai messo «Circle of the World» su
// The Heroes, il cofanetto di First Law la vuole uguale.
//
// La regola e' volutamente timida, perche' un'attribuzione sbagliata
// mescola due storie: si propone solo se TUTTI i libri di quell'autore che
// una saga ce l'hanno dichiarano LA STESSA. Due saghe diverse dello stesso
// autore, e non si tocca niente.
//
// MA LA TIMIDEZZA NON BASTA, E IL CASO CHE LA SMONTA E' UN AUTORE CON UNA
// SAGA E UN ROMANZO A SE' (segnalato con lo scaffale in mano: «perche' mi
// deduci Between Two Fires in una saga che non c'entra nulla?»). Dei tre
// Buehlman, due portano «The Blacktongue Thief» scritta addosso dal file;
// il terzo e' un romanzo a se', e la regola timida trovava «tutti e due
// dicono la stessa» e gliela dava. Il difetto non e' nella regola: e' nella
// PREMESSA, «un autore, una saga», che vale per Pratchett e per quasi
// nessun altro — e l'unica difesa era una lista scritta a mano dei suoi
// fuori-saga, che non potra' mai conoscere tutti gli autori.
//
// QUESTA E' LA SOLA STRADA CHE NON GUARDA IL LIBRO. Tavola, collana nel
// file, titolo e catalogo dicono qualcosa di QUEL volume; la deduzione
// copia dai fratelli e basta. Quindi e' l'ultima a parlare, e cede a chi il
// libro l'ha guardato: `senzaTraccia` sono i tomi di cui il catalogo ha
// letto le edizioni senza trovare **nessuna** collana (`tracce === 0`), e a
// quelli non si eredita niente.
//
// E' una veto, non un permesso: un tomo che il catalogo non ha mai visto —
// perche' la rete mancava, perche' l'opera non c'e', perche' l'app e'
// offline da sempre — non sta in quell'insieme e la deduzione lo serve come
// ha sempre fatto. Pretendere una conferma positiva spegnerebbe la
// deduzione su un dispositivo senza rete, che e' il contrario di
// local-first.
export function sagaDaBiblioteca(libro = {}, libri = [], senzaTraccia) {
  // il vuoto voluto batte tutto: vedi `nienteSaga`
  if (nienteSaga(libro)) return null;
  if (libro.id && senzaTraccia?.has?.(libro.id)) return null;
  const mio = chiaveAutore(libro.author);
  if (mio.length < 3) return null;
  let scelta = null;
  for (const b of libri) {
    if (b.id && libro.id && b.id === libro.id) continue;
    if (chiaveAutore(b.author) !== mio) continue;
    const s = String(b.saga || "").trim();
    if (!s) continue;
    if (!scelta) scelta = s;
    else if (chiaveSaga(s) !== chiaveSaga(scelta)) return null;
  }
  return scelta;
}

// LA STESSA SAGA SCRITTA IN DUE MODI E' UNA SAGA SOLA.
//
// Segnalato dal lettore con la Libreria in mano: «come mai la stessa saga
// del The Wheel of Time me l'ha divisa cosi'». Sullo scaffale c'erano TRE
// ripiani di Robert Jordan: «The Wheel of Time», «Wheel of Time», e due
// volumi soli sotto il nome dell'autore. La collana la leggiamo dal file, e
// chi impacchetta i file la scrive come gli pare — con l'articolo su un
// volume e senza sull'altro. E la saga nell'app si confronta lettera per
// lettera OVUNQUE: lo scaffale, il «prossimo della saga», la frontiera di
// «Chi e' costui?», «Prima di cominciare», la chiave del glossario. Due
// grafie non sono due ripiani: sono due storie per ogni funzione che
// attraversa la saga.
//
// E i due volumi soli erano la STESSA ferita un gradino piu' in la': la
// deduzione dalla biblioteca vedeva «due saghe diverse dello stesso autore»
// e, per la sua regola timida, non toccava niente — la regola giusta,
// applicata a una differenza che non c'era.
//
// La chiave si costruisce come per i titoli — minuscole, punteggiatura via —
// piu' l'articolo davanti, che e' l'unica cosa che i file cambiano davvero.
// Niente di piu': «First Law» e «First Law Trilogy» restano due, perche' da
// qui non si puo' sapere se sono la stessa e mescolare due storie e' peggio
// di un ripiano in piu'.
export const chiaveSaga = (s) => senzaArticolo(s);

// La grafia di casa: se in biblioteca quella saga e' gia' scritta, si
// scrive COME e' gia' scritta, qualunque cosa dica il file nuovo. E' la
// cura all'ingresso; `unificaSaghe` e' la stessa cura per chi era gia'
// dentro.
export function nomeInBiblioteca(saga, libri = []) {
  const k = chiaveSaga(saga);
  if (!k) return saga;
  for (const b of libri) {
    const s = String(b?.saga || "").trim();
    if (s && chiaveSaga(s) === k) return s;
  }
  return saga;
}

// Le grafie di una stessa saga si riportano a UNA: vince la piu' usata, a
// parita' la piu' lunga (quella con l'articolo, di norma la forma piena), e
// a parita' ancora l'ordine alfabetico — un criterio che dipendesse
// dall'ordine dei libri cambierebbe scelta a ogni import. Si tocca SOLO la
// grafia: il libro resta nella saga in cui era, scritta come i suoi
// fratelli. Torna i campi da scrivere e i nomi scelti, che il resoconto
// dice per esteso: una saga riscritta in silenzio e' esattamente il genere
// di cosa che poi «non torna».
export function unificaSaghe(libri = []) {
  const gruppi = new Map();
  for (const b of libri) {
    const s = String(b?.saga || "").trim();
    if (!s) continue;
    const k = chiaveSaga(s);
    if (!k) continue;
    if (!gruppi.has(k)) gruppi.set(k, new Map());
    const grafie = gruppi.get(k);
    grafie.set(s, (grafie.get(s) || 0) + 1);
  }
  const campi = {};
  const nomi = [];
  for (const [k, grafie] of gruppi) {
    if (grafie.size < 2) continue;
    const scelta = [...grafie.entries()].sort(
      (a, b) => b[1] - a[1] || b[0].length - a[0].length || a[0].localeCompare(b[0])
    )[0][0];
    nomi.push(scelta);
    for (const b of libri) {
      const s = String(b?.saga || "").trim();
      if (s && s !== scelta && chiaveSaga(s) === k) campi[b.id] = { saga: scelta };
    }
  }
  return { campi, unificate: nomi.length, nomi };
}

// LA SOLA DEDUZIONE, per la passata automatica: ai libri senza saga si
// propone quella degli altri libri dello stesso autore, con le stesse
// guardie di `ripassa` (`fuoriSaga`, la regola timida di
// `sagaDaBiblioteca`). Niente tavole e niente cicli: quelli restano al
// tasto, perche' rinominano roba che c'e' gia'. Qui si riempie solo il
// vuoto, che e' l'unica cosa che una passata silenziosa puo' permettersi.
//
// PRIMA IL TITOLO, POI LA BIBLIOTECA (segnalato: quattro John Gwynne sotto
// il nome dell'autore, con «Malice: The Faithful and the Fallen Series
// Book 1» fra loro). La deduzione ha bisogno di un fratello che la saga ce
// l'abbia gia', e su un autore nuovo quel fratello non c'e' mai — ma se
// UNO dei quattro la saga la porta scritta nel titolo, letta quella gli
// altri tre la ereditano nello stesso giro. Per questo le due passate
// stanno in fila e la seconda legge i libri gia' toccati dalla prima.
//
// E LE DUE PASSATE SI POSSONO CHIEDERE SEPARATE (`dallaBiblioteca: false`),
// perche' in mezzo ci va il catalogo: il titolo si legge sul libro e viene
// prima, la deduzione copia dai fratelli e viene per ultima — dopo che chi
// il libro l'ha guardato ha detto la sua. Chiamarla due volte e' innocuo:
// la passata dei titoli e' idempotente, chi una saga ce l'ha gia' non entra.
export function deduciSaghe(libri = [], { senzaTraccia, dallaBiblioteca = true } = {}) {
  const campi = {};
  let dedotte = 0;
  let dalTitolo = 0;
  // chi non e' candidato: senza libro, con la saga gia' scritta, fuori
  // saga per tavola, o con la saga tolta a mano — e quest'ultimo tiene
  // fuori anche la passata dei titoli, o «02 Valour» gliela riscriverebbe
  const vuota = (b) => !b || String(b.saga || "").trim() || fuoriSaga(b) || nienteSaga(b);
  const conTitolo = [];
  for (const b of libri) {
    if (vuota(b)) {
      conTitolo.push(b);
      continue;
    }
    const letto = sagaDalTitolo(b);
    if (!letto?.saga) {
      conTitolo.push(b);
      continue;
    }
    // scritta come e' gia' scritta in casa — e «casa» comprende i fratelli
    // appena toccati, o due titoli con due grafie farebbero due ripiani
    const tocco = { saga: nomeInBiblioteca(letto.saga, conTitolo.concat(libri)) };
    if (b.sagaOrder == null && letto.sagaOrder != null) tocco.sagaOrder = letto.sagaOrder;
    campi[b.id] = tocco;
    dalTitolo += 1;
    conTitolo.push({ ...b, ...tocco });
  }
  if (!dallaBiblioteca) return { campi, dedotte, dalTitolo };
  for (const b of conTitolo) {
    if (vuota(b)) continue;
    const dalla = sagaDaBiblioteca(b, conTitolo, senzaTraccia);
    if (!dalla) continue;
    campi[b.id] = { saga: dalla };
    // «02 Valour»: il numero in testa al titolo non dice la saga, dice il
    // posto — e vale solo adesso che una saga c'e'
    const n = b.sagaOrder == null ? sagaDalTitolo(b)?.sagaOrder : null;
    if (n != null) campi[b.id].sagaOrder = n;
    dedotte += 1;
  }
  return { campi, dedotte, dalTitolo };
}

// Il ripasso dei libri gia' in biblioteca. Riempire i campi vuoti non
// basta: chi ha importato i libri quando i cicli si chiamavano «Streghe»,
// o «The Witches Cycle», quel nome ce l'ha ancora scritto, e un campo
// pieno non e' vuoto — il tasto rispondeva «erano gia' tutti a posto» e i
// nomi vecchi restavano li' per sempre.
//
// Quindi i nomi che abbiamo scritto NOI si aggiornano, e tutto il resto
// no: quello che il lettore ha scritto a mano non si tocca mai, nemmeno
// quando il riconoscimento la pensa diversamente, perche' su questi campi
// l'ultima parola e' sua.
export function ripassa(libro = {}, libri = [], { senzaTraccia, dallaBiblioteca = true } = {}) {
  // LA SAGA TOLTA A MANO FERMA ANCHE IL TASTO, e anche la tavola: se il
  // riconoscimento la pensa diversamente dal lettore, comanda il lettore.
  // E niente ciclo, che senza la sua saga non vuol dire niente.
  if (nienteSaga(libro)) return null;
  const trovato = riconosci({ title: libro.title, author: libro.author });
  const saga = String(libro.saga || "").trim();
  const serie = String(libro.series || "").trim();
  const tocchi = {};
  let dedotta = false;
  let dalTitolo = false;

  if (trovato) {
    if (!saga) tocchi.saga = trovato.saga;
    if (libro.sagaOrder == null && trovato.sagaOrder != null) tocchi.sagaOrder = trovato.sagaOrder;
  } else if (!saga && !fuoriSaga(libro)) {
    // la tabella non lo conosce: la saga puo' stare scritta nel titolo, e
    // se no glielo puo' dire la tua biblioteca
    const letto = sagaDalTitolo(libro);
    if (letto?.saga) {
      tocchi.saga = nomeInBiblioteca(letto.saga, libri);
      dalTitolo = true;
    } else if (dallaBiblioteca) {
      const dalla = sagaDaBiblioteca(libro, libri, senzaTraccia);
      if (dalla) {
        tocchi.saga = dalla;
        dedotta = true;
      }
    }
  }
  // il numero scritto nel titolo («02 Valour») si prende solo se una saga
  // c'e' — sua o appena data — e il posto e' ancora vuoto: un numero senza
  // saga non dice niente, e un posto gia' dato non si sovrascrive
  if (!trovato && (saga || tocchi.saga) && libro.sagaOrder == null) {
    const n = sagaDalTitolo(libro)?.sagaOrder;
    if (n != null) tocchi.sagaOrder = n;
  }

  if (!serie) {
    if (trovato?.ciclo) tocchi.series = trovato.ciclo;
  } else if (
    Object.prototype.hasOwnProperty.call(CICLI_NOSTRI, serie) &&
    (trovato?.saga === SAGA || saga === SAGA)
  ) {
    // se il titolo si riconosce ancora, il ciclo giusto lo dice la tabella,
    // che e' piu' informata della mappa dei nomi vecchi: sa promuovere un
    // «Autoconclusivo» ad «Ancient Civilizations». Se invece si riconosce
    // solo l'autore — titolo tradotto, metadati riscritti — la tabella non
    // sa di che libro parliamo e direbbe «nessun ciclo», cancellando un
    // ciclo buono: li' vale la mappa dei nomi.
    const giusto = trovato?.titolo ? trovato.ciclo : CICLI_NOSTRI[serie];
    if ((giusto || "") !== serie) tocchi.series = giusto || "";
  }

  // `campi` sono i valori da scrivere; `dedotta` dice che la saga non
  // l'abbiamo riconosciuta ma DEDOTTA dagli altri libri dello stesso
  // autore — e' un'informazione del lettore, e il resoconto la dice a parte
  return Object.keys(tocchi).length ? { campi: tocchi, dedotta, dalTitolo } : null;
}
