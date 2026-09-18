// LO SCAFFALE E' FATTO DI RIPIANI, e su un ripiano i libri stanno accanto
// ai loro fratelli.
//
// «Scaffale» era il nome del NESSUN raggruppamento: tutti i tomi in fila,
// ordinati per data d'ingresso, cioe' un ordine che l'occhio non riconosce.
// Sullo schermo del lettore il primo volume di una trilogia stava fra il
// quinto di un'altra e un romanzo solo, e i tre libri della stessa storia
// finivano in tre righe diverse (segnalato: «la parte scaffale fa vedere
// tutto senza un ordine preciso»).
//
// Uno scaffale vero raccoglie: la saga sta insieme e in ordine di lettura,
// i libri di un autore stanno insieme, e i volumi che non hanno fratelli
// chiudono la fila. Qui si costruiscono quei ripiani, e stanno in `lib`
// perche' e' la parte che un test puo' chiamare senza montare niente.
import { chiaveAutore } from "./sagaBooks.js";

// L'ultimo ripiano, quello dei libri che non stanno con nessuno.
export const SOLI = "__soli__";

// I TRE CRITERI, E IL NOME DEL MUCCHIO CHE OGNUNO SI LASCIA DIETRO.
//
// Chiesto dal lettore: «il raggruppamento me lo dividi per saga o per
// autore e non tutto assieme». «Saga e autore» resta la disposizione di
// sempre — la saga se c'e', altrimenti l'autore — ma adesso i due criteri
// si possono anche chiedere da soli, e la differenza vera non e' come si
// raccoglie: e' CHI RESTA FUORI, e come lo si chiama.
//
//   auto    la saga se c'e', se no l'autore. Chi non ha ne' l'una ne'
//           l'altro, e chi e' l'unico libro del suo autore, sta fra i
//           «Volumi soli» — che vuol dire «non ha fratelli sullo
//           scaffale», ed e' vero.
//   saga    solo la saga. Tutti i romanzi che una saga non ce l'hanno
//           finiscono in un mucchio solo, e quel mucchio si chiama «Fuori
//           saga» perche' e' quello che sono: non «soli», visto che il
//           loro autore un altro libro in casa potrebbe averlo eccome.
//   autore  solo l'autore. Le saghe si sciolgono e i volumi tornano sotto
//           chi li ha scritti — che su una saga a venti mani come
//           l'Eresia di Horus e' esattamente l'informazione che «Saga e
//           autore» nasconde.
//
// Il mucchio di scarto prende un NOME DIVERSO per criterio, e non e'
// cosmetica: «Volumi soli» sopra un romanzo il cui autore sta due ripiani
// piu' su sarebbe una bugia, e una bugia che nessun errore segnala.
//
// E il criterio porta SOLO quel nome. Il primo giro gli aveva messo
// accanto anche un «applica il minimo», spento per la saga — ma in
// modalita' saga ogni gruppo nasce gia' `tipo: "saga"`, che `bastano`
// lascia passare comunque: era una guardia che non guardava niente. L'ha
// detto una mutazione sopravvissuta, non la rilettura. Chi la rimette
// controlli prima che faccia cascare qualcosa.
const CRITERI = {
  auto: "Volumi soli",
  saga: "Fuori saga",
  autore: "Volumi soli",
};

export const CRITERI_VALIDI = Object.keys(CRITERI);

// UN RIPIANO DA UN LIBRO SOLO NON E' UN RIPIANO — MA UNA SAGA SI'.
//
// Un'intestazione con sotto un unico dorso costa due righe di schermo per
// non dire niente, e una biblioteca fatta di autori con un libro a testa
// diventerebbe un elenco di titoletti. Chi non ha fratelli scende fra i
// volumi soli.
//
// La saga pero' e' un'altra cosa, e la differenza la fa CHI L'HA DETTO:
// l'autore e' un ripiego che deduciamo noi dai metadati, la saga la
// dichiara il lettore a mano nella scheda del libro. Quando scrive
// «Malazan» sta dicendo che quel romanzo appartiene a una storia piu'
// grande, e quell'informazione resta vera anche se di quella storia ha un
// volume solo — anzi, e' proprio li' che serve: «Malazan · 1 volume» dice
// che di quel ciclo hai un pezzo, mentre lo stesso libro buttato fra i
// soli non dice piu' niente. Chiesto dal lettore.
const MINIMO = 2;

