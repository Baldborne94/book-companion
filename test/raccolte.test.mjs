// LE RACCOLTE DELLA LIBRERIA (`inRaccolte`, `copertinaDi`, `contoRaccolta`
// in `lib/ripiani.js`). Sbagliano in silenzio: una cartella «Volumi soli»
// nasconde i libri invece di raccoglierli, e una copertina sbagliata ti fa
// ripartire dal primo volume di una saga a cui sei al quindicesimo.
import { disponi, inRaccolte, eRaccolta, copertinaDi, contoRaccolta, preferitiPrima, nellOrdineScelto, SOLI } from "../src/lib/ripiani.js";

export default async function (t) {
  const libri = [
    { id: "b1", title: "20CB 1", saga: "20th Century Boys", sagaOrder: 1, author: "Urasawa" },
    { id: "b2", title: "20CB 2", saga: "20th Century Boys", sagaOrder: 2, author: "Urasawa" },
    { id: "b3", title: "20CB 3", saga: "20th Century Boys", sagaOrder: 3, author: "Urasawa" },
    { id: "m1", title: "Mistborn", saga: "Mistborn", sagaOrder: 1, author: "Sanderson" },
    { id: "x", title: "Un romanzo solo", author: "Qualcuno" },
  ];
  const ripiani = disponi(libri);
  const { raccolte, sciolti } = inRaccolte(ripiani);
  t.eq("ogni saga e' una raccolta, anche di un volume", raccolte.map((r) => r.nome).join("|"), "20th Century Boys|Mistborn");
  t.eq("i volumi soli restano sciolti, non in una cartella", sciolti.map((r) => r.id).join("|"), SOLI);
  t.c("un mucchio spento (Senza genere) non e' una raccolta", !eRaccolta({ id: "", nome: "Senza genere", libri: [1], spento: true }));
  t.c("un ripiano di genere lo e'", eRaccolta({ id: "Fantasy", nome: "Fantasy", libri: [1] }));
  t.eq("niente ripiani, niente raccolte", inRaccolte().raccolte.length, 0);

  const saga = raccolte[0].libri;
  const stati = { b1: "read", b2: "reading" };
  const statusOf = (id) => stati[id] || "unread";
  t.eq("la copertina e' il volume che hai in mano", copertinaDi(saga, statusOf).id, "b2");
  t.eq("…anche se prima ce n'e' uno mai aperto (hai saltato avanti)", copertinaDi(saga, (id) => (id === "b3" ? "reading" : "unread")).id, "b3");
  t.eq("senza uno in mano, il primo non ancora chiuso", copertinaDi(saga, (id) => (id === "b1" ? "read" : id === "b2" ? "abandoned" : "unread")).id, "b3");
  t.eq("a saga finita, la prima", copertinaDi(saga, () => "read").id, "b1");
  t.eq("una raccolta vuota non ha copertina", copertinaDi([], statusOf), null);
  t.eq("quanti volumi e quanti letti", JSON.stringify(contoRaccolta(saga, statusOf)), '{"quanti":3,"letti":1}');
  t.eq("un abbandonato non e' letto", contoRaccolta(saga, () => "abandoned").letti, 0);

  // «PREFERITI PRIMA» SOLO QUANDO SI SCEGLIE: qui la funzione, che il
  // componente chiama solo con quell'ordine
  const r = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: SOLI }];
  t.eq("le preferite salgono, e fra loro l'ordine resta", preferitiPrima(r, new Set(["c", "a"])).map((x) => x.id).join(), `a,c,b,${SOLI}`);
  t.eq("…le altre restano nel loro ordine, e il mucchio chiude", preferitiPrima(r, new Set(["b"])).map((x) => x.id).join(), `b,a,c,${SOLI}`);
  t.eq("senza preferite nessuno si muove", preferitiPrima(r, new Set()).map((x) => x.id).join(), `a,b,c,${SOLI}`);
  t.eq("con un altro ordine le preferite NON salgono", nellOrdineScelto(r, "title", new Set(["c"])).map((x) => x.id).join(), `a,b,c,${SOLI}`);
  t.eq("…ne' con «Recenti»", nellOrdineScelto(r, "recent", new Set(["c"])).map((x) => x.id).join(), `a,b,c,${SOLI}`);
  t.eq("salgono solo con «Preferiti prima»", nellOrdineScelto(r, "preferiti", new Set(["c"])).map((x) => x.id).join(), `c,a,b,${SOLI}`);
}
