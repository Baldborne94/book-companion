// IL DORSO DISEGNATO, per i libri che una copertina non ce l'hanno.
//
// Prima era lo stesso rettangolo per tutti: dodici libri sullo scaffale
// erano dodici rettangoli identici, e uno scaffale serve esattamente a
// riconoscere un libro con la coda dell'occhio.
//
// Qui si prova la parte che si sbaglia in silenzio: il colore. Un dorso
// storto non solleva nessun errore — si vede e basta, e solo se guardi.
import { numero, famigliaDi, tonoDi, vestito, gradinoTitolo, GRADINI, SCARTO, larghezzaEm, corpoCheEntra, corpiDelDorso, suTavola, PAROLA_MAX, INTERLINEA_TITOLO } from "../src/lib/dorso.js";

const libro = (o) => ({ id: "x", title: "Un titolo", author: "", saga: "", ...o });

export default async function (t) {
  // ---- IL COLORE NON CAMBIA MAI ----------------------------------------
  // è la proprietà che conta più di tutte: se lo scaffale cambiasse faccia
  // a ogni apertura non sarebbe una libreria, sarebbe un caleidoscopio.
  // `Math.random()` qui sarebbe il difetto peggiore possibile.
  const b = libro({ title: "Best Served Cold", author: "Joe Abercrombie", saga: "First Law" });
  t.eq("lo stesso libro dà sempre lo stesso tono", tonoDi(b), tonoDi({ ...b }));
  t.eq("e lo stesso numero", numero("mort"), numero("mort"));
  t.c("due stringhe diverse danno numeri diversi", numero("mort") !== numero("morta"));
  t.c("il numero è sempre positivo", [0, 1, 2, 3].every((i) => numero(`x${i}`) >= 0));
  t.c("e finito", Number.isFinite(numero("qualunque cosa")));

  // ---- LA FAMIGLIA È LA SAGA -------------------------------------------
  // è il punto della faccenda: i volumi di una storia devono stare nello
  // stesso quartiere di colore, così da lontano si vede che vanno insieme
  const primo = libro({ title: "The Blade Itself", author: "Joe Abercrombie", saga: "First Law" });
  const terzo = libro({ title: "Last Argument of Kings", author: "Joe Abercrombie", saga: "First Law" });
  t.eq("stessa saga, stessa famiglia", famigliaDi(primo), famigliaDi(terzo));
  const distanza = (a, b2) => {
    const d = Math.abs(tonoDi(a) - tonoDi(b2));
    return Math.min(d, 360 - d);
  };
  // La soglia è ASSOLUTA e non `SCARTO * 2`: legarla alla costante
  // vorrebbe dire che il test cresce insieme al difetto — alzando `SCARTO`
  // a 140 i volumi diventerebbero due saghe diverse e il test passerebbe
  // lo stesso. Trenta gradi è quanto può essere largo un quartiere di
  // colore restando riconoscibile come uno solo.
  const FAMIGLIA = 30;
  t.c("lo scarto tiene i volumi dentro la famiglia", SCARTO * 2 <= FAMIGLIA, String(SCARTO));
  t.c(
    "quindi i toni restano vicini",
    distanza(primo, terzo) <= FAMIGLIA,
    `${tonoDi(primo)}° e ${tonoDi(terzo)}°`
  );

  // ---- MA DENTRO LA FAMIGLIA SI DISTINGUONO ----------------------------
  // altrimenti una saga da dieci libri tornerebbe a essere dieci
  // rettangoli identici: il difetto di prima, spostato di un passo
  t.c("due volumi della stessa saga non sono identici", tonoDi(primo) !== tonoDi(terzo));
  const dieci = Array.from({ length: 10 }, (_, i) =>
    tonoDi(libro({ title: `Volume numero ${i}`, saga: "Malazan" }))
  );
  t.c("e su dieci volumi ci sono più toni", new Set(dieci).size >= 5, dieci.join(" "));

  // ---- senza saga si ripiega, e nell'ordine giusto ----------------------
  const solo = libro({ title: "Neuromante", author: "William Gibson", saga: "" });
  const altro = libro({ title: "Monna Lisa Cyberpunk", author: "William Gibson", saga: "" });
  t.eq("senza saga comanda l'autore", famigliaDi(solo), famigliaDi(altro));
  t.c("e i suoi libri restano imparentati", distanza(solo, altro) <= FAMIGLIA);
  t.eq("senza niente resta il titolo", famigliaDi(libro({ title: "Orfano", author: "", saga: "" })), "orfano");
  t.c("e un libro senza nulla non esplode", Number.isFinite(tonoDi({})));
  t.c("nemmeno `undefined`", Number.isFinite(tonoDi(undefined)));

  // gli accenti e le maiuscole non fanno due famiglie di una
  t.eq(
    "«First Law» e «first law» sono la stessa famiglia",
    famigliaDi(libro({ saga: "First Law" })),
    famigliaDi(libro({ saga: "first  law" }))
  );
  t.eq(
    "e l'accento non separa",
    famigliaDi(libro({ saga: "Café" })),
    famigliaDi(libro({ saga: "cafe" }))
  );

  // ---- il tono sta nel giro ---------------------------------------------
  for (const s of ["Malazan", "Discworld", "", "Zzz", "L'Eresia di Horus"]) {
    const h = tonoDi(libro({ saga: s, title: `T ${s}` }));
    t.c(`«${s || "senza saga"}» dà un tono valido`, h >= 0 && h < 360 && Number.isFinite(h), String(h));
  }

  // ---- il vestito è completo -------------------------------------------
  // una voce che manca finirebbe `undefined` dentro uno stile in linea, e
  // il dorso si spegnerebbe senza che nessun errore lo dica — è la stessa
  // trappola della palette dei temi
  const v = vestito(b);
  for (const voce of ["alto", "basso", "costola", "filo", "inchiostro", "tenue"]) {
    t.c(`«${voce}» c'è`, typeof v[voce] === "string" && v[voce].startsWith("hsl("), String(v[voce]));
  }
  const l = (c) => parseFloat(c.match(/(\d+(?:\.\d+)?)%\)$/)[1]);
  t.c("il fondo è più scuro in basso", l(v.basso) < l(v.alto), `${l(v.basso)} vs ${l(v.alto)}`);
  t.c("la costola è più scura del fondo", l(v.costola) < l(v.basso));
  t.c("l'inchiostro è chiarissimo", l(v.inchiostro) > 80, String(l(v.inchiostro)));
  t.c("e l'autore un po' meno", l(v.tenue) < l(v.inchiostro));
  // il contrasto fra inchiostro e fondo è quello che rende leggibile il
  // titolo: 92% su 26% è abbondante, ma se qualcuno alzasse il fondo si
  // vedrebbe qui e non sullo scaffale del lettore
  t.c("e il titolo si legge sul fondo", l(v.inchiostro) - l(v.alto) > 45);

  // ---- IL CORPO DEL TITOLO ---------------------------------------------
  t.eq("un titolo corto sta in grande", gradinoTitolo("Mort"), "titolo");
  t.c("uno lungo scende", GRADINI.indexOf(gradinoTitolo("Le cronache del ghiaccio e del fuoco: lo scontro dei re")) >= 3);
  t.c(
    "e più è lungo più scende",
    GRADINI.indexOf(gradinoTitolo("Before They Are Hanged")) >
      GRADINI.indexOf(gradinoTitolo("Mort"))
  );

  // NON BASTA LA LUNGHEZZA TOTALE: comanda anche la parola più lunga.
  // «Neuromante» è cortissimo — dieci caratteri — ma è UNA parola, e a
  // corpo grande non ci sta nella colonna: il browser la spezzava a metà,
  // «Neuroma / nte», che su una copertina è la cosa più brutta che c'è.
  t.c(
    "una parola sola e lunga fa scendere il corpo",
    GRADINI.indexOf(gradinoTitolo("Neuromante")) > 0,
    gradinoTitolo("Neuromante")
  );
  // stessa lunghezza, ma spezzata in parole corte: lì si può stare grandi
  t.c(
    "mentre più parole corte restano grandi",
    GRADINI.indexOf(gradinoTitolo("Io e te")) < GRADINI.indexOf(gradinoTitolo("Neuromante")),
    `${gradinoTitolo("Io e te")} vs ${gradinoTitolo("Neuromante")}`
  );
  t.c(
    "e una parola lunghissima scende parecchio",
    GRADINI.indexOf(gradinoTitolo("Precipitevolissimevolmente")) >= 3
  );

  // ---- niente da rompere -------------------------------------------------
  t.c("un titolo vuoto dà un gradino valido", GRADINI.includes(gradinoTitolo("")));
  t.c("e niente del tutto pure", GRADINI.includes(gradinoTitolo()));
  t.c("ogni gradino è un nome della scala", GRADINI.every((g) => typeof g === "string" && g.length > 2));

  // ---- E IL TITOLO DEVE STARCI DAVVERO ------------------------------------
  // Il riquadro del titolo sul tablet del lettore (902x1503, scrittura x1,5),
  // misurato nel browser: 79,56 per 63 con numero e autore. Li' «Pirane / si»,
  // «Garde / ns of» e ventidue dorsi su ventinove avevano una parola spezzata.
  const TABLET = { larga: 79.56, alta: 63.06 };
  const vicino = (a, b, scarto) => Math.abs(a - b) <= scarto;
  // le larghezze sono quelle del carattere vero (misurate con `measureText`)
  t.c("«Kagurabachi,» è largo quanto nel Cormorant", vicino(larghezzaEm("Kagurabachi,"), 5.147, 0.05), String(larghezzaEm("Kagurabachi,")));
  t.c("e «Piranesi» pure", vicino(larghezzaEm("Piranesi"), 3.135, 0.05), String(larghezzaEm("Piranesi")));
  t.eq("una lettera accentata è larga come la sua lettera", larghezzaEm("è"), larghezzaEm("e"));
  t.eq("un segno di un altro alfabeto vale il suo quadrato", larghezzaEm("冒険"), 2);
  t.c("le stesse lettere non sono la stessa larghezza", larghezzaEm("Mummwwmm") > larghezzaEm("Illimiti") * 1.8);

  const entra = (titolo, corpo, larga) => titolo.split(/\s+/).every((p) => larghezzaEm(p) * corpo <= larga);
  // `stretto`: il titolo che la larghezza ferma prima dell'altezza
  for (const [titolo, tetto, stretto] of [["Piranesi", 28.5, 1], ["Gardens of the Moon", 25.5, 0], ["Kagurabachi, Vol. 1", 22.5, 1], ["Morty l'apprendista", 25.5, 1], ["Neuromante", 22.5, 1], ["Guida galattica per gli autostoppisti", 22.5, 0]]) {
    const corpo = corpoCheEntra(titolo, { ...TABLET, massimo: tetto });
    t.c(`«${titolo}»: nessuna parola si spezza`, entra(titolo, corpo, TABLET.larga) && corpo >= 12.5, String(corpo));
    if (stretto) t.c(`«${titolo}»: e non si rimpicciolisce più del necessario`, !entra(titolo, corpo + 1.5, TABLET.larga), String(corpo));
  }
  t.eq("un titolo corto resta al suo gradino", corpoCheEntra("Mort", { ...TABLET, massimo: 33 }), 33);
  // «della magia» a 18 px riempiva il riquadro esatto sulla carta, e nel
  // browser andava a capo: la terza riga usciva dal fondo
  const magia = corpoCheEntra("Il colore della magia", { ...TABLET, massimo: 25.5 });
  t.c("una riga piena fino all'orlo non si conta come piena", magia <= 17.5 && magia >= 16, String(magia));
  // l'altezza conta quanto la larghezza: quattro parole corte in un riquadro basso
  const basso = corpoCheEntra("Il re di più", { larga: 79.56, alta: 30, massimo: 33 });
  t.c("le righe stanno nell'altezza", basso * INTERLINEA_TITOLO <= 30 && basso < 33, String(basso));
  // due parole che una accanto all'altra entrerebbero, senza lo spazio in mezzo
  t.eq("lo spazio fra due parole conta", corpoCheEntra("nnnn nnnn", { larga: 70.1, alta: 20, massimo: 16 }), 15);
  t.eq("e si somma, parola dopo parola", corpoCheEntra("nn nn nn", { larga: 56.9, alta: 20, massimo: 16 }), 15);
  t.eq("ma dopo un trattino non c'è", corpoCheEntra("nnnn-nnnn", { larga: 75.9, alta: 20, massimo: 16 }), 16);
  t.c("e in un riquadro alto lo stesso titolo resta grande", corpoCheEntra("Il re di più", { larga: 79.56, alta: 200, massimo: 33 }) > basso);
  t.eq("su una copertina grande comanda il gradino", corpoCheEntra("Kagurabachi, Vol. 1", { larga: 190, alta: 200, massimo: 22 }), 22);
  // una parola che non entra a nessun corpo che si distingua si spezza, e basta
  t.eq("una parola enorme si ferma al pavimento", corpoCheEntra("Precipitevolissimevolmente", { ...TABLET, massimo: 21 }), TABLET.larga / PAROLA_MAX);
  t.c("dopo un trattino si va a capo: comanda il pezzo, non la parola", corpoCheEntra("Dembski-Bowden", { ...TABLET, massimo: 33 }) > corpoCheEntra("DembskiBowden", { ...TABLET, massimo: 33 }));
  t.eq("senza misura resta il gradino", corpoCheEntra("Kagurabachi, Vol. 1", { larga: 0, alta: 0, massimo: 21 }), 21);
  t.eq("e senza titolo pure", corpoCheEntra("", { ...TABLET, massimo: 21 }), 21);

  // ---- E IL BROWSER HA L'ULTIMA PAROLA --------------------------------------
  // La scena in CI: dove le lettere si aggiustano al pixel ogni parola e' piu'
  // larga della tavola, e di piu' ai corpi piccoli («Oathbringer» a 15,5 px:
  // 5,16 em contro 4,93). Chi ha un browser da' la sua misura; qui la si
  // imita: ogni lettera arrotondata al pixel intero, per eccesso.
  const alPixel = (testo, corpo) => [...testo].reduce((somma, l) => somma + Math.ceil(larghezzaEm(l) * corpo), 0);
  const entraVera = (titolo, corpo) => titolo.split(/\s+/).every((p) => alPixel(p, corpo) <= TABLET.larga);
  for (const [titolo, tetto] of [["Oathbringer", 22.5], ["Morty l'apprendista", 25.5], ["Kagurabachi, Vol. 1", 22.5]]) {
    const stimato = corpoCheEntra(titolo, { ...TABLET, massimo: tetto });
    const vero = corpoCheEntra(titolo, { ...TABLET, massimo: tetto }, alPixel);
    t.c(`«${titolo}»: con la misura del browser entra davvero`, entraVera(titolo, vero) && !entraVera(titolo, stimato), `${vero} (sulla tavola ${stimato})`);
    t.c(`«${titolo}»: e scende solo di quel che serve`, vero < stimato && vero >= stimato - 2.5 && !entraVera(titolo, vero + 1), `${vero} (sulla tavola ${stimato})`);
  }
  t.eq("la misura di chi non ne dà una è la tavola", corpoCheEntra("Oathbringer", { ...TABLET, massimo: 22.5 }, suTavola), corpoCheEntra("Oathbringer", { ...TABLET, massimo: 22.5 }));
  // l'aggiustamento cambia col corpo: il primo colpo, preso al gradino, puo'
  // promettere troppo, e a ogni corpo si richiede la sua misura
  const strettoSotto16 = (testo, corpo) => suTavola(testo, corpo) * (corpo < 16 ? 1.2 : 1);
  const prudente = corpoCheEntra("Oathbringer", { ...TABLET, massimo: 22.5 }, strettoSotto16);
  t.c("una parola sola che al suo corpo non entra più fa scendere ancora", strettoSotto16("Oathbringer", prudente) <= TABLET.larga && prudente <= 13 && prudente >= 12, String(prudente));
  // il primo colpo viene dalla parola piu' larga: scendere mezzo pixel alla
  // volta dal gradino sarebbero trentasei misure del canvas per ogni dorso
  let chieste = 0;
  corpoCheEntra("Oathbringer", { ...TABLET, massimo: 33 }, (testo, corpo) => ((chieste += 1), alPixel(testo, corpo)));
  t.c("e la misura si chiede poche volte", chieste <= 12, String(chieste));
  // anche le righe si contano con quella misura: due parole che sulla tavola stanno accanto
  const accanto = { larga: 70.1, alta: 20, massimo: 15 };
  t.eq("sulla tavola stanno su una riga", corpoCheEntra("nnnn nnnn", accanto), 15);
  t.c("col pixel intero no, e il corpo scende finché ci stanno", corpoCheEntra("nnnn nnnn", accanto, alPixel) < 15, String(corpoCheEntra("nnnn nnnn", accanto, alPixel)));
  const kaguraVera = corpiDelDorso("Kagurabachi, Vol. 1", { larga: 79.56, spazio: 117.9, tetto: 22.5, autore: 18 }, alPixel);
  t.c("e titolo e autore insieme usano la stessa misura", entraVera("Kagurabachi, Vol. 1", kaguraVera.titolo) && kaguraVera.autore <= kaguraVera.titolo, JSON.stringify(kaguraVera));

  // titolo e autore insieme, nello spazio dentro i margini del dorso
  const DORSO = { larga: 79.56, spazio: 117.9, tetto: 22.5 };
  const kagura = corpiDelDorso("Kagurabachi, Vol. 1", { ...DORSO, autore: 18 });
  t.c("l'autore non è mai più grosso del titolo", kagura.autore <= kagura.titolo && kagura.autore < 18, JSON.stringify(kagura));
  // qui e' l'altezza a stringere il titolo, non la parola piu' larga
  const giardini = corpiDelDorso("Gardens of the Moon", { ...DORSO, tetto: 25.5, autore: 18 });
  t.c("nemmeno quando è l'altezza a stringerlo", giardini.autore <= giardini.titolo && giardini.autore < 18, JSON.stringify(giardini));
  const magico = corpiDelDorso("Il colore della magia", { ...DORSO, tetto: 25.5, autore: 18 });
  t.c("e scendendo gli lascia spazio", magico.autore <= magico.titolo && magico.titolo > corpoCheEntra("Il colore della magia", { larga: DORSO.larga, alta: DORSO.spazio - 8 - 2 * 18 * 1.3, massimo: 25.5 }), JSON.stringify(magico));
  t.eq("e dove il titolo sta largo resta al suo corpo", corpiDelDorso("Mort", { ...DORSO, tetto: 33, autore: 18 }).autore, 18);
  const lungo = "Guida galattica per gli autostoppisti";
  const conAutore = corpiDelDorso(lungo, { ...DORSO, spazio: 100, autore: 18 });
  const senza = corpiDelDorso(lungo, { ...DORSO, spazio: 100 });
  t.eq("senza autore non c'è un corpo per lui", senza.autore, 0);
  t.c("e il titolo si prende il suo spazio", senza.titolo > conAutore.titolo, `${senza.titolo} vs ${conAutore.titolo}`);
}