// Quanti libri servono a tenere in piedi un ripiano, secondo com'e' nato.
// Vale per tutt'e tre i criteri senza saperne niente: una saga dichiarata
// regge sempre, un autore solo quando ha dei fratelli.
const bastano = (g) => g.tipo === "saga" || g.libri.length >= MINIMO;

const testo = (v) => String(v || "").trim();

// La chiave dice con CHI sta un libro: la saga se ce l'ha — e' il legame
// piu' forte, ed e' quello che il lettore dichiara a mano — altrimenti
// l'autore. Il nome dell'autore si confronta a parole ordinate come in
// tutto il resto dell'app, cosi' «Abercrombie, Joe» e «Joe Abercrombie»
// non fanno due ripiani.
function chiaveDi(b, per) {
  if (per !== "autore") {
    const saga = testo(b.saga);
    if (saga) return { chiave: `saga:${saga.toLowerCase()}`, tipo: "saga", nome: saga };
    // chiesto «per saga» e questo libro una saga non ce l'ha: non si
    // ripiega sull'autore, o il criterio direbbe una cosa e ne farebbe
    // un'altra
    if (per === "saga") return null;
  }
  const autore = testo(b.author);
  if (autore) {
    const k = chiaveAutore(autore);
    if (k) return { chiave: `autore:${k}`, tipo: "autore", nome: autore };
  }
  return null;
}

// Dentro un ripiano comanda l'ORDINE DI LETTURA, che e' l'unico ordine che
// una saga possiede davvero; solo dove il numero non c'e' decide
// l'ordinamento scelto in Libreria. I volumi senza numero vanno in coda ai
// numerati: un romanzo che non sa dove sta nella storia non si mette in
// mezzo a quelli che lo sanno.
//
// E PRIMA DEL NUMERO VIENE LA SAGA, che sembra pignoleria e non lo e':
// dentro un ripiano d'AUTORE ci sono due storie diverse, tutt'e due
// numerate da uno. Sul solo numero, Mistborn e l'Archivio delle Tempeste
// si interlaccerebbero — primo, primo, secondo, secondo — e la trilogia
// che il numero doveva tenere insieme verrebbe sbriciolata proprio dal
// numero. Sul ripiano di una saga questo confronto non fa niente (la saga
// e' una sola), e in «Saga e autore» nemmeno: li' sotto un autore ci
// finiscono solo i libri che una saga non ce l'hanno.
const perLettura = (confronta) => (a, b) => {
  const sa = testo(a.saga).toLowerCase();
  const sb = testo(b.saga).toLowerCase();
  if (sa !== sb) return sa.localeCompare(sb, "it");
  const x = a.sagaOrder ?? null;
  const y = b.sagaOrder ?? null;
  if (x !== y) {
    if (x === null) return 1;
    if (y === null) return -1;
    return x - y;
  }
  return confronta ? confronta(a, b) : 0;
};

