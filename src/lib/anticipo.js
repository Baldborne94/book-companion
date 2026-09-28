// IL VOLUME DOPO SCENDE MENTRE LEGGI QUELLO PRIMA.
//
// Chiesto dal lettore fra le cose da fare con Google Drive: finito un
// volume in treno, il seguito era lassu' e senza rete non si apriva. Qui si
// decide SE portarlo giu' e QUALE; la rete e i byte stanno in `sync.js`
// (`anticipaFile`), e chi chiama e' App, a ogni voltata del reader.
//
// Tre cose si decidono qui perche' sbagliano in silenzio:
//
// 1. LA RETE. Chrome Android (il browser del lettore, anche dentro l'APK)
//    dice che rete usi (`navigator.connection.type`); un browser che non lo
//    dice (Firefox) non fa mai scattare «solo in Wi‑Fi», e la pagina lo
//    dice invece di fingere; chi vuole lo stesso sceglie «Sempre». Dove il browser lo dice, il cellulare e il «risparmio
//    dati» chiesto dal sistema fermano tutto — anche su «Sempre»: il
//    risparmio dati e' una scelta del lettore fatta altrove, e vale.
// 2. IL VOLUME. E' `nextInSaga`, lo stesso «prossimo» che la scheda di fine
//    libro propone: due risposte diverse alla stessa domanda farebbero
//    scendere un libro e proporne un altro. Un ebook TOLTO a mano non
//    scende mai: il lettore ha appena detto che quel file non lo vuole qui.
// 3. IL MOMENTO. Da `ANTICIPO_DA` del libro in mano, non all'apertura: un
//    romanzo lasciato a pagina trenta non deve riempire il tablet col suo
//    seguito.

export const SCELTE_ANTICIPO = [
  { id: "wifi", label: "Solo in Wi‑Fi" },
  { id: "sempre", label: "Sempre" },
  { id: "mai", label: "Mai" },
];
export const ANTICIPO_KEY = "bc_anticipo";
export const SCELTA_DEFAULT = "wifi";
// a che punto del libro in mano si comincia a pensare al seguito
export const ANTICIPO_DA = 0.7;
// un fumetto da un giga non si scarica di nascosto: si legge da Drive a
// pagine (`leggereDaLontano`) o si porta giu' a mano con «Porta qui i tomi»
export const ANTICIPO_MAX = 200 * 1024 * 1024;

// una scelta che non e' nessuna delle tre vale quella di partenza, come la
// svolta e i paragrafi: un valore storto non deve accendere «Sempre»
export function sceltaAnticipo(valore) {
  return SCELTE_ANTICIPO.some((s) => s.id === valore) ? valore : SCELTA_DEFAULT;
}

export function leggiAnticipo(storage = globalThis.localStorage) {
  try {
    return sceltaAnticipo(storage?.getItem(ANTICIPO_KEY));
  } catch {
    return SCELTA_DEFAULT;
  }
}

export function scriviAnticipo(valore, storage = globalThis.localStorage) {
  try {
    storage?.setItem(ANTICIPO_KEY, sceltaAnticipo(valore));
  } catch {}
}

const SENZA_FILI = new Set(["wifi", "ethernet"]);
const A_CONSUMO = new Set(["cellular", "bluetooth", "wimax"]);

// Che rete e': «libera», «a consumo» o «ignota». Un tipo che il browser non
// dice (`unknown`, `none`, `other`, o l'API che manca) e' IGNOTA, mai
// libera: nel dubbio non si scarica, perche' un giga preso sul cellulare
// non si restituisce.
export function comeRete(connessione) {
  if (!connessione) return "ignota";
  if (connessione.saveData) return "a consumo";
  const tipo = String(connessione.type || "");
  if (SENZA_FILI.has(tipo)) return "libera";
  if (A_CONSUMO.has(tipo)) return "a consumo";
  return "ignota";
}

export function reteBuona(scelta, connessione) {
  const s = sceltaAnticipo(scelta);
  if (s === "mai") return false;
  const rete = comeRete(connessione);
  if (rete === "a consumo") return false;
  return s === "sempre" || rete === "libera";
}

