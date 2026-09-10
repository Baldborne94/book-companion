// IL DIZIONARIO CHE STA SUL DISPOSITIVO.
//
// Chiesto dal lettore: «ci sarebbe modo di avere dizionario anche offline?».
// Qui si prova la parte che sbaglia in silenzio: il RAGGRUPPAMENTO in
// sacchi (una parola nel sacco sbagliato non dà un errore, dà un «questa
// parola non la conosco» su una parola che il dizionario ha eccome) e
// l'ORDINE delle scritture, che decide cosa resta se lo scaricamento si
// interrompe a metà.
//
// IndexedDB qui non c'è: `bookStore.js` si finge, come si fa col DOMParser
// nei test del vocabolario, per non tirarsi dietro un browser.
import { gzipSync } from "node:zlib";
import {
  sacco,
  scaricaDizionario,
  sensiOffline,
  statoDizionario,
  rimuoviDizionario,
  cartellinoInRete,
} from "../src/lib/dizionarioOffline.js";

// il deposito finto: una mappa al posto di IndexedDB
const deposito = () => {
  const m = new Map();
  return {
    m,
    leggi: async (k) => m.get(k),
    scrivi: async (k, v) => m.set(k, v),
    scriviMolti: async (voci) => {
      for (const [k, v] of voci) m.set(k, v);
      return voci.length;
    },
    togli: async (k) => m.delete(k),
    chiavi: async () => [...m.keys()],
  };
};

// una risposta finta che porta davvero dei byte gzippati
const risposta = (byte, { ok = true, status = 200 } = {}) => ({
  ok,
  status,
  headers: { get: (h) => (h === "content-length" ? String(byte.length) : null) },
  arrayBuffer: async () => byte,
  body: null, // niente stream: si passa dalla strada dell'`arrayBuffer`
});

