// Le due colonne nuove: l'impronta dei doppioni sui libri, e i termini del
// glossario nelle preferenze. Erano le due cose che viaggiavano
// nell'archivio ma non nel cloud, e la ragione era che le colonne di
// `syncCore` sono un elenco chiuso.
//
// Qui si prova che ci entrano, e soprattutto CHI VINCE quando due
// dispositivi hanno scritto lo stesso termine in modo diverso.
import { rowFromLocal, localFromRow, mergePrefs, colonnaMancante, senzaColonna } from "../src/lib/syncCore.js";

const stato = { status: "reading", progress: 0.5, marks: [], highlights: [] };

const prefs = (o = {}) => ({
  reader: null,
  music_favs: [],
  music_lists: [],
  glossari: {},
  last_opened: null,
  updated_at: 0,
  ...o,
});

export default async function (t) {
  // ---- l'impronta sale e scende -----------------------------------------
  const riga = rowFromLocal({ id: "a", title: "Mort", impronta: "abc123" }, stato, 10);
  t.eq("l'impronta entra nella riga", riga.impronta, "abc123");
  t.eq("un libro senza impronta manda null", rowFromLocal({ id: "b" }, stato, 10).impronta, null);

  const giu = localFromRow({ ...riga, id: "a" });
  t.eq("e torna giù intatta", giu.book.impronta, "abc123");
  // i libri che stanno lassù da prima di questa cura non hanno la colonna:
  // NON devono tornare giù con `impronta: undefined` addosso, o
  // `giaInLibreria` li vedrebbe tutti uguali fra loro
  t.c("una riga senza impronta non se la inventa", !("impronta" in localFromRow({ id: "c" }).book));
  t.c("e nemmeno una con la colonna vuota", !("impronta" in localFromRow({ id: "c", impronta: null }).book));

  // ---- i glossari nelle preferenze --------------------------------------
  const MIO = { "saga:malazan": [{ t: "Warren", d: "la mia spiegazione", addedAt: 2 }] };
  const SUO = {
    "saga:malazan": [{ t: "Warren", d: "quella dell'altro dispositivo", addedAt: 1 }],
    "saga:first law": [{ t: "Bayaz", d: "il primo dei Magi", addedAt: 1 }],
  };

  // io ho scritto per ultimo: la mia spiegazione vince, ma il termine che
  // avevo solo io non si perde
  let r = mergePrefs(prefs({ glossari: MIO, updated_at: 100 }), { ...prefs({ glossari: SUO }), updated_at: 50 });
  t.c(
    "chi ha scritto per ultimo comanda",
    /la mia spiegazione/.test(r.merged.glossari["saga:malazan"][0].d),
    r.merged.glossari["saga:malazan"][0].d
  );
  t.eq("e il termine dell'altro arriva lo stesso", r.merged.glossari["saga:first law"].length, 1);

  // ha scritto per ultimo l'altro dispositivo: si ribalta
  r = mergePrefs(prefs({ glossari: MIO, updated_at: 50 }), { ...prefs({ glossari: SUO }), updated_at: 100 });
  t.c(
    "l'orologio decide anche al contrario",
    /altro dispositivo/.test(r.merged.glossari["saga:malazan"][0].d),
    r.merged.glossari["saga:malazan"][0].d
  );

  // ---- e la fusione fa scattare la scrittura, di qua e di là ------------
  r = mergePrefs(prefs({ glossari: {}, updated_at: 50 }), { ...prefs({ glossari: SUO }), updated_at: 100 });
  t.c("se lassù c'è roba nuova, si scrive in locale", r.applyLocal);
  r = mergePrefs(prefs({ glossari: MIO, updated_at: 100 }), { ...prefs({ glossari: {} }), updated_at: 50 });
  t.c("se è qui che c'è roba nuova, si manda su", r.pushRemote);
  // due dispositivi già d'accordo non si scrivono a vicenda per niente
  r = mergePrefs(prefs({ glossari: MIO, updated_at: 100 }), { ...prefs({ glossari: MIO }), updated_at: 100 });
  t.c("due glossari identici non fanno traffico", !r.applyLocal && !r.pushRemote);

  // ---- UNO SCHEMA NON MIGRATO NON ROMPE TUTTA LA SINCRONIZZAZIONE ------
  // È successo sul serio: `music_lists` esiste dalle raccolte musicali, e
  // chi non aveva rilanciato lo schema se l'è trovata addosso mesi dopo —
  // le preferenze morivano alla prima colonna mancante, e con loro moriva
  // TUTTO il giro, compresa la riga «ultima sincronizzazione».
  const vero = {
    message: "Could not find the 'music_lists' column of 'prefs' in the schema cache",
    details: "",
  };
  t.eq("la colonna mancante si legge dall'errore", colonnaMancante(vero), "music_lists");
  t.eq("e anche col nome fra i dettagli", colonnaMancante({ details: "the 'glossari' column of 'prefs'" }), "glossari");
  t.eq("un errore che non parla di colonne", colonnaMancante({ message: "network error" }), null);
  t.eq("e nessun errore", colonnaMancante(), null);

  const prefRiga = { user_id: "u", updated_at: 5, reader: null, music_lists: [], glossari: {} };
  const ridotta = senzaColonna(prefRiga, "music_lists");
  t.c("la colonna se ne va", !("music_lists" in ridotta));
  t.c("e il resto resta", "glossari" in ridotta && ridotta.user_id === "u");
  // QUELLO CHE IDENTIFICA LA RIGA NON SI TOGLIE MAI: senza `user_id` la
  // scrittura non sarebbe più nemmeno rivolta a qualcuno, e il giro
  // continuerebbe a rinunciare all'infinito
  t.eq("`user_id` non si tocca", senzaColonna(prefRiga, "user_id"), null);
  t.eq("nemmeno `updated_at`", senzaColonna(prefRiga, "updated_at"), null);
  // una colonna che non c'è già più: si smette, non si gira a vuoto
  t.eq("una colonna già tolta ferma il giro", senzaColonna(ridotta, "music_lists"), null);
  t.eq("e un nome vuoto pure", senzaColonna(prefRiga, null), null);

  // ---- niente da rompere -------------------------------------------------
  r = mergePrefs(prefs(), null);
  t.c("senza niente lassù non esplode", !!r.merged);
  t.c("e il glossario resta un oggetto", typeof r.merged.glossari === "object");
  // un dispositivo con la colonna non ancora migrata manda `undefined`
  r = mergePrefs(prefs({ glossari: MIO, updated_at: 100 }), { reader: null, updated_at: 50 });
  t.eq("un remoto senza la colonna non cancella i miei termini", r.merged.glossari["saga:malazan"].length, 1);
}
