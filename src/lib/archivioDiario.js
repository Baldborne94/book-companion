// IL DIARIO NELL'ARCHIVIO (`test/archivio-diario.test.mjs`).
//
// Quaderno delle parole, lista «Da prendere», tempo di lettura, obiettivo
// dell'anno e racconti spuntati viaggiavano nel cloud ma NON nell'archivio
// `.zip`: chi si affida solo all'archivio li perdeva al ripristino, e nessun
// messaggio lo diceva. Adesso stanno nel blocco `diario` dell'indice.
//
// Al ritorno vale la regola di tutto il ripristino — quello che e' gia' qui
// resta com'e', dall'archivio si prende solo cio' che manca — detta per
// ognuna delle cinque forme:
// - quaderno e lista: una voce entra solo se il suo id qui non c'e' affatto.
//   Una LAPIDE di casa e' una presenza (la parola l'avevi tolta apposta), e
//   le lapidi dell'archivio non entrano: cancellerebbero qualcosa che ormai
//   non riguardano piu'. Gli SCARTI della lista invece entrano, o la stessa
//   proposta scartata tornerebbe a farsi avanti.
// - tempo: unione dei cassetti, col valore piu' grande a parita' di giorno —
//   la stessa `fondiTempo` della sincronizzazione, che per costruzione non
//   toglie niente a quel che c'e'.
// - obiettivi: solo gli anni che qui non hanno una scelta.
// - racconti: unione.

import { leggiQuaderno, scriviQuaderno, fondiQuaderno } from "./quaderno.js";
import { leggiDaPrendere, scriviDaPrendere, vive as viveLista } from "./daPrendere.js";
import { leggiTempo, scriviTempo, fondiTempo } from "./tempo.js";
import { leggiObiettivi, scriviObiettivi, fondiObiettivi } from "./obiettivo.js";
import { raccontiLetti, scriviRacconti, fondiRacconti } from "./racconti.js";

const lista = (v) => (Array.isArray(v) ? v.filter((x) => x && typeof x === "object" && x.id) : []);
const oggetto = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
const stringhe = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);

export function diarioPerArchivio() {
  return {
    quaderno: leggiQuaderno(),
    daPrendere: leggiDaPrendere(),
    tempo: leggiTempo(),
    obiettivi: leggiObiettivi(),
    racconti: [...raccontiLetti()].sort(),
  };
}

const giorniDi = (registro) => {
  const s = new Set();
  for (const giorni of Object.values(oggetto(registro))) {
    for (const [g, n] of Object.entries(oggetto(giorni))) if (Number(n) > 0) s.add(g);
  }
  return s;
};

// Quel che c'e' da vedere, per il pannello che chiede cosa portare dentro.
export function contaDiario(d) {
  if (!d || typeof d !== "object") return null;
  const conto = {
    parole: lista(d.quaderno).filter((v) => !v.deleted).length,
    daPrendere: viveLista(d.daPrendere).length,
    giorni: giorniDi(d.tempo).size,
    obiettivi: Object.keys(fondiObiettivi(oggetto(d.obiettivi))).length,
    racconti: stringhe(d.racconti).length,
  };
  return Object.values(conto).some(Boolean) ? conto : null;
}

function aggiungiMancanti(qui, archivio) {
  const noti = new Set(lista(qui).map((v) => v.id));
  const nuove = [];
  for (const v of lista(archivio)) {
    if (v.deleted || noti.has(v.id)) continue;
    noti.add(v.id);
    nuove.push(v);
  }
  return nuove;
}

// Puro: prende quel che c'e' e quel che arriva, torna quel che va scritto e
// i conti di cio' che e' davvero nuovo. `null` in un campo = non toccarlo.
export function pianoDiario(archivio, locale) {
  const a = oggetto(archivio);
  const l = oggetto(locale);
  const out = { quaderno: null, daPrendere: null, tempo: null, obiettivi: null, racconti: null };
  const conti = { parole: 0, daPrendere: 0, giorni: 0, obiettivi: 0, racconti: 0 };

  const paroleNuove = aggiungiMancanti(l.quaderno, a.quaderno);
  if (paroleNuove.length) {
    out.quaderno = fondiQuaderno([...lista(l.quaderno), ...paroleNuove]);
    conti.parole = paroleNuove.length;
  }

  const vociNuove = aggiungiMancanti(l.daPrendere, a.daPrendere);
  if (vociNuove.length) {
    out.daPrendere = fondiQuaderno([...lista(l.daPrendere), ...vociNuove]);
    conti.daPrendere = viveLista(vociNuove).length;
  }

  const prima = giorniDi(l.tempo);
  const tempo = fondiTempo(oggetto(l.tempo), oggetto(a.tempo));
  if (JSON.stringify(tempo) !== JSON.stringify(fondiTempo(oggetto(l.tempo)))) {
    out.tempo = tempo;
    conti.giorni = [...giorniDi(tempo)].filter((g) => !prima.has(g)).length;
  }

  const obQui = fondiObiettivi(oggetto(l.obiettivi));
  const obLa = fondiObiettivi(oggetto(a.obiettivi));
  const anniNuovi = Object.keys(obLa).filter((anno) => !(anno in obQui));
  if (anniNuovi.length) {
    const aggiunti = {};
    for (const anno of anniNuovi) aggiunti[anno] = obLa[anno];
    out.obiettivi = fondiObiettivi(obQui, aggiunti);
    conti.obiettivi = anniNuovi.length;
  }

  const rQui = stringhe(l.racconti);
  const racconti = fondiRacconti(rQui, stringhe(a.racconti));
  if (racconti.length > new Set(rQui).size) {
    out.racconti = racconti.sort();
    conti.racconti = racconti.length - new Set(rQui).size;
  }

  return { scrivi: out, conti };
}

export function ripristinaDiario(archivio) {
  const { scrivi, conti } = pianoDiario(archivio, diarioPerArchivio());
  if (scrivi.quaderno) scriviQuaderno(scrivi.quaderno);
  if (scrivi.daPrendere) scriviDaPrendere(scrivi.daPrendere);
  if (scrivi.tempo) scriviTempo(scrivi.tempo);
  if (scrivi.obiettivi) scriviObiettivi(scrivi.obiettivi);
  if (scrivi.racconti) scriviRacconti(scrivi.racconti);
  return conti;
}

// Le parole per il resoconto e per il pannello; gli zeri non si dicono.
export function frasiDiario(c) {
  if (!c) return [];
  const n = (k, uno, tanti) => (c[k] ? `${c[k]} ${c[k] === 1 ? uno : tanti}` : null);
  return [
    n("parole", "parola del quaderno", "parole del quaderno"),
    n("daPrendere", "libro da prendere", "libri da prendere"),
    n("giorni", "giorno di lettura", "giorni di lettura"),
    n("obiettivi", "obiettivo dell'anno", "obiettivi dell'anno"),
    n("racconti", "racconto spuntato", "racconti spuntati"),
  ].filter(Boolean);
}
