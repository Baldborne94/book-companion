// TRE LIVELLI SULLO SCAFFALE: universo, storia, capitoli.
//
// Chiesto dal lettore guardando il suo ripiano dell'Eresia: «vorrei che
// questi libri fossero identificati come parte della Horus Heresy
// dell'universo 40K, ma che comunque ce ne sono altre di serie al suo
// interno e non solo quella, e potrei volerle aggiungere in futuro e
// mantenerle sempre sotto l'universo 40K».
//
// I campi del libro sono DUE — `saga` e `series` — e i piani sono tre.
// Finché le tredici parti della guida stavano in `series`, il posto per
// dire «questa è l'Eresia» non c'era: se lo prendevano loro. Il capitolo
// però non ha bisogno di un campo, perché lo sa la GUIDA: si chiede a lei.
//
// Quel che sbaglia in silenzio qui è tutto di vista: un capitolo nel posto
// sbagliato, o un'intestazione che si ripete, non alzano nessun errore.
import { disponi, raccogliCicli } from "../src/lib/ripiani.js";
import { riconosci, capitoloDi, FUORI_STORIA, PARTI_DI_GUIDA } from "../src/lib/sagaBooks.js";

const L = (id, extra = {}) => ({ id, title: id, addedAt: 1, ...extra });
// la guida finta: il capitolo si chiede a una mappa, come in Libreria si
// chiede al riconoscimento già fatto una volta per tutta la biblioteca
// `parteDi` torna il NOME e il posto che il capitolo ha NELLA GUIDA: i
// due non si possono dedurre l'uno dall'altro, e l'ordine dei volumi che
// possiedi non basta — un racconto non ha numero di lettura.
// L'ordine dei capitoli e' quello in cui sono SCRITTI qui, cioe' l'ordine
// della guida: non si deduce dai nomi (in alfabetico «Part 10» precede
// «Part 2») ne' dai volumi che possiedi.
const guida = (m) => {
  const elenco = [...new Set(Object.values(m))];
  return (b) => {
    const nome = m[b.id];
    return nome ? { nome, ordine: elenco.indexOf(nome) } : null;
  };
};

