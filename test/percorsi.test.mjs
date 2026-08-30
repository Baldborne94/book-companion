// L'ARITMETICA DEI PERCORSI DELLA RICUCITURA.
//
// `unisciEpub` prende un ePub tagliato in troppi documenti e rimette i
// pezzi dentro quello che li precede. Nel farlo i documenti CAMBIANO
// CARTELLA, e con loro devono cambiare tutti i percorsi che si portano
// dietro: le immagini, i fogli di stile, i rimandi da un pezzo all'altro.
//
// Se questi quattro conti sbagliano, il libro entra in biblioteca con le
// immagini rotte e i rimandi che portano da nessuna parte — **e nessuno se
// ne accorge**, perche' non c'e' niente che controlli se un `src` punta a
// qualcosa. Te ne accorgi mesi dopo, aprendo quel capitolo. E siccome la
// ricucitura gira UNA VOLTA SOLA, all'import, il danno resta nel file.
//
// Erano trecento righe senza un controllo.
import { dir, risolvi, relativo, ancoraDi } from "../src/lib/unisciEpub.js";

export default async function (t) {
  // ---- la cartella di un file -------------------------------------------
  t.eq("la cartella di un file annidato", dir("OEBPS/text/ch01.xhtml"), "OEBPS/text/");
  t.eq("un file alla radice non ha cartella", dir("ch01.xhtml"), "");
  t.eq("una cartella resta se stessa", dir("OEBPS/text/"), "OEBPS/text/");

  // ---- risolvere un percorso relativo ------------------------------------
  {
    t.eq("il caso di tutti i giorni", risolvi("OEBPS/text/", "img.png"), "OEBPS/text/img.png");
    t.eq("si risale con ..", risolvi("OEBPS/text/", "../images/img.png"), "OEBPS/images/img.png");
    t.eq("si risale anche due volte", risolvi("a/b/c/", "../../x.png"), "a/x.png");
    t.eq("il punto singolo non conta", risolvi("OEBPS/", "./text/a.xhtml"), "OEBPS/text/a.xhtml");
    t.eq("le doppie sbarre si appianano", risolvi("OEBPS//", "text//a.xhtml"), "OEBPS/text/a.xhtml");
    // il frammento dice DOVE nel documento, non QUALE documento: qui si
    // cerca il file, e il pezzo dopo il cancelletto non c'entra
    t.eq("il frammento si butta via", risolvi("OEBPS/", "text/a.xhtml#punto3"), "OEBPS/text/a.xhtml");
  }
  {
    // QUELLO CHE NON SI TOCCA. Un indirizzo assoluto punta fuori dal libro
    // e riscriverlo lo romperebbe; un frammento nudo punta dentro il
    // documento stesso e va lasciato dov'e'. In tutt'e due i casi `null`
    // vuol dire «non e' roba mia», e chi chiama lo salta.
    t.eq("un indirizzo web non e' un file del libro", risolvi("OEBPS/", "https://example.com/x.png"), null);
    t.eq("ne' un mailto", risolvi("OEBPS/", "mailto:tizio@example.com"), null);
    t.eq("ne' un data:", risolvi("OEBPS/", "data:image/png;base64,AAAA"), null);
    t.eq("un frammento nudo resta dov'e'", risolvi("OEBPS/", "#nota7"), null);
    t.eq("e un attributo vuoto non e' un percorso", risolvi("OEBPS/", ""), null);
  }
  {
    // risalire oltre la radice non deve produrre un percorso con i `..`
    // dentro: si resta alla radice, che e' il male minore
    t.eq("non si esce dalla radice dell'archivio", risolvi("a/", "../../../x.png"), "x.png");
  }

  // ---- il percorso all'indietro: da una cartella a un file ---------------
  {
    // E' il conto che rimette a posto i rimandi dopo che un documento ha
    // cambiato cartella. Il nome del file non si consuma MAI nel confronto
    // (`i < b.length - 1`), o il rimando finirebbe sulla cartella invece
    // che sul file.
    t.eq("stessa cartella", relativo("OEBPS/text/", "OEBPS/text/ch02.xhtml"), "ch02.xhtml");
    t.eq("si scende", relativo("OEBPS/", "OEBPS/text/ch02.xhtml"), "text/ch02.xhtml");
    t.eq("si sale e si riscende", relativo("OEBPS/text/", "OEBPS/images/x.png"), "../images/x.png");
    t.eq("dalla radice", relativo("", "OEBPS/text/ch02.xhtml"), "OEBPS/text/ch02.xhtml");
    t.eq("alla radice, risalendo di tre", relativo("a/b/c/", "x.png"), "../../../x.png");
    // IL `- 1` NEL CONFRONTO, che sembra un dettaglio e non lo e'. Il ciclo
    // si ferma un passo prima della fine di `b` perche' l'ultimo pezzo e'
    // il NOME DEL FILE, e un nome di file non e' una cartella da saltare.
    // Serve quando il file si chiama come una cartella che sta sul
    // percorso: senza il `- 1` il nome verrebbe mangiato dal confronto e il
    // rimando finirebbe su una cartella invece che sul documento — cioe' un
    // collegamento che non apre niente.
    t.eq("un file che si chiama come una cartella del percorso", relativo("a/b/c/", "a/b"), "../../b");
  }
  {
    // il giro completo: risolto e poi rifatto all'indietro dalla stessa
    // cartella, un percorso deve tornare identico — e' la proprieta' su cui
    // si regge tutta la riscrittura
    for (const [cartella, rel] of [
      ["OEBPS/text/", "img.png"],
      ["OEBPS/text/", "../images/img.png"],
      ["OEBPS/", "text/a.xhtml"],
      ["", "a.xhtml"],
      ["a/b/", "../c/d.css"],
    ]) {
      const assoluto = risolvi(cartella, rel);
      t.eq(`andata e ritorno: ${cartella} + ${rel}`, relativo(cartella, assoluto), rel);
    }
  }

  // ---- l'ancora che marca dove comincia un pezzo cucito ------------------
  {
    t.eq("l'ancora nasce dal percorso", ancoraDi("OEBPS/text/ch01.xhtml"), "bc-OEBPS-text-ch01-xhtml");
    t.c("comincia sempre con bc-, cosi' non litiga con gli id del libro", ancoraDi("x.xhtml").startsWith("bc-"));
    // un id XML non puo' contenere sbarre, punti o spazi: tutto quel che non
    // e' lettera o cifra diventa un trattino, e piu' segni di fila fanno un
    // trattino solo
    t.eq("gli spazi e i segni diventano trattini", ancoraDi("a b/c_d.x"), "bc-a-b-c-d-x");
    t.c("non resta nessun carattere da rifiutare", /^[A-Za-z0-9-]+$/.test(ancoraDi("Æ/à b%c.xhtml")));
  }
  {
    // LIMITE DICHIARATO, e vale la pena saperlo: l'ancora appiattisce tutti
    // i segni sullo stesso trattino, quindi due documenti che differiscono
    // SOLO per il separatore ricevono la stessa ancora. In un ePub vero non
    // succede quasi mai — vorrebbe dire avere `a/b.xhtml` e `a-b.xhtml`
    // nella stessa spina — ma se succedesse, i rimandi fra i pezzi cuciti
    // atterrerebbero sul posto sbagliato, in silenzio.
    t.eq("due percorsi diversi possono dare la stessa ancora", ancoraDi("a/b.xhtml"), ancoraDi("a-b.xhtml"));
  }
}
