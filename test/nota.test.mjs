// LE NOTE A PIE' DI PAGINA SI LEGGONO SUL POSTO.
//
// La parte che si sbaglia è il RICONOSCIMENTO: un rimando di nota è un
// segno (*, †, [3]), un link di indice è una parola — e scambiare i due
// vuol dire o un indice che non naviga più, o una nota che ti strappa
// dalla pagina. Più il bersaglio allargato, che è geometria pura.
import { eNotaRef, risolviHref, estraiNota, pulisciNota, piuVicina } from "../src/lib/nota.js";

// un documento finto quanto basta: getElementById più closest
const elemento = (tag, testo, genitore) => {
  const el = {
    tagName: tag.toUpperCase(),
    textContent: testo,
    closest(sel) {
      const cerca = sel.split(",").map((s) => s.trim().toUpperCase());
      let cur = this;
      while (cur) {
        if (cerca.includes(cur.tagName)) return cur;
        cur = cur.genitore;
      }
      return null;
    },
    genitore,
  };
  return el;
};
const docCon = (mappa) => ({ getElementById: (id) => mappa[id] || null });

export default async function (t) {
  // ---- il riconoscimento del rimando ------------------------------------
  t.c("l'asterisco in apice è una nota", eNotaRef({ href: "c1.xhtml#fn1", testo: "*" }));
  t.c("anche con gli spazi attorno", eNotaRef({ href: "#fn1", testo: " * " }));
  t.c("la cifra è una nota", eNotaRef({ href: "note.xhtml#n3", testo: "3" }));
  t.c("e la cifra fra parentesi quadre", eNotaRef({ href: "#n3", testo: "[3]" }));
  t.c(
    "la dichiarazione epub vince anche con testo lungo",
    eNotaRef({ href: "note.xhtml#n1", testo: "vedi nota", tipo: "noteref" })
  );
  t.c("e il role del web vale uguale", eNotaRef({ href: "#x", testo: "nota", ruolo: "doc-noteref" }));
  t.c("«Capitolo 3» NON è una nota: è l'indice", !eNotaRef({ href: "c3.xhtml", testo: "Capitolo 3" }));
  t.c(
    "una parola col frammento resta un rimando interno, non una nota",
    !eNotaRef({ href: "c3.xhtml#inizio", testo: "come s'è visto" })
  );
  t.c("un link esterno non è mai una nota", !eNotaRef({ href: "https://x.com/a#fn1", testo: "*" }));
  t.c("senza href niente nota", !eNotaRef({ testo: "*" }));
  t.c("una cifra SENZA frammento non è una nota", !eNotaRef({ href: "c3.xhtml", testo: "3" }));

  // ---- la risoluzione del percorso --------------------------------------
  t.eq("stessa cartella", risolviHref("note.xhtml#n1", "OEBPS/c1.xhtml").file, "OEBPS/note.xhtml");
  t.eq("col frammento suo", risolviHref("note.xhtml#n1", "OEBPS/c1.xhtml").frammento, "n1");
  t.eq("risalendo di cartella", risolviHref("../note/n.xhtml#a", "OEBPS/testo/c1.xhtml").file, "OEBPS/note/n.xhtml");
  t.eq("solo frammento = stesso file", risolviHref("#fn1", "OEBPS/c1.xhtml").file, "OEBPS/c1.xhtml");
  t.eq("e il frammento c'è", risolviHref("#fn1", "OEBPS/c1.xhtml").frammento, "fn1");

  // ---- l'estrazione -----------------------------------------------------
  const p = elemento("p", "* Non i libri proibiti: quelli DAVVERO erotici.");
  const aside = elemento("aside", "La nota dentro un aside.");
  const dentroAside = elemento("a", "", aside);
  t.eq(
    "l'id sul paragrafo dà il paragrafo",
    estraiNota(docCon({ fn1: p }), "fn1"),
    "* Non i libri proibiti: quelli DAVVERO erotici."
  );
  t.eq(
    "L'ANCORA NUDA NON È LA NOTA: si sale al blocco che la contiene",
    estraiNota(docCon({ fn2: dentroAside }), "fn2"),
    "La nota dentro un aside."
  );
  t.eq("un frammento che non c'è torna vuoto", estraiNota(docCon({}), "fn9"), "");
  t.eq("e senza documento pure", estraiNota(null, "fn1"), "");

  t.eq("gli spazi si stirano", pulisciNota("  una\n   nota  "), "una nota");
  t.eq("il ritorno alla fine se ne va", pulisciNota("la nota ↩"), "la nota");
  const lunga = `${"Una frase vera. ".repeat(200)}`;
  t.c("una nota-lenzuolo si tronca", pulisciNota(lunga).length < 1600);
  t.c("e si tronca a fine frase, con i puntini", /\.…$|…$/.test(pulisciNota(lunga)));

  // ---- il bersaglio allargato -------------------------------------------
  const rett = [
    { left: 100, top: 100, right: 110, bottom: 112, href: "a" },
    { left: 300, top: 100, right: 310, bottom: 112, href: "b" },
  ];
  t.eq("il tocco dentro prende il suo", piuVicina(rett, 105, 106)?.href, "a");
  t.eq("il tocco a un soffio pure", piuVicina(rett, 95, 120)?.href, "a");
  t.eq("fra due vince il più vicino", piuVicina(rett, 295, 106)?.href, "b");
  t.eq("il tocco lontano non prende niente", piuVicina(rett, 200, 300), null);
  t.eq("il raggio è un raggio: a 29px non scatta", piuVicina(rett, 100 - 29, 106, 28), null);
  t.eq("senza rimandi niente", piuVicina([], 105, 106), null);
}
