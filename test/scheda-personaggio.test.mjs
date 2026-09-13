// LA SCHEDA PERSONAGGIO: le regole di «Chi è costui?» che decidono QUALI
// passaggi arrivano al modello. Erano le regole più raccontate di CLAUDE.md
// e le meno difese: una quota sbagliata non dà un errore, dà una scheda che
// salta un volume, e nessuno se ne accorge finché non manca proprio
// l'incontro che il lettore non ricordava.
//
// Si prova senza libri: le menzioni sono record `{ libro, testo, esteso }`
// come li produce la raccolta, e la richiesta al modello passa da un
// `fetch` finto che restituisce quel che gli si è chiesto.
import { movimenti, ripulisci, scegliPassaggi, nuoveMenzioni, chiediChiE, TITOLETTI } from "../src/lib/chiSono.js";

const libro = (id) => ({ id, title: `Titolo di ${id}`, fileType: "epub" });

// n menzioni di un volume, ognuna «ricca» (sopra i 90 caratteri) e diversa
// dalle altre, numerate così da poter risalire alla posizione
const menzioni = (id, n, esteso = 100000) =>
  Array.from({ length: n }, (_, i) => ({
    libro: libro(id),
    esteso,
    testo: `[${id}#${i}] Logen alzò lo sguardo e disse qualcosa di abbastanza lungo perché il passaggio contasse come sostanza vera, non un mezzo rigo.`,
  }));
