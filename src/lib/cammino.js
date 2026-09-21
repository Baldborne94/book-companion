import { riconosci, TAVOLE } from "./sagaBooks.js";
import { getStatus, getProgress } from "./library.js";
import { raccontiLetti, chiaveRacconto } from "./racconti.js";

// IL CAMMINO DI UNA SAGA: la guida per intero, e dentro i TUOI libri.
//
// Chiesto dal lettore con in mano la guida di Polygon all'Eresia di Horus:
// «basandoti sulla guida completa e quello che ho in libreria, riesci a
// farmi una cronologia dei libri nell'ordine della guida?».
//
// Lo scaffale sa gia' mettere in fila i volumi che HAI — dentro una saga
// comanda il numero di lettura — ma non puo' dire niente di quelli che non
// hai, e in un percorso da settantuno tappe e' proprio quello che serve
// sapere: dove sei, cosa viene dopo, e quale buco ti aspetta fra due
// capitoli. La tavola quella fila la conosce tutta.
//
// L'ORDINE E' QUELLO DELL'ARRAY, e non si tocca: la tavola e' scritta nel
// verso in cui la guida si legge, con le antologie e i romanzi 40K INFILATI
// dove vanno letti. Riordinare per `o` — il numero del cammino — sembra la
// cosa ovvia e butterebbe in fondo tutto quello che un numero non ce l'ha:
// il prologo, undici antologie e i sette 40K, cioe' meta' della guida.
//
// I LIBRI SI RICONOSCONO PER TITOLO, mai per il campo Saga. E' la riga che
// fa funzionare tutto il resto sul tablet del lettore, dove quei volumi
// stanno sotto una saga scritta a mano («Warhammer 40K») che nessuna tavola
// conosce: la domanda qui non e' «in che saga l'hai messo», e' «questo
// libro e' quella tappa». A rispondere e' `riconosci`, con le sue guardie
// gia' provate — sedici voci dell'Eresia sono parole comuni («Scars»,
// «Mortis») e senza quelle guardie il cammino si riempirebbe di libri che
// non c'entrano niente.
//
// `riconosce` si passa da fuori come `leggiByte`: in Libreria il
// riconoscimento e' gia' fatto una volta per tutti i libri, e rifarlo per
// ogni ripiano a ogni render sarebbe lo stesso giro moltiplicato per venti.
const chiave = (saga, titolo) => `${saga}\u0000${titolo}`;

// IL NUMERO DI LETTURA E' QUELLO CHE LA TAVOLA DICHIARA, MAI IL POSTO
// DELLA RIGA.
//
// Segnalato dal lettore due volte, a un anno di distanza e per due porte
// diverse: «perche' mi dice numero lettura 15 quando e' il primo?» e poi
// «i numeri di lettura riesci a mettermeli giusti?». La prima volta la
// cura fu fare di `o` il numero dei soli ROMANZI, cosi' «Horus Rising» e'
// il primo dell'Eresia e il prologo non gli ruba il posto. La seconda
// volta il quindici era tornato: `numerazioneGuida` contava le righe-file
// del cammino, e davanti a Horus Rising ce ne stanno quattordici — tredici
// di prologo piu' un'antologia.
//
// QUINDI IL NUMERO NON SI CONTA, SI CHIEDE ALLA TAVOLA (`ordine`), che e'
// la stessa funzione da cui lo prende `riconosci` all'import. E' l'unica
// forma che chiude il difetto alla radice: con due numerazioni — 1-39
// dall'import, 1-71 dal pannello — meta' biblioteca finisce su una scala e
// meta' sull'altra, l'ordine non vuol dire piu' niente **e la frontiera
// dell'Oracolo ci crede**. Adesso le due porte scrivono lo stesso numero.
//
// E QUEL CHE LA GUIDA NON NUMERA SI INFILA CON UN DECIMALE, invece di
// restare senza: un volume senza numero la frontiera non lo sa collocare e
// resta FUORI — non e' uno spoiler, e' un buco, e il personaggio conosciuto
// li' per la scheda non esiste. Il prologo, le antologie e i sette 40K sono
// file veri che il lettore ha in mano, e stanno fra due romanzi: prendono
// il numero del romanzo precedente piu' un centesimo per ognuno, nell'ordine
// del cammino. Eisenhorn diventa 0,01 e «Horus Rising» resta 1 — che e'
// esattamente quel che il lettore aveva chiesto tutt'e due le volte. I
// decimali questo campo li regge gia' (Calibre scrive 2.5 per la novella
// fra il secondo e il terzo, e la colonna nel cloud e' `real` apposta).
//
// Il passo e' un centesimo e il vuoto piu' largo della guida ne vale
// quattordici: si resta lontanissimi dal romanzo dopo. L'arrotondamento
// serve perche' 0,1+0,01 in virgola mobile non fa 0,11 tondo, e un numero
// con quindici decimali addosso non e' un numero di lettura.
//
// UN RACCONTO NON HA POSTO, e non e' una svista: non e' un file, non sta in
// nessuna biblioteca, e non c'e' niente su cui scrivere un numero.
const PASSO = 0.01;

