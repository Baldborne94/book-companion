// IL TESTO GREZZO DI POSTGRES NON ARRIVA SULLO SCHERMO.
//
// Segnalato due volte in un'ora, col pannello della nuvola in mano:
//
//   «Sincronizzazione fallita: null value in column "fav" of relation
//    "books" violates not-null constraint»
//   «Sincronizzazione fallita: invalid input syntax for type integer: "0.18"»
//
// `App.jsx` incollava `e.message` sullo schermo com'era. È il punto più
// ostile che l'app avesse: tutto il resto ha frasi scritte apposta —
// `GUAI`, `ESITI_CONTROLLO`, `fraseTace`, le frasi di `syncCore` — e
// proprio dove qualcosa si è appena rotto si passava all'inglese e al
// gergo del database.
//
// QUI NON CASCA NIENTE DA SÉ: una frase che dice la cosa sbagliata, o che
// manda a rilanciare uno schema quando è caduta la rete, non alza nessun
// errore. Si legge e si fa la cosa sbagliata.
import { spiegaSync } from "../src/lib/syncCore.js";

// i due messaggi VERI, copiati dalle sue fotografie: se un giorno la cura
// smette di prenderli, il difetto è tornato esattamente com'era
const SUE = {
  fav: 'null value in column "fav" of relation "books" violates not-null constraint',
  decimale: 'invalid input syntax for type integer: "0.18"',
};

const schema = (f) => /schema del database è indietro/.test(f);

