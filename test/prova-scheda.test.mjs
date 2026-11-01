// LA PROVA SULLA MICROSD (`src/lib/provaScheda.js`): scrive illustrazioni
// vere di Fandom in una cartella scelta, le rilegge, misura. Qui con una
// cartella finta in memoria e un Fandom finto.
import { provaScrittura, rileggiProva, togliProva, illustrazioniDa, nomeFile, rigaScrittura, rigaRiapertura, testoProva, CARTELLA } from "../src/lib/provaScheda.js";

// una cartella come quelle di `showDirectoryPicker`, in memoria
// `appesa`: i file che, riletti, non rispondono mai (la scheda del tablet
// che non torna); `scritturaAppesa`: quelli che non finiscono di scriversi
const mai = () => new Promise(() => {});
function cartellaFinta({ guasta = false, appesa = () => false, scritturaAppesa = () => false } = {}) {
  const fai = (nome) => {
    const voci = new Map();
    return {
      kind: "directory",
      name: nome,
      voci,
      async getDirectoryHandle(n, { create = false } = {}) {
        if (!voci.has(n)) {
          if (!create) throw new Error("NotFoundError");
          voci.set(n, fai(n));
        }
        return voci.get(n);
      },
      async getFileHandle(n, { create = false } = {}) {
        if (create && scritturaAppesa(n)) return mai();
        if (!voci.has(n)) {
          if (!create) throw new Error("NotFoundError");
          let dati = new Blob([]);
          voci.set(n, {
            kind: "file",
            name: n,
            async createWritable() {
              let nuovo = null;
              return {
                write: async (b) => (nuovo = b),
                // una scheda che tronca: scritto, ma riletto piu' corto
                close: async () => (dati = guasta ? nuovo.slice(0, 1) : nuovo),
              };
            },
            getFile: () => (appesa(n) ? mai() : Promise.resolve(dati)),
          });
        }
        return voci.get(n);
      },
      async *values() {
        yield* voci.values();
      },
      async removeEntry(n) {
        voci.delete(n);
      },
    };
  };
  return fai("Book Companion");
}

// Fandom finto: voci a caso con i loro file, e le miniature
function fandomFinto({ manca = [] } = {}) {
  let giro = 0;
  const chieste = [];
  const fetcher = async (url) => {
    chieste.push(url);
    const u = new URL(url);
    const json = (x) => ({ ok: true, status: 200, json: async () => x });
    if (u.searchParams.get("generator") === "random") {
      giro++;
      const pagine = Array.from({ length: 5 }, (_, i) => ({ title: `Voce ${giro}-${i}`, images: [{ title: `File:Quadro ${giro}-${i}.jpg` }, { title: "File:Aquila.svg" }, { title: `File:Piccola ${giro}-${i}.png` }] }));
      return json({ query: { pages: pagine } });
    }
    if (u.searchParams.get("prop") === "imageinfo") {
      const pagine = u.searchParams.get("titles").split("|").map((title) => {
        const svg = /\.svg$/.test(title);
        const piccola = /Piccola/.test(title);
        return { title, imageinfo: [{ mime: svg ? "image/svg+xml" : "image/jpeg", width: piccola ? 60 : 800, height: piccola ? 60 : 600, thumburl: `https://static.example/${encodeURIComponent(title)}/400` }] };
      });
      return json({ query: { pages: pagine } });
    }
    if (manca.some((m) => url.includes(encodeURIComponent(m)))) return { ok: false, status: 404 };
    return { ok: true, status: 200, blob: async () => new Blob([new Uint8Array(1000)]) };
  };
  return { fetcher, chieste };
}

// il tetto in prova: un giro di orologio, cosi' le risposte finte (che
// arrivano subito) vincono e quelle appese perdono
const aspetta = () => new Promise((r) => setTimeout(r, 5));

