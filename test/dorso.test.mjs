// IL DORSO DISEGNATO, per i libri che una copertina non ce l'hanno.
//
// Prima era lo stesso rettangolo per tutti: dodici libri sullo scaffale
// erano dodici rettangoli identici, e uno scaffale serve esattamente a
// riconoscere un libro con la coda dell'occhio.
//
// Qui si prova la parte che si sbaglia in silenzio: il colore. Un dorso
// storto non solleva nessun errore — si vede e basta, e solo se guardi.
import { numero, famigliaDi, tonoDi, vestito, gradinoTitolo, GRADINI, SCARTO } from "../src/lib/dorso.js";

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
}
