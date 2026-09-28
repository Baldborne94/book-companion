// LEGGI AD ALTA VOCE (`lib/voce.js`). Sbaglia in silenzio: una frase
// tagliata a metà sul bordo della pagina, un «3.5» letto come due frasi o
// una voce inglese su un libro italiano si SENTONO, ma nessun errore lo dice.
import { frasi, pezziDaLeggere, aInizioParola, scegliVoce, prossimaVelocita, leggiVelocita, scriviVelocita, VELOCITA, FRASE_MAX } from "../src/lib/voce.js";

export default async function (t) {
  t.eq("una frase per punto", frasi("Era notte. Pioveva! Chi era?").join("|"), "Era notte.|Pioveva!|Chi era?");
  t.eq("le virgolette chiuse restano con la frase", frasi("«Vattene!» disse. Poi tacque.").join("|"), "«Vattene!» disse.|Poi tacque.");
  t.eq("un numero col punto non è una fine", frasi("Costa 3.5 corone. Troppo.").join("|"), "Costa 3.5 corone.|Troppo.");
  t.eq("un a capo chiude anche senza punto (i titoli)", frasi("Capitolo primo\nEra notte.").join("|"), "Capitolo primo|Era notte.");
  t.eq("gli spazi di troppo non si dicono", frasi("  Era   notte.  \n\n ").join("|"), "Era notte.");

  const lunga = `${"parola ".repeat(30)}e poi, ${"altra ".repeat(40)}fine.`;
  const pezzi = frasi(lunga);
  t.c("una frase lunghissima si taglia", pezzi.length > 1, String(pezzi.length));
  t.c("…nessun pezzo oltre il tetto", pezzi.every((p) => p.length <= FRASE_MAX), pezzi.map((p) => p.length).join(","));
  t.eq("…e non si perde una parola", pezzi.join(" ").replace(/\s+/g, " "), lunga.replace(/\s+/g, " ").trim());
  t.c("…tagliata a una pausa sua, se c'è", pezzi[0].endsWith(","), pezzi[0].slice(-12));

  // IL BORDO DELLA PAGINA
  const p1 = pezziDaLeggere("Era notte. Il vento soffiava sulle", "");
  t.eq("la frase che scavalca la pagina aspetta", p1.frasi.join("|"), "Era notte.");
  t.eq("…come coda", p1.coda, "Il vento soffiava sulle");
  const p2 = pezziDaLeggere("torri del castello. Nessuno dormiva.", p1.coda);
  t.eq("…e si legge intera all'inizio della pagina dopo", p2.frasi.join("|"), "Il vento soffiava sulle torri del castello.|Nessuno dormiva.");
  t.eq("…senza lasciare altra coda", p2.coda, "");
  t.eq("una pagina che chiude il paragrafo non tiene coda", pezziDaLeggere("Capitolo primo\n", "").coda, "");
  t.eq("…e la sua ultima riga si legge", pezziDaLeggere("Era notte\n", "").frasi.join("|"), "Era notte");
  t.eq("una coda troppo lunga non aspetta", pezziDaLeggere("x".repeat(500), "").coda, "");
  t.eq("pagina vuota, niente da dire", pezziDaLeggere("", "").frasi.length, 0);

  // IL BORDO DENTRO UNA PAROLA (epub.js taglia la pagina anche a meta')
  const nodo = { nodeType: 3, data: "the length of it" };
  t.eq("un bordo dentro una parola torna al suo inizio", aInizioParola(nodo, 8), 4);
  t.eq("…un bordo fra due parole resta dov'e'", aInizioParola(nodo, 10), 10);
  t.eq("…anche subito dopo lo spazio", aInizioParola(nodo, 4), 4);
  t.eq("…e in cima al nodo", aInizioParola(nodo, 0), 0);
  t.eq("…e in fondo al nodo", aInizioParola(nodo, nodo.data.length), nodo.data.length);
  t.eq("un elemento non si tocca", aInizioParola({ nodeType: 1 }, 3), 3);

  // LA VOCE
  const voci = [
    { name: "English", lang: "en-US", localService: true, default: true },
    { name: "Italiano rete", lang: "it-IT", localService: false },
    { name: "Italiano svizzero", lang: "it-CH", localService: true },
    { name: "Italiano", lang: "it_IT", localService: true },
  ];
  t.eq("la voce della lingua del libro, sul dispositivo, di casa sua", scegliVoce(voci, "it")?.name, "Italiano");
  t.eq("sul dispositivo batte la rete", scegliVoce(voci.slice(0, 2).concat(voci[2]), "it")?.name, "Italiano svizzero");
  t.eq("nessuna voce della lingua: decide il sistema", scegliVoce(voci, "ja"), null);
  t.eq("lingua ignota: decide il sistema", scegliVoce(voci, ""), null);

  // LA VELOCITÀ
  t.eq("la velocità gira in tondo", prossimaVelocita(VELOCITA[VELOCITA.length - 1]), VELOCITA[0]);
  t.eq("…un passo alla volta", prossimaVelocita(1), VELOCITA[VELOCITA.indexOf(1) + 1]);
  const mem = new Map();
  const st = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  t.eq("senza scelta, velocità normale", leggiVelocita(st), 1);
  scriviVelocita(1.2, st);
  t.eq("la scelta si ricorda", leggiVelocita(st), 1.2);
  st.setItem("bc_voce", JSON.stringify({ velocita: 7 }));
  t.eq("un valore strano torna normale", leggiVelocita(st), 1);
}