const indice = (m) => Number(m.testo.match(/#(\d+)\]/)[1]);
const del = (scelti, id) => scelti.filter((m) => m.libro.id === id);

export default async function (t) {
  // ---- I TRE MOVIMENTI --------------------------------------------------
  t.eq("i titoletti sono tre", TITOLETTI.length, 3);
  const tre = movimenti("Ritratto.\n---\nStoria.\n---\nDove.");
  t.eq("tre parti divise da --- diventano tre movimenti", tre?.length, 3);
  t.eq("nell'ordine", tre?.[2], "Dove.");
  t.eq("con spazi attorno ai trattini", movimenti("A\n  ---  \nB\n----\nC")?.length, 3);
  t.eq("due parti: prosa nuda", movimenti("A\n---\nB"), null);
  t.eq("quattro parti: prosa nuda, mai un titolo sul pezzo sbagliato", movimenti("A\n---\nB\n---\nC\n---\nD"), null);
  t.eq("un --- dentro la riga non divide", movimenti("A --- B\n---\nC"), null);
  t.eq("niente risposta, niente movimenti", movimenti(""), null);

  // ---- I DOPPIONI SI SCARTANO -------------------------------------------
  const puliti = ripulisci([
    { testo: "disse Logen, e tacque." },
    { testo: "Disse Logen — e tacque!" },
    { testo: "   " },
    { testo: "Logen annuì." },
  ]);
  t.eq("maiuscole e punteggiatura non fanno due passaggi", puliti.length, 2);
  t.eq("resta il primo arrivato", puliti[0].testo, "disse Logen, e tacque.");
  t.eq("e il vuoto se ne va", puliti.some((m) => !m.testo.trim()), false);

  // ---- POCHI PASSAGGI: si prendono tutti --------------------------------
  t.eq("dieci menzioni, dieci passaggi", scegliPassaggi(menzioni("a", 10), "a").length, 10);
  t.eq("nessuna menzione, nessun passaggio", scegliPassaggi([], "a").length, 0);

  // ---- LA SOSTANZA BATTE IL MEZZO RIGO ----------------------------------
  {
    const magri = Array.from({ length: 30 }, (_, i) => ({ libro: libro("a"), esteso: 1, testo: `[a#m${i}] Logen.` }));
    const scelti = scegliPassaggi([...magri, ...menzioni("a", 30)], "a");
    t.eq("con abbastanza passaggi ricchi, i magri non entrano", scelti.filter((m) => m.testo.length < 90).length, 0);
    const pochi = scegliPassaggi([...magri, ...menzioni("a", 3)], "a");
    t.c("ma meglio i magri del silenzio", pochi.length > 3);
  }

  // ---- IL VOLUME APERTO HA SEMPRE LA SUA QUOTA --------------------------
  // due volumi finiti da 100 menzioni e il corrente da 40: il corrente
  // prende i suoi 16 (5 apertura + 5 corpo + 6 coda), i due di prima 4 a
  // testa — quota PER VOLUME, non in tutto
  {
    const tutti = [...menzioni("v1", 100), ...menzioni("v2", 100), ...menzioni("qui", 40)];
    const scelti = scegliPassaggi(tutti, "qui");
    t.eq("il corrente prende 16", del(scelti, "qui").length, 16);
    t.eq("il primo volume 4", del(scelti, "v1").length, 4);
    t.eq("il secondo volume 4", del(scelti, "v2").length, 4);

    // LA CODA È FITTA E DI FILA: gli ultimi sei, nell'ordine, senza buchi
    const coda = del(scelti, "qui").slice(-6).map(indice);
    t.eq("la coda sono le ultime sei menzioni", JSON.stringify(coda), JSON.stringify([34, 35, 36, 37, 38, 39]));

    // L'APERTURA È SPARSA SUL PRIMO QUINTO, non «le prime cinque di fila»:
    // le prime di fila sono il buongiorno, la premessa occupa il capitolo
    const apertura = del(scelti, "qui").slice(0, 5).map(indice);
    t.c("l'apertura sta nel primo quinto", apertura.every((i) => i < 7), JSON.stringify(apertura));
    t.c("e non sono le prime cinque di fila", apertura.some((i) => i >= 5), JSON.stringify(apertura));
    // e il corpo sta fra apertura e coda
    const corpo = del(scelti, "qui").slice(5, 10).map(indice);
    t.c("il corpo sta in mezzo", corpo.every((i) => i >= 7 && i < 34), JSON.stringify(corpo));
  }

  // ---- LA QUOTA DEI VOLUMI FINITI È A PESO, e il peso sono le MENZIONI ---
  // (segnalato su Best Served Cold e Monza Murcatto): il volume dove il
  // personaggio è protagonista prende di più anche se è il file più corto
  {
    const tutti = [...menzioni("grosso", 10, 900000), ...menzioni("suo", 90, 100000), ...menzioni("qui", 40)];
    const scelti = scegliPassaggi(tutti, "qui");
    t.c(
      "il volume dove compare di più pesa di più",
      del(scelti, "suo").length > del(scelti, "grosso").length,
      `suo ${del(scelti, "suo").length}, grosso ${del(scelti, "grosso").length}`
    );
    // UN POSTO GARANTITO A TESTA: un volume dove compare di sfuggita si
    // dice lo stesso, è proprio l'incontro che il lettore non ricorda
    const sfuggita = [...menzioni("v1", 200), ...menzioni("v2", 1), ...menzioni("qui", 40)];
    t.eq("chi compare una volta ha il suo posto", del(scegliPassaggi(sfuggita, "qui"), "v2").length, 1);
  }

  // ---- UN COFANETTO SONO TRE LIBRI, e la quota si conta a libri --------
  // tre volumi finiti, uno lungo tre volte gli altri: la mediana è la
  // misura di un romanzo, il cofanetto ne vale tre → cinque libri → 16
  // posti ai finiti invece di 12 (mutazione provata: contando i file la
  // quota resta a 12)
  {
    const tutti = [...menzioni("cofanetto", 100, 300000), ...menzioni("b", 100, 100000), ...menzioni("c", 100, 100000), ...menzioni("qui", 40)];
    const scelti = scegliPassaggi(tutti, "qui");
    t.eq("ai finiti vanno 16 posti", scelti.length - del(scelti, "qui").length, 16);
    t.eq("e il corrente tiene i suoi", del(scelti, "qui").length, 16);
  }

  // ---- NEL LIBRO APERTO IL PERSONAGGIO PUÒ NON ESSERE ANCORA COMPARSO ---
  // il ruolo di «dove sei» passa all'ULTIMO volume in cui compare, e gli
  // altri si spartiscono la loro quota — non si tratta la frontiera come
  // un volume solo
  {
    const tutti = [...menzioni("v1", 100), ...menzioni("v2", 100)];
    const scelti = scegliPassaggi(tutti, "qui");
    t.eq("l'ultimo in cui compare fa da volume aperto", del(scelti, "v2").length, 16);
    t.eq("e quello prima tiene la sua quota", del(scelti, "v1").length, 8);
    t.c("e la sua coda è di fila", JSON.stringify(del(scelti, "v2").slice(-6).map(indice)) === JSON.stringify([94, 95, 96, 97, 98, 99]));
  }

  // ---- C'È DEL NUOVO SU DI LUI, DA ALLORA? (la parte senza libro) --------
  const pdf = { id: "p", fileType: "pdf" };
  t.eq("senza il segno di allora si rifà", await nuoveMenzioni(pdf, ["Logen"], null, "10"), true);
  t.eq("senza il segno di adesso si rifà", await nuoveMenzioni(pdf, ["Logen"], "10", null), true);
  t.eq("stesso punto: niente di nuovo, non si rifà", await nuoveMenzioni(pdf, ["Logen"], "10", "10"), false);
  t.eq("tornato indietro: la scheda di allora sa troppo, si rifà", await nuoveMenzioni(pdf, ["Logen"], "10", "5"), true);
  t.eq("senza libro si rifà", await nuoveMenzioni(null, ["Logen"], "1", "2"), true);
  // il file non c'è (qui non c'è IndexedDB): nel dubbio si risponde sì
  t.eq("nel dubbio sì", await nuoveMenzioni(pdf, ["Logen"], "5", "10"), true);

  // ---- LA RICHIESTA AL MODELLO: numeri, mai titoli ----------------------
  const prima = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (k) => (k === "bc_ai_key" ? "prova" : null),
    setItem: () => {},
    removeItem: () => {},
  };
  let chiesto = "";
  let stop = "end_turn";
  const finto = async (_url, opz) => {
    chiesto = JSON.parse(opz.body).messages[0].content;
    return { ok: true, json: async () => ({ content: [{ type: "text", text: "va bene" }], stop_reason: stop }) };
  };
  const tappe = [{ libro: libro("v1") }, { libro: libro("v2") }, { libro: libro("qui") }];
  const passaggi = [menzioni("v1", 1)[0], menzioni("qui", 1)[0]];
  try {
    const r = await chiediChiE({ nome: "Logen", alias: ["Novedita"], passaggi, tappe }, finto);
    t.eq("la risposta arriva", r.answer, "va bene");
    t.eq("e non è tagliata", r.tagliata, false);
    t.c("i volumi si numerano", /\[Volume 1\]/.test(chiesto), chiesto.slice(0, 300));
    t.c("l'ultimo è «dove sta leggendo»", /\[Volume 3, dove sta leggendo\]/.test(chiesto));
    t.c("I TITOLI NON ESCONO MAI", !/Titolo di/.test(chiesto));
    t.c("gli altri nomi si dicono", /«Novedita»/.test(chiesto));
    t.c("e si dice quanti volumi ha letto", /Ha letto 3 volumi/.test(chiesto));

    stop = "max_tokens";
    const tagliata = await chiediChiE({ nome: "Logen", passaggi, tappe }, finto);
    t.eq("una risposta troncata si dichiara", tagliata.tagliata, true);

    const uno = await chiediChiE({ nome: "Logen", passaggi, tappe: [tappe[2]] }, finto);
    t.c("con un libro solo non si parla di saga", uno.answer === "va bene" && /Sta leggendo un libro/.test(chiesto));
    t.eq("senza passaggi non si chiede", (await chiediChiE({ nome: "Logen", passaggi: [], tappe }, finto)).error, "nessunPassaggio");
  } finally {
    globalThis.localStorage = prima;
  }
  globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  try {
    t.eq("senza chiave non si chiede", (await chiediChiE({ nome: "Logen", passaggi, tappe }, finto)).error, "chiave");
  } finally {
    globalThis.localStorage = prima;
  }
}
