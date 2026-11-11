// LE TAVOLE DEI MONDI (`MONDI` in `sagaBooks.js`): l'ordine di lettura di
// tutte le guide di un universo insieme (Malazan, il Cosmere). Quel che
// sbaglia in silenzio e' la tavola: una riga spostata a mano, un titolo che
// la guida scrive diverso, un volume dimenticato. E il nome della serie in
// ogni fila, che in un mondo deve dire anche la guida.
import { MONDI, TAVOLE } from "../src/lib/sagaBooks.js";
import { camminoDelMondo, perParte, serieNelMondo, tavolaDelMondo, prossimoPasso, lettiDelCammino } from "../src/lib/cammino.js";
import { numerazioneGuida } from "../src/lib/numeraCammino.js";
import { universiNumerati } from "../src/lib/sagaBooks.js";

export default async (t) => {
  t.eq("i mondi con un ordine", MONDI.map((m) => m.nome).join(", "), "Tutto Malazan, Tutto il Cosmere, Tutto il mondo di Elan");
  for (const mondo of MONDI) {
    const tav = tavolaDelMondo(mondo);
    t.eq(`${mondo.nome}: ogni riga e' una voce della sua guida`, tav.libri.filter((v) => !v.t).map((v) => v.guida).join(), "");
    const guide = TAVOLE.filter((x) => x.universo === mondo.universo);
    const nelMondo = tav.libri.map((v) => `${v.guida}\u0000${v.t}`);
    // una raccolta non e' un volume: chi ce l'ha ha i romanzi dentro, e quelli stanno nella fila
    const fuori = guide.flatMap((g) => g.libri.filter((v) => v.tipo !== "omnibus").map((v) => `${g.saga}\u0000${v.t}`)).filter((k) => !nelMondo.includes(k));
    t.eq(`${mondo.nome}: ogni volume delle sue guide ci sta`, fuori.join(" | "), "");
    t.eq(`${mondo.nome}: una volta sola`, new Set(nelMondo).size, nelMondo.length);
    // e ogni storia di mezzo delle sue guide sta nella fila, una volta
    const storie = guide.flatMap((g) => (g.novelle || []).map((v) => `${g.saga}\u0000${v.t}`));
    const storieNelMondo = mondo.ordine.filter((r) => r[3]).map((r) => `${r[0]}\u0000${r[1]}`);
    t.eq(`${mondo.nome}: ogni storia di mezzo ci sta, una volta`, `${storie.filter((k) => !storieNelMondo.includes(k)).join(" | ")}|${new Set(storieNelMondo).size === storieNelMondo.length}`, "|true");
    // l'ordine e' quello di uscita: una riga spostata a mano si vede
    const date = mondo.ordine.map((r) => r[2]);
    const storte = date.map((d, i) => (i && !(d >= date[i - 1]) ? `${mondo.ordine[i][1]} (${d}) dopo ${mondo.ordine[i - 1][1]} (${date[i - 1]})` : null)).filter(Boolean);
    t.eq(`${mondo.nome}: in ordine di data`, storte.join("; "), "");
    t.eq(`${mondo.nome}: ogni riga ha una data`, mondo.ordine.filter((r) => !/^\d{4}(-\d{2}){0,2}$/.test(r[2] || "")).map((r) => r[1]).join(), "");
  }

  // IL COSMERE: diciotto romanzi, e le file dicono la guida
  const cosmere = MONDI.find((m) => m.universo === "Cosmere");
  const c = camminoDelMondo(cosmere, []);
  t.eq("il Cosmere comincia da Elantris, poi Mistborn", c.tappe.slice(0, 3).map((x) => x.voce.t).join(", "), "Elantris, The Final Empire, The Well of Ascension");
  const wb = c.tappe.find((x) => x.voce.t === "Warbreaker");
  t.eq("il numero del cammino e' il posto nel mondo, e la voce tiene quello della serie (Warbreaker: 5, il 2 dei romanzi a se')", `${wb.posto},${wb.voce.o}`, "5,2");
  t.eq("diciotto volumi", c.volumi, 18);
  t.eq(
    "le file nominano la guida e il ciclo",
    perParte(c.tappe, { fila: true }).slice(0, 4).map((p) => `${p.parte}·${p.tappe.length}`).join(" | "),
    "Cosmere Standalones·1 | Mistborn · Era One·3 | Cosmere Standalones·1 | The Stormlight Archive·1"
  );
  t.eq("un Secret Project dice guida e ciclo", serieNelMondo(c.tappe.find((x) => x.voce.t === "The Sunlit Man").voce), "Cosmere Standalones · Secret Projects");
  t.eq("in Malazan il ciclo e' la guida, e si dice una volta", serieNelMondo({ guida: "Witness", c: "Witness" }), "Witness");

  // LE STORIE DI MEZZO NELLA FILA DEL COSMERE (il lettore: «fallo anche per
  // il cosmoverso», con Secret History, Edgedancer e Dawnshard sullo
  // scaffale): al loro posto con un decimale, non volumi, non passi
  const posti = Object.fromEntries(c.tappe.map((x) => [x.voce.t, x.posto]));
  t.eq(
    "le storie di mezzo dopo il romanzo uscito prima di loro",
    ["The Eleventh Metal", "Mistborn: Secret History", "Edgedancer", "Dawnshard", "Elsecaller and King Lopen the First of Alethkar"].map((x) => posti[x]).join(),
    "7.5,10.5,10.6,11.5,18.5"
  );
  t.eq("…e non sono volumi da contare", c.volumi, 18);
  t.eq("…e la riga lo dice", c.tappe.find((x) => x.voce.t === "Edgedancer").voce.nota, "storia di mezzo");
  const L = (id, title, extra = {}) => ({ id, title, author: "Brandon Sanderson", saga: "Cosmoverse", fileType: "epub", ...extra });
  const scaffale = [
    L("fe", "Mistborn: The Final Empire", { sagaOrder: 1, series: "Era One" }),
    L("hoa", "The Hero of Ages", { sagaOrder: 3, series: "Era One" }),
    L("sh", "Mistborn: Secret History", { sagaOrder: 3.5, series: "Era One" }),
    L("ed", "Edgedancer", { sagaOrder: 2.5, series: "The Stormlight Archive" }),
    L("wor", "Words of Radiance", { sagaOrder: 2, series: "The Stormlight Archive" }),
  ];
  const cc = camminoDelMondo(cosmere, scaffale, { scaffale });
  t.eq("la storia di mezzo si trova sullo scaffale per titolo", cc.tappe.find((x) => x.voce.t === "Mistborn: Secret History").libro?.id, "sh");
  t.eq("…e non conta fra i volumi che hai", cc.tue, 3);
  t.eq(
    "«Mettili in ordine» numera anche le storie di mezzo",
    numerazioneGuida(cc).map((n) => `${n.id}:${n.a}`).sort().join(),
    "ed:10.6,fe:2,hoa:4,sh:10.5,wor:8"
  );
  const statoDi = (id) => ({ fe: "read", hoa: "read" })[id] || "unread";
  const passo = prossimoPasso(cc, { statoDi, progressoDi: () => 0, spuntati: new Set() });
  t.eq("il passo non e' mai una storia di mezzo", cc.tappe.filter((x) => x.voce.tipo === "storia").some((x) => x === passo?.tappa), false);
  // letti tutti i romanzi fino a The Bands of Mourning (10), il passo e'
  // Oathbringer (11) e non Secret History (10,5) che sta sullo scaffale
  const fino10 = c.tappe.filter((x) => x.voce.tipo !== "storia" && x.posto <= 10).map((x, i) => L(`r${i}`, x.voce.t));
  const tutti = [...fino10, L("sh", "Mistborn: Secret History")];
  const avanti = prossimoPasso(camminoDelMondo(cosmere, tutti), { statoDi: (id) => (id === "sh" ? "unread" : "read"), progressoDi: () => 0, spuntati: new Set() });
  t.eq("letti i romanzi fino al 10, il passo e' Oathbringer", avanti?.tappa.voce.t, "Oathbringer");
  t.eq("…e non entrano nel conto dei letti", lettiDelCammino(cc, { statoDi, spuntati: new Set() }).quante, 18);
  const scritti = new Map(numerazioneGuida(cc).map((n) => [n.id, n.a]));
  t.eq("scritti i numeri, il Cosmere e' numerato col mondo", [...universiNumerati(scaffale.map((b) => (scritti.has(b.id) ? { ...b, sagaOrder: scritti.get(b.id) } : b)))].join(), "Cosmere");
};
