// LA SCALA DI RINUNCIA DEI LIBRI, e il conto dello spazio nel secchio.
//
// Sono le due parti di `sync.js` che decidono senza toccare la rete, e per
// questo sono passate in `syncCore.js` con le altre: `colonnaMancante` e
// `senzaColonna` stanno già lì, e la scala è la stessa materia.
//
// Quel che difendono è un guasto che non si vede: se lo schema del database
// è indietro di una colonna e la scala non scende, la sincronizzazione muore
// INTERA — non un libro, tutta — e con lei la riga «ultima sincronizzazione»,
// che resta «mai» per sempre. È successo davvero con `music_lists`.
//
// L'altra metà è il conto: una cartella scambiata per un libro non si vede
// (pesa zero) ma fa dire «4 libri» dove ce ne sono tre.
import { upsertBooks, DEGRADE, contaSpazio } from "../src/lib/syncCore.js";

// una riga come quella che l'app manda su davvero
const riga = () => ({
  user_id: "u",
  id: "b1",
  updated_at: 1,
  title: "Guards! Guards!",
  rating: 3.5,
  started_at: "2026-01-01",
  finished_at: null,
  genre: "Fantasy",
  saga: "First Law",
  saga_order: 1,
  impronta: "abc",
  fav: true,
});

// un database che rifiuta finché non gli si tolgono certe colonne, e che si
// ricorda tutto quel che gli è stato mandato
const database = (...vietate) => {
  const visti = [];
  const f = async (payload) => {
    visti.push(JSON.parse(JSON.stringify(payload)));
    for (const v of vietate) {
      if (v in payload[0]) {
        return { error: { message: `Could not find the '${v}' column of 'books' in the schema cache` } };
      }
    }
    return { error: null };
  };
  f.visti = visti;
  return f;
};

