// «DOVE ERAVAMO RIMASTI»: la raccolta che si dirada, la coda a densità
// piena, il materiale di contorno che chiude la storia, e la scelta dei
// passaggi. La metà di `trama.js` che «Prima di cominciare» non copre — ed
// è la metà che sbaglia in silenzio: una coda che cresce senza limite non
// alza errori, manda al modello la scena sbagliata.
import { nuovaRaccolta, raccogli, eContorno, scegliTrama, chiediRiassunto } from "../src/lib/trama.js";

const paragrafo = (i) =>
  `Paragrafo ${i}: Rincewind corse lungo il molo mentre il Bagaglio lo seguiva a passo di carica, e nessuno dei due aveva un piano.`;

export default async function (t) {
  // ---- LA RACCOLTA -------------------------------------------------------
  {
    const r = nuovaRaccolta();
    raccogli(r, "Capitolo uno");
    t.eq("un titoletto non è un paragrafo", r.corpo.length, 0);
    raccogli(r, `  ${paragrafo(1)}   `);
    t.eq("un paragrafo vero entra", r.corpo.length, 1);
    t.eq("ripulito dagli spazi", r.corpo[0], paragrafo(1));
    t.eq("e va nella coda", r.coda.length, 1);
    t.c("e conta nella misura del volume", r.esteso === paragrafo(1).length);

    const lungo = "x".repeat(2000);
    raccogli(r, lungo);
    t.c("un paragrafo enorme si taglia con i puntini", r.corpo[1].length < 500 && r.corpo[1].endsWith("…"));
  }
  {
    // LA CODA TIENE GLI ULTIMI SESSANTA, A DENSITÀ PIENA: è il «dove eri
    // rimasto» e va letta di fila come una scena
    const r = nuovaRaccolta();
    for (let i = 0; i < 700; i++) raccogli(r, paragrafo(i));
    t.eq("la coda sono sessanta", r.coda.length, 60);
    t.eq("gli ultimi sessanta", r.coda[0], paragrafo(640));
    t.eq("fino all'ultimo", r.coda[59], paragrafo(699));
    // IL CORPO SI DIRADA quando supera il tetto: uno su due, e il passo
    // raddoppia — la copertura resta distesa e la memoria non se ne accorge
    t.c("il corpo non cresce all'infinito", r.corpo.length <= 300, `${r.corpo.length}`);
    t.eq("ma parte dall'inizio", r.corpo[0], paragrafo(0));
    const ultimo = Number(r.corpo[r.corpo.length - 1].match(/Paragrafo (\d+)/)[1]);
    t.c("e arriva vicino alla fine", ultimo >= 690, `${ultimo}`);
    t.c("il passo è raddoppiato", r.passo >= 2, `${r.passo}`);
  }

  // ---- IL MATERIALE DI CONTORNO ------------------------------------------
  const doc = (title, testa) => ({ title, querySelector: () => (testa == null ? null : { textContent: testa }) });
  t.c("«Dramatis Personae» è contorno", eContorno(doc("Dramatis Personae", null)));
  t.c("anche dall'intestazione", eContorno(doc("", "Acknowledgements")));
  t.c("in italiano", eContorno(doc("Ringraziamenti", null)));
  t.c("l'indice", eContorno(doc("Contents", null)));
  t.c("l'estratto del prossimo volume", eContorno(doc("Extract from the next book", null)));
  t.c("un capitolo no", !eContorno(doc("Chapter One", "The Colour of Magic")));
  t.c("una parola in mezzo alla frase no", !eContorno(doc("", "The Glossary of Elvish Tongues")));
  t.c("senza documento no", !eContorno(null));

  // ---- LA SCELTA DEI PASSAGGI --------------------------------------------
  t.eq("niente raccolto, niente passaggi", scegliTrama([]).length, 0);
  const volume = (id, n) => {
    const r = nuovaRaccolta();
    for (let i = 0; i < n; i++) raccogli(r, `${id} ${paragrafo(i)}`);
    return { libro: { id, title: id }, ...r };
  };
  const num = (p) => Number(p.testo.match(/Paragrafo (\d+)/)[1]);
  {
    const scelti = scegliTrama([volume("v1", 100), volume("v2", 100), volume("qui", 100)]);
    const di = (quando) => scelti.filter((p) => p.quando === quando);
    t.eq("dodici in coda", di("coda").length, 12);
    t.eq("la coda sono gli ultimi dodici, di fila", JSON.stringify(di("coda").map(num)), JSON.stringify([88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99]));
    t.eq("dodici del libro aperto", di("qui").length, 12);
    // LA CODA STA GIÀ DENTRO IL CORPO: senza toglierla le ultime scene
    // arriverebbero due volte (mutazione provata)
    t.c("e nessuno di loro è già nella coda", di("qui").every((p) => num(p) < 88), JSON.stringify(di("qui").map(num)));
    // l'apertura è sparsa sul primo quinto, non le prime quattro di fila
    const apertura = di("qui").slice(0, 4).map(num);
    t.c("l'apertura sta nel primo quinto", apertura.every((i) => i < 18), JSON.stringify(apertura));
    t.c("e non sono le prime quattro di fila", apertura.some((i) => i >= 4), JSON.stringify(apertura));
    t.c("il corpo viene dopo", di("qui").slice(4).every((p) => num(p) >= 18));
    t.eq("i volumi di prima sono sei frammenti in tutto", di("prima").length, 6);
    t.c("da tutt'e due i volumi", di("prima").some((p) => p.testo.startsWith("v1")) && di("prima").some((p) => p.testo.startsWith("v2")));
    t.c("l'ordine è prima, poi il libro, poi la coda", scelti.findIndex((p) => p.quando === "coda") > scelti.findIndex((p) => p.quando === "qui"));
  }
  {
    const scelti = scegliTrama([volume("qui", 100)]);
    t.eq("con un libro solo niente «prima»", scelti.filter((p) => p.quando === "prima").length, 0);
    const corto = scegliTrama([volume("qui", 5)]);
    t.c("un libro appena cominciato dà quel che ha", corto.length > 0 && corto.length <= 10);
  }

  // ---- LA RICHIESTA AL MODELLO ------------------------------------------
  const prima = globalThis.localStorage;
  globalThis.localStorage = { getItem: (k) => (k === "bc_ai_key" ? "prova" : null), setItem: () => {}, removeItem: () => {} };
  let chiesto = "";
  const finto = async (_url, opz) => {
    chiesto = JSON.parse(opz.body).messages[0].content;
    return { ok: true, json: async () => ({ content: [{ type: "text", text: "ok" }], stop_reason: "end_turn" }) };
  };
  const tappe = [{ libro: { id: "v1", title: "Titolo Uno" } }, { libro: { id: "qui", title: "Titolo Due" } }];
  try {
    await chiediRiassunto({ passaggi: scegliTrama([volume("v1", 50), volume("qui", 50)]), tappe }, finto);
    t.c("[prima], [inizio] e [ultime pagine] sono le tre etichette", /\[prima\]/.test(chiesto) && /\[inizio\]/.test(chiesto) && /\[ultime pagine\]/.test(chiesto));
    t.c("ai volumi di prima si dice che sono frammenti", /NON riassumere quei volumi/.test(chiesto));
    t.c("I TITOLI NON ESCONO MAI", !/Titolo (Uno|Due)/.test(chiesto));
    await chiediRiassunto({ passaggi: scegliTrama([volume("qui", 50)]), tappe: [tappe[1]] }, finto);
    t.c("con un libro solo la riga sui frammenti non c'è", !/NON riassumere/.test(chiesto));
    t.eq("senza passaggi non si chiede", (await chiediRiassunto({ passaggi: [], tappe }, finto)).error, "nessunPassaggio");
  } finally {
    globalThis.localStorage = prima;
  }
}
