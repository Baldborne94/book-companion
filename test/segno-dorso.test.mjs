// IL SEGNO SUL DORSO. Un tomo senza byte qui puo' essere lassu' (nuvoletta:
// si scarica quando lo apri) o da nessuna parte — e li' la nuvoletta
// prometteva uno scaricamento impossibile, a mezzo centimetro dalla riga
// che lo diceva perduto. La decisione e' una sola e deve dire le stesse
// cose di `senzaCopia`, o dorso e riga si smentirebbero.

import { segnoDorso, senzaCopia } from "../src/lib/syncCore.js";

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
};
