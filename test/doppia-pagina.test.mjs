// LA DOPPIA PAGINA DEI FUMETTI (`coppie`, `coppiaDi`, `coppiaVicina`,
// `disegnaCoppia`, `doppiaAccesa` in `lib/fumetto.js`). Sbaglia in
// silenzio: una coppia sfasata spezza a meta' la tavola doppia del volume
// stampato, e una pagina saltata in avanti non alza nessun errore.
import {
  coppie, coppiaDi, coppiaVicina, disegnaCoppia, doppiaAccesa, eLarga, orientamento,
  leggiDoppia, scriviDoppia,
} from "../src/lib/fumetto.js";

export default async function (t) {
  const s = (xs) => xs.map((c) => c.join("-")).join(" ");
  t.eq("la copertina da sola, poi le coppie del volume stampato", s(coppie(7)), "1 2-3 4-5 6-7");
  t.eq("l'ultima pagina spaiata sta da sola", s(coppie(6)), "1 2-3 4-5 6");
  const larghe = new Set([7]);
  t.eq("una tavola larga sta da sola, e dopo le coppie ripartono", s(coppie(12, { larghe })), "1 2-3 4-5 6 7 8-9 10-11 12");
  t.eq("sposta fa partire le coppie una pagina piu' in la'", s(coppie(7, { sposta: 1 })), "1 2 3-4 5-6 7");
  t.eq("niente pagine, niente coppie", coppie(0).length, 0);
  t.eq("una pagina sola", s(coppie(1)), "1");

  t.eq("la coppia di una pagina e' la stessa da qualunque lato", coppiaDi(9, 12, { larghe }).join("-") + " " + coppiaDi(8, 12, { larghe }).join("-"), "8-9 8-9");
  t.eq("una pagina fuori dal volume si riporta dentro", coppiaDi(99, 12, { larghe }).join("-"), "12");

  const avanti = [];
  for (let p = 1; p; p = coppiaVicina(p, 12, { larghe }, 1)) avanti.push(coppiaDi(p, 12, { larghe }).join("-"));
  t.eq("avanti di coppia in coppia, fino in fondo", avanti.join(" "), "1 2-3 4-5 6 7 8-9 10-11 12");
  const indietro = [];
  for (let p = 12; p; p = coppiaVicina(p, 12, { larghe }, -1)) indietro.push(coppiaDi(p, 12, { larghe }).join("-"));
  t.eq("indietro le stesse coppie, al contrario", indietro.join(" "), "12 10-11 8-9 7 6 4-5 2-3 1");
  t.eq("in fondo non si va oltre", coppiaVicina(12, 12, { larghe }, 1), null);
  t.eq("in cima non si va prima", coppiaVicina(1, 12, { larghe }, -1), null);

  t.c("una tavola doppia e' larga", eLarga({ w: 1400, h: 1000 }));
  t.c("una pagina e' in piedi", !eLarga({ w: 700, h: 1000 }));
  t.c("senza misura non e' larga", !eLarga(null));

  // IL DISEGNO: stessa altezza, dentro il riquadro, e il verso dei manga
  const d = disegnaCoppia({ nats: [{ w: 600, h: 900 }, { w: 1200, h: 900 }], riquadro: { w: 1280, h: 800 } });
  t.c("le due tavole alla stessa altezza", d.pagine[0].foglio.h === d.pagine[1].foglio.h, JSON.stringify(d.pagine.map((p) => p.foglio)));
  t.c("la coppia sta nel riquadro", d.foglio.w <= 1280 && d.foglio.h <= 800, JSON.stringify(d.foglio));
  t.c("…e lo riempie da un lato", Math.abs(d.foglio.w - 1280) < 1 || Math.abs(d.foglio.h - 800) < 1, JSON.stringify(d.foglio));
  t.eq("la seconda comincia dove finisce la prima", d.pagine[1].x, d.pagine[0].foglio.w);
  const m = disegnaCoppia({ nats: [{ w: 600, h: 900 }, { w: 600, h: 900 }], riquadro: { w: 1280, h: 800 }, verso: "rtl" });
  t.eq("in un manga la pagina dopo sta a sinistra", m.pagine.map((p) => `${p.indice}@${p.x}`).join(" "), `1@0 0@${m.pagine[0].foglio.w}`);
  const b = disegnaCoppia({ nats: [{ w: 1000, h: 1000 }], riquadro: { w: 500, h: 500 }, bordi: { l: 0.1, t: 0, r: 0.9, b: 1 } });
  t.eq("i bordi della scansione restano fuori", `${b.foglio.w}x${b.foglio.h} ${b.pagine[0].immagine.x}`, "400x500 -50");
  t.eq("senza misure non si disegna", disegnaCoppia({ nats: [null], riquadro: { w: 1, h: 1 } }), null);

  // DOPPIA O SINGOLA: la scelta vince, senza scelta decide il vetro
  t.c("sdraiato, doppia da sola", doppiaAccesa(null, { w: 1280, h: 800 }));
  t.c("in piedi, singola da sola", !doppiaAccesa(null, { w: 800, h: 1280 }));
  t.c("spenta a mano resta spenta", !doppiaAccesa("no", { w: 1280, h: 800 }));
  t.c("accesa a mano resta accesa", doppiaAccesa("si", { w: 800, h: 1280 }));
  const mem = new Map();
  const st = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  scriviDoppia(orientamento({ w: 1280, h: 800 }), "si", st);
  t.eq("la scelta vale per l'orientamento in cui e' fatta", leggiDoppia("largo", st), "si");
  t.eq("…e non per l'altro (girato in piedi, niente francobolli)", leggiDoppia(orientamento({ w: 800, h: 1280 }), st), null);
}
