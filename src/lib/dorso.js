// IL DORSO DISEGNATO, quando una copertina non c'è.
//
// Prima era lo stesso rettangolo per tutti: stesso gradiente, stessa 📖,
// stesso bordo. Dodici libri sullo scaffale erano dodici rettangoli
// identici — e uno scaffale serve esattamente a riconoscere un libro con
// la coda dell'occhio, non a costringerti a leggere ogni titolo.
//
// Qui il dorso nasce DAL LIBRO: il colore si ricava da quello che il libro
// è, la tipografia dal titolo. Niente immagini, niente casualità.

// UN NUMERO STABILE DA UNA STRINGA. Deve essere deterministico: lo stesso
// libro deve avere sempre lo stesso colore, oggi e fra un anno, su questo
// dispositivo e sul tablet. `Math.random()` qui sarebbe il difetto peggiore
// possibile — lo scaffale cambierebbe faccia a ogni apertura.
export function numero(testo) {
  let n = 2166136261;
  const s = String(testo || "");
  for (let i = 0; i < s.length; i++) {
    n ^= s.charCodeAt(i);
    // FNV-1a: le due righe sono il moltiplicatore 16777619 scritto in
    // somme, perché in JS `n * 16777619` perde i bit alti
    n += (n << 1) + (n << 4) + (n << 7) + (n << 8) + (n << 24);
  }
  return Math.abs(n | 0);
}

const pulisci = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// LA FAMIGLIA È LA SAGA, e questo è il punto della faccenda. I volumi di
// una saga devono stare nello stesso quartiere di colore, così sullo
// scaffale si vede che vanno insieme — è l'informazione che il lettore
// cerca davvero quando guarda la libreria da lontano.
//
// Senza saga si ripiega sull'autore (i suoi libri restano imparentati), e
// solo in ultimo sul titolo.
export function famigliaDi(book) {
  return pulisci(book?.saga) || pulisci(book?.author) || pulisci(book?.title) || "senza nome";
}

// DENTRO LA FAMIGLIA I VOLUMI SI DISTINGUONO, o una saga da dieci libri
// tornerebbe a essere dieci rettangoli identici — il difetto di prima,
// spostato di un passo. Lo scarto è piccolo (±SCARTO gradi) apposta: deve
// leggersi come «lo stesso colore, un'altra sfumatura», non come due saghe
// diverse.
export const SCARTO = 11;

export function tonoDi(book) {
  const base = numero(famigliaDi(book)) % 360;
  const suo = numero(pulisci(book?.title) || String(book?.id || ""));
  return (base + (suo % (SCARTO * 2 + 1)) - SCARTO + 360) % 360;
}

// I temi dell'app sono tutti notturni, quindi un trattamento solo basta.
// Saturazione bassa e luminosità bassa: una copertina non deve gridare più
// forte del tasto principale, che è l'oro del tema.
const S_FONDO = 30;
const L_ALTO = 26;
const L_BASSO = 15;

const hsl = (h, s, l) => `hsl(${Math.round(h)} ${s}% ${l}%)`;

// Tutto quello che serve a disegnare un dorso, da un libro. Sta qui e non
// dentro il componente perché un test lo possa chiamare: i colori si
// sbagliano in silenzio, e un contrasto che scende sotto la soglia non
// solleva nessun errore — sparisce e basta.
export function vestito(book) {
  const h = tonoDi(book);
  return {
    tono: h,
    alto: hsl(h, S_FONDO, L_ALTO),
    basso: hsl(h, S_FONDO, L_BASSO),
    // la costola: più scura del fondo, con un filo di luce sul bordo. È
    // il dettaglio che fa leggere il rettangolo come un LIBRO invece che
    // come una tessera colorata.
    costola: hsl(h, S_FONDO + 6, 10),
    filo: hsl(h, 42, 44),
    // l'inchiostro è chiarissimo ma tinto dello stesso tono: un bianco
    // puro su un fondo colorato sembra incollato sopra
    inchiostro: hsl(h, 20, 92),
    tenue: hsl(h, 16, 72),
  };
}

// IL CORPO DEL TITOLO DIPENDE DA QUANTO È LUNGO. Con una misura sola,
// «Mort» resta minuscolo in mezzo al vuoto e «Before They Are Hanged»
// sfonda il riquadro. Sono i gradini della scala (`F`), scelti da fuori:
// qui si dice solo QUALE gradino, non quanti pixel.
export const GRADINI = ["titolo", "titoletto", "rilievo", "corpo", "nota"];

