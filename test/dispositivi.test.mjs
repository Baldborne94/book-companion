// QUALI LIBRI STANNO SULL'ALTRO DISPOSITIVO (chiesto dal lettore dopo aver
// lasciato Drive: «fai sapere al PC quali libri sono sul tablet»). Il libro
// aggiunto sul tablet compariva sul PC col triangolo «né qui né nel cloud»
// e, aperto, finiva sulla schermata del guasto.
import { aggiornaQui, altroveDa, soloAltrove, percheNonSiApre, leggiDispositivi, nomeDispositivo, PREFISSO_QUI } from "../src/lib/dispositivi.js";
import { inViaggio, dalViaggio } from "../src/lib/votiRaccolte.js";
import { mergePrefs, segnoDorso, senzaCopia } from "../src/lib/syncCore.js";

// jsonb di Postgres rimanda le chiavi per lunghezza, poi per byte
const jsonb = (v) =>
  Array.isArray(v)
    ? v.map(jsonb)
    : v && typeof v === "object"
      ? Object.fromEntries(Object.keys(v).sort((a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0)).map((k) => [k, jsonb(v[k])]))
      : v;

export default async (t) => {
  // ---- la voce di questo dispositivo ---------------------------------------
  const tab = aggiornaQui([], ["b2", "b1", "b1"], { dispositivo: "T", nome: "tablet", ora: 10 });
  t.eq("una voce sola, gli id in ordine e senza doppioni", JSON.stringify(tab), JSON.stringify([{ id: "qui|T", nome: "tablet", libri: ["b1", "b2"], updatedAt: 10 }]));
  t.c("stessi libri: la stessa lista, niente ora nuova", aggiornaQui(tab, ["b1", "b2"], { dispositivo: "T", nome: "tablet", ora: 99 }) === tab);
  const dopo = aggiornaQui(tab, ["b1", "b2", "b3"], { dispositivo: "T", nome: "tablet", ora: 20 });
  t.eq("un libro in piu': voce nuova con l'ora nuova", `${dopo[0].libri}|${dopo[0].updatedAt}`, "b1,b2,b3|20");
  const rinominato = aggiornaQui(tab, ["b1", "b2"], { dispositivo: "T", nome: "telefono", ora: 15 });
  t.eq("lo stesso dispositivo con un altro nome: voce nuova", `${rinominato[0].nome}|${rinominato[0].updatedAt}`, "telefono|15");
  t.eq("senza l'elenco di casa non si scrive niente", aggiornaQui(tab, null, { dispositivo: "T", nome: "tablet" }), tab);
  t.eq("senza dispositivo nemmeno", aggiornaQui(tab, ["x"], { nome: "tablet" }), tab);
  const pc = aggiornaQui(dopo, ["d1"], { dispositivo: "P", nome: "computer", ora: 30 });
  t.eq("ognuno scrive solo la sua", pc.map((v) => v.id).join(), "qui|P,qui|T");

  // ---- cosa sta altrove ------------------------------------------------------
  const altrove = altroveDa(pc, "P");
  t.eq("dal PC: i libri del tablet, col suo nome", [...altrove].map(([k, v]) => `${k}:${v}`).join(), "b1:tablet,b2:tablet,b3:tablet");
  t.c("i miei non sono altrove", !altroveDa(pc, "T").has("b1") && altroveDa(pc, "T").get("d1") === "computer");
  t.eq("una voce storta arrivata da lassu' non rompe niente", altroveDa([{ id: "qui|X", nome: "x" }, ...pc], "P").size, 3);
  t.eq("una voce con la lapide non dice niente", altroveDa([{ ...pc[1], deleted: true }], "P").size, 0);

  // ---- viaggia nella colonna dei cuori, e torna uguale ---------------------
  const cuori = [{ id: "saga:mondo disco", nome: "Mondo Disco", addedAt: 1, updatedAt: 1 }];
  const voti = [{ id: "saga:mort", voto: 4, updatedAt: 2 }];
  const viaggio = inViaggio(cuori, voti, pc);
  const tornati = dalViaggio(viaggio);
  t.eq("i dispositivi tornano dispositivi", JSON.stringify(tornati.dispositivi), JSON.stringify(pc));
  t.c("…e cuori e voti restano loro", tornati.preferite.length === 1 && tornati.voti.length === 1 && tornati.voti[0].id === "saga:mort");
  t.c("le voci dei dispositivi cominciano tutte per qui|", pc.every((v) => v.id.startsWith(PREFISSO_QUI)));

  // ---- in pari non si rimbalzano le preferenze ------------------------------
  const base = { music_favs: [], music_lists: [], glossari: {}, racconti: [], reader: null, last_opened: null, tempo: {}, obiettivi: {}, quaderno: [], da_prendere: [], updated_at: 5 };
  const fermo = mergePrefs({ ...base, raccolte_fav: viaggio }, { ...base, raccolte_fav: jsonb(viaggio) });
  t.c("dopo il viaggio in jsonb, niente da scrivere da nessuna parte", !fermo.applyLocal && !fermo.pushRemote, JSON.stringify(fermo));
  const nuovo = aggiornaQui(pc, ["d1", "d2"], { dispositivo: "P", nome: "computer", ora: 40 });
  const sale = mergePrefs({ ...base, raccolte_fav: inViaggio(cuori, voti, nuovo) }, { ...base, raccolte_fav: jsonb(viaggio) });
  t.c("un libro nuovo qui sale", sale.pushRemote && !sale.applyLocal);
  const scende = mergePrefs({ ...base, raccolte_fav: viaggio }, { ...base, raccolte_fav: jsonb(inViaggio(cuori, voti, nuovo)) });
  t.c("…e lassu' scende", scende.applyLocal && !scende.pushRemote);

  // ---- sul dorso e nella riga d'avviso --------------------------------------
  const qui = new Set(["d1"]);
  const lassu = new Set(["su"]);
  t.eq("sul PC il libro del tablet non e' perduto: sta sul tablet", segnoDorso({ id: "b1" }, qui, lassu, altrove), "altrove");
  t.eq("…anche senza sapere cosa c'e' lassu'", segnoDorso({ id: "b1" }, qui, null, altrove), "altrove");
  t.eq("se lassu' c'e' una copia vince la nuvoletta: da qui si apre", segnoDorso({ id: "su" }, qui, lassu, new Map([["su", "tablet"]])), "cloud");
  t.eq("un libro che non sta da nessuna parte resta perduto", segnoDorso({ id: "x" }, qui, lassu, altrove), "perduto");
  t.eq("l'ebook tolto a mano resta tolto", segnoDorso({ id: "b1", fileTolto: true }, qui, lassu, altrove), "tolto");
  t.eq("i byte qui: nessun segno", segnoDorso({ id: "d1" }, qui, lassu, altrove), null);
  const nelCloud = [{ id: "b1" }, { id: "x" }];
  t.eq(
    "la riga dei perduti tace sui libri del tablet",
    senzaCopia(nelCloud.filter((b) => !altrove.has(b.id)), lassu).map((b) => b.id).join(),
    "x"
  );

  // ---- aprirlo dal PC ---------------------------------------------------------
  t.eq("niente byte, niente Drive: si dice dove sta", soloAltrove("b1", { qui, altrove }), "sul tablet");
  t.eq("una voce senza nome: «sull'altro dispositivo»", soloAltrove("z", { qui, altrove: altroveDa([{ id: "qui|X", libri: ["z"], updatedAt: 1 }], "P") }), "sull'altro dispositivo");
  t.eq("qui c'e': si apre", soloAltrove("d1", { qui, altrove: new Map([["d1", "tablet"]]) }), null);
  t.eq("senza l'elenco di casa non si ferma niente", soloAltrove("b1", { qui: null, altrove }), null);
  t.eq("un libro che l'altro non ha: niente", soloAltrove("x", { qui, altrove }), null);
  t.c("dal reader: dove sta", /sta sul tablet 📱/.test(percheNonSiApre("b1", { qui, altrove })));
  t.c("ne' qui ne' sull'altro: dal cloud non si apre piu', si dice come riaverlo", /Scarica qui.*reimportalo/.test(percheNonSiApre("x", { qui, altrove })));
  t.eq("qui c'e': si apre", percheNonSiApre("d1", { qui, altrove }), null);
  t.eq("prima di aver contato i file di qui non si ferma niente", percheNonSiApre("x", { qui: null, altrove }), null);

  // ---- il nome --------------------------------------------------------------
  t.eq("Android e' il tablet", nomeDispositivo({ navigator: { userAgent: "Mozilla/5.0 (Linux; Android 10; K)" } }), "tablet");
  t.eq("iPad che si dice Mac", nomeDispositivo({ navigator: { userAgent: "Macintosh", maxTouchPoints: 5 } }), "tablet");
  t.eq("Windows e' il computer", nomeDispositivo({ navigator: { userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } }), "computer");

  // ---- da localStorage, solo voci buone ------------------------------------
  const st = { getItem: () => JSON.stringify([...pc, { id: "saga:x" }, null, { id: 3 }]) };
  t.eq("si leggono solo le voci dei dispositivi", leggiDispositivi(st).map((v) => v.id).join(), "qui|P,qui|T");
  t.eq("storage rotto: niente", leggiDispositivi({ getItem: () => "{" }).length, 0);
};
