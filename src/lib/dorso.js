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
