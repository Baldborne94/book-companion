// LETTO NON VUOL DIRE LETTO ADESSO.
//
// Segnalato dal lettore guardando il diario: «non mi aggiungere ogni volta
// libri che metto come letto nel 2026, magari sono solo libri vecchi che
// sto aggiungendo per dire che li ho gia' letti».
//
// `setStatus(id, "read")` scriveva la data di OGGI, sempre — e il diario
// raccoglie per anno di fine: ogni romanzo vecchio messo in biblioteca
// adesso finiva nell'anno in corso, e «Quest'anno hai finito N libri»
// contava letture di dieci anni fa. Nessun errore: un numero, e sbagliato.
//
// Qui si prova la regola nuova da tutt'e due i lati, perche' sbaglia in
// silenzio in tutt'e due i versi: scrivere una data che non c'e' e' una
// bugia, e non scriverla dove il lettore ha davvero finito il libro adesso
// gli cancella l'anno appena fatto.
import { banco } from "./aiuto.mjs";
import {
  setStatus,
  getStatus,
  getStarted,
  getFinished,
  setDates,
  setProgress,
  getUpdatedAt,
  lettoQui,
  annoFinito,
  segnaAnnoFine,
} from "../src/lib/library.js";
import { buildDiary } from "../src/lib/diary.js";

// la memoria finta e' SUA: un test che dipende da quella lasciata su
// `globalThis` da un altro file passa o casca secondo chi gira prima
function memoriaFinta() {
  const dati = new Map();
  globalThis.localStorage = {
    getItem: (k) => (dati.has(k) ? dati.get(k) : null),
    setItem: (k, v) => dati.set(k, String(v)),
    removeItem: (k) => dati.delete(k),
  };
  return dati;
}
const dati = memoriaFinta();

const alle = (t, fn) => {
  const vero = Date.now;
  Date.now = () => t;
  try {
    return fn();
  } finally {
    Date.now = vero;
  }
};

const OGGI = Date.UTC(2026, 8, 20, 10, 0, 0);
const pulisci = () => dati.clear();

