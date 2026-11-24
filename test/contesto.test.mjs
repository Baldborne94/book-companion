// IL PARAGRAFO ATTORNO ALLA SELEZIONE, e la richiesta di spiegazione che lo
// porta al modello. `contextAround` è il pezzo di testo che esce dal
// dispositivo insieme alla chiave: un ritaglio storto non alza errori, manda
// all'Oracolo il pezzo sbagliato — o mezzo romanzo.
//
// La selezione si finge: un oggetto con `rangeCount`, `toString` e
// `getRangeAt`, e nodi con `nodeType`, `parentElement`, `closest` e
// `textContent`. È tutto quel che la funzione tocca.
const memoria = {};
for (const [nome, fn] of Object.entries({
  getItem: (k) => (k in memoria ? memoria[k] : null),
  setItem: (k, v) => {
    memoria[k] = String(v);
  },
  removeItem: (k) => {
    delete memoria[k];
  },
})) {
  Object.defineProperty(memoria, nome, { value: fn, enumerable: false });
}
globalThis.localStorage = memoria;

const { contextAround, consultaOracolo } = await import("../src/lib/oracle.js");

// un blocco di prosa con dentro la parola scelta
const blocco = (testo) => ({ nodeType: 1, textContent: testo, closest: () => null });
const dentro = (testo, scelto, { conBlocco = true } = {}) => {
  const p = blocco(testo);
  const span = { nodeType: 1, textContent: scelto, closest: (s) => (conBlocco && /\bp\b/.test(s) ? p : null) };
  const nodoTesto = { nodeType: 3, textContent: scelto, parentElement: span };
  return { rangeCount: 1, toString: () => scelto, getRangeAt: () => ({ commonAncestorContainer: nodoTesto }) };
};

