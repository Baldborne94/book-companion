// NELLO STILE DEI TUOI AUTORI. Quel che sbaglia in silenzio: una domanda
// con una condizione sola (escono i classici piu' letti del mondo), un
// argomento di una sola saga preso per stile, un autore di un altro genere,
// un classico dell'Ottocento, un seguito, e lo stesso autore proposto due
// volte fra stile e gusti.
import {
  improntaDi,
  famiglieDi,
  distintivo,
  domandeStile,
  autoriPreferiti,
  autoreDelCatalogo,
  candidatiStile,
  vocePerStile,
  consigliDalCatalogo,
  ANNO_MIN,
  MAX_STILE,
} from "../src/lib/consigliLiberi.js";

const libro = (id, title, author, extra = {}) => ({ id, title, author, ...extra });

export default async function (t) {
  // ---- l'impronta ---------------------------------------------------------------
  const pratchett = [
    "Fiction",
    "Discworld (Imaginary place)",
    "Fiction, fantasy, general",
    "series:Discworld",
    "Fantasy",
    "Fiction, humorous",
    "English literature",
    "Fantasy fiction",
    "Rincewind (Fictitious character)",
  ];
  t.eq(
    "via il generico, la saga, il luogo e il personaggio",
    improntaDi(pratchett).map((x) => x.nome).join("|"),
    "Fantasy|Fiction, humorous|Fantasy fiction"
  );
  t.eq(
    "due cataloghi, la stessa voce: una volta sola",
    improntaDi(["FICTION / Fantasy / Epic", "Fiction, fantasy, epic"]).length,
    1
  );
  t.eq("i generi, dal piu' frequente", famiglieDi(pratchett).join(","), "fantasy,humorous");
  t.eq("… non dal primo incontrato", famiglieDi(["Fiction, humorous", "Fantasy", "Fantasy fiction"]).join(","), "fantasy,humorous");
  t.eq("… anche dentro gli argomenti generici", famiglieDi(["Fiction, science fiction, general"]).join(","), "science fiction");
  t.c("«Fantasy fiction» non distingue niente", !distintivo({ k: "fantasy fiction" }));
  t.c("… nemmeno «Fiction, humorous»", !distintivo({ k: "fiction, humorous" }));
  t.c("«epic» si'", distintivo({ k: "fiction, fantasy, epic" }));
  t.c("… e «Kings and rulers»", distintivo({ k: "kings and rulers" }));

  // ---- le domande ---------------------------------------------------------------
  const lynch = improntaDi(["Fiction, fantasy, general", "Swindlers and swindling", "Hiking", "Economic conditions"]);
  const dLynch = domandeStile(lynch, ["fantasy"]);
  t.c("ogni domanda ha DUE condizioni", dLynch.length > 0 && dLynch.every((d) => / AND /.test(d.q)));
  t.eq("il genere con l'argomento piu' frequente, per primo", dLynch[0].q, 'subject:"fantasy" AND subject:"Swindlers and swindling"');
  t.eq("… al massimo due argomenti", dLynch.length, 2);
  t.eq("… e il perche' e' la coppia", dLynch[0].perche.join("+"), "fantasy+Swindlers and swindling");
  const dPratchett = domandeStile(improntaDi(pratchett), famiglieDi(pratchett));
  t.eq("senza distintivi: i due generi insieme", dPratchett.map((d) => d.q).join(" | "), 'subject:"fantasy" AND subject:"humorous"');
  const dBakker = domandeStile(improntaDi(["Imaginary wars and battles", "Fantasy fiction"]), ["fantasy", "science fiction"]);
  t.eq("la coppia dei generi va in CODA", dBakker.at(-1).q, 'subject:"fantasy" AND subject:"science fiction"');
  t.eq("… dopo l'argomento distintivo", dBakker[0].q, 'subject:"fantasy" AND subject:"Imaginary wars and battles"');
  t.eq("senza genere: due distintivi insieme", domandeStile(improntaDi(["Assassins", "Dragons"]), [])[0]?.q, 'subject:"Assassins" AND subject:"Dragons"');
  t.eq("… uno solo non basta", domandeStile(improntaDi(["Assassins"]), []).length, 0);
  t.eq("impronta vuota: nessuna domanda", domandeStile([], ["fantasy"]).length, 0);

  // ---- i tuoi autori ------------------------------------------------------------
  const casa = [
    libro("1", "The Blade Itself", "Joe Abercrombie", { rating: 4 }),
    libro("2", "Best Served Cold", "Abercrombie, Joe", { rating: 4 }),
    libro("3", "Guards! Guards!", "Terry Pratchett", { fav: true, rating: 5 }),
    libro("4", "Lasciato", "Uno Qualunque", { rating: 1 }),
    libro("5", "Mai aperto", "Nessuno"),
    libro("6", "Letto e basta", "Tizio Letto"),
  ];
  const stato = (id) => ({ 4: "abandoned", 6: "read" })[id] || "unread";
  const pref = autoriPreferiti(casa, { statusOf: stato });
  t.eq("prima chi ami di piu', le grafie dell'autore sommate", pref.map((p) => p.autore).join("|"), "Terry Pratchett|Joe Abercrombie|Tizio Letto");
  t.c("chi hai abbandonato o mai aperto non e' un preferito", !pref.some((p) => /Qualunque|Nessuno/.test(p.autore)));
  t.eq("… e c'e' un tetto", autoriPreferiti(casa, { statusOf: stato, max: 1 }).length, 1);
  t.c("il tetto di partenza e' quello dichiarato", MAX_STILE >= 1);

  const omonimi = [
    { name: "Glen Cook", work_count: 1, top_subjects: ["Pigs"] },
    { name: "Glen Cook", work_count: 108, top_subjects: ["dark fantasy"] },
    { name: "Glenn Cooke", work_count: 900, top_subjects: ["Cooking"] },
  ];
  t.eq("fra gli omonimi, chi ha scritto di piu'", autoreDelCatalogo(omonimi, "Glen Cook")?.work_count, 108);
  t.eq("… mai un nome diverso", autoreDelCatalogo([omonimi[2]], "Glen Cook"), null);

  // ---- i candidati --------------------------------------------------------------
  const d = (title, autore, anno, extra = {}) => ({ title, author_name: [autore], first_publish_year: anno, ...extra });
  const docs = [
    d("Hope and Red", "Jon Skovron", 2016, { perche: ["fantasy", "Swindlers"] }),
    d("Hope and Red", "Jon Skovron", 2016),
    d("Blood and Tears", "Jon Skovron", 2018),
    d("Moby Dick", "Herman Melville", 1851),
    d("The Republic of Thieves", "Scott Lynch", 2013),
    d("Dragons Wild", "Robert Asprin", 2008),
    d("Dragons Wild 2", "Robert Asprin", 2001),
    d("Harry Potter", "J. K. Rowling", 1997, { subject: ["Juvenile fiction"] }),
    d("The Well of Ascension (Mistborn, #2)", "Brandon Sanderson", 2007),
    d("Collected Tales / More Tales", "Neil Gaiman", 2001),
    d("Abercrombie tace", "Joe Abercrombie", 2010),
    d("Senza anno", "Anonimo Nuovo"),
  ];
  const cs = candidatiStile(docs, [libro("x", "Red Seas Under Red Skies", "Scott Lynch")], {
    escludi: new Set(["abercrombie joe"]),
  });
  const nomi = cs.map((c) => c.autore).join("|");
  t.eq("uno per autore, nell'ordine dei piu' letti", nomi, "Jon Skovron|Robert Asprin|Anonimo Nuovo");
  t.c("non un autore che hai gia'", !/Lynch/.test(nomi));
  t.c("… ne' uno escluso", !/Abercrombie/.test(nomi));
  t.c(`… ne' un classico prima del ${ANNO_MIN}`, !/Melville/.test(nomi));
  t.c("… ne' un libro per ragazzi, un seguito o una raccolta", !/Rowling|Sanderson|Gaiman/.test(nomi));
  t.eq("di ognuno il libro piu' vecchio", cs[1].libro.titolo, "Dragons Wild 2");
  t.eq("… e il perche' della domanda che l'ha trovato", cs[0].perche.join("+"), "fantasy+Swindlers");
  t.eq("un tetto ai candidati", candidatiStile(docs, [], { max: 2 }).length, 2);
  const v = vocePerStile(cs[0], "Scott Lynch");
  t.eq("la voce dice da chi viene e perche'", v.perche, "Se ti piace Scott Lynch · fantasy e swindlers");
  t.eq("… senza perche' dice solo da chi", vocePerStile({ ...cs[0], perche: [] }, "Scott Lynch").perche, "Se ti piace Scott Lynch");

  // ---- il giro -----------------------------------------------------------------
  const autori = {
    "Scott Lynch": ["Fiction, fantasy, general", "Swindlers and swindling"],
    "Joe Abercrombie": ["Fiction, fantasy, general", "Kings and rulers"],
    "Jon Skovron": ["Fantasy", "Young adult"],
    "Robert Asprin": ["Fiction, fantasy, humorous"],
    "Lee Child": ["Fiction, thrillers, suspense"],
    "Sequel Man": ["Fantasy"],
  };
  const urls = [];
  const fetcher = async (u) => {
    urls.push(u);
    const url = new URL(u);
    const q = url.searchParams;
    let docs = [];
    if (url.pathname.endsWith("/authors.json")) {
      const n = q.get("q");
      docs = autori[n] ? [{ name: n, work_count: 10, top_subjects: autori[n] }] : [];
    } else if (q.get("title") === "The Lies of Locke Lamora") {
      docs = [{ key: "/w/1", title: "The Lies of Locke Lamora", author_name: ["Scott Lynch"], subject: ["Fantasy"] }];
    } else if (q.get("q") === 'subject:"Fantasy"') {
      // i gusti: Skovron c'e' anche qui, e non deve comparire due volte
      docs = [
        { ...d("Hope and Red", "Jon Skovron", 2016), ratings_count: 99, ratings_average: 4, subject: ["Fantasy"] },
        { ...d("Un Altro", "Altro Autore", 2015), ratings_count: 99, ratings_average: 4, subject: ["Fantasy"] },
      ];
    } else if (/Kings and rulers/.test(q.get("q") || "")) {
      docs = [d("Hope and Red", "Jon Skovron", 2016)];
    } else if (/Swindlers/.test(q.get("q") || "")) {
      docs = [
        d("Hope and Red", "Jon Skovron", 2016),
        d("Killing Floor", "Lee Child", 1997),
        d("The Second One", "Sequel Man", 2012),
        d("Dragons Wild", "Robert Asprin", 2008),
      ];
    }
    return { ok: true, json: async () => ({ docs }) };
  };
  const sagaDi = async ({ title }) => (title === "The Second One" ? { saga: "Altra", sagaOrder: 2 } : null);
  const biblio = [
    libro("1", "The Lies of Locke Lamora", "Scott Lynch", { fav: true, rating: 5 }),
    libro("2", "The Blade Itself", "Joe Abercrombie", { rating: 4 }),
  ];
  const g = await consigliDalCatalogo(biblio, { statusOf: () => "read", fetcher, sagaDi });
  t.eq("il giro: lo stile di Lynch", g.consigli?.stile.map((x) => x.autore).join("|"), "Jon Skovron|Robert Asprin");
  t.eq("… lo stesso autore trovato da due preferiti compare una volta", g.consigli.stile.filter((x) => x.autore === "Jon Skovron").length, 1);
  t.eq("fra i gusti non torna chi e' gia' nello stile", g.consigli.gusti.map((x) => x.autore).join("|"), "Altro Autore");
  t.c("… un thriller non e' nello stile di un fantasy", !g.consigli.stile.some((x) => x.autore === "Lee Child"));
  t.c("… un seguito se ne va", !g.consigli.stile.some((x) => x.autore === "Sequel Man"));
  t.eq("… col perche'", g.consigli.stile[0].perche, "Se ti piace Scott Lynch · fantasy e swindlers and swindling");
  t.c(
    "le domande dello stile hanno due condizioni",
    urls.filter((u) => /sort=readinglog/.test(u)).every((u) => / AND /.test(new URL(u).searchParams.get("q")))
  );
  t.eq(
    "l'impronta di ogni autore si chiede una volta sola",
    urls.filter((u) => /authors\.json/.test(u) && new URL(u).searchParams.get("q") === "Jon Skovron").length,
    1
  );
  t.c("la copertina si chiede anche qui", urls.filter((u) => /sort=readinglog/.test(u)).every((u) => /cover_i/.test(u)));
}
