import { readFileSync } from "node:fs";
// LE SERIE SEGUITE SU MANGADEX (`lib/mangadex.js`): la fonte con la rete
// finta nella forma vera dell'API, il CBZ che ne esce riaperto col lettore
// dei fumetti dell'app, e la lista delle serie seguite con i capitoli nuovi.
import {
  cerca, capitoli, pagine, scaricaCapitolo, comicInfo, nomeFile, nomeCapitolo, titoloDi, scegliCapitoli, daFeed, daRicerca,
  nuovoRitmo, spiega, messaggioSeguite, statoAvvisi, fraseAvvisi, serieDalLancio, STATO_AVVISI, DNS_BLOCCA, indirizzoPrivato, GUSCIO_MUTO, respintaDalGuscio, segnalaPagina, leggiSerie, scriviSerie, segui, smetti, cambiaLingua, conCapitoli, visti, nuoviInTutto, fraseSerie,
  nellaBiblioteca, daScaricare, fraseScarico, copertinaUrl, PAGINA_FEED, COPERTINE, RAPPORTO, BASE, SFIDA,
} from "../src/lib/mangadex.js";
import { apriArchivio, leggiComicInfo, eComicInfo } from "../src/lib/fumetto.js";

const memoria = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};
const risposta = (json, status = 200, headers = {}) => ({ ok: status < 400, status, json: async () => json, headers: { get: (k) => headers[k.toLowerCase()] ?? null } });
const byte = (n) => new Uint8Array([0xff, 0xd8, 0xff, n, 1, 2, 3]);

// la forma vera dell'API, presa dalle risposte di MangaDex per Berserk
const MANGA = (id, en, altri = {}) => ({
  id, type: "manga",
  attributes: { title: { en }, altTitles: [{ ja: "ベルセルク" }], year: 1989, status: "ongoing", originalLanguage: "ja", availableTranslatedLanguages: ["en", "it", "fr"], ...altri },
  relationships: [{ type: "author", attributes: { name: "Miura Kentarou" } }, { type: "cover_art", attributes: { fileName: "cop.jpg" } }],
});
const CAP = (id, chapter, pages, extra = {}) => ({
  id, type: "chapter",
  attributes: { chapter, title: extra.title || "", pages, translatedLanguage: "en", publishAt: extra.data || "2025-01-01T00:00:00+00:00", externalUrl: extra.esterno || null, volume: null },
  relationships: [{ type: "scanlation_group", attributes: { name: extra.gruppo || "TAMT" } }],
});

