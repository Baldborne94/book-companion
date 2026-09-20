// IL TUO PROSSIMO PASSO NEL CAMMINO.
//
// Chiesto dal lettore indicando il wh-companion: «per la Horus Heresy
// sarebbe possibile usare la stessa logica usata nel progetto del Warhammer
// Companion per il suggerimento dell'ordine di lettura?».
//
// Quel che sbaglia in silenzio qui è il PASSO: non alza nessun errore,
// nomina soltanto il libro sbagliato — e su una guida da settantuno tappe
// nessuno lo verifica a occhio. Il caso peggiore è il prologo: quattro
// percorsi ALTERNATIVI che nella nostra tavola stanno in fila, quindi una
// camminata ingenua ti manda a leggere il percorso di un'altra fazione.
import { prossimoPasso, lettiDelCammino, camminoDi } from "../src/lib/cammino.js";

// la forma che `camminoDi` produce
const cammino = (righe) => ({
  saga: "Finta",
  tappe: righe.map(([voce, libro]) => ({ voce, libro: libro || null })),
});
const L = (id) => ({ id, title: id });
const stati = (m) => (id) => m[id] || "unread";
const prog = (m = {}) => (id) => m[id] || 0;
const con = (m, p) => ({ statoDi: stati(m), progressoDi: prog(p) });

