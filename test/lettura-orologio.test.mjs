// LA LETTURA HA IL SUO OROLOGIO (`letturaPiuNuova`, `conLetturaDi`,
// `fondiSchede` in `syncCore.js`). Segnalato con Kingdom aperto sul tablet e
// «Da leggere» al 3% sul PC: stato, date, progresso e punto viaggiavano con
// l'ora della riga, e una scheda ritoccata sul PC dopo la lettura sul
// tablet rimandava su la lettura vecchia del PC. Il caso del banco: il
// tablet apre alle 100, il PC cambia la scheda alle 200.
import { planSync, fondiSchede } from "../src/lib/syncCore.js";

const tablet = { id: "k", title: "Kingdom v06", saga: "Kingdom", status: "reading", started_at: 100, finished_at: 0, progress: 0.03, cfi: "12", updated_at: 100, scheda_at: 50, lettura_at: 100 };
const pc = { id: "k", title: "Kingdom v06", saga: "Kingdom", series: "Ciclo", status: "unread", started_at: 0, finished_at: 0, progress: 0, cfi: null, updated_at: 200, scheda_at: 200, lettura_at: 10 };

const giro = (qui, lassu) => {
  const p = planSync({ localRows: [qui], tombstones: [], remoteRows: [lassu] });
  return fondiSchede({ push: p.push, pull: p.pull, intere: new Map([[lassu.id, lassu]]), locali: [qui] });
};
const lettura = (r) => r && `${r.status} ${r.progress} ${r.cfi} ${r.started_at} @${r.lettura_at}`;

export default async (t) => {
  // il PC sale (la sua riga e' piu' nuova) ma con la lettura del tablet
  const su = giro(pc, tablet);
  t.eq("il PC sale con la lettura del tablet", lettura(su.push[0]), "reading 0.03 12 100 @100");
  t.eq("e con la sua scheda", su.push[0]?.series, "Ciclo");
  t.eq("e la lettura del tablet si posa anche sul PC", lettura(su.lette.get("k")), "reading 0.03 12 100 @100");

  // il tablet riceve la riga del PC, ma la sua lettura resta e risale
  const giu = giro(tablet, pc);
  t.eq("il tablet riceve la scheda del PC", giu.pull[0]?.series, "Ciclo");
  t.eq("ma tiene la sua lettura", lettura(giu.pull[0]), "reading 0.03 12 100 @100");
  t.c("e la riga fusa risale", giu.tenute.has("k"));

  // la lettura piu' nuova di la' scende come sempre
  const letto = { ...pc, status: "read", progress: 1, cfi: "40", lettura_at: 300, updated_at: 300 };
  t.eq("una lettura piu' nuova lassu' scende", lettura(giro(tablet, letto).pull[0]), "read 1 40 0 @300");
  t.c("e non si rimanda su", !giro(tablet, letto).tenute.has("k"));

  // senza la colonna lassu' decide la riga, come prima
  const { lettura_at, ...senza } = tablet;
  t.eq("lassu' senza la colonna: decide la riga", lettura(giro(pc, senza).push[0]), "unread 0 null 0 @10");
  // e una lettura che scende da un database senza la colonna non si ferma
  // qui: senza la guardia, l'ora di qui vincerebbe sempre su un'ora che non c'e'
  const { lettura_at: _, ...vecchio } = letto;
  t.eq("lassu' senza la colonna, la lettura di la' scende lo stesso", lettura(giro(tablet, vecchio).pull[0]), "read 1 40 0 @undefined");
  // e a orologi pari decide la riga
  t.eq("a orologi pari decide la riga", lettura(giro({ ...pc, lettura_at: 100 }, tablet).push[0]), "unread 0 null 0 @100");
  const pari = giro(tablet, { ...pc, lettura_at: 100 });
  t.eq("anche ricevendo: a orologi pari scende la riga", lettura(pari.pull[0]), "unread 0 null 0 @100");
  t.c("e non si rimanda su", !pari.tenute.has("k"));
};
