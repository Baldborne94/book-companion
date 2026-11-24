// LEGGI AD ALTA VOCE: la sintesi vocale del sistema (Web Speech), che su
// Chrome Android ha le voci di Google, italiane e inglesi, anche senza rete.
//
// SI LEGGE UNA PAGINA ALLA VOLTA, quella a schermo: il reader sa dove
// comincia e dove finisce (`currentLocation`), e girare pagina quando la
// voce arriva in fondo è il gesto che il lettore conosce già. La frase che
// scavalca il bordo non si spezza in due: il pezzo senza punto in fondo alla
// pagina (`coda`) aspetta e si legge attaccato all'inizio della pagina dopo.
//
// SI PARLA A FRASI, e non per pigrizia: una battuta sola lunga una pagina
// su Chrome si ammutolisce a metà senza dire niente, e la pausa non torna
// indietro di una frase ma di una pagina. A frasi la pausa riprende dalla
// frase in cui si era, e un intoppo costa una frase.

export const VELOCITA = [0.8, 1, 1.2, 1.5];
export const FRASE_MAX = 280;
const CODA_MAX = 400;
const KEY = "bc_voce";

const FINE = /[.!?…]+["'»”’)\]]*$/;

// Le frasi di un testo, nell'ordine. Un a capo chiude sempre (un titolo non
// ha il punto e non deve fondersi col paragrafo sotto), e una frase troppo
// lunga si taglia a una pausa sua — punto e virgola, due punti, virgola —
// o, se non ne ha, a uno spazio.
export function frasi(testo) {
  return intere(testo).flatMap(taglia);
}

function intere(testo) {
  const out = [];
  for (const riga of String(testo || "").split(/\n+/)) {
    const pulita = riga.replace(/\s+/g, " ").trim();
    if (!pulita) continue;
    // il punto chiude solo se dopo c'è uno spazio e non una minuscola:
    // «3.5», «ecc. e poi» e «“Vattene!” disse» non sono la fine di niente
    const pezzi = pulita.match(/.+?(?:[.!?…]+["'»”’)\]]*(?=\s+(?!\p{Ll})|$)|$)/gu) || [pulita];
    for (const p of pezzi) {
      const f = p.trim();
      if (f) out.push(f);
    }
  }
  return out;
}

function taglia(f) {
  const out = [];
  let resto = f;
  while (resto.length > FRASE_MAX) {
    const testa = resto.slice(0, FRASE_MAX);
    let at = Math.max(testa.lastIndexOf("; "), testa.lastIndexOf(": "), testa.lastIndexOf(", "));
    if (at < FRASE_MAX / 3) at = testa.lastIndexOf(" ");
    if (at < 1) at = FRASE_MAX - 1;
    out.push(resto.slice(0, at + 1).trim());
    resto = resto.slice(at + 1).trim();
  }
  if (resto) out.push(resto);
  return out;
}

// Cosa leggere di QUESTA pagina: le frasi intere, con davanti la coda della
// pagina prima, e la nuova coda che resta in sospeso. La coda si tiene solo
// se la pagina finisce a metà frase (niente punto, niente a capo) e non è
// un paragrafo intero senza punteggiatura: oltre `CODA_MAX` la si legge.
export function pezziDaLeggere(testo, coda = "") {
  const t = String(testo || "");
  const unito = coda ? `${coda} ${t.replace(/^\s+/, "")}` : t;
  const tutte = intere(unito);
  const chiusa = /\n\s*$/.test(t) || !tutte.length;
  const ultima = tutte[tutte.length - 1];
  if (!chiusa && !FINE.test(ultima) && ultima.length <= CODA_MAX) {
    return { frasi: tutte.slice(0, -1).flatMap(taglia), coda: ultima };
  }
  return { frasi: tutte.flatMap(taglia), coda: "" };
}

// La voce per la lingua del libro. Prima quelle del dispositivo (parlano
// senza rete, ed è il caso del treno), poi quella che il sistema propone,
// poi la forma della lingua di casa sua (it-IT, non it-CH). Nessuna voce
// della lingua: `null`, e la frase parte col solo `lang` — decide il sistema.
export function scegliVoce(voci, lingua) {
  const l = String(lingua || "").slice(0, 2).toLowerCase();
  if (!l) return null;
  const norm = (v) => String(v?.lang || "").replace("_", "-").toLowerCase();
  const sue = (voci || []).filter((v) => norm(v).startsWith(l));
  if (!sue.length) return null;
  const casa = `${l}-${l === "en" ? "us" : l}`;
  const peso = (v) => (v.localService ? 4 : 0) + (v.default ? 2 : 0) + (norm(v) === casa ? 1 : 0);
  return [...sue].sort((a, b) => peso(b) - peso(a))[0];
}

export function prossimaVelocita(v) {
  const i = VELOCITA.indexOf(v);
  return VELOCITA[(i + 1) % VELOCITA.length] ?? 1;
}

export function leggiVelocita(storage = globalThis.localStorage) {
  try {
    const v = Number(JSON.parse(storage.getItem(KEY) || "{}").velocita);
    return VELOCITA.includes(v) ? v : 1;
  } catch {
    return 1;
  }
}

export function scriviVelocita(v, storage = globalThis.localStorage) {
  try {
    storage.setItem(KEY, JSON.stringify({ velocita: v }));
  } catch {
    /* storage pieno: la velocità torna quella di sempre alla prossima */
  }
}

// ---- dal DOM -------------------------------------------------------------

// I richiami delle note (l'«1» in apice), il furigana e gli script non si
// dicono: in bocca sono un numero a caso in mezzo alla frase.
const MUTI = 'sup, rt, rp, script, style, [aria-hidden="true"], [*|type~="noteref"]';
const BLOCCHI = "p, div, h1, h2, h3, h4, h5, h6, li, blockquote, section, article, tr, dt, dd, figcaption, pre, br, hr";

// Il testo fra due punti del capitolo, con un a capo alla fine di ogni
// blocco: senza, `toString` incolla i paragrafi («fine.Inizio») e la
// divisione in frasi perderebbe il confine.
export function testoFra(doc, da, a) {
  const r = doc.createRange();
  // epub.js può tagliare la pagina DENTRO una parola («leng|th»): tutt'e
  // due i bordi tornano all'inizio di quella parola, così la parola sta
  // intera sulla pagina dopo — né detta a metà, né detta due volte
  r.setStart(da.container, aInizioParola(da.container, da.offset));
  r.setEnd(a.container, aInizioParola(a.container, a.offset));
  const pezzo = r.cloneContents();
  pezzo.querySelectorAll(MUTI).forEach((el) => el.remove());
  pezzo.querySelectorAll(BLOCCHI).forEach((el) => el.appendChild(doc.createTextNode("\n")));
  // …ma il blocco in fondo è quasi sempre un paragrafo TAGLIATO dal bordo
  // della pagina (la copia se lo porta dietro intero di tag), e il suo a
  // capo direbbe «finito» a una frase a metà: si toglie, e si rimette solo
  // se la pagina finisce davvero dove finisce il paragrafo
  const t = (pezzo.textContent || "").replace(/\s+$/, "");
  const fine = a.container;
  const chiude = fine.nodeType !== 3 || (a.offset >= fine.length && ultimoTestoDelBlocco(fine));
  return chiude ? `${t}\n` : t;
}

export function aInizioParola(nodo, offset) {
  const t = nodo?.nodeType === 3 ? nodo.data : null;
  if (!t || offset <= 0 || offset >= t.length || /\s/.test(t[offset - 1]) || /\s/.test(t[offset])) return offset;
  let i = offset;
  while (i > 0 && !/\s/.test(t[i - 1])) i -= 1;
  return i;
}

function ultimoTestoDelBlocco(nodo) {
  let n = nodo;
  while (n && n.parentNode) {
    let s = n.nextSibling;
    while (s) {
      if ((s.textContent || "").trim()) return false;
      s = s.nextSibling;
    }
    n = n.parentNode;
    if (n.nodeType === 1 && n.matches?.(BLOCCHI)) return true;
  }
  return true;
}