export function postiDelCammino(tappe = [], ordine = () => null) {
  let ultimo = 0;
  let quanti = 0;
  return tappe.map((t) => {
    if (t?.voce?.tipo === "racconto") return { ...t, posto: null };
    // e non c'e' nessun controllo che il numero sia un numero: `ordine` e'
    // nostra e le tre tavole tornano un numero o niente. Una guardia in
    // piu' qui non guarderebbe nulla, e una guardia che non guarda e'
    // peggio di nessuna guardia — il prossimo le crede (la lezione di
    // `senzaAutore`): provata, nessuna mutazione la faceva cascare.
    const suo = ordine ? ordine(t?.voce) : null;
    if (suo != null) {
      ultimo = Number(suo);
      quanti = 0;
      return { ...t, posto: ultimo };
    }
    quanti += 1;
    return { ...t, posto: Math.round((ultimo + quanti * PASSO) * 100) / 100 };
  });
}

// E I LIBRI SI CERCANO IN TUTTA LA BIBLIOTECA, NON SUL RIPIANO DA CUI
// PARTE IL TASTO. Preso al banco e non leggendo il codice: seminata la
// scena del lettore, il cammino diceva «hai 1 delle 71 tappe» su dieci
// volumi dell'Eresia in casa. La ragione e' che il tasto vive
// sull'intestazione di un ripiano e gli passava i libri di QUEL ripiano —
// ma i ripiani li fa la saga, e basta che un volume stia sotto un'altra
// grafia («The Horus Heresy» scritta dal riconoscimento accanto al
// «Warhammer 40K» scritto a mano) perche' finisca su un altro ripiano e
// sparisca dal cammino. Cioe' il caso che il cammino deve proprio aiutare
// a vedere era l'unico che non poteva vedere.
//
// `scaffale` resta il ripiano, e serve a una riga sola: «altri N dei tuoi
// libri non stanno in questo percorso». Contata su tutta la biblioteca
// direbbe «altri 242», che non e' un'informazione — e' rumore. Senza
// `scaffale` si conta su quel che si e' ricevuto, com'era prima.
export function camminoDi(libri = [], { tavole = TAVOLE, riconosce, scaffale } = {}) {
  const sapere = riconosce || ((b) => riconosci({ title: b?.title, author: b?.author }));
  const miei = new Map();
  const conti = new Map();
  let riconosciuti = 0;
  for (const b of libri) {
    if (!b) continue;
    const r = sapere(b);
    // senza TITOLO non c'e' una tappa: `riconosci` risponde anche col solo
    // autore («questo e' un Pratchett, la saga gliela do lo stesso»), e li'
    // non sappiamo di quale volume si tratti
    if (!r?.titolo) continue;
    riconosciuti += 1;
    conti.set(r.saga, (conti.get(r.saga) || 0) + 1);
    const k = chiave(r.saga, r.titolo);
    // due copie dello stesso volume sono UNA tappa, e vince la prima:
    // l'ordine in cui arrivano e' quello dello scaffale, non del caso
    if (!miei.has(k)) miei.set(k, b);
  }

  // il ripiano puo' contenere libri di piu' tavole (un volume di un'altra
  // saga finito li' dentro): comanda quella che ne ha di piu', e a parita'
  // la prima dichiarata — un criterio che dipendesse dall'ordine dei libri
  // cambierebbe cammino a ogni import
  let scelta = null;
  for (const tav of tavole) {
    const quanti = conti.get(tav.saga) || 0;
    if (quanti > (scelta?.quanti || 0)) scelta = { tav, quanti };
  }
  if (!scelta) return null;

  // UN RACCONTO NON E' UN FILE, e il suo «ce l'hai» e' quello della sua
  // ANTOLOGIA: «The Aurelian» sta dentro «Eye of Terra», e possederlo vuol
  // dire possedere quel volume. Cercarlo per titolo non troverebbe mai
  // niente, e la guida direbbe «ti manca» su un racconto che hai in mano.
  const tappe = postiDelCammino(
    scelta.tav.libri.map((voce) => ({
      voce,
      libro:
        miei.get(chiave(scelta.tav.saga, voce.tipo === "racconto" ? voce.in || "" : voce.t)) || null,
    })),
    scelta.tav.ordine
  );
  // NON si filtrano qui i racconti, e la ragione va scritta o il prossimo
  // ce la rimette: un racconto porta il libro della sua ANTOLOGIA, che sta
  // gia' in questo insieme per via della propria riga — e un insieme non
  // conta due volte lo stesso id. Il filtro sembrerebbe prudenza e non
  // toglierebbe niente: una guardia che non guarda e' peggio di nessuna
  // guardia (la lezione di `senzaAutore`), e infatti nessuna mutazione la
  // faceva cascare. I conti di possesso restano sui VOLUMI perche' li'
  // ogni tappa-file porta il suo, e i racconti non ne aggiungono.
  const dentro = new Set(tappe.filter((t) => t.libro).map((t) => t.libro.id));
  const contati = (scaffale || libri).filter(Boolean);
  return {
    saga: scelta.tav.saga,
    tappe,
    tue: dentro.size,
    // QUANTI VOLUMI HA LA GUIDA, che non e' quante righe ha la tavola: da
    // quando i racconti hanno una riga per uno, `tappe.length` risponde
    // «110» a una domanda sui libri da avere. Il possesso si conta sui
    // FILE, ed e' questo il numero che sta accanto a `tue`.
    volumi: tappe.filter((t) => t.voce?.tipo !== "racconto").length,
    // quanti ne ha QUESTO ripiano: da quando le tappe si cercano in tutta
    // la biblioteca, `tue` non puo' piu' decidere se il tasto compare —
    // direbbe di si' su ogni scaffale, anche su quello di Piranesi
    dalRipiano: contati.filter((b) => dentro.has(b.id)).length,
    // i tuoi libri che in questo cammino non ci sono: non e' un guaio, e'
    // un'informazione — su un ripiano da trentaquattro volumi dice quanti
    // stanno fuori dalla guida invece di lasciarli contare a mano
    fuori: contati.filter((b) => !dentro.has(b.id)).length,
  };
}

