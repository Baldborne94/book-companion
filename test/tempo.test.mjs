// IL TEMPO DI LETTURA E L'OBIETTIVO DELL'ANNO. Ogni errore qui e' un numero
// plausibile: una sera contata due volte, un pomeriggio in background
// finito nel conto, una serie spezzata al mattino. Nessuno alza un errore.
import {
  accumula,
  fondiTempo,
  perGiorno,
  statisticheAnno,
  giornoDi,
  durata,
  PAUSA_MAX,
  SOGLIA_GIORNO,
} from "../src/lib/tempo.js";
import {
  fondiObiettivi,
  obiettivoDi,
  conObiettivo,
  passoObiettivo,
  frazioneAnno,
} from "../src/lib/obiettivo.js";
import { mergePrefs } from "../src/lib/syncCore.js";
import { rigaDiario } from "../src/lib/diary.js";

const ore = (y, m, d, h, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const MIN = 60 * 1000;

export default async function (t) {
  // ---- il giorno e' quello LOCALE -----------------------------------------
  // col fuso del lettore: in UTC (la macchina della CI) il giorno locale e
  // quello di `toISOString` coincidono, e il difetto non si vedrebbe
  const tz = process.env.TZ;
  process.env.TZ = "Europe/Rome";
  try {
    t.eq("le undici di sera sono di oggi", giornoDi(ore(2026, 9, 24, 23, 30)), "2026-09-24");
    t.eq("mezzanotte e cinque e' domani", giornoDi(ore(2026, 9, 25, 0, 5)), "2026-09-25");
    t.eq("l'una di notte e' gia' domani, anche se in UTC e' ancora ieri", giornoDi(ore(2026, 9, 25, 1, 0)), "2026-09-25");
  } finally {
    if (tz === undefined) delete process.env.TZ;
    else process.env.TZ = tz;
  }

  // ---- accumula -------------------------------------------------------------
  const a0 = ore(2026, 9, 24, 21);
  let r = accumula({}, "tab", a0, a0 + 2 * MIN);
  t.eq("due minuti fra due voltate", r.tab["2026-09-24"], 120);
  r = accumula(r, "tab", a0 + 2 * MIN, a0 + 3 * MIN);
  t.eq("si somma nello stesso giorno", r.tab["2026-09-24"], 180);

  const fermo = accumula(r, "tab", a0, a0 + PAUSA_MAX + 1);
  t.c("oltre la pausa massima non e' lettura: il registro non cambia", fermo === r);
  t.eq("alla pausa massima esatta si conta", accumula({}, "tab", a0, a0 + PAUSA_MAX).tab["2026-09-24"], PAUSA_MAX / 1000);
  t.c("un tempo all'indietro non si conta", accumula(r, "tab", a0 + MIN, a0) === r);
  t.c("zero non si conta", accumula(r, "tab", a0, a0) === r);
  t.c("senza dispositivo non si scrive", accumula(r, null, a0, a0 + MIN) === r);
  const altro = accumula(r, "tel", a0, a0 + MIN);
  t.c("ogni dispositivo nel suo cassetto", altro.tel["2026-09-24"] === 60 && altro.tab["2026-09-24"] === 180);
  t.eq("il registro di partenza non si tocca", r.tel, undefined);

  // ---- la fusione fra dispositivi ---------------------------------------------
  const qui = { tab: { "2026-09-24": 600, "2026-09-23": 300 } };
  const lassu = { tab: { "2026-09-24": 400 }, tel: { "2026-09-24": 900 } };
  const f = fondiTempo(qui, lassu);
  t.eq("stesso cassetto, stesso giorno: vince il piu' grande, non la somma", f.tab["2026-09-24"], 600);
  t.eq("il giorno che ha solo un lato resta", f.tab["2026-09-23"], 300);
  t.eq("il cassetto dell'altro dispositivo entra intero", f.tel["2026-09-24"], 900);
  t.eq("al giorno il tempo si somma fra dispositivi", perGiorno(f)["2026-09-24"], 1500);
  t.eq("fondere e' simmetrico", JSON.stringify(fondiTempo(lassu, qui)), JSON.stringify(f));
  t.eq("fondere due volte non cambia niente", JSON.stringify(fondiTempo(f, f)), JSON.stringify(f));
  // jsonb di Postgres riordina le chiavi: la forma fusa deve essere la stessa
  const disordinato = { tel: { "2026-09-24": 900 }, tab: { "2026-09-24": 600, "2026-09-23": 300 } };
  t.eq("le chiavi escono in ordine", JSON.stringify(fondiTempo(disordinato)), JSON.stringify(fondiTempo(qui, { tel: { "2026-09-24": 900 } })));
  t.eq("valori storti si scartano", JSON.stringify(fondiTempo({ tab: { a: "x", b: -3, c: 0 } })), JSON.stringify({ tab: {} }));
  t.eq("registri assenti fanno un registro vuoto", JSON.stringify(fondiTempo(null, undefined)), "{}");

  // ---- i numeri dell'anno ----------------------------------------------------
  const oggi = ore(2026, 9, 24, 12);
  const reg = {
    tab: {
      "2026-09-20": 20 * 60,
      "2026-09-21": 30 * 60,
      "2026-09-22": 10 * 60,
      "2026-09-23": 40 * 60,
      "2026-09-24": 60, // un minuto solo: non fa un giorno di lettura
      "2026-01-05": 25 * 60,
      "2026-01-06": 25 * 60,
      "2025-12-31": 90 * 60, // un altro anno
    },
    tel: { "2026-09-24": 60 }, // due minuti in tutto, oggi: ancora sotto soglia
  };
  const st = statisticheAnno(reg, 2026, oggi);
  t.eq("il tempo e' solo dell'anno chiesto", st.minuti, 20 + 30 + 10 + 40 + 2 + 50);
  t.eq("i giorni sotto soglia non sono giorni di lettura", st.giorni, 6);
  t.eq("la media e' sui giorni letti", st.mediaMinuti, Math.round((st.minuti * 60) / 60 / 6));
  t.eq("oggi non hai ancora letto: la serie si conta da ieri", st.serie, 4);
  t.eq("il record e' la serie piu' lunga dell'anno", st.serieMax, 4);

  const letto = statisticheAnno({ tab: { ...reg.tab, "2026-09-24": SOGLIA_GIORNO } }, 2026, oggi);
  t.eq("alla soglia esatta oggi conta, e la serie arriva a oggi", letto.serie, 5);
  const buco = statisticheAnno({ tab: { "2026-09-21": 900, "2026-09-23": 900 } }, 2026, oggi);
  t.eq("un giorno saltato spezza la serie", buco.serie, 1);
  t.eq("…e il record resta uno", buco.serieMax, 1);
  const vecchia = statisticheAnno({ tab: { "2026-09-10": 900, "2026-09-11": 900 } }, 2026, oggi);
  t.c("una serie finita da giorni non e' la serie di adesso", vecchia.serie === 0 && vecchia.serieMax === 2);
  // la serie attraversa il capodanno: e' la tua serie, non quella dell'anno
  const capodanno = statisticheAnno({ tab: { "2025-12-31": 900, "2026-01-01": 900 } }, 2026, ore(2026, 1, 1, 20));
  t.eq("la serie attraversa il capodanno", capodanno.serie, 2);
  t.eq("un registro vuoto dice zero dappertutto", JSON.stringify(statisticheAnno({}, 2026, oggi)), JSON.stringify({ minuti: 0, giorni: 0, mediaMinuti: 0, serie: 0, serieMax: 0 }));

  t.eq("sotto l'ora, minuti", durata(45), "45 min");
  t.eq("l'ora tonda", durata(120), "2 h");
  t.eq("ore e minuti", durata(125), "2 h 5 min");

  // ---- l'obiettivo -----------------------------------------------------------
  const o1 = conObiettivo({}, 2026, 24, 1000);
  t.eq("l'obiettivo si legge per anno", obiettivoDi(o1, 2026), 24);
  t.eq("l'anno dopo non eredita l'obiettivo", obiettivoDi(o1, 2027), 0);
  t.eq("zero e' «nessun obiettivo»", obiettivoDi(conObiettivo(o1, 2026, 0, 2000), 2026), 0);
  t.eq("un numero negativo non e' un obiettivo", conObiettivo({}, 2026, -3, 1)[2026].n, 0);
  t.eq("…nemmeno arrivato dallo storage", obiettivoDi({ 2026: { n: -5, t: 1 } }, 2026), 0);

  const qui2 = { 2026: { n: 24, t: 5000 }, 2025: { n: 12, t: 10 } };
  const lassu2 = { 2026: { n: 30, t: 9000 } };
  const fo = fondiObiettivi(qui2, lassu2);
  t.eq("vince la scelta piu' recente", fo[2026].n, 30);
  t.eq("l'anno che ha solo un lato resta", fo[2025].n, 12);
  t.eq("anche nell'altro verso", fondiObiettivi(lassu2, qui2)[2026].n, 30);
  // lo zero scelto dopo deve spegnere l'obiettivo anche sull'altro dispositivo
  t.eq("lo zero recente vince", fondiObiettivi({ 2026: { n: 0, t: 99 } }, { 2026: { n: 24, t: 50 } })[2026].n, 0);
  t.eq("valori storti si scartano", JSON.stringify(fondiObiettivi({ 2026: { n: "boh", t: 1 } })), "{}");

  // ---- il passo --------------------------------------------------------------
  const meta = ore(2026, 7, 2, 12); // circa meta' anno
  t.vicino("a luglio e' passata circa meta' dell'anno", frazioneAnno(2026, meta), 0.5, 0.01);
  t.eq("a meta' anno 12 su 24 sei in pari", passoObiettivo(12, 24, 2026, meta).passo, "in pari col passo");
  t.eq("7 su 24 a luglio sei indietro", passoObiettivo(7, 24, 2026, meta).passo, "indietro di 5 libri");
  t.eq("14 su 24 a luglio sei avanti", passoObiettivo(14, 24, 2026, meta).passo, "in anticipo di 2 libri");
  t.eq("il singolare", passoObiettivo(13, 24, 2026, meta).passo, "in anticipo di un libro");
  t.eq("raggiunto e' raggiunto, qualunque sia la data", passoObiettivo(24, 24, 2026, ore(2026, 3, 1, 12)).passo, "obiettivo raggiunto ✨");
  t.eq("la barra non sfora", passoObiettivo(30, 24, 2026, meta).frazione, 1);
  t.eq("senza obiettivo non c'e' passo", passoObiettivo(5, 0, 2026, meta), null);

  // ---- la porta del diario ---------------------------------------------------
  const d = { years: [{ year: 2026, entries: [1, 2, 3] }], total: 3 };
  t.eq("con l'obiettivo la porta dice a che punto sei", rigaDiario(d, 2026, 24), "3 di 24 libri quest'anno");
  t.eq("anche a zero finiti", rigaDiario({ years: [], total: 0 }, 2026, 12), "0 di 12 libri quest'anno");
  t.eq("senza obiettivo, come prima", rigaDiario(d, 2026), "Quest'anno hai finito 3 libri");

  // ---- viaggiano nelle preferenze --------------------------------------------
  const base = { music_favs: [], music_lists: [], glossari: {}, racconti: [], reader: null, last_opened: null };
  const loc = { ...base, tempo: qui, obiettivi: qui2, updated_at: 100 };
  const rem = { ...base, tempo: lassu, obiettivi: lassu2, updated_at: 999 };
  const m = mergePrefs(loc, rem);
  t.eq("il tempo fuso non segue l'orologio delle preferenze", m.merged.tempo.tab["2026-09-23"], 300);
  t.eq("l'obiettivo fuso vince per la sua ora", m.merged.obiettivi[2026].n, 30);
  t.c("si scrive qui e si manda lassu'", m.applyLocal && m.pushRemote);
  // in pari, e con le chiavi di lassu' in un altro ordine (jsonb): fermo
  const pariVero = mergePrefs(
    { ...base, tempo: fondiTempo(disordinato), obiettivi: fo, updated_at: 5 },
    { ...base, tempo: { tel: disordinato.tel, tab: disordinato.tab }, obiettivi: { 2026: fo[2026], 2025: fo[2025] }, updated_at: 5 }
  );
  t.c("in pari non si muove niente, anche con le chiavi rimescolate", !pariVero.applyLocal && !pariVero.pushRemote, JSON.stringify(pariVero));
  // un giorno in piu' lassu' (l'altro dispositivo ha letto ieri sera):
  // scende qui, ma lassu' non c'e' niente da rimandare
  const scende = mergePrefs(
    { ...base, tempo: { tab: { "2026-09-24": 600 } }, obiettivi: {}, updated_at: 5 },
    { ...base, tempo: { tab: { "2026-09-24": 600 }, tel: { "2026-09-23": 900 } }, obiettivi: {}, updated_at: 5 }
  );
  t.c("il giorno letto sull'altro dispositivo scende qui", scende.applyLocal && scende.merged.tempo.tel["2026-09-23"] === 900);
  t.c("…e lassu' non si rimanda niente", !scende.pushRemote);
}
