// LE NOTE A PIE' DI PAGINA SI LEGGONO SUL POSTO.
//
// La parte che si sbaglia è il RICONOSCIMENTO: un rimando di nota è un
// segno (*, †, [3]), un link di indice è una parola — e scambiare i due
// vuol dire o un indice che non naviga più, o una nota che ti strappa
// dalla pagina. Più il bersaglio allargato, che è geometria pura.
import { eNotaRef, risolviHref, estraiNota, pulisciNota, piuVicina, primoBloccoDopo } from "../src/lib/nota.js";

// un documento finto quanto basta: getElementById, closest e i FRATELLI
// (senza i fratelli non si può provare la nota che sta dopo l'ancora)
const elemento = (tag, testo, genitore) => {
  const el = {
    tagName: tag.toUpperCase(),
    textContent: testo,
    genitore,
    fratelli: [],
    get parentElement() {
      return this.genitore || null;
    },
    get nextElementSibling() {
      const f = this.genitore?.figli || [];
      return f[f.indexOf(this) + 1] || null;
    },
    closest(sel) {
      const cerca = sel.split(",").map((x) => x.trim().toUpperCase());
      let cur = this;
      while (cur) {
        if (cerca.includes(cur.tagName)) return cur;
        cur = cur.genitore;
      }
      return null;
    },
  };
  if (genitore) {
    genitore.figli = genitore.figli || [];
    genitore.figli.push(el);
  }
  return el;
};
const contenitore = (tag = "body") => ({ tagName: tag.toUpperCase(), figli: [], textContent: "" });
// `perNome` = le ancore alla vecchia maniera, `<a name="filepos1">`, che
// `getElementById` non vede: si trovano solo con un querySelector
const docCon = (mappa, perNome = {}) => ({
  getElementById: (id) => mappa[id] || null,
  querySelector: (sel) => {
    const m = /^\[name="(.*)"\]$/.exec(sel);
    return (m && perNome[m[1]]) || null;
  },
});

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

  // ---- L'ANCORA CHE STA PRIMA DELLA NOTA ---------------------------------
  // È la forma dei libri convertiti da Mobi (l'Eric del lettore):
  // `<a id="filepos1"></a>` da sola, e la nota nel paragrafo SUCCESSIVO.
  // `closest` lì non arriva mai — l'ancora non sta dentro niente — e la
  // scheda restava muta: il tocco si ripiegava sul salto, che per giunta
  // moriva con «No Section Found».
  const corpo = contenitore("body");
  const ancora = elemento("a", "", corpo);
  elemento("p", "* La nota che viene dopo l'ancora.", corpo);
  t.eq(
    "l'ancora nuda prende il paragrafo che la segue",
    estraiNota(docCon({ fn: ancora }), "fn"),
    "* La nota che viene dopo l'ancora."
  );
  // e i vuoti in mezzo non fermano la ricerca
  const corpo2 = contenitore("body");
  const ancora2 = elemento("a", "", corpo2);
  elemento("p", " ", corpo2);
  elemento("p", "* La nota vera, due passi più in là.", corpo2);
  t.eq(
    "i paragrafi vuoti in mezzo si saltano",
    estraiNota(docCon({ fn: ancora2 }), "fn"),
    "* La nota vera, due passi più in là."
  );
  // ma se dopo non c'è niente, non si inventa
  const corpo3 = contenitore("body");
  const sola = elemento("a", "", corpo3);
  t.eq("un'ancora sola in fondo torna vuota", estraiNota(docCon({ fn: sola }), "fn"), "");
  t.eq("e `primoBloccoDopo` senza niente torna null", primoBloccoDopo(sola), null);
  t.eq("né esplode sul niente", primoBloccoDopo(null), null);

  // il blocco che CONTIENE vince su quello che segue: la nota è quella in
  // cui l'ancora sta dentro, non la successiva
  const corpo4 = contenitore("body");
  const par = elemento("p", "* La nota che contiene l'ancora.", corpo4);
  const dentro = elemento("a", "", par);
  elemento("p", "Il paragrafo dopo, che NON è la nota.", corpo4);
  t.eq(
    "l'ancora dentro un paragrafo prende il suo",
    estraiNota(docCon({ fn: dentro }), "fn"),
    "* La nota che contiene l'ancora."
  );

  // ---- L'ANCORA ALLA VECCHIA MANIERA ------------------------------------
  // I convertiti da Mobi scrivono `<a name="filepos257551"></a>`, che
  // `getElementById` NON vede: il frammento risultava introvabile e il
  // tocco si ripiegava su un salto che moriva in silenzio.
  const corpo5 = contenitore("body");
  const vecchia = elemento("a", "", corpo5);
  elemento("p", "* La nota trovata col vecchio name.", corpo5);
  t.eq(
    "l'ancora col vecchio `name` si trova lo stesso",
    estraiNota(docCon({}, { filepos1: vecchia }), "filepos1"),
    "* La nota trovata col vecchio name."
  );

  // ---- IL CONTENITORE NON È LA NOTA -------------------------------------
  // Segnalato dal lettore con uno screenshot: toccato l'asterisco, la
  // scheda mostrava l'INIZIO DEL LIBRO — «Begin Reading» più l'epigrafe —
  // troncato a 1500 caratteri così bene da sembrare una nota vera.
  //
  // La causa: in Eric (convertito da Mobi) il romanzo è UN documento solo
  // dentro un unico <div>, e l'ancora della nota è una <a name> nuda
  // appesa lì dentro. `closest("div")` tornava quel <div> e il controllo
  // era solo «ha abbastanza testo».
  const IL_LIBRO = `Begin Reading${"The bees of Death are big and black. ".repeat(80)}`;
  const corpo6 = contenitore("body");
  const divone = elemento("div", IL_LIBRO, corpo6);
  elemento("a", "Begin Reading", divone);
  elemento("p", "The bees of Death are big and black.", divone);
  const ancoraMobi = elemento("a", "", divone);
  elemento("p", "* Il Bagaglio non è mai andato nelle Dimensioni Sotterranee.", divone);
  t.eq(
    "IL LIBRO INTERO NON È UNA NOTA: si prende il blocco che segue l'ancora",
    estraiNota(docCon({}, { filepos2: ancoraMobi }), "filepos2"),
    "* Il Bagaglio non è mai andato nelle Dimensioni Sotterranee."
  );

  // ma un <div> piccolo è una nota per davvero, e non va buttato via col
  // resto: tanti ePub la nota la mettono proprio lì
  const corpo7 = contenitore("body");
  const divino = elemento("div", "* Una nota dentro un div piccolo.", corpo7);
  const dentroDiv = elemento("a", "", divino);
  elemento("p", "Il paragrafo dopo, che NON è la nota.", corpo7);
  t.eq(
    "un div piccolo resta una nota",
    estraiNota(docCon({ fn: dentroDiv }), "fn"),
    "* Una nota dentro un div piccolo."
  );

  // e un blocco VERO non ha tetto: una nota di Pratchett può essere lunga
  // quanto una pagina, e resta la nota — il tetto è solo per i contenitori
  // generici, che possono essere il libro
  const NOTA_FIUME = `* ${"Una nota lunghissima ma pur sempre una nota. ".repeat(60)}`;
  const corpo8 = contenitore("body");
  const parFiume = elemento("p", NOTA_FIUME, corpo8);
  const dentroFiume = elemento("a", "", parFiume);
  t.c(
    "un paragrafo lungo resta la nota (il tetto è solo per div e section)",
    estraiNota(docCon({ fn: dentroFiume }), "fn").startsWith("* Una nota lunghissima")
  );
}
