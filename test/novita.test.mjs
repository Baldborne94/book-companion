// LE NOVITÀ DELLE RACCOLTE SCELTE (`lib/novita.js` ↔ `android/Novita.java`):
// cosa si guarda di una raccolta, la lista, cosa va al guscio e cosa torna.
import { readFileSync } from "node:fs";
import {
  autoriDi, vocePerRaccolta, leggiNovita, scriviNovita, seguita, seguiNovita, smettiNovita,
  messaggioNovita, statoNovita, fraseNovita, tastoNovita, puoAvvisare, STATO_NOVITA, AUTORI_MAX, CHIAVE_NOVITA,
} from "../src/lib/novita.js";

const memoria = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m };
};

export default async function (t) {
  // cosa si guarda
  const libri = [
    { author: "Dan Abnett", tipo: "libro" },
    { author: "Dan Abnett & Graham McNeill" },
    { author: "Graham McNeill" },
    { author: "Ben Counter" },
    { author: "Aaron Dembski-Bowden" },
    { author: "Autore sconosciuto" },
    { author: "Autore sconosciuto" },
    { author: "Autore Sconosciuto" },
    { author: "" },
  ];
  t.eq("gli autori di una saga: i piu' presenti, al piu' tre, senza i vuoti e gli sconosciuti", autoriDi(libri).join("|"), "Dan Abnett|Graham McNeill|Aaron Dembski-Bowden");
  t.eq("…il tetto", AUTORI_MAX, 3);
  t.eq("un nome col cognome davanti resta uno", autoriDi([{ author: "Miura, Kentaro" }]).join("|"), "Miura, Kentaro");
  t.eq("una raccolta d'autore guarda i libri nuovi di quell'autore", JSON.stringify(vocePerRaccolta({ id: "autore:terry pratchett", nome: "Terry Pratchett", libri: [] })), JSON.stringify({ id: "autore:terry pratchett", nome: "Terry Pratchett", tipo: "autori", autori: ["Terry Pratchett"] }));
  t.eq("una saga di libri guarda i suoi autori", JSON.stringify(vocePerRaccolta({ id: "saga:eresia", nome: "L'Eresia di Horus", libri })), JSON.stringify({ id: "saga:eresia", nome: "L'Eresia di Horus", tipo: "autori", autori: ["Dan Abnett", "Graham McNeill", "Aaron Dembski-Bowden"] }));
  const berserk = { id: "saga:berserk", nome: "Berserk", libri: [{ tipo: "manga", author: "Kentaro Miura" }, { tipo: "manga" }, { tipo: "fumetto" }] };
  t.eq("una saga di manga guarda i capitoli", JSON.stringify(vocePerRaccolta(berserk)), JSON.stringify({ id: "saga:berserk", nome: "Berserk", tipo: "manga", titolo: "Berserk" }));
  t.eq("…a meta' manga e' manga", vocePerRaccolta({ id: "saga:x", nome: "X", libri: [{ tipo: "manga" }, { tipo: "fumetto", author: "A" }] }).tipo, "manga");
  t.eq("…meno della meta' no", vocePerRaccolta({ id: "saga:x", nome: "X", libri: [{ tipo: "manga" }, { tipo: "fumetto", author: "A" }, { tipo: "fumetto", author: "A" }] }).tipo, "autori");
  t.c("senza autori una saga di libri non si puo' seguire, ne' una raccolta che non e' saga o autore", vocePerRaccolta({ id: "saga:x", nome: "X", libri: [{ author: "" }] }) === null && vocePerRaccolta({ id: "genere:fantasy", nome: "Fantasy", libri }) === null && !puoAvvisare("sciolti") && puoAvvisare("autore:a"));

  // la lista
  const st = memoria();
  t.eq("vuota all'inizio", leggiNovita(st).length, 0);
  let lista = seguiNovita([], vocePerRaccolta(berserk));
  lista = seguiNovita(lista, vocePerRaccolta({ id: "autore:pratchett", nome: "Terry Pratchett" }));
  lista = seguiNovita(lista, { ...vocePerRaccolta(berserk), nome: "Berserk!" });
  t.eq("seguire di nuovo la stessa raccolta la aggiorna, non la raddoppia", lista.map((x) => x.nome).join("|"), "Terry Pratchett|Berserk!");
  t.c("seguita si sa", seguita(lista, "saga:berserk") && !seguita(lista, "saga:x"));
  t.eq("smettere la toglie", smettiNovita(lista, "saga:berserk").map((x) => x.id).join(), "autore:pratchett");
  t.eq("seguire niente non cambia niente", seguiNovita(lista, null).length, 2);
  scriviNovita([...lista, { id: "genere:x", tipo: "autori" }, { id: "saga:y", tipo: "boh" }, null], st);
  t.eq("si rilegge, senza le voci che non sono sue", leggiNovita(st).length, 2);
  t.eq("…nella sua chiave", CHIAVE_NOVITA, "bc_novita");
  st.setItem(CHIAVE_NOVITA, "{rotto");
  t.eq("una memoria rotta e' una lista vuota", leggiNovita(st).length, 0);

  // cosa va al guscio
  const msg = JSON.parse(messaggioNovita([...lista, { id: "saga:z", nome: "Z", tipo: "autori", autori: ["a", "b", "c", "d"] }]));
  t.eq("al guscio vanno id, nome, tipo, e autori o titolo", JSON.stringify(msg.novita.slice(0, 2)), JSON.stringify([{ id: "autore:pratchett", nome: "Terry Pratchett", tipo: "autori", autori: ["Terry Pratchett"] }, { id: "saga:berserk", nome: "Berserk!", tipo: "manga", titolo: "Berserk" }]));
  t.eq("…al piu' tre autori", msg.novita[2].autori.length, 3);
  t.eq("…una lista vuota spegne il giro", messaggioNovita([]), '{"novita":[]}');

  // cosa torna
  t.c("la risposta del guscio si legge, e solo quella", ["si", "no", "chiedo", "guasto"].every((s) => statoNovita(STATO_NOVITA + s) === s) && statoNovita(`${STATO_NOVITA}boh`) === null && statoNovita("grimorio:pronto") === null && statoNovita(null) === null);
  t.c("le parole: niente seguito", /Avvisami delle novità/.test(fraseNovita("si", { nelGuscio: true, quante: 0 })));
  t.c("…accese", /^🔔 2 raccolte seguite: ogni qualche ora/.test(fraseNovita("si", { nelGuscio: true, quante: 2 })));
  t.c("…spente, con la strada", /Impostazioni Android → Notifiche → Book Companion/.test(fraseNovita("no", { nelGuscio: true, quante: 1 })) && /^🔕 1 raccolta seguita/.test(fraseNovita("no", { nelGuscio: true, quante: 1 })));
  t.c("…la finestra di Android, il guasto, il guscio vecchio", /rispondi sì/.test(fraseNovita("chiedo", { nelGuscio: true, quante: 1 })) && /non ha accettato/.test(fraseNovita("guasto", { nelGuscio: true, quante: 1 })) && /APK più recente/.test(fraseNovita(null, { nelGuscio: true, quante: 1 })));
  t.c("…nel browser, che le manda l'app Android", /app Android/.test(fraseNovita(null, { quante: 1 })));

  // il tasto nella raccolta
  t.eq("il tasto di una saga di manga", JSON.stringify(tastoNovita(berserk, [])), JSON.stringify({ si: false, testo: "🔕 Avvisami delle novità", spiega: "Avviso: i capitoli nuovi" }));
  t.eq("…seguita", tastoNovita(berserk, lista).testo, "🔔 Ti avviso delle novità");
  t.eq("…d'autore", tastoNovita({ id: "autore:x", nome: "X" }, []).spiega, "Avviso: i libri nuovi");
  t.eq("…di una saga di libri, coi suoi autori", tastoNovita({ id: "saga:e", nome: "E", libri }, []).spiega, "Avviso: i libri nuovi di Dan Abnett, Graham McNeill, Aaron Dembski-Bowden");
  t.eq("…niente dove non si puo'", tastoNovita({ id: "genere:x", nome: "X" }, []), null);

  // il guscio parla la stessa lingua
  const java = readFileSync("android/Novita.java", "utf8");
  const guscio = readFileSync("android/SchermataDiBlocco.java", "utf8");
  t.c("il guscio risponde col segno che la pagina legge", java.includes(`STATO = "${STATO_NOVITA}"`) && /return STATO \+ "guasto";/.test(java) && /STATO \+ \(daChiedere\(c\) \? "chiedo" : "no"\)/.test(java));
  t.c("il guscio legge la lista dentro la presa, prima della copertina", /optJSONArray\("novita"\);\s*if \(novita != null\) \{\s*mandaAllaPagina\(Novita\.seguite\(app, novita\)\);/.test(guscio) && guscio.indexOf('optJSONArray("novita")') < guscio.indexOf('optJSONObject("sfondo")'));
  t.c("chiede col nome dell'app, ogni quattro ore, con la rete, anche dopo un riavvio", /setRequestProperty\("User-Agent", nomeDellApp\(app\)\)/.test(java) && /OGNI = 4L \* 60 \* 60 \* 1000/.test(java) && /setRequiredNetworkType\(JobInfo\.NETWORK_TYPE_ANY\)/.test(java) && /setPersisted\(true\)/.test(java));
  t.c("i libri da Open Library, dal piu' nuovo; i capitoli da MangaDex, in inglese e in italiano", /openlibrary\.org\/search\.json\?author=/.test(java) && /&sort=new/.test(java) && /api\.mangadex\.org\/manga\?title=/.test(java) && /translatedLanguage%5B%5D=en&translatedLanguage%5B%5D=it/.test(java));
  t.c("la prima volta niente e' nuovo", /if \(pronta\) avvisa\(/.test(java) && /if \(!Double\.isNaN\(noto\) && numero > noto\) avvisa\(/.test(java));
  t.c("una lista vuota spegne il giro, la finestra si chiede solo con delle raccolte, un rifiuto di Android si dice", /if \(dopo\.length\(\) > 0\) programma\(app\);\s*else togli\(app\);/.test(java) && /if \(dopo\.length\(\) > 0 && daChiedere\(app\)\) chiedi\(app\);/.test(java) && /catch \(Throwable e\) \{[\s\S]{0,120}return STATO \+ "guasto";/.test(java));
  t.c("un lavoro suo, non quello degli avvisi tolti", /LAVORO = 4402/.test(java) && /CANALE = "novita"/.test(java));
}
