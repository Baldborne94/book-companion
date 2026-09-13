// DUE DECISIONI CHE STAVANO DENTRO I COMPONENTI, fuori dalla portata di
// ogni test: la disposizione della Libreria che si rilegge dallo storage
// (`vistaValida`) e il numero di lettura che si scrive nella scheda
// (`numeroLettura`, `pulisciNumero`). Tutt'e due sbagliano in silenzio:
// una voce salvata che non esiste piu' lascia il menu in bianco, e un
// numero letto storto non da' un errore — cancella il posto del volume
// nella saga, o ci salva un NaN che non torna piu' indietro.
const memoria = {};
for (const [nome, fn] of Object.entries({
  getItem: (k) => (k in memoria ? memoria[k] : null),
  setItem: (k, v) => {
    memoria[k] = String(v);
  },
  removeItem: (k) => {
    delete memoria[k];
  },
})) {
  Object.defineProperty(memoria, nome, { value: fn, enumerable: false });
}
globalThis.localStorage = memoria;

const { vistaValida, scriviVista, numeroLettura, pulisciNumero } = await import("../src/lib/library.js");

// le voci come le conosce la Libreria: la prima di ogni elenco e' la
// disposizione di partenza
const GRUPPI = [{ id: "shelf" }, { id: "genre" }];
const ORDINI = [{ id: "title" }, { id: "author" }, { id: "recent" }];
const vista = () => vistaValida(GRUPPI, ORDINI);

export default async function (t) {
  // ---- LA DISPOSIZIONE DELLA LIBRERIA -------------------------------------
  delete memoria.bc_vista;
  t.eq("mai salvata → la disposizione di sempre", JSON.stringify(vista()), '{"group":"shelf","sort":"title"}');

  scriviVista({ group: "genre", sort: "recent" });
  t.eq("salvata e riconosciuta → si rilegge", JSON.stringify(vista()), '{"group":"genre","sort":"recent"}');

  // LA VOCE CHE NON ESISTE PIU': «Niente» e «Saga» sono state tolte, e chi
  // le aveva scelte non deve restare impigliato in un menu in bianco
  scriviVista({ group: "none", sort: "recent" });
  t.eq("un raggruppamento tolto torna alla partenza", vista().group, "shelf");
  t.eq("ma l'ordinamento buono resta", vista().sort, "recent");
  scriviVista({ group: "genre", sort: "saga" });
  t.eq("un ordinamento sconosciuto torna alla partenza", vista().sort, "title");
  t.eq("e il raggruppamento buono resta", vista().group, "genre");

  // una vista scritta a meta': la parte che manca prende la partenza
  memoria.bc_vista = JSON.stringify({ group: "genre" });
  t.eq("senza ordinamento → titolo", vista().sort, "title");
  t.eq("col raggruppamento che c'e'", vista().group, "genre");

  // storage corrotto o strano: mai un'esplosione, sempre la partenza.
  // DICHIARATO: la guardia «e' un oggetto» di `leggiVista` non e' portante
  // per questi due casi — spargere una stringa o un null lascia comunque
  // `group` e `sort` della partenza, e `vistaValida` restituisce solo
  // quei due (mutazione provata: sopravvive). Tiene pulito l'oggetto, non
  // difende l'esito.
  memoria.bc_vista = "{non è json";
  t.eq("json rotto → partenza", JSON.stringify(vista()), '{"group":"shelf","sort":"title"}');
  memoria.bc_vista = '"shelf"';
  t.eq("una stringa al posto dell'oggetto → partenza", JSON.stringify(vista()), '{"group":"shelf","sort":"title"}');
  memoria.bc_vista = "null";
  t.eq("null → partenza", JSON.stringify(vista()), '{"group":"shelf","sort":"title"}');

  // la partenza e' la PRIMA voce degli elenchi, non un nome scritto a mano:
  // con altri elenchi cambia con loro
  delete memoria.bc_vista;
  t.eq("la partenza segue gli elenchi", JSON.stringify(vistaValida([{ id: "x" }], [{ id: "y" }])), '{"group":"x","sort":"y"}');

  // ---- IL NUMERO DI LETTURA -----------------------------------------------
  t.eq("un intero", numeroLettura("3"), 3);
  t.eq("con gli spazi attorno", numeroLettura(" 3 "), 3);
  // IL DECIMALE RESTA: Calibre mette 2.5 alla novella fra il secondo e il
  // terzo, e arrotondarlo la metterebbe sopra a un romanzo vero
  t.eq("il decimale resta decimale", numeroLettura("2.5"), 2.5);
  t.eq("e la virgola vale come il punto", numeroLettura("2,5"), 2.5);
  t.eq("un numero gia' numero", numeroLettura(7), 7);
  t.eq("lo zero e' zero, non «nessuno»", numeroLettura("0"), 0);
  // quel che non e' un numero vale «nessuno»: mai NaN
  t.eq("vuoto → nessuno", numeroLettura(""), null);
  t.eq("solo spazi → nessuno", numeroLettura("   "), null);
  t.eq("null → nessuno", numeroLettura(null), null);
  t.eq("undefined → nessuno", numeroLettura(undefined), null);
  t.eq("lettere → nessuno", numeroLettura("due"), null);
  t.eq("un punto solo → nessuno", numeroLettura("."), null);
  t.eq("due punti → nessuno", numeroLettura("2.5.1"), null);
  t.eq("Infinity non e' un posto", numeroLettura("Infinity"), null);
  t.c("e mai NaN, in nessun caso", ["", "x", ".", "NaN", null].every((s) => !Number.isNaN(numeroLettura(s))));

  // ---- LA CASELLA MENTRE SI SCRIVE ----------------------------------------
  t.eq("cifre e punto passano", pulisciNumero("2.5"), "2.5");
  t.eq("la virgola diventa punto", pulisciNumero("2,5"), "2.5");
  t.eq("le lettere se ne vanno", pulisciNumero("2a"), "2");
  t.eq("il meno se ne va", pulisciNumero("-3"), "3");
  // «2.» a meta' battitura e' legittimo: resta stringa, non diventa 2
  t.eq("il punto in coda resta, a meta' battitura", pulisciNumero("2."), "2.");
  t.eq("vuoto resta vuoto", pulisciNumero(""), "");
  t.eq("e null non esplode", pulisciNumero(null), "");
  // la casella e la lettura si parlano: quel che esce dalla casella si
  // legge come numero, virgola compresa
  t.eq("dalla casella alla lettura", numeroLettura(pulisciNumero("2,5x")), 2.5);
}