export default async function (t) {
  // ---- QUALI FILE SONO ILLUSTRAZIONI --------------------------------------
  const scelte = illustrazioniDa([
    { title: "File:Horus.jpg", imageinfo: [{ mime: "image/jpeg", width: 800, height: 900, thumburl: "u1" }] },
    { title: "File:Aquila.svg", imageinfo: [{ mime: "image/svg+xml", width: 800, height: 800, thumburl: "u2" }] },
    { title: "File:Icona.png", imageinfo: [{ mime: "image/png", width: 40, height: 40, thumburl: "u3" }] },
    { title: "File:Senza.jpg", imageinfo: [{ mime: "image/jpeg", width: 800, height: 900 }] },
  ]);
  t.eq("solo le immagini vere: niente SVG, niente icone, niente senza miniatura", scelte.map((x) => x.nome).join(","), "Horus.jpg");
  t.eq("il nome del file senza «File:» e senza i caratteri che una scheda rifiuta", nomeFile("File:Batman: Year One?.jpg"), "Batman_ Year One_.jpg");

  // ---- LA PROVA ---------------------------------------------------------
  let orologio = 0;
  const ora = () => (orologio += 10);
  const cartella = cartellaFinta();
  const { fetcher } = fandomFinto({ manca: ["Quadro 1-2"] });
  const avanzamenti = [];
  let consegnata = null;
  const e = await provaScrittura({ cartella, fetcher, ora, aspetta, quante: 12, onProgress: (p) => p.fase !== "rileggo" && avanzamenti.push(p.fatte), onScritte: (x) => (consegnata = x) });
  const dentro = cartella.voci.get(CARTELLA);
  t.c("i file stanno in una cartella loro dentro quella scelta", !!dentro);
  t.eq("tante illustrazioni quante chieste, meno quella che non arriva", e.scritte, 11);
  t.eq("quella che non arriva si conta", e.saltate, 1);
  t.eq("ogni illustrazione nel suo file", dentro.voci.size, 11);
  t.eq("il peso e' la somma dei byte scritti", e.byte, 11000);
  t.c("scaricare, scrivere e rileggere si contano a parte", e.msScaricare > 0 && e.msScrivere > 0 && e.msRileggere > 0);
  t.eq("riletti, sono come scritti", e.diverse, 0);
  t.c("tutte rilette, e la prova e' finita", e.riletti === 11 && e.finita && !e.bloccate && !e.fermata);
  t.c("la scrittura si consegna prima di rileggere", consegnata?.scritte === 11 && consegnata.riletti === 0 && !consegnata.finita);
  t.eq("dice a che punto e'", avanzamenti.at(-1), 11);

  const guasta = cartellaFinta({ guasta: true });
  const eg = await provaScrittura({ cartella: guasta, fetcher: fandomFinto().fetcher, ora, aspetta, quante: 3 });
  t.eq("una scheda che scrive male si vede alla rilettura", eg.diverse, 3);

  // UN FILE CHE NON RISPONDE (il tablet del lettore: «…scrivo 200/200» e
  // poi niente): si conta e si passa oltre; tre di fila fermano la rilettura
  const qualcuna = cartellaFinta({ appesa: (n) => n === "Quadro 1-1.jpg" });
  const eq = await provaScrittura({ cartella: qualcuna, fetcher: fandomFinto().fetcher, ora, aspetta, quante: 5 });
  t.c("un file che non risponde si conta, e gli altri si rileggono", eq.bloccate === 1 && eq.riletti === 4 && eq.finita && !eq.fermata);
  const aSalti = cartellaFinta({ appesa: (n) => /Quadro 1-[024]\.jpg/.test(n) });
  const ea = await provaScrittura({ cartella: aSalti, fetcher: fandomFinto().fetcher, ora, aspetta, quante: 5 });
  t.c("tre senza risposta ma non di fila non fermano la rilettura", ea.bloccate === 3 && ea.riletti === 2 && !ea.fermata);
  const ra = await rileggiProva({ cartella: aSalti, ora, aspetta });
  t.c("e nemmeno quella dopo la riapertura", ra.bloccate === 3 && ra.file === 2 && !ra.fermata);
  const tutte = cartellaFinta({ appesa: () => true });
  const et = await provaScrittura({ cartella: tutte, fetcher: fandomFinto().fetcher, ora, aspetta, quante: 6 });
  t.c("tre di fila senza risposta fermano la rilettura, e la prova finisce lo stesso", et.bloccate === 3 && et.fermata && et.riletti === 0 && et.finita);
  const scriveMale = cartellaFinta({ scritturaAppesa: (n) => n === "Quadro 1-0.jpg" });
  const es = await provaScrittura({ cartella: scriveMale, fetcher: fandomFinto().fetcher, ora, aspetta, quante: 3 });
  t.c("anche la scrittura ha un tetto: il file che non finisce si conta", es.bloccateScrivendo === 1 && es.scritte === 2);

  const r = await rileggiProva({ cartella, ora, aspetta });
  t.c("riaperta l'app, i file si rileggono dalla cartella", r.file === 11 && r.byte === 11000 && r.ms > 0 && !r.bloccate);
  const ferma = await rileggiProva({ cartella: tutte, ora, aspetta });
  t.c("riaperta l'app, anche la rilettura ha un tetto e si ferma", ferma.fermata && ferma.bloccate === 3 && ferma.file === 0);
  await togliProva(cartella);
  t.c("i file della prova si tolgono", !cartella.voci.has(CARTELLA));

  // ---- IL TESTO DA COPIARE ------------------------------------------------
  const riga = rigaScrittura({ scritte: 200, saltate: 2, byte: 7.5 * 1048576, msScaricare: 40000, msScrivere: 32000, riletti: 200, msRileggere: 4000, diverse: 0, finita: true });
  t.c("la riga dice quante, il peso, i tempi e quanto per illustrazione", /200 illustrazioni scritte \(7,5 MB\)/.test(riga) && /scriverle 32,0 s \(160 ms l'una\)/.test(riga) && /2 non arrivate/.test(riga) && /200 rilette in 4,0 s \(20 ms l'una\)/.test(riga) && /rilette uguali/.test(riga));
  t.c("un'ora di scrittura si dice in minuti", /scriverle 61 min 40 s/.test(rigaScrittura({ scritte: 1, byte: 1, msScaricare: 0, msScrivere: 3700000, msRileggere: 0, diverse: 0, finita: true })));
  t.c("una rilettura non finita si dice", /rilettura non finita/.test(rigaScrittura({ scritte: 200, byte: 1, msScaricare: 1, msScrivere: 1, finita: false })));
  const bloccata = rigaScrittura({ scritte: 200, byte: 1, msScaricare: 1, msScrivere: 1, riletti: 0, bloccate: 3, fermata: true, finita: true, bloccateScrivendo: 2 });
  t.c("i file senza risposta e la rilettura fermata si dicono", /3 senza risposta rileggendo/.test(bloccata) && /rilettura fermata dopo 3 file/.test(bloccata) && /2 senza risposta scrivendo/.test(bloccata) && !/uguali/.test(bloccata));
  t.c("la riapertura dice i file senza risposta e l'errore", /2 senza risposta · rilettura fermata · errore: NotFoundError/.test(rigaRiapertura({ quando: 0, permesso: "granted", rilettura: { file: 1, ms: 1, bloccate: 2, fermata: true }, errore: "NotFoundError" })));
  t.c("il permesso ricordato si dice", /permesso ricordato · rilette 200/.test(rigaRiapertura({ quando: 0, permesso: "granted", rilettura: { file: 200, ms: 3000 } })));
  t.c("e quello da richiedere anche", /permesso da richiedere/.test(rigaRiapertura({ quando: 0, permesso: "prompt" })));
  const testo = testoProva({ cartella: "Prove", scrittura: { scritte: 1, byte: 1, msScaricare: 1, msScrivere: 1, msRileggere: 1, diverse: 0 }, riaperture: [{ quando: 0, permesso: "granted" }] }, "Chrome 154");
  t.c("il testo da copiare ha cartella, scrittura e riaperture", /Cartella: «Prove»/.test(testo) && /Scrittura: /.test(testo) && /Riapertura: .*permesso ricordato/.test(testo) && /Browser: Chrome 154/.test(testo));
  t.eq("senza prova fatta non c'e' niente da copiare", testoProva(null), "");
  const conErrore = testoProva({ cartella: "Prove", ricordata: false, scrittura: null, errore: "TypeError: rete", riaperture: [] });
  t.c("anche una prova fermata ha il suo testo, con l'errore e la cartella non ricordata", /Errore: TypeError: rete/.test(conErrore) && /non si lascia ricordare/.test(conErrore) && !/Scrittura:/.test(conErrore));
}