// IL TUO PROSSIMO PASSO NEL CAMMINO.
//
// Chiesto dal lettore indicando il wh-companion: «per la Horus Heresy
// sarebbe possibile usare la stessa logica usata nel progetto del Warhammer
// Companion per il suggerimento dell'ordine di lettura?». Di la' e'
// `getHHNextFromGuide` in `src/lib/readingHelpers.js`: percorre la guida
// parte per parte e torna la prima voce che non hai ancora letto.
//
// Qui la pagina del cammino diceva soltanto «Hai 10 delle 71 tappe»: un
// conto di POSSESSO, non di lettura, e su settantuno righe la domanda vera
// («dove sono arrivato, cosa apro adesso») restava da scorrere a occhio.
//
// TRE COSE NON SI PORTANO DI PESO, e sono quelle che sbagliano in silenzio.
//
// (1) IL PROLOGO NON E' UNA FILA, E' UNA SCELTA. Nella guida sono QUATTRO
// percorsi alternativi — Inquisition, Night Lords, Dark Angels,
// Ultramarines — e ne leggi UNO. Nella nostra tavola sono tredici tappe una
// dietro l'altra, perche' li' servivano a collocare un file sullo scaffale,
// e una camminata «primo non letto» te le infilerebbe tutte e tredici:
// finito Eisenhorn ti direbbe Malleus, poi Hereticus, poi Soul Hunter,
// cioe' il percorso di un'altra fazione. Nessun errore, solo tre romanzi
// che la guida non ti ha mai chiesto.
//
// La referenza risolve saltando il prologo SEMPRE (`if (part.pickOne)
// continue`). Qui si fa un passo meglio, e la ragione e' che le due
// situazioni sono diverse: finche' non ne hai cominciato nessuno la scelta
// e' tua e proporne uno vorrebbe dire sceglierla al posto tuo; ma una volta
// che un percorso l'hai cominciato la scelta l'hai gia' fatta, e il seguito
// di quel percorso e' quel che la guida dice. Quindi: percorso cominciato →
// si segue quello; nessuno cominciato → il prologo non propone niente, e lo
// DICE (`prologo: "scelta"`) invece di tacere, perche' un passo mancante
// senza spiegazione si legge come un guasto.
//
// (2) IL PASSO E' UN ROMANZO. Non si propongono i sette 40K, che la guida
// stessa marca «fuori dall'Eresia» — spingerti su un libro dichiarato
// fuori dalla storia non e' un consiglio, e' un'interruzione (stessa
// scelta della referenza, `if (entry.b40k) continue`) — e non si
// propongono le antologie, e la ragione sta gia' scritta nella tavola:
// «stanno nel percorso per UN racconto alla volta, metterle davanti a un
// romanzo per via di una novella vuol dire rubargli il posto». E' la
// regola per cui un'antologia non ha numero di lettura, e vale identica
// qui. Al banco si vedeva il danno: il passo restava su «Eye of Terra, non
// ce l'hai» mentre il lettore si leggeva mezza Eresia — un'antologia che
// non possiedi non si puo' dichiarare letta, quindi avrebbe bloccato la
// scheda per sempre. Restano tutt'e due nell'elenco, dove il filtro «Ti
// mancano» le mostra: non si propongono, non si nascondono.
//
// Il passo e' quindi sempre o una tappa NUMERATA o il seguito del percorso
// che hai scelto — cioe' esattamente quel che «o» conta nella tavola.
//
// (3) E IL PROSSIMO PASSO PUO' ESSERE UN LIBRO CHE NON HAI. Di la' il
// catalogo e' fisso e ogni voce della guida e' un libro con uno stato; qui
// la biblioteca e' quel che hai importato, e su settantuno tappe il lettore
// ne ha dieci. Un passo che nomina solo quel che possiedi non direbbe mai
// «il prossimo e' Eye of Terra, vallo a prendere», che e' meta' del valore
// di una guida; ma un passo che nomina solo la guida ti lascerebbe senza
// niente da aprire stasera. Sono due domande, e si rispondono tutt'e due:
// `tappa` e' il passo della guida, `apribile` il primo che puoi aprire
// davvero. Quando coincidono la seconda riga non si scrive.
//
// Una tappa e' FATTA se l'hai letta o abbandonata — l'abbandonata per la
// ragione di `maiAperto`: quella storia l'hai lasciata apposta. Quella che
// stai leggendo ADESSO non si scavalca: e' il tuo passo, e si dice
// (`inCorso`). Senza quella riga il cammino ti proporrebbe il volume dopo
// mentre hai questo in mano.
const FATTA = new Set(["read", "abandoned"]);

