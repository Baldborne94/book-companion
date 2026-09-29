// IL CUORE DELLE RACCOLTE (`lib/raccoltePreferite.js`) e il suo viaggio fra
// i dispositivi (`mergePrefs`). Sbaglia in silenzio: un cuore tolto sul
// telefono che risorge sul tablet, o una saga preferita che non si trova
// piu' quando le arriva un volume nuovo, non alzano nessun errore.
import {
  fondiPreferite, segnaPreferita, preferiteVive, puoEssereFavorita, chiaviDelLibro,
  libriDellaRaccolta, ePreferito, vistaPerRaccolta, leggiPreferite, scriviPreferite,
} from "../src/lib/raccoltePreferite.js";
import { disponi } from "../src/lib/ripiani.js";
import { mergePrefs } from "../src/lib/syncCore.js";

export default async function (t) {
  // ---- la chiave e' quella dei ripiani ----------------------------------
  const libri = [
    { id: "a", title: "20CB 1", saga: "20th Century Boys", sagaOrder: 1, author: "Naoki Urasawa" },
    { id: "b", title: "20CB 2", saga: "20th Century Boys", sagaOrder: 2, author: "Naoki Urasawa" },
    { id: "c", title: "Monster", author: "Urasawa, Naoki" },
    { id: "d", title: "Pluto", author: "Naoki Urasawa" },
  ];
  const saga = disponi(libri, null, "saga").find((r) => r.tipo === "saga");
  t.eq("la chiave di un libro e' quella del suo ripiano di saga", chiaviDelLibro(libri[0])[0], saga.id);
  const autore = disponi(libri, null, "autore").find((r) => r.tipo === "autore");
  t.eq("…e di autore", chiaviDelLibro(libri[2])[1] ?? chiaviDelLibro(libri[2])[0], autore.id);
  t.eq("la raccolta preferita ritrova i suoi libri", libriDellaRaccolta(libri, saga.id).map((b) => b.id).join(), "a,b");
  t.eq("anche con l'autore scritto al contrario", libriDellaRaccolta(libri, autore.id).length, 4);
  t.c("solo saghe e autori prendono il cuore", puoEssereFavorita("saga:x") && puoEssereFavorita("autore:y") && !puoEssereFavorita("Fantasy") && !puoEssereFavorita("saga:"));

  // ---- mettere e togliere ------------------------------------------------
  let l = segnaPreferita([], saga.id, true, { nome: "20th Century Boys", ora: 100 });
  t.c("messa, e' viva", preferiteVive(l).has(saga.id));
  t.eq("col suo nome", l[0].nome, "20th Century Boys");
  l = segnaPreferita(l, saga.id, false, { ora: 200 });
  t.c("tolta, non e' piu' viva", !preferiteVive(l).has(saga.id));
  t.c("…ma resta come lapide, per dirlo all'altro dispositivo", l.length === 1 && l[0].deleted);
  t.eq("…e tiene il nome e la nascita", `${l[0].nome}|${l[0].addedAt}`, "20th Century Boys|100");
  t.eq("un genere non prende il cuore", segnaPreferita([], "Fantasy", true).length, 0);

  // ---- fra i dispositivi -------------------------------------------------
  const tablet = [{ id: "saga:x", nome: "X", addedAt: 1, updatedAt: 300, deleted: true }];
  const telefono = [{ id: "saga:x", nome: "X", addedAt: 1, updatedAt: 100 }, { id: "saga:y", nome: "Y", addedAt: 2, updatedAt: 150 }];
  const f = fondiPreferite(tablet, telefono);
  t.c("il cuore tolto dopo non risorge", !preferiteVive(f).has("saga:x"));
  t.c("quello messo altrove arriva", preferiteVive(f).has("saga:y"));
  t.eq("in ordine di chiave, sempre uguale", JSON.stringify(fondiPreferite(telefono, tablet)), JSON.stringify(f));
  // due dispositivi che hanno messo i cuori in ordine inverso: senza
  // l'ordine di chiave il JSON sarebbe diverso, e le preferenze
  // rimbalzerebbero fra tablet e telefono a ogni giro
  const y = { id: "saga:y", updatedAt: 1 };
  const w = { id: "autore:w", updatedAt: 1 };
  t.eq("l'ordine non dipende da chi e' arrivato prima", JSON.stringify(fondiPreferite([y], [w])), JSON.stringify(fondiPreferite([w], [y])));
  t.c("a parita' d'ora vince la lapide", !preferiteVive(fondiPreferite([{ id: "saga:z", updatedAt: 5 }], [{ id: "saga:z", updatedAt: 5, deleted: true }])).has("saga:z"));
  t.eq("voci storte si scartano", fondiPreferite([null, { nome: "senza id" }], undefined).length, 0);

  const base = { reader: null, music_favs: [], music_lists: [], glossari: {}, racconti: [], tempo: {}, obiettivi: {}, quaderno: [], da_prendere: [], updated_at: 5 };
  const m = mergePrefs({ ...base, raccolte_fav: tablet }, { ...base, raccolte_fav: telefono, updated_at: 1 });
  t.c("la sincronizzazione fonde il cuore anche col cloud piu' vecchio", preferiteVive(m.merged.raccolte_fav).has("saga:y") && !preferiteVive(m.merged.raccolte_fav).has("saga:x"));
  t.c("…e lo scrive qui e lassu'", m.applyLocal && m.pushRemote);
  const vuoti = mergePrefs({ ...base, raccolte_fav: [] }, { ...base });
  t.c("uno schema senza la colonna non fa risalire le preferenze a ogni giro", !vuoti.pushRemote && !vuoti.applyLocal);

  // ---- il filtro e l'apertura dall'Ingresso ------------------------------
  const vive = new Set([saga.id]);
  t.c("un volume di una raccolta col cuore e' fra i preferiti", ePreferito(libri[0], vive));
  t.c("un libro col suo cuore pure", ePreferito({ id: "z", fav: true }, new Set()));
  t.c("un altro no", !ePreferito({ id: "q", title: "Q", author: "Altri" }, vive));
  t.eq("una saga si apre a «Saga e autore» se c'eri gia'", vistaPerRaccolta("saga:x", { group: "shelf" }).group, "shelf");
  t.eq("…o a «Saga»", vistaPerRaccolta("saga:x", { group: "genre" }).group, "saga");
  t.eq("un autore a «Autore»", vistaPerRaccolta("autore:y", { group: "shelf" }).group, "autore");
  t.eq("e sempre a raccolte", vistaPerRaccolta("saga:x", {}).aspetto, "raccolte");

  const mem = new Map();
  const st = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  scriviPreferite(l, st);
  t.eq("si rilegge com'e' stata scritta", JSON.stringify(leggiPreferite(st)), JSON.stringify(l));
  st.setItem("bc_raccolte_fav", "{rotto");
  t.eq("uno storage rotto vale nessuna", leggiPreferite(st).length, 0);
}
