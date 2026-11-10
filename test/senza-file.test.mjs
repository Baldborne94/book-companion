// LE SCHEDE SENZA FILE (`lib/senzaFile.js`, `lib/segnaposto.js`): chiesto dal
// lettore, «aggiungere libri o saghe senza dover per forza caricare il
// libro… e poi ci carico dentro l'ebook». Quel che sbaglia in silenzio: il
// SEGNO (sull'altro dispositivo una scheda senza file non deve diventare un
// ePub tolto, cioe' un libro posseduto), i DOPPIONI, e la SAGA in cui
// finiscono le schede di una guida.
import { schedaSenzaFile, giaSulloScaffale, sagaPerLaGuida, vociDallaGuida, copertinaDalCatalogo, fraseAggiunte, serieDellElenco, nellaRaccolta, SENZA } from "../src/lib/senzaFile.js";
import { segnaposto } from "../src/lib/segnaposto.js";
import { rowFromLocal, localFromRow } from "../src/lib/syncCore.js";
import { camminoDellaGuida, prossimoPasso } from "../src/lib/cammino.js";
import { proposte, arrivato } from "../src/lib/daPrendere.js";
import { TAVOLE } from "../src/lib/sagaBooks.js";

const guida = (saga) => TAVOLE.find((t) => t.saga === saga);

