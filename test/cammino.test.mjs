// IL CAMMINO DI UNA SAGA: la guida per intero, e dentro i tuoi libri.
//
// Chiesto dal lettore con in mano la guida di Polygon all'Eresia di Horus:
// «basandoti sulla guida completa e quello che ho in libreria, riesci a
// farmi una cronologia dei libri nell'ordine della guida?».
//
// Quello che sbaglia in silenzio qui è l'ORDINE: una guida rimescolata non
// alza nessun errore, si legge e basta — e su settantuno tappe nessuno se
// ne accorge. L'altra metà è il RICONOSCIMENTO: una tappa data per tua che
// non è tua ti fa saltare un libro, una tua data per mancante te lo fa
// ricomprare.
import { banco } from "./aiuto.mjs";
import { camminoDi, perParte } from "../src/lib/cammino.js";
import { TAVOLE } from "../src/lib/sagaBooks.js";
import HORUS, { SAGA as SAGA_HH } from "../src/data/horusHeresy.js";

// una guida finta con dentro tutte le forme che contano: una voce senza
// numero in TESTA (il prologo), una in MEZZO fra due numerate (un'antologia)
// e due parti
const FINTA = {
  saga: "Finta",
  libri: [
    { o: null, t: "Prologo Uno", c: "Prologo", nota: "percorso A" },
    { o: 1, t: "Alfa", a: "Autrice", c: "Parte 1" },
    { o: null, t: "Antologia", c: "Parte 1", nota: "antologia" },
    { o: 2, t: "Beta", a: "Autrice", c: "Parte 1" },
    { o: 3, t: "Gamma", c: "Parte 2" },
  ],
};
const ALTRA = { saga: "Altra", libri: [{ o: 1, t: "Zeta", c: "Unica" }] };
const TAVOLE_FINTE = [FINTA, ALTRA];

const L = (id, title) => ({ id, title });
// il riconoscimento finto: la stessa forma di `riconosci`, che è quel che
// il vero passa al cammino
const sa = (mappa) => (b) => mappa[b.title] || null;
const titoli = (c) => c.tappe.map((t) => t.voce.t).join(" › ");

