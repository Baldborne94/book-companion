// L'ORDINE DI LETTURA DI UN MONDO INTERO (`camminoDelMondo`, `MONDI`),
// chiesto dal lettore con la sua raccolta «Malazan universe»: «mi metti
// l'ordine di lettura di tutti i libri del malazan universe e non solo
// delle singole serie?». Quel che sbaglia in silenzio: un ordine che non e'
// quello di uscita, le serie raccolte per nome (che rifanno l'ordine di una
// guida), e un numero del mondo scritto al posto di quello della serie.
import { MONDI, TAVOLE } from "../src/lib/sagaBooks.js";
import { ORDINE } from "../src/data/malazanMondo.js";
import { camminiDi, camminoDelMondo, mondiDi, perParte, rifaiCammino, tavolaDelMondo, prossimoPasso } from "../src/lib/cammino.js";
import { numerazioneGuida, serieDaScrivere } from "../src/lib/numeraCammino.js";
import { vociDallaGuida } from "../src/lib/senzaFile.js";

const L = (id, title, author, extra = {}) => ({ id, title, author, fileType: "epub", ...extra });

export default async (t) => {
  const mondo = MONDI.find((m) => m.universo === "Malazan");
  t.c("Malazan ha un ordine del mondo", !!mondo);
  const tav = tavolaDelMondo(mondo);

  // LA TAVOLA: ogni volume di ogni guida del mondo, una volta, e niente
  // che le guide non abbiano
  const guide = TAVOLE.filter((x) => x.universo === "Malazan");
  const tutti = guide.flatMap((g) => g.libri.map((v) => `${g.saga}\u0000${v.t}`));
  const nelMondo = tav.libri.map((v) => `${v.guida}\u0000${v.t}`);
  t.eq("ogni riga dell'ordine e' una voce della sua guida", tav.libri.filter((v) => !v.t).map((v) => v.guida).join(), "");
  t.eq("ogni volume delle guide di Malazan sta nel mondo", tutti.filter((k) => !nelMondo.includes(k)).join(" | "), "");
  t.eq("…una volta sola", new Set(nelMondo).size, nelMondo.length);
  // e la fila e' quella di uscita: una riga spostata a mano si vede
  const date = ORDINE.map((r) => r[2]);
  const fuori = date.map((d, i) => (i && d < date[i - 1] ? `${ORDINE[i][1]} (${d}) dopo ${ORDINE[i - 1][1]} (${date[i - 1]})` : null)).filter(Boolean);
  t.eq("l'ordine e' quello delle date", fuori.join("; "), "");

  // IL CAMMINO: i libri del lettore, scritti come sul suo tablet
  const libri = [
    L("toll", "Malazan 08 - Toll the Hounds", "Steven Erikson", { saga: "Malazan universe", sagaOrder: 3 }),
    L("nok", "Night of Knives", "Ian C. Esslemont", { saga: "Malazan universe" }),
    L("gotm", "Gardens of the Moon", "Steven Erikson", { saga: "Malazan universe", sagaOrder: 1, series: "Malazan Book of the Fallen" }),
    L("way", "The Way of Kings", "Brandon Sanderson", { saga: "Cosmoverse" }),
  ];
  const c = camminoDelMondo(mondo, libri, { scaffale: libri });
  t.c("e' un cammino di mondo", c.mondo === true);
  t.eq("il nome e' quello del mondo", c.saga, "Tutto Malazan");
  t.eq(
    "le tappe nell'ordine di uscita, con le serie che si alternano",
    c.tappe.slice(0, 7).map((x) => x.voce.t).join(", "),
    "Gardens of the Moon, Deadhouse Gates, Memories of Ice, House of Chains, Midnight Tides, Night of Knives, The Bonehunters"
  );
  const di = (titolo) => c.tappe.find((x) => x.voce.t === titolo);
  t.eq("ogni volume tiene il numero della SUA serie (Toll the Hounds e' l'8)", di("Toll the Hounds").posto, 8);
  t.eq("…e Night of Knives l'1 della sua", di("Night of Knives").posto, 1);
  t.eq("i libri si trovano nella loro guida (non «altrui»)", ["Toll the Hounds", "Night of Knives"].map((x) => `${!!di(x).libro}${!!di(x).altrui}`).join(), "truefalse,truefalse");
  t.eq("hai 3 dei 25 volumi", `${c.tue}/${c.volumi}`, "3/25");
  t.eq("quel che il ripiano ha fuori dal mondo si conta", `${c.fuori} ${c.dalRipiano}`, "1 3");

  // LE PARTI: una fila per serie, e la stessa serie torna
  const parti = perParte(c.tappe, { fila: true });
  t.eq(
    "le prime file: cinque del Libro dei Caduti, uno di Esslemont, di nuovo Erikson",
    parti.slice(0, 3).map((p) => `${p.parte}·${p.tappe.length}`).join(" | "),
    "Malazan Book of the Fallen·5 | Novels of the Malazan Empire·1 | Malazan Book of the Fallen·2"
  );
  t.eq("raccolte per nome sarebbero cinque parti, una per guida", perParte(c.tappe).length, 5);
  t.eq("senza `fila` resta il raggruppamento di prima", perParte(c.tappe).map((p) => p.tappe.length).join(), "10,6,2,4,3");

  // I NUMERI: quelli delle serie, mai il posto nel mondo
  const numeri = numerazioneGuida(c);
  t.eq("Toll the Hounds scritto 3 diventa 8, non il suo posto nel mondo", numeri.map((n) => `${n.id}:${n.a}`).sort().join(), "nok:1,toll:8");
  t.eq("la serie e' quella della guida del volume", serieDaScrivere(c).map((s) => `${s.id}:${s.a}`).sort().join(), "nok:Novels of the Malazan Empire,toll:Malazan Book of the Fallen");

  // IL PROSSIMO PASSO e' il primo del mondo che non hai letto
  const stati = { gotm: "read" };
  const passo = prossimoPasso(c, { statoDi: (id) => stati[id] || "unread", progressoDi: () => 0, spuntati: new Set() });
  t.eq("letto Gardens of the Moon, il passo e' Deadhouse Gates", passo?.tappa.voce.t, "Deadhouse Gates");
  t.eq("…e il primo che puoi aprire e' Night of Knives, il sesto", passo?.apribile?.voce.t, "Night of Knives");

  // IL TASTO: sul ripiano di Malazan si', su quello del Cosmere no
  const qui = camminiDi(libri, { scaffale: libri.slice(0, 3) });
  t.eq("un ripiano con una guida di Malazan ha il mondo", mondiDi(qui, libri, { scaffale: libri.slice(0, 3) }).map((m) => m.saga).join(), "Tutto Malazan");
  const cosmere = camminiDi(libri, { scaffale: [libri[3]] });
  t.eq("il Cosmere un ordine del mondo non ce l'ha", mondiDi(cosmere, libri, { scaffale: [libri[3]] }).length, 0);

  // RIFATTO coi libri di adesso, resta un mondo
  const rifatto = rifaiCammino(c, [...libri, L("dg", "Deadhouse Gates", "Steven Erikson")]);
  t.eq("rifatto, e' ancora il mondo col libro nuovo", `${rifatto?.mondo} ${rifatto?.tue}`, "true 4");
  const guida = rifaiCammino(camminiDi(libri, { scaffale: [libri[3]] })[0], libri);
  t.eq("una guida rifatta resta la sua guida", `${guida?.mondo} ${guida?.saga}`, "false The Stormlight Archive");

  // LE SCHEDE SENZA FILE: in ordine di mondo, ognuna con la serie e il
  // numero della sua guida, nella raccolta dove il lettore tiene Malazan
  const voci = vociDallaGuida(c, libri);
  t.eq("tutti e 25, in ordine di mondo", voci.map((v) => v.titolo).slice(4, 7).join(", "), "Midnight Tides, Night of Knives, The Bonehunters");
  const nok = voci.find((v) => v.titolo === "Night of Knives");
  t.eq("Night of Knives: la sua serie, il suo numero, la raccolta del lettore", `${nok.serie} · ${nok.numero} · ${nok.saga} · ${nok.autore}`, "Novels of the Malazan Empire · 1 · Malazan universe · Ian C. Esslemont");
  t.eq("quel che hai e' segnato", voci.filter((v) => v.gia).map((v) => v.titolo).join(), "Gardens of the Moon,Night of Knives,Toll the Hounds");
};
