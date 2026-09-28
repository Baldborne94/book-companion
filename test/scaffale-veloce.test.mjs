// LO SCAFFALE CHE SI COSTRUISCE VICINO ALLO SCHERMO, E I LIBRI LETTI DA
// LONTANO CHE SI RIAPRONO DALLA MEMORIA. Due regole che sbagliano in
// silenzio: una stima storta non alza errori, fa saltare la pagina sotto il
// dito; una memoria che serve il file sbagliato apre un altro libro.
import { altezzaStimata, ALTEZZA_SCHEDA, SPAZIO_RIGHE, COLONNA, SPAZIO_COLONNE } from "../src/lib/ripiani.js";
import { nuovaMemoria, firmaLontana, MAX_LIBRI, MAX_BYTE } from "../src/lib/ultimiLontani.js";

const blob = (n, nome) => ({ size: n, nome });

export default async function (t) {
  // ---- la stima dell'altezza di un ripiano ----
  {
    // 1280 di schermo meno i margini: la griglia di Shelf ci mette 10 colonne
    const largo = 10 * COLONNA + 9 * SPAZIO_COLONNE;
    t.eq("un libro solo: una riga", altezzaStimata(1, largo), ALTEZZA_SCHEDA);
    t.eq("dieci libri su dieci colonne: una riga", altezzaStimata(10, largo), ALTEZZA_SCHEDA);
    t.eq("undici: due righe, con lo spazio fra l'una e l'altra", altezzaStimata(11, largo), 2 * ALTEZZA_SCHEDA + SPAZIO_RIGHE);
    t.eq("un pixel in meno: nove colonne", altezzaStimata(10, largo - 1), 2 * ALTEZZA_SCHEDA + SPAZIO_RIGHE);
    t.eq("un telefono stretto fa almeno una colonna", altezzaStimata(3, 50), 3 * ALTEZZA_SCHEDA + 2 * SPAZIO_RIGHE);
    t.eq("una larghezza che non si sa vale una colonna, non zero righe", altezzaStimata(2, undefined), 2 * ALTEZZA_SCHEDA + SPAZIO_RIGHE);
    t.eq("un ripiano vuoto non occupa niente", altezzaStimata(0, largo), 0);
    t.eq("un conto storto nemmeno", altezzaStimata(NaN, largo), 0);
    t.c("la stima e' un numero, mai NaN", Number.isFinite(altezzaStimata("12", "900")));
  }

  // ---- la memoria dei libri letti da lontano ----
  {
    const m = nuovaMemoria();
    const a = blob(1000, "A");
    m.tieni("a", "f1:1000", a);
    t.eq("riaprendo lo stesso file si serve dalla memoria", m.prendi("a", "f1:1000"), a);
    t.eq("un file cambiato lassu' no", m.prendi("a", "f2:1000"), null);
    t.eq("…ne' uno della stessa copia con un'altra misura", m.prendi("a", "f1:999"), null);
    t.eq("un libro mai letto non c'e'", m.prendi("b", "f1:1000"), null);
    m.dimentica("a");
    t.eq("dimenticato, non c'e' piu'", m.prendi("a", "f1:1000"), null);
  }
  {
    const m = nuovaMemoria({ maxLibri: 2, maxByte: 10_000 });
    m.tieni("a", "x", blob(100, "A"));
    m.tieni("b", "x", blob(100, "B"));
    m.prendi("a", "x"); // riaperto: torna in cima
    m.tieni("c", "x", blob(100, "C"));
    t.eq("al tetto dei libri se ne va il toccato meno di recente", m.ids().join(","), "a,c");
  }
  {
    const m = nuovaMemoria({ maxLibri: 5, maxByte: 250 });
    m.tieni("a", "x", blob(100, "A"));
    m.tieni("b", "x", blob(100, "B"));
    m.tieni("c", "x", blob(100, "C"));
    t.eq("al tetto dei byte se ne vanno i piu' vecchi", m.ids().join(","), "b,c");
    m.tieni("d", "x", blob(300, "D"));
    t.eq("un file troppo grande da solo non si tiene, e non manda via nessuno", m.ids().join(","), "b,c");
    m.tieni("b", "y", blob(0, "vuoto"));
    t.eq("un file vuoto non si tiene, e toglie la copia vecchia", m.ids().join(","), "c");
    m.tieni("c", "x", null);
    t.eq("niente da tenere: la copia che c'era resta", m.ids().join(","), "c");
  }
  t.c("i tetti di partenza stanno larghi ma non infiniti", MAX_LIBRI >= 2 && MAX_BYTE <= 256 * 1024 * 1024);
  t.eq("la firma e' la copia su Drive: id e misura", firmaLontana({ id: "f1", byte: 1000 }), "f1:1000");
  t.c("due file diversi, due firme", firmaLontana({ id: "f1", byte: 1000 }) !== firmaLontana({ id: "f2", byte: 1000 }));
  t.eq("dal secchio (nessuna voce su Drive) la firma e' fissa", firmaLontana(null), firmaLontana(undefined));
}
