// I TEMPI DELL'APP (`lib/tempi.js`): avvio, Libreria, apertura di ePub e
// PDF, misurati sul tablet del lettore e riassunti nel rapporto. Solo
// numeri, e ogni misura con le sue tappe.
import { parti, partenza, vocePerTempo, segnaTempo, tempiAnnotati, svuotaTempi, righeTempi, misuraApertura, provenienza, codiceArrivato, segnaAvvio, TENUTI } from "../src/lib/tempi.js";
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
