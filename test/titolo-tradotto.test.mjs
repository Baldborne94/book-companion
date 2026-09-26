// UN TITOLO TRADOTTO E' LO STESSO LIBRO. «I giardini della luna» sul tuo
// scaffale e «Gardens of the Moon» fra i consigli sono un volume solo, e da
// un titolo solo non si puo' sapere. Le strade sono due: lo stesso posto
// nella stessa saga (che la lingua non la guarda) e il titolo italiano che
// il catalogo conosce per la stessa opera. Sbagliare qui fa sparire un
// consiglio buono, quindi le guardie contano quanto il caso.

import { giaInCasa, stessoPosto } from "../src/lib/importBook.js";
import { daMostrare } from "../src/lib/consigli.js";
import { titoliTradotti, consigliDalCatalogo } from "../src/lib/consigliLiberi.js";

const libro = (id, title, author, extra = {}) => ({ id, title, author, ...extra });

export default async (t) => {
  // ---- lo stesso posto ------------------------------------------------------
  const casa = [
    libro("1", "I giardini della luna", "Steven Erikson", { saga: "The Malazan Book of the Fallen", sagaOrder: 1 }),
    libro("2", "La dimora fantasma", "Steven Erikson", { saga: "The Malazan Book of the Fallen", sagaOrder: 2.5 }),
  ];
  const voce = { title: "Gardens of the Moon", author: "Steven Erikson", saga: "Malazan Book of the Fallen", numero: 1 };
  t.c("stesso numero nella stessa saga: e' tuo, anche tradotto", stessoPosto(voce, casa));
  t.c("… e giaInCasa lo dice", giaInCasa(voce, casa));
  t.c("… il titolo da solo non bastava (senza saga non si riconosce)", !giaInCasa({ title: voce.title, author: voce.author }, casa));
  t.c("un decimale combacia col suo decimale", stessoPosto({ ...voce, numero: 2.5 }, casa));
  t.c("un altro numero no", !stessoPosto({ ...voce, numero: 3 }, casa));
  t.c("un'altra saga no", !stessoPosto({ ...voce, saga: "Kharkanas" }, casa));
  t.c("senza saga no", !stessoPosto({ ...voce, saga: "" }, casa));
  t.c("senza numero no", !stessoPosto({ ...voce, numero: null }, casa));
  t.c("numero zero no (e' il «non lo so» di Calibre)", !stessoPosto({ ...voce, numero: 0 }, casa));
  t.c("un numero che non e' un numero no", !stessoPosto({ ...voce, numero: "abc" }, casa));
  t.c("un autore diverso e' una smentita", !stessoPosto({ ...voce, author: "Ian C. Esslemont" }, casa));
  t.c("un autore mancante no", stessoPosto({ ...voce, author: "" }, casa));
  t.c(
    "… e nemmeno manca in casa",
    stessoPosto(voce, [libro("x", "I giardini della luna", "", { saga: "Malazan Book of the Fallen", sagaOrder: 1 })])
  );
  t.c("un libro di casa senza numero non occupa nessun posto", !stessoPosto(voce, [libro("x", "I giardini della luna", "Steven Erikson", { saga: "Malazan Book of the Fallen" })]));

  t.c(
    "i volumi senza numero non fanno «numeri mescolati» fra loro",
    stessoPosto(voce, [
      ...casa,
      libro("n1", "Un racconto", "Steven Erikson", { saga: "Malazan Book of the Fallen", sagaOrder: null }),
      libro("n2", "Un altro racconto", "Steven Erikson", { saga: "Malazan Book of the Fallen", sagaOrder: "" }),
    ])
  );

  // dove un numero porta due titoli diversi, i numeri non sono una fila
  // sola (il Cosmoverse numera due storie da uno) e si tace
  const cosmo = [
    libro("m", "Mistborn", "Brandon Sanderson", { saga: "Cosmere", sagaOrder: 1 }),
    libro("s", "La via dei re", "Brandon Sanderson", { saga: "Cosmere", sagaOrder: 1 }),
    libro("m2", "Il pozzo dell'ascensione", "Brandon Sanderson", { saga: "Cosmere", sagaOrder: 2 }),
  ];
  t.c("numeri mescolati: il posto non dice piu' quale libro", !stessoPosto({ title: "Words of Radiance", author: "Brandon Sanderson", saga: "Cosmere", numero: 2 }, cosmo));
  t.c(
    "… ma due copie dello stesso titolo non sono una seconda storia",
    stessoPosto({ title: "Gardens of the Moon", author: "Steven Erikson", saga: "Malazan", numero: 1 }, [
      libro("a", "I giardini della luna", "Steven Erikson", { saga: "Malazan", sagaOrder: 1 }),
      libro("b", "I giardini della luna", "Steven Erikson", { saga: "Malazan", sagaOrder: 1 }),
    ])
  );

  // ---- il titolo che il catalogo conosce -------------------------------------
  const rothfuss = [libro("r", "Il nome del vento", "Patrick Rothfuss")];
  t.c("col titolo italiano accanto: e' tuo", giaInCasa({ title: "The Name of the Wind", author: "Patrick Rothfuss", altri: ["Il nome del vento"] }, rothfuss));
  t.c("… senza, no", !giaInCasa({ title: "The Name of the Wind", author: "Patrick Rothfuss" }, rothfuss));
  t.c("… e un titolo accanto vale solo per lo stesso autore", !giaInCasa({ title: "X", author: "Qualcun altro", altri: ["Il nome del vento"] }, rothfuss));
  t.c("un elenco storto non esplode", !giaInCasa({ title: "The Name of the Wind", author: "Patrick Rothfuss", altri: "Il nome del vento" }, rothfuss));

  const doc = (title, editions) => ({ title, editions: { docs: editions } });
  t.eq("vale l'edizione italiana", titoliTradotti(doc("The Name of the Wind", [{ title: "Il nome del vento", language: ["ita"] }])).join("|"), "Il nome del vento");
  t.eq("un'altra lingua no (con lang=it il catalogo ne mette una qualunque se l'italiana non c'e')", titoliTradotti(doc("The Way of Kings", [{ title: "Der Weg der Könige", language: ["ger"] }])).length, 0);
  t.eq("senza lingua dichiarata no", titoliTradotti(doc("Mistborn", [{ title: "Primeira Era" }])).length, 0);
  t.eq("lo stesso titolo non e' una traduzione", titoliTradotti(doc("Rogues", [{ title: "rogues", language: ["ita"] }])).length, 0);
  t.eq("niente edizioni: niente", titoliTradotti({ title: "X" }).length, 0);
  t.eq("un titolo che non e' una stringa si salta", titoliTradotti(doc("X", [{ title: 5, language: ["ita"] }])).length, 0);

  // ---- dove si decide: al disegno ---------------------------------------------
  const consigli = {
    saghe: [
      { id: "a", titolo: "Gardens of the Moon", autore: "Steven Erikson", saga: "Malazan Book of the Fallen", numero: 1 },
      { id: "b", titolo: "Memories of Ice", autore: "Steven Erikson", saga: "Malazan Book of the Fallen", numero: 3 },
      { id: "c", titolo: "The Name of the Wind", autore: "Patrick Rothfuss", saga: "", numero: null, altri: ["Il nome del vento"] },
    ],
  };
  const visti = daMostrare(consigli, [...casa, ...rothfuss]).flatMap((s) => s.voci.map((v) => v.titolo));
  t.eq("al disegno restano solo quelli che non hai, in qualunque lingua", visti.join(","), "Memories of Ice");

  // ---- il giro: l'edizione italiana si chiede nella domanda che c'e' gia' -----
  const urls = [];
  const g = await consigliDalCatalogo([libro("1", "Gardens of the Moon", "Steven Erikson", { saga: "Malazan", sagaOrder: 1 })], {
    statusOf: () => "read",
    sagaDi: async ({ title }) => ({ "Deadhouse Gates": { saga: "Malazan", sagaOrder: 2 } })[title] || null,
    fetcher: async (u) => {
      urls.push(u);
      const q = new URL(u).searchParams;
      const docs =
        q.get("author") === "Steven Erikson" && q.get("sort") === "editions"
          ? [
              { title: "Gardens of the Moon", first_publish_year: 1999, author_key: ["OL1A"] },
              { title: "Deadhouse Gates", first_publish_year: 2000, author_key: ["OL1A"], editions: { docs: [{ title: "La dimora fantasma", language: ["ita"] }] } },
            ]
          : [];
      return { ok: true, json: async () => ({ docs }) };
    },
  });
  t.eq("la voce porta il titolo italiano", g.consigli?.saghe?.[0]?.altri?.join("|"), "La dimora fantasma");
  const opere = urls.map((u) => new URL(u).searchParams).find((q) => q.get("sort") === "editions");
  t.c("… chiesto nella domanda delle opere, non in una in piu'", opere.get("fields").split(",").includes("editions.title") && opere.get("fields").split(",").includes("editions.language"));
  t.eq("… con l'italiano in testa", opere.get("lang"), "it");
};
