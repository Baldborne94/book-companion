// LE COPERTINE DI UNA SERIE DAL CATALOGO (`lib/copertineSerie.js`), chiesto
// dal lettore con la foto della raccolta di Monster: «per Monster riesci a
// recuperarmi le copertine?». Le schede come le sue (il nome del file della
// scansione, il numero nella saga); il catalogo e' la risposta vera.
import { numeroNelTitolo, copertinePerVolume, autoreDellaRaccolta, domandaSerie, cercaCopertineSerie, scaricaCopertina, sceltePerCopertina, cercaCopertinaDelLibro } from "../src/lib/copertineSerie.js";
import catalogo from "./monster-catalogo.mjs";

const libri = Array.from({ length: 18 }, (_, i) => ({
  id: `m${i + 1}`,
  title: i ? `Monster - Volume_${String(i + 1).padStart(2, "0")}_[Mangascreener]` : "Monster v01",
  saga: "Monster",
  sagaOrder: i + 1,
}));

export default async (t) => {
  // ---- IL NUMERO NEL TITOLO ------------------------------------------------------
  t.eq("«Vol. 2»", numeroNelTitolo("Naoki Urasawa's Monster, Vol. 2", "Monster"), 2);
  t.eq("il numero in coda", numeroNelTitolo("Monster 11", "Monster"), 11);
  t.eq("«#13» dentro le parentesi", numeroNelTitolo("浦沢直樹モンスター13をプレゼンツ (Naoki Urasawa's Monster, #13)", "Monster"), 13);
  t.eq("un'altra parola non e' il nome: Monsters", numeroNelTitolo("My Favorite Thing Is Monsters, vol 1", "Monster"), null);
  t.eq("l'edizione grande non e' il volume", numeroNelTitolo("Monster Kanzenban nº 02/09", "Monster"), null);
  t.eq("…ne' la Deluxe", numeroNelTitolo("Berserk Deluxe Edition Volume 1", "Berserk"), null);
  t.eq("«02/09» non e' il 2", numeroNelTitolo("Monster nº 02/09", "Monster"), null);
  t.eq("senza numero niente", numeroNelTitolo("Another Monster", "Monster"), null);
  t.eq("«02 / 09» nemmeno", numeroNelTitolo("Monster nº 02 / 09", "Monster"), null);
  t.eq("…né «2 of 9»", numeroNelTitolo("Monster Book 2 of 9", "Monster"), null);
  t.eq("un numero di tre cifre non prende la quarta", numeroNelTitolo("Monster, Vol. 2009", "Monster"), null);
  t.eq("senza nome niente", numeroNelTitolo("Monster, Vol. 2", ""), null);

  // ---- LA RACCOLTA DEL LETTORE, CON LA RISPOSTA VERA ---------------------------
  const { proposte, mancano } = copertinePerVolume(catalogo, { nome: "Monster", libri });
  t.eq("tutti e diciotto", proposte.length, 18);
  t.c("tutti dell'edizione di Viz", proposte.every((p) => p.titolo === `Naoki Urasawa's Monster, Vol. ${p.numero}`), proposte.map((p) => p.titolo).join(" | "));
  t.eq("ognuno al suo volume", proposte.map((p) => `${p.numero}:${p.libro.id}`).slice(0, 3).join(), "1:m1,2:m2,3:m3");
  t.eq("la copertina del 2", proposte.find((p) => p.numero === 2).copertina, 764859);
  t.eq("niente manca", mancano.length, 0);

  // un volume che l'edizione di Viz non ha si prende da un'altra forma: il 13
  // dell'edizione di Shogakukan (vero, dalla domanda «naoki urasawa monster»)
  const giapponese = { title: "浦沢直樹モンスター13をプレゼンツ (Naoki Urasawa's Monster, #13)", author_name: ["Naoki Urasawa"], cover_i: 8433129 };
  const senza13 = [...catalogo.filter((d) => d.title !== "Naoki Urasawa's Monster, Vol. 13"), giapponese];
  const p13 = copertinePerVolume(senza13, { nome: "Monster", libri }).proposte.find((p) => p.numero === 13);
  t.eq("…il 13 giapponese, se Viz non c'e'", p13?.copertina, 8433129);
  // e la forma che copre di piu' vince sugli altri: col giapponese in testa
  const giapponeseInTesta = [giapponese, ...catalogo];
  t.eq("…ma c'e' Viz, vince Viz anche se il catalogo mette prima l'altro", copertinePerVolume(giapponeseInTesta, { nome: "Monster", libri }).proposte.find((p) => p.numero === 13).copertina, 2806209);
  const oltre = copertinePerVolume(catalogo, { nome: "Monster", libri: [...libri, { id: "m19", saga: "Monster", sagaOrder: 19 }, { id: "x", saga: "Monster", sagaOrder: 2.5 }, { id: "y", saga: "Monster" }] });
  t.eq("un volume che il catalogo non ha si dice", oltre.mancano.join(), "19");
  t.c("una storia di mezzo o un volume senza numero non si cercano", !oltre.proposte.some((p) => ["x", "y"].includes(p.libro.id)) && oltre.mancano.length === 1);
  // la forma si conta sui volumi della RACCOLTA: un'edizione con piu' volumi
  // che il lettore non ha non vince su quella che ha i suoi
  const altra = [3, 4, 5, 1].map((n) => ({ title: `Monster Nouvelle, tome ${n}`, cover_i: 900 + n }));
  const viz12 = catalogo.filter((d) => /Monster, Vol\. [12]$/.test(d.title));
  const conta = copertinePerVolume([...altra, ...viz12], { nome: "Monster", libri: libri.slice(0, 2) });
  t.eq("…vince quella che ha i volumi che hai", conta.proposte.map((p) => p.copertina).join(), "863480,764859");
  t.eq("lo stesso volume due volte nella stessa forma: il primo del catalogo", copertinePerVolume([...catalogo, { title: "Naoki Urasawa's Monster, Vol. 2", cover_i: 1 }], { nome: "Monster", libri }).proposte.find((p) => p.numero === 2).copertina, 764859);
  const doppio = copertinePerVolume(catalogo, { nome: "Monster", libri: [...libri, { id: "m2cbz", saga: "Monster", sagaOrder: 2 }] });
  t.eq("un doppione col suo numero ha la proposta anche lui", doppio.proposte.filter((p) => p.numero === 2).map((p) => p.libro.id).join(), "m2,m2cbz");
  t.eq("un'opera senza copertina non si propone", copertinePerVolume([{ title: "Monster, Vol. 1" }], { nome: "Monster", libri }).proposte.length, 0);

  // ---- LA DOMANDA ----------------------------------------------------------------
  t.eq("l'autore che i volumi scrivono di piu'", autoreDellaRaccolta([{ author: "Altri" }, { author: "Naoki Urasawa" }, { author: "" }, { author: "Naoki Urasawa" }, { author: "" }, { author: " " }]), "Naoki Urasawa");
  t.eq("nessuno", autoreDellaRaccolta(libri), "");
  const con = new URL(domandaSerie("Monster", "Naoki Urasawa")).searchParams;
  t.eq("con l'autore: titolo e autore", `${con.get("title")}|${con.get("author")}|${con.get("q")}`, "Monster|Naoki Urasawa|null");
  t.eq("senza: il nome con «vol»", new URL(domandaSerie("Monster", "")).searchParams.get("q"), "Monster vol");

  const chieste = [];
  const finto = (risposte) => async (url) => {
    chieste.push(new URL(url).searchParams.get("author") ? "con" : "senza");
    return { ok: true, json: async () => ({ docs: risposte.shift() }) };
  };
  const conAutore = libri.map((b) => ({ ...b, author: "Urasawa Naoki" }));
  const r = await cercaCopertineSerie({ nome: "Monster", libri: conAutore }, { fetcher: finto([[], catalogo]) });
  t.eq("con l'autore e niente trovato si riprova senza", `${chieste.join()}|${r.proposte.length}`, "con,senza|18");
  chieste.length = 0;
  await cercaCopertineSerie({ nome: "Monster", libri: conAutore }, { fetcher: finto([catalogo]) });
  t.eq("…trovato, una domanda sola", chieste.join(), "con");
  chieste.length = 0;
  await cercaCopertineSerie({ nome: "Monster", libri }, { fetcher: finto([[]]) });
  t.eq("senza autore e niente trovato, una domanda sola", chieste.join(), "senza");
  let esploso = false;
  await cercaCopertineSerie({ nome: "Monster", libri }, { fetcher: async () => ({ ok: false, status: 503 }) }).catch(() => (esploso = true));
  t.c("un guasto del catalogo si dice, non e' «non ce l'ha»", esploso);

  // ---- DALLA MANUTENZIONE: SI SCEGLIE LA RACCOLTA O IL LIBRO ----------------------
  const scaffale = [
    ...libri,
    { id: "p1", title: "Mort", author: "Terry Pratchett", saga: "Mondo Disco", sagaOrder: 4 },
    { id: "p2", title: "Mostri e mostriciattoli", author: "Altri" },
    { id: "u1", title: "L'ultimo libro", author: "Àlvaro Mönsteri" },
    { id: "k10", title: "Kingdom v10", saga: "Kingdom" },
    { id: "k9", title: "Kingdom v9", saga: "kingdom" },
  ];
  const vedi = (q) => sceltePerCopertina(scaffale, q).map((s) => (s.tipo === "raccolta" ? `📚${s.nome}·${s.libri.length}` : `📖${s.libro.title}`));
  t.eq("la raccolta prima, poi i libri, coi volumi contati", vedi("monster v01").join(" | "), "📖Monster v01");
  t.eq("la raccolta col suo numero di volumi", vedi("Monster")[0], "📚Monster·18");
  t.eq("al piu' otto", vedi("Monster").length, 8);
  t.eq("la stessa saga scritta in due modi e' una raccolta, e il 9 viene prima del 10", vedi("kingdom").join(), "📚Kingdom·2,📖Kingdom v9,📖Kingdom v10");
  t.eq("ogni parola, in qualunque ordine, l'inizio basta e senza accenti", vedi("pratch mort").join(), "📖Mort");
  t.eq("…anche nell'autore, senza accenti", vedi("monsteri").join(), "📖L'ultimo libro");
  t.eq("niente cercato, niente proposto", vedi("  ").length, 0);
  t.eq("i volumi in ordine di numero", vedi("volume").slice(0, 3).join(), "📖Monster - Volume_02_[Mangascreener],📖Monster - Volume_03_[Mangascreener],📖Monster - Volume_04_[Mangascreener]");

  // un libro solo: col suo numero si cerca come volume della serie
  const perTitolo = [];
  const titolo = async (v) => (perTitolo.push(v.titolo), v.titolo === "Mort" ? 1234 : null);
  const v2 = await cercaCopertinaDelLibro(libri[1], { fetcher: async () => ({ ok: true, json: async () => ({ docs: catalogo }) }), perTitolo: titolo });
  t.eq("il volume 2 di Monster come volume della serie", `${v2.proposte.map((p) => p.copertina).join()}|${perTitolo.length}`, "764859|0");
  const mort = await cercaCopertinaDelLibro(scaffale.find((b) => b.id === "p1"), { fetcher: async () => ({ ok: true, json: async () => ({ docs: [] }) }), perTitolo: titolo });
  t.eq("la serie non lo trova: per titolo e autore", `${mort.proposte.map((p) => `${p.copertina}·${p.libro.id}·${p.numero}`).join()}|${perTitolo.join()}`, "1234·p1·null|Mort");
  const solo = await cercaCopertinaDelLibro({ id: "z", title: "Senza saga", saga: "Qualcosa" }, { fetcher: async () => { throw new Error("la serie non si chiede"); }, perTitolo: titolo });
  t.eq("senza numero, solo per titolo; e niente, niente", solo.proposte.length, 0);

  // ---- L'IMMAGINE ----------------------------------------------------------------
  let url = "";
  const immagine = (size, type = "image/jpeg") => async (u) => ((url = u), { ok: true, blob: async () => ({ size, type }) });
  const grande = await scaricaCopertina(764859, { fetcher: immagine(50000) });
  t.eq("la grande, e senza l'immagine di ripiego", `${grande?.size}|${url}`, "50000|https://covers.openlibrary.org/b/id/764859-L.jpg?default=false");
  t.eq("un'immagine minuscola non e' una copertina", await scaricaCopertina(764859, { fetcher: immagine(500) }), null);
  t.eq("una pagina non e' un'immagine", await scaricaCopertina(764859, { fetcher: immagine(50000, "text/html") }), null);
};