const tocca = (libro, statoDi, progressoDi) =>
  !!libro && (statoDi(libro.id) !== "unread" || progressoDi(libro.id) > 0);

// `statoDi`/`progressoDi` si passano da fuori come `leggiByte`: stanno in
// `localStorage`, e un test in Node non ce l'ha. I default restano quelli
// VERI — un default finto sarebbe una guardia che non guarda, e il test
// passerebbe grazie a chi ha girato prima.
export function prossimoPasso(
  cammino,
  { statoDi = getStatus, progressoDi = getProgress, spuntati = null } = {}
) {
  const tappe = cammino?.tappe || [];
  if (!tappe.length) return null;
  const letti = spuntati || raccontiLetti();

  // i percorsi alternativi del prologo, raccolti per nome: e' `nota` a
  // dirlo, ed e' l'unica cosa che le distingue l'una dall'altra
  const cominciati = new Set();
  for (const t of tappe) {
    if (t?.voce?.tipo !== "prologo") continue;
    if (tocca(t.libro, statoDi, progressoDi)) cominciati.add(t.voce.nota || "");
  }

  // UN RACCONTO E' FATTO QUANDO L'HAI SPUNTATO, e non c'e' altro modo:
  // non e' un file, non ha uno stato, e l'antologia che lo contiene resta
  // «da leggere» finche' non hai finito tutti e undici i suoi racconti,
  // sparsi su mezza guida.
  const fatta = (t) =>
    t.voce?.tipo === "racconto"
      ? letti.has(chiaveRacconto(t.voce))
      : !!t.libro && FATTA.has(statoDi(t.libro.id));

  // E IL PROLOGO E' PREPARAZIONE, NON UN CANCELLO. Preso al banco e non
  // leggendo il codice: letto Eisenhorn e senza Malleus in casa — che e'
  // la scena del lettore — il passo restava inchiodato su «Malleus, non ce
  // l'hai» per sempre, anche leggendo l'Eresia intera. Un percorso che non
  // puoi finire avrebbe bloccato la scheda a vita. Una volta che una tappa
  // della storia vera l'hai letta sei dentro, e la fondazione e' dietro:
  // da li' il prologo non e' piu' il tuo prossimo passo.
  const entrato = tappe.some((t) => {
    const tipo = t?.voce?.tipo;
    return tipo !== "prologo" && tipo !== "fuori" && fatta(t);
  });

  const inGioco = (t) => {
    const tipo = t?.voce?.tipo;
    if (tipo === "fuori" || tipo === "antologia") return false;
    if (tipo === "prologo") return !entrato && cominciati.has(t.voce.nota || "");
    return true;
  };

  let passo = null;
  let apribile = null;
  for (const t of tappe) {
    if (!inGioco(t) || fatta(t)) continue;
    if (!passo) passo = t;
    if (t.libro) { apribile = t; break; }
  }
  if (!passo) return null;

  // il prologo si nomina solo quando sei PROPRIO all'inizio — nessun
  // percorso cominciato e niente della storia ancora letto. Piu' avanti
  // sarebbe una riga che torna a ogni apertura e si impara a saltare, e a
  // forza di saltarla non si legge nemmeno quella accanto.
  return {
    tappa: passo,
    inCorso: !!passo.libro && statoDi(passo.libro.id) === "reading",
    apribile: apribile === passo ? null : apribile,
    prologo: !cominciati.size && !entrato ? "scelta" : null,
  };
}

