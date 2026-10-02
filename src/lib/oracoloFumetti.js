// L'ORACOLO NEI FUMETTI E NEI MANGA (chiesto dal lettore: «dalli tutti e
// 3»). Un CBZ non ha testo: l'Oracolo dei libri lavora sui passaggi, qui
// guarda le TAVOLE. Tre domande:
// - «Cosa succede in questa tavola?»: la pagina (o le due) a schermo, con la
//   traduzione dei balloon;
// - «Dove eravamo rimasti»: alcune pagine sparse di quel che hai letto di
//   questo volume, fino alla pagina a cui sei;
// - «Chi è costui?»: la tavola col personaggio cerchiato, e le pagine prima.
// Le regole dei libri restano: al modello NON si manda il titolo, e non
// vede mai una pagina dopo quella a cui sei. Le immagini le prepara il
// lettore (`lib/immagineTavola.js`), qui si decide e si chiede.
import { TETTO_BREVE, TETTO_SCHEDA } from "./oracle.js";

// il lato lungo delle immagini mandate: la tavola che si guarda va letta
// (balloon piccoli), le pagine di contorno bastano a riconoscere scene e
// facce, e ognuna costa quanto e' grande
export const LATO_TAVOLA = 1400;
export const LATO_CONTORNO = 900;
export const PAGINE_RIASSUNTO = 10;
export const PAGINE_CHI = 8;
// le ultime pagine si mandano tutte di fila: e' li' che il lettore si e'
// fermato, e un salto proprio li' farebbe perdere il filo
export const DI_FILA = 3;

// QUALI PAGINE: le ultime `DI_FILA` fino alla pagina `n`, il resto sparso
// in modo uniforme dall'inizio del volume. Mai oltre `n`, in ordine, senza
// doppi
export function campionaPagine(n, quante) {
  if (n <= quante) return Array.from({ length: n }, (_, i) => i + 1);
  const coda = Math.min(DI_FILA, quante);
  const ultime = Array.from({ length: coda }, (_, i) => n - coda + 1 + i);
  const resto = quante - coda;
  const fine = n - coda;
  const sparse = Array.from({ length: resto }, (_, i) => 1 + Math.floor((i * fine) / resto));
  // le sparse stanno tutte prima della coda e crescono (n > quante)
  return [...sparse, ...ultime];
}

// il punto toccato sulla tavola, in frazioni dell'immagine: dentro, sempre
export function puntoSullaTavola(x, y, rett) {
  if (!rett?.width || !rett?.height) return null;
  const fx = (x - rett.left) / rett.width;
  const fy = (y - rett.top) / rett.height;
  if (fx < 0 || fx > 1 || fy < 0 || fy > 1) return null;
  return { x: fx, y: fy };
}

const immagine = (im) => ({ type: "image", source: { type: "base64", media_type: im.media || "image/jpeg", data: im.dati } });

const REGOLE = [
  "Rispondi in italiano, senza markdown né elenchi puntati.",
  "Anche se riconosci l'opera, usa solo quello che vedi nelle pagine mostrate:",
  "non rivelare MAI eventi che non compaiono in queste pagine o che vengono dopo.",
].join(" ");

const SISTEMA_TAVOLA = [
  "Sei l'Oracolo di un'app di lettura. Il lettore, italiano, sta leggendo un fumetto",
  "e ti mostra la tavola che ha davanti (una pagina, o due affiancate).",
  "Racconta in poche frasi che cosa succede. Poi, se balloon e didascalie sono in",
  "un'altra lingua, traducili in italiano nell'ordine di lettura, uno per riga,",
  "preceduti da chi parla quando si capisce; se sono già in italiano non ripeterli.",
  "Se il lettore ti fa una domanda, rispondi prima a quella.",
  REGOLE,
].join(" ");

const SISTEMA_RIASSUNTO = [
  "Sei l'Oracolo di un'app di lettura. Il lettore, italiano, riprende un fumetto dopo",
  "una pausa e ti mostra alcune pagine sparse di quello che ha letto di questo volume,",
  "in ordine: l'ultima è quella a cui è arrivato. Racconta la storia fin lì in due-quattro",
  "paragrafi brevi: chi è in scena, che cosa è successo, dove si è fermato.",
  "Fra una pagina e l'altra ne mancano altre: non inventare quel che non vedi, e se un",
  "salto non si capisce dillo.",
  REGOLE,
].join(" ");

const SISTEMA_CHI = [
  "Sei l'Oracolo di un'app di lettura. Il lettore, italiano, sta leggendo un fumetto e",
  "indica un personaggio nella tavola che ha davanti: è dentro il cerchio rosso, che",
  "l'app ha disegnato sopra la tavola e non fa parte del disegno. Prima vedi alcune",
  "pagine precedenti dello stesso volume, poi la tavola. Di' chi è: il nome se compare,",
  "che ruolo ha, che cosa ha fatto finora e con chi. Se dalle pagine non si capisce,",
  "dillo e descrivi quel che si vede. Al massimo due paragrafi brevi.",
  REGOLE,
].join(" ");

const verso = (manga) => (manga ? "È un manga: si legge da destra a sinistra." : null);

// le domande costruite, senza rete: si provano in Node. Le fa partire
// `chiedi` (`lib/oracle.js`), la porta di sempre: chiave, tetto del mese,
// spesa. Le immagini stanno prima del testo che le nomina
export function domandaTavola({ immagini = [], pagine = [], domanda = "", manga = false }) {
  const testo = [
    verso(manga),
    pagine.length > 1 ? `Pagine ${pagine.join(" e ")}.` : pagine.length ? `Pagina ${pagine[0]}.` : null,
    String(domanda || "").trim() ? `Domanda del lettore: «${String(domanda).trim()}»` : null,
  ].filter(Boolean).join("\n");
  return { system: SISTEMA_TAVOLA, user: [...immagini.map(immagine), { type: "text", text: testo || "Che cosa succede in questa tavola?" }], tetto: TETTO_BREVE };
}

export function domandaRiassunto({ pagine = [], fino, manga = false }) {
  const user = [];
  for (const p of pagine) {
    user.push({ type: "text", text: `Pagina ${p.pagina}:` });
    user.push(immagine(p));
  }
  user.push({ type: "text", text: [verso(manga), `Il lettore è arrivato a pagina ${fino}. Dove eravamo rimasti?`].filter(Boolean).join("\n") });
  return { system: SISTEMA_RIASSUNTO, user, tetto: TETTO_SCHEDA };
}

export function domandaChi({ precedenti = [], tavola, pagina, manga = false }) {
  const user = [];
  for (const p of precedenti) {
    user.push({ type: "text", text: `Pagina ${p.pagina}:` });
    user.push(immagine(p));
  }
  user.push({ type: "text", text: `La tavola che il lettore ha davanti (pagina ${pagina}), col personaggio cerchiato:` });
  user.push(immagine(tavola));
  user.push({ type: "text", text: [verso(manga), "Chi è il personaggio nel cerchio rosso?"].filter(Boolean).join("\n") });
  return { system: SISTEMA_CHI, user, tetto: TETTO_SCHEDA };
}