export default async function (t) {
  // ---- I CASI VUOTI --------------------------------------------------------
  t.eq("senza selezione, niente", contextAround(null), "");
  t.eq("selezione senza intervalli, niente", contextAround({ rangeCount: 0 }), "");
  t.eq("una selezione che esplode non esplode", contextAround({ rangeCount: 1, toString: () => "x", getRangeAt: () => { throw new Error("no"); } }), "");

  // ---- IL PARAGRAFO INTERO, quando ci sta ----------------------------------
  const frase = "Rincewind   corse lungo\n il molo,  e il Bagaglio lo seguì.";
  t.eq(
    "si sale al paragrafo e si ripulisce dagli spazi",
    contextAround(dentro(frase, "Bagaglio")),
    "Rincewind corse lungo il molo, e il Bagaglio lo seguì."
  );
  // dal nodo di testo si sale all'elemento, e da lì al blocco: senza il
  // `closest` resterebbe la sola parola
  t.eq("senza un blocco attorno resta il nodo", contextAround(dentro(frase, "Bagaglio", { conBlocco: false })), "Bagaglio");
  // un blocco senza testo: torna il selezionato, non una stringa vuota
  t.eq("blocco vuoto → il selezionato", contextAround(dentro("   ", "Bagaglio")), "Bagaglio");

  // ---- LA FINESTRA, quando il blocco è troppo lungo ------------------------
  // nei PDF il blocco è il livello testo dell'intera pagina: si ritaglia
  // una finestra centrata su quel che si è scelto
  const prima = "a".repeat(1000);
  const dopo = "b".repeat(1000);
  const lungo = `${prima} SCELTO ${dopo}`;
  const fin = contextAround(dentro(lungo, "SCELTO"), 100);
  t.c("la finestra contiene il selezionato", fin.includes("SCELTO"), fin.slice(0, 40));
  t.c("lunga quanto chiesto più i puntini", fin.length === 102, `${fin.length}`);
  t.c("puntini da tutt'e due i lati", fin.startsWith("…") && fin.endsWith("…"));
  // centrata: tanto prima quanto dopo, a un carattere
  const at = fin.indexOf("SCELTO");
  t.c("e centrata sul selezionato", Math.abs(at - 1 - (100 - "SCELTO".length) / 2) <= 1, `${at}`);

  // in testa al blocco: niente puntini davanti, la finestra parte da zero
  const inTesta = contextAround(dentro(`SCELTO ${dopo}`, "SCELTO"), 100);
  t.c("in testa non c'è il puntino davanti", inTesta.startsWith("SCELTO"), inTesta.slice(0, 12));
  t.c("ma c'è dietro", inTesta.endsWith("…"));
  // in coda: la finestra si appoggia al fondo
  const inCoda = contextAround(dentro(`${prima} SCELTO`, "SCELTO"), 100);
  t.c("in coda non c'è il puntino dietro", inCoda.endsWith("SCELTO"), inCoda.slice(-12));
  t.c("ma c'è davanti", inCoda.startsWith("…"));
  // il selezionato non si ritrova nel testo (spazi diversi): si centra a metà
  const cieca = contextAround(dentro(lungo, "NON C'È"), 100);
  t.c("se il selezionato non si trova, la finestra sta in mezzo", cieca.startsWith("…") && cieca.endsWith("…"));
  // sotto il tetto non si taglia mai
  t.eq("un blocco corto resta intero", contextAround(dentro("x".repeat(50), "x"), 100), "x".repeat(50));

  // ---- LA RICHIESTA DI SPIEGAZIONE ------------------------------------------
  memoria.bc_ai_key = "prova";
  let chiesto = "";
  let chiamate = 0;
  const finto = async (_url, opz) => {
    chiamate += 1;
    chiesto = JSON.parse(opz.body).messages[0].content;
    return { ok: true, json: async () => ({ content: [{ type: "text", text: "spiegato" }], stop_reason: "end_turn" }) };
  };
  const libro = { id: "l1", title: "Guards! Guards!", author: "Terry Pratchett" };
  const r = await consultaOracolo({ text: "take the mickey", context: "They were going to take the mickey out of him.", book: libro }, finto);
  t.eq("la spiegazione arriva", r.answer, "spiegato");
  t.c("il passaggio va al modello", /Passaggio selezionato: «take the mickey»/.test(chiesto));
  t.c("e il paragrafo attorno", /Il paragrafo attorno: «They were going/.test(chiesto));
  // DICHIARATO: qui il titolo del libro VIAGGIA col passaggio — è l'unica
  // domanda all'Oracolo che lo fa, e serve a sciogliere slang e riferimenti
  // di quel libro. È diverso dalla scheda personaggio e dalla trama, dove i
  // volumi si numerano apposta. Chi cambia idea cambi anche questa riga.
  t.c("e il titolo, dichiarato", /Libro: «Guards! Guards!» di Terry Pratchett/.test(chiesto));

  // quando il paragrafo È il passaggio non si ripete
  await consultaOracolo({ text: "una frase intera", context: "  una frase intera ", book: { id: "l2" } }, finto);
  t.c("il paragrafo uguale al passaggio non si ripete", !/Il paragrafo attorno/.test(chiesto));
  t.c("e senza titolo non si scrive «Libro:»", !/Libro:/.test(chiesto));

  // la cache: stesso libro e stesso passaggio, nessuna seconda chiamata
  const prima2 = chiamate;
  const bis = await consultaOracolo({ text: "take the mickey", context: "altro", book: libro }, finto);
  t.eq("la stessa domanda non si ripaga", chiamate, prima2);
  t.eq("e torna la risposta di prima", bis.answer, "spiegato");
  // ma su un altro libro è un'altra domanda
  await consultaOracolo({ text: "take the mickey", context: "altro", book: { id: "l3" } }, finto);
  t.eq("su un altro libro si richiede", chiamate, prima2 + 1);

  t.eq("un passaggio vuoto non si chiede", (await consultaOracolo({ text: "  ", book: libro }, finto)).error, "vuoto");
  delete memoria.bc_ai_key;
  t.eq("senza chiave non si chiede", (await consultaOracolo({ text: "x", book: libro }, finto)).error, "chiave");
}