export default async (t) => {
  // ── UN LIBRO MAI APERTO E' UNA DICHIARAZIONE SUL PASSATO ──────────────
  pulisci();
  alle(OGGI, () => setStatus("vecchio", "read"));
  t.eq("il libro mai aperto non prende la data di oggi", getFinished("vecchio"), 0);
  t.eq("e non si inventa nemmeno l'inizio", getStarted("vecchio"), 0);
  t.eq("ma resta letto", getStatus("vecchio"), "read");
  t.c("e la riga si timbra lo stesso, o non salirebbe nel cloud", getUpdatedAt("vecchio", 0) > 0);

  // ── QUELLO CHE HAI LETTO QUI LA DATA CE L'HA ──────────────────────────
  pulisci();
  setDates("qui", { started: OGGI - 5 * 86400000 });
  alle(OGGI, () => setStatus("qui", "read"));
  t.eq("col segno d'inizio la data di oggi si scrive", getFinished("qui"), OGGI);
  t.eq("e l'inizio resta quello vero", getStarted("qui"), OGGI - 5 * 86400000);

  // il progresso da solo basta: un archivio vecchio puo' avere il segno di
  // lettura senza la data d'inizio, e quel libro l'hai letto qui lo stesso
  pulisci();
  setProgress("mezzo", 0.4);
  alle(OGGI, () => setStatus("mezzo", "read"));
  t.eq("col solo progresso la data di fine si scrive", getFinished("mezzo"), OGGI);
  t.eq("ma l'inizio non si inventa: sarebbe «letto in un giorno»", getStarted("mezzo"), 0);

  pulisci();
  t.eq("nessun segno, nessuna lettura qui", lettoQui("nuovo"), false);
  setProgress("nuovo", 0.01);
  t.eq("un filo di progresso basta", lettoQui("nuovo"), true);

  // ── LA STRADA NORMALE NON CAMBIA ──────────────────────────────────────
  pulisci();
  alle(OGGI - 86400000, () => setStatus("normale", "reading"));
  t.eq("aprire un libro segna l'inizio", getStarted("normale"), OGGI - 86400000);
  alle(OGGI, () => setStatus("normale", "read"));
  t.eq("finirlo segna la fine", getFinished("normale"), OGGI);
  t.eq("e l'inizio resta", getStarted("normale"), OGGI - 86400000);

  // ── ABBANDONARE NON INVENTA UN INIZIO ─────────────────────────────────
  //
  // E' la porta di servizio della stessa bugia: con un inizio finto addosso,
  // lo stesso libro dichiarato «letto» un minuto dopo si prenderebbe l'anno
  // in corso — `lettoQui` troverebbe quella data e direbbe di si'.
  pulisci();
  alle(OGGI, () => setStatus("mollato", "abandoned"));
  t.eq("abbandonato senza averlo aperto non ha un inizio", getStarted("mollato"), 0);
  alle(OGGI, () => setStatus("mollato", "read"));
  t.eq("e dichiararlo letto non gli da' la data di oggi", getFinished("mollato"), 0);

  pulisci();
  setDates("mollatoVero", { started: OGGI - 90 * 86400000, finished: OGGI - 80 * 86400000 });
  alle(OGGI, () => setStatus("mollatoVero", "abandoned"));
  t.eq("abbandonare toglie la data di fine", getFinished("mollatoVero"), 0);
  t.eq("ma l'inizio vero resta", getStarted("mollatoVero"), OGGI - 90 * 86400000);

  pulisci();
  setDates("azzera", { started: OGGI - 10, finished: OGGI });
  localStorage.setItem("bc_status_azzera", "read");
  alle(OGGI, () => setStatus("azzera", "unread"));
  t.eq("tornare a «da leggere» azzera l'inizio", getStarted("azzera"), 0);
  t.eq("e la fine", getFinished("azzera"), 0);

  // ── L'ANNO SCRITTO A MANO ─────────────────────────────────────────────
  pulisci();
  t.eq("un libro senza data non ha anno", annoFinito("a"), 0);
  t.eq("un anno vero si accetta", segnaAnnoFine("a", "2019"), true);
  t.eq("e si rilegge", annoFinito("a"), 2019);
  const v = getFinished("a");
  t.eq("la data si posa a luglio", new Date(v).getMonth(), 6);
  t.eq("il primo del mese", new Date(v).getDate(), 1);
  // META' ANNO E MEZZOGIORNO: e' quello che tiene l'anno al suo posto su
  // ogni fuso. Col primo di gennaio, mezza giornata di scarto lo butta
  // nell'anno prima — cioe' il difetto che questo campo viene a curare.
  const QUATTORDICI_ORE = 14 * 3600 * 1000;
  t.eq("nessun fuso lo sposta indietro", new Date(v - QUATTORDICI_ORE).getFullYear(), 2019);
  t.eq("ne' avanti", new Date(v + QUATTORDICI_ORE).getFullYear(), 2019);
  t.c("scrivere l'anno timbra la riga", getUpdatedAt("a", 0) > 0);
  // DICHIARATO: a portare l'anno e' META' ANNO, non il mezzogiorno. Messa
  // l'ora a zero non casca niente — il primo luglio a mezzanotte piu' o
  // meno quattordici ore e' ancora luglio — e resta scritta 12 perche'
  // «mezzogiorno di mezzo anno» dice da se' cosa sta facendo. Chi un giorno
  // spostasse la data a gennaio, invece, trova i due controlli qui sopra.

  // un anno a meta' battitura non si scrive: rifiutarlo e lasciare quello
  // salvato e' la sola cosa da fare mentre il dito sta ancora scrivendo
  t.eq("«20» non e' un anno", segnaAnnoFine("a", "20"), false);
  t.eq("e non tocca quello che c'era", annoFinito("a"), 2019);
  t.eq("nemmeno l'anno prossimo", segnaAnnoFine("a", String(new Date().getFullYear() + 1)), false);
  t.eq("e quello che c'era resta", annoFinito("a"), 2019);

  // LA DATA ESATTA NON SI BUTTA. Un libro letto qui ha il giorno preciso e
  // la durata; riscrivendola a ogni giro diventerebbe un primo luglio
  // qualunque solo perche' hai riaperto la scheda.
  pulisci();
  setDates("preciso", { started: Date.UTC(2026, 2, 6, 9), finished: Date.UTC(2026, 2, 12, 9) });
  const esatta = getFinished("preciso");
  t.eq("lo stesso anno si accetta", segnaAnnoFine("preciso", "2026"), true);
  t.eq("ma il giorno esatto resta", getFinished("preciso"), esatta);

  pulisci();
  segnaAnnoFine("b", "2019");
  t.eq("il campo vuoto toglie la data", segnaAnnoFine("b", ""), true);
  t.eq("e il libro resta senza anno", annoFinito("b"), 0);

  // ── IL DIARIO: UN TERZO MUCCHIO ───────────────────────────────────────
  const LIBRI = [
    { id: "d1", title: "Con data" },
    { id: "d2", title: "Senza data" },
    { id: "d3", title: "Abbandonato" },
    { id: "d4", title: "In lettura" },
    { id: "d5", title: "Altro senza data" },
  ];
  const STATO = {
    d1: { started: Date.UTC(2024, 0, 2), finished: Date.UTC(2024, 0, 9), status: "read" },
    d2: { started: 0, finished: 0, status: "read" },
    d3: { started: Date.UTC(2024, 5, 1), finished: 0, status: "abandoned" },
    d4: { started: Date.UTC(2026, 5, 1), finished: 0, status: "reading" },
    d5: { started: 0, finished: 0, status: "read" },
  };
  const diario = buildDiary(LIBRI, (id) => STATO[id]);
  t.eq("l'annata tiene solo chi ha la data", diario.years.length, 1);
  t.eq("e dentro c'e' un libro solo", diario.years[0].entries.length, 1);
  t.eq("l'anno e' quello della data, non quello di oggi", diario.years[0].year, 2024);
  t.eq("i letti senza anno stanno a parte", diario.senzaData.length, 2);
  t.eq("in ordine alfabetico, che e' l'unico che hanno", diario.senzaData[0].book.id, "d5");
  t.eq("il totale li conta: li hai letti", diario.total, 3);
  t.eq("l'abbandonato non e' fra loro", diario.senzaData.some((e) => e.book.id === "d3"), false);
  t.eq("e nemmeno fra i finiti", diario.years[0].entries.some((e) => e.book.id === "d3"), false);
  t.eq("chi sta leggendo resta sul comodino", diario.reading.length, 1);
  t.eq("un letto senza data non e' sul comodino", diario.reading[0].book.id, "d4");
  t.c("e il mucchio senza anno si riconosce dalla riga", diario.senzaData.every((e) => e.senza === true));
};
