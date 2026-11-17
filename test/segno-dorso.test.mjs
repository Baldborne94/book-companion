// IL SEGNO SUL DORSO. Un tomo senza byte qui puo' essere lassu' (nuvoletta:
// si scarica quando lo apri) o da nessuna parte — e li' la nuvoletta
// prometteva uno scaricamento impossibile, a mezzo centimetro dalla riga
// che lo diceva perduto. La decisione e' una sola e deve dire le stesse
// cose di `senzaCopia`, o dorso e riga si smentirebbero.

import { segnoDorso, normaDelDorso, senzaCopia } from "../src/lib/syncCore.js";

export default async (t) => {
  const qui = new Set(["casa"]);
  const lassu = new Set(["su"]);
  const libri = [{ id: "casa" }, { id: "su" }, { id: "perso" }, { id: "tolto", fileTolto: true }];

  t.eq("i byte sono qui: nessun segno", segnoDorso(libri[0], qui, lassu), null);
  t.eq("lassu' c'e': la nuvoletta", segnoDorso(libri[1], qui, lassu), "cloud");
  t.eq("ne' qui ne' lassu': perduto, non nuvoletta", segnoDorso(libri[2], qui, lassu), "perduto");
  t.eq("ebook tolto a mano: il suo segno, anche con lo stato del secchio", segnoDorso(libri[3], qui, lassu), "tolto");
  t.eq("… e anche senza nessun elenco", segnoDorso(libri[3], null, null), "tolto");

  // Senza l'elenco del secchio non si accusa nessuno: resta la nuvoletta,
  // che al peggio promette un tentativo. Stessa regola di `senzaCopia`.
  t.eq("senza elenco del secchio: nuvoletta, non perduto", segnoDorso(libri[2], qui, null), "cloud");
  t.eq("senza sincronizzazione (niente elenco di casa): nessun segno", segnoDorso(libri[2], null, lassu), null);
  t.eq("un libro senza id non si segna", segnoDorso({}, qui, lassu), null);

  // Il dorso dice perduto esattamente dove la riga d'avviso lo dice.
  const soloNelCloud = libri.filter((b) => !qui.has(b.id));
  const dallaRiga = senzaCopia(soloNelCloud, lassu).map((b) => b.id).sort().join(",");
  const dalDorso = libri.filter((b) => segnoDorso(b, qui, lassu) === "perduto").map((b) => b.id).sort().join(",");
  t.eq("dorso e riga d'avviso dicono gli stessi perduti", dalDorso, dallaRiga);
  const alBuio = libri.filter((b) => segnoDorso(b, qui, null) === "perduto").length;
  t.eq("… anche al buio (nessuno)", alBuio, senzaCopia(soloNelCloud, null).length);

  // SI SEGNA L'ECCEZIONE. Dal lettore, dopo «Libera spazio», quasi ogni
  // libro ha l'ebook tolto: la norma e' quella, e il segno va ai pochi che
  // il file ce l'hanno qui.
  const tolti = (n) => Array.from({ length: n }, (_, i) => ({ id: `t${i}`, fileTolto: true }));
  t.eq("quasi tutti senza ebook: la norma e' quella", normaDelDorso([...tolti(3), { id: "casa" }]), "tolto");
  t.eq("meta' e meta': resta la norma di sempre", normaDelDorso([...tolti(2), { id: "a" }, { id: "b" }]), "qui");
  t.eq("uno solo senza ebook fra tanti: la norma di sempre", normaDelDorso([...tolti(1), { id: "a" }, { id: "b" }]), "qui");
  t.eq("una biblioteca vuota: la norma di sempre", normaDelDorso([]), "qui");
  t.eq("con quella norma l'ebook tolto non si segna", segnoDorso(libri[3], qui, lassu, null, "tolto"), null);
  t.eq("… e si segna quello che il file ce l'ha qui", segnoDorso(libri[0], qui, lassu, null, "tolto"), "qui");
  t.eq("… ma non al buio: senza elenco di casa non si sa", segnoDorso(libri[0], null, lassu, null, "tolto"), null);
  t.eq("la nuvoletta resta la nuvoletta", segnoDorso(libri[1], qui, lassu, null, "tolto"), "cloud");
  t.eq("e il perduto resta perduto", segnoDorso(libri[2], qui, lassu, null, "tolto"), "perduto");
  t.eq("e quello sull'altro dispositivo resta altrove", segnoDorso(libri[2], qui, lassu, new Map([["perso", "tablet"]]), "tolto"), "altrove");
};
