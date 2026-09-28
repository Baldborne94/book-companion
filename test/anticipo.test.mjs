// IL SEGUITO CHE SCENDE DA SE' (`lib/anticipo.js`). Sbaglia in silenzio da
// tutt'e due i lati: un volume scaricato sul cellulare e' un giga che non
// torna, uno mai sceso e' un treno senza libro — e nessuno dei due alza un
// errore.
import {
  comeRete,
  reteBuona,
  sceltaAnticipo,
  leggiAnticipo,
  scriviAnticipo,
  daAnticipare,
  daRiprovare,
  fraseAnticipo,
  RIPROVA_DOPO,
  ANTICIPO_MAX,
  ANTICIPO_KEY,
} from "../src/lib/anticipo.js";
import { nextInSaga } from "../src/lib/saga.js";

const deposito = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m };
};

export default async function (t) {
  // --- la rete ---
  t.eq("senza l'API (Firefox) la rete e' ignota, mai libera", comeRete(undefined), "ignota");
  t.eq("il tipo che il browser non dice e' ignoto", comeRete({ type: "unknown" }), "ignota");
  t.eq("il Wi-Fi e' libero", comeRete({ type: "wifi" }), "libera");
  t.eq("il cavo e' libero", comeRete({ type: "ethernet" }), "libera");
  t.eq("il cellulare e' a consumo", comeRete({ type: "cellular" }), "a consumo");
  t.eq("il risparmio dati vince sul Wi-Fi", comeRete({ type: "wifi", saveData: true }), "a consumo");

  t.c("«Solo in Wi-Fi» in Wi-Fi scarica", reteBuona("wifi", { type: "wifi" }));
  t.c("«Solo in Wi-Fi» sul cellulare no", !reteBuona("wifi", { type: "cellular" }));
  t.c("«Solo in Wi-Fi» su una rete che non si sa no", !reteBuona("wifi", undefined));
  t.c("«Sempre» su una rete che non si sa si'", reteBuona("sempre", undefined));
  t.c("«Sempre» sul cellulare dichiarato NO", !reteBuona("sempre", { type: "cellular" }));
  t.c("«Sempre» col risparmio dati NO", !reteBuona("sempre", { saveData: true }));
  t.c("«Mai» nemmeno in Wi-Fi", !reteBuona("mai", { type: "wifi" }));
  t.c("una scelta storta vale «Solo in Wi-Fi», non «Sempre»", !reteBuona("boh", undefined));

  // --- la scelta sul dispositivo ---
  t.eq("scelta storta → partenza", sceltaAnticipo("sempreee"), "wifi");
  const d = deposito();
  t.eq("mai scelto → Solo in Wi-Fi", leggiAnticipo(d), "wifi");
  scriviAnticipo("sempre", d);
  t.eq("la scelta resta", leggiAnticipo(d), "sempre");
  d.m.set(ANTICIPO_KEY, "xyz");
  t.eq("uno storage storto non accende niente", leggiAnticipo(d), "wifi");
  t.eq("uno storage che esplode vale la partenza", leggiAnticipo({ getItem() { throw new Error("no"); } }), "wifi");

  // --- quale volume ---
  const libro = { id: "a", saga: "S", sagaOrder: 1 };
  const dopo = { id: "b", saga: "S", sagaOrder: 2, title: "B" };
  const base = { prossimo: dopo, progresso: 0.8, qui: () => false, lassu: () => ({ byte: 1e6 }) };
  t.eq("a 80% col seguito lassu' scende", daAnticipare(libro, base)?.id, "b");
  t.eq("a meta' libro non ancora", daAnticipare(libro, { ...base, progresso: 0.5 }), null);
  t.eq("esattamente alla soglia si'", daAnticipare(libro, { ...base, progresso: 0.7 })?.id, "b");
  t.eq("progresso che non e' un numero: no", daAnticipare(libro, { ...base, progresso: undefined }), null);
  t.eq("senza seguito niente", daAnticipare(libro, { ...base, prossimo: null }), null);
  t.eq("gia' qui non si riscarica", daAnticipare(libro, { ...base, qui: (id) => id === "b" }), null);
  t.eq("un ebook tolto a mano non scende", daAnticipare(libro, { ...base, prossimo: { ...dopo, fileTolto: true } }), null);
  t.eq("che non sta da nessuna parte non si chiede", daAnticipare(libro, { ...base, lassu: () => null }), null);
  t.eq("nel secchio senza misura scende", daAnticipare(libro, { ...base, lassu: () => true })?.id, "b");
  t.eq("oltre il tetto non scende di nascosto", daAnticipare(libro, { ...base, lassu: () => ({ byte: ANTICIPO_MAX + 1 }) }), null);
  t.eq("al tetto esatto si'", daAnticipare(libro, { ...base, lassu: () => ({ byte: ANTICIPO_MAX }) })?.id, "b");

  // la catena con `nextInSaga` vera: il seguito e' quello che la scheda di
  // fine libro propone, non il primo che capita
  const saga = [
    { id: "1", saga: "S", sagaOrder: 1, title: "Uno" },
    { id: "2", saga: "S", sagaOrder: 2, title: "Due" },
    { id: "3", saga: "S", sagaOrder: 3, title: "Tre" },
  ];
  const stato = { "1": "reading", "2": "unread", "3": "unread" };
  const prossimo = nextInSaga(saga[0], saga, (id) => stato[id], () => 0);
  t.eq("dalla catena: il volume due, non il tre", daAnticipare(saga[0], { ...base, prossimo })?.id, "2");

  // --- i tentativi ---
  t.c("mai provato: si prova", daRiprovare(undefined, 0));
  t.c("in volo: no", !daRiprovare({ ora: 0 }, RIPROVA_DOPO * 10));
  t.c("sceso: mai piu'", !daRiprovare({ ora: 0, esito: "sceso" }, RIPROVA_DOPO * 10));
  t.c("lassu' non c'e': non in questa sessione", !daRiprovare({ ora: 0, esito: "assente" }, RIPROVA_DOPO * 10));
  t.c("chiave scaduta: non alla voltata dopo", !daRiprovare({ ora: 0, esito: "chiave" }, RIPROVA_DOPO - 1));
  t.c("chiave scaduta: dopo un po' si'", daRiprovare({ ora: 0, esito: "chiave" }, RIPROVA_DOPO));
  t.c("errore: dopo un po' si'", daRiprovare({ ora: 0, esito: "errore" }, RIPROVA_DOPO));

  // --- la riga ---
  t.c("su Firefox con «Solo in Wi-Fi» lo dice", /non dice che rete/.test(fraseAnticipo("wifi", undefined)));
  t.c("con «Sempre» su Firefox non lo ripete", !/non dice che rete/.test(fraseAnticipo("sempre", undefined)));
  t.c("sul cellulare dice che aspetta", /a consumo/.test(fraseAnticipo("wifi", { type: "cellular" })));
  t.c("il risparmio dati si nomina", /risparmio dati/.test(fraseAnticipo("sempre", { saveData: true })));
  t.c("«Sempre» su una rete ignota dice che puo' essere il cellulare", /cellulare/.test(fraseAnticipo("sempre", undefined)));
  t.c("in Wi-Fi lo dice", /Wi‑Fi/.test(fraseAnticipo("wifi", { type: "wifi" })));
  t.c("«Mai» dice quando scende", /quando lo apri/.test(fraseAnticipo("mai", { type: "wifi" })));
  for (const s of ["wifi", "sempre", "mai"])
    for (const c of [undefined, { type: "wifi" }, { type: "cellular" }, { saveData: true }])
      t.c(`frase piena per ${s}/${JSON.stringify(c)}`, !!fraseAnticipo(s, c) && !/undefined/.test(fraseAnticipo(s, c)));
}
