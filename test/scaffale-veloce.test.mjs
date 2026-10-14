// LO SCAFFALE CHE SI COSTRUISCE VICINO ALLO SCHERMO. Una stima storta non
// alza errori: fa saltare la pagina sotto il dito.
import { altezzaStimata, ALTEZZA_SCHEDA, SPAZIO_RIGHE, COLONNA, SPAZIO_COLONNE } from "../src/lib/ripiani.js";

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
}
