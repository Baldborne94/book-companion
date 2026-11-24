// LE EVIDENZIAZIONI NEI PDF: rettangoli in frazioni di pagina.
//
// Un PDF non ha CFI, quindi quel che hai segnato si salva come rettangoli
// espressi in frazioni (0–1) della pagina. È la scelta che le tiene al loro
// posto a ogni zoom, su ogni schermo e dopo ogni ridisegno — e anche quella
// che le fa sbagliare IN SILENZIO se il conto non torna: una frazione storta
// non è un errore, è un'evidenziazione che finisce da un'altra parte, su una
// riga che non avevi scelto tu.
//
// Nessuno se ne accorge finché non riapre il libro.
import { pageOf, mergeRects, toPageRects, rectStyle } from "../src/lib/pdfHighlights.js";

const R = (x, y, w, h) => ({ x, y, w, h });
const C = (left, top, width, height) => ({ left, top, width, height });
// la pagina disegnata sullo schermo: un riquadro che non parte da zero,
// perché nel reader la pagina sta in mezzo, con le barre attorno
const BOX = { left: 100, top: 50, width: 400, height: 800 };

export default async function (t) {
  // =======================================================================
  // LA PAGINA FA DA CFI
  // =======================================================================
  //
  // Così il giardino delle citazioni ci arriva senza sapere niente dei PDF:
  // per lui è un «cfi» come quello degli EPUB.
  {
    t.eq("il numero di pagina si legge", pageOf({ cfi: "7" }), 7);
    t.eq("anche se si porta dietro della roba", pageOf({ cfi: "7v" }), 7);
    // QUEL CHE NON È UN NUMERO VALE ZERO, e zero non è una pagina vera: le
    // pagine partono da 1, quindi un'evidenziazione rotta non si accende su
    // nessuna pagina invece di accendersi sulla prima
    t.eq("una stringa che non è un numero vale zero", pageOf({ cfi: "abc" }), 0);
    t.eq("una stringa vuota pure", pageOf({ cfi: "" }), 0);
    t.eq("un'evidenziazione senza cfi", pageOf({}), 0);
    t.eq("e nemmeno un'evidenziazione", pageOf(null), 0);
  }

  // =======================================================================
  // LE PAROLE DI UNA RIGA DIVENTANO UNA FASCIA SOLA
  // =======================================================================
  //
  // Una selezione produce un rettangolo per ogni span del livello testo. Non
  // fondendoli, l'evidenziazione esce tratteggiata parola per parola — si
  // vede, ed è brutta.
  {
    const r = mergeRects([R(0.1, 0.5, 0.1, 0.02), R(0.21, 0.5, 0.1, 0.02)]);
    t.eq("due parole vicine fanno una fascia", r.length, 1);
    t.eq("che comincia dalla prima", r[0].x, 0.1);
    t.eq("e finisce dopo la seconda", r[0].w, 0.21);
  }
  {
    // MA NON SI FONDE QUEL CHE È LONTANO: due pezzi separati sulla stessa
    // riga sono due pezzi, e una fascia sola coprirebbe il testo in mezzo —
    // che non avevi selezionato.
    const r = mergeRects([R(0.1, 0.5, 0.1, 0.02), R(0.5, 0.5, 0.1, 0.02)]);
    t.eq("due pezzi lontani restano due", r.length, 2);
    t.eq("il primo non si allarga", r[0].w, 0.1);
  }
  {
    // DUE RIGHE RESTANO DUE. Fuse, la fascia coprirebbe lo spazio fra le
    // righe e l'evidenziazione diventerebbe un blocco.
    const r = mergeRects([R(0.1, 0.5, 0.3, 0.02), R(0.1, 0.56, 0.3, 0.02)]);
    t.eq("righe diverse non si fondono", r.length, 2);
    t.eq("e restano in ordine di lettura", `${r[0].y} ${r[1].y}`, "0.5 0.56");
  }
  {
    // LA SOGLIA È METÀ DELL'ALTEZZA, e su righe fitte è quel che decide.
    // Misurata su rettangoli alti 0.02: fino a uno scarto di 0.010 sono la
    // stessa riga, da 0.011 sono due.
    const quante = (dy) => mergeRects([R(0.1, 0.5, 0.3, 0.02), R(0.1, 0.5 + dy, 0.3, 0.02)]).length;
    t.eq("scostate di un quarto d'altezza: una riga", quante(0.005), 1);
    t.eq("a metà esatta: ancora una", quante(0.01), 1);
    t.eq("appena oltre la metà: due", quante(0.011), 2);
    t.eq("e ben separate: due", quante(0.02), 2);
  }
  {
    // L'ORDINE D'ARRIVO NON CONTA: il livello testo di pdf.js non promette
    // nessun ordine, e due letture della stessa selezione devono dare la
    // stessa evidenziazione.
    const tre = [R(0.1, 0.5, 0.1, 0.02), R(0.5, 0.5, 0.1, 0.02), R(0.21, 0.5, 0.1, 0.02)];
    const esiti = [[0, 1, 2], [2, 1, 0], [1, 0, 2], [2, 0, 1]].map((ordine) =>
      JSON.stringify(mergeRects(ordine.map((i) => ({ ...tre[i] }))))
    );
    t.eq("qualunque ordine dà lo stesso risultato", new Set(esiti).size, 1);
    // e il risultato è quello giusto: i due vicini fusi, il lontano da parte
    t.eq("due fasce", JSON.parse(esiti[0]).length, 2);
  }
  {
    // I RETTANGOLI CHE ARRIVANO NON SI TOCCANO, ed è la trappola silenziosa
    // di questo modulo: `mergeRects` gira anche su evidenziazioni GIÀ SALVATE
    // ogni volta che si ridisegna la pagina. Se allargasse gli originali
    // invece delle copie, ogni ridisegno le farebbe crescere un po' — e la
    // riga segnata si allargherebbe da sola, giorno dopo giorno, senza che
    // niente lo dica.
    const originali = [R(0.1, 0.5, 0.1, 0.02), R(0.21, 0.5, 0.1, 0.02)];
    const prima = JSON.stringify(originali);
    mergeRects(originali);
    t.eq("gli originali restano com'erano", JSON.stringify(originali), prima);
    // e rifondere il risultato non lo fa crescere ancora
    const una = mergeRects(originali);
    t.eq("e fondere due volte dà lo stesso", JSON.stringify(mergeRects(una)), JSON.stringify(una));
  }
  {
    t.eq("niente rettangoli, niente fasce", mergeRects([]).length, 0);
    t.eq("uno solo resta uno", mergeRects([R(0.1, 0.5, 0.3, 0.02)]).length, 1);
  }

  // =======================================================================
  // DA PIXEL A FRAZIONI: il conto che, sbagliato, sposta tutto
  // =======================================================================
  {
    // il riquadro non parte da zero — nel reader la pagina sta in mezzo, con
    // le barre attorno — quindi l'origine va tolta, o l'evidenziazione
    // scivolerebbe di quanto misura la barra
    const r = toPageRects([C(200, 450, 100, 16)], BOX);
    t.eq("una riga sola", r.length, 1);
    t.eq("a un quarto da sinistra", r[0].x, 0.25);
    t.eq("a metà pagina", r[0].y, 0.5);
    t.eq("larga un quarto", r[0].w, 0.25);
    t.eq("alta il due percento", r[0].h, 0.02);
  }
  {
    // LA PROMESSA DEL MODULO, provata: la stessa selezione su uno schermo
    // grande il doppio dà le STESSE frazioni. È per questo che si salvano
    // frazioni e non pixel — e se questo conto sbagliasse, riaprendo il
    // libro su un altro schermo le evidenziazioni sarebbero altrove.
    const piccolo = toPageRects([C(200, 450, 100, 16)], BOX);
    const grande = toPageRects(
      [C(100 + (200 - 100) * 2, 50 + (450 - 50) * 2, 200, 32)],
      { left: 100, top: 50, width: 800, height: 1600 }
    );
    t.eq("raddoppiando lo schermo le frazioni non cambiano", JSON.stringify(grande), JSON.stringify(piccolo));
  }
  {
    // I RETTANGOLI A FILO DI ZERO SONO I SEPARATORI fra gli span, non testo:
    // tenuti, l'evidenziazione si riempirebbe di schegge invisibili che si
    // portano dietro peso e disegno per niente
    t.eq("una scheggia larga meno di un pixel si butta", toPageRects([C(200, 450, 0.5, 16)], BOX).length, 0);
    t.eq("e una alta meno di un pixel pure", toPageRects([C(200, 450, 100, 0.4)], BOX).length, 0);
    // ma un rettangolo vero accanto a una scheggia si tiene
    t.eq("il testo vero resta", toPageRects([C(200, 450, 0.5, 16), C(210, 450, 100, 16)], BOX).length, 1);
  }
  {
    // UN RIQUADRO SENZA MISURA NON È UNA PAGINA: dividere per zero darebbe
    // frazioni infinite, e quelle finirebbero SALVATE
    t.eq("larghezza zero: niente", toPageRects([C(1, 1, 9, 9)], { left: 0, top: 0, width: 0, height: 800 }).length, 0);
    t.eq("altezza zero: niente", toPageRects([C(1, 1, 9, 9)], { left: 0, top: 0, width: 400, height: 0 }).length, 0);
    t.eq("nessun riquadro: niente", toPageRects([C(1, 1, 9, 9)], null).length, 0);
    t.eq("nessun rettangolo: niente", toPageRects(null, BOX).length, 0);
  }
  {
    // e la fusione vale anche qui: una selezione che attraversa tre span
    // della stessa riga esce come una fascia
    const r = toPageRects([C(200, 450, 40, 16), C(242, 450, 40, 16), C(284, 450, 40, 16)], BOX);
    t.eq("tre span di una riga fanno una fascia", r.length, 1);
    t.c("larga quanto tutt'e tre", r[0].w > 0.28 && r[0].w < 0.32, String(r[0].w));
  }

  // =======================================================================
  // DA FRAZIONI A SCHERMO
  // =======================================================================
  {
    // percentuali, non pixel: è quel che permette al riquadro di cambiare
    // misura sotto senza che l'evidenziazione si sposti
    const s = rectStyle(R(0.25, 0.5, 0.5, 0.02));
    t.eq("da sinistra", s.left, "25%");
    t.eq("dall'alto", s.top, "50%");
    t.eq("larghezza", s.width, "50%");
    t.eq("altezza", s.height, "2%");
  }
  {
    // il giro completo: pixel → frazioni → percentuali, e il conto torna
    const r = toPageRects([C(200, 450, 100, 16)], BOX)[0];
    const s = rectStyle(r);
    t.eq("un quarto di 400px sono 100px, cioè il 25%", s.left, "25%");
    t.eq("e la larghezza pure", s.width, "25%");
  }
}
