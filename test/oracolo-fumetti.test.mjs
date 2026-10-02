// L'ORACOLO NEI FUMETTI (`lib/oracoloFumetti.js`): quali tavole si mandano
// e come si chiede. Le regole dei libri valgono anche qui: mai una pagina
// dopo quella a cui sei, mai il titolo.
import {
  campionaPagine, puntoSullaTavola, domandaTavola, domandaRiassunto, domandaChi,
  DI_FILA, PAGINE_RIASSUNTO,
} from "../src/lib/oracoloFumetti.js";
import { chiedi } from "../src/lib/oracle.js";

const im = (n) => ({ pagina: n, dati: `B64-${n}`, media: "image/jpeg" });
const immagini = (user) => user.filter((b) => b.type === "image").map((b) => b.source.data);
const testi = (user) => user.filter((b) => b.type === "text").map((b) => b.text).join("\n");

export default async function (t) {
  // ---- quali pagine -----------------------------------------------------------
  const p = campionaPagine(120, 10);
  t.eq("al piu' quante se ne chiedono", p.length, 10);
  t.c("mai oltre la pagina a cui sei", p.every((n) => n <= 120), p.join(","));
  t.c("l'ultima e' quella a cui sei", p.at(-1) === 120);
  t.c(`le ultime ${DI_FILA} di fila`, p.slice(-DI_FILA).join(",") === "118,119,120", p.join(","));
  t.eq("si parte dall'inizio del volume", p[0], 1);
  t.c("in ordine e senza doppi", p.every((n, i) => i === 0 || n > p[i - 1]), p.join(","));
  t.c("sparse su tutto il volume, non ammucchiate", p[3] > 30 && p[5] < 100, p.join(","));
  t.eq("un volume corto si manda tutto", campionaPagine(4, 10).join(","), "1,2,3,4");
  t.eq("alla prima pagina, solo lei", campionaPagine(1, 10).join(","), "1");
  t.eq("prima della prima, niente", campionaPagine(0, 8).length, 0);
  t.eq("niente da chiedere, niente pagine", campionaPagine(50, 0).length, 0);
  t.eq("con meno pagine che di fila, solo la coda", campionaPagine(40, 2).join(","), "39,40");

  // ---- il punto toccato ----------------------------------------------------------
  const r = { left: 100, top: 50, width: 400, height: 600 };
  const q = puntoSullaTavola(300, 200, r);
  t.c("in frazioni dell'immagine", q && q.x === 0.5 && q.y === 0.25, JSON.stringify(q));
  t.eq("fuori dalla tavola non c'e' punto", puntoSullaTavola(90, 200, r), null);
  t.eq("nemmeno sotto", puntoSullaTavola(300, 700, r), null);
  t.eq("un'immagine senza misura non ha punti", puntoSullaTavola(1, 1, { left: 0, top: 0, width: 0, height: 0 }), null);
  t.eq("nemmeno nel suo angolo", puntoSullaTavola(0, 0, { left: 0, top: 0, width: 0, height: 0 }), null);

  // ---- la tavola ------------------------------------------------------------------
  const tav = domandaTavola({ immagini: [im(6), im(7)], pagine: [6, 7], domanda: "chi parla?", manga: true });
  t.eq("le due pagine a schermo, in ordine", immagini(tav.user).join(","), "B64-6,B64-7");
  t.c("prima le immagini, poi la domanda", tav.user[0].type === "image" && tav.user.at(-1).type === "text");
  t.c("la domanda del lettore arriva", /chi parla\?/.test(testi(tav.user)));
  t.c("il manga si dice", /destra a sinistra/.test(testi(tav.user)));
  t.c("racconta la scena", /che cosa succede/i.test(tav.system));
  t.c("e non traduce i balloon se non glielo chiedi", /Non tradurre/.test(tav.system) && !/Traduci/.test(tav.system));
  const trad = domandaTavola({ immagini: [im(6)], pagine: [6] });
  const tradotta = domandaTavola({ immagini: [im(6)], pagine: [6], traduci: true });
  t.c("la traduzione e' una domanda a parte", tradotta.system !== trad.system && /Traduci in italiano balloon/.test(tradotta.system));
  t.c("che non racconta la scena", /Niente commenti sulla scena/.test(tradotta.system));
  t.c("e lo chiede in fondo", /Traduci i balloon/.test(tradotta.user.at(-1).text) && /Che cosa succede/.test(trad.user.at(-1).text));
  t.c("anche la traduzione tace sul dopo", /non rivelare MAI/i.test(tradotta.system));
  t.c("e di non anticipare niente", /non rivelare MAI/i.test(tav.system));
  const sola = domandaTavola({ immagini: [im(3)], pagine: [3] });
  t.c("senza domanda chiede cosa succede, senza verso", /Pagina 3/.test(testi(sola.user)) && !/destra/.test(testi(sola.user)));
  t.c("un fumetto occidentale non si dice manga", !/manga/i.test(testi(sola.user)));

  // ---- il riassunto -----------------------------------------------------------------
  const ria = domandaRiassunto({ pagine: [im(1), im(40), im(80)], fino: 80 });
  t.eq("le tavole in ordine", immagini(ria.user).join(","), "B64-1,B64-40,B64-80");
  t.c("ognuna col suo numero", /Pagina 1:[\s\S]*Pagina 40:[\s\S]*Pagina 80:/.test(testi(ria.user)));
  t.c("e dove si e' fermato il lettore", /arrivato a pagina 80/.test(testi(ria.user)));
  t.c("non inventa le pagine che mancano", /non inventare/.test(ria.system));
  t.c("il riassunto ha la scheda lunga", ria.tetto > tav.tetto);

  // ---- chi e' ------------------------------------------------------------------------
  const chi = domandaChi({ precedenti: [im(2), im(5)], tavola: im(9), pagina: 9 });
  t.eq("prima le pagine precedenti, in fondo la tavola cerchiata", immagini(chi.user).join(","), "B64-2,B64-5,B64-9");
  t.c("il cerchio si spiega", /cerchio rosso/.test(chi.system) && /cerchio rosso/.test(testi(chi.user)));
  t.c("e non fa parte del disegno", /non fa parte del disegno/.test(chi.system));

  // ---- il titolo non parte mai -------------------------------------------------------
  const tutto = JSON.stringify([tav, sola, ria, chi]);
  t.c("nelle domande non c'e' un titolo", !/Libro:|«[A-Z][^»]*» di /.test(tutto));

  // ---- la chiamata: quella di sempre, con le immagini --------------------------------
  const visti = [];
  const primaDiMe = globalThis.localStorage;
  globalThis.localStorage = (() => {
    const m = new Map([["bc_ai_key", "sk-prova"]]);
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  })();
  try {
    const finto = async (url, opz) => {
      visti.push(JSON.parse(opz.body));
      return { ok: true, status: 200, json: async () => ({ content: [{ type: "text", text: "Due ragazzi litigano." }], usage: { input_tokens: 3000, output_tokens: 40 }, stop_reason: "end_turn" }) };
    };
    const out = await chiedi(ria, finto);
    t.eq("la risposta torna", out.answer, "Due ragazzi litigano.");
    t.eq("una richiesta", visti.length, 1);
    t.c("le immagini partono come blocchi", visti[0].messages[0].content.filter((b) => b.type === "image").length === 3);
    t.eq("col sistema del riassunto", visti[0].system, ria.system);
    t.eq("e il tetto suo", visti[0].max_tokens, ria.tetto);
  } finally {
    globalThis.localStorage = primaDiMe;
  }
  t.c("il riassunto ne manda al piu' dieci", PAGINE_RIASSUNTO <= 10);
}
