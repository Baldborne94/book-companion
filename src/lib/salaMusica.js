// LA SALA DELLA MUSICA COME UN LETTORE MUSICALE (`components/MusicRoom.jsx`,
// `test/sala-musica.test.mjs`; chiesto dal lettore con la foto della sala,
// dopo che la cartella «Music» gli aveva portato 87 brani: «riesci a
// rendermelo come una piccola app musicale affinché sia più ordinato e non
// sia una sfilza lunghissima di brani uno sotto l'altro, ma con ricerca,
// selezione e tutto ciò che richiede un player musicale?»).
//
// Qui le decisioni, senza JSX: cosa trova una ricerca, in che ordine stanno
// i brani, sotto quale lettera, quale vista si apre.

const ordineNaturale = new Intl.Collator("it", { numeric: true, sensitivity: "base" });

// le parole come si cercano: senza accenti, senza maiuscole, la
// punteggiatura e' uno spazio («Warhammer 40,000» si trova con «40 000»)
export const normale = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

// OGNI PAROLA CERCATA DEVE ESSERCI, in qualunque ordine e anche a meta'
// («templ black» trova «Black Templars»): si scrive quel che ci si ricorda
export function corrisponde(cerca, nome) {
  const parole = normale(cerca).split(" ").filter(Boolean);
  if (!parole.length) return true;
  const n = normale(nome);
  return parole.every((p) => n.includes(p));
}

export const ORDINI = [
  { id: "nome", nome: "A–Z" },
  { id: "recenti", nome: "Ultimi arrivati" },
];

// i brani vivi che la ricerca trova, nell'ordine scelto: i nomi coi numeri
// contati da numeri («2 -» prima di «10 -»), gli ultimi arrivati in cima
export function braniInVista(favs, { cerca = "", ordine = "nome" } = {}) {
  const vivi = favs.filter((f) => !f.deleted && corrisponde(cerca, f.name));
  if (ordine === "recenti") return vivi.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0) || ordineNaturale.compare(a.name || "", b.name || ""));
  return vivi.sort((a, b) => ordineNaturale.compare(a.name || "", b.name || ""));
}

// la lettera sotto cui sta un brano: cifre e simboli insieme sotto «#»
export function letteraDi(nome) {
  const c = normale(nome).charAt(0);
  return /[a-z]/.test(c) ? c.toUpperCase() : "#";
}

// LE LETTERE DELL'INDICE, una per gruppo di nomi: ogni brano tiene il suo
// posto nella lista, cosi' toccarlo suona da li' in avanti la lista intera
export function perLettera(brani) {
  const gruppi = [];
  brani.forEach((f, i) => {
    const lettera = letteraDi(f.name);
    const ultimo = gruppi[gruppi.length - 1];
    if (ultimo && ultimo.lettera === lettera) ultimo.brani.push({ f, i });
    else gruppi.push({ lettera, brani: [{ f, i }] });
  });
  return gruppi;
}

// le raccolte vive che la ricerca trova, nell'ordine in cui le hai fatte
export const raccolteInVista = (raccolte, cerca = "") =>
  raccolte.filter((r) => !r.deleted && corrisponde(cerca, r.name));

// in quante raccolte sta un brano: si dice nella riga, e il menu del brano
// mette e toglie
export const inQuante = (fav, raccolte) =>
  raccolte.filter((r) => !r.deleted && (r.brani || []).includes(fav.id)).length;

// QUALE VISTA SI APRE: quella lasciata l'ultima volta; la prima volta le
// raccolte se ce ne sono, se no i brani
export function vistaIniziale(salvata, quanteRaccolte) {
  if (salvata === "raccolte" || salvata === "brani") return salvata;
  return quanteRaccolte > 0 ? "raccolte" : "brani";
}

// del dispositivo, non della biblioteca: sul tablet a letto si cercano le
// raccolte, sul PC magari i brani
const VISTA = "bc_musica_vista";
const ORDINE = "bc_musica_ordine";
const leggi = (k) => {
  try {
    return globalThis.localStorage?.getItem(k) || null;
  } catch {
    return null;
  }
};
const scrivi = (k, v) => {
  try {
    globalThis.localStorage?.setItem(k, v);
  } catch {
    /* una preferenza che non si salva non e' un guasto */
  }
};
export const vistaSalvata = () => leggi(VISTA);
export const salvaVista = (v) => scrivi(VISTA, v);
export const ordineSalvato = () => (ORDINI.some((o) => o.id === leggi(ORDINE)) ? leggi(ORDINE) : "nome");
export const salvaOrdine = (v) => scrivi(ORDINE, v);