export default async function (t) {
  const chieste = [];
  const feedPagine = [];
  const fetch = async (url, opzioni) => {
    chieste.push(url);
    const u = new URL(url);
    if (u.pathname === "/manga") return risposta({ result: "ok", data: [MANGA("b1", "Berserk"), MANGA("b2", "Boushoku no Berserk", { title: { "ja-ro": "Boushoku no Berserk" }, availableTranslatedLanguages: ["en"] })] });
    if (u.pathname === "/manga/b1/feed") {
      const offset = Number(u.searchParams.get("offset"));
      feedPagine.push(offset);
      // 502 capitoli: due pagine di feed, la seconda con due soli
      const tutti = [];
      for (let n = 502; n >= 1; n--) tutti.push(CAP(`c${n}`, String(n), 14));
      // il 386 anche da un altro gruppo con piu' pagine, e il 500 come rimando
      tutti.push(CAP("c386b", "386", 20, { gruppo: "Evil Genius" }));
      tutti.push(CAP("c500x", "500", 0, { esterno: "https://mangaplus.shueisha.co.jp/viewer/1", gruppo: "MangaPlus" }));
      tutti.push(CAP("oneshot", null, 5, { title: "Extra", data: "2025-06-01T00:00:00+00:00" }));
      return risposta({ result: "ok", data: tutti.slice(offset, offset + PAGINA_FEED), total: tutti.length });
    }
    if (u.pathname === "/at-home/server/c1") return risposta({ result: "ok", baseUrl: "https://nodo.mangadex.network", chapter: { hash: "h1", data: ["1-a.jpg", "2-b.png", "3-c.jpg"], dataSaver: [] } });
    if (u.pathname === "/at-home/server/vuoto") return risposta({ result: "ok", baseUrl: "https://nodo.mangadex.network", chapter: { hash: "h0", data: [] } });
    if (u.hostname === "nodo.mangadex.network") return { ok: true, status: 200, arrayBuffer: async () => byte(Number(u.pathname.match(/\/(\d)-/)[1])).buffer, headers: { get: () => "HIT" } };
    if (u.hostname === "api.mangadex.network") return risposta({});
    return risposta({ result: "error", errors: [{ detail: "non qui" }] }, 404);
  };
  const ritmo = (f) => f();

  // la ricerca
  const trovate = await cerca("berserk", { fetch, ritmo });
  t.eq("la ricerca da' le serie col titolo inglese", trovate[0].titolo, "Berserk");
  t.eq("…l'autore", trovate[0].autore, "Miura Kentarou");
  t.eq("…la copertina piccola dal deposito", trovate[0].copertina, `${COPERTINE}/covers/b1/cop.jpg.256.jpg`);
  t.eq("…le lingue che ci interessano, in ordine", trovate[0].lingue.join(), "en,it");
  t.eq("…e la lingua d'origine, per il verso", trovate[0].originale, "ja");
  t.eq("senza titolo inglese vale la traslitterazione", trovate[1].titolo, "Boushoku no Berserk");
  t.c("la richiesta chiede copertina e autore e le nostre lingue", /includes%5B%5D=cover_art/.test(chieste[0]) && /availableTranslatedLanguage%5B%5D=it/.test(chieste[0]) && /title=berserk/.test(chieste[0]));
  t.eq("una ricerca vuota non chiede niente", (await cerca("  ", { fetch, ritmo })).length, 0);
  t.eq("il titolo: inglese, poi ja-ro, poi il primo", `${titoloDi({ ja: "x", "ja-ro": "Y" })}|${titoloDi({ ko: "K" })}|${titoloDi({}, [{ en: "Alt" }])}|${titoloDi({ en: "E", "ja-ro": "Y" })}`, "Y|K|Alt|E");

  // i capitoli: a pagine, un capitolo per numero
  const caps = await capitoli("b1", { fetch, ritmo, lingua: "en" });
  t.eq("il feed si legge a pagine fino al totale", feedPagine.join(), "0,500");
  t.eq("un capitolo per numero, piu' il fuori numero", caps.length, 503);
  t.eq("…in ordine dal piu' nuovo", caps[0].numero, 502);
  t.eq("dello stesso numero resta quello ospitato con piu' pagine", caps.find((c) => c.numero === 386).id, "c386b");
  t.eq("un rimando non copre il capitolo ospitato", caps.find((c) => c.numero === 500).id, "c500");
  t.eq("il fuori numero sta in fondo, col titolo", caps[caps.length - 1].titolo, "Extra");
  t.c("il feed chiede la lingua, il gruppo e ogni classificazione", /translatedLanguage%5B%5D=en/.test(chieste[1]) && /scanlation_group/.test(chieste[1]) && /contentRating%5B%5D=pornographic/.test(chieste[1]));
  const soloRimando = scegliCapitoli(daFeed({ data: [CAP("x", "7", 0, { esterno: "https://e" }), CAP("y", "7", 0, { esterno: "https://e2" })] }));
  t.c("un numero che ha solo rimandi tiene il rimando", soloRimando.length === 1 && soloRimando[0].esterno === "https://e");
  t.eq("un numero con la virgola si legge", daFeed({ data: [CAP("v", "12,5", 3)] })[0].numero, 12.5);

  // le pagine e il CBZ
  const p = await pagine("c1", { fetch, ritmo });
  t.eq("le pagine si compongono dal nodo, dall'hash e dai nomi", p.url[1], "https://nodo.mangadex.network/data/h1/2-b.png");
  let esploso = null;
  await pagine("vuoto", { fetch, ritmo }).catch((e) => (esploso = e.message));
  t.c("un capitolo senza pagine lo dice", /non ha pagine/.test(esploso));
  const serie = { id: "b1", titolo: "Berserk", autore: "Miura Kentarou", originale: "ja", lingua: "en" };
  const cap = { id: "c1", numero: 1, titolo: "The Black Swordsman", lingua: "en" };
  const rapporti = [];
  const passi = [];
  const file = await scaricaCapitolo(serie, cap, { fetch, ritmo, onProgress: (x) => passi.push(x.pagina), segnala: (r) => rapporti.push(r) });
  t.eq("il file si chiama con la serie e il numero a tre cifre", file.name, "Berserk 001.cbz");
  t.eq("il progresso conta le pagine", passi.join(), "0,1,2,3");
  t.eq("ogni pagina si segnala al nodo", rapporti.length, 3);
  t.c("…con esito, byte e cache", rapporti[0].ok === true && rapporti[0].byte === 7 && rapporti[0].cache === "HIT" && rapporti[0].nodo === "https://nodo.mangadex.network");
  const a = await apriArchivio(file, { rar: null, aFette: false });
  t.eq("il CBZ si apre col lettore dei fumetti e ha le pagine in fila", a.pagine.map((x) => x.nome || x).join(), a.pagine.length === 3 ? a.pagine.map((x) => x.nome || x).join() : "?");
  t.eq("…tre pagine, coi nomi in ordine", a.pagine.length, 3);
  const primaPagina = await a.leggi(0);
  t.eq("…e i byte sono quelli arrivati", new Uint8Array(primaPagina)[3], 1);
  const info = a.info;
  t.c("la scheda dentro dice serie, numero, autore e verso da destra", info && info.serie === "Berserk" && info.numero === 1 && info.autore === "Miura Kentarou" && info.verso === "rtl" && info.manga && info.titolo === "The Black Swordsman");
  t.c("la scheda si scrive con le entita' giuste", /<Series>Fist &amp; &lt;Sword&gt;<\/Series>/.test(comicInfo({ serie: "Fist & <Sword>", numero: 2 })) && /<Title>Capitolo 2<\/Title>/.test(comicInfo({ serie: "x", numero: 2 })));
  t.c("un coreano e' manga senza verso", /<Manga>Yes<\/Manga>/.test(comicInfo({ serie: "x", numero: 1, originale: "ko" })) && !/<Manga>/.test(comicInfo({ serie: "x", numero: 1 })));
  t.c("…e la riga Web porta al capitolo su MangaDex", /<Web>https:\/\/mangadex\.org\/chapter\/c1<\/Web>/.test(comicInfo({ serie: "x", idCapitolo: "c1" })));
  // chi scrive e chi legge la scheda si capiscono: l'id del capitolo torna
  // com'era, ed e' quello con cui la stanza lo riconosce in biblioteca
  const idVero = "5e2f1a3b-1111-2222-3333-444455556666";
  t.eq("l'id scritto nella scheda torna all'import", leggiComicInfo(comicInfo({ serie: "Berserk", numero: 1, idCapitolo: idVero })).mangadex, idVero);
  t.eq("un numero con la virgola nel nome del file", nomeFile(serie, { numero: 12.5 }), "Berserk 012.5.cbz");
  t.eq("i caratteri che un file non vuole spariscono", nomeFile({ titolo: 'Re: Zero / "Arc"' }, { numero: 3 }), "Re Zero Arc 003.cbz");
  t.eq("il nome del capitolo per la riga", nomeCapitolo(serie, cap), "Berserk 1");
  const fermato = await scaricaCapitolo(serie, cap, { fetch, ritmo, vivo: () => false, segnala: () => {} }).catch((e) => e.message);
  t.eq("fermato, si ferma prima della prima pagina", fermato, "fermato");
  const rotto = async (url) => (/nodo/.test(url) ? { ok: false, status: 502, headers: { get: () => null } } : fetch(url));
  const guasto = await scaricaCapitolo(serie, cap, { fetch: rotto, ritmo, segnala: (r) => rapporti.push(r) }).catch((e) => e.message);
  t.c("una pagina che non arriva ferma il capitolo e lo dice", /pagina 1 non è arrivata \(502\)/.test(guasto) && rapporti[rapporti.length - 1].ok === false);
  // il rapporto: solo ai nodi, mai al deposito
  const mandati = [];
  const f2 = (url, o) => (mandati.push({ url, corpo: JSON.parse(o.body) }), Promise.resolve({}));
  t.c("il deposito non si segnala", segnalaPagina({ fetch: f2, nodo: COPERTINE, url: "x" }) === false && mandati.length === 0);
  t.c("un nodo si', con l'esito", segnalaPagina({ fetch: f2, nodo: "https://nodo.mangadex.network", url: "x", ok: true, byte: 9, ms: 12, cache: "MISS" }) === true && mandati[0].url === RAPPORTO && mandati[0].corpo.success === true && mandati[0].corpo.bytes === 9 && mandati[0].corpo.cached === false);

  // il ritmo e i guasti
  let ora = 0;
  const dormite = [];
  const ritmoFinto = nuovoRitmo({ intervallo: 250, adesso: () => ora, dormi: async (ms) => { dormite.push(ms); ora += ms; } });
  await ritmoFinto(async () => 1);
  await ritmoFinto(async () => 2);
  ora += 1000;
  await ritmoFinto(async () => 3);
  t.eq("due richieste vicine si distanziano, una lontana no", dormite.join(), "250");
  const cadente = ritmoFinto(async () => { throw new Error("no"); });
  await cadente.catch(() => {});
  t.eq("una richiesta caduta non blocca la fila", await ritmoFinto(async () => 4), 4);
  let volte = 0;
  const limitato = async () => (++volte === 1 ? risposta({}, 429, { "retry-after": "0" }) : risposta({ result: "ok", data: [] }));
  t.eq("un 429 si riprova dopo l'attesa", (await cerca("x", { fetch: limitato, ritmo })).length, 0);
  t.eq("…una volta sola", volte, 2);
  t.eq("un 503 si spiega", spiega(new Error("MangaDex: 503")), "MangaDex non risponde in questo momento");
  t.eq("un 429 si spiega", spiega(new Error("MangaDex: 429")), "MangaDex chiede di aspettare un momento (troppe richieste)");
  // la sfida anti-bot di MangaDex, riprodotta con Chromium: 403 «Bot
  // challenge not passed», o un «Failed to fetch» con la rete viva
  t.c("un Failed to fetch con la rete viva e' la sfida anti-bot, non la rete", /sfida anti-bot/.test(spiega(new TypeError("Failed to fetch"))) && spiega(new TypeError("Failed to fetch")) === SFIDA);
  t.c("un 403 e' la sfida", spiega(new Error("MangaDex: 403")) === SFIDA && spiega(new Error("Bot challenge not passed, refresh this page.")) === SFIDA);
  t.eq("il nome mandato a un indirizzo privato e' il DNS che blocca (il caso del tablet)", spiega(new Error("Failed to connect to api.mangadex.org/172.16.0.4:443")), DNS_BLOCCA);
  t.c("ogni rete privata e' un blocco, un indirizzo pubblico no",
    ["10.0.0.1", "192.168.1.1", "172.31.255.1", "127.0.0.1", "0.0.0.0"].every((ip) => indirizzoPrivato(`Failed to connect to api.mangadex.org/${ip}:443`))
    && !["172.15.0.1", "172.32.0.1", "104.18.10.4", "11.0.0.1"].some((ip) => indirizzoPrivato(`Failed to connect to api.mangadex.org/${ip}:443`)));
  t.c("la strada per curarlo sta nel messaggio", /DNS privato/.test(DNS_BLOCCA) && /one\.one\.one\.one/.test(DNS_BLOCCA));
  // la strada si dice: dal guscio un no e' di MangaDex all'app, dentro
  // l'app senza saluto e' il guscio muto, nel browser e' la sfida
  t.eq("un 403 passato dal guscio e' MangaDex che dice no all'app, con le sue parole", spiega(new Error("MangaDex: 403 Bot challenge not passed"), true, "guscio"), respintaDalGuscio("MangaDex: 403 Bot challenge not passed"));
  t.c("…e il messaggio porta lo stato e le parole", /\(403 Bot challenge not passed\)/.test(respintaDalGuscio("MangaDex: 403 Bot challenge not passed")));
  t.eq("dentro l'app senza saluto un Failed to fetch e' il guscio muto", spiega(new TypeError("Failed to fetch"), true, "muto"), GUSCIO_MUTO);
  t.eq("…e anche un 403", spiega(new Error("MangaDex: 403"), true, "muto"), GUSCIO_MUTO);
  t.c("il guscio muto dice di riaprire dall'icona", /riaprila dall'icona/.test(GUSCIO_MUTO));
  t.eq("un guasto di rete passato dal guscio si dice com'e'", spiega(new Error("timeout"), true, "guscio"), "timeout");
  t.eq("…anche quando Java lo chiama rete: non e' la sfida", spiega(new Error("Network is unreachable"), true, "guscio"), "Network is unreachable");
  t.eq("…e il DNS che blocca resta il DNS anche dal guscio", spiega(new Error("Failed to connect to api.mangadex.org/172.16.0.4:443"), true, "guscio"), DNS_BLOCCA);
  t.eq("…e con la rete spenta e' la rete anche dentro l'app", spiega(new TypeError("Failed to fetch"), false, "muto"), "la rete non risponde");
  const respinto = await cerca("x", { fetch: async () => ({ ...risposta({}, 403), text: async () => "<html><h1>Bot challenge</h1>   not passed</html>" }), ritmo }).catch((e) => e.message);
  t.eq("una risposta che dice no porta le sue prime parole, senza HTML", respinto, "MangaDex: 403 Bot challenge not passed");
  t.eq("…e senza corpo resta lo stato", await cerca("x", { fetch: async () => risposta({}, 403), ritmo }).catch((e) => e.message), "MangaDex: 403");
  t.eq("…e con la rete spenta e' la rete", spiega(new TypeError("Failed to fetch"), false), "la rete non risponde");
  const errore = await cerca("x", { fetch: async () => risposta({ result: "error", errors: [{ detail: "Bad request" }] }), ritmo }).catch((e) => e.message);
  t.eq("un errore dell'API porta il suo dettaglio", errore, "Bad request");
  t.c("un 404 vale come guasto", /404/.test(await capitoli("nessuno", { fetch, ritmo }).catch((e) => e.message)));

  // le serie seguite
  const st = memoria();
  t.eq("di partenza nessuna serie", leggiSerie(st).length, 0);
  let lista = segui(leggiSerie(st), trovate[0], { lingua: "it", adesso: 100 });
  t.c("seguita con la lingua scelta e i dati della scheda", lista.length === 1 && lista[0].lingua === "it" && lista[0].titolo === "Berserk" && lista[0].seguitaDa === 100 && lista[0].originale === "ja");
  t.eq("una lingua che la serie non ha ripiega sulla prima", segui([], trovate[1], { lingua: "it" })[0].lingua, "en");
  t.eq("seguirla due volte non la raddoppia", segui(lista, trovate[0]).length, 1);
  scriviSerie(lista, st);
  t.eq("la lista si scrive e si rilegge", leggiSerie(st)[0].id, "b1");
  t.eq("una memoria rotta vale lista vuota", leggiSerie({ getItem: () => "{{" }).length, 0);
  // il controllo: la prima volta niente e' nuovo, poi si contano
  let s = conCapitoli(lista[0], caps, 200);
  t.c("al primo controllo si parte da dove si e'", s.ultimo === 502 && s.ultimoNoto === 502 && s.nuovi === 0 && s.controllata === 200);
  s = conCapitoli({ ...s, ultimoNoto: 500 }, caps, 300);
  t.eq("dopo, i capitoli oltre l'ultimo visto sono nuovi", s.nuovi, 2);
  t.c("visti, si riparte dall'ultimo", visti(s).nuovi === 0 && visti(s).ultimoNoto === 502);
  t.eq("senza capitoli numerati niente ultimo", conCapitoli(lista[0], [{ numero: null }]).ultimo, null);
  t.eq("i nuovi di tutte le serie si sommano", nuoviInTutto([s, { nuovi: 3 }, {}]), 5);
  t.eq("la riga dell'Ingresso", fraseSerie([s, { nuovi: 3 }]), "2 serie seguite · 5 capitoli nuovi");
  t.eq("…una sola, senza nuovi", fraseSerie([{ nuovi: 0 }]), "1 serie seguita");
  t.eq("…nessuna, niente", fraseSerie([]), null);
  t.eq("cambiare lingua azzera il conto", cambiaLingua(lista, "b1", "en")[0].lingua + cambiaLingua([s], "b1", "en")[0].nuovi, "en0");
  t.eq("smettere la toglie", smetti(lista, "b1").length, 0);

  // GLI AVVISI AD APP CHIUSA: cosa va al guscio, cosa torna
  const daMandare = JSON.parse(messaggioSeguite([
    { id: "op", titolo: "One Piece", lingua: "en", ultimo: 1197, copertina: "x", nuovi: 2 },
    { id: "ga", titolo: "Gachiakuta", lingua: "it", ultimo: null },
    { titolo: "senza id" },
    null,
  ]));
  t.eq("al guscio vanno id, titolo, lingua e l'ultimo noto, nient'altro", JSON.stringify(daMandare), JSON.stringify({ seguite: [{ id: "op", titolo: "One Piece", lingua: "en", ultimo: 1197 }, { id: "ga", titolo: "Gachiakuta", lingua: "it" }] }));
  t.eq("…una lista vuota spegne il giro", messaggioSeguite([]), '{"seguite":[]}');
  t.eq("…senza lingua e' inglese", JSON.parse(messaggioSeguite([{ id: "x" }])).seguite[0].lingua, "en");
  t.c("la risposta del guscio si legge, e solo quella", statoAvvisi(`${STATO_AVVISI}si`) === "si" && statoAvvisi(`${STATO_AVVISI}no`) === "no" && statoAvvisi(`${STATO_AVVISI}chiedo`) === "chiedo" && statoAvvisi(`${STATO_AVVISI}boh`) === null && statoAvvisi("grimorio:pronto") === null && statoAvvisi(null) === null);
  t.c("la stanza dice gli avvisi accesi", /anche ad app chiusa/.test(fraseAvvisi("si", { nelGuscio: true, seguite: 2 })));
  t.c("…spenti, con la strada per riaccenderli", /Impostazioni Android → Notifiche → Book Companion/.test(fraseAvvisi("no", { nelGuscio: true, seguite: 1 })));
  t.c("…la finestra di Android aperta", /rispondi sì/.test(fraseAvvisi("chiedo", { nelGuscio: true, seguite: 1 })));
  t.c("…nel browser, che li manda l'app Android", /app Android/.test(fraseAvvisi(null, { seguite: 1 })));
  t.c("…e niente senza serie seguite, o nel guscio prima della risposta", fraseAvvisi("si", { nelGuscio: true, seguite: 0 }) === null && fraseAvvisi(null, { nelGuscio: true, seguite: 3 }) === null);
  // il guscio parla la stessa lingua della pagina
  const avvisiJava = readFileSync("android/Avvisi.java", "utf8");
  const guscioJava = readFileSync("android/SchermataDiBlocco.java", "utf8");
  t.c("il guscio risponde con lo stesso segno che la pagina legge", avvisiJava.includes(`STATO = "${STATO_AVVISI}"`) && /STATO \+ "si"/.test(avvisiJava) && /STATO \+ \(daChiedere\(c\) \? "chiedo" : "no"\)/.test(avvisiJava));
  t.c("il guscio legge le serie seguite prima della copertina, e risponde lo stato", /optJSONArray\("seguite"\);\s*if \(seguite != null\) \{\s*mandaAllaPagina\(Avvisi\.seguite\(app, seguite\)\);/.test(guscioJava) && guscioJava.indexOf('optJSONArray("seguite")') < guscioJava.indexOf('optJSONObject("sfondo")'));
  t.c("chiede a MangaDex col nome dell'app, ogni tre ore, con la rete", /setRequestProperty\("User-Agent", SchermataDiBlocco\.nomeDellApp\(app\)\)/.test(avvisiJava) && /OGNI = 3L \* 60 \* 60 \* 1000/.test(avvisiJava) && /setRequiredNetworkType\(JobInfo\.NETWORK_TYPE_ANY\)/.test(avvisiJava) && /setPersisted\(true\)/.test(avvisiJava));
  t.c("la notifica apre la pagina che la stanza riconosce", /SITO \+ "\/\?serie=" \+ Uri\.encode\(id\)/.test(avvisiJava) && serieDalLancio(`?serie=${encodeURIComponent("op")}`, [{ id: "op" }]) === "op");
  t.c("una serie nuova non e' nuova: si avvisa solo sopra un ultimo noto", /if \(!Double\.isNaN\(noto\) && numero > noto\) avvisa\(/.test(avvisiJava));
  t.c("una lista vuota spegne il giro, e la finestra si chiede solo con delle serie", /if \(dopo\.length\(\) > 0\) programma\(app\);\s*else togli\(app\);/.test(avvisiJava) && /if \(dopo\.length\(\) > 0 && daChiedere\(app\)\) chiedi\(app\);/.test(avvisiJava));
  t.eq("la notifica apre la stanza della serie", serieDalLancio("?serie=op&guscio=1150", [{ id: "op" }]), "op");
  t.c("…solo se la serie e' ancora seguita", serieDalLancio("?serie=zz", [{ id: "op" }]) === null && serieDalLancio("", [{ id: "op" }]) === null && serieDalLancio("?apri=libreria", [{ id: "op" }]) === null);

  // il capitolo che e' gia' in biblioteca, e quelli da scaricare
  const books = [
    { id: "k1", fileType: "cbz", saga: "berserk", sagaOrder: 386, mangadex: "aaaaaaaa-0000-0000-0000-000000000386" },
    { id: "k2", fileType: "epub", saga: "Berserk", sagaOrder: 1, mangadex: "x" },
    { id: "k3", fileType: "cbz", saga: "The Berserk", sagaOrder: 2, title: "Capitolo 2" },
    { id: "v3", fileType: "cbz", saga: "Berserk", sagaOrder: 3, title: "Berserk Vol. 3" },
    { id: "k4", fileType: "cbr", saga: "Altro", sagaOrder: 9, mangadex: "cccccccc-0000-0000-0000-000000000004", title: "x" },
  ];
  t.eq("il suo id lo riconosce, qualunque saga abbia la scheda", nellaBiblioteca(books, serie, { id: "cccccccc-0000-0000-0000-000000000004", numero: 4 })?.id, "k4");
  t.eq("stessa saga e stesso numero di un capitolo di MangaDex: un'altra traduzione, gia' in casa", nellaBiblioteca(books, serie, { id: "altro", numero: 386 })?.id, "k1");
  t.eq("un romanzo con lo stesso numero non conta", nellaBiblioteca(books, serie, { numero: 1 }), null);
  t.eq("scaricato prima dell'id: saga, numero e il titolo del capitolo (l'articolo davanti non divide)", nellaBiblioteca(books, serie, { numero: 2 })?.id, "k3");
  t.eq("UN VOLUME NON E' UN CAPITOLO: il volume 3 non e' il capitolo 3 (Gachiakuta sul tablet)", nellaBiblioteca(books, serie, { id: "z", numero: 3, titolo: "IMBUED" }), null);
  t.eq("…neanche quando il capitolo non ha titolo", nellaBiblioteca(books, serie, { numero: 3 }), null);
  t.eq("senza numero non si cerca per saga", nellaBiblioteca(books, serie, { numero: null }), null);
  const da = daScaricare(caps, books, serie);
  t.c("da scaricare: ospitati, con pagine, non ancora qui", !da.some((c) => c.numero === 386 || c.numero === 2 || c.esterno) && da.some((c) => c.numero === 1) && da.length === caps.length - 2);
  t.eq("la riga del lavoro", fraseScarico({ i: 0, totale: 3, nome: "Berserk 386", pagina: 2, pagine: 14 }), "📡 Scarico «Berserk 386» (1 di 3) · pagina 3 di 14");
  t.eq("…di un capitolo solo, prima delle pagine", fraseScarico({ totale: 1, nome: "Berserk 1" }), "📡 Scarico «Berserk 1»");
  t.eq("la copertina senza file non c'e'", copertinaUrl("b1", null), null);
  t.c("la base dell'API e' quella vera", BASE === "https://api.mangadex.org" && daRicerca(null).length === 0);
}
