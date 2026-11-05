// IL TEMPO CHE RESTA, AL CAPITOLO E ALLA FINE. Chiesto dal lettore, fra le
// cose dei Kindle che mancavano: «fai il tempo che resta nel capitolo e nel
// libro».
//
// Il PDF ha gia' la sua stima (`readingSpeed.js`: la mediana delle voltate
// del dispositivo per pagina A4). Nell'ePub la pagina a schermo dipende dal
// corpo del testo e dal verso del tablet: si misura sul TESTO, in locations
// di epub.js (600 caratteri, lo stesso metro di «pag. n di tot»), e nei
// fumetti sulle pagine. Il passo e' DEL LIBRO, perche' un fumetto e un
// romanzo non si leggono allo stesso ritmo, e parte da un passo iniziale
// che la misura rimpiazza a poco a poco (`PESO_INIZIALE` unita' di prior):
// alla prima pagina c'e' gia' un numero, e dopo qualche pagina e' il tuo.
//
// Le regole che tengono onesta la stima sono quelle di `readingSpeed.js`:
// un tratto sotto i due secondi e mezzo e' sfogliare, sopra i quattro
// minuti hai posato il libro, e un salto oltre `AVANZO_MAX` unita' e' il
// cursore o una ricerca, non lettura. Tornare indietro non conta. E il
// passo segue il lettore: oltre `FINESTRA` unita' misurate il conto si
// dimezza, cosi' la sera stanca pesa piu' della mattina di un mese fa.
import { formatLeft } from "./readingSpeed.js";

export const CHIAVE = (id) => `bc_passo_${id}`;
// secondi per unita': 600 caratteri a 230 parole al minuto, e una tavola
export const PASSO_INIZIALE = { epub: 25, fumetto: 30 };
export const PESO_INIZIALE = 30;
export const TRATTO_MIN = 2.5;
export const TRATTO_MAX = 240;
export const AVANZO_MAX = { epub: 12, fumetto: 3 };
export const FINESTRA = 600;

// Il tratto fra due posizioni: `secondi` passati, `unita'` avanzate. Un
// tratto scartato torna LO STESSO oggetto: il chiamante lo legge per
// identita' e non scrive su disco (la regola di `pushSample`).
export function aggiornaPasso(rec, secondi, unita, avanzoMax = AVANZO_MAX.epub) {
  if (!(secondi >= TRATTO_MIN && secondi <= TRATTO_MAX)) return rec;
  if (!(unita > 0 && unita <= avanzoMax)) return rec;
  const r = rec && Number.isFinite(rec.s) && Number.isFinite(rec.u) ? rec : { s: 0, u: 0 };
  let s = r.s + secondi;
  let u = r.u + unita;
  if (u > FINESTRA) {
    s /= 2;
    u /= 2;
  }
  return { s: Math.round(s * 10) / 10, u: Math.round(u * 10) / 10 };
}

// secondi per unita': la misura pesata col passo iniziale
export function passoDi(rec, iniziale = PASSO_INIZIALE.epub, peso = PESO_INIZIALE) {
  const s = Number(rec?.s) || 0;
  const u = Number(rec?.u) || 0;
  return (s + iniziale * peso) / (u + peso);
}

export function leggiPasso(id, st = globalThis.localStorage) {
  try {
    const v = JSON.parse(st?.getItem(CHIAVE(id)) || "null");
    return v && Number.isFinite(v.s) && Number.isFinite(v.u) ? v : { s: 0, u: 0 };
  } catch {
    return { s: 0, u: 0 };
  }
}

export function scriviPasso(id, rec, st = globalThis.localStorage) {
  try {
    st?.setItem(CHIAVE(id), JSON.stringify(rec));
  } catch {
    /* una misura che non si scrive non ferma la lettura */
  }
}

// L'ultima location del capitolo in cui sta la location `i`: il capitolo e'
// il documento della spina, che nel CFI e' la parte prima del «!»
// («epubcfi(/6/14[c3]!/4/2/1:0)»). Senza quel segno ogni location e' un
// capitolo a se'.
const spina = (cfi) => {
  const s = String(cfi || "");
  const k = s.indexOf("!");
  return k < 0 ? s : s.slice(0, k);
};
export function fineDelCapitolo(locations, i) {
  if (!Array.isArray(locations) || !Number.isInteger(i) || i < 0 || i >= locations.length) return null;
  const mia = spina(locations[i]);
  let j = i;
  while (j + 1 < locations.length && spina(locations[j + 1]) === mia) j++;
  return j;
}

// In secondi. `qui` e' la posizione corrente (da 0), `fine` quante unita' ha
// il libro, `fineCapitolo` l'ultima unita' del capitolo (o null, dove un
// capitolo non c'e': i fumetti).
export function tempoResta({ qui, fine, fineCapitolo = null, passo } = {}) {
  if (!Number.isFinite(qui) || !Number.isFinite(fine) || !(passo > 0) || qui < 0 || fine <= 0) return null;
  const libro = Math.max(0, fine - qui) * passo;
  const capitolo = Number.isFinite(fineCapitolo) && fineCapitolo >= qui ? (fineCapitolo - qui + 1) * passo : null;
  return { capitolo, libro };
}

// «12 min al capitolo · 3 h alla fine»; «alla fine» e' la parola del PDF
export function fraseResta(resta) {
  if (!resta || !Number.isFinite(resta.libro)) return null;
  const pezzi = [];
  if (Number.isFinite(resta.capitolo)) pezzi.push(`${formatLeft(resta.capitolo * 1000)} al capitolo`);
  pezzi.push(`${formatLeft(resta.libro * 1000)} alla fine`);
  return pezzi.join(" · ");
}