export default async (t) => {
  // ── L'ORDINE È QUELLO DELLA GUIDA ─────────────────────────────────────
  {
    const c = camminoDi([L("a", "Alfa")], {
      tavole: TAVOLE_FINTE,
      riconosce: sa({ Alfa: { saga: "Finta", titolo: "Alfa" } }),
    });
    t.eq("le tappe escono nell'ordine della guida", titoli(c), "Prologo Uno › Alfa › Antologia › Beta › Gamma");
    // LA RIGA CHE CONTA: riordinare per numero butterebbe in fondo tutto
    // quello che un numero non ce l'ha — il prologo, le antologie, i 40K —
    // cioè metà della guida vera.
    t.eq("la voce senza numero in testa resta in testa", c.tappe[0].voce.t, "Prologo Uno");
    t.eq("e quella in mezzo resta in mezzo", c.tappe[2].voce.t, "Antologia");
    t.eq("il cammino le tiene tutte, numerate o no", c.tappe.length, 5);
  }

  // ── I TUOI LIBRI DENTRO LA GUIDA ──────────────────────────────────────
  {
    const c = camminoDi([L("a", "Alfa"), L("g", "Gamma")], {
      tavole: TAVOLE_FINTE,
      riconosce: sa({ Alfa: { saga: "Finta", titolo: "Alfa" }, Gamma: { saga: "Finta", titolo: "Gamma" } }),
    });
    t.eq("le tappe tue si contano", c.tue, 2);
    t.eq("e sono quelle giuste", c.tappe.filter((x) => x.libro).map((x) => x.voce.t).join("+"), "Alfa+Gamma");
    t.eq("la tappa porta il TUO libro, non solo un sì", c.tappe[1].libro.id, "a");
    t.eq("quella che non hai resta vuota", c.tappe[3].libro, null);
    t.eq("e non hai libri fuori dal cammino", c.fuori, 0);
  }

  // due copie dello stesso volume sono UNA tappa, e vince la prima: sono
  // due edizioni, non due passi del percorso
  {
    const c = camminoDi([L("uno", "Alfa"), L("due", "Alfa (altra edizione)")], {
      tavole: TAVOLE_FINTE,
      riconosce: sa({
        Alfa: { saga: "Finta", titolo: "Alfa" },
        "Alfa (altra edizione)": { saga: "Finta", titolo: "Alfa" },
      }),
    });
    t.eq("due copie non fanno due tappe", c.tue, 1);
    t.eq("e comanda la prima", c.tappe[1].libro.id, "uno");
  }

  // ── LA TAVOLA SI SCEGLIE A MAGGIORANZA ────────────────────────────────
  {
    const c = camminoDi([L("z", "Zeta"), L("a", "Alfa"), L("b", "Beta")], {
      tavole: TAVOLE_FINTE,
      riconosce: sa({
        Zeta: { saga: "Altra", titolo: "Zeta" },
        Alfa: { saga: "Finta", titolo: "Alfa" },
        Beta: { saga: "Finta", titolo: "Beta" },
      }),
    });
    t.eq("comanda la tavola con più riscontri", c.saga, "Finta");
    // e «più riscontri» non è «la prima che ne ha uno»: qui la tavola
    // dell'altra saga è dichiarata PRIMA, e un cammino che si accontenta
    // del primo riscontro mostrerebbe la guida sbagliata su un ripiano
    // dove quel volume è uno solo
    t.eq(
      "…anche quando l'altra è dichiarata per prima",
      camminoDi([L("z", "Zeta"), L("a", "Alfa"), L("b", "Beta")], {
        tavole: [ALTRA, FINTA],
        riconosce: sa({
          Zeta: { saga: "Altra", titolo: "Zeta" },
          Alfa: { saga: "Finta", titolo: "Alfa" },
          Beta: { saga: "Finta", titolo: "Beta" },
        }),
      }).saga,
      "Finta"
    );
    // il volume dell'altra saga non è una tappa di QUESTO cammino, ed è
    // un'informazione: su un ripiano da trenta volumi dice quanti stanno
    // fuori dalla guida invece di lasciarli contare a mano
    t.eq("e l'altro si conta fra i tuoi libri fuori dal cammino", c.fuori, 1);
  }
  {
    // a parità vince la PRIMA dichiarata: un criterio che dipendesse
    // dall'ordine dei libri cambierebbe cammino a ogni import
    const libri = [L("z", "Zeta"), L("a", "Alfa")];
    const sapere = sa({ Zeta: { saga: "Altra", titolo: "Zeta" }, Alfa: { saga: "Finta", titolo: "Alfa" } });
    t.eq("a parità comanda la prima tavola", camminoDi(libri, { tavole: TAVOLE_FINTE, riconosce: sapere }).saga, "Finta");
    t.eq(
      "…e non l'ordine dei libri",
      camminoDi([...libri].reverse(), { tavole: TAVOLE_FINTE, riconosce: sapere }).saga,
      "Finta"
    );
  }

  // ── QUANDO NON C'È NIENTE DA MOSTRARE ─────────────────────────────────
  {
    t.eq(
      "nessun riscontro, nessun cammino",
      camminoDi([L("x", "Un romanzo qualunque")], { tavole: TAVOLE_FINTE, riconosce: () => null }),
      null
    );
    t.eq("e una biblioteca vuota nemmeno", camminoDi([], { tavole: TAVOLE_FINTE, riconosce: () => null }), null);
    // `riconosci` risponde anche col SOLO autore («questo è un Pratchett»):
    // senza titolo non sappiamo di quale volume si tratti, e una tappa non
    // si può dare per tua a caso
    t.eq(
      "il solo autore non basta a riempire una tappa",
      camminoDi([L("p", "Un titolo mai visto")], {
        tavole: TAVOLE_FINTE,
        riconosce: () => ({ saga: "Finta", titolo: null }),
      }),
      null
    );
  }

  // ── LE PARTI ──────────────────────────────────────────────────────────
  {
    const c = camminoDi([L("a", "Alfa")], {
      tavole: TAVOLE_FINTE,
      riconosce: sa({ Alfa: { saga: "Finta", titolo: "Alfa" } }),
    });
    const parti = perParte(c.tappe);
    t.eq("le parti escono nell'ordine in cui la guida le incontra", parti.map((p) => p.parte).join(" › "), "Prologo › Parte 1 › Parte 2");
    t.eq("e ognuna tiene le sue tappe in ordine", parti[1].tappe.map((x) => x.voce.t).join("+"), "Alfa+Antologia+Beta");
    // filtrando PRIMA di raggruppare, una parte dove non resta niente non
    // lascia un'intestazione vuota
    const soloTue = perParte(c.tappe.filter((x) => x.libro));
    t.eq("filtrando, le parti vuote spariscono", soloTue.length, 1);
    t.eq("…e resta quella giusta", soloTue[0].parte, "Parte 1");
  }

  // ── LA GUIDA VERA ─────────────────────────────────────────────────────
  //
  // Qui il valore è nei DATI, quindi si guarda la tavola vera: è la
  // trascrizione del percorso CD8D ripreso da Polygon, ed è l'unica cosa
  // che il lettore vedrà.
  {
    const hh = TAVOLE.find((tv) => tv.saga === SAGA_HH);
    t.c("la tavola dell'Eresia è fra quelle esportate", !!hh);
    t.eq("e il cammino è la guida intera", HORUS.length, 71);
    t.eq("si apre col prologo", HORUS[0].c, "Prologo · 40K Foundation");
    const primo = HORUS.findIndex((b) => b.o === 1);
    t.eq("il primo romanzo è Horus Rising", HORUS[primo].t, "Horus Rising");
    t.c("e l'antologia della sua parte lo precede", HORUS[primo - 1].nota === "antologia");
    const eretico = HORUS.find((b) => b.t === "The First Heretic");
    t.eq("il numero è quello del CAMMINO", eretico.o, 6);
    t.eq("…non quello della collana", eretico.n, 14);
  }

  // E IL LIBRO SI RICONOSCE PER TITOLO, QUALUNQUE SAGA GLI ABBIA SCRITTO
  // ADDOSSO IL LETTORE: sul suo tablet questi volumi stanno sotto una saga
  // scritta a mano («Warhammer 40K») che nessuna tavola conosce, e un
  // cammino legato al nome della saga non sarebbe mai comparso.
  {
    const suoi = [
      { id: "1", title: "Horus Rising", author: "", saga: "Warhammer 40K" },
      { id: "2", title: "False Gods", author: "", saga: "Warhammer 40K" },
      { id: "3", title: "Un romanzo qualunque", author: "Tizio", saga: "Warhammer 40K" },
    ];
    const c = camminoDi(suoi);
    t.eq("il cammino si trova lo stesso", c.saga, SAGA_HH);
    t.eq("e riconosce i suoi due volumi", c.tue, 2);
    t.eq("l'altro sta fuori dal percorso", c.fuori, 1);
    t.eq("le tappe restano settantuno", c.tappe.length, 71);
    t.c("e «Horus Rising» è segnata come tua", !!c.tappe.find((x) => x.voce.t === "Horus Rising")?.libro);
  }
};
