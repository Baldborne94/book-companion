// IL RESOCONTO DEL GIRO, LIBRO PER LIBRO (`coseCambiate`, `raccontaGiro`,
// `fraseGiro` in `lib/resoconto.js`). Chiesto dal lettore dopo le saghe del
// PC mai arrivate sul tablet: «Sincronizzato» non diceva niente. Sbaglia in
// silenzio in due modi: tace una saga arrivata, o racconta come nuovo un
// libro che non lo e' (e allora il resoconto si impara a non leggerlo).
import { coseCambiate, raccontaGiro, fraseGiro, ricordaGiro, ultimoGiro, avvisoArrivi } from "../src/lib/resoconto.js";
import { rowFromLocal } from "../src/lib/syncCore.js";

const riga = (book, state = {}) => rowFromLocal({ id: "L1", title: "Cthulhu. I racconti del mito", ...book }, { status: "reading", progress: 0.3, ...state }, 1);

export default async function (t) {
  const prima = riga({});

  // ---- il caso del lettore: la saga scritta sul PC arriva --------------------------
  t.eq(
    "la saga col numero",
    coseCambiate(prima, riga({ saga: "Miti di Cthulhu", sagaOrder: 2 })).join(),
    "saga «Miti di Cthulhu» n° 2"
  );
  t.eq("la saga tolta", coseCambiate(riga({ saga: "X" }), prima).join(), "fuori saga");
  t.eq("solo il numero", coseCambiate(riga({ saga: "X", sagaOrder: 1 }), riga({ saga: "X", sagaOrder: 3 })).join(), "n° 3 in «X»");

  // ---- la lettura ---------------------------------------------------------------------
  t.eq("lo stato e la pagina", coseCambiate(prima, riga({}, { status: "read", progress: 1 })).join(), "letto,al 100%");
  t.eq("un punto che si muove di meno di un per cento non si dice", coseCambiate(prima, riga({}, { progress: 0.304 })).length, 0);
  const segni = (n, morti = 0) => [...Array.from({ length: n }, (_, i) => ({ id: `m${i}` })), ...Array.from({ length: morti }, (_, i) => ({ id: `x${i}`, deleted: true }))];
  t.eq("i segnalibri nuovi, senza contare le lapidi", coseCambiate(riga({}, { marks: segni(1) }), riga({}, { marks: segni(3, 5) })).join(), "2 segnalibri nuovi");
  t.eq("…e quelli tolti", coseCambiate(riga({}, { highlights: segni(2) }), riga({}, { highlights: segni(1, 1) })).join(), "1 evidenziazione tolta");
  t.eq("il cuore", coseCambiate(prima, riga({ fav: true })).join(), "fra i preferiti");

  // ---- quel che non si racconta --------------------------------------------------------
  t.eq("un libro che non c'era e' nuovo", coseCambiate(null, prima).join(), "nuovo");
  t.eq("la sola ora non e' un cambiamento", coseCambiate(prima, { ...prima, updated_at: 99, cfi: "epubcfi(/6/8)" }).length, 0);
  // la riga leggera del giro: id, ora, lapide, ebook tolto
  const leggera = { id: "L1", updated_at: 1, deleted: false, file_tolto: false };
  t.eq("una riga letta a meta' non fa sembrare nuovo niente", coseCambiate(leggera, riga({ saga: "X" })).length, 0);
  t.eq("la sola scheda, se chiesta", coseCambiate(prima, riga({ saga: "X" }, { progress: 0.9 }), { solo: ["saga"] }).join(), "saga «X»");

  // ---- il giro intero --------------------------------------------------------------------
  const voci = raccontaGiro({
    arrivati: [{ prima, dopo: riga({ saga: "Miti di Cthulhu" }) }, { prima: riga({ id: "L9", title: "Fermo" }), dopo: { ...riga({ id: "L9", title: "Fermo" }), updated_at: 5 } }],
    schede: [{ prima: riga({ id: "L2", title: "Dagon" }), dopo: riga({ id: "L2", title: "Dagon", saga: "Miti di Cthulhu" }, { progress: 0.9 }) }],
    partiti: [{ prima: null, dopo: riga({ id: "L3", title: "Nuovo" }) }],
    tolti: ["Vecchio"],
    copertine: [{ titolo: "Cthulhu. I racconti del mito", verso: "qui" }],
  });
  t.eq("un libro solo per verso, e chi non ha niente da dire non c'e'", voci.length, 4);
  t.eq("la copertina si aggiunge alla voce del suo libro", voci[0].cose.join(), "saga «Miti di Cthulhu»,copertina nuova");
  t.eq("della scheda scesa si dice la scheda, non la lettura", voci[1].cose.join(), "saga «Miti di Cthulhu»");
  t.eq("partito", `${voci[2].verso}:${voci[2].cose}`, "lassu:nuovo");
  t.eq("la riga", fraseGiro(voci), "3 libri cambiati dall'altro dispositivo · 1 libro mandato nel cloud");
  t.eq("niente da dire", fraseGiro([]), "Tutto già allineato");

  // ---- l'avviso di quel che e' arrivato ------------------------------------------------
  t.eq("niente arrivato, niente avviso", avvisoArrivi([{ titolo: "X", verso: "lassu", cose: ["letto"] }]), null);
  t.eq("un libro: per nome", avvisoArrivi([{ titolo: "Racconti", verso: "qui", cose: ["saga «Miti di Cthulhu»"] }]), "☁ Dall'altro dispositivo: «Racconti» — saga «Miti di Cthulhu»");
  const tanti = [
    { titolo: "A", verso: "qui", cose: ["saga «X» n° 1"] },
    { titolo: "B", verso: "qui", cose: ["fuori saga", "letto"] },
    { titolo: "C", verso: "qui", cose: ["nuovo"] },
    { titolo: "D", verso: "qui", cose: ["n° 3 in «X»"] },
    { titolo: "E", verso: "lassu", cose: ["nuovo"] },
  ];
  t.eq("tanti: i conti per specie, e quel che parte non si conta", avvisoArrivi(tanti), "☁ Dall'altro dispositivo: 4 libri — 3 saghe, 1 letto, 1 nuovo. I dettagli nella nuvola.");
  t.eq(
    "tanti senza specie note: aggiornati",
    avvisoArrivi([{ titolo: "A", verso: "qui", cose: ["al 40%"] }, { titolo: "B", verso: "qui", cose: ["2 segnalibri nuovi"] }]),
    "☁ Dall'altro dispositivo: 2 libri aggiornati. I dettagli nella nuvola."
  );
  t.eq("…e chi e' stato tolto lo si dice", avvisoArrivi([{ titolo: "A", verso: "qui", cose: ["tolto: cancellato sull'altro dispositivo"] }, { titolo: "B", verso: "qui", cose: ["copertina nuova"] }]), "☁ Dall'altro dispositivo: 2 libri — 1 tolto, 1 copertina. I dettagli nella nuvola.");

  // ---- resta per il pannello --------------------------------------------------------------
  const mem = new Map();
  const st = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  ricordaGiro(voci, 7, st);
  t.eq("l'ultimo giro si rilegge", ultimoGiro(st)?.voci.length, 4);
  st.setItem("bc_sync_racconto", "{rotto");
  t.eq("uno storage rotto vale nessun giro", ultimoGiro(st), null);
  st.setItem("bc_sync_racconto", '{"at":1}');
  t.eq("…e uno senza voci anche", ultimoGiro(st), null);
}