// DENTRO LA SAGA, I CICLI. Chiesto dal lettore («le saghe posso vederle
// raggruppate anche per serie se ci sono?») guardando il Circle of the
// World: dieci volumi in fila, dove la trilogia della Prima Legge, i
// romanzi a se' e l'Eta' della Follia stanno uno dopo l'altro senza una
// riga a dire dove finisce una storia e ne comincia un'altra. Il ciclo e'
// gia' scritto nella scheda (la Serie) e «Prima di cominciare» lo usa da
// un pezzo: qui lo usa anche lo scaffale.
//
// Il ripiano resta UNO per saga — e' la saga il legame forte — e i cicli
// sono sotto-ripiani dentro di lui, nell'ordine in cui la storia li
// incontra: ogni ciclo sta dove sta il suo primo volume, cosi' la Prima
// Legge (1-3) viene prima dei romanzi a se' (4-7) e l'Eta' della Follia
// (8-10) chiude. Nel Mondo Disco, dove i cicli si intrecciano, Rincewind
// apre perche' apre il primo romanzo. I volumi che un ciclo non lo
// dichiarano stanno insieme sotto `nome: null`, e ci stanno per due ragioni
// che si assomigliano: o sono romanzi a se' — ed e' giusto cosi' — o il
// campo e' vuoto, e vederli raccolti a parte e' il modo di accorgersene.
//
// Se nessun volume dichiara un ciclo si torna `null`, non un solo
// sotto-ripiano senza nome: una saga senza cicli non ha niente da
// suddividere, e una riga in piu' li' sarebbe rumore.
// Il campo si passa da fuori perche' il mestiere e' lo stesso due volte:
// dentro una SAGA i sotto-ripiani sono i cicli (`series`), dentro un
// AUTORE sono le sue saghe (`saga`). Senza, il ripiano di Sanderson
// sarebbe una fila di quattordici dorsi senza una riga a dire dove
// finisce Mistborn e comincia l'Archivio delle Tempeste — lo stesso
// difetto per cui i cicli sono nati, un piano piu' in la'.
export function raccogliCicli(libri = [], campo = "series") {
  if (!libri.some((b) => testo(b[campo]))) return null;
  const gruppi = new Map();
  for (const b of libri) {
    const nome = testo(b[campo]) || null;
    const k = nome === null ? null : nome.toLowerCase();
    if (!gruppi.has(k)) gruppi.set(k, { nome, libri: [], primo: null });
    const g = gruppi.get(k);
    g.libri.push(b);
    const n = b.sagaOrder ?? null;
    if (n !== null && (g.primo === null || n < g.primo)) g.primo = n;
  }
  // chi non ha nessun numero chiude, come i volumi senza numero dentro un
  // ripiano; a parita' resta l'ordine d'arrivo, che e' quello di lettura
  return [...gruppi.values()].sort((a, b) => {
    if (a.primo === b.primo) return 0;
    if (a.primo === null) return 1;
    if (b.primo === null) return -1;
    return a.primo - b.primo;
  });
}

// L'ORDINE DEI RIPIANI FRA LORO, che fin qui non seguiva niente.
//
// «Ordina» in Libreria comandava DENTRO i ripiani e mai FRA loro: i
// ripiani uscivano sempre in alfabetico. Scegliendo «Recenti» — che vuol
// dire «fammi vedere quel che e' appena entrato» — non si muoveva niente,
// perche' dentro una saga vince comunque il numero di lettura e i ripiani
// restavano dov'erano. Segnalato dal lettore come confusione fra i due
// menu: «serve avere sia raggruppa che ordina?». Serviva: mancava la
// meta' del lavoro, non il comando.
//
// QUI C'E' UNA SOLA VOCE, e non e' una svista: «Titolo» e «Autore»
// ordinano gia' i ripiani per il loro nome — sotto «Raggruppa: Autore» il
// nome del ripiano E' l'autore — quindi l'alfabetico e' la loro risposta
// giusta, e chi non e' in questa tavola la riceve. «Recenti» e' l'unico
// che ha qualcosa di diverso da dire.
const ingresso = (r) => r.libri.reduce((max, b) => Math.max(max, Number(b.addedAt) || 0), 0);

export const ORDINI = {
  recent: (a, b) => ingresso(b) - ingresso(a),
};

const perNome = (a, b) => String(a.nome).localeCompare(String(b.nome), "it");