export default async function (t) {
  // ---- I SACCHI ---------------------------------------------------------
  t.eq("due lettere fanno il sacco", sacco("gutter"), "diz_gu");
  t.eq("e la parola di una lettera sta nel suo", sacco("a"), "diz_a");
  t.eq("le maiuscole non fanno un sacco a parte", sacco("Ankh"), sacco("ankh"));
  // La stessa parola deve finire nello stesso sacco quando la si scrive e
  // quando la si cerca: è tutto il patto, e romperlo non alza nessun errore.
  for (const p of ["gutter", "a", "kick the bucket", "o'clock", "well-known", "22"]) {
    t.c(`«${p}» finisce sempre nello stesso sacco`, sacco(p) === sacco(p) && !!sacco(p));
  }
  // Quel che non è lettera o cifra non può entrare in una chiave: una
  // locuzione comincia con uno spazio in mezzo, e «kick the bucket» sta col
  // suo prefisso, non in un sacco chiamato «ki ».
  t.eq("lo spazio dentro il prefisso diventa un trattino basso", sacco("o clock"), "diz_o_");
  t.c("e la chiave non porta punteggiatura", /^diz_[a-z0-9_]+$/.test(sacco("'tis")), sacco("'tis"));
  // Una locuzione e la parola con cui comincia stanno nello STESSO sacco:
  // è quel che rende una sola lettura sufficiente a trovarle tutt'e due.
  t.eq("la locuzione sta col suo inizio", sacco("kick the bucket"), sacco("kick"));

  for (const niente of ["", null, undefined, "   "]) {
    // `"   "` non è vuota ma non ha niente da cercare: la si lascia passare
    // come sacco e la ricerca non troverà nulla — quel che NON deve fare è
    // tornare una chiave di IndexedDB fatta di spazi.
    const s = sacco(niente);
    t.c(`«${String(niente)}» non fa una chiave sporca`, s === null || /^diz_[a-z0-9_]+$/.test(s), String(s));
  }
  t.eq("senza parola non c'è sacco", sacco(""), null);

  // ---- IL GIRO INTERO: scarica, insacca, ritrova ------------------------
  //
  // È la parte che vale davvero. Una parola scritta in un sacco e cercata
  // in un altro non alza nessun errore: risponde «non la conosco» su una
  // parola che il dizionario ha, e nessuno se ne accorge mai.
  const DIZIONARIO = {
    // il terzo campo e' la resa italiana del senso, da MultiWordNet: deve
    // attraversare i sacchi intatta, o la scheda resterebbe muta in cima
    gutter: [["n", "a channel at the edge of a street", "grondaia, doccia"]],
    gut: [["n", "the part of the alimentary canal"], ["v", "empty the insides of"]],
    a: [["n", "the 1st letter of the Roman alphabet"]],
    "kick the bucket": [["v", "pass from physical life"]],
    "o'clock": [["r", "according to the clock"]],
  };
  const byte = gzipSync(Buffer.from(JSON.stringify(DIZIONARIO)));

  const d = deposito();
  const meta = await scaricaDizionario({ fetcher: async () => risposta(byte), deposito: d });
  t.eq("scaricato: le voci sono tutte", meta.voci, Object.keys(DIZIONARIO).length);
  t.c("e i sacchi sono meno delle voci", meta.sacchi < meta.voci, `${meta.sacchi} sacchi`);

  t.eq("una parola si ritrova", (await sensiOffline("gutter", d))[0][1], "a channel at the edge of a street");
  t.eq("con la sua resa italiana", (await sensiOffline("gutter", d))[0][2], "grondaia, doccia");
  t.eq("e un senso senza resa resta a due campi", (await sensiOffline("gut", d))[0].length, 2);
  t.eq("con tutti i suoi sensi", (await sensiOffline("gut", d)).length, 2);
  t.eq("la parola di una lettera pure", (await sensiOffline("a", d))[0][0], "n");
  t.eq("e la locuzione col suo spazio", (await sensiOffline("kick the bucket", d))[0][1], "pass from physical life");
  t.eq("e quella con l'apostrofo", (await sensiOffline("o'clock", d))[0][0], "r");
  // maiuscole e spazi attorno: la parola arriva dal testo del libro com'è
  // scritta lì, non da una casella pulita
  t.eq("«Gutter» a inizio frase si ritrova lo stesso", (await sensiOffline("  Gutter ", d))[0][0], "n");
  t.eq("una parola che non c'è torna vuoto", (await sensiOffline("ankhmorpork", d)).length, 0);

  t.c("il dizionario risulta presente", !!(await statoDizionario(d)));
  await rimuoviDizionario(d);
  t.eq("rimosso, non risulta più", await statoDizionario(d), null);
  t.eq("e non resta nessun sacco", [...d.m.keys()].filter((k) => k.startsWith("diz_")).length, 0);

  // ---- CIÒ CHE VA STORTO ------------------------------------------------
  // Un file che non c'è deve DIRLO: un tasto che torna com'era senza
  // spiegare sembra un tasto rotto.
  let scoppiato = "";
  try {
    await scaricaDizionario({ fetcher: async () => risposta(byte, { ok: false, status: 404 }), deposito: deposito() });
  } catch (e) {
    scoppiato = e.message;
  }
  t.c("uno scaricamento fallito si dichiara", scoppiato.includes("404"), scoppiato);

  // I SACCHI PRIMA, IL CARTELLINO DOPO. `statoDizionario` guarda il
  // cartellino: scritto per primo, un'interruzione a metà lascerebbe un
  // dizionario DICHIARATO INTERO e mezzo vuoto — che risponde «non la
  // conosco» su metà delle parole senza che niente lo dica, ed è il guasto
  // peggiore dei due perché il pannello direbbe che è tutto a posto.
  const rotto = deposito();
  rotto.scriviMolti = async () => {
    throw new Error("disco pieno");
  };
  let caduto = false;
  try {
    await scaricaDizionario({ fetcher: async () => risposta(byte), deposito: rotto });
  } catch {
    caduto = true;
  }
  t.c("una scrittura fallita non passa in silenzio", caduto);
  t.eq("e il dizionario NON risulta presente", await statoDizionario(rotto), null);

  // E UN `.gz` PUÒ ARRIVARE GIÀ APERTO: certi server lo mandano con
  // `Content-Encoding: gzip` e il browser lo apre da sé. Fidarsi del nome
  // del file lo farebbe decomprimere due volte.
  const d2 = deposito();
  const crudo = Buffer.from(JSON.stringify(DIZIONARIO));
  await scaricaDizionario({ fetcher: async () => risposta(crudo), deposito: d2 });
  t.eq("un file già aperto non si decomprime di nuovo", (await sensiOffline("gutter", d2)).length, 1);

  // ---- il cartellino ----------------------------------------------------
  t.eq(
    "il cartellino dice quante voci e quanto pesa",
    (await cartellinoInRete(async () => ({ ok: true, json: async () => ({ voci: 5, byte: 99 }) })))?.voci,
    5
  );
  // non sapere la misura NON è un guasto: il pannello dice quel che sa e il
  // tasto resta — sparire perché un file di contorno non si legge sarebbe
  // togliere la funzione per un dettaglio
  t.eq("un cartellino irraggiungibile non è un guasto", await cartellinoInRete(async () => { throw new Error("rete"); }), null);
  t.eq("e nemmeno uno vuoto", await cartellinoInRete(async () => ({ ok: true, json: async () => ({}) })), null);
}
