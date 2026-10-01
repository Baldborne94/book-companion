// IL GIRO LEGGE LE RIGHE LEGGERE, E INTERE SOLO QUELLE CHE SI MUOVONO.
// La trappola e' una ed e' grave: una riga leggera — id, ora, cancellato —
// applicata come fosse intera cancellerebbe qui titolo, saga, voto e note.
import {
  COLONNE_LEGGERE,
  LOTTO_IDS,
  leggiRigheLeggere,
  aPagine,
  PAGINA_RIGHE,
  leggiRigheIntere,
  idDaLeggereInteri,
  completaPull,
  planSync,
} from "../src/lib/syncCore.js";

const leggera = (id, updated_at, extra = {}) => ({ id, updated_at, deleted: false, file_tolto: false, ...extra });

export default async function (t) {
  // ---- la lettura leggera, e il ripiego ----
  {
    const chieste = [];
    const r = await leggiRigheLeggere(async (colonne) => {
      chieste.push(colonne);
      return { data: [leggera("a", 5)], error: null };
    });
    t.eq("si chiedono le sole colonne leggere", chieste.join(" | "), COLONNE_LEGGERE);
    t.c("le colonne leggere bastano a decidere e a trovare gli avanzi del secchio", ["id", "updated_at", "deleted", "file_tolto"].every((c) => COLONNE_LEGGERE.split(",").includes(c)));
    t.eq("e non sono intere", r.intere, false);
    t.eq("con le righe che ha dato il database", r.righe.map((x) => x.id).join(), "a");
  }
  {
    const chieste = [];
    const r = await leggiRigheLeggere(async (colonne) => {
      chieste.push(colonne);
      if (colonne !== "*") return { data: null, error: { message: "column books.file_tolto does not exist" } };
      return { data: [{ id: "a", title: "Mort", updated_at: 5 }], error: null };
    });
    t.eq("uno schema senza la colonna: si legge tutto come prima", chieste.join(" | "), `${COLONNE_LEGGERE} | *`);
    t.eq("…e quelle righe sono intere", r.intere, true);
  }
  {
    let preso = null;
    try {
      await leggiRigheLeggere(async () => ({ data: null, error: { message: "rete" } }));
    } catch (e) {
      preso = e;
    }
    t.eq("se nemmeno la lettura intera riesce, il giro si ferma", preso?.message, "rete");
  }

  // ---- le righe intere, a lotti ----
  {
    const lotti = [];
    const ids = Array.from({ length: 250 }, (_, i) => `id${i}`);
    const intere = await leggiRigheIntere(async (lotto) => {
      lotti.push(lotto.length);
      return { data: lotto.map((id) => ({ id, title: id })), error: null };
    }, ids);
    t.eq("250 righe in lotti che non superano il tetto", lotti.join(","), `${LOTTO_IDS},${LOTTO_IDS},50`);
    t.eq("tutte ritrovate", intere.size, 250);
    t.eq("nessuna domanda se non serve niente", (await leggiRigheIntere(async () => { throw new Error("chiamata"); }, [])).size, 0);
    let preso = false;
    try {
      await leggiRigheIntere(async () => ({ data: null, error: { message: "rete" } }), ["a"]);
    } catch {
      preso = true;
    }
    t.c("un guasto ferma il giro invece di far credere che la riga non ci sia", preso);
  }

  // ---- chi va letto intero ----
  {
    const remote = [leggera("scende", 9), leggera("sale", 1), leggera("cancellata", 1, { deleted: true }), leggera("tolto", 1)];
    const pull = [remote[0]];
    // «tolto» e' vivo lassu' e qui e' stato cancellato: la lapide parte, e
    // per partire non le serve la riga intera
    const push = [{ id: "sale" }, { id: "nuovo" }, { id: "cancellata" }, { id: "via", deleted: true }, { id: "tolto", deleted: true }];
    t.eq(
      "chi scende, e chi sale sopra una riga viva lassu'",
      idDaLeggereInteri({ pull, push, remote }).sort().join(),
      "sale,scende"
    );
  }

  // ---- una riga leggera non si applica mai ----
  {
    const pull = [leggera("a", 9), leggera("b", 9)];
    const intere = new Map([["a", { id: "a", title: "Mort", saga: "Discworld", updated_at: 9 }]]);
    const r = completaPull(pull, intere);
    t.eq("scende solo chi e' arrivato intero", r.map((x) => x.id).join(), "a");
    t.eq("…ed e' la riga intera", r[0].title, "Mort");
    t.c("nessuna riga leggera fra quelle da ricevere", r.every((x) => "title" in x));
  }

  // ---- il giro intero, su un mondo finto: le righe leggere decidono come quelle intere ----
  {
    const intereLassu = [
      { id: "uguale", title: "Uguale", updated_at: 5, deleted: false, file_tolto: false },
      { id: "piuNuova", title: "Nuova lassu'", updated_at: 9, deleted: false, file_tolto: false },
      { id: "vecchia", title: "Vecchia lassu'", updated_at: 1, deleted: false, file_tolto: false },
      { id: "soloLassu", title: "Solo lassu'", updated_at: 3, deleted: false, file_tolto: false },
    ];
    const localRows = [
      { id: "uguale", updated_at: 5 },
      { id: "piuNuova", updated_at: 4 },
      { id: "vecchia", updated_at: 7 },
      { id: "soloQui", updated_at: 2 },
    ];
    const leggere = intereLassu.map(({ id, updated_at, deleted, file_tolto }) => ({ id, updated_at, deleted, file_tolto }));
    const conIntere = planSync({ localRows, tombstones: {}, remoteRows: intereLassu });
    const conLeggere = planSync({ localRows, tombstones: {}, remoteRows: leggere });
    const ids = (xs) => xs.map((x) => x.id).sort().join();
    t.eq("le righe leggere decidono chi scende come quelle intere", ids(conLeggere.pull), ids(conIntere.pull));
    t.eq("…chi sale", ids(conLeggere.push), ids(conIntere.push));
    t.eq("…e chi se ne va", conLeggere.removeLocal.join(), conIntere.removeLocal.join());
    const daLeggere = idDaLeggereInteri({ pull: conLeggere.pull, push: conLeggere.push, remote: leggere });
    t.eq("si leggono intere solo le righe che si muovono", daLeggere.sort().join(), "piuNuova,soloLassu,vecchia");
    const intere = new Map(intereLassu.filter((r) => daLeggere.includes(r.id)).map((r) => [r.id, r]));
    t.eq("e scendono intere", completaPull(conLeggere.pull, intere).map((r) => r.title).sort().join(" · "), "Nuova lassu' · Solo lassu'");
  }

  // ---- a pagine: Supabase da' al piu' mille righe per richiesta ----
  {
    // un server come quello vero: le righe in ordine, al piu' `tetto` per volta
    const server = (n, tetto = PAGINA_RIGHE) => {
      const righe = Array.from({ length: n }, (_, i) => ({ id: `l${String(i).padStart(4, "0")}` }));
      const chieste = [];
      const leggi = async (da, a) => {
        chieste.push([da, a]);
        return { data: righe.slice(da, Math.min(a + 1, da + tetto)), error: null };
      };
      return { leggi, chieste };
    };
    const s1 = server(1070);
    const r1 = await aPagine(s1.leggi);
    t.eq("una biblioteca di 1070 libri arriva intera", r1.data.length, 1070);
    t.eq("…ognuno una volta sola", new Set(r1.data.map((x) => x.id)).size, 1070);
    t.eq("…in tre richieste: due pagine e quella vuota che dice basta", s1.chieste.map(([a, b]) => `${a}-${b}`).join(" "), "0-999 1000-1999 1070-2069");
    const s2 = server(1070, 500);
    t.eq("un server che ne da' meno di mille per volta non taglia la biblioteca", (await aPagine(s2.leggi)).data.length, 1070);
    t.eq("…perche' si riparte da quante ne sono arrivate", s2.chieste[1][0], 500);
    t.eq("una biblioteca vuota e' una richiesta sola", (await aPagine(server(0).leggi)).data.length, 0);
    const rotta = await aPagine(async (da) => (da ? { data: null, error: { message: "rete" } } : { data: [{ id: "a" }], error: null }));
    t.eq("una pagina che non arriva e' un guasto, non una biblioteca a meta'", rotta.error?.message, "rete");
    const s3 = server(1070);
    const r3 = await leggiRigheLeggere((colonne) => aPagine(s3.leggi));
    t.eq("e la lettura leggera la usa com'e'", r3.righe.length, 1070);
  }
}