export default async (t) => {
  // ── LA CAMMINATA ──────────────────────────────────────────────────────
  {
    const c = cammino([
      [{ t: "Alfa" }, L("a")],
      [{ t: "Beta" }, L("b")],
      [{ t: "Gamma" }, L("g")],
    ]);
    t.eq("senza niente di letto il passo è la prima tappa", prossimoPasso(c, con({})).tappa.voce.t, "Alfa");
    t.eq("letta la prima, il passo è la seconda", prossimoPasso(c, con({ a: "read" })).tappa.voce.t, "Beta");
    t.eq(
      "e l'abbandonata si scavalca come la letta",
      prossimoPasso(c, con({ a: "read", b: "abandoned" })).tappa.voce.t,
      "Gamma"
    );
    t.eq("finito tutto non c'è nessun passo", prossimoPasso(c, con({ a: "read", b: "read", g: "read" })), null);
  }
  {
    // QUELLA CHE STAI LEGGENDO NON SI SCAVALCA: è il tuo passo, non quello
    // prima del tuo. Senza questa riga il cammino ti proporrebbe il volume
    // dopo mentre hai questo in mano.
    const c = cammino([
      [{ t: "Alfa" }, L("a")],
      [{ t: "Beta" }, L("b")],
    ]);
    const p = prossimoPasso(c, con({ a: "read", b: "reading" }));
    t.eq("il libro in lettura è il passo", p.tappa.voce.t, "Beta");
    t.eq("…e lo dice", p.inCorso, true);
    t.eq("mentre uno mai aperto no", prossimoPasso(c, con({ a: "read" })).inCorso, false);
  }

  // ── IL PASSO PUÒ ESSERE UN LIBRO CHE NON HAI ──────────────────────────
  {
    // su settantuno tappe il lettore ne ha dieci: un passo che nomina solo
    // quel che possiedi non direbbe mai «vallo a prendere», uno che nomina
    // solo la guida ti lascia senza niente da aprire stasera
    const c = cammino([
      [{ t: "Alfa" }, null],
      [{ t: "Beta" }, L("b")],
    ]);
    const p = prossimoPasso(c, con({}));
    t.eq("il passo è la tappa della guida anche se non ce l'hai", p.tappa.voce.t, "Alfa");
    t.eq("…e accanto c'è il primo che puoi aprire", p.apribile.voce.t, "Beta");
  }
  {
    // quando coincidono la seconda riga non si scrive: ripetere lo stesso
    // titolo due volte a mezzo centimetro di distanza è il difetto del
    // lemma doppione
    const c = cammino([[{ t: "Alfa" }, L("a")]]);
    t.eq("se il passo ce l'hai, non c'è nessuna seconda riga", prossimoPasso(c, con({})).apribile, null);
  }
  {
    const c = cammino([
      [{ t: "Alfa" }, null],
      [{ t: "Beta" }, null],
    ]);
    t.eq("e se non hai niente, niente da aprire", prossimoPasso(c, con({})).apribile, null);
  }

  // ── IL PROLOGO NON È UNA FILA, È UNA SCELTA ───────────────────────────
  //
  // Quattro percorsi ALTERNATIVI: ne leggi uno. Nella tavola stanno in
  // fila perché lì servivano a collocare un file sullo scaffale.
  const P = (t_, nota) => [{ t: t_, tipo: "prologo", nota }, L(t_)];
  const prologo = () =>
    cammino([
      P("Eisenhorn", "Percorso Inquisition"),
      P("Malleus", "Percorso Inquisition"),
      P("Soul Hunter", "Percorso Night Lords"),
      P("Void Stalker", "Percorso Night Lords"),
      [{ t: "Horus Rising" }, L("Horus Rising")],
      [{ t: "False Gods" }, L("False Gods")],
    ]);
  {
    const p = prossimoPasso(prologo(), con({}));
    t.eq("senza nessun percorso cominciato il prologo non propone niente", p.tappa.voce.t, "Horus Rising");
    t.eq("…e lo dice invece di tacere", p.prologo, "scelta");
  }
  {
    // cominciato un percorso, la scelta l'hai già fatta tu: il seguito di
    // QUEL percorso è quel che la guida dice
    const p = prossimoPasso(prologo(), con({ Eisenhorn: "read" }));
    t.eq("cominciato un percorso, si segue quello", p.tappa.voce.t, "Malleus");
    t.eq("…e il prologo non è più una domanda", p.prologo, null);
  }
  {
    // LA RIGA CHE CONTA: finito il percorso che hai scelto non si passa a
    // quello della fazione accanto. Senza la regola, qui uscirebbe
    // «Soul Hunter» — tre romanzi che la guida non ti ha mai chiesto.
    const p = prossimoPasso(prologo(), con({ Eisenhorn: "read", Malleus: "read" }));
    t.eq("finito il tuo percorso non si passa a quello di un'altra fazione", p.tappa.voce.t, "Horus Rising");
    // e qui il passo torna a essere la prima tappa dopo il prologo, cioè
    // il solo posto dove il prologo si nomina: senza la guardia sui
    // percorsi cominciati l'app direbbe «è una scelta» a chi quella scelta
    // l'ha già fatta E finita
    t.eq("…e a chi il prologo l'ha finito non si richiede di sceglierlo", p.prologo, null);
  }
  {
    // cominciato vuol dire toccato, non finito: un libro col progresso
    // addosso e lo stato mai dichiarato è un percorso cominciato
    const p = prossimoPasso(prologo(), con({}, { Eisenhorn: 0.3 }));
    t.eq("il progresso da solo apre il percorso", p.tappa.voce.t, "Eisenhorn");
    t.eq("…e il prologo non è più una scelta aperta", p.prologo, null);
  }
  {
    // IL PROLOGO È PREPARAZIONE, NON UN CANCELLO — e questo caso l'ha
    // trovato il banco, non la rilettura. Il lettore ha Eisenhorn e NON ha
    // Malleus: una tappa che non puoi finire terrebbe il passo inchiodato
    // lì per sempre, anche leggendo l'Eresia intera. Letta una tappa della
    // storia vera sei dentro, e la fondazione è dietro.
    const p = prossimoPasso(prologo(), con({ Eisenhorn: "read", "Horus Rising": "read" }));
    t.eq("entrato nella storia, il prologo non è più il passo", p.tappa.voce.t, "False Gods");
    // ma nel CONTO il percorso scelto resta: «a che punto sono» guarda il
    // cammino che hai scelto, e un denominatore che cala sotto gli occhi
    // fa sembrare rotto un conto giusto
    const q = lettiDelCammino(prologo(), con({ Eisenhorn: "read", "Horus Rising": "read" }));
    t.eq("…ma nel conto il percorso scelto resta", q.quante, 4);
    t.eq("…coi suoi letti", q.letti, 2);
  }
  {
    // «SEI ENTRATO» LO DICE LA STORIA, NON UNA LETTURA DI FIANCO: i titoli
    // che la guida marca fuori dall'Eresia non si propongono mai come
    // passo, e per la stessa ragione non possono decidere che il prologo è
    // dietro di te. Dare a un libro dichiarato fuori dalla storia l'ultima
    // parola sul cammino è la stessa incoerenza scritta due volte.
    const c = cammino([
      [{ t: "Eisenhorn", tipo: "prologo", nota: "Percorso Inquisition" }, L("Eisenhorn")],
      [{ t: "Malleus", tipo: "prologo", nota: "Percorso Inquisition" }, L("Malleus")],
      [{ t: "Omnibus 40K", tipo: "fuori" }, L("x")],
      [{ t: "Horus Rising" }, L("Horus Rising")],
    ]);
    const p = prossimoPasso(c, con({ Eisenhorn: "read", x: "read" }));
    t.eq("un titolo fuori dall'Eresia non ti fa entrare nella storia", p.tappa.voce.t, "Malleus");
  }
  {
    // e il prologo si nomina solo quando sei PROPRIO all'inizio: più
    // avanti nella storia è una riga che torna a ogni apertura e si impara
    // a saltare
    const c = prologo();
    t.eq(
      "a metà della storia il prologo non si nomina più",
      prossimoPasso(c, con({ "Horus Rising": "read" })).prologo,
      null
    );
  }

  // ── I TITOLI «FUORI» NON SI PROPONGONO ────────────────────────────────
  {
    // la guida stessa li marca fuori dall'Eresia: restano nell'elenco, ma
    // spingerti su uno non è un consiglio, è un'interruzione
    const c = cammino([
      [{ t: "Omnibus 40K", tipo: "fuori" }, L("x")],
      [{ t: "Alfa" }, L("a")],
    ]);
    t.eq("un titolo fuori dall'Eresia non è mai il passo", prossimoPasso(c, con({})).tappa.voce.t, "Alfa");
  }
  {
    // E NEMMENO L'ANTOLOGIA, e la ragione sta già scritta nella tavola:
    // «stanno nel percorso per UN racconto alla volta, metterle davanti a
    // un romanzo vuol dire rubargli il posto» — è la regola per cui non
    // hanno numero di lettura. Al banco il danno si vedeva: il passo
    // restava su «Eye of Terra, non ce l'hai» mentre il lettore si leggeva
    // mezza Eresia, perché un'antologia che non possiedi non si può
    // dichiarare letta.
    const c = cammino([
      [{ t: "Eye of Terra", tipo: "antologia" }, null],
      [{ t: "Alfa" }, L("a")],
    ]);
    t.eq("un'antologia non ruba il posto al romanzo", prossimoPasso(c, con({})).tappa.voce.t, "Alfa");
  }

  {
    t.eq("un cammino vuoto non ha passi", prossimoPasso(cammino([]), con({})), null);
  }

  // ── QUANTE NE HAI LETTE, CHE NON È QUANTE NE HAI ──────────────────────
  {
    const c = cammino([
      [{ t: "Omnibus 40K", tipo: "fuori" }, L("x")],
      // l'antologia non si conta nemmeno qui, e la ragione è più stretta
      // che nel passo: una che non possiedi non si può dichiarare letta,
      // quindi terrebbe il conto sotto al massimo per sempre
      [{ t: "Eye of Terra", tipo: "antologia" }, null],
      [{ t: "Alfa" }, L("a")],
      [{ t: "Beta" }, L("b")],
      [{ t: "Gamma" }, null],
    ]);
    const q = lettiDelCammino(c, con({ a: "read", x: "read" }));
    t.eq("si contano le tappe che il cammino ti chiede, senza «fuori» né antologie", q.quante, 3);
    t.eq("…e i letti pure", q.letti, 1);
    t.eq(
      "possedere non è aver letto",
      lettiDelCammino(c, con({})).letti,
      0
    );
  }
  {
    // il denominatore non promette un lavoro che la guida non ha chiesto:
    // i percorsi del prologo che non hai scelto non si contano
    const q = lettiDelCammino(prologo(), con({ Eisenhorn: "read" }));
    t.eq("solo il percorso scelto entra nel conto", q.quante, 4);
    t.eq("…coi suoi letti", q.letti, 1);
    t.eq("e senza nessun percorso scelto il prologo non conta", lettiDelCammino(prologo(), con({})).quante, 2);
  }

  // ── SULLA GUIDA VERA ──────────────────────────────────────────────────
  {
    // la scena del lettore: i volumi stanno sotto una saga scritta a mano
    // e si riconoscono per titolo
    const suoi = [
      { id: "1", title: "Horus Rising", author: "", saga: "Warhammer 40K" },
      { id: "2", title: "False Gods", author: "", saga: "Warhammer 40K" },
      { id: "3", title: "Eisenhorn", author: "", saga: "Warhammer 40K" },
    ];
    const c = camminoDi(suoi);
    t.eq(
      "mai letto niente: il passo salta il prologo e va al primo romanzo",
      prossimoPasso(c, con({})).tappa.voce.t,
      "Horus Rising"
    );
    // e quel romanzo ce l'ha, quindi non c'è nessuna seconda riga: è
    // l'antologia scavalcata a rendere la scheda utile invece che
    // inchiodata su un libro che non possiede
    t.eq("…che ce l'ha, quindi niente seconda riga", prossimoPasso(c, con({})).apribile, null);
    t.eq("…e il prologo si dichiara una scelta", prossimoPasso(c, con({})).prologo, "scelta");
    // letto Eisenhorn, il percorso Inquisition è cominciato: il passo
    // diventa il suo seguito, che non ha
    const dopo = prossimoPasso(c, con({ 3: "read" }));
    t.eq("letto Eisenhorn il passo è il seguito del suo percorso", dopo.tappa.voce.t, "Malleus");
    t.eq("…e i conti sono sulle tappe in gioco", lettiDelCammino(c, con({ 3: "read" })).letti, 1);
  }
};