// A PARITA' DECIDE SEMPRE L'ALFABETO: senza, due ripiani con lo stesso
// ultimo ingresso resterebbero nell'ordine in cui la biblioteca li ha
// prodotti, che cambia a ogni import — e' la stessa regola che i pesi di
// `aEtichette` hanno gia'.
function ordinaRipiani(ripiani, ordine) {
  const cmp = ORDINI[ordine];
  ripiani.sort(cmp ? (a, b) => cmp(a, b) || perNome(a, b) : perNome);
  return ripiani;
}

// I RIPIANI A ETICHETTA: genere, voto, stato.
//
// Qui non c'e' niente da tenere insieme — nessuna saga, nessun ordine di
// lettura — c'e' solo una chiave per libro e un mucchio per chiave. La
// parte che sbaglia in silenzio e' **l'ORDINE DEI RIPIANI**: il genere si
// legge in alfabetico e va bene, ma un voto e uno stato no. «5 stelle»
// dopo «4 stelle» perche' il «5» viene dopo il «4» nell'alfabeto sarebbe
// uno scaffale che nessuno ha chiesto, e «Abbandonati, Da leggere, In
// lettura, Letti» mette la fine della storia in cima. Nessuna delle due
// alza un errore: si legge e basta.
//
// Quindi ogni criterio porta il suo PESO, e chi non ha etichetta chiude
// sempre la fila — come i «Volumi soli» e i volumi senza numero.
//
// E IL PESO E' ANCHE QUEL CHE DECIDE SE «Ordina» PUO' PARLARE: dove i
// ripiani hanno una scala loro — il voto scende da cinque stelle, lo stato
// segue la vita di un libro — la scala comanda, e riordinarli per data
// d'ingresso cancellerebbe proprio l'informazione per cui li hai chiesti.
// Dove invece l'ordine era solo alfabetico per mancanza di meglio (il
// genere), comanda l'ordinamento scelto in Libreria.
export function aEtichette(libri = [], criterio = {}, ordine = null) {
  const { chiave, nome = (k) => k, peso = null, vuoto = "Senza etichetta" } = criterio;
  const gruppi = new Map();
  for (const b of libri) {
    const k = String(chiave?.(b) ?? "").trim();
    if (!gruppi.has(k)) gruppi.set(k, []);
    gruppi.get(k).push(b);
  }
  const fuori = [...gruppi.keys()]
    .filter(Boolean)
    .map((k) => ({ id: k, nome: nome(k), libri: gruppi.get(k) }));
  if (peso) fuori.sort((a, b) => peso(b.id) - peso(a.id) || perNome(a, b));
  else ordinaRipiani(fuori, ordine);
  if (gruppi.has("")) fuori.push({ id: "", nome: vuoto, libri: gruppi.get(""), spento: true });
  return fuori;
}

// IL VOTO. Le mezze stelle esistono (la scheda le sa dare, e lo schema del
// cloud ha un gradino apposta per chi non le regge), quindi il ripiano e'
// per valore ESATTO: 4 e 4½ sono due voti diversi, e fonderli riscriverebbe
// sullo scaffale una scelta che il lettore ha fatto a mezza stella.
// **Il singolare si scrive a mano**: «1 stelle» si legge come un guasto,
// come «1 volumi» in `fraseTace`.
export const criterioVoto = () => ({
  chiave: (b) => (Number(b?.rating) > 0 ? String(Number(b.rating)) : ""),
  nome: (k) => {
    const v = Number(k);
    const mezza = v % 1 !== 0;
    const intero = Math.floor(v);
    const testo = mezza ? `${intero || ""}½` : `${v}`;
    // singolare fino a UNA stella compresa: «½ stella» e «1 stella», ma
    // «1½ stelle». Guardare il solo `=== 1` scriveva «½ stelle», che e'
    // la stessa specie di guasto di «1 volumi» — preso dal test.
    return `${testo} ${v <= 1 ? "stella" : "stelle"}`;
  },
  peso: (k) => Number(k),
  vuoto: "Senza voto",
});