// e non basta la lunghezza TOTALE: comanda anche la PAROLA PIÙ LUNGA.
// «Neuromante» è un titolo cortissimo — dieci caratteri — ma è una parola
// sola, e a corpo grande non ci sta nella colonna: il browser la spezzava
// a metà, «Neuroma / nte», che su una copertina è la cosa più brutta che
// si possa vedere. Una parola non si può mandare a capo, quindi o entra o
// si rimpicciolisce.
export function gradinoTitolo(titolo, quanti = GRADINI.length) {
  const t = String(titolo || "").trim();
  // soglie in caratteri, misurate sulla colonna 108–150px dello scaffale
  const perTutto = [12, 22, 34, 50];
  // Misurate nella colonna PIU' STRETTA dello scaffale (108px meno la
  // costola e i margini: restano una settantina di pixel di testo), che e'
  // l'unica misura che conta — se ci sta li', ci sta ovunque. Con [7,9,11]
  // «Neuromante» restava a diciassette punti e sbordava ancora di un pelo.
  const perParola = [6, 8, 9, 11];
  const lunga = t.split(/\s+/).reduce((m, p) => Math.max(m, p.length), 0);
  const passo = (n, soglie) => {
    let i = 0;
    while (i < soglie.length && n > soglie[i]) i += 1;
    return i;
  };
  // vince il più piccolo dei due, cioè l'indice più alto
  const i = Math.max(passo(t.length, perTutto), passo(lunga, perParola));
  return GRADINI[Math.min(i, quanti - 1)];
}

// E IL TITOLO DEVE STARCI DAVVERO, NEL RIQUADRO CHE HA (segnalato con la
// fotografia del tablet: «Pirane / si», «Garde / ns of», «Morty l'apprend»
// tagliato a meta'). Le soglie qui sopra sono in caratteri e misurate con la
// scrittura a grandezza naturale; ma la colonna dello scaffale non cresce
// con la scrittura, e sul tablet del lettore, a scrittura x1,5, il titolo ha
// 80 pixel per 63: ogni parola da otto lettere si spezzava e la terza riga
// usciva dal fondo. Un conto in caratteri non lo vede: «Illimitable» e
// «Mummwwmm» hanno le stesse lettere e larghezze diverse.
//
// Quindi il gradino resta il TETTO, e sotto il tetto si misura: le larghezze
// vere del Cormorant Garamond (centesimi di em, prese dal carattere nel
// browser), la parola piu' larga contro la larghezza del riquadro, le righe
// contro la sua altezza. E' un disegno su una copertina, non testo
// dell'interfaccia: sotto il gradino piu' piccolo si scende, come scende il
// titolo stampato su una copertina vera in miniatura.
const LARGHEZZE = {
  15: "'",
  19: "’‘·",
  20: ".:",
  22: ",`",
  23: " ;",
  26: "!jl",
  27: "[]i",
  29: '"{}',
  30: "f",
  31: "()",
  32: "-",
  33: "1J",
  34: "?Ist",
  35: "/\\“”",
  37: "r",
  40: "23+_z",
  41: "5<>e",
  42: "$ac",
  43: "7y",
  44: "vx~",
  45: "4*g",
  46: "69",
  47: "=«»",
  49: "08ko",
  50: "hqu",
  51: "Sbdp–",
  52: "Fn",
  54: "#L",
  55: "EP",
  58: "%B",
  60: "Z",
  62: "Y",
  64: "T",
  65: "KX",
  66: "V",
  67: "…",
  68: "Cw",
  69: "R",
  70: "DU",
  71: "&A",
  73: "G@N",
  76: "H",
  77: "OQm",
  83: "—",
  85: "M",
  92: "W",
};
const EM = new Map(Object.entries(LARGHEZZE).flatMap(([c, lettere]) => [...lettere].map((l) => [l, c / 100])));
// una lettera che la tavola non ha: larga come una maiuscola, e un segno di
// un altro alfabeto quanto il suo quadrato
const emDi = (l) => EM.get(l) ?? EM.get(l.normalize("NFD")[0]) ?? (l.codePointAt(0) >= 0x2e80 ? 1 : 0.7);
export const larghezzaEm = (testo) => [...String(testo || "")].reduce((s, l) => s + emDi(l), 0);

export const INTERLINEA_TITOLO = 1.22;

