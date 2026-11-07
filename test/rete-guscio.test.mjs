// LA RETE DEL GUSCIO (`lib/reteGuscio.js`): la pagina chiede al guscio
// Android, che chiede a MangaDex col nome dell'app (la sfida anti-bot
// respinge le pagine web) e rimanda il corpo a pezzi in base64.
import { readFileSync } from "node:fs";
import { nuovaReteGuscio, rispostaFinta, SA_RETE, SENZA_GUSCIO, ATTESA_RETE, INSIEME } from "../src/lib/reteGuscio.js";

const b64 = (s) => Buffer.from(s).toString("base64");

export default async function (t) {
  const mandati = [];
  // i tempi finti: un timer per richiesta, e si fanno scattare a mano
  const timer = new Map();
  let prossimoTimer = 1;
  const aspetta = (f, ms) => {
    const id = prossimoTimer++;
    timer.set(id, { f, ms });
    return id;
  };
  const smetti = (id) => timer.delete(id);
  const scatta = () => {
    for (const [id, x] of [...timer]) {
      timer.delete(id);
      x.f();
    }
  };
  const rete = nuovaReteGuscio((s) => mandati.push(JSON.parse(s)), { aspetta, smetti });

  // una richiesta: il messaggio al guscio
  const p1 = rete.fetch("https://api.mangadex.org/manga?title=berserk");
  t.eq("la richiesta parte col suo numero e l'indirizzo", JSON.stringify(mandati[0]), JSON.stringify({ rete: { id: 1, url: "https://api.mangadex.org/manga?title=berserk", metodo: "GET" } }));
  t.eq("…e aspetta, col tetto", [...timer.values()][0].ms, ATTESA_RETE);
  // la risposta a pezzi, fuori ordine, col pezzo di un'altra richiesta in mezzo
  const json = JSON.stringify({ result: "ok", data: [{ id: "b1" }] });
  const tutto = b64(json);
  const a = tutto.slice(0, 10);
  const b = tutto.slice(10);
  t.c("un messaggio che non e' della rete non si tocca", rete.ricevi("grimorio:sfondo:ok") === false && rete.ricevi(null) === false);
  t.c("un pezzo di una richiesta che non c'e' si ignora", rete.ricevi(JSON.stringify({ rete: { id: 99, i: 0, n: 1, stato: 200, dati: "" } })) === true);
  const primoTimer = [...timer.keys()][0];
  rete.ricevi(JSON.stringify({ rete: { id: 1, i: 1, n: 2, stato: 200, tipo: "application/json", dati: b } }));
  t.eq("a meta' la richiesta e' ancora in volo", rete.inVolo, 1);
  t.c("…e l'attesa ripartita col pezzo: un tetto nuovo al posto del vecchio", timer.size === 1 && [...timer.keys()][0] !== primoTimer);
  rete.ricevi(JSON.stringify({ rete: { id: 1, i: 0, n: 2, stato: 200, tipo: "application/json", dati: a } }));
  const r1 = await p1;
  t.c("ricomposta, e' una risposta come quella del browser", r1.ok && r1.status === 200 && r1.headers.get("Content-Type") === "application/json");
  t.eq("…col corpo giusto", (await r1.json()).data[0].id, "b1");
  t.eq("…e niente piu' in volo ne' in attesa", `${rete.inVolo}/${timer.size}`, "0/0");

  // i byte di un'immagine, e la cache del nodo
  const p2 = rete.fetch("https://nodo.mangadex.network/data/h/1.png");
  const png = Buffer.from([137, 80, 78, 71, 0, 255]);
  rete.ricevi(JSON.stringify({ rete: { id: 2, i: 0, n: 1, stato: 200, tipo: "image/png", cache: "HIT", dati: png.toString("base64") } }));
  const r2 = await p2;
  const byte = new Uint8Array(await r2.arrayBuffer());
  t.c("i byte arrivano intatti, anche lo 0 e il 255", byte.length === 6 && byte[0] === 137 && byte[4] === 0 && byte[5] === 255);
  t.eq("la cache del nodo si legge", r2.headers.get("x-cache"), "HIT");

  // un 403 resta un 403 (la sfida, se il guscio non passasse)
  const p3 = rete.fetch("https://api.mangadex.org/x");
  rete.ricevi(JSON.stringify({ rete: { id: 3, i: 0, n: 1, stato: 403, dati: b64("Bot challenge not passed") } }));
  const r3 = await p3;
  t.c("un 403 non e' ok, e il testo si legge", !r3.ok && r3.status === 403 && (await r3.text()) === "Bot challenge not passed");
  // un corpo vuoto
  const p3b = rete.fetch("https://api.mangadex.network/report", { method: "POST", body: '{"a":1}', headers: { "content-type": "application/json" } });
  t.eq("un POST porta metodo, corpo e tipo", JSON.stringify(mandati[3].rete), JSON.stringify({ id: 4, url: "https://api.mangadex.network/report", metodo: "POST", corpo: '{"a":1}', tipoCorpo: "application/json" }));
  rete.ricevi(JSON.stringify({ rete: { id: 4, i: 0, n: 1, stato: 204, dati: "" } }));
  t.c("un corpo vuoto va", (await p3b).status === 204);

  // il guasto del guscio
  const p4 = rete.fetch("https://altrove.example/x");
  rete.ricevi(JSON.stringify({ rete: { id: 5, errore: "indirizzo non permesso: altrove.example" } }));
  t.eq("un guasto del guscio arriva come errore", await p4.catch((e) => e.message), "indirizzo non permesso: altrove.example");
  t.eq("…e la richiesta non resta in volo", rete.inVolo, 0);

  // il guscio che tace: il tetto, dopo un rimando sulla porta di adesso
  const p5 = rete.fetch("https://api.mangadex.org/y");
  const primaDelRimando = mandati.length;
  scatta();
  t.eq("scaduta senza un pezzo, la richiesta si rimanda una volta", mandati.length, primaDelRimando + 1);
  t.c("…col numero nuovo e lo stesso indirizzo", mandati.at(-1).rete.id !== mandati.at(-2).rete.id && mandati.at(-1).rete.url === "https://api.mangadex.org/y");
  scatta();
  // una promessa che non si chiude non deve far finire il test in silenzio
  const ancoraAppesa = new Promise((ok) => setTimeout(() => ok("ancora appesa"), 50));
  t.eq("un guscio che tace fa scadere l'attesa, e lo dice", await Promise.race([p5.catch((e) => e.message), ancoraAppesa]), SENZA_GUSCIO);
  t.eq("…senza lasciare niente in volo", rete.inVolo, 0);
  // una porta che non si lascia scrivere
  const rotta = nuovaReteGuscio(() => {
    throw new Error("porta chiusa");
  }, { aspetta, smetti });
  t.eq("una porta chiusa e' un guscio che non risponde", await rotta.fetch("https://api.mangadex.org/z").catch((e) => e.message), SENZA_GUSCIO);
  t.eq("…e il suo tetto si toglie", rotta.inVolo + timer.size, 0);
  t.eq("…e una porta chiusa non si riprova", timer.size, 0);

  // LA FILA: al guscio ne arrivano al piu' INSIEME, il tetto parte alla partenza
  const posta2 = [];
  const fila = nuovaReteGuscio((x) => posta2.push(JSON.parse(x).rete), { aspetta, smetti });
  const tante = ["a", "b", "c", "d"].map((x) => fila.fetch(`https://uploads.mangadex.org/covers/${x}.jpg`));
  // le ultime due restano in volo e scadranno con i tetti di dopo
  for (const x of tante) x.catch(() => {});
  t.eq("ne partono al piu' due insieme (i fili del guscio)", `${INSIEME}/${posta2.length}/${fila.partite}`, "2/2/2");
  t.eq("…le altre aspettano qui, senza tetto", `${fila.inVolo}/${timer.size}`, "4/2");
  // il guscio non ha mai visto la terza: un pezzo col suo numero non e' suo
  fila.ricevi(JSON.stringify({ rete: { id: 3, i: 0, n: 1, stato: 200, dati: "" } }));
  t.eq("un pezzo per una richiesta ancora in fila si ignora", `${fila.inVolo}/${fila.partite}`, "4/2");
  fila.ricevi(JSON.stringify({ rete: { id: posta2[0].id, i: 0, n: 1, stato: 200, dati: "" } }));
  await tante[0];
  t.eq("una che torna fa partire la prossima", posta2.map((r) => r.url.slice(-5)).join(" "), "a.jpg b.jpg c.jpg");
  t.c("…col tetto suo", timer.size === 2 && fila.partite === 2);
  fila.ricevi(JSON.stringify({ rete: { id: posta2[1].id, errore: "boh" } }));
  await tante[1].catch(() => {});
  t.eq("anche un guasto libera il posto", posta2.length, 4);

  // LE FIGURE DOPO: il feed passa davanti alle copertine in fila
  const posta3 = [];
  const pri = nuovaReteGuscio((x) => posta3.push(JSON.parse(x).rete), { aspetta, smetti, insieme: 1 });
  const fig = ["1", "2", "3"].map((x) => pri.fetch(`https://uploads.mangadex.org/c/${x}.jpg`, { priorita: "bassa" }));
  const api = pri.fetch("https://api.mangadex.org/manga/op/feed");
  const fig4 = pri.fetch("https://uploads.mangadex.org/c/4.jpg", { priorita: "bassa" });
  // il guscio risponde a quel che gli arriva, una alla volta
  for (let k = 0; k < 5; k++) pri.ricevi(JSON.stringify({ rete: { id: posta3[k].id, i: 0, n: 1, stato: 200, dati: "" } }));
  await Promise.all([...fig, api, fig4]);
  t.eq("la richiesta dell'API passa davanti alle figure in fila, le figure restano in ordine", posta3.map((r) => r.url.split("/").pop()).join(" "), "1.jpg feed 2.jpg 3.jpg 4.jpg");

  // UNA RETE PER TUTTE LE PORTE: la porta cambia, la risposta trova la sua richiesta
  const vecchia = [];
  const nuova = [];
  const sola = nuovaReteGuscio((x) => vecchia.push(JSON.parse(x).rete), { aspetta, smetti });
  const feed = sola.fetch("https://api.mangadex.org/manga/op/feed");
  sola.porta((x) => nuova.push(JSON.parse(x).rete));
  sola.ricevi(JSON.stringify({ rete: { id: vecchia[0].id, i: 0, n: 1, stato: 200, dati: b64("{}") } }));
  t.eq("la risposta arrivata dalla porta nuova chiude la richiesta partita dalla vecchia", (await feed).status, 200);
  const dopo = sola.fetch("https://api.mangadex.org/manga/op");
  t.c("le richieste dopo vanno dalla porta nuova, col numero che continua", nuova.length === 1 && nuova[0].id > vecchia[0].id);
  const vecchiaRichiesta = nuova[0].id;
  scatta();
  t.c("il rimando va dalla porta di adesso", nuova.length === 2 && nuova[1].id !== vecchiaRichiesta);
  sola.ricevi(JSON.stringify({ rete: { id: vecchiaRichiesta, i: 0, n: 1, stato: 500, dati: "" } }));
  t.eq("una risposta tardiva al numero di prima non si mescola", sola.inVolo, 1);
  sola.ricevi(JSON.stringify({ rete: { id: nuova[1].id, i: 0, n: 1, stato: 200, dati: "" } }));
  t.eq("…e quella del rimando chiude la richiesta", (await dopo).status, 200);
  // un pezzo arrivato toglie il rimando: una risposta lenta ma viva non si ripete
  const lenta = sola.fetch("https://api.mangadex.org/lenta");
  const quante = nuova.length;
  sola.ricevi(JSON.stringify({ rete: { id: nuova.at(-1).id, i: 0, n: 2, stato: 200, dati: "" } }));
  scatta();
  t.eq("scaduta a meta' non si rimanda, si dice", `${nuova.length - quante}/${await lenta.catch((e) => e.message)}`, `0/${SENZA_GUSCIO}`);
  t.c("la risposta finta senza stato non e' ok", !rispostaFinta().ok && rispostaFinta({ stato: 299 }).ok && !rispostaFinta({ stato: 300 }).ok);

  // il guscio: solo MangaDex, solo https, col nome dell'app, e lo dice dopo il saluto
  const java = readFileSync("android/SchermataDiBlocco.java", "utf8");
  t.c("il guscio dice che sa chiedere, dopo il saluto", java.includes(`SA_RETE = "${SA_RETE}"`) && /postMessage\(SALUTO, null\)[\s\S]{0,200}s\.postMessage\(SA_RETE, null\);/.test(java));
  t.c("il guscio passa i messaggi della rete prima dello sfondo", /JSONObject rete = radice\.optJSONObject\("rete"\);\s*if \(rete != null\) \{\s*chiediAllaRete\(app, rete\);/.test(java));
  t.c("solo https e solo gli indirizzi di MangaDex", /!"https"\.equals\(u\.getProtocol\(\)\) \|\| !ospitePermesso\(u\.getHost\(\)\)/.test(java) && /h\.equals\("api\.mangadex\.org"\) \|\| h\.equals\("uploads\.mangadex\.org"\) \|\| h\.equals\("api\.mangadex\.network"\) \|\| h\.endsWith\("\.mangadex\.network"\)/.test(java));
  t.c("col nome dell'app, non quello di un browser", /setRequestProperty\("User-Agent", nomeDellApp\(app\)\)/.test(java) && /"BookCompanion\/" \+ versione\(c\)/.test(java));
  t.c("il corpo torna a pezzi in base64, con lo stato in ogni pezzo", /Base64\.encodeToString\(dati, Base64\.NO_WRAP\)/.test(java) && /dentro\.put\("stato", stato\);/.test(java) && /PEZZO_RETE = 48000/.test(java));
  t.c("una risposta troppo grande si ferma", /out\.size\(\) \+ n > RETE_MAX/.test(java));
}