export default async (t) => {
  const s = schedaSenzaFile({ titolo: " Ghostmaker ", autore: "Dan Abnett", saga: "Warhammer 40K", serie: "Gaunt's Ghosts", numero: "2" }, { id: "x", ora: 5 });
  t.eq("la scheda: titolo, autore, saga, serie, numero", [s.title, s.author, s.saga, s.series, s.sagaOrder].join("|"), "Ghostmaker|Dan Abnett|Warhammer 40K|Gaunt's Ghosts|2");
  t.c("…senza file, col suo segno", s.fileTolto === true && s.fileType === SENZA && segnaposto(s));
  t.eq("il numero con la virgola", schedaSenzaFile({ titolo: "x", numero: "2,5" }).sagaOrder, 2.5);
  t.eq("niente numero, niente numero", schedaSenzaFile({ titolo: "x", numero: "" }).sagaOrder, null);
  t.eq("senza titolo nessuna scheda", schedaSenzaFile({ titolo: "  " }), null);
  t.c("un ePub tolto apposta non e' una scheda senza file", !segnaposto({ fileTolto: true, fileType: "epub" }));

  // IL SEGNO VIAGGIA: la sincronizzazione scrive «epub» al posto di un formato vuoto
  const tornata = localFromRow(rowFromLocal(s, {})).book;
  t.c("dopo il giro nel cloud resta una scheda senza file", segnaposto(tornata), JSON.stringify({ fileType: tornata.fileType, fileTolto: tornata.fileTolto }));

  // I DOPPIONI
  const libri = [{ title: "Ghostmaker", author: "Dan Abnett" }];
  t.c("stesso titolo e autore: c'e' gia'", giaSulloScaffale({ titolo: "ghostmaker", autore: "Dan Abnett" }, libri));
  t.c("…anche senza autore da un lato", giaSulloScaffale({ titolo: "Ghostmaker" }, libri));
  t.c("un altro autore no", !giaSulloScaffale({ titolo: "Ghostmaker", autore: "Joe Bloggs" }, libri));
  // lo stesso libro scritto in un altro modo (chiesto dal lettore: «se un
  // libro o una saga sono già presenti non me li aggiungere di nuovo»)
  const scritti = [
    { title: "Mistborn: The Final Empire", author: "Brandon Sanderson" },
    { title: "Empire in Black and Gold (Shadows of the Apt 1)", author: "Adrian Tchaikovsky" },
    { title: "Il nome del vento", author: "Patrick Rothfuss" },
    { title: "Part One", author: "Someone" },
  ];
  t.c("la saga davanti al titolo", giaSulloScaffale({ titolo: "The Final Empire", autore: "Brandon Sanderson" }, scritti));
  t.c("…e al contrario, anche fuori dalle guide", giaSulloScaffale({ titolo: "Shadows of the Apt: Dragonfly Falling", autore: "Adrian Tchaikovsky" }, [{ title: "Dragonfly Falling", author: "Adrian Tchaikovsky" }]));
  t.c("la serie fra parentesi in coda", giaSulloScaffale({ titolo: "Empire in Black and Gold", autore: "Adrian Tchaikovsky" }, scritti));
  t.c("il titolo italiano che la guida conosce", giaSulloScaffale({ titolo: "The Name of the Wind", autore: "Patrick Rothfuss" }, scritti));
  t.c("una forma accorciata vale solo con l'autore da tutt'e due le parti", !giaSulloScaffale({ titolo: "Saga: Part One" }, scritti));
  t.c("…e uguale", !giaSulloScaffale({ titolo: "Saga: Part One", autore: "Other" }, scritti));
  t.c("un altro volume della stessa guida no", !giaSulloScaffale({ titolo: "The Wise Man's Fear", autore: "Patrick Rothfuss" }, scritti));

  // LA SAGA DELLE SCHEDE DI UNA GUIDA: quella che il lettore usa per lo stesso universo
  const suoi = [{ id: "h", title: "Horus Rising", author: "Dan Abnett", saga: "Warhammer 40K" }, { id: "k", title: "Know No Fear", author: "Dan Abnett", saga: "Warhammer 40K" }];
  t.eq("Gaunt's Ghosts finisce sotto «Warhammer 40K», accanto all'Eresia", sagaPerLaGuida(guida("Gaunt's Ghosts"), suoi), "Warhammer 40K");
  t.eq("senza libri suoi, il nome dell'universo", sagaPerLaGuida(guida("Gaunt's Ghosts"), []), "Warhammer 40K");
  t.eq("il Mondo Disco, senza universo, il nome della guida", sagaPerLaGuida(guida("Discworld"), suoi), "Discworld");

  // I VOLUMI DI UN CAMMINO
  const voci = vociDallaGuida(camminoDellaGuida(guida("Gaunt's Ghosts"), suoi), suoi).filter((v) => !v.novella);
  t.eq("Gaunt's Ghosts: quindici volumi in ordine", voci.map((v) => v.numero).join(","), Array.from({ length: 15 }, (_, i) => i + 1).join(","));
  t.eq("…con saga, serie e autore", [voci[1].titolo, voci[1].saga, voci[1].serie, voci[1].autore].join("|"), "Ghostmaker|Warhammer 40K|Gaunt's Ghosts|Dan Abnett");
  const eis = vociDallaGuida(camminoDellaGuida(guida("Eisenhorn"), []), []).filter((v) => !v.novella);
  t.eq("Eisenhorn: i quattro romanzi, non l'omnibus", eis.map((v) => v.titolo).join(", "), "Xenos, Malleus, Hereticus, The Magos");
  const disco = vociDallaGuida(camminoDellaGuida(guida("Discworld"), []), []);
  t.eq("il Mondo Disco ha l'autore anche se la tavola non lo scrive", disco[0].autore, "Terry Pratchett");
  const hh = vociDallaGuida(camminoDellaGuida(guida("The Horus Heresy"), []), []);
  t.c("dell'Eresia niente prologo ne' titoli fuori dalla storia", !hh.some((v) => ["Malleus", "Soul Hunter", "Night Lords Omnibus"].includes(v.titolo)));
  t.c("…ma le antologie si', sono libri della storia", hh.some((v) => v.titolo === "Eye of Terra"));
  const conUno = [...suoi, { id: "g", title: "First and Only", author: "Dan Abnett", saga: "Warhammer 40K" }];
  t.eq("quello che hai e' segnato", vociDallaGuida(camminoDellaGuida(guida("Gaunt's Ghosts"), conUno), conUno).filter((v) => v.gia).map((v) => v.titolo).join(), "First and Only");
  // GLI ULTIMI TRE DELLA RUOTA LI HA FINITI SANDERSON (il lettore, con la
  // foto della sua raccolta: «come mai mi proponi wheel of time? non è già
  // presente?»): il suo «A Memory of Light» porta solo «Sanderson, Brandon»
  const ruota = [
    { id: "w13", title: "Towers of Midnight", author: "Jordan, Robert", saga: "The Wheel of Time" },
    { id: "w14", title: "A Memory of Light", author: "Sanderson, Brandon", saga: "The Wheel of Time" },
  ];
  const vociRuota = vociDallaGuida(camminoDellaGuida(guida("The Wheel of Time"), ruota), ruota);
  t.eq("il volume scritto col solo Sanderson e' gia' tuo, come quello col cognome davanti", vociRuota.filter((v) => v.gia).map((v) => v.titolo).join(", "), "Towers of Midnight, A Memory of Light");
  t.c("…e non si aggiunge di nuovo", giaSulloScaffale({ titolo: "A Memory of Light", autore: "Robert Jordan" }, ruota));
  t.c("…il cognome davanti e' lo stesso autore, anche fuori dalle guide", giaSulloScaffale({ titolo: "Hyperion", autore: "Dan Simmons" }, [{ title: "Hyperion", author: "Simmons, Dan" }]));
  t.c("…ma un Sanderson che la Ruota non l'ha scritta resta un altro libro", !giaSulloScaffale({ titolo: "Knife of Dreams", autore: "Robert Jordan" }, [{ title: "Knife of Dreams", author: "Brandon Sanderson" }]));

  // LA SERIE ACCANTO ALLA RACCOLTA (il lettore: «non solo il nome della
  // saga… ma anche il nome della serie, così che vengano messi in ordine
  // come i libri della Horus Heresy del 40K»)
  t.eq("la serie che i volumi della guida hanno tutti uguale", serieDellElenco({ fonte: "guida", volumi: voci }), "Gaunt's Ghosts");
  const elder = vociDallaGuida(camminoDellaGuida(guida("The Realm of the Elderlings"), []), []).filter((v) => !v.novella);
  t.eq("una guida a cicli non ne ha una sola: ognuno tiene la sua", serieDellElenco({ fonte: "guida", volumi: elder }), "");
  const wd = { fonte: "wikidata", nome: "Magnus Chase and the Gods of Asgard", volumi: [{ titolo: "The Sword of Summer", saga: "Magnus Chase and the Gods of Asgard", serie: "", numero: 1 }] };
  t.eq("su Wikidata, il nome della serie", serieDellElenco(wd), "Magnus Chase and the Gods of Asgard");
  t.eq("…e su Hardcover", serieDellElenco({ ...wd, fonte: "hardcover" }), "Magnus Chase and the Gods of Asgard");
  t.eq("gli altri libri di un autore non hanno serie", serieDellElenco({ fonte: "sciolti", nome: "Altri libri", volumi: [{ titolo: "X", serie: "" }] }), "");
  const [mc] = nellaRaccolta(wd.volumi, "Rick Riordan", "Magnus Chase and the Gods of Asgard");
  t.eq("in un'altra raccolta la serie resta, col suo numero: un ripiano in ordine", `${mc.saga} | ${mc.serie} | ${mc.numero}`, "Rick Riordan | Magnus Chase and the Gods of Asgard | 1");
  t.eq("…ma la serie che si chiama come la raccolta non e' una serie", nellaRaccolta(wd.volumi, "", "Magnus Chase and the Gods of Asgard")[0].serie, "");
  t.eq("una serie scritta vale per tutti, anche nei cicli", [...new Set(nellaRaccolta(elder, "Robin Hobb", "Elderlings").map((v) => `${v.saga}/${v.serie}`))].join(), "Robin Hobb/Elderlings");
  t.eq("vuota, ogni volume tiene la sua", nellaRaccolta(elder.slice(0, 4), "", "").map((v) => v.serie).join(" | "), "The Farseer Trilogy | The Farseer Trilogy | The Farseer Trilogy | Liveship Traders");
  t.eq("la scheda che ne nasce", (({ saga, series, sagaOrder }) => `${saga}/${series}/${sagaOrder}`)(schedaSenzaFile(mc, { id: "m" })), "Rick Riordan/Magnus Chase and the Gods of Asgard/1");

  // UNA SCHEDA SENZA FILE NON E' UN LIBRO CHE HAI
  const posto = schedaSenzaFile({ titolo: "Ghostmaker", autore: "Dan Abnett", saga: "Warhammer 40K" }, { id: "p" });
  const conPosto = [...conUno, posto];
  const c = camminoDellaGuida(guida("Gaunt's Ghosts"), conPosto);
  t.eq("nel cammino la scheda c'e', ma non conta fra i tuoi", c.tue, 1);
  t.eq("…la sua riga lo dice", c.tappe.find((x) => x.voce.t === "Ghostmaker").daCaricare, true);
  const stato = { statoDi: (id) => (id === "g" ? "read" : "unread"), progressoDi: () => 0, spuntati: new Set() };
  t.eq("letto il primo, il passo e' Ghostmaker…", prossimoPasso(c, stato).tappa.voce.t, "Ghostmaker");
  t.eq("…ma non e' «da aprire»: il file non c'e'", prossimoPasso(c, stato).apribile, null);
  // e una scheda senza file PIU' AVANTI non diventa «intanto puoi aprire»
  const avanti = [...conUno, schedaSenzaFile({ titolo: "Necropolis", autore: "Dan Abnett" }, { id: "n" })];
  const c2 = camminoDellaGuida(guida("Gaunt's Ghosts"), avanti);
  t.eq("il passo e' Ghostmaker, che non hai…", prossimoPasso(c2, stato).tappa.voce.t, "Ghostmaker");
  t.eq("…e Necropolis senza file non e' «intanto puoi aprire»", prossimoPasso(c2, stato).apribile, null);
  const prop = proposte(conPosto, [], { statusOf: (id) => (id === "g" ? "read" : "unread") });
  t.c("Da prendere lo propone lo stesso: e' da prendere", prop.some((g) => g.voci.some((v) => v.titolo === "Ghostmaker")));
  t.eq("e una voce in lista non e' «arrivata» per una scheda senza file", arrivato({ titolo: "Ghostmaker", autore: "Dan Abnett" }, conPosto), null);

  // LA COPERTINA DAL CATALOGO
  const chieste = [];
  const finto = (risposte) => async (url) => {
    chieste.push(url);
    const r = risposte.find(([re]) => re.test(url));
    if (!r) return { ok: false, status: 404 };
    return r[1];
  };
  const immagine = new Blob([new Uint8Array(5000)], { type: "image/jpeg" });
  const cerca = { ok: true, json: async () => ({ docs: [{ key: "/works/1", title: "Ghostmaker", author_name: ["Dan Abnett"], cover_i: 42 }] }) };
  const blob = await copertinaDalCatalogo({ titolo: "Ghostmaker", autore: "Dan Abnett" }, { fetcher: finto([[/search\.json/, cerca], [/covers\.openlibrary\.org\/b\/id\/42-L\.jpg\?default=false/, { ok: true, blob: async () => immagine }]]) });
  t.c("la copertina grande arriva", blob === immagine, chieste.join(" "));
  const nessuna = await copertinaDalCatalogo({ titolo: "Ghostmaker", autore: "Dan Abnett" }, { fetcher: finto([[/search\.json/, cerca], [/covers/, { ok: true, blob: async () => new Blob([new Uint8Array(40)], { type: "image/gif" }) }]]) });
  t.eq("un'immagine minuscola (il segnaposto del catalogo) non e' una copertina", nessuna, null);
  t.eq("senza rete, niente (e niente guasto)", await copertinaDalCatalogo({ titolo: "X" }, { fetcher: async () => { throw new Error("rete"); } }), null);

  t.eq("la frase: una", fraseAggiunte({ aggiunte: 1 }), "📥 Una scheda senza file sullo scaffale");
  t.eq("la frase: molte e alcune gia'", fraseAggiunte({ aggiunte: 14, gia: 1 }), "📥 14 schede senza file sullo scaffale · una c'era già");
  t.eq("la frase: niente", fraseAggiunte({ gia: 3 }), "Niente da aggiungere: c'erano già tutte");
};
