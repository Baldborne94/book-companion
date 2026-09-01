// IL SEGNO DI LETTURA, E LE DUE MANIERE IN CUI SI PERDE.
//
// «Vorrei che il libro si aprisse sempre all'ultima pagina aperta prima che
// si chiudesse.» Il salvataggio c'era ed era coperto (voltata, chiusura,
// app messa in secondo piano). A rompersi era il RITORNO, in due modi che
// non alzano nessun errore utile:
//
//  (1) un CFI ben formato che parla di un pezzo che il libro non ha più:
//      `display` lo rifiuta, si ripiegava sull'inizio del libro in silenzio
//      e un secondo e mezzo dopo il flush scriveva QUELLA posizione sopra
//      il segno buono. Perso per sempre: riaprire non lo riportava, perché
//      non c'era più.
//
//  (2) un CFI malformato: epub.js non rifiuta niente, ESPLODE dentro la sua
//      coda (`Queue.dequeue` → `Spine.get` → `new EpubCFI`), fuori da
//      qualunque catena di promesse. Nessun `catch` ci arriva, e il lettore
//      leggeva «questo tomo non si lascia aprire… il file potrebbe essere
//      danneggiato» su un romanzo sano — con l'unica via d'uscita di
//      cancellarlo e reimportarlo. Misurato in un browser vero, con un ePub
//      costruito apposta.
//
// Il secondo non si può PRENDERE: si può solo non consegnare. Ed è quello
// che fa `cfiLeggibile`, che sta fuori dal JSX apposta per essere provata
// qui — la classe le arriva da fuori, così non ci si tira dietro epub.js.
import { cfiLeggibile } from "../src/lib/readerLayout.js";

// Il finto sta dalla parte giusta della trappola: si comporta come
// `ePub.CFI` per davvero, cioè LANCIA su quel che non sa leggere invece di
// tornare `false`. Un finto che tornasse un valore proverebbe un'altra cosa.
class CfiFinto {
  constructor(cfi) {
    if (!/^epubcfi\(\/[\d/]/.test(String(cfi))) {
      throw new TypeError("Cannot read properties of undefined (reading 'split')");
    }
    this.cfi = cfi;
  }
}

export default async function (t) {
  // ---- quel che passa --------------------------------------------------
  t.c(
    "un segno vero si lascia leggere",
    cfiLeggibile(CfiFinto, "epubcfi(/6/14!/4/2/4/2[c3]/1:0)") === true
  );
  // UN SEGNO BEN FORMATO CHE INDICA UN PEZZO SPARITO PASSA DI QUI, ED È
  // GIUSTO: quello `display` lo rifiuta come si deve, e il rifiuto lo
  // gestisce il `catch` là. Qui si guarda solo se è LEGGIBILE, non se
  // esiste — confondere le due cose vorrebbe dire aprire ogni libro
  // dall'inizio ogni volta che una struttura cambia di un capello.
  t.c(
    "e passa anche un segno ben formato che punta a un pezzo che non c'è più",
    cfiLeggibile(CfiFinto, "epubcfi(/6/99[nonEsiste]!/4/2/2[boh]/1:0)") === true
  );

  // ---- quel che non si consegna ----------------------------------------
  t.c(
    "un segno malformato non arriva a epub.js",
    cfiLeggibile(CfiFinto, "epubcfi(NIENTE-DI-VALIDO)") === false
  );
  t.c("né una stringa qualunque", cfiLeggibile(CfiFinto, "pagina 12") === false);
  t.c("né mezzo segno", cfiLeggibile(CfiFinto, "epubcfi(") === false);

  // ---- e il vuoto non è un guasto --------------------------------------
  // Un libro mai aperto NON ha un segno, e non c'è niente da dichiarare
  // fallito: si apre dall'inizio ed è la cosa giusta. Se il vuoto tornasse
  // `true` si consegnerebbe `null` a epub.js; se facesse comparire l'avviso
  // del ritorno fallito, ogni primo avvio direbbe di aver perso qualcosa
  // che non è mai esistito.
  //
  // Detto onestamente: questi passano anche SENZA la riga `if (!cfi)`, che
  // è una scorciatoia e non la guardia — `String(null)` fa «null» e il
  // parser lo rifiuta comunque. Provato togliendola: non falliva niente, e
  // sta scritto anche là.
  for (const niente of [null, undefined, "", 0]) {
    t.c(`«${String(niente)}» non è un segno`, cfiLeggibile(CfiFinto, niente) === false);
  }

  // ---- e non esplode mai, che è tutto il suo mestiere -------------------
  // Se `cfiLeggibile` lasciasse passare l'errore invece di prenderlo, non
  // servirebbe a niente: l'eccezione risalirebbe esattamente come prima,
  // solo da una riga diversa.
  let esploso = false;
  try {
    cfiLeggibile(CfiFinto, "epubcfi(GUASTO)");
  } catch {
    esploso = true;
  }
  t.c("prende l'errore invece di lasciarlo passare", esploso === false);
}
