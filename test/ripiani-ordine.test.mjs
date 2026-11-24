// «ORDINA» ORDINA ANCHE I RIPIANI, non solo i libri dentro di loro.
//
// Segnalato dal lettore come confusione fra i due menu della Libreria:
// «serve avere sia raggruppa che ordina? mi sembra un po' confusionario
// averli entrambi». Misurato prima di toccare niente: `Grouped` passava a
// `disponi` i libri gia' ordinati, e l'ordine dei RIPIANI era sempre e
// solo alfabetico. Quindi scegliendo «Recenti» — che vuol dire «fammi
// vedere quel che e' appena entrato» — dentro una saga vinceva il numero
// di lettura e le intestazioni non si muovevano di un pixel: sullo
// schermo, un comando che non cambia niente.
//
// Non mancava un menu: mancava meta' del lavoro di quello che c'era.
//
// LA PARTE CHE SBAGLIA IN SILENZIO e' che nessuno di questi ordini alza
// un errore. Un ripiano nel posto sbagliato si legge e basta — ed e'
// esattamente com'e' passato inosservato fin qui.
import { disponi, aEtichette, criterioVoto, criterioStato, ORDINI, SOLI } from "../src/lib/ripiani.js";

const libro = (title, author, saga = null, sagaOrder = null, addedAt = 0, extra = {}) => ({
  id: title,
  title,
  author,
  saga,
  sagaOrder,
  addedAt,
  ...extra,
});

const nomi = (r) => r.map((x) => x.nome);
const titoli = (r) => r.map((b) => b.title);

// tre saghe, con l'ultimo ingresso in un ordine che NON e' l'alfabetico:
// Zaffiro e' il ripiano piu' vecchio, Ambra il piu' nuovo
const BIBLIOTECA = () => [
  libro("Ambra I", "Uno", "Ambra", 1, 10),
  libro("Ambra II", "Uno", "Ambra", 2, 900),
  libro("Mirto I", "Due", "Mirto", 1, 500),
  libro("Mirto II", "Due", "Mirto", 2, 400),
  libro("Zaffiro I", "Tre", "Zaffiro", 1, 100),
  libro("Zaffiro II", "Tre", "Zaffiro", 2, 50),
];