export default async (t) => {
  // ── IL TERZO LIVELLO ──────────────────────────────────────────────────
  {
    const libri = [
      L("a", { saga: "Warhammer 40K", series: "The Horus Heresy", sagaOrder: 1 }),
      L("b", { saga: "Warhammer 40K", series: "The Horus Heresy", sagaOrder: 2 }),
      L("c", { saga: "Warhammer 40K", series: "The Horus Heresy", sagaOrder: 3 }),
    ];
    const parteDi = guida({ a: "Part 1 · Uno", b: "Part 1 · Uno", c: "Part 2 · Due" });
    const [ripiano] = disponi(libri, null, "auto", null, parteDi);
    t.eq("il ripiano è l'universo", ripiano.nome, "Warhammer 40K");
    t.eq("dentro c'è la storia", ripiano.cicli.map((c) => c.nome).join("|"), "The Horus Heresy");
    t.eq(
      "e dentro la storia i capitoli della guida",
      ripiano.cicli[0].parti.map((p) => `${p.nome}=${p.libri.length}`).join(" "),
      "Part 1 · Uno=2 Part 2 · Due=1"
    );
  }
  {
    // OGNI CICLO RACCOGLIE I SUOI, e il caso che lo prova vuole DUE cicli:
    // con uno solo, «i libri del ciclo» e «i libri del ripiano» sono lo
    // stesso insieme e un conto sbagliato dà la risposta giusta per caso.
    const libri = [
      L("a", { saga: "Universo", series: "Una", sagaOrder: 1 }),
      L("b", { saga: "Universo", series: "Altra", sagaOrder: 2 }),
    ];
    const [ripiano] = disponi(libri, null, "auto", null, guida({ a: "Part 1 · Uno", b: "Part 9 · Nove" }));
    t.eq("due cicli, due capitoli", ripiano.cicli.length, 2);
    t.eq("il primo tiene solo il suo", ripiano.cicli[0].parti?.map((p) => p.nome).join() ?? "—", "—");
    t.eq("…e ognuno vede un capitolo solo, quindi nessun livello", ripiano.cicli[1].parti, null);
  }
  {
    // e con due capitoli per ciclo si vede che non si mescolano
    const libri = [
      L("a", { saga: "Universo", series: "Una", sagaOrder: 1 }),
      L("b", { saga: "Universo", series: "Una", sagaOrder: 2 }),
      L("c", { saga: "Universo", series: "Altra", sagaOrder: 3 }),
      L("d", { saga: "Universo", series: "Altra", sagaOrder: 4 }),
    ];
    const [ripiano] = disponi(
      libri,
      null,
      "auto",
      null,
      guida({ a: "Part 1", b: "Part 2", c: "Part 8", d: "Part 9" })
    );
    t.eq("i capitoli del primo ciclo sono i suoi", ripiano.cicli[0].parti.map((p) => p.nome).join("|"), "Part 1|Part 2");
    t.eq("e quelli del secondo i suoi", ripiano.cicli[1].parti.map((p) => p.nome).join("|"), "Part 8|Part 9");
    t.eq("nessun libro finisce in due capitoli", ripiano.cicli[0].parti[0].libri.length, 1);
  }
  {
    // I CAPITOLI ESCONO NELL'ORDINE DELLA GUIDA, e la scena lo separa da
    // tutt'e due le risposte sbagliate: in alfabetico «Part 10» viene
    // prima di «Part 2», e per numero di volume pure, perché il volume di
    // «Part 10» è quello che possiedi per primo. E' il difetto vero del
    // lettore, preso al banco: «Part 12» sopra «Part 4», perché i suoi
    // racconti un numero di lettura non ce l'hanno.
    const libri = [
      L("z", { saga: "S", series: "Storia", sagaOrder: 1 }),
      L("a", { saga: "S", series: "Storia", sagaOrder: 2 }),
    ];
    const parteDi = guida({ a: "Part 2 · Due", z: "Part 10 · Dieci" });
    const [ripiano] = disponi(libri, null, "auto", null, parteDi);
    t.eq(
      "comanda il posto nella guida, non l'alfabeto né il tuo scaffale",
      ripiano.cicli[0].parti.map((p) => p.nome).join(" | "),
      "Part 2 · Due | Part 10 · Dieci"
    );
  }
  {
    // chi un capitolo non ce l'ha chiude la fila, come i volumi senza
    // numero: dentro l'Eresia sono i libri che la guida non colloca, e
    // vederli raccolti a parte è il modo di accorgersene
    const libri = [
      L("a", { saga: "S", series: "Storia", sagaOrder: 1 }),
      L("b", { saga: "S", series: "Storia", sagaOrder: 2 }),
    ];
    const [ripiano] = disponi(libri, null, "auto", null, guida({ a: "Part 1 · Uno" }));
    const ultimo = ripiano.cicli[0].parti.at(-1);
    t.eq("chi non è nel percorso sta in fondo", ultimo.nome, null);
    t.eq("…e ci sta da solo", ultimo.libri.map((b) => b.id).join(), "b");
  }
  {
    // UN CAPITOLO SOLO NON DIVIDE NIENTE: è il ciclo stesso con un nome in
    // più, e una riga che non separa è rumore su ogni saga.
    const libri = [
      L("a", { saga: "S", series: "Storia", sagaOrder: 1 }),
      L("b", { saga: "S", series: "Storia", sagaOrder: 2 }),
    ];
    const [ripiano] = disponi(libri, null, "auto", null, guida({ a: "Part 1", b: "Part 1" }));
    t.eq("un capitolo solo non fa un livello", ripiano.cicli[0].parti, null);
  }
  {
    // e senza guida non c'è nessun terzo livello: le saghe del lettore non
    // ne hanno uno, e inventarlo sarebbe una riga per ogni ripiano
    const libri = [
      L("a", { saga: "S", series: "Uno", sagaOrder: 1 }),
      L("b", { saga: "S", series: "Due", sagaOrder: 2 }),
    ];
    const [ripiano] = disponi(libri, null, "auto", null, null);
    t.eq("i cicli restano", ripiano.cicli.length, 2);
    t.eq("e capitoli non ce ne sono", ripiano.cicli[0].parti, null);
  }
  {
    // il capitolo si chiede SOLO dentro una saga: dentro un ripiano
    // d'autore i sotto-ripiani sono le sue saghe, e spezzarne una nei
    // capitoli di una guida direbbe una cosa che lì non si sta chiedendo
    const libri = [
      L("a", { author: "Tizio", saga: "Una", sagaOrder: 1 }),
      L("b", { author: "Tizio", saga: "Altra", sagaOrder: 2 }),
    ];
    const [ripiano] = disponi(libri, null, "autore", null, guida({ a: "Part 1", b: "Part 2" }));
    t.eq("sotto un autore ci sono le sue saghe", ripiano.cicli.length, 2);
    t.eq("e nessun capitolo", ripiano.cicli.every((c) => !c.parti), true);
  }

  // ── UN SOTTO-RIPIANO CHE SI CHIAMA COME IL RIPIANO ────────────────────
  {
    // Chi importa l'Eresia senza scriversi un universo suo si ritrova la
    // saga «The Horus Heresy» e — da quando la Serie tiene la storia —
    // anche la serie «The Horus Heresy»: due intestazioni identiche una
    // sopra l'altra, e la seconda non divide niente.
    const libri = [
      L("a", { saga: "The Horus Heresy", series: "The Horus Heresy", sagaOrder: 1 }),
      L("b", { saga: "The Horus Heresy", series: "The Horus Heresy", sagaOrder: 2 }),
    ];
    const parteDi = guida({ a: "Part 1 · Uno", b: "Part 2 · Due" });
    const [ripiano] = disponi(libri, null, "auto", null, parteDi);
    // E I CAPITOLI SALGONO DI UN PIANO invece di sparire col contenitore:
    // quel che si toglie è l'intestazione che si ripete, non il livello
    // sotto — senza, chi non ha un universo suo perderebbe le parti.
    t.eq("l'intestazione che si ripete se ne va", ripiano.cicli.length, 2);
    t.eq("e al suo posto salgono i capitoli", ripiano.cicli.map((c) => c.nome).join("|"), "Part 1 · Uno|Part 2 · Due");
  }
  {
    // ma il lettore ha scritto «Warhammer 40K» a mano, e lì le due righe
    // dicono due cose diverse: la storia resta
    const libri = [
      L("a", { saga: "Warhammer 40K", series: "The Horus Heresy", sagaOrder: 1 }),
      L("b", { saga: "Warhammer 40K", series: "The Horus Heresy", sagaOrder: 2 }),
    ];
    const [ripiano] = disponi(libri, null, "auto", null, guida({ a: "Part 1", b: "Part 2" }));
    t.eq("due nomi diversi restano due righe", ripiano.cicli[0].nome, "The Horus Heresy");
  }
  {
    // e una maiuscola non fa due nomi: «the horus heresy» sotto «The Horus
    // Heresy» è la stessa parola scritta in due modi, non una storia dentro
    // un universo
    const libri = [L("a", { saga: "The Horus Heresy", series: "the horus heresy", sagaOrder: 1 })];
    const [ripiano] = disponi(libri, null, "auto", null, null);
    t.eq("la maiuscola non salva il doppione", ripiano.cicli, null);
  }
  {
    // due cicli veri non sono un doppione nemmeno se uno si chiama come il
    // ripiano: lì la riga separa eccome
    const libri = [
      L("a", { saga: "S", series: "S", sagaOrder: 1 }),
      L("b", { saga: "S", series: "Altro", sagaOrder: 2 }),
    ];
    const [ripiano] = disponi(libri, null, "auto", null, null);
    t.eq("col fratello accanto il doppione resta", ripiano.cicli.length, 2);
  }

  // ── SULLA GUIDA VERA ──────────────────────────────────────────────────
  {
    // `riconosci` torna DUE cose diverse, e confonderle rimetterebbe il
    // capitolo nel campo: `ciclo` è quel che si scrive nella Serie (la
    // storia), `parte` è il capitolo, che resta della guida.
    const r = riconosci({ title: "Betrayer", author: "Aaron Dembski-Bowden" });
    t.eq("la Serie è la storia", r.ciclo, "The Horus Heresy");
    t.c("e la parte è un capitolo del cammino", /^Part /.test(r.parte || ""), r.parte);
  }
  {
    // e una tavola che NON dichiara capitoli continua a scrivere il ciclo,
    // che lì è proprio quel che il lettore chiama Serie
    const r = riconosci({ title: "Mort", author: "Terry Pratchett" });
    t.eq("nel Disco la Serie resta il ciclo", r.ciclo, "Death");
    t.eq("e capitoli non ce ne sono", r.parte, null);
  }
  {
    // I TRE TITOLI CHE NON COMBACIAVANO PER UN CARATTERE, dalla fotografia
    // del lettore: sei volumi isolati sul ripiano perché il riconoscimento
    // cerca il titolo della tavola DENTRO il tuo. Gli alias si dichiarano a
    // mano, uno per uno, dove si sa che sono innocui.
    const casi = [
      ["Silent War", "The Silent War"],
      ["The End And The Death, Volume 1", "The End and the Death: Volume I"],
      ["Scythes of the Emperor", "Scythes of the Emperor Anthology"],
    ];
    for (const [suo, atteso] of casi) {
      t.eq(`«${suo}» si riconosce`, riconosci({ title: suo, author: "" })?.titolo, atteso);
    }
  }
  {
    // e le guardie non si allargano: un alias non deve far entrare quel che
    // la guida non ha
    t.eq("un titolo che non c'è resta fuori", riconosci({ title: "Silent Hill", author: "" }), null);
  }
  {
    // E IL POSTO DEL CAPITOLO VIENE DALLA TAVOLA VERA. Sopra il posto è
    // finto: qui si prova che i capitoli dell'Eresia hanno davvero posti
    // diversi e nell'ordine della guida — senza, lo scaffale li mostrerebbe
    // nell'ordine d'arrivo e nessun errore lo direbbe.
    const dove = (titolo) => capitoloDi(riconosci({ title: titolo, author: "" }));
    const primo = dove("Horus Rising");
    const quarta = dove("Savage Weapons");
    const dodicesima = dove("The End And The Death, Volume 1");
    // QUESTO CONTROLLO ERA GIRATO, e diceva «il prologo apre la guida» su
    // `dove("Eisenhorn").ordine === 0`. Adesso un libro di prologo un
    // capitolo non ce l'ha affatto (vedi il blocco qui sotto): stava
    // pinnando proprio il difetto che il lettore ha segnalato.
    t.c("il primo capitolo della storia apre la fila", primo.ordine >= 0, `${primo.nome} (${primo.ordine})`);
    t.c("e i capitoli dopo hanno posti crescenti", primo.ordine < quarta.ordine, `${primo.ordine} < ${quarta.ordine}`);
    t.c(
      "…fino all'ultimo, che in alfabetico verrebbe prima",
      quarta.ordine < dodicesima.ordine,
      `${quarta.nome} (${quarta.ordine}) < ${dodicesima.nome} (${dodicesima.ordine})`
    );
    // chi la guida non lo colloca non ha nemmeno un capitolo
    t.eq("e un libro fuori dalla guida non ha capitolo", capitoloDi(riconosci({ title: "Mort", author: "Terry Pratchett" })), null);
    t.eq("né una voce vuota", capitoloDi(null), null);
  }

  // ── E QUEL CHE LA GUIDA DICHIARA FUORI DALLA STORIA ───────────────────
  //
  // Segnalato dal lettore: «non mi convince che i libri opzionali me li
  // metti tu come parte di qualcosa quando io voglio metterli solo che
  // facciano parte dell'universo di Warhammer 40K». Il prologo sono
  // quattro percorsi ALTERNATIVI e i sette 40K la tavola li marca «40k,
  // fuori dall'Eresia» — e l'import gli scriveva addosso la storia e il
  // capitolo lo stesso. Si prova sulla TAVOLA VERA, coi titoli della sua
  // fotografia: su una finta il difetto non si vedrebbe.
  {
    const hh = (titolo) => riconosci({ title: titolo, author: "" });
    for (const [titolo, cosa] of [
      ["Eisenhorn", "il prologo"],
      ["Night Lords Omnibus", "il titolo fuori dall'Eresia"],
      ["Forges of Mars Omnibus", "l'altro fuori dall'Eresia"],
    ]) {
      const r = hh(titolo);
      t.eq(`${cosa} resta nell'universo`, r?.saga, "The Horus Heresy");
      t.eq(`…ma senza la storia nella Serie («${titolo}»)`, r?.ciclo, null);
      // QUESTO CONTROLLO ERA GIRATO e pretendeva `null`, cioè lo stesso
      // gruppo di chi la guida non colloca affatto — che sullo scaffale si
      // chiama «Fuori dal percorso» e su questi tre dice il falso: il
      // percorso li contiene eccome, e i loro dorsi ne portano il numero
      // («questi 3 non dovrebbero essere fuori dal percorso»).
      t.eq(`…e in un gruppo suo, non «fuori dal percorso» («${titolo}»)`, capitoloDi(r)?.nome, FUORI_STORIA);
      t.c(`…che sta dopo ogni capitolo («${titolo}»)`, capitoloDi(r).ordine >= PARTI_DI_GUIDA.size);
    }
    // e chi la guida non conosce affatto resta senza gruppo: lì «Fuori dal
    // percorso» è la verità, ed è l'informazione che quel nome deve dare
    t.eq("un libro che la guida non colloca non ha gruppo", capitoloDi(riconosci({ title: "Mort", author: "Terry Pratchett" })), null);
    // e la storia vera non si muove: romanzi e antologie restano com'erano
    const romanzo = hh("Horus Rising");
    t.eq("il romanzo tiene la storia", romanzo?.ciclo, "The Horus Heresy");
    t.c("…e il suo capitolo", !!capitoloDi(romanzo)?.nome, `${capitoloDi(romanzo)?.nome}`);
    const antologia = hh("Eye of Terra");
    t.eq("l'antologia tiene la storia", antologia?.ciclo, "The Horus Heresy");
    t.c("…e il suo capitolo", !!capitoloDi(antologia)?.nome, `${capitoloDi(antologia)?.nome}`);
    // e una tavola SENZA capitoli continua a scrivere il ciclo nella Serie
    t.eq("nel Mondo Disco il ciclo resta il ciclo", riconosci({ title: "Mort", author: "Terry Pratchett" })?.ciclo, "Death");
  }

  // ── LE PAROLINE NON SONO IL TITOLO ────────────────────────────────────
  //
  // Segnalato coi «Fuori dal percorso» in mano: «anche Garro the Knight of
  // Grey non dovrebbe essere fuori percorso», e poi «controlla bene perché
  // tutti questi racconti o libri sono presenti nella guida». La tavola
  // scrive «Garro: Knight of THE Grey» e il suo file «Garro: Knight of
  // Grey»: per il contenimento sono due titoli diversi, e il volume
  // spariva dal cammino senza che nessun errore lo dicesse.
  {
    const hh = (titolo, autore = "") => riconosci({ title: titolo, author: autore })?.titolo ?? null;
    // il caso della sua fotografia, alla lettera
    t.eq("«Garro: Knight Of Grey» è il volume della guida", hh("Garro: Knight Of Grey", "James Swallow"), "Garro: Knight of the Grey");
    // e le altre forme in cui un file vero si presenta
    t.eq("l'articolo interno può cadere", hh("The Flight of Eisenstein", "James Swallow"), "The Flight of the Eisenstein");
    t.eq("…e anche quello iniziale", hh("First Heretic", "Aaron Dembski-Bowden"), "The First Heretic");
    t.eq("…e «and» scritto «&»", hh("The Lost & the Damned", "Guy Haley"), "The Lost and the Damned");
    t.eq("…e i due punti diventati un trattino", hh("Perturabo - The Hammer of Olympia", "Guy Haley"), "Perturabo: The Hammer of Olympia");
    // e il titolo esatto non si muove
    t.eq("il titolo esatto resta quello", hh("Battle of the Fang", "Chris Wraight"), "Battle of the Fang");
  }
  {
    // IL PAVIMENTO DI DUE PAROLE È QUEL CHE TIENE IN PIEDI LA REGOLA: senza,
    // «The Truth» del Mondo Disco diventerebbe «truth» — una parola che sta
    // dentro qualunque titolo — e si mangerebbe libri di chiunque. È la
    // stessa trappola per cui gli articoli non si tolgono a tappeto.
    t.eq(
      "una parola sola non si sfoglia",
      riconosci({ title: "Truth and Lies", author: "Tizio Qualunque" }),
      null
    );
    // prezzo dichiarato: quel pavimento lascia fuori anche le forme buone
    // di un titolo che, tolto l'articolo, è una parola sola
    t.eq("e il prezzo è dichiarato", riconosci({ title: "Unforgiven", author: "Gav Thorpe" })?.titolo ?? null, null);
    // E IL CONFINE DI PAROLA VALE ANCHE NELLO SCHELETRO: «solar war» sta
    // dentro «Solar Warden» come sequenza di lettere, e senza il confine
    // un romanzo di chiunque si prenderebbe il posto di «The Solar War».
    t.eq(
      "una parola tagliata a metà non è un titolo",
      riconosci({ title: "Solar Warden", author: "" }),
      null
    );
  }

  // ── E IL MUCCHIO SENZA NOME STA DOVE LO METTE IL NUMERO ───────────────
  {
    // Provata e SCARTATA la regola «lo scarto chiude sempre», che sarebbe
    // quella dei «Volumi soli» e di «Fuori dal percorso»: nel Circle of
    // the World i romanzi a sé si leggono FRA le due trilogie, e mandarli
    // in fondo racconta un ordine che non è quello vero (il controllo che
    // lo dice sta in `ripiani.test.mjs` e ha smentito la modifica).
    // Quindi nel 40K «Volumi a sé» apre lo scaffale, ed è giusto: il
    // prologo, nella guida, viene PRIMA dell'Eresia.
    const libri = [
      L("a", { saga: "S", series: "", sagaOrder: 0.01 }),
      L("b", { saga: "S", series: "Storia", sagaOrder: 1 }),
    ];
    const [ripiano] = disponi(libri, null, "auto", null, null);
    t.eq("lo scarto sta dove cade il suo numero", ripiano.cicli.map((c) => c.nome ?? "—").join("|"), "—|Storia");
  }

  // ── RACCOGLIERE I CICLI RESTA QUEL CHE ERA ────────────────────────────
  {
    // senza `parteDi` la funzione si comporta come prima: il terzo livello
    // è un di più, non una riscrittura
    const libri = [
      L("a", { series: "Uno", sagaOrder: 2 }),
      L("b", { series: "Due", sagaOrder: 1 }),
    ];
    const cicli = raccogliCicli(libri);
    t.eq("l'ordine è quello del primo volume", cicli.map((c) => c.nome).join("|"), "Due|Uno");
    t.eq("e nessuno ha capitoli", cicli.every((c) => c.parti == null), true);
  }
};
