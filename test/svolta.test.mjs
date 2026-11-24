// LA VOLTATA RESTA DENTRO IL CAPITOLO?
//
// È la domanda su cui gira tutta la svolta della pagina, e vale la pena
// provarla da sola perché la risposta decide DUE cose opposte: dentro il
// capitolo il foglio gira, al confine resta il velo. Una risposta
// sbagliata non è un dettaglio estetico — «dentro» detto a un confine
// vuol dire far girare un foglio che poi si riassesta sotto gli occhi del
// lettore, cioè il difetto che il velo era venuto a curare.
import { leftoverScroll, dentroIlCapitolo } from "../src/lib/spread.js";
import { modoSvolta } from "../src/lib/readerSettings.js";

// il gestore di epub.js, ridotto a quello che queste due funzioni guardano
const gestore = (o = {}) => ({
  isPaginated: true,
  settings: { axis: "horizontal", direction: "ltr" },
  layout: { delta: 600 },
  container: { scrollLeft: 0, offsetWidth: 600, scrollWidth: 3000, clientWidth: 600 },
  ...o,
});

export default async function (t) {
  // ---- avanti -----------------------------------------------------------
  // in mezzo al capitolo c'è carta davanti: si scorre, e il foglio può girare
  t.c("a inizio capitolo si resta dentro", dentroIlCapitolo(gestore(), "next"));
  t.c(
    "e anche a metà",
    dentroIlCapitolo(gestore({ container: { scrollLeft: 1200, offsetWidth: 600, scrollWidth: 3000 } }), "next")
  );
  // sull'ULTIMA facciata epub.js cambia capitolo: lì comanda il velo
  t.c(
    "sull'ultima facciata NON si resta dentro",
    !dentroIlCapitolo(gestore({ container: { scrollLeft: 2400, offsetWidth: 600, scrollWidth: 3000 } }), "next")
  );
  // il conto è quello di epub.js, `left <= scrollWidth`: il confine è
  // esattamente dove lui decide di cambiare capitolo, non un pelo prima
  t.c(
    "il confine sta dove lo mette epub.js",
    dentroIlCapitolo(gestore({ container: { scrollLeft: 1800, offsetWidth: 600, scrollWidth: 3000 } }), "next")
  );

  // ---- indietro ----------------------------------------------------------
  t.c(
    "indietro da metà capitolo si resta dentro",
    dentroIlCapitolo(gestore({ container: { scrollLeft: 600, offsetWidth: 600, scrollWidth: 3000 } }), "prev")
  );
  t.c("indietro dalla PRIMA facciata si cambia capitolo", !dentroIlCapitolo(gestore(), "prev"));

  // ---- dove non si gira affatto ------------------------------------------
  // in scorrimento continuo non ci sono facciate da far girare
  t.c("a scorrimento niente svolta", !dentroIlCapitolo(gestore({ isPaginated: false }), "next"));
  t.c(
    "in verticale niente svolta",
    !dentroIlCapitolo(gestore({ settings: { axis: "vertical", direction: "ltr" } }), "next")
  );
  // da destra a sinistra il segno è rovesciato: meglio il velo che un
  // movimento che va dalla parte sbagliata
  t.c(
    "in rtl niente svolta",
    !dentroIlCapitolo(gestore({ settings: { axis: "horizontal", direction: "rtl" } }), "next")
  );
  t.c("senza facciata niente svolta", !dentroIlCapitolo(gestore({ layout: { delta: 0 } }), "next"));
  t.c("e senza gestore non esplode", !dentroIlCapitolo(null, "next"));
  t.c("né senza contenitore", !dentroIlCapitolo(gestore({ container: null }), "next"));

  // ---- e l'avanzo di carta resta quello che era --------------------------
  // (la stessa misura decide se scorrere il residuo invece di saltare
  // capitolo: le due funzioni guardano lo stesso contenitore e non devono
  // litigare)
  t.eq("senza residuo, zero", leftoverScroll(gestore()), 0);
  const conResto = gestore({ container: { scrollLeft: 2100, offsetWidth: 600, scrollWidth: 3000 } });
  t.eq("un residuo più corto di una facciata si scorre", leftoverScroll(conResto), 300);
  // E QUI LE DUE RISPOSTE SI CONTRADDICONO APPOSTA: col residuo epub.js
  // cederebbe il passo al capitolo dopo — quindi `dentroIlCapitolo` dice
  // «no», e ha ragione, perché è la SUA domanda — ma quella striscia è
  // carta di questo capitolo, già impaginata di fianco. Per questo
  // l'avanzo si chiede PER PRIMO nel reader: chiesto dopo, la voltata più
  // comune a fine capitolo finirebbe nel ramo del velo.
  t.c("col residuo epub.js cambierebbe capitolo", !dentroIlCapitolo(conResto, "next"));

  // ---- E QUALE DEI TRE MODI ESCE DA UNA PREFERENZA SALVATA ---------------
  //
  // `modoSvolta` non aveva un solo controllo, e intanto decide cosa vede il
  // lettore a OGNI voltata — il gesto più frequente dell'app. Legge un
  // valore che può arrivare da tre epoche diverse: il sì/no di prima, una
  // delle tre parole di adesso, o niente del tutto.
  t.eq("una scelta vera si rispetta: spazzata", modoSvolta("spazzata"), "spazzata");
  t.eq("...e dissolvenza", modoSvolta("dissolvenza"), "dissolvenza");
  t.eq("...e nessuna", modoSvolta("nessuna"), "nessuna");

  // il `false` di prima era «non voglio animazioni», e lo è ancora
  t.eq("il vecchio no resta un no", modoSvolta(false), "nessuna");

  // IL CASO CHE VALE IL TEST. Quando la preferenza era un sì/no, spazzata e
  // dissolvenza non esistevano come scelta: quel `true` diceva «voglio
  // vedere qualcosa quando volto», non «voglio la più cara delle tre».
  // Tradurlo in «spazzata» attribuisce al lettore una scelta mai offerta e
  // lo lascia sugli scatti senza che l'abbia chiesto.
  t.eq("il vecchio sì vale come «voglio un'animazione», non «voglio la spazzata»", modoSvolta(true), "dissolvenza");

  // e tutto ciò che non è nessuno dei tre finisce sul modo di partenza,
  // perché una levetta su nessuna delle tre posizioni non è una levetta
  t.eq("un valore mai visto ripiega sul modo di partenza", modoSvolta("piroetta"), "dissolvenza");
  t.eq("e così una preferenza che non c'è", modoSvolta(undefined), "dissolvenza");
  t.eq("e il null", modoSvolta(null), "dissolvenza");
  // «spazzata» scritta a mano sopravvive anche a un giro di andata e ritorno
  t.eq("due passaggi non cambiano la scelta", modoSvolta(modoSvolta("spazzata")), "spazzata");
}