export default async function (t) {
  // ---- SENZA ORDINE: la disposizione di sempre -------------------------
  {
    const r = disponi(BIBLIOTECA(), null, "saga");
    t.eq("senza ordine i ripiani stanno in alfabetico", nomi(r).join(" · "), "Ambra · Mirto · Zaffiro");
    // un id che non conosciamo non deve spegnere lo scaffale: e' la stessa
    // regola di `vistaValida`, della svolta e del criterio storto
    const storto = disponi(BIBLIOTECA(), null, "saga", "meringa");
    t.eq("un ordine che non esiste vale l'alfabetico", nomi(storto).join(" · "), "Ambra · Mirto · Zaffiro");
    t.eq("…e «Titolo» pure", nomi(disponi(BIBLIOTECA(), null, "saga", "title")).join(" · "), "Ambra · Mirto · Zaffiro");
    // «Autore» non ha una voce sua APPOSTA: sotto «Raggruppa: Autore» il
    // nome del ripiano E' gia' l'autore, quindi l'alfabetico e' la sua
    // risposta giusta — non una dimenticanza
    t.eq("…e «Autore» anche", nomi(disponi(BIBLIOTECA(), null, "saga", "author")).join(" · "), "Ambra · Mirto · Zaffiro");
  }

  // ---- «RECENTI»: IL RIPIANO DOVE E' ENTRATO L'ULTIMO LIBRO ------------
  {
    const r = disponi(BIBLIOTECA(), null, "saga", "recent");
    // IL PATTO: e' l'ingresso piu' recente DEL RIPIANO a contare, non il
    // primo libro che capita ne' il nome
    t.eq("i ripiani scendono dall'ultimo ingresso", nomi(r).join(" · "), "Ambra · Mirto · Zaffiro");
  }
  {
    // e qui l'alfabetico e la data DIVERGONO, o il controllo di sopra
    // passerebbe anche senza la cura: Zaffiro ha il libro piu' nuovo
    const dentro = BIBLIOTECA();
    dentro.find((b) => b.title === "Zaffiro II").addedAt = 9000;
    const r = disponi(dentro, null, "saga", "recent");
    t.eq("il ripiano col libro piu' nuovo apre", nomi(r).join(" · "), "Zaffiro · Ambra · Mirto");
    t.eq("…e in alfabetico no", nomi(disponi(dentro, null, "saga")).join(" · "), "Ambra · Mirto · Zaffiro");
  }
  {
    // UN RIPIANO SI MISURA SUL SUO LIBRO PIU' NUOVO, non sulla media ne'
    // sul primo: una saga vecchia dove hai appena aggiunto un volume e'
    // una saga che stai riprendendo in mano
    const r = disponi(
      [
        libro("Vecchia I", "A", "Vecchia", 1, 1),
        libro("Vecchia II", "A", "Vecchia", 2, 5000),
        libro("Media I", "B", "Media", 1, 400),
        libro("Media II", "B", "Media", 2, 410),
      ],
      null,
      "saga",
      "recent"
    );
    t.eq("comanda il libro piu' nuovo del ripiano", nomi(r).join(" · "), "Vecchia · Media");
  }
  {
    // A PARITA' DECIDE L'ALFABETO, o l'ordine dipenderebbe da come i libri
    // sono entrati in biblioteca — e cambierebbe a ogni import
    const r = disponi(
      [
        libro("Zeta I", "A", "Zeta", 1, 700),
        libro("Zeta II", "A", "Zeta", 2, 700),
        libro("Alfa I", "B", "Alfa", 1, 700),
        libro("Alfa II", "B", "Alfa", 2, 700),
      ],
      null,
      "saga",
      "recent"
    );
    t.eq("a parita' di ingresso decide l'alfabeto", nomi(r).join(" · "), "Alfa · Zeta");
  }

  // ---- QUEL CHE NON DEVE ROMPERSI MAI ----------------------------------
  {
    // DENTRO UNA SAGA COMANDA L'ORDINE DI LETTURA, sempre: e' l'unico
    // ordine che una saga possiede davvero, e «Recenti» non deve toccarlo
    // — un secondo volume prima del primo non e' uno scaffale, e' un
    // guasto che nessun errore segnala
    const dentro = [
      libro("Ambra II", "Uno", "Ambra", 2, 900),
      libro("Ambra I", "Uno", "Ambra", 1, 10),
      libro("Ambra III", "Uno", "Ambra", 3, 50),
    ];
    const r = disponi(dentro, null, "saga", "recent");
    t.eq("dentro il ripiano resta l'ordine di lettura", titoli(r[0].libri).join(" · "), "Ambra I · Ambra II · Ambra III");
  }
  {
    // IL MUCCHIO DI SCARTO CHIUDE SEMPRE LA FILA, qualunque ordine si
    // scelga: non e' un ripiano fra gli altri, e' quel che resta — aprire
    // lo scaffale dai «Fuori saga» perche' ci e' appena entrato un libro
    // sarebbe il contrario di uno scaffale
    const dentro = [...BIBLIOTECA(), libro("Solo", "Quattro", null, null, 99999)];
    const r = disponi(dentro, null, "saga", "recent");
    t.eq("il mucchio resta in coda anche col libro piu' nuovo", r[r.length - 1].id, SOLI);
    t.eq("…e si chiama ancora «Fuori saga»", r[r.length - 1].nome, "Fuori saga");
    const auto = disponi(dentro, null, "auto", "recent");
    t.eq("…e in «Saga e autore» pure", auto[auto.length - 1].id, SOLI);
  }
  {
    // e i tre criteri di raggruppamento lo reggono tutti: l'ordine e' una
    // cosa, il criterio un'altra
    for (const per of ["auto", "saga", "autore"]) {
      const r = disponi(BIBLIOTECA(), null, per, "recent");
      t.c(`«${per}» regge l'ordine per data`, r.length > 0 && r.every((x) => x.libri.length > 0));
    }
    const perAutore = disponi(BIBLIOTECA(), null, "autore", "recent");
    t.eq("per autore comanda lo stesso l'ultimo ingresso", nomi(perAutore).join(" · "), "Uno · Due · Tre");
  }

  // ---- LE ETICHETTE: DOVE C'E' UNA SCALA, COMANDA LA SCALA -------------
  {
    // il genere non ha scala: l'alfabetico era un ripiego, quindi
    // «Recenti» puo' parlare
    const criterio = { chiave: (b) => b.genre || "", vuoto: "Senza genere" };
    const dentro = [
      libro("a", "X", null, null, 10, { genre: "Fantasy" }),
      libro("b", "X", null, null, 900, { genre: "Thriller" }),
      libro("c", "X", null, null, 5, { genre: "Giallo" }),
    ];
    t.eq("i generi in alfabetico senza ordine", nomi(aEtichette(dentro, criterio)).join(" · "), "Fantasy · Giallo · Thriller");
    t.eq("…e per data con «Recenti»", nomi(aEtichette(dentro, criterio, "recent")).join(" · "), "Thriller · Fantasy · Giallo");
  }
  {
    // IL VOTO HA UNA SCALA SUA e la scala comanda: riordinarlo per data
    // cancellerebbe proprio l'informazione per cui l'hai chiesto
    const dentro = [
      libro("a", "X", null, null, 10, { rating: 5 }),
      libro("b", "X", null, null, 900, { rating: 3 }),
      libro("c", "X", null, null, 500, { rating: 4 }),
    ];
    t.eq(
      "le stelle scendono anche con «Recenti»",
      nomi(aEtichette(dentro, criterioVoto(), "recent")).join(" · "),
      "5 stelle · 4 stelle · 3 stelle"
    );
  }
  {
    // e lo stato segue la vita di un libro, non la data d'ingresso
    const stati = { a: "read", b: "unread", c: "reading" };
    const dentro = [
      libro("a", "X", null, null, 900),
      libro("b", "X", null, null, 10),
      libro("c", "X", null, null, 500),
    ];
    t.eq(
      "gli stati restano in ordine di lettura",
      nomi(aEtichette(dentro, criterioStato((b) => stati[b.id]), "recent")).join(" · "),
      "Da leggere · In lettura · Letti"
    );
  }
  {
    // e il mucchio senza etichetta chiude la fila anche qui
    const criterio = { chiave: (b) => b.genre || "", vuoto: "Senza genere" };
    const dentro = [
      libro("a", "X", null, null, 10, { genre: "Fantasy" }),
      libro("b", "X", null, null, 99999),
    ];
    const r = aEtichette(dentro, criterio, "recent");
    t.eq("chi non ha etichetta chiude la fila", r[r.length - 1].nome, "Senza genere");
    t.c("…ed e' spento", r[r.length - 1].spento === true);
  }

  // ---- LA TAVOLA -------------------------------------------------------
  {
    // una voce muta sarebbe un ordinamento che non ordina: se qualcuno ne
    // aggiunge una, deve essere una funzione di confronto vera
    for (const [id, f] of Object.entries(ORDINI))
      t.c(`«${id}» porta un confronto`, typeof f === "function" && f.length === 2);
    // E UN LIBRO SENZA `addedAt` NON DEVE INVENTARSI UN ORDINE: un archivio
    // vecchio, o un dispositivo rimasto indietro, manda schede dove il
    // campo non c'e' proprio — `Number(undefined)` e' NaN, e un NaN dentro
    // un confronto non alza niente: il browser lo legge come «pari», il
    // ripiano scivola nell'alfabetico e sembra funzionare. Il nome dice
    // l'opposto della data apposta, o il controllo passerebbe comunque.
    const senzaData = (title, saga, ordine) => ({ id: title, title, author: "A", saga, sagaOrder: ordine });
    const r = disponi(
      [
        senzaData("Alfa I", "Alfa", 1),
        senzaData("Alfa II", "Alfa", 2),
        libro("Zeta I", "B", "Zeta", 1, 10),
        libro("Zeta II", "B", "Zeta", 2, 20),
      ],
      null,
      "saga",
      "recent"
    );
    t.eq("un ripiano senza date vale zero e chiude la fila", nomi(r).join(" · "), "Zeta · Alfa");
  }
}