export default async function (t) {
  // =======================================================================
  // UNO SCHEMA AGGIORNATO NON PAGA NIENTE
  // =======================================================================
  {
    const db = database();
    const rinunce = await upsertBooks(db, [riga()]);
    t.eq("nessuna rinuncia", rinunce.length, 0);
    t.eq("e un colpo solo", db.visti.length, 1);
    t.c("la riga sale intera", "genre" in db.visti[0][0] && "impronta" in db.visti[0][0]);
  }

  // =======================================================================
  // SI SCENDE UN GRADINO PER VOLTA, E SOLO QUELLO CHE SERVE
  // =======================================================================
  {
    const db = database("started_at");
    const rinunce = await upsertBooks(db, [riga()]);
    t.eq("una rinuncia sola", JSON.stringify(rinunce), '["diario di lettura"]');
    t.eq("due tentativi", db.visti.length, 2);
    // QUEL CHE NON C'ENTRA RESTA: rinunciare a tutto al primo intoppo
    // vorrebbe dire perdere genere, saga e impronta per una colonna sola
    const ultima = db.visti.at(-1)[0];
    t.c("il genere resta", "genre" in ultima);
    t.c("l'impronta resta", "impronta" in ultima);
    t.c("e le date se ne sono andate", !("started_at" in ultima) && !("finished_at" in ultima));
  }
  {
    // uno schema vecchio di tre colonne scende di tre gradini, non di più
    const db = database("started_at", "genre", "impronta");
    const rinunce = await upsertBooks(db, [riga()]);
    t.eq(
      "tre rinunce, in ordine",
      JSON.stringify(rinunce),
      '["diario di lettura","genere e saga","impronta dei doppioni"]'
    );
    t.eq("quattro tentativi", db.visti.length, 4);
    t.c("il cuore dei preferiti è sopravvissuto", "fav" in db.visti.at(-1)[0]);
  }
  {
    // GENERE E SAGA SE NE VANNO INSIEME, perché nello schema stanno o non
    // stanno: è la ragione per cui serve una scala scritta a mano e non
    // basta `senzaColonna`, che ne toglie una alla volta
    const db = database("genre");
    await upsertBooks(db, [riga()]);
    const ultima = db.visti.at(-1)[0];
    t.c("via il genere", !("genre" in ultima));
    t.c("via anche la saga", !("saga" in ultima));
    t.c("e il suo numero d'ordine", !("saga_order" in ultima));
  }

  // =======================================================================
  // QUEL CHE IDENTIFICA LA RIGA NON SI TOGLIE MAI
  // =======================================================================
  //
  // Senza `user_id` la scrittura non sarebbe più rivolta a nessuno: la
  // stessa regola che `senzaColonna` applica alle preferenze, qui applicata
  // scendendo tutta la scala.
  {
    const db = database("started_at", "genre", "impronta", "fav");
    await upsertBooks(db, [riga()]);
    const ultima = db.visti.at(-1)[0];
    for (const k of ["user_id", "id", "updated_at"]) {
      t.c(`«${k}» c'è ancora in fondo alla scala`, k in ultima, Object.keys(ultima).join(","));
    }
    t.c("e il titolo pure, che è il minimo per riconoscere il libro", "title" in ultima);
  }

  // =======================================================================
  // LE MEZZE STELLE NON SONO UNA COLONNA CHE MANCA
  // =======================================================================
  //
  // È un tipo che non regge i decimali: non si toglie niente, si arrotonda.
  // Togliendo la colonna il voto sparirebbe del tutto invece di perdere
  // mezza stella.
  {
    const visti = [];
    const soloInteri = async (p) => {
      visti.push(JSON.parse(JSON.stringify(p)));
      return typeof p[0].rating === "number" && p[0].rating % 1
        ? { error: { message: "invalid input syntax for type integer" } }
        : { error: null };
    };
    const rinunce = await upsertBooks(soloInteri, [riga()]);
    t.eq("la rinuncia si chiama per nome", JSON.stringify(rinunce), '["mezze stelle"]');
    const ultima = visti.at(-1)[0];
    t.c("il voto c'è ancora", "rating" in ultima);
    t.eq("arrotondato", ultima.rating, 4);
  }

  // =======================================================================
  // UN GUASTO VERO NON SI CURA SCENDENDO
  // =======================================================================
  //
  // La rete caduta, un permesso negato: scendere la scala non li risolve, e
  // girare a vuoto nasconderebbe il guasto invece di dirlo.
  {
    let alzato = null;
    try {
      await upsertBooks(async () => ({ error: { message: "network unreachable" } }), [riga()]);
    } catch (e) {
      alzato = e.message;
    }
    t.eq("l'errore arriva a chi ha chiamato", alzato, "network unreachable");
  }
  {
    // E UN UPSERT MAI RIUSCITO NON DEVE MAI TORNARE IN SILENZIO: tornando
    // normalmente, il pannello direbbe «sincronizzato» con delle rinunce, e
    // invece lassù non è arrivato niente.
    let alzato = false;
    const maiContento = async () => ({ error: { message: "Could not find the 'genre' column of 'books'" } });
    try {
      await upsertBooks(maiContento, [riga()]);
    } catch {
      alzato = true;
    }
    t.c("un database che non accetta mai fa alzare un errore", alzato);
  }
  {
    // LO SCHEMA PIÙ VECCHIO POSSIBILE: si scendono tutti e cinque i gradini,
    // e il tentativo buono è quello DOPO l'ultimo.
    //
    // È il caso che dimostra a cosa serve il `<=` nel ciclo: con un `<` si
    // farebbero cinque tentativi, l'ultima rinuncia si applicherebbe senza
    // mai essere provata, e `upsertBooks` tornerebbe NORMALMENTE con cinque
    // rinunce in mano — il pannello direbbe «sincronizzato», e lassù non
    // sarebbe arrivato niente. Senza un caso che arriva in fondo alla scala
    // la mutazione sopravvive: provato.
    const visti = [];
    const antico = async (p) => {
      visti.push(JSON.parse(JSON.stringify(p)));
      const r = p[0];
      for (const v of ["started_at", "genre", "impronta", "fav"]) {
        if (v in r) return { error: { message: `Could not find the '${v}' column of 'books'` } };
      }
      if (typeof r.rating === "number" && r.rating % 1) {
        return { error: { message: "invalid input syntax for type integer" } };
      }
      return { error: null };
    };
    const rinunce = await upsertBooks(antico, [riga()]);
    t.eq("cinque rinunce", rinunce.length, 5);
    t.eq("e sei tentativi: l'ultimo è quello che riesce", visti.length, 6);
    t.c("in fondo resta di che riconoscere il libro", "user_id" in visti.at(-1)[0] && "title" in visti.at(-1)[0]);
  }
  {
    // LO STESSO GRADINO NON SI SCENDE DUE VOLTE: senza quella guardia, un
    // database che continua a lamentarsi della stessa colonna farebbe girare
    // la scala a vuoto e la riga uscirebbe con la stessa rinuncia ripetuta
    const db = database("genre");
    const rinunce = await upsertBooks(db, [riga()]);
    t.eq("una rinuncia, non due", new Set(rinunce).size, rinunce.length);
  }
  {
    // la scala ha dei gradini e hanno un nome: sono quelli che il pannello
    // mostra al lettore, e una rinuncia taciuta è un pezzo di biblioteca che
    // non sale senza che nessuno lo sappia
    t.c("i gradini hanno tutti un nome", DEGRADE.every((d) => typeof d.label === "string" && d.label));
    t.c("e ognuno sa riconoscersi", DEGRADE.every((d) => typeof d.test === "function"));
    t.eq("i nomi sono distinti", new Set(DEGRADE.map((d) => d.label)).size, DEGRADE.length);
  }

  // =======================================================================
  // IL CONTO DELLO SPAZIO: una cartella non è un libro
  // =======================================================================
  const F = (name, size) => ({ name, metadata: { size } });
  // le cartelle arrivano dall'elenco SENZA metadati: è così che si
  // riconoscono, ed è l'unico modo
  const cartella = (name) => ({ name });
  {
    const c = contaSpazio(
      [F("a.epub", 100), F("a.cover", 10), cartella("melodie"), F("b.pdf", 50)],
      [F("m1.mp3", 300)]
    );
    t.eq("due libri, non tre", c.libri.quanti, 2);
    t.eq("col loro peso", c.libri.byte, 150);
    t.eq("una copertina, contata a parte", c.copertine.quanti, 1);
    t.eq("e una melodia", c.melodie.quanti, 1);
    t.eq("il totale tiene tutto, copertine comprese", c.totale, 460);
  }
  {
    // LA CARTELLA PESA ZERO, ed è per questo che il difetto sarebbe muto:
    // il totale tornerebbe giusto, e solo il CONTEGGIO direbbe una bugia
    const conCartella = contaSpazio([F("a.epub", 100), cartella("melodie")], []);
    const senza = contaSpazio([F("a.epub", 100)], []);
    t.eq("il peso è lo stesso", conCartella.totale, senza.totale);
    t.eq("ma il conto dei libri no, se la cartella entrasse", conCartella.libri.quanti, senza.libri.quanti);
  }
  {
    // le copertine non sono libri: contate insieme, lo scaffale direbbe il
    // doppio dei tomi che hai
    const c = contaSpazio([F("a.epub", 100), F("a.cover", 10), F("b.epub", 20), F("b.cover", 5)], []);
    t.eq("due libri", c.libri.quanti, 2);
    t.eq("due copertine", c.copertine.quanti, 2);
    t.eq("e i pesi stanno separati", `${c.libri.byte}/${c.copertine.byte}`, "120/15");
  }
  {
    // un secchio vuoto, o che non risponde, non deve esplodere
    const vuoto = contaSpazio(null, null);
    t.eq("niente libri", vuoto.libri.quanti, 0);
    t.eq("niente melodie", vuoto.melodie.quanti, 0);
    t.eq("e totale zero", vuoto.totale, 0);
    // un file senza dimensione dichiarata vale zero e non NaN: un totale
    // diventato NaN non torna più indietro
    const monco = contaSpazio([{ name: "a.epub", metadata: {} }], []);
    t.c("una dimensione mancante vale zero", Number.isFinite(monco.totale) && monco.totale === 0);
    t.eq("ma il libro si conta lo stesso", monco.libri.quanti, 1);
  }
}
