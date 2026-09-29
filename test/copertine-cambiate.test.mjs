// LA COPERTINA CAMBIATA SU UN DISPOSITIVO ARRIVA SULL'ALTRO
// (`copertineDaScaricare`/`copertineDaCaricare` con le misure e l'attesa,
// in `lib/syncCore.js`). Segnalato dal lettore: Alice in Borderland v01
// rivestito sul PC, e sul tablet ancora la prima pagina. Sbaglia in
// silenzio: la sincronizzazione dice «fatto» e la copertina vecchia resta.
import { copertineDaScaricare, copertineDaCaricare, copertineInAttesa, segnaInAttesa, contaSpazio } from "../src/lib/syncCore.js";

const ids = (xs) => xs.map((b) => b.id).join(",");

export default async function (t) {
  const libri = [{ id: "A" }, { id: "B" }, { id: "C" }];

  // ---- il caso del lettore ------------------------------------------------
  const qui = new Set(["A", "B"]);
  const lassu = new Set(["A", "B", "C"]);
  const misureQui = new Map([["A", 51000], ["B", 40000]]);
  const misureLassu = new Map([["A", 73000], ["B", 40000], ["C", 20000]]);
  t.eq("scende quella che qui c'e' ma e' un'altra, e quella che manca", ids(copertineDaScaricare(libri, { qui, lassu, misureQui, misureLassu })), "A,C");
  t.eq("…non quella uguale", copertineDaScaricare(libri, { qui, lassu, misureQui, misureLassu }).some((b) => b.id === "B"), false);
  t.eq("una misura che non si sa non decide niente", ids(copertineDaScaricare(libri, { qui, lassu, misureQui: new Map(), misureLassu })), "C");
  t.eq("…ne' di la'", ids(copertineDaScaricare(libri, { qui, lassu, misureQui, misureLassu: new Map() })), "C");

  // ---- la copertina cambiata qui e non ancora partita ------------------------
  const inAttesa = new Set(["A"]);
  t.eq("cambiata qui e non partita: non la copre quella di prima", ids(copertineDaScaricare(libri, { qui, lassu, misureQui, misureLassu, inAttesa })), "C");
  t.eq("…sale, anche se lassu' ce n'e' gia' una", ids(copertineDaCaricare(libri, { qui, lassu, inAttesa })), "A");
  t.eq("senza attesa quella che lassu' c'e' non si rimanda", copertineDaCaricare(libri, { qui, lassu }).length, 0);

  // ---- IL GIRO CONVERGE: due dispositivi, nessun pendolo ------------------------
  // tablet e secchio come nel caso del lettore; il giro fa quel che decide
  // e il secondo giro non muove niente
  const casa = { qui: new Set(qui), misure: new Map(misureQui) };
  const secchio = { lassu: new Set(lassu), misure: new Map(misureLassu) };
  const giro = () => {
    let mosse = 0;
    for (const b of copertineDaCaricare(libri, { qui: casa.qui, lassu: secchio.lassu })) {
      secchio.lassu.add(b.id); secchio.misure.set(b.id, casa.misure.get(b.id)); mosse += 1;
    }
    for (const b of copertineDaScaricare(libri, { qui: casa.qui, lassu: secchio.lassu, misureQui: casa.misure, misureLassu: secchio.misure })) {
      casa.qui.add(b.id); casa.misure.set(b.id, secchio.misure.get(b.id)); mosse += 1;
    }
    return mosse;
  };
  t.eq("il primo giro porta giu' le due", giro(), 2);
  t.eq("il tablet ha la copertina del PC", casa.misure.get("A"), 73000);
  t.eq("il secondo giro e' fermo", giro(), 0);

  // ---- l'elenco del secchio sa le misure -------------------------------------
  const s = contaSpazio([{ name: "A.cover", metadata: { size: 73000 } }, { name: "A.epub", metadata: { size: 9 } }], []);
  t.eq("la misura di ogni copertina lassu'", s.misureCopertine.get("A"), 73000);
  t.c("…solo delle copertine", !s.misureCopertine.has("A.epub") && s.misureCopertine.size === 1);

  // ---- l'attesa si ricorda ------------------------------------------------------
  const mem = new Map();
  const st = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  segnaInAttesa("A", true, st);
  segnaInAttesa("B", true, st);
  segnaInAttesa("A", false, st);
  t.eq("messa e tolta", [...copertineInAttesa(st)].join(), "B");
  st.setItem("bc_cov_attesa", "{rotto");
  t.eq("uno storage rotto vale nessuna", copertineInAttesa(st).size, 0);
}
