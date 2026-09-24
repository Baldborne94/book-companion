// I CONSIGLI DELL'ORACOLO. Quel che sbaglia in silenzio: un libro che hai
// gia' riproposto come nuovo, uno scartato che torna, un titolo inventato
// senza nessun segno, una risposta monca letta come «nessun consiglio», una
// rete caduta scambiata per «non esiste».
import {
  richiestaConsigli,
  leggiConsigli,
  daMostrare,
  nelCatalogo,
  verificaTutti,
  chiediConsigli,
  rigaLibro,
  MAX_LIBRI,
  TETTO_CONSIGLI,
} from "../src/lib/consigli.js";
import { idTitolo, scarta, tieni } from "../src/lib/daPrendere.js";

const libro = (id, title, extra = {}) => ({ id, title, ...extra });
const stati = (m) => (id) => m[id] || "unread";

const risposta = (o) => "Ecco:\n```json\n" + JSON.stringify(o) + "\n```";

export default async function (t) {
  // ---- la domanda ---------------------------------------------------------------
  t.eq(
    "una riga dice titolo, autore, saga col numero, stato e voto",
    rigaLibro(libro("a", "The Blade Itself", { author: "Joe Abercrombie", saga: "First Law", sagaOrder: 1, rating: 4.5, fav: true }), "read"),
    "- The Blade Itself — Joe Abercrombie [First Law n° 1] (letto, voto 4.5/5, preferito)"
  );
  t.eq("un libro mai aperto e senza voto non ha parentesi", rigaLibro(libro("a", "X"), "unread"), "- X");
  t.eq("l'abbandono si dice: dice cosa evitare", rigaLibro(libro("a", "X"), "abandoned"), "- X (abbandonato)");
  let q = richiestaConsigli([libro("a", "Uno", { author: "A" }), libro("b", "Due")], { statusOf: stati({ a: "read" }) });
  t.c("i libri entrano nella domanda", q.user.includes("- Uno — A (letto)") && q.user.includes("- Due"));
  t.c("le tre sezioni sono chieste per nome", ["\"saghe\"", "\"autori\"", "\"gusti\""].every((k) => q.user.includes(k)));
  t.c("si chiede di non riproporre quel che c'e'", /gia' nella biblioteca/.test(q.system));
  // oltre il tetto passano prima i libri che dicono qualcosa dei gusti
  const tanti = Array.from({ length: MAX_LIBRI + 5 }, (_, i) => libro(`m${i}`, `Mai ${i}`));
  q = richiestaConsigli([...tanti, libro("v", "Votato", { rating: 5 })], { statusOf: stati({}) });
  t.eq("oltre il tetto la domanda resta al tetto", q.libri, MAX_LIBRI);
  t.c("… e il libro votato ci sta anche se arriva per ultimo", q.user.includes("- Votato (voto 5/5)"));
  t.c("… e il conto dice quanti ne vede", q.user.includes(`qui ne vedi ${MAX_LIBRI}`));
  t.c("senza titolo un libro non entra", !richiestaConsigli([{ id: "z" }], { statusOf: stati({}) }).user.includes("- ?"));

  // ---- la risposta ----------------------------------------------------------------
  let c = leggiConsigli(
    risposta({
      saghe: [{ titolo: " Before They Are Hanged ", autore: "Joe Abercrombie", saga: "First Law", numero: 2, perche: "dopo «The Blade Itself»" }],
      autori: [{ titolo: "", autore: "X" }, { titolo: "Red Country", autore: "Joe Abercrombie", numero: "boh" }],
      gusti: [{ titolo: "Tigana", autore: "Guy Gavriel Kay", saga: null, numero: null }],
    })
  );
  t.eq("il JSON si legge anche dentro un recinto di codice", c?.saghe[0]?.titolo, "Before They Are Hanged");
  t.eq("… col numero", c.saghe[0].numero, 2);
  t.eq("… e l'id della lista", c.saghe[0].id, idTitolo("Before They Are Hanged", "Joe Abercrombie"));
  t.eq("una voce senza titolo non e' una voce", c.autori.length, 1);
  t.eq("un numero che non e' un numero diventa null", c.autori[0].numero, null);
  t.eq("una saga null resta vuota, non «null»", c.gusti[0].saga, "");
  t.eq("una risposta illeggibile e' null", leggiConsigli("{ saghe: [ "), null);
  t.eq("… anche senza graffe", leggiConsigli("non so"), null);
  t.eq("tre elenchi vuoti non sono consigli", leggiConsigli(risposta({ saghe: [], autori: [], gusti: [] })), null);
  t.eq("una sezione mancante vale vuota", leggiConsigli(risposta({ gusti: [{ titolo: "Tigana" }] })).saghe.length, 0);

  // ---- quel che si mostra -----------------------------------------------------------
  const voce = (titolo, autore = "") => ({ id: idTitolo(titolo, autore), titolo, autore });
  const cons = {
    saghe: [voce("Before They Are Hanged", "Joe Abercrombie")],
    autori: [voce("Before They Are Hanged", "Joe Abercrombie"), voce("Red Country", "Joe Abercrombie")],
    gusti: [voce("Tigana", "Guy Gavriel Kay"), voce("Il nome della rosa", "Umberto Eco")],
  };
  let m = daMostrare(cons, [], []);
  t.eq("il doppione fra due sezioni sta nella prima", m.find((s) => s.chiave === "autori").voci.map((v) => v.titolo).join(","), "Red Country");
  m = daMostrare(cons, [libro("x", "Tigana", { author: "Kay, Guy Gavriel" })], []);
  t.eq("quel che hai gia' (altra edizione) non si propone", m.find((s) => s.chiave === "gusti").voci.map((v) => v.titolo).join(","), "Il nome della rosa");
  m = daMostrare(cons, [], scarta([], idTitolo("Il nome della rosa", "Umberto Eco")));
  t.eq("uno scartato non torna", m.find((s) => s.chiave === "gusti").voci.length, 1);
  m = daMostrare(cons, [], tieni([], cons.saghe[0]));
  t.eq("uno tenuto sta nella lista, non nei consigli", m.some((s) => s.chiave === "saghe"), false);
  t.eq("una sezione svuotata non si mostra", m.map((s) => s.chiave).join(","), "autori,gusti");
  t.eq("niente consigli, niente sezioni", daMostrare(null, [], []).length, 0);

  // ---- il catalogo ------------------------------------------------------------------
  const url = [];
  const catalogo = (docs, ok = true) => async (u) => {
    url.push(u);
    return { ok, status: ok ? 200 : 503, json: async () => ({ docs }) };
  };
  t.eq(
    "c'e' nel catalogo",
    await nelCatalogo({ titolo: "Red Country", autore: "Joe Abercrombie" }, catalogo([{ key: "/w/1", title: "Red Country", author_name: ["Joe Abercrombie"] }])),
    true
  );
  t.c("… chiesto con titolo e autore", url[0].includes("title=Red+Country") && url[0].includes("author=Joe+Abercrombie"));
  t.eq(
    "un titolo inventato non c'e'",
    await nelCatalogo({ titolo: "The Blade Returns", autore: "Joe Abercrombie" }, catalogo([{ key: "/w/1", title: "The Blade Itself" }])),
    false
  );
  let esploso = false;
  try {
    await nelCatalogo({ titolo: "X" }, catalogo([], false));
  } catch {
    esploso = true;
  }
  t.c("un catalogo che non risponde ESPLODE: non e' «non esiste»", esploso);

  const daVerificare = { saghe: [voce("A")], autori: [voce("B")], gusti: [voce("C"), voce("D")] };
  const passi = [];
  await verificaTutti(daVerificare, {
    controlla: async (v) => {
      if (v.titolo === "C") throw new Error("rete");
      return v.titolo !== "B";
    },
    onProgress: (a, b) => passi.push(`${a}/${b}`),
  });
  t.eq("verificato", daVerificare.saghe[0].verificato, true);
  t.eq("non trovato", daVerificare.autori[0].verificato, false);
  t.eq("rete caduta: nessun segno", "verificato" in daVerificare.gusti[0], false);
  t.eq("… e un guasto non ferma gli altri", daVerificare.gusti[1].verificato, true);
  t.eq("l'avanzamento arriva in fondo", passi.at(-1), "4/4");

  // ---- il giro intero -----------------------------------------------------------------
  let chiesto = null;
  let g = await chiediConsigli([libro("a", "Uno")], {
    statusOf: stati({}),
    chiedi: async (r) => {
      chiesto = r;
      return { answer: risposta({ gusti: [{ titolo: "Tigana", autore: "Kay" }] }), uso: { dentro: 10 } };
    },
    controlla: async () => true,
  });
  t.eq("il giro torna i consigli verificati", g.consigli?.gusti[0].verificato, true);
  t.eq("… con la spesa", g.uso?.dentro, 10);
  t.eq("… col tetto dei consigli", chiesto.tetto, TETTO_CONSIGLI);
  g = await chiediConsigli([], { statusOf: stati({}), chiedi: async () => ({ error: "tetto" }), controlla: async () => true });
  t.eq("un errore dell'Oracolo passa com'e'", g.error, "tetto");
  g = await chiediConsigli([], { statusOf: stati({}), chiedi: async () => ({ answer: "{ \"saghe\": [", tagliata: true }), controlla: async () => true });
  t.eq("una risposta troncata si dice troncata", g.error, "tagliata");
  g = await chiediConsigli([], { statusOf: stati({}), chiedi: async () => ({ answer: "boh" }), controlla: async () => true });
  t.eq("… e una illeggibile, illeggibile", g.error, "illeggibile");
}
