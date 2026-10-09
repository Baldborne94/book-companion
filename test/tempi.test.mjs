// I TEMPI DELL'APP (`lib/tempi.js`): avvio, Libreria, apertura di ePub e
// PDF, misurati sul tablet del lettore e riassunti nel rapporto. Solo
// numeri, e ogni misura con le sue tappe.
import { parti, partenza, vocePerTempo, segnaTempo, tempiAnnotati, svuotaTempi, righeTempi, misuraApertura, provenienza, codiceArrivato, segnaAvvio, TENUTI, tappeAvvio, datiNavigazione } from "../src/lib/tempi.js";
import { rapporto } from "../src/lib/registro.js";

const memoria = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};
const subito = (f) => f();
const giro = () => new Promise((r) => setTimeout(r, 5));

export default async function (t) {
  // ---- le tappe diventano durate -----------------------------------------
  const v = vocePerTempo({ cosa: "epub", t0: 100, tappe: [["codice", 250], ["byte", 300], ["pagina", 1300]], da: "drive", kb: 512, ora: 7 });
  t.eq("la prima tappa conta dalla partenza", v.f.codice, 150);
  t.eq("le altre dalla tappa prima", v.f.byte, 50);
  t.eq("l'ultima", v.f.pagina, 1000);
  t.eq("la provenienza resta", v.da, "drive");
  t.eq("e il quando", v.q, 7);
  const vuota = vocePerTempo({ cosa: "avvio", t0: 0, tappe: [["primo", 10]], da: "", vista: undefined });
  t.c("un dato vuoto non entra nella voce", !("da" in vuota) && !("vista" in vuota), JSON.stringify(vuota));

  // ---- la partenza e' di chi la chiede ------------------------------------
  parti("lettura:a", 5);
  t.eq("chi non e' suo non la prende", partenza("lettura:b"), null);
  t.eq("chi e' suo si'", partenza("lettura:a"), 5);
  t.eq("e una volta sola", partenza("lettura:a"), null);

  // ---- l'apertura: dal tocco alla pagina ----------------------------------
  const st = memoria();
  const segnate = [];
  parti("lettura:x", 0);
  const m = misuraApertura("pdf", "x", { segna: (x) => segnate.push(x), raf: subito });
  m.tappa("byte", { da: "pezzi", kb: 9 });
  m.fine();
  m.fine();
  // fra la fine e il disegno non entra piu' niente
  m.tappa("tardi");
  await giro();
  t.eq("un'apertura si segna una volta", segnate.length, 1);
  t.c("dal tocco, non dal montaggio", segnate[0].f.byte > 0, JSON.stringify(segnate[0]));
  t.eq("con la pagina in coda", Object.keys(segnate[0].f).join(","), "byte,pagina");
  t.eq("e i dati delle tappe", segnate[0].da, "pezzi");
  t.c("dopo la fine non si aggiungono tappe", !("tardi" in segnate[0].f));

  t.eq("byte qui", provenienza(new Blob(["a"])), "tablet");
  t.eq("scesi da Drive", provenienza(Object.assign(new Blob(["a"]), { lontano: true })), "drive");
  t.eq("letti da Drive a pezzi", provenienza({ daLontano: true, size: 1 }), "pezzi");

  // ---- l'avvio: una volta per vita della pagina ---------------------------
  const avvii = [];
  segnaAvvio({ n: 3, segna: (x) => avvii.push(x), raf: subito });
  await giro();
  t.eq("senza codice arrivato non c'e' avvio", avvii.length, 0);
  codiceArrivato(200);
  segnaAvvio({ n: 3, segna: (x) => avvii.push(x), raf: subito });
  segnaAvvio({ n: 3, segna: (x) => avvii.push(x), raf: subito });
  await giro();
  t.eq("React che monta due volte non fa due avvii", avvii.length, 1);
  t.eq("il codice conta dalla navigazione", avvii[0].f.codice, 200);
  t.eq("coi libri", avvii[0].n, 3);

  // ---- dove va il tempo prima del codice -----------------------------------
  t.eq(
    "le tappe in ordine di tempo",
    JSON.stringify(tappeAvvio({ pagina: 300, stile: 900, programma: 500 }, 1400)),
    JSON.stringify([["html", 300], ["js", 500], ["stile", 900]])
  );
  t.eq("dopo il codice una tappa non conta", tappeAvvio({ pagina: 300, stile: 1500 }, 1400).length, 1);
  t.eq("senza misure niente tappe", tappeAvvio({}, 1400).length, 0);
  const perf = {
    getEntriesByType: (k) =>
      k === "navigation"
        ? [{ responseEnd: 310 }]
        : [
            { name: "https://x/assets/index-a.css", responseEnd: 420 },
            { name: "https://fonts.googleapis.com/css2?family=EB+Garamond", responseEnd: 880 },
            { name: "https://fonts.gstatic.com/s/eb/a.woff2", responseEnd: 2000 },
            { name: "https://x/assets/index-b.js", responseEnd: 640 },
            { name: "https://x/assets/Library-c.js", responseEnd: 3000 },
          ],
  };
  const doc = { querySelector: () => ({ src: "https://x/assets/index-b.js" }) };
  const nav = datiNavigazione(perf, doc);
  t.eq("la pagina dell'app", nav.pagina, 310);
  t.eq("lo stile aspetta anche i caratteri di Google, non i file dei caratteri", nav.stile, 880);
  t.eq("il programma e' quello della pagina", nav.programma, 640);
  const diviso = righeTempi([{ q: 1, c: "avvio", f: { html: 300, js: 200, stile: 400, codice: 500, primo: 500 }, n: 1265 }]).join("\n");
  t.c("il rapporto dice le tappe dell'avvio", /pagina dell'app 300 ms \+ programma scaricato 200 ms \+ stile e caratteri 400 ms \+ codice 500 ms \+ primo disegno 500 ms/.test(diviso), diviso);
  const giroDrive = righeTempi([{ q: 1, c: "drive", f: { elenco: 9000, riconosce: 300 }, da: "cambi", voci: 2100, n: 1265 }]).join("\n");
  t.c("il giro di Drive nel rapporto, con l'elenco", /Giro di Google Drive dai cambiamenti: 1 · tipica 9,3 s \(elenco 9,0 s \+ riconoscimento 300 ms\).*1265 libri · 2100 file nell'elenco/.test(giroDrive), giroDrive);
  t.eq("un browser senza misure non rompe niente", JSON.stringify(datiNavigazione({ getEntriesByType: () => { throw new Error("no"); } }, doc)), "{}");


  // ---- il registro ----------------------------------------------------------
  for (let i = 0; i < TENUTI + 5; i++) segnaTempo({ q: i, c: "avvio", f: { primo: i } }, { st });
  const tenuti = tempiAnnotati(st);
  t.eq("se ne tengono al piu' TENUTI", tenuti.length, TENUTI);
  t.eq("i piu' recenti", tenuti.at(-1).q, TENUTI + 4);
  svuotaTempi(st);
  t.eq("svuotato", tempiAnnotati(st).length, 0);
  st.setItem("bc_tempi", "{rotto");
  t.eq("un registro rotto e' vuoto", tempiAnnotati(st).length, 0);
  st.setItem("bc_tempi", "{}");
  t.eq("e anche uno che non e' una lista", tempiAnnotati(st).length, 0);
  segnaTempo({ q: 1, c: "avvio", f: {} }, { st: { getItem: () => null, setItem: () => { throw new Error("pieno"); } } });
  t.c("un disco pieno non ferma niente", true);

  // ---- il riassunto ---------------------------------------------------------
  t.eq("niente misure, niente righe", righeTempi([]).length, 0);

  // ---- LA VERSIONE SU OGNI MISURA ------------------------------------------
  // il rapporto del tablet dopo la cura dei caratteri: «Avvio 24 · tipica
  // 1,8 s», con dentro le aperture di prima della cura. Si conta solo la
  // versione dell'ultima misura, e le altre si dicono
  {
    const mem = new Map();
    const st = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
    segnaTempo({ q: 1, c: "avvio", f: { primo: 5 } }, { st, ver: "1.0.0 · 08/10, 22:37" });
    t.eq("la misura porta la versione", JSON.parse(mem.get("bc_tempi"))[0].ver, "1.0.0 · 08/10, 22:37");
    segnaTempo({ q: 2, c: "avvio", f: { primo: 5 } }, { st, ver: "" });
    t.c("senza versione (le prove) niente campo", !("ver" in JSON.parse(mem.get("bc_tempi"))[1]));
    const misto = [
      { q: 1, c: "avvio", f: { codice: 1400, primo: 500 }, ver: "a" },
      { q: 2, c: "avvio", f: { codice: 1500, primo: 500 } },
      { q: 3, c: "avvio", f: { html: 900, codice: 200, primo: 500 }, ver: "b" },
      { q: 4, c: "avvio", f: { html: 700, codice: 180, primo: 400 }, ver: "b" },
      { q: 5, c: "avvio", f: { html: 800, codice: 190, primo: 450 }, ver: "b" },
    ];
    const r = righeTempi(misto).join("\n");
    t.c("conta solo la versione in uso", /Avvio dell'app: 3 · tipica 1,4 s/.test(r), r);
    t.c("e dice quante ne ha lasciate fuori", /Avvio dell'app: 3 con la versione in uso \(b\), 2 di prima non contate/.test(r), r);
    const tappa = righeTempi([{ q: 1, c: "avvio", f: { codice: 1400, primo: 500 } }, { q: 2, c: "avvio", f: { codice: 1500, primo: 500 } }, { q: 3, c: "avvio", f: { html: 800, codice: 200, primo: 500 } }]).join("\n");
    t.c("una tappa si misura su chi ce l'ha, non con gli zeri di chi non l'ha", /pagina dell'app 800 ms/.test(tappa), tappa);
    const vecchie = righeTempi([{ q: 9, c: "drive", f: { elenco: 900 }, da: "cambi" }]).join("\n");
    t.c("senza versioni si conta tutto, senza note", /Giro di Google Drive dai cambiamenti: 1/.test(vecchie) && !/non contate/.test(vecchie), vecchie);
  }
  const voci = [
    { q: 1, c: "avvio", f: { codice: 300, primo: 100 }, n: 1100 },
    { q: 2, c: "avvio", f: { codice: 2500, primo: 200 }, n: 1100 },
    { q: 3, c: "epub", f: { codice: 100, byte: 900, pagina: 400 }, da: "tablet", kb: 300 },
    { q: 4, c: "epub", f: { codice: 100, byte: 3000, pagina: 400 }, da: "drive", kb: 2048 },
    { q: 5, c: "libreria", f: { disegno: 80 }, n: 1100, vista: "raccolte" },
    { q: 6, c: "pdf", f: { byte: 10, pagina: 90 }, da: "pezzi" },
  ];
  const testo = righeTempi(voci).join("\n");
  t.c("si contano", /Tempi misurati: 6/.test(testo), testo);
  t.c("l'avvio coi libri", /Avvio dell'app: 2 · tipica 2,7 s .*· 1100 libri/.test(testo), testo);
  t.c("le tappe con il loro nome", /codice 2,5 s \+ primo disegno 200 ms/.test(testo), testo);
  t.c("l'ePub diviso per provenienza", /ePub aperto dal tablet: 1/.test(testo) && /ePub aperto da Drive: 1/.test(testo), testo);
  t.c("una provenienza sola sta nel nome", /PDF aperto da Drive a pezzi: 1/.test(testo), testo);
  t.c("la Libreria dice la vista", /Libreria aperta a raccolte: 1 · tipica 80 ms/.test(testo), testo);
  t.c("una tappa sola non si ripete fra parentesi", !/80 ms \(/.test(testo), testo);
  t.c("oltre i 2 secondi si contano", /oltre i 2 secondi: 1/.test(testo), testo);
  t.c("le lente si raccontano con le tappe e il peso", /ePub aperto da Drive · codice 100 ms \+ byte 3,0 s \+ pagina pronta 400 ms · 2 MB/.test(testo), testo);
  t.c("una rapida non e' fra le lente", !/Le ultime lente:[\s\S]*PDF/.test(testo), testo);

  // ---- nel rapporto, in coda --------------------------------------------------
  const r = rapporto({ tempi: voci, versione: "x" });
  t.c("il rapporto li porta", /Tempi misurati: 6/.test(r), r);
  t.c("senza tempi, il rapporto non ne parla", !/Tempi misurati/.test(rapporto({ versione: "x" })));
  t.c("niente titoli: nelle voci non ce ne sono", !voci.some((x) => "title" in x));
}
