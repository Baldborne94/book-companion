// GLI ALTRI LIBRI DEGLI AUTORI CHE SEGUI (`lib/altriDellAutore.js`): quel
// che l'autore ha scritto e tu non hai, dal piu' nuovo, senza omonimi,
// raccolte e doppioni, e quel che e' gia' in «Da prendere» segnato.
import { altriLibri, opereDi, domandaOpere, SCADENZA } from "../src/lib/altriDellAutore.js";
import { idTitolo } from "../src/lib/daPrendere.js";

const memoria = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m };
};

export default async function (t) {
  const abnett = ["OL1A"];
  const docs = [
    { title: "Horus Rising", author_key: abnett, first_publish_year: 2006, cover_i: 11 },
    { title: "First and Only (Gaunt's Ghosts Book 1)", author_key: abnett, first_publish_year: 1999 },
    { title: "Xenos", author_key: abnett, first_publish_year: 2001 },
    { title: "Xenos", author_key: abnett, first_publish_year: 2002 },
    { title: "The Gaunt's Ghosts Omnibus", author_key: abnett, first_publish_year: 2004 },
    { title: "Hive", author_key: abnett, first_publish_year: 2026 },
    { title: "Pigs and How to Raise Them", author_key: ["OL9Z"], first_publish_year: 1950 },
  ];
  const books = [{ id: "b1", title: "Horus Rising", author: "Dan Abnett" }];
  const lista = [{ id: idTitolo("Xenos", "Dan Abnett"), titolo: "Xenos", autore: "Dan Abnett" }];
  const altri = altriLibri("Dan Abnett", docs, books, lista);
  t.eq("i libri che non hai, dal piu' nuovo, senza l'omonimo, la raccolta e il doppione (vince la prima opera del catalogo, la piu' stampata)", altri.map((x) => `${x.titolo}:${x.anno}`).join("|"), "Hive:2026|Xenos:2001|First and Only:1999");
  t.c("…quel che e' gia' in «Da prendere» e' segnato, il resto no", altri.find((x) => x.titolo === "Xenos").gia === true && altri.find((x) => x.titolo === "Hive").gia === false);
  t.eq("…l'id e' quello della lista «Da prendere»", altri[0].id, idTitolo("Hive", "Dan Abnett"));
  t.eq("…e la copertina e' il numero del catalogo", altriLibri("Dan Abnett", docs, [], []).find((x) => x.titolo === "Horus Rising").copertina, 11);
  t.eq("una lapide in «Da prendere» non conta come gia' messo", altriLibri("Dan Abnett", docs, books, [{ ...lista[0], deleted: true }]).find((x) => x.titolo === "Xenos").gia, false);
  t.c("la domanda al catalogo: l'autore, le opere piu' stampate", /author=Dan\+Abnett/.test(domandaOpere("Dan Abnett")) && /sort=editions/.test(domandaOpere("Dan Abnett")));

  // la memoria: una domanda a settimana per autore
  const st = memoria();
  let chieste = 0;
  const prendi = async () => {
    chieste += 1;
    return { docs, numFound: docs.length };
  };
  await opereDi("Dan Abnett", prendi, { st, ora: 1000 });
  const ancora = await opereDi("Dan Abnett", prendi, { st, ora: 1000 + SCADENZA - 1 });
  t.c("dentro la settimana si risponde dalla memoria, con quel che serve a disegnare", chieste === 1 && ancora.length === docs.length && ancora[0].title === "Horus Rising" && !("numFound" in ancora[0]));
  await opereDi("Dan Abnett", prendi, { st, ora: 1000 + SCADENZA + 1 });
  t.eq("…dopo si richiede", chieste, 2);
  let rotto = false;
  try {
    await opereDi("Graham McNeill", async () => {
      throw new Error("rete");
    }, { st });
  } catch {
    rotto = true;
  }
  t.c("un intoppo di rete sale a chi chiede, e non si ricorda niente", rotto && !JSON.parse(st.getItem("bc_altri_autore"))["graham mcneill"]);
}
