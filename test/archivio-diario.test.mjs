// IL DIARIO NELL'ARCHIVIO. Quaderno, lista «Da prendere», tempo, obiettivo e
// racconti spuntati non entravano nello zip: al ripristino si perdevano senza
// che niente lo dicesse. Qui si prova il piano (cosa entra e cosa resta) e il
// giro intero — dall'archivio allo storage — perche' e' li' che una chiave
// sbagliata sparisce in silenzio.

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
const leggi = (k) => JSON.parse(memoria[k] || "null");

const { default: JSZip } = await import("jszip");
const { pianoDiario, contaDiario, frasiDiario, diarioPerArchivio } = await import("../src/lib/archivioDiario.js");
const { sbircia, restoreLibrary } = await import("../src/lib/restoreLibrary.js");

const parola = (id, t, extra = {}) => ({ id, parola: id, updatedAt: t, ...extra });

export default async (t) => {
  // ---- il piano --------------------------------------------------------------
  const locale = {
    quaderno: [parola("warren", 5), { id: "tolta", deleted: true, updatedAt: 9 }],
    daPrendere: [{ id: "t:tigana|kay", titolo: "Tigana", updatedAt: 3 }],
    tempo: { casa: { "2026-09-01": 600 } },
    obiettivi: { 2026: { n: 24, t: 1 } },
    racconti: ["A__x"],
  };
  const archivio = {
    quaderno: [
      parola("warren", 99, { resa: "dall'archivio" }),
      parola("tolta", 1),
      parola("nuova", 2),
      { id: "morta", deleted: true, updatedAt: 50 },
    ],
    daPrendere: [
      { id: "t:tigana|kay", titolo: "Tigana", nota: "vecchia", updatedAt: 99 },
      { id: "t:ysabel|kay", titolo: "Ysabel", updatedAt: 1 },
      { id: "t:scartata|x", titolo: "Scartata", scartata: true, updatedAt: 1 },
    ],
    tempo: { casa: { "2026-09-01": 60, "2026-08-01": 300 }, tablet: { "2026-09-02": 120 } },
    obiettivi: { 2025: { n: 12, t: 1 }, 2026: { n: 52, t: 999 } },
    racconti: ["A__x", "B__y"],
  };
  const { scrivi, conti } = pianoDiario(archivio, locale);

  const w = scrivi.quaderno.find((v) => v.id === "warren");
  t.eq("una parola che c'e' resta com'e', anche se l'archivio e' piu' recente", w.resa, undefined);
  t.c("la lapide di casa resta lapide", scrivi.quaderno.find((v) => v.id === "tolta").deleted === true);
  t.c("la parola che manca entra", scrivi.quaderno.some((v) => v.id === "nuova"));
  t.c("le lapidi dell'archivio non entrano", !scrivi.quaderno.some((v) => v.id === "morta"));
  t.eq("conto delle parole", conti.parole, 1);

  t.eq("la voce della lista che c'e' non si tocca", scrivi.daPrendere.find((v) => v.id === "t:tigana|kay").nota, undefined);
  t.c("lo scarto entra, o la proposta tornerebbe", scrivi.daPrendere.some((v) => v.id === "t:scartata|x"));
  t.eq("… ma non si conta fra i libri da prendere", conti.daPrendere, 1);

  t.eq("il giorno di casa non cala", scrivi.tempo.casa["2026-09-01"], 600);
  t.eq("il giorno che mancava entra", scrivi.tempo.casa["2026-08-01"], 300);
  t.eq("il cassetto dell'altro dispositivo entra", scrivi.tempo.tablet["2026-09-02"], 120);
  t.eq("conto dei giorni nuovi", conti.giorni, 2);

  t.eq("l'obiettivo scelto qui resta, anche se l'archivio e' piu' recente", scrivi.obiettivi[2026].n, 24);
  t.eq("l'anno che mancava entra", scrivi.obiettivi[2025].n, 12);
  t.eq("conto degli obiettivi", conti.obiettivi, 1);

  t.eq("racconti: unione", JSON.stringify(scrivi.racconti), JSON.stringify(["A__x", "B__y"]));
  t.eq("conto dei racconti", conti.racconti, 1);

  const pari = pianoDiario(locale, locale);
  t.c("in pari non si scrive niente", Object.values(pari.scrivi).every((v) => v === null));
  t.c("… e non si conta niente", Object.values(pari.conti).every((v) => v === 0));
  t.c("un archivio senza diario non tocca niente", Object.values(pianoDiario(undefined, locale).scrivi).every((v) => v === null));

  const zeroQui = pianoDiario({ obiettivi: { 2026: { n: 30, t: 5 } } }, { obiettivi: { 2026: { n: 0, t: 1 } } });
  t.eq("«nessun obiettivo» scelto qui e' una scelta, non un buco", zeroQui.scrivi.obiettivi, null);

  const doppia = pianoDiario({ quaderno: [parola("due", 1), parola("due", 2)] }, {});
  t.eq("la stessa parola due volte nell'archivio si conta una", doppia.conti.parole, 1);

  // ---- le parole ---------------------------------------------------------------
  t.eq("vuoto: niente da contare", contaDiario({ quaderno: [], tempo: {} }), null);
  t.eq(
    "le frasi, singolare compreso e zeri taciuti",
    frasiDiario({ parole: 1, daPrendere: 0, giorni: 3, obiettivi: 0, racconti: 2 }).join(" | "),
    "1 parola del quaderno | 3 giorni di lettura | 2 racconti spuntati"
  );

  // ---- il giro intero ----------------------------------------------------------
  memoria.bc_quaderno = JSON.stringify([parola("sapeva", 1)]);
  memoria.bc_da_prendere = JSON.stringify([{ id: "t:a|b", titolo: "A", updatedAt: 1 }]);
  memoria.bc_tempo = JSON.stringify({ casa: { "2026-01-01": 400 } });
  memoria.bc_obiettivi = JSON.stringify({ 2026: { n: 10, t: 1 } });
  memoria.bc_racconti = JSON.stringify(["R__1"]);
  const partito = diarioPerArchivio();
  t.eq("l'archivio legge il quaderno", partito.quaderno.length, 1);
  t.eq("… la lista", partito.daPrendere.length, 1);
  t.eq("… il tempo", partito.tempo.casa["2026-01-01"], 400);
  t.eq("… l'obiettivo", partito.obiettivi[2026].n, 10);
  t.eq("… i racconti", partito.racconti[0], "R__1");

  for (const k of Object.keys(memoria)) delete memoria[k];
  const zip = new JSZip();
  zip.file(
    "biblioteca.json",
    JSON.stringify({ app: "book-companion", version: 5, books: [], diario: partito })
  );
  const blob = await zip.generateAsync({ type: "uint8array" });

  const dentro = await sbircia(blob);
  t.eq("sbircia conta le parole", dentro.diario?.parole, 1);
  t.eq("sbircia conta i giorni", dentro.diario?.giorni, 1);

  const senza = await restoreLibrary(blob, { cosa: { diario: false } });
  t.eq("con la casella tolta non si scrive niente", memoria.bc_quaderno, undefined);
  t.eq("… e non si conta niente", senza.diario, null);

  const r = await restoreLibrary(blob);
  t.eq("tornano le parole", leggi("bc_quaderno")?.[0]?.id, "sapeva");
  t.eq("torna la lista", leggi("bc_da_prendere")?.[0]?.titolo, "A");
  t.eq("torna il tempo", leggi("bc_tempo")?.casa?.["2026-01-01"], 400);
  t.eq("torna l'obiettivo", leggi("bc_obiettivi")?.[2026]?.n, 10);
  t.eq("tornano i racconti", leggi("bc_racconti")?.[0], "R__1");
  t.eq("il resoconto le conta", r.diario?.parole, 1);

  const vecchio = new JSZip();
  vecchio.file("biblioteca.json", JSON.stringify({ app: "book-companion", version: 4, books: [] }));
  const v4 = await vecchio.generateAsync({ type: "uint8array" });
  t.eq("un archivio v4 non ha diario", (await sbircia(v4)).diario, null);
  t.eq("… e ripristinarlo non esplode", (await restoreLibrary(v4)).diario, null);
};