export default async function (t) {
  // ---- LE DUE FOTOGRAFIE ------------------------------------------------
  {
    const r = spiegaSync({ message: SUE.fav });
    t.c("il not-null non arriva grezzo", !r.frase.includes("not-null constraint"), r.frase);
    t.c("…e dice che è lo schema", schema(r.frase), r.frase);
    // IL NOME DELLA COLONNA È L'UNICA COSA DEL TESTO GREZZO che al lettore
    // serva: senza, «aggiorna lo schema» non dice quale pezzo manca
    t.c("…nominando la colonna", r.frase.includes("«fav»"), r.frase);
    // e ogni guasto dice COSA FARCI: un guasto senza la strada accanto
    // lascia il lettore dov'era
    t.c("…e dove si mette a posto", r.frase.includes("schema.sql"), r.frase);
    t.eq("il testo grezzo resta sotto «dettagli»", r.dettaglio, SUE.fav);
  }
  {
    const r = spiegaSync({ message: SUE.decimale });
    t.c("il tipo rifiutato non arriva grezzo", !r.frase.includes("invalid input syntax"), r.frase);
    t.c("…ed è lo schema anche lui", schema(r.frase), r.frase);
    // questo messaggio la colonna NON la nomina: la frase si accorcia
    // invece di inventarsela
    t.c("…senza inventarsi una colonna", !r.frase.includes("la colonna «"), r.frase);
    t.eq("e il grezzo c'è", r.dettaglio, SUE.decimale);
  }

  // ---- QUATTRO MESSAGGI, UNA SOLA STRADA --------------------------------
  {
    // la colonna che manca, il tipo che non regge, il not-null e la policy
    // vogliono dire la stessa cosa al lettore, e si rimediano tutti allo
    // stesso modo: raggrupparli è la cura, non una pigrizia
    const famiglia = [
      "Could not find the 'music_lists' column of 'prefs' in the schema cache",
      'relation "books" does not exist',
      'new row violates row-level security policy for table "books"',
      SUE.fav,
      SUE.decimale,
    ];
    for (const m of famiglia) t.c(`«${m.slice(0, 28)}…» è lo schema`, schema(spiegaSync({ message: m }).frase));
  }
  {
    // LE VIRGOLETTE SONO OBBLIGATORIE, o «column **of** 'prefs'» dà la
    // colonna «of»: una frase che nomina con sicurezza una colonna che non
    // esiste è peggio di una che non la nomina. Preso provando, non
    // rileggendo.
    const r = spiegaSync({ message: "Could not find the 'music_lists' column of 'prefs' in the schema cache" });
    t.c("la colonna è quella vera", r.frase.includes("«music_lists»"), r.frase);
    t.c("…e non la preposizione", !r.frase.includes("«of»"), r.frase);
  }

  // ---- LA RETE NON È UN GUASTO DEL DATABASE -----------------------------
  {
    // è la stessa lezione di `spiegaAccesso`: `fetch` che cade arriva come
    // un TypeError senza codice né stato, e scambiato per uno schema
    // indietro manderebbe a rilanciare un database che sta benissimo
    for (const m of ["Failed to fetch", "NetworkError when attempting to fetch a resource", "Load failed"]) {
      const r = spiegaSync({ message: m });
      t.c(`«${m}» è la rete`, /raggiungere il cloud/.test(r.frase), r.frase);
      t.c("…e non manda a toccare lo schema", !schema(r.frase), r.frase);
    }
  }

  // ---- LA SESSIONE E LA POLICY SI ASSOMIGLIANO E NON SONO LA STESSA -----
  {
    // tutt'e due parlano di permessi, ma una si risolve rientrando e
    // l'altra rilanciando lo schema: confonderle manda dalla parte
    // sbagliata, e il lettore non ha modo di accorgersene
    const sessione = spiegaSync({ message: "JWT expired", status: 401 });
    t.c("il JWT scaduto è la sessione", /accesso al cloud è scaduto/.test(sessione.frase), sessione.frase);
    t.c("…e dice da dove si rientra", /nuvola/.test(sessione.frase), sessione.frase);
    const policy = spiegaSync({ message: 'new row violates row-level security policy for table "books"' });
    t.c("la policy è lo schema", schema(policy.frase), policy.frase);
  }

  // ---- I GUASTI CHE NON SONO GUASTI -------------------------------------
  {
    const grande = spiegaSync({ message: "The object exceeded the maximum allowed size" });
    // NON si promette una cura che non c'è: su quel piano quel file lassù
    // non ci va, e la frase dice dove il libro RESTA
    t.c("il file troppo grande dice dov'è al sicuro", /resta qui/.test(grande.frase), grande.frase);
    const pausa = spiegaSync({ message: "Project is paused" });
    t.c("il progetto in pausa si riconosce", /in pausa/.test(pausa.frase), pausa.frase);
    const cinquecento = spiegaSync({ message: "Internal Server Error", status: 500 });
    t.c("un 5xx non è colpa tua", /risposto male/.test(cinquecento.frase), cinquecento.frase);
  }

  // ---- QUEL CHE NON SAPPIAMO TRADURRE ------------------------------------
  {
    // si mostra COM'È: una frase in inglese è brutta, nasconderla toglie
    // l'unico appiglio a chi deve capire cos'è successo davvero
    const r = spiegaSync({ message: "qualcosa di mai visto" });
    t.c("l'ignoto si mostra com'è", r.frase.includes("qualcosa di mai visto"), r.frase);
    // …E ALLORA NON SI RIPETE SOTTO «DETTAGLI»: il grezzo è già la frase,
    // e mostrarlo due volte sarebbe rumore su rumore
    t.eq("…e non si scrive due volte", r.dettaglio, null);
  }
  {
    // un errore senza niente dentro non deve esplodere né mostrare
    // «undefined» dentro una riga in italiano
    for (const brutto of [null, undefined, {}, { message: "" }, new Error("")]) {
      const r = spiegaSync(brutto);
      t.c("un errore vuoto ha comunque una frase", !!r.frase && !/undefined|null/.test(r.frase), r.frase);
      t.eq("…e nessun dettaglio da mostrare", r.dettaglio, null);
    }
  }
  {
    // quel che diciamo NOI è già italiano, e non ha un grezzo utile
    const r = spiegaSync({ message: "sync non configurata" });
    t.c("il nostro messaggio resta nostro", /non è configurata/.test(r.frase), r.frase);
    t.eq("…senza dettagli tecnici", r.dettaglio, null);
  }

  // ---- IL PATTO DELLA FORMA ----------------------------------------------
  {
    // ogni risposta ha le due chiavi, sempre: il pannello legge `frase` e
    // `dettaglio` senza guardare che caso sia
    for (const c of [null, { message: SUE.fav }, { message: "boh" }, { status: 500 }]) {
      const r = spiegaSync(c);
      t.c("torna sempre {frase, dettaglio}", "frase" in r && "dettaglio" in r);
      t.c("…e la frase non è mai vuota", typeof r.frase === "string" && r.frase.length > 0);
    }
  }
}
