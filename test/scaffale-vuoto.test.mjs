// LO SCAFFALE VUOTO DICE PERCHÉ, E COME TORNARE A VEDERLO.
//
// C'era una riga sola: «Nessun tomo risponde all'appello con questi
// filtri…». Dice il vero e non serve a niente — **è un vicolo cieco**: lo
// scaffale sembra aver perso i libri e non c'è niente da toccare per
// riaverli. È la stessa ragione per cui il filtro NON si ricorda fra
// un'apertura e l'altra, applicata dentro la sessione: filtri, cerchi, ti
// distrai, e lo scaffale è vuoto senza che niente spieghi perché.
//
// QUI NON CASCA NIENTE DA SÉ: una frase che nomina la leva sbagliata non
// alza nessun errore — si legge, si molla la leva che non c'entra, e lo
// scaffale resta vuoto.
import { scaffaleVuoto } from "../src/lib/library.js";

const vie = (r) => r.vie.map((v) => v.id).join("+");

export default async function (t) {
  // ---- LA SOLA RICERCA ---------------------------------------------------
  {
    const r = scaffaleVuoto({ totale: 120, query: "eric", filtro: "all" });
    t.c("dice cosa si stava cercando", r.frase.includes("«eric»"), r.frase);
    t.eq("e offre di cancellarla", vie(r), "query");
  }

  // ---- IL SOLO FILTRO ----------------------------------------------------
  {
    const r = scaffaleVuoto({ totale: 120, filtro: "read", nomeFiltro: "Letti" });
    // IL CONTO È L'INFORMAZIONE CHE SPIEGA LO SCAFFALE VUOTO: «nessuno dei
    // tuoi 120» dice che i libri ci sono e sei tu a nasconderli
    t.c("dice quanti ne stai nascondendo", r.frase.includes("120"), r.frase);
    t.c("e nomina il filtro come lo chiama lo schermo", r.frase.includes("«Letti»"), r.frase);
    t.eq("offre di mostrarli tutti", vie(r), "filtro");
  }
  {
    // il nome del filtro viene da FUORI, dagli stessi `FILTERS` che stanno
    // due righe sopra sullo schermo: scritto a mano qui sarebbero due posti
    // da cambiare insieme e da dimenticare separatamente
    const r = scaffaleVuoto({ totale: 5, filtro: "abandoned", nomeFiltro: "Abbandonati" });
    t.c("un altro filtro, il suo nome", r.frase.includes("«Abbandonati»"), r.frase);
    // E SENZA NOME NON RESTA UN BUCO. Il difetto qui non è «undefined» —
    // il default è la stringa vuota, quindi uscirebbe «fra i «».», due
    // virgolette attorno al niente: altrettanto rotto e più difficile da
    // vedere. Si guarda che fra le virgolette ci sia qualcosa.
    const senza = scaffaleVuoto({ totale: 5, filtro: "boh" });
    t.c("e senza nome non scrive «undefined»", !/undefined/.test(senza.frase), senza.frase);
    const dentro = /«([^»]*)»/.exec(senza.frase);
    t.c("…né lascia le virgolette vuote", !!dentro && dentro[1].trim().length > 2, senza.frase);
  }

  // ---- LE DUE LEVE INSIEME: QUALE STA NASCONDENDO? -----------------------
  {
    // IL CASO CHE VALE LA PENA DISTINGUERE. Con tutt'e due accese, sapere
    // che la ricerca TROVA e che è il filtro a nascondere dice quale delle
    // due mollare — senza, si molla a caso.
    const r = scaffaleVuoto({
      totale: 120, query: "eric", filtro: "read", nomeFiltro: "Letti", conLaSolaRicerca: 3,
    });
    t.c("dice che la ricerca trova", r.frase.includes("3 tomi rispondono"), r.frase);
    t.c("…ed è il filtro a nasconderli", r.frase.includes("nessuno è fra i «Letti»"), r.frase);
    t.eq("e offre tutt'e due le vie", vie(r), "query+filtro");
  }
  {
    // «1 tomi rispondono» si legge come un guasto, la stessa specie di
    // «1 volumi» in `fraseTace` e di «½ stelle» nei ripiani
    const r = scaffaleVuoto({
      totale: 120, query: "eric", filtro: "read", nomeFiltro: "Letti", conLaSolaRicerca: 1,
    });
    t.c("uno solo si scrive al singolare", /Un tomo risponde/.test(r.frase), r.frase);
    t.c("…e «non è», non «nessuno è»", /non è fra i/.test(r.frase), r.frase);
  }
  {
    // se nemmeno la ricerca da sola trova niente, non si promette che il
    // filtro sia il colpevole: si dice che non c'è, e basta
    const r = scaffaleVuoto({
      totale: 120, query: "zzz", filtro: "read", nomeFiltro: "Letti", conLaSolaRicerca: 0,
    });
    t.c("zero non diventa «rispondono»", !/rispondono|Un tomo risponde/.test(r.frase), r.frase);
    t.c("…ma le vie restano tutt'e due", vie(r) === "query+filtro", vie(r));
  }
  {
    // il conto può non arrivare (il chiamante non lo calcola): si ripiega
    // sulla frase generica invece di scrivere «null tomi rispondono»
    const r = scaffaleVuoto({ totale: 120, query: "eric", filtro: "read", nomeFiltro: "Letti" });
    t.c("senza il conto non si inventa un numero", !/null|undefined|NaN/.test(r.frase), r.frase);
    t.c("…e nomina lo stesso tutt'e due le leve", r.frase.includes("«eric»") && r.frase.includes("«Letti»"), r.frase);
  }

  // ---- NESSUNA LEVA TIRATA -----------------------------------------------
  {
    // lo scaffale è vuoto e non è colpa di niente che si possa mollare:
    // non si inventa una causa, e non si offre una via che non porta da
    // nessuna parte
    const r = scaffaleVuoto({ totale: 0 });
    t.eq("niente da mollare, nessun tasto", vie(r), "");
    t.c("e una frase che non accusa nessuno", !/filtr|ricerc/i.test(r.frase), r.frase);
  }
  {
    // gli spazi non sono una ricerca: cercando «   » lo scaffale non è
    // filtrato da niente
    const r = scaffaleVuoto({ totale: 9, query: "   ", filtro: "all" });
    t.eq("una ricerca di soli spazi non conta", vie(r), "");
  }

  // ---- IL PATTO DELLA FORMA ----------------------------------------------
  {
    // il componente legge `frase` e `vie` senza guardare che caso sia, e
    // ogni via porta un'etichetta da scrivere sul tasto
    for (const c of [{}, { totale: 3 }, { query: "x" }, { filtro: "read", nomeFiltro: "Letti" }, { query: "x", filtro: "read" }]) {
      const r = scaffaleVuoto(c);
      t.c("torna sempre {frase, vie}", typeof r.frase === "string" && Array.isArray(r.vie));
      t.c("…con una frase non vuota", r.frase.length > 0);
      t.c("…e ogni via ha un id e un'etichetta", r.vie.every((v) => v.id && v.label && v.label.length > 3));
    }
    // e senza argomenti non esplode
    t.c("nessun argomento, nessun guaio", !!scaffaleVuoto().frase);
  }
}
