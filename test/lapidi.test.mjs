// UNA LAPIDE NEL LOTTO NON DEVE AVERE MENO COLONNE DI UNA RIGA PIENA.
//
// Segnalato col pannello della nuvola in mano: «Sincronizzazione fallita:
// null value in column "fav" of relation "books" violates not-null
// constraint».
//
// IL MECCANISMO ERA GIÀ SCRITTO nel commento sopra `normalizeRow`:
// PostgREST unisce le chiavi di un lotto, quindi una riga con meno colonne
// le riceve come NULL, non come default. Le lapidi nascono con tre chiavi
// (`{id, deleted, updated_at}`) e `normalizeRow` le riempie con
// `EMPTY_ROW`. Ma chi ha aggiunto `impronta` e `fav` a `rowFromLocal` non è
// passato da `EMPTY_ROW`, e da allora la lapide arrivava con 22 colonne
// contro 24.
//
// E IL DIFETTO È INVISIBILE FINCHÉ NESSUNO CANCELLA UN LIBRO: senza una
// lapide nel lotto tutte le righe hanno le stesse chiavi e non c'è niente
// da riempire. Il giorno che ne cancelli uno, Postgres rifiuta l'INTERO
// invio — non la lapide: tutto. E `impronta` era passata liscia solo
// perché è nullable, cioè scriveva un null in silenzio invece di
// lamentarsi: la colonna `not null` è quella che ha parlato.
import { rowFromLocal, normalizeRow, planSync } from "../src/lib/syncCore.js";

const libro = (id, extra = {}) => ({ id, title: id, addedAt: 1, ...extra });

export default async function (t) {
  // ---- IL PATTO: `EMPTY_ROW` copre tutto quel che `rowFromLocal` manda --
  {
    const piena = Object.keys(rowFromLocal(libro("a"), {}, 1));
    const lapide = Object.keys(normalizeRow({ id: "a", deleted: true, updated_at: 1 }));
    const manca = piena.filter((k) => !lapide.includes(k));
    t.c(
      "una lapide normalizzata ha tutte le colonne di una riga piena",
      manca.length === 0,
      `mancano: ${manca.join(", ")}`
    );
    // il patto vale anche al contrario: una colonna in `EMPTY_ROW` che
    // `rowFromLocal` non manda piu' sarebbe una colonna morta che continua
    // a viaggiare (`user_id` lo aggiunge chi invia, non queste due)
    const dipiu = lapide.filter((k) => !piena.includes(k) && k !== "id");
    t.c("e nessuna colonna di troppo", dipiu.length === 0, `di piu': ${dipiu.join(", ")}`);
  }

  // ---- IL CASO VERO, dal pannello del lettore --------------------------
  {
    // `fav` è `not null` nello schema: una lapide senza quella chiave, in
    // un lotto dove le altre righe ce l'hanno, la riceve NULL da PostgREST
    const lapide = normalizeRow({ id: "morto", deleted: true, updated_at: 9 });
    t.c("la lapide porta `fav`", "fav" in lapide);
    t.eq("…e vale `false`, non null", lapide.fav, false);
    t.c("la lapide porta `impronta`", "impronta" in lapide);
    t.eq("…e vale null, che lì è legittimo", lapide.impronta, null);
  }

  // ---- IL LOTTO INTERO, che è come Postgres lo vede --------------------
  {
    // la scena esatta: un libro vivo col cuore, uno senza, e uno cancellato
    const { push } = planSync({
      localRows: [
        rowFromLocal(libro("vivo", { fav: true }), {}, 5),
        rowFromLocal(libro("altro"), {}, 5),
      ],
      tombstones: { morto: 7 },
      remoteRows: [],
    });
    t.eq("tre righe da mandare", push.length, 3);
    const lotto = push.map(normalizeRow);
    const chiavi = lotto.map((r) => Object.keys(r).sort().join(","));
    t.c(
      "TUTTE le righe del lotto hanno le stesse chiavi",
      new Set(chiavi).size === 1,
      `${new Set(chiavi).size} forme diverse`
    );
    // e nessun `null` finisce dove lo schema non lo accetta
    const NON_NULL = ["fav", "deleted", "title", "author", "status", "updated_at"];
    for (const r of lotto)
      for (const c of NON_NULL)
        t.c(`«${r.id}» non manda null in «${c}»`, r[c] !== null && r[c] !== undefined, JSON.stringify(r[c]));
  }

  // ---- e la riga piena non si tocca ------------------------------------
  {
    // `normalizeRow` riempie i buchi, non riscrive: il cuore acceso resta
    // acceso e l'impronta resta la sua
    const piena = rowFromLocal(libro("x", { fav: true, impronta: "abc" }), {}, 3);
    const dopo = normalizeRow(piena);
    t.eq("il cuore acceso sopravvive", dopo.fav, true);
    t.eq("l'impronta sopravvive", dopo.impronta, "abc");
    t.eq("e il cuore spento resta `false`", normalizeRow(rowFromLocal(libro("y"), {}, 3)).fav, false);
  }

  // DICHIARATO, non dimenticato: la mutazione che toglie `deleted: true`
  // dalla lapide qui NON casca — `normalizeRow` riempie con `false` e le
  // chiavi restano le stesse, che è proprio quel che questo file guarda.
  // La prende `piano.test.mjs`, che è il posto giusto: lì si difende COSA
  // decide `planSync`, qui CHE FORMA hanno le righe che ne escono.
}