// QUANTE NE HAI LETTE, che non e' quante ne hai. Il conto in cima diceva il
// possesso («Hai 10 delle 71 tappe») e va benissimo per sapere cosa ti
// manca di comprare, ma non risponde a «a che punto sono»: si puo' avere
// mezzo percorso sullo scaffale e non averne aperto uno. Si contano le
// tappe che il cammino ti CHIEDE di leggere — le stesse che `prossimoPasso`
// propone, senza i «fuori», senza le antologie e senza i percorsi del
// prologo che non hai scelto — o il denominatore prometterebbe un lavoro
// che la guida non ti ha mai chiesto. E non si conta nemmeno quel che non
// potresti mai spuntare: un'antologia che non possiedi non si puo'
// dichiarare letta, e terrebbe il conto sotto al massimo per sempre.
//
// QUI IL PROLOGO SCELTO CONTA SEMPRE, anche quando `prossimoPasso` ha
// smesso di proporlo perche' sei entrato nella storia: sono due domande
// diverse. «Cosa apro adesso» guarda avanti, e un percorso che ti sei
// lasciato alle spalle non e' avanti; «a che punto sono» guarda il
// cammino che hai scelto, e quei volumi ne fanno parte — toglierli dal
// denominatore quando leggi il primo romanzo lo farebbe CALARE sotto gli
// occhi, che e' il modo piu' sicuro di far sembrare rotto un conto giusto.
export function lettiDelCammino(
  cammino,
  { statoDi = getStatus, progressoDi = getProgress, spuntati = null } = {}
) {
  const tappe = cammino?.tappe || [];
  const letti0 = spuntati || raccontiLetti();
  const cominciati = new Set();
  for (const t of tappe) {
    if (t?.voce?.tipo !== "prologo") continue;
    if (tocca(t.libro, statoDi, progressoDi)) cominciati.add(t.voce.nota || "");
  }
  let letti = 0;
  let quante = 0;
  for (const t of tappe) {
    const tipo = t?.voce?.tipo;
    if (tipo === "fuori" || tipo === "antologia") continue;
    if (tipo === "prologo" && !cominciati.has(t.voce.nota || "")) continue;
    quante += 1;
    // i racconti entrano nel conto come i romanzi: la guida li chiede
    // allo stesso modo, e lasciarli fuori direbbe «42» su un cammino che
    // di passi ne ha ottantuno
    if (tipo === "racconto") {
      if (letti0.has(chiaveRacconto(t.voce))) letti += 1;
    } else if (t.libro && statoDi(t.libro.id) === "read") letti += 1;
  }
  return { letti, quante };
}

// Le tappe raccolte per PARTE, nell'ordine in cui la guida le incontra.
// Si raggruppa qui e non nel componente per la ragione di sempre: un
// raggruppamento che rimescola non alza nessun errore, cambia solo
// l'ordine di lettura di una guida — e quello nessuno lo verifica a occhio
// su settantuno righe.
export function perParte(tappe = []) {
  const parti = new Map();
  for (const t of tappe) {
    const nome = t?.voce?.c || "";
    if (!parti.has(nome)) parti.set(nome, []);
    parti.get(nome).push(t);
  }
  return [...parti].map(([parte, dentro]) => ({ parte, tappe: dentro }));
}
