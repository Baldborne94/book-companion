// LA COPERTINA SULLA SCHERMATA DI BLOCCO, il lato della pagina
// (`lib/sfondo.js`). Chiesto dal lettore: «mi appare anche se decido di
// spegnere io il dispositivo?». Il guscio Android mette lo sfondo; qui si
// decide quando parlargli e cosa mandargli.
import { readFileSync } from "node:fs";
import {
  SALUTO, CIAO, PACCHETTO, PEZZO, LATO_MAX, nelGuscio, portaDelGuscio, annotaMessaggio, messaggiVisti, fraseMessaggi, risposta, pezzi, misuraSchermo, dentroIlRettangolo, leggiSfondo, scriviSfondo, infoDalLancio, nomeAndroid, fraseEsito, frasePermesso, ricordaLancio, lancioRicordato, segnaInvio, segnaRisposta, ultimoInvio, fraseInvio, dopoIlSaluto, RISPOSTA_ENTRO, TOGLI,
} from "../src/lib/sfondo.js";

const memoria = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
};

export default async function (t) {
  const SITO = "https://book-companion-ruddy.vercel.app";
  const porta = {};

  // ---- LA PORTA E' LA STRETTA DI MANO -----------------------------------
  // come fa Chrome: dati vuoti, la porta attaccata, l'origine del sito
  t.c("la porta con dati vuoti dall'origine del sito", portaDelGuscio({ data: "", origin: SITO, ports: [porta] }, SITO) === porta);
  t.c("…o dal pacchetto, se Chrome non ha verificato l'origine", portaDelGuscio({ data: "", origin: `android-app://${PACCHETTO}`, ports: [porta] }, SITO) === porta);
  // com'e' arrivata davvero sul tablet: `android-app://` con l'host del sito
  t.c("…o da android-app:// con l'host del sito, com'e' davvero", portaDelGuscio({ data: "", origin: "android-app://book-companion-ruddy.vercel.app", ports: [porta] }, SITO) === porta);
  t.eq("ma un https di un altro sito no", portaDelGuscio({ data: "", origin: "https://book-companion-ruddy.vercel.app.evil.example", ports: [porta] }, SITO), null);
  t.c("…o senza origine", portaDelGuscio({ data: null, origin: "", ports: [porta] }, SITO) === porta);
  t.c("col saluto scritto dentro va bene da qualunque origine", portaDelGuscio({ data: SALUTO, origin: "https://altro.example", ports: [porta] }, SITO) === porta);
  t.eq("un messaggio da un'altra origine senza saluto no", portaDelGuscio({ data: "", origin: "https://altro.example", ports: [porta] }, SITO), null);
  t.eq("senza porta non c'e' stretta di mano", portaDelGuscio({ data: SALUTO, origin: SITO, ports: [] }, SITO), null);
  t.eq("niente non e' niente", portaDelGuscio(null, SITO), null);
  // la diagnosi: cosa la finestra ha visto
  const m2 = memoria();
  annotaMessaggio({ origin: SITO, data: "", ports: [porta] }, m2);
  annotaMessaggio({ origin: "", data: { a: 1 }, ports: [] }, m2);
  for (let i = 0; i < 5; i++) annotaMessaggio({ origin: "x", data: "y".repeat(80), ports: [porta, porta] }, m2);
  // il rumore del polyfill non entra: senza porta e senza «grimorio» non e' del guscio
  t.eq("un messaggio senza porta ne' parola del guscio non si annota", annotaMessaggio({ origin: SITO, data: "setImmediate$0.5$46", ports: [] }, m2), null);
  t.c("…ma il saluto scritto dentro si', anche senza porta", !!annotaMessaggio({ origin: SITO, data: "grimorio:pronto", ports: [] }, m2));
  const visti = messaggiVisti(m2);
  t.eq("si tengono gli ultimi cinque", visti.length, 5);
  t.c("i dati lunghi si accorciano", visti[3].d.length === 40 && visti[3].p === 2);
  t.eq("e il rumore non ha preso posto", visti[4].d, "grimorio:pronto");
  t.c("la frase li dice tutti", /x · «yyyy/.test(fraseMessaggi(visti)) && /2 porte/.test(fraseMessaggi(visti)));
  t.eq("senza messaggi lo si dice", fraseMessaggi([]), "nessun messaggio visto");
  t.c("una memoria rotta non esplode", messaggiVisti({ getItem: () => "{rotto" }).length === 0);
  t.c("il pacchetto e' quello di assetlinks", JSON.parse(readFileSync("public/.well-known/assetlinks.json", "utf8"))[0].target.package_name === PACCHETTO);
  t.c("e il saluto e' quello che il guscio manda", readFileSync("android/SchermataDiBlocco.java", "utf8").includes(`"${SALUTO}"`));
  const vuota = memoria();
  t.c("nel guscio il referrer e' il pacchetto", nelGuscio(`android-app://${PACCHETTO}/`, vuota) && !nelGuscio("https://google.com/", vuota) && !nelGuscio("", vuota));
  // dopo una ricarica il referrer e la query non ci sono piu': vale la memoria
  const sess = memoria();
  ricordaLancio(infoDalLancio("?guscio=1110&esito=l%3D1"), sess);
  t.c("la pagina si ricorda chi l'ha aperta", nelGuscio("", sess) && lancioRicordato(sess)?.versione === "1110");
  t.eq("…con l'esito", lancioRicordato(sess)?.esito?.l, "1");
  ricordaLancio(infoDalLancio(""), sess);
  t.eq("un avvio senza guscio non cancella la memoria", lancioRicordato(sess)?.versione, "1110");
  t.c("senza memoria niente", !lancioRicordato(memoria()) && !lancioRicordato({ getItem: () => "{rotto" }));

  // ---- LA RISPOSTA ------------------------------------------------------
  t.eq("ok", JSON.stringify(risposta("grimorio:sfondo:ok")), '{"ok":true}');
  t.eq("un guasto, con la sua ragione", risposta("grimorio:sfondo:errore:non permesso")?.errore, "non permesso");
  t.eq("un guasto muto ha comunque una ragione", risposta("grimorio:sfondo:errore:")?.errore, "guasto sconosciuto");
  t.eq("altro non e' una risposta", risposta("grimorio:pronto"), null);

  // ---- L'ULTIMA COPERTINA MANDATA, E COSA NE HA DETTO IL GUSCIO ----------
  // sul tablet la schermata di blocco mostrava il libro di prima: da fuori
  // non si vedeva se la pagina avesse mandato o il guscio risposto
  const inv = memoria();
  t.c("senza invii lo si dice", /Nessuna copertina mandata/.test(fraseInvio(ultimoInvio(inv))));
  const q = Date.parse("2026-11-05T22:10:00");
  // l'ora e' quella del dispositivo: qui si guarda che ci sia, non quale
  const ora = new Date(q).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  segnaInvio({ id: "lb", titolo: "Asterix", quando: q, esito: "mandata" }, inv);
  t.c("appena mandata si aspetta la risposta", fraseInvio(ultimoInvio(inv), q + 1000).includes(`«Asterix» alle ${ora} · in attesa della risposta`), fraseInvio(ultimoInvio(inv), q + 1000));
  t.c("dopo un po' il silenzio e' un canale morto", /il guscio non ha risposto/.test(fraseInvio(ultimoInvio(inv), q + RISPOSTA_ENTRO + 1)));
  segnaRisposta(risposta("grimorio:sfondo:ok"), inv);
  t.c("l'ok del guscio si segna sull'invio", fraseInvio(ultimoInvio(inv), q + 999999).includes(`«Asterix» alle ${ora} · messa.`));
  segnaRisposta(risposta("grimorio:sfondo:errore:non permesso"), inv);
  t.c("e il guasto pure, con la sua ragione", /guasto: non permesso/.test(fraseInvio(ultimoInvio(inv))));
  t.c("una risposta che non e' una risposta non tocca niente", /guasto: non permesso/.test(fraseInvio(segnaRisposta(null, inv))));
  t.c("senza copertina non parte, e lo si dice", /«Asterix».*senza copertina/.test(fraseInvio(segnaInvio({ id: "lb", titolo: "Asterix", quando: q, esito: "senza copertina" }, inv))));
  t.c("una copertina che non si legge non parte, e lo si dice", /non si è letta/.test(fraseInvio(segnaInvio({ id: "lb", titolo: "Asterix", quando: q, esito: "illeggibile" }, inv))));
  t.c("senza titolo vale l'id", /«lb»/.test(fraseInvio({ id: "lb", quando: q, esito: "ok" })));
  t.c("una memoria rotta vuol dire nessun invio", ultimoInvio({ getItem: () => "{rotto" }) === null && !segnaRisposta({ ok: true }, memoria()));
  // spegnendo si toglie: il guscio risponde «tolto»
  t.eq("lo sfondo tolto e' un ok a parte", JSON.stringify(risposta("grimorio:sfondo:tolto")), '{"ok":true,"tolto":true}');
  t.eq("e quello rimesso un altro", JSON.stringify(risposta("grimorio:sfondo:rimesso")), '{"ok":true,"tolto":true,"rimesso":true}');
  t.c("il guscio salva lo sfondo di prima e lo rimette", readFileSync("android/SchermataDiBlocco.java", "utf8").includes('RIMESSO = "grimorio:sfondo:rimesso"') && /getWallpaperFile\(WallpaperManager\.FLAG_LOCK\)[\s\S]*wm\.setStream\(in, null, true, WallpaperManager\.FLAG_LOCK\)/.test(readFileSync("android/SchermataDiBlocco.java", "utf8")) && readFileSync("android/SchermataDiBlocco.java", "utf8").includes("boolean salvato = salvaPrima(app, wm);"));
  t.c("e il lanciatore chiede il permesso di leggerlo", readFileSync("android/GuscioActivity.java", "utf8").includes("shouldLaunchImmediately") && readFileSync("android/GuscioActivity.java", "utf8").includes("launchTwa()"));
  // una finestra chiusa senza risposta non e' un no (l'APK 1126 lo credeva)
  t.c("una richiesta annullata non vale come diniego", /if \(esiti == null \|\| esiti\.length == 0\) return;/.test(readFileSync("android/SchermataDiBlocco.java", "utf8")));
  // un no vale per questa apertura dell'app, non per sempre; e la copertina
  // si mette lo stesso, dicendo che lo sfondo di prima non si e' salvato
  const blocco = readFileSync("android/SchermataDiBlocco.java", "utf8");
  t.c("il no non si scrive su disco: ferma le richieste finche' il processo vive", /negataQui = esiti\[0\] != PackageManager\.PERMISSION_GRANTED;/.test(blocco) && !/LETTURA_NEGATA/.test(blocco) && /&& !negataQui;/.test(blocco));
  t.c("senza una risposta la copertina da parte non si rimette (richiederebbe la finestra senza fine)", /if \(!fileAttesa\(app\)\.exists\(\) \|\| !\(leggibile\(app\) \|\| negataQui\)\) return;/.test(blocco));
  t.c("negato, la copertina si mette senza lo sfondo di prima e lo dice con lo stato", /esito = salvato \? OK : OK_SENZA_PRIMA \+ " " \+ statoPermesso\(app\);/.test(blocco) && blocco.includes('OK_SENZA_PRIMA = "grimorio:sfondo:ok:senzaprima"'));
  t.c("«non chiedere piu'» apre la pagina dell'app nelle impostazioni, solo per una copertina", /getBooleanExtra\(SchermataDiBlocco\.DA_COPERTINA, false\)[\s\S]*!shouldShowRequestPermissionRationale\([\s\S]*apriImpostazioniApp\(this\);[\s\S]*dopoIlPermesso\(this\);/.test(readFileSync("android/PermessoActivity.java", "utf8")) && blocco.includes("ACTION_APPLICATION_DETAILS_SETTINGS"));
  t.eq("messa senza lo sfondo di prima, con lo stato", JSON.stringify(risposta("grimorio:sfondo:ok:senzaprima w=0;x=0;y=1")), '{"ok":true,"senzaPrima":true,"stato":"w=0;x=0;y=1"}');
  t.eq("…anche senza stato", JSON.stringify(risposta("grimorio:sfondo:ok:senzaprima")), '{"ok":true,"senzaPrima":true,"stato":null}');
  const sp = memoria();
  segnaInvio({ id: "lb", titolo: "Asterix", quando: Date.now(), esito: "mandata" }, sp);
  segnaRisposta(risposta("grimorio:sfondo:ok:senzaprima w=0;x=0;y=1"), sp);
  t.eq("…si segna come tale", ultimoInvio(sp).esito, "ok senza prima");
  t.c("…e la riga dice la strada delle impostazioni Android, con lo stato", /messa, ma lo sfondo di prima non si è potuto salvare.*Autorizzazioni → Archiviazione.*\(w=0;x=0;y=1\)\.$/.test(fraseInvio(ultimoInvio(sp))));
  const java = readFileSync("android/SchermataDiBlocco.java", "utf8");
  t.c("il guscio ascolta la richiesta di togliere e risponde con la sua parola", java.includes(`TOGLI = "${TOGLI}"`) && java.includes('TOLTO = "grimorio:sfondo:tolto"') && java.includes("wm.clear(WallpaperManager.FLAG_LOCK)"));
  const tg = memoria();
  segnaInvio({ quando: q, esito: "togli" }, tg);
  t.c("chiesto di togliere, si aspetta", /Sfondo da togliere.*in attesa/.test(fraseInvio(ultimoInvio(tg), q + 1000)));
  t.c("…e il silenzio e' un canale morto", /Sfondo da togliere.*non ha risposto/.test(fraseInvio(ultimoInvio(tg), q + RISPOSTA_ENTRO + 1)));
  segnaRisposta(risposta("grimorio:sfondo:tolto"), tg);
  t.c("tolto: quello di prima non si era salvato", /Sfondo tolto alle .*Android ha messo il suo/.test(fraseInvio(ultimoInvio(tg))));
  segnaInvio({ quando: q, esito: "togli" }, tg);
  segnaRisposta(risposta("grimorio:sfondo:rimesso"), tg);
  t.c("rimesso: la schermata di blocco e' tornata a quello di prima", /Sfondo rimesso alle .*quello di prima/.test(fraseInvio(ultimoInvio(tg))));
  segnaInvio({ quando: q, esito: "togli" }, tg);
  segnaRisposta(risposta("grimorio:sfondo:errore:no"), tg);
  t.c("un guasto nel togliere si dice come tale", /Sfondo da togliere.*guasto nel togliere: no/.test(fraseInvio(ultimoInvio(tg))));
  // al saluto si rimanda quel che non ha avuto l'ok: la porta di prima era morta
  t.eq("una copertina confermata non si rimanda", dopoIlSaluto("lb:10:0", "lb:10:0"), "lb:10:0");
  t.eq("una mandata senza ok si rimanda", dopoIlSaluto("lb:10:0", null), null);
  t.eq("…anche se l'ok era di un'altra", dopoIlSaluto("lb:10:1", "lb:10:0"), null);
  t.eq("niente mandato, niente da ricordare", dopoIlSaluto(null, null), null);

  // ---- A PEZZI ----------------------------------------------------------
  const b64 = "A".repeat(PEZZO * 2 + 10);
  const p = pezzi("libro1", b64).map((s) => JSON.parse(s).sfondo);
  t.eq("tre pezzi per due pezzi e dieci", p.length, 3);
  t.c("numerati, con quanti sono", p.every((x, i) => x.i === i && x.n === 3 && x.id === "libro1"));
  t.eq("e rimessi insieme sono l'immagine", p.map((x) => x.dati).join(""), b64);
  t.c("nessun pezzo supera il massimo", p.every((x) => x.dati.length <= PEZZO));
  t.eq("un'immagine piccola e' un pezzo solo", pezzi("x", "abc").length, 1);

  // ---- LA MISURA DELLO SCHERMO ------------------------------------------
  t.eq("il tablet del lettore, in pixel veri e in piedi", JSON.stringify(misuraSchermo({ width: 902, height: 1503, dpr: 1.33 })), JSON.stringify({ w: 1200, h: 1999 }));
  t.eq("sdraiato, lo stesso sfondo in piedi", JSON.stringify(misuraSchermo({ width: 1503, height: 902, dpr: 1.33 })), JSON.stringify({ w: 1200, h: 1999 }));
  const grande = misuraSchermo({ width: 1440, height: 3200, dpr: 1 });
  t.c("sopra il tetto si riduce tenendo le proporzioni", grande.h === LATO_MAX && Math.abs(grande.w / grande.h - 1440 / 3200) < 0.01, JSON.stringify(grande));
  t.eq("senza misure non si esplode", JSON.stringify(misuraSchermo({})), JSON.stringify({ w: 1, h: 1 }));

  // ---- INTERA DENTRO LO SCHERMO -----------------------------------------
  const r = dentroIlRettangolo(600, 900, 1200, 1999);
  t.eq("una copertina 2:3 su uno schermo 3:5 tocca i lati", r.w, 1200);
  t.c("…e sta in mezzo in altezza", r.h === 1800 && r.y === 99 && r.x === 0, JSON.stringify(r));
  const s = dentroIlRettangolo(1000, 1000, 1200, 1999);
  t.c("una quadrata tocca i lati e sta in mezzo", s.w === 1200 && s.h === 1200 && s.y === 399, JSON.stringify(s));
  t.eq("senza misure niente", dentroIlRettangolo(0, 10, 100, 100), null);

  // ---- LA SCELTA --------------------------------------------------------
  const m = memoria();
  t.c("spento finche' non lo accendi", !leggiSfondo(m));
  t.c("acceso resta acceso", scriviSfondo(true, m) && leggiSfondo(m));
  t.c("e spento resta spento", !scriviSfondo(false, m) && !leggiSfondo(m));
  t.c("una memoria rotta vuol dire spento", !leggiSfondo({ getItem: () => { throw new Error("no"); } }));

  // ---- L'INDIRIZZO DI AVVIO: QUALE GUSCIO, E COM'E' ANDATA ---------------
  t.c("la risposta al saluto e' quella che il guscio aspetta", readFileSync("android/SchermataDiBlocco.java", "utf8").includes(`CIAO = "${CIAO}"`));
  t.eq("senza query niente", JSON.stringify(infoDalLancio("")), JSON.stringify({ versione: null, android: null, esito: null }));
  t.eq("la versione del guscio", infoDalLancio("?guscio=1099").versione, "1099");
  t.eq("e quella di Android, come API", infoDalLancio("?guscio=1136&android=34").android, 34);
  t.eq("senza, null", infoDalLancio("?guscio=1136").android, null);
  t.eq("l'API in parole", nomeAndroid(34), "Android 14");
  t.eq("…anche il 10 vero", nomeAndroid(29), "Android 10");
  t.eq("…un'API ignota resta un numero", nomeAndroid(40), "Android API 40");
  t.eq("…e senza API niente", nomeAndroid(null), null);
  t.eq("una versione che non e' un numero non e' una versione", infoDalLancio("?guscio=x").versione, null);
  t.eq("«apri» resta leggibile accanto", new URLSearchParams("?apri=libreria&guscio=1099").get("apri"), "libreria");
  const e = infoDalLancio("?guscio=1099&esito=" + encodeURIComponent("l=1;k=1;n=1;u=6;s=1;c=1;r=1;v=0;p=0;a=0;f=0;e=")).esito;
  t.eq("il grezzo resta, per la foto", e.grezzo, "l=1;k=1;n=1;u=6;s=1;c=1;r=1;v=0;p=0;a=0;f=0;e=");
  t.eq("l'esito si legge passo per passo", `${e.s}${e.c}${e.r}${e.v}${e.p}`, "11100");
  t.c("…e dice dove ci si e' fermati", /origine/.test(fraseEsito(e)) && /use_as_origin/.test(fraseEsito(e)));
  t.c("la sessione non letta viene prima di tutto", /sessione/.test(fraseEsito({ l: "1", k: "1", n: "1", s: "0", c: "1", r: "1" })));
  t.c("un guasto si accoda alla frase", /— boom$/.test(fraseEsito({ l: "1", k: "1", n: "1", s: "1", c: "0", e: "boom" })));
  t.c("il canale rifiutato", /rifiutato/.test(fraseEsito({ l: "1", k: "1", n: "1", s: "1", c: "1", r: "0" })));
  t.c("il canale mai pronto", /mai stato pronto/.test(fraseEsito({ l: "1", k: "1", n: "1", s: "1", c: "1", r: "1", v: "1", p: "0" })));
  t.c("il saluto perso", /saluto.*non è mai arrivato/.test(fraseEsito({ l: "1", k: "1", n: "1", s: "1", c: "1", r: "1", v: "1", p: "1", a: "0" })));
  t.c("tutto a posto, con le copertine", /tutto a posto, 2 copertine/.test(fraseEsito({ l: "1", k: "1", n: "1", s: "1", c: "1", r: "1", v: "1", p: "1", a: "1", f: "2" })));
  t.c("tutto aperto ma niente mandato", /nessuna copertina/.test(fraseEsito({ l: "1", k: "1", n: "1", s: "1", c: "1", r: "1", v: "1", p: "1", a: "1", f: "0" })));
  t.c("il lanciatore mai creato viene prima di tutto", /lanciatore non è stato creato/.test(fraseEsito({ k: "1", n: "1", s: "1" })) && /lanciatore/.test(fraseEsito({ s: "0" })));
  // il permesso di leggere lo sfondo, in coda, in parole
  const aperto = { l: "1", k: "1", n: "1", s: "1", c: "1", r: "1", v: "1", p: "1", a: "1", f: "1" };
  t.eq("senza w/x/y la frase resta quella", fraseEsito(aperto), "tutto a posto, una copertina messa");
  t.c("concesso", /· permesso di leggere lo sfondo: concesso$/.test(fraseEsito({ ...aperto, w: "1", x: "0", y: "0" })));
  t.c("negato, con la strada delle impostazioni", /negato \(Impostazioni Android/.test(fraseEsito({ ...aperto, w: "0", x: "0", y: "1" })));
  t.c("da chiedere e mai aperta", /da chiedere, il guscio non ha ancora aperto la finestra/.test(fraseEsito({ ...aperto, w: "0", x: "1", y: "0" })));
  t.c("da chiedere, aperta una volta", /finestra aperta dal guscio una volta$/.test(fraseEsito({ ...aperto, w: "0", x: "1", y: "0", z: "1" })));
  t.c("da chiedere, aperta tre volte", /finestra aperta dal guscio 3 volte$/.test(fraseEsito({ ...aperto, w: "0", x: "1", y: "0", z: "3" })));
  t.c("mai servito", /mai servito$/.test(fraseEsito({ ...aperto, w: "0", x: "0", y: "0" })));
  t.c("il permesso non copre un passo mancato", !/permesso di leggere/.test(fraseEsito({ ...aperto, p: "0", w: "0", x: "1", y: "0" })));
  t.eq("senza esito, niente", frasePermesso(null), null);
  t.c("il callback mai creato", /callback/.test(fraseEsito({ l: "1", n: "1", s: "1" })));
  t.c("nessun evento di navigazione", /nessun evento/.test(fraseEsito({ l: "1", k: "1", s: "1" })));
  t.c("senza la pagina caricata si dice l'ultimo evento visto", /nessun evento.*ultimo evento: 6/.test(fraseEsito({ l: "1", k: "1", u: "6", s: "1" })));
  t.c("…e la pagina caricata resta tale anche se poi la scheda si nasconde", !/nessun evento/.test(fraseEsito({ l: "1", k: "1", n: "1", u: "6", s: "0" })));
  t.eq("senza esito niente frase", fraseEsito(null), null);
}