// LO STATO. Le parole sono quelle dei FILTRI che stanno due righe sopra
// sullo schermo — «Letti», non «Letto»: un'intestazione con un conto
// accanto parla di piu' libri, e due nomi diversi per la stessa cosa nella
// stessa schermata si leggono come due cose diverse.
//
// `leggiStato` si passa da fuori come `leggiByte`: lo stato di un libro
// sta in `localStorage` e un test in Node non ce l'ha.
export const STATI = [
  { id: "unread", nome: "Da leggere" },
  { id: "reading", nome: "In lettura" },
  { id: "read", nome: "Letti" },
  { id: "abandoned", nome: "Abbandonati" },
];

export const criterioStato = (leggiStato) => ({
  // uno stato che non conosciamo non e' «senza stato»: e' un valore che
  // qualcuno ha scritto e che noi non sappiamo nominare, e si mostra com'e'
  // invece di sparire in un mucchio che dice un'altra cosa
  chiave: (b) => String(leggiStato?.(b) || ""),
  nome: (k) => STATI.find((s) => s.id === k)?.nome || k,
  peso: (k) => {
    const i = STATI.findIndex((s) => s.id === k);
    // l'ordine e' quello della vita di un libro, e `peso` ordina al
    // contrario (il piu' alto per primo): il primo della lista pesa di piu'
    return i < 0 ? -1 : STATI.length - i;
  },
  vuoto: "Senza stato",
});

export function disponi(libri = [], confronta = null, per = "auto", ordine = null) {
  // un criterio che non conosciamo vale la disposizione di sempre: e' la
  // stessa regola di `vistaValida` e della svolta — un valore storto non
  // deve spegnere lo scaffale
  const modo = CRITERI[per] ? per : "auto";
  const nomeSoli = CRITERI[modo];
  const gruppi = new Map();
  const soli = [];
  for (const b of libri) {
    const k = chiaveDi(b, modo);
    if (!k) {
      soli.push(b);
      continue;
    }
    if (!gruppi.has(k.chiave)) gruppi.set(k.chiave, { ...k, libri: [] });
    gruppi.get(k.chiave).libri.push(b);
  }

  const ripiani = [];
  for (const g of gruppi.values()) {
    if (!bastano(g)) {
      soli.push(...g.libri);
      continue;
    }
    g.libri.sort(perLettura(confronta));
    ripiani.push({
      id: g.chiave,
      tipo: g.tipo,
      nome: g.nome,
      // Sotto il nome di una saga ci va l'autore, ma SOLO se e' uno: le
      // saghe scritte da venti mani — l'Eresia di Horus — con un nome
      // solo sotto racconterebbero una bugia.
      autore: g.tipo === "saga" ? autoreUnico(g.libri) : null,
      libri: g.libri,
      // i sotto-ripiani si raccolgono DOPO l'ordinamento: cosi' dentro
      // ognuno i volumi restano in ordine di lettura senza rifare il conto.
      // Dentro una saga sono i suoi cicli; dentro un autore, le sue saghe.
      cicli:
        g.tipo === "saga"
          ? raccogliCicli(g.libri)
          : modo === "autore"
            ? raccogliCicli(g.libri, "saga")
            : null,
    });
  }
  ordinaRipiani(ripiani, ordine);

  // e il mucchio di scarto chiude SEMPRE la fila, qualunque ordine si sia
  // scelto: non e' un ripiano fra gli altri, e' quel che resta — mandarlo
  // in cima perche' ci e' appena entrato un libro sarebbe uno scaffale che
  // si apre dai leftover.
  if (soli.length) {
    soli.sort(confronta || (() => 0));
    ripiani.push({ id: SOLI, tipo: "soli", nome: nomeSoli, autore: null, libri: soli });
  }
  return ripiani;
}

function autoreUnico(libri) {
  let nome = null;
  let chiave = null;
  for (const b of libri) {
    const k = chiaveAutore(b.author);
    if (!k) return null;
    if (chiave === null) {
      chiave = k;
      nome = testo(b.author);
    } else if (k !== chiave) return null;
  }
  return nome;
}
