// DA QUANTO NON FAI UN ARCHIVIO. L'avviso sulla persistenza dice uno stato
// («il browser può liberare questi dati»), non dice da quanto non c'e' una
// copia al sicuro: se la persistenza e' negata e il tuo ultimo zip e' di
// marzo, l'app lo sa e non lo diceva.
//
// Qui si prova che il promemoria tace quando deve tacere — un assillo si
// impara a ignorare, ed e' peggio del silenzio.
import { promemoriaArchivio, daQuanto } from "../src/lib/exportLibrary.js";

const GIORNO = 86400000;
const ORA = 1700000000000;
const fa = (giorni) => ORA - giorni * GIORNO;

export default async function (t) {
  // ---- quando tace -------------------------------------------------------
  t.eq(
    "una biblioteca vuota non ha niente da perdere",
    promemoriaArchivio({ ultimo: 0, ora: ORA, roba: 0 }),
    null
  );
  t.eq(
    "un archivio di ieri non si commenta",
    promemoriaArchivio({ ultimo: fa(1), ora: ORA, roba: 12 }),
    null
  );
  t.eq(
    "e nemmeno uno di tre settimane fa",
    promemoriaArchivio({ ultimo: fa(21), ora: ORA, roba: 12 }),
    null
  );
  // Un orologio sballato non deve inventarsi un allarme, e la distanza va
  // presa CON IL SEGNO: in valore assoluto una data di mesi nel futuro
  // diventerebbe «l'ultimo archivio è di 4 mesi fa», che e' il contrario
  // della verita'.
  t.eq(
    "una data poco nel futuro non allarma",
    promemoriaArchivio({ ultimo: ORA + 5 * GIORNO, ora: ORA, roba: 12 }),
    null
  );
  t.eq(
    "e nemmeno una molto nel futuro",
    promemoriaArchivio({ ultimo: ORA + 120 * GIORNO, ora: ORA, roba: 12 }),
    null
  );

  // ---- quando parla ------------------------------------------------------
  t.c(
    "mai fatto, e c'e' qualcosa da perdere",
    /mai fatto un archivio/.test(promemoriaArchivio({ ultimo: 0, ora: ORA, roba: 1 }))
  );
  t.c(
    "un mese di silenzio si dice",
    /un mese fa/.test(promemoriaArchivio({ ultimo: fa(35), ora: ORA, roba: 12 })),
    promemoriaArchivio({ ultimo: fa(35), ora: ORA, roba: 12 })
  );
  t.c(
    "quattro mesi anche",
    /4 mesi fa/.test(promemoriaArchivio({ ultimo: fa(125), ora: ORA, roba: 12 }))
  );

  // ---- LA SOGLIA E' DUE --------------------------------------------------
  // a persistenza negata i byte stanno in una memoria che il browser puo'
  // sfrattare: un mese di silenzio li' e' troppo, e la soglia si stringe
  const dieciGiorni = { ultimo: fa(10), ora: ORA, roba: 12 };
  t.eq("con la persistenza a posto, dieci giorni non sono niente", promemoriaArchivio(dieciGiorni), null);
  t.c(
    "ma con la persistenza negata si', e si dice",
    /10 giorni fa/.test(promemoriaArchivio({ ...dieciGiorni, persistenza: "negata" }))
  );
  // `sconosciuta` non e' `negata`: e' il browser che non risponde, e
  // stringere la soglia su un sospetto sarebbe assillare senza sapere
  t.eq(
    "«sconosciuta» non stringe la soglia",
    promemoriaArchivio({ ...dieciGiorni, persistenza: "sconosciuta" }),
    null
  );
  t.eq(
    "e nemmeno «concessa»",
    promemoriaArchivio({ ...dieciGiorni, persistenza: "concessa" }),
    null
  );
  // sotto la settimana tace anche li': l'archivio non e' un rito quotidiano
  t.eq(
    "tre giorni tacciono comunque",
    promemoriaArchivio({ ultimo: fa(3), ora: ORA, roba: 12, persistenza: "negata" }),
    null
  );

  // ---- «4 mesi fa» dice quello che «118 giorni fa» non dice --------------
  t.eq("giorni", daQuanto(9), "9 giorni fa");
  t.eq("settimane", daQuanto(21), "3 settimane fa");
  t.eq("un mese, non «1 mesi»", daQuanto(35), "un mese fa");
  t.eq("due mesi", daQuanto(65), "2 mesi fa");
  t.eq("undici mesi", daQuanto(340), "11 mesi fa");
  t.eq("oltre l'anno non si conta piu' fine", daQuanto(400), "più di un anno fa");
  t.eq("due anni", daQuanto(800), "più di 2 anni fa");
  // la scala non deve avere buchi: a ogni giorno corrisponde una frase
  for (let g = 30; g < 900; g += 1) {
    const s = daQuanto(g);
    if (!s || /NaN|undefined/.test(s)) {
      t.c(`giorno ${g} senza frase`, false, String(s));
      break;
    }
  }
  t.c("nessun buco nella scala", true);
}
