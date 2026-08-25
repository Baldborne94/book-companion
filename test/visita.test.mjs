// LA VISITA AI LIBRI.
//
// L'import dice com'è andata il giorno che il libro è entrato, e poi tace.
// I guai di un ePub si scoprono a pagina duecento — una giuntura che
// lascia mezza facciata bianca, l'encoding rotto — e lì il lettore non sa
// nemmeno se è colpa del file o dell'app.
//
// La regola che tiene in piedi tutto: **quello che l'app sa già curare da
// sé non si segnala**. Un elenco che grida a ogni libro fa ignorare anche
// le righe che contano.
import {
  esamina, grave, quantoMojibake, visita, resocontoVisita,
  GUAI, TESTO_MINIMO, GIUNTURE_TANTE, MOJIBAKE_TANTI, POCHI_CAPITOLI,
} from "../src/lib/visita.js";

// un libro sano: tanto testo, indice pieno, niente di storto
const SANO = { caratteri: 400000, mojibake: 0, vuoti: 0, giunture: 0, documenti: 30, indice: 30 };

export default async function (t) {
  // ---- IL CASO NORMALE NON DICE NIENTE ---------------------------------
  // è la riga più importante del file: se un libro sano producesse anche
  // un solo guaio, il referto sarebbe rumore su tutta la biblioteca
  t.eq("un libro sano non ha guai", esamina(SANO).length, 0);

  // ---- quello che non si apre affatto ----------------------------------
  t.eq("un file rovinato", esamina({ rotto: true })[0], "nonSiApre");
  // e non si aggiunge altro: elencare «niente testo» su un file che non si
  // apre sarebbe dire due volte la stessa cosa
  t.eq("e basta quello", esamina({ rotto: true }).length, 1);
  t.c("è un guaio serio", grave(["nonSiApre"]));

  // ---- niente testo ------------------------------------------------------
  t.c("un guscio senza testo si segnala", esamina({ ...SANO, caratteri: 10 }).includes("senzaTesto"));
  t.c("appena sotto la soglia", esamina({ ...SANO, caratteri: TESTO_MINIMO - 1 }).includes("senzaTesto"));
  t.c("e appena sopra no", !esamina({ ...SANO, caratteri: TESTO_MINIMO }).includes("senzaTesto"));
  t.c("è serio: dizionario, ricerca e Oracolo non funzionano", grave(["senzaTesto"]));

  // ---- L'ENCODING ROTTO, che nessun reader può curare -------------------
  // UTF-8 letto come Latin-1: «perché» → «perchÃ©». I byte sbagliati sono
  // nel file, quindi è proprio il caso in cui vale la pena dirlo — l'unica
  // strada è un altro file.
  t.eq("«perchÃ©» si riconosce", quantoMojibake("perchÃ©"), 1);
  t.eq("e le virgolette storpiate", quantoMojibake("lâ€™uomo"), 1);
  t.c("si contano tutte", quantoMojibake("perchÃ© cosÃ¬ Ã¨ andata") >= 3);
  // UN TESTO PULITO NON DEVE MAI INSOSPETTIRE: gli accenti veri, le
  // maiuscole accentate, le lingue con la dieresi
  t.eq("l'italiano scritto bene non è mojibake", quantoMojibake("perché così è andata, però"), 0);
  t.eq("nemmeno il tedesco", quantoMojibake("Fräulein, schön, Grüße"), 0);
  t.eq("né il francese", quantoMojibake("à côté, déjà, où"), 0);
  t.eq("né le virgolette tipografiche vere", quantoMojibake("l'uomo «disse» — e poi…"), 0);
  t.eq("niente testo, niente mojibake", quantoMojibake(null), 0);
  t.c("tanti segnano il libro", esamina({ ...SANO, mojibake: MOJIBAKE_TANTI }).includes("mojibake"));
  // pochi non bastano: una citazione può contenerne uno per davvero
  t.c("pochi no", !esamina({ ...SANO, mojibake: MOJIBAKE_TANTI - 1 }).includes("mojibake"));

  // ---- il libro spezzato -------------------------------------------------
  t.c("tante giunture si dicono", esamina({ ...SANO, giunture: GIUNTURE_TANTE }).includes("spezzato"));
  // due o tre documenti corti fuori indice sono il frontespizio e il
  // colophon, non un romanzo fatto a pezzi
  t.c("due o tre no", !esamina({ ...SANO, giunture: 3 }).includes("spezzato"));
  t.c("non è serio, ma si può risolvere", !grave(["spezzato"]));
  t.c("e la cura è reimportare", /reimport/i.test(GUAI.spezzato.cura));

  // ---- capitoli vuoti ----------------------------------------------------
  t.c("anche uno solo si dice", esamina({ ...SANO, vuoti: 1 }).includes("capitoliVuoti"));
  t.c("zero no", !esamina({ ...SANO, vuoti: 0 }).includes("capitoliVuoti"));

  // ---- l'indice ----------------------------------------------------------
  t.c("un libro di trenta capitoli senza indice", esamina({ ...SANO, indice: 0 }).includes("senzaIndice"));
  // MA UN RACCONTO IN TRE DOCUMENTI NON HA UN INDICE PERCHÉ NON GLI SERVE:
  // segnalarlo sarebbe accusare un libro sano
  t.c(
    "un libro cortissimo senza indice non è un guaio",
    !esamina({ ...SANO, indice: 0, documenti: POCHI_CAPITOLI }).includes("senzaIndice")
  );

  // ---- ogni guaio sa dire cosa fare -------------------------------------
  // un elenco di guai senza la cura accanto lascia il lettore dov'era
  for (const [id, g] of Object.entries(GUAI)) {
    t.c(`«${id}» dice cosa non va`, typeof g.dice === "string" && g.dice.length > 8);
    t.c(`«${id}» dice cosa farci`, typeof g.cura === "string" && g.cura.length > 12);
    t.c(`«${id}» sa se è serio`, typeof g.grave === "boolean");
  }
  // e nessun guaio prodotto da `esamina` può essere senza voce, o il
  // pannello mostrerebbe `undefined`
  const tutti = [
    ...esamina({ rotto: true }),
    ...esamina({ caratteri: 0, mojibake: 99, giunture: 99, vuoti: 9, documenti: 99, indice: 0 }),
  ];
  t.c("ogni guaio ha la sua voce", tutti.every((g) => GUAI[g]), tutti.join(","));

  // ---- LA PASSATA --------------------------------------------------------
  const libri = [
    { id: "1", title: "Sano" },
    { id: "2", title: "Rotto" },
    { id: "3", title: "Nel cloud" },
  ];
  const byte = { 1: {}, 2: {}, 3: null };
  const apri = async (b) => {
    if (b.id === "2") throw new Error("archivio illeggibile");
    return SANO;
  };
  let e = await visita(libri, { leggiByte: (id) => byte[id], apri });
  t.eq("i tomi si esaminano", e.esaminati, 2);
  t.eq("il sano non finisce nell'elenco", e.malati.filter((m) => m.title === "Sano").length, 0);
  t.eq("il rotto sì", e.malati[0]?.title, "Rotto");
  t.eq("e con la ragione giusta", e.malati[0]?.guai[0], "nonSiApre");
  // UN TOMO NEL CLOUD NON È UN GUAIO: si conta e si dice, come ovunque
  // nell'app — scaricarne venti per una visita nessuno l'ha chiesto
  t.eq("i lontani si contano a parte", e.lontani.length, 1);
  t.eq("e non fra i malati", e.malati.length, 1);

  // un `getFile` che esplode subito non deve portarsi via il giro: è la
  // stessa trappola già presa nel ripasso delle impronte
  e = await visita([{ id: "x", title: "Boom" }], { leggiByte: () => { throw new Error("boom"); }, apri });
  t.eq("un archivio che esplode non ferma la visita", e.lontani.length, 1);

  // ---- si ferma a metà, e quel che è fatto resta fatto -------------------
  let visti = 0;
  e = await visita(
    [1, 2, 3, 4].map((n) => ({ id: String(n), title: `T${n}` })),
    { leggiByte: () => ({}), apri: async () => ({ ...SANO, vuoti: 1 }), vivo: () => visti < 2, onProgress: () => { visti += 1; } }
  );
  t.c("il giro si ferma", e.fermato);
  t.eq("e tiene quello che aveva guardato", e.esaminati, 2);

  // ---- il resoconto ------------------------------------------------------
  t.c("tutto a posto si dice", /a posto/.test(resocontoVisita({ esaminati: 5, malati: [] })));
  t.c(
    "e i malati si contano",
    /2 tomi da guardare/.test(resocontoVisita({ esaminati: 5, malati: [{ guai: ["spezzato"] }, { guai: ["capitoliVuoti"] }] }))
  );
  // i seri si dicono a parte: «due da guardare» non distingue una pagina
  // bianca da un file che non si apre
  t.c(
    "i seri si dicono a parte",
    /serio/.test(resocontoVisita({ esaminati: 5, malati: [{ guai: ["nonSiApre"] }] }))
  );
  t.c("i lontani si dicono", /dispositivo/.test(resocontoVisita({ esaminati: 1, malati: [], lontani: ["A"] })));
  t.eq("niente da guardare", resocontoVisita({}), "Nessun tomo da guardare");
}
