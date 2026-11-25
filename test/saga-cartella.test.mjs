// LA CARTELLA DICE LA SAGA QUANDO IL NOME DEL FILE NON LA DICE (chiesto dal
// lettore dopo l'importazione dal NAS: «voglio una regola per cui queste
// cose non ricapitino»). I nomi sono quelli della sua foto: i BLAME!
// chiamati «0 (1)», i Freesia «v03».
import { sagaDallaCartella, numeroDalNome } from "../src/lib/casa.js";
import { completaSaga } from "../src/lib/importBook.js";
import { controllaDisco } from "../src/lib/disco.js";
import { raccogliDallaCartella, fraseRaccogliere } from "../src/lib/raccolteDalDisco.js";

export default async (t) => {
  t.eq("dentro Manga la prima cartella e' la saga", JSON.stringify(sagaDallaCartella(["Manga", "BLAME!"])), JSON.stringify({ saga: "BLAME!" }));
  t.eq("e la seconda la parte", JSON.stringify(sagaDallaCartella(["Manga", "JoJo's Bizarre Adventure", "Parte 5"])), JSON.stringify({ saga: "JoJo's Bizarre Adventure", ciclo: "Parte 5" }));
  t.eq("un volume a se' nella cartella del tipo non ha saga", sagaDallaCartella(["Fumetti"]), null);
  t.eq("le cartelle col trattino basso non sono saghe", sagaDallaCartella(["Fumetti", "_Doppioni"]), null);
  t.eq("fuori da Libri, Fumetti e Manga niente", sagaDallaCartella(["Musica", "Notti"]), null);
  t.eq("il numero di «v03»", numeroDalNome("v03.cbz"), 3);
  t.eq("il quarto «0» numerato fra parentesi", numeroDalNome("0 (4).cbz"), 4);
  t.eq("un titolo non e' un numero", numeroDalNome("1984.epub"), null);
  t.eq("lo zero non vale", numeroDalNome("0.cbz"), null);

  // all'importazione dal disco: la cartella per ultima, solo se il nome tace
  const blame = { title: "0 (1)", fileType: "cbz" };
  completaSaga(blame, null, "0 (1).cbz", [{ id: "b", title: "Blame! v02", saga: "Blame!" }], { cartelle: ["Manga", "BLAME!"] });
  t.eq("«0 (1)» dentro Manga/BLAME! e' BLAME!, con la grafia che la biblioteca usa gia'", `${blame.saga} ${blame.sagaOrder}`, "Blame! 1");
  const freesia = { title: "v03", fileType: "cbz" };
  completaSaga(freesia, null, "v03.cbz", [], { cartelle: ["Manga", "Freesia"] });
  t.eq("«v03» dentro Manga/Freesia e' il terzo Freesia", `${freesia.saga} ${freesia.sagaOrder}`, "Freesia 3");
  const fma = { title: "Fullmetal_Alchemist_v24_2011_Digital_LostNerevarine_Empire", fileType: "cbz" };
  completaSaga(fma, null, `${fma.title}.cbz`, [], { cartelle: ["Manga", "Altra cartella"] });
  t.eq("il nome che dice la saga vince sulla cartella", `${fma.saga} ${fma.sagaOrder}`, "Fullmetal Alchemist 24");
  const sciolto = { title: "0 (1)", fileType: "cbz" };
  completaSaga(sciolto, null, "0 (1).cbz", []);
  t.eq("senza cartella resta sciolto", sciolto.saga, undefined);

  // le schede gia' entrate: il controllo del disco le propone, e «Riordina»
  // non le porta fuori dalla cartella della loro saga
  const libri = [
    { id: "b1", title: "0 (1)", fileType: "cbz", tipo: "manga" },
    { id: "f3", title: "v03", fileType: "cbz", tipo: "manga", series: "a mano" },
    { id: "via", title: "Mort", fileType: "epub", sagaTolta: true },
  ];
  const file = [
    { nome: "0 (1).cbz", cartelle: ["Manga", "BLAME!"], byte: 10 },
    { nome: "v03.cbz", cartelle: ["Manga", "Freesia", "Parte 1"], byte: 11 },
    { nome: "Mort.epub", cartelle: ["Libri", "Discworld"], byte: 12 },
  ];
  const r = controllaDisco(libri, file, { tipoDi: (b) => b.tipo || "libri" });
  t.eq("i due volumi senza saga stanno nella loro cartella e si propongono", r.daRaccogliere.map((v) => `${v.libro.id}>${v.saga}${v.ciclo ? `/${v.ciclo}` : ""}#${v.sagaOrder}`).join(" "), "b1>BLAME!#1 f3>Freesia/Parte 1#3");
  t.eq("…e «Riordina» non li sposta: sposta solo la saga tolta a mano", r.daSpostare.map((v) => v.libro.id).join(), "via");
  t.eq("…e contano fra i volumi sul disco (il NAS li ritrova)", r.aPosto.map((v) => v.libro.id).sort().join(), "b1,f3");
  // I DIECI BLAME! DEL LETTORE: «0 (1)»…«0 (10)», dieci schede e dieci file.
  // Tolto il «(n)» delle copie di Windows si chiamavano tutti «0», e la
  // prima scheda si prendeva tutti e dieci i file: uno solo entrava nella
  // raccolta, col numero di un altro
  const dieci = Array.from({ length: 10 }, (_, i) => ({ id: `z${i + 1}`, title: `0 (${i + 1})`, fileType: "cbz", tipo: "manga" }));
  const fileDieci = Array.from({ length: 10 }, (_, i) => ({ nome: `0 (${i + 1}).cbz`, cartelle: ["Manga", "BLAME!"], byte: 1000 + i }));
  const rd = controllaDisco(dieci, fileDieci, { tipoDi: (b) => b.tipo });
  t.eq("ogni «0 (n)» prende il suo file e il suo numero", rd.daRaccogliere.map((v) => `${v.libro.title}=${v.sagaOrder}`).join(" "), dieci.map((b, i) => `${b.title}=${i + 1}`).join(" "));
  const dopo = raccogliDallaCartella([...libri, { id: "x", title: "Blame! v02", saga: "Blame!" }], r.daRaccogliere);
  t.eq("confermato, la scheda prende saga e numero, con la grafia di casa", `${dopo[0].saga} ${dopo[0].sagaOrder}`, "Blame! 1");
  t.eq("…e una serie scritta a mano resta", `${dopo[1].saga} ${dopo[1].series} ${dopo[1].sagaOrder}`, "Freesia a mano 3");
  t.c("prima del tocco la frase propone", fraseRaccogliere(9).includes("mettili"));
  t.eq("dopo il tocco dice che e' fatto", fraseRaccogliere(9, true), "✓ 9 volumi messi nella raccolta della loro cartella:");
};