// Quale volume portare giu' adesso, o `null`. `prossimo` e `progresso` si
// passano da fuori (sono `nextInSaga` e `getProgress`, che leggono lo
// storage); `qui` dice se i byte sono gia' sul dispositivo; `lassu` torna
// la voce di Drive (`{ byte }`), `true` se il file puo' stare nel secchio
// senza che se ne sappia la misura, o niente se non sta da nessuna parte.
export function daAnticipare(book, { prossimo, progresso, qui, lassu, soglia = ANTICIPO_DA, tetto = ANTICIPO_MAX } = {}) {
  if (!(Number(progresso) >= soglia)) return null;
  const dopo = prossimo;
  if (!dopo?.id) return null;
  if (dopo.fileTolto) return null;
  if (qui?.(dopo.id)) return null;
  const dove = lassu?.(dopo.id);
  if (!dove) return null;
  const byte = Number(dove?.byte);
  if (byte > tetto) return null;
  return dopo;
}

// UN TENTATIVO ANDATO STORTO SI RIFA', MA NON A OGNI VOLTATA. La chiave di
// Google scaduta o una rete che cade sono cose di passaggio: si riprova fra
// `RIPROVA_DOPO`, o un libro da cinquanta voltate farebbe cinquanta
// richieste a vuoto. Quel che e' sceso, era gia' qui o lassu' non c'e' non
// si richiede piu' in questa sessione.
export const RIPROVA_DOPO = 5 * 60 * 1000;
const CHIUSI = new Set(["sceso", "gia", "assente"]);
export function daRiprovare(tentato, adesso = Date.now()) {
  if (!tentato) return true;
  if (CHIUSI.has(tentato.esito)) return false;
  // `in corso` non ha esito: lo scaricamento e' ancora in volo
  if (!tentato.esito) return false;
  return adesso - tentato.ora >= RIPROVA_DOPO;
}

// LA RIGA SOTTO I TASTI DICE COSA SUCCEDE DAVVERO QUI, non cosa promette
// la scelta: «Solo in Wi‑Fi» su un browser che la rete non la dice e' una
// scelta che non scatta mai, e tacerlo vorrebbe dire aspettare un volume
// che non scende.
export function fraseAnticipo(scelta, connessione) {
  const s = sceltaAnticipo(scelta);
  if (s === "mai") return "Niente scende da sé: un libro scende solo quando lo apri.";
  if (connessione?.saveData) return "Il risparmio dati del dispositivo è acceso: finché resta acceso non scende niente da sé.";
  const rete = comeRete(connessione);
  if (s === "wifi" && rete === "ignota")
    return "Questo browser non dice che rete stai usando, quindi così non scende niente da sé. Scegli «Sempre» se vuoi che scenda comunque.";
  if (rete === "a consumo") return "Adesso sei su una rete a consumo: i libri aspettano il Wi‑Fi.";
  if (rete === "ignota") return "Scende su qualunque rete: questo browser non dice se sei sul cellulare.";
  return "Sei in Wi‑Fi: i libri in lettura scendono al prossimo giro, il seguito quando ci arrivi.";
}

// I LIBRI CHE STAI LEGGENDO RESTANO SUL TABLET DA SOLI.
//
// Da quando i libri si leggono da Drive senza scriverli qui, senza rete non
// si apre niente — salvo il seguito, che scende al 70%. Chi legge in treno
// vuole in tasca i libri che ha IN MANO: quelli con lo stato «in lettura»,
// cioe' quello che il lettore ha dichiarato e che la Libreria filtra con lo
// stesso nome. Pochi (`IN_LETTURA_MAX`, i toccati piu' di recente) e mai
// oltre `ANTICIPO_MAX`: un fumetto da un giga non si scarica di nascosto.
// Un ebook tolto a mano non scende mai. Quando li finisci restano: li toglie
// «Libera spazio», che i letti li propone gia'.
export const IN_LETTURA_MAX = 5;

// Quali libri portare giu' adesso, in ordine. Il tetto conta anche quelli
// gia' qui: «cinque libri in tasca», non «cinque in piu' a ogni giro».
export function daTenereInLettura(books, { statusOf, qui, lassu, tocco = () => 0, max = IN_LETTURA_MAX, tetto = ANTICIPO_MAX } = {}) {
  const inLettura = (books || [])
    .filter((b) => b?.id && statusOf?.(b.id) === "reading")
    .sort((a, b) => (tocco(b.id) || 0) - (tocco(a.id) || 0))
    .slice(0, max);
  const out = [];
  for (const b of inLettura) {
    if (b.fileTolto) continue;
    if (qui?.(b.id)) continue;
    const dove = lassu?.(b.id);
    if (!dove) continue;
    if (Number(dove?.byte) > tetto) continue;
    out.push(b);
  }
  return out;
}
