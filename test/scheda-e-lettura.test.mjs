// LA SCHEDA E LA LETTURA HANNO DUE OROLOGI (`schedaPiuNuova`, `conSchedaDi`,
// `fondiSchede` in `lib/syncCore.js`). Segnalato: saghe scritte a mano sul
// PC, sparite dopo la sincronizzazione — il tablet quei libri li aveva
// LETTI dopo, e un solo orario per riga faceva vincere la sua copia intera,
// saga vuota compresa. Sbaglia in silenzio: «Sincronizzato» e la saga non c'e'.
import { schedaPiuNuova, conSchedaDi, fondiSchede, planSync, CAMPI_SCHEDA } from "../src/lib/syncCore.js";

const riga = (x) => ({ id: "a", title: "Elric", saga: "", progress: 0, status: "unread", updated_at: 0, scheda_at: 0, ...x });

export default async function (t) {
  // ---- chi ha la scheda piu' nuova ------------------------------------------
  t.eq("la scheda cambiata dopo vince", schedaPiuNuova({ scheda_at: 5 }, { scheda_at: 3 }), "mia");
  t.eq("…da qualunque lato", schedaPiuNuova({ scheda_at: 3 }, { scheda_at: 5 }), "sua");
  t.eq("orologi uguali: decide la riga, come prima", schedaPiuNuova({ scheda_at: 5 }, { scheda_at: 5 }), null);
  t.eq("lassu' la colonna non c'e': decide la riga", schedaPiuNuova({ scheda_at: 5 }, {}), null);
  const f = conSchedaDi(riga({ progress: 0.9, saga: "" }), riga({ progress: 0.1, saga: "Elric", scheda_at: 7 }));
  t.eq("la scheda si prende tutta…", `${f.saga} ${f.scheda_at}`, "Elric 7");
  t.eq("…e la lettura resta", f.progress, 0.9);
  t.c("la lettura non e' scheda", !CAMPI_SCHEDA.some((k) => ["progress", "status", "cfi", "marks", "highlights", "started_at", "finished_at", "updated_at"].includes(k)));

  // ---- IL CASO DEL LETTORE --------------------------------------------------
  // 10:00 saga scritta sul PC (non ancora partita); 11:00 il tablet legge
  // lo stesso libro e manda la sua riga; poi il PC sincronizza.
  const pc = riga({ saga: "Elric di Melniboné", updated_at: 1000, scheda_at: 1000 });
  const tablet = riga({ saga: "", progress: 0.4, status: "reading", updated_at: 1100, scheda_at: 0 });
  {
    // il PC: lassu' c'e' la riga del tablet, piu' nuova → scende
    const piano = planSync({ localRows: [pc], tombstones: {}, remoteRows: [tablet] });
    t.eq("la riga del tablet e' piu' nuova, e scende", piano.pull.length, 1);
    const s = fondiSchede({ pull: piano.pull, locali: [pc] });
    t.eq("ma la saga del PC resta", s.pull[0].saga, "Elric di Melniboné");
    t.eq("e la lettura del tablet arriva", `${s.pull[0].progress} ${s.pull[0].status}`, "0.4 reading");
    t.c("e la riga fusa risale", s.tenute.has("a"));
  }
  {
    // l'altro verso: il tablet legge DOPO che la saga del PC e' gia' lassu'
    const lassu = riga({ saga: "Elric di Melniboné", updated_at: 1000, scheda_at: 1000 });
    const piano = planSync({ localRows: [tablet], tombstones: {}, remoteRows: [lassu] });
    t.eq("la riga del tablet e' piu' nuova, e sale", piano.push.length, 1);
    const s = fondiSchede({ push: piano.push, intere: new Map([["a", lassu]]) });
    t.eq("ma sale con la saga di lassu'", s.push[0].saga, "Elric di Melniboné");
    t.eq("e con la sua lettura", s.push[0].progress, 0.4);
    t.eq("e la saga si posa anche sul tablet", s.scese.get("a")?.saga, "Elric di Melniboné");
  }
  {
    // e quando la scheda nuova e' quella che sale, sale com'e'
    const lassu = riga({ saga: "vecchia", updated_at: 500, scheda_at: 500 });
    const s = fondiSchede({ push: [pc], intere: new Map([["a", lassu]]) });
    t.eq("la scheda piu' nuova sale intatta", s.push[0].saga, "Elric di Melniboné");
    t.eq("e non scende niente", s.scese.size, 0);
  }
  {
    // quando la scheda nuova e' quella che scende, scende com'e'
    const lassu = riga({ saga: "Elric di Melniboné", updated_at: 1200, scheda_at: 1200 });
    const s = fondiSchede({ pull: [lassu], locali: [pc] });
    t.eq("la scheda piu' nuova lassu' scende intatta", s.pull[0].saga, "Elric di Melniboné");
    t.eq("e non si rimanda su niente", s.tenute.size, 0);
    // e una riga cancellata lassu' non presta la sua scheda vuota
    const lapide = { id: "a", deleted: true, updated_at: 900, scheda_at: 5000 };
    const sl = fondiSchede({ push: [pc], intere: new Map([["a", lapide]]) });
    t.eq("una lapide lassu' non e' una scheda", `${sl.push[0].saga} ${sl.push[0].scheda_at} ${sl.scese.size}`, "Elric di Melniboné 1000 0");
  }
  {
    // una lapide non si fonde, e un libro nuovo nemmeno
    const s = fondiSchede({ push: [{ id: "a", deleted: true, updated_at: 9 }], intere: new Map([["a", riga({ scheda_at: 99 })]]), pull: [riga({ id: "n", scheda_at: 5 })], locali: [] });
    t.eq("la lapide resta lapide", s.push[0].deleted, true);
    t.eq("il libro nuovo scende com'e'", s.tenute.size + s.scese.size, 0);
  }
}