// MA LA TAVOLA E' UNA STIMA, E IL BROWSER HA L'ULTIMA PAROLA (la scena in CI:
// «Oathbringer» e «l'apprendista» spezzate, e qui no). Dove le lettere si
// aggiustano al pixel (`--font-render-hinting`, il browser della CI) ogni
// parola e' piu' larga della tavola, fino al 10% a 15 px; e l'aggiustamento
// cambia col corpo, quindi non c'e' un fattore che lo corregga. Chi chiama
// puo' dare la sua misura: il dorso da' il `measureText` del canvas, che
// coincide con l'impaginazione in ogni modo di disegno (confrontati, scarto
// zero). La tavola resta per chi un browser non ce l'ha: le prove in Node.
export const suTavola = (testo, corpo) => larghezzaEm(testo) * corpo;

// i pezzi che il browser puo' mandare a capo: le parole, e dopo un trattino
const pezziDi = (titolo) =>
  String(titolo || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((parola) => parola.split(/(?<=-)(?=.)/));

// quante righe prende il titolo a quel corpo, in una colonna larga `utile`
function righeIn(parole, corpo, utile, misura) {
  const spazio = misura(" ", corpo);
  let righe = 1;
  let riga = 0;
  for (const pezzi of parole) {
    pezzi.forEach((pezzo, i) => {
      const p = misura(pezzo, corpo);
      const prima = riga > 0 && i === 0 ? spazio : 0;
      if (riga + prima + p > utile) {
        righe += 1;
        riga = p;
      } else riga += prima + p;
    });
  }
  return righe;
}

// UNA PAROLA PIU' LARGA DI COSI' SI SPEZZA: per farla entrare il corpo
// scenderebbe sotto quel che si distingue (sul tablet 11 px e mezzo).
// «Unremembered», che il lettore ha sullo scaffale, a lettere aggiustate al
// pixel e' larga 6,6: sta dentro
export const PAROLA_MAX = 7;
const PASSO = 0.5;
// il browser impagina al sessantaquattresimo di pixel e la tavola e'
// arrotondata al centesimo: una riga piena fino all'orlo sulla carta va a
// capo sullo schermo («della magia» a 18 px riempiva il riquadro esatto, e
// usciva la terza riga)
const MARGINE = 0.97;

// Il corpo in pixel: `massimo` e' il gradino della scala, `larga` e `alta`
// il riquadro del titolo misurato sul dorso, `misura(testo, corpo)` quanto e'
// largo un testo a quel corpo. Il primo colpo viene dalla parola piu' larga
// misurata al gradino; poi si scende finche' entra davvero, a ogni corpo con
// la sua misura.
export function corpoCheEntra(titolo, { larga, alta, massimo }, misura = suTavola) {
  const parole = pezziDi(titolo);
  if (!parole.length || !(larga > 0) || !(alta > 0)) return massimo;
  const utile = larga * MARGINE;
  const minimo = Math.min(massimo, larga / PAROLA_MAX);
  const piuLarga = (corpo) => Math.max(...parole.flat().map((p) => misura(p, corpo)));
  const entra = (corpo) => piuLarga(corpo) <= utile && righeIn(parole, corpo, utile, misura) * corpo * INTERLINEA_TITOLO <= alta;
  let corpo = Math.min(massimo, Math.floor((utile * massimo) / piuLarga(massimo) / PASSO) * PASSO);
  while (corpo > minimo && !entra(corpo)) corpo -= PASSO;
  return Math.max(minimo, corpo);
}

// TITOLO E AUTORE INSIEME, nello spazio del dorso (`larga` per `spazio`: il
// riquadro dentro i margini, che il dorso misura su di se'). L'autore non e'
// mai piu' grosso del titolo: dove il titolo deve rimpicciolirsi sotto di
// lui, scende con lui (e gli lascia lo spazio che perde). Si conta sempre per le sue due
// righe, anche quando ne prende una: contando quelle vere, ogni misura ne
// chiederebbe un'altra al browser.
export const INTERLINEA_AUTORE = 1.3;
export const RIGHE_AUTORE = 2;
// il filetto e il suo margine, sopra l'autore
export const STACCO_AUTORE = 8;

export function corpiDelDorso(titolo, { larga, spazio, tetto, autore = 0 }, misura = suTavola) {
  const entra = (alta) => corpoCheEntra(titolo, { larga, alta, massimo: tetto }, misura);
  const sotto = (corpo) => spazio - (autore ? STACCO_AUTORE + RIGHE_AUTORE * corpo * INTERLINEA_AUTORE : 0);
  let corpoAutore = autore;
  let corpoTitolo = entra(sotto(corpoAutore));
  if (corpoAutore > corpoTitolo) {
    corpoAutore = corpoTitolo;
    corpoTitolo = entra(sotto(corpoAutore));
  }
  return { titolo: corpoTitolo, autore: corpoAutore };
}
