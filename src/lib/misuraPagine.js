// LE PAGINE SI MISURANO UN CAPITOLO ALLA VOLTA, E UN CAPITOLO CHE NON
// RISPONDE COSTA SE STESSO E BASTA.
//
// Segnalato dal lettore con la fotografia di un Goosebumps aperto: «come
// mai su goosebumps ti blocchi sul misurare le pagine?». In fondo alla
// pagina restava «misuro le pagine…» per sempre — niente percentuale,
// niente conto delle pagine, la barra del progresso spenta, e in biblioteca
// quel romanzo fermo a zero per quanto lo leggessi, perche' il progresso si
// scrive dalle locations e quelle non arrivavano mai.
//
// LA CAUSA NON E' IL LIBRO, E' A CHI LO CHIEDEVAMO. `locations.generate`
// di epub.js mette un compito per capitolo in una coda che gira dentro un
// `requestAnimationFrame`, e la promessa che torna si chiude quando la coda
// si svuota. Riprodotto al banco con sei ePub costruiti apposta: un
// capitolo che nello zip non c'e', uno senza `<body>`, uno con l'XML
// malformato, uno senza testo — tutti e quattro **la misura la finisce lo
// stesso**, perche' un rifiuto la coda lo incassa. Ma un lancio SINCRONO
// no: scappa dal giro della coda, la coda non si svuota piu', e quella
// promessa non si chiude mai — non si rompe, non si lamenta, resta li'
// (Chromium l'ha proprio buttata via per garbage collection a meta' del
// banco). Un lancio sincrono da quella parte c'e' eccome: `archive.request`
// passa il percorso per `decodeURIComponent`, che davanti a un `%` solitario
// nel nome di un file alza una URIError e basta — al banco e' la sola scena
// delle sei che non e' mai tornata.
//
// Quindi la misura se la fa l'app, capitolo per capitolo, e sono tre regole:
//
// (1) OGNI CAPITOLO NEL SUO `try`, come le tre strade della copertina: un
//     lancio — sincrono o no — costa quel capitolo, non il libro. Le pagine
//     escono un filo lunghe e il conto resta buono; senza, non esce niente.
// (2) UN CAPITOLO CHE NON TORNA HA UN TETTO (`ATTESA`). Il `try` prende
//     quel che esplode, non quel che resta appeso: una promessa che non si
//     chiude non e' un errore, e senza un tetto il giro si fermerebbe li'
//     esattamente come prima.
// (3) E IL GIRO INTERO NE HA UNO SUO (`SCADENZA`). E' il tetto del tetto:
//     con duecento capitoli muti il primo da solo non basta piu'. Sta
//     larghissimo apposta — un libro che dopo due minuti non ha finito di
//     misurarsi non sta per finire, e nel frattempo il lettore legge — cosi'
//     non tronca mai la misura lunga ma vera di un libro grosso.
//
// Si guadagna anche il tempo: epub.js aspetta 100ms fra un capitolo e
// l'altro, che su settanta capitoli sono sette secondi di sola attesa. Qui
// il respiro e' un giro di `setTimeout`, giusto perche' il browser possa
// disegnare fra un capitolo e l'altro: il libro e' gia' aperto e si sta
// leggendo, quindi questa misura non deve mai tenersi il filo principale.
//
// Il conto si consegna a epub.js con `locations.load`, che e' la stessa
// porta da cui entra la misura salvata su disco: niente campi privati.

// otto secondi per un capitolo: aprire e leggere un documento da dentro uno
// zip gia' in memoria sono millisecondi, e un capitolo da qualche megabyte
// su un tablet lento resta comodamente sotto
export const ATTESA = 8000;
// due minuti per il libro intero, che e' un tetto e non un traguardo
export const SCADENZA = 120000;

const respiro = () => new Promise((r) => setTimeout(r, 0));

// La promessa che non si chiude e' il difetto da cui nasce tutto questo
// file: `Promise.race` le mette accanto un orologio. Quella appesa resta
// appesa — non c'e' modo di disfarla — ma non ci resta appeso il giro.
export function conAttesa(promessa, ms) {
  let t;
  return Promise.race([
    Promise.resolve(promessa).finally(() => clearTimeout(t)),
    new Promise((_, no) => {
      t = setTimeout(() => no(new Error("capitolo muto")), ms);
    }),
  ]);
}

export async function misuraPagine(eb, { chars = 600, attesa = ATTESA, scadenza = SCADENZA, adesso = Date.now } = {}) {
  const sezioni = [];
  // solo i capitoli della lettura, come fa `generate`: le pagine di
  // contorno fuori dalla spina lineare non contano nel conto del libro
  eb.spine.each((s) => {
    if (s?.linear) sezioni.push(s);
  });
  const carica = eb.load.bind(eb);
  const locations = [];
  let rotti = 0;
  let interrotta = false;
  const fine = adesso() + scadenza;

  for (const sez of sezioni) {
    if (adesso() >= fine) {
      interrotta = true;
      break;
    }
    try {
      // la chiamata sta DENTRO il `try`, non solo l'attesa: il lancio che
      // appende epub.js e' sincrono, e arriva da qui
      const contenuto = await conAttesa(sez.load(carica), attesa);
      const pezzo = eb.locations.parse(contenuto, sez.cfiBase, chars);
      for (const l of pezzo || []) locations.push(l);
    } catch {
      rotti += 1;
    } finally {
      // il capitolo si scarica comunque, com'e' andata com'e' andata: e'
      // quel che fa epub.js, e tenerselo in memoria a ogni apertura
      // sarebbe il libro intero sbobinato per una misura
      try {
        sez.unload();
      } catch {
        /* gia' scaricato */
      }
    }
    await respiro();
  }

  // INTERA vuol dire «si puo' tenere su disco»: nessun capitolo perso,
  // nessun tetto scattato, e soprattutto QUALCOSA da tenere — una misura
  // vuota scritta in cache sarebbe un libro senza pagine per sempre, e
  // nessun errore lo direbbe mai.
  return { locations, rotti, interrotta, intera: !rotti && !interrotta && locations.length > 0 };
}
