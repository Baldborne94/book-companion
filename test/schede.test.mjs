// LA CACHE DELLE SCHEDE DELL'ORACOLO. Stava in un `useRef` e moriva col
// libro chiuso, e sopra ci avevamo costruito la regola che il lettore aveva
// chiesto — «Chi è costui?» si rifà solo se di lui è successo qualcosa di
// nuovo. Quella regola aveva bisogno di una scheda VECCHIA con cui
// confrontarsi: senza, sembrava scritta e non funzionava mai.
//
// Qui l'aritmetica di cosa si tiene e cosa si butta.
import { riponi, tocca, trova, daTenere, MAX_SCHEDE } from "../src/lib/schedeCache.js";

const voce = (nome, ora) => ({ chiave: `chi:${nome}`, dato: { answer: nome }, segno: "x", usata: ora });

export default async function (t) {
  // ---- SOLO LE SCHEDE-PERSONAGGIO ---------------------------------------
  // «Dove eravamo rimasti» si rifà per definizione a ogni richiesta: il suo
  // senso è «fin dove sono ADESSO», e scriverla su disco vuol dire pagare
  // una scrittura per una voce che il giro dopo viene buttata via
  t.c("una scheda-personaggio si tiene", daTenere("chi:Logen"));
  t.c("il riassunto no", !daTenere("trama"));
  t.c("e niente non si tiene", !daTenere());

  // ---- riporre ----------------------------------------------------------
  let voci = riponi([], { chiave: "chi:Logen", dato: { answer: "il Bloody Nine" } }, 100);
  t.eq("una voce", voci.length, 1);
  t.eq("con il momento in cui l'hai usata", voci[0].usata, 100);
  t.c("e si ritrova", trova(voci, "chi:Logen")?.dato.answer === "il Bloody Nine");
  t.eq("quello che non c'e' non si trova", trova(voci, "chi:Monza"), null);

  // la stessa scheda rifatta SOSTITUISCE, non si accoda: la nuova è del
  // punto in cui sei adesso, la vecchia non serve piu' a niente
  voci = riponi(voci, { chiave: "chi:Logen", dato: { answer: "aggiornata" } }, 200);
  t.eq("resta una sola voce", voci.length, 1);
  t.c("ed e' la nuova", trova(voci, "chi:Logen").dato.answer === "aggiornata");

  // una voce senza risposta non si mette da parte: un errore di rete non
  // deve restare appiccicato al nome
  t.eq("niente dato, niente voce", riponi(voci, { chiave: "chi:X" }, 300).length, 1);
  t.eq("niente chiave nemmeno", riponi(voci, { dato: { answer: "?" } }, 300).length, 1);

  // ---- SI BUTTA LA MENO USATA DI RECENTE, non la piu' vecchia -----------
  // una cache che vive fra una sessione e l'altra vede lo stesso
  // personaggio tornare a distanza di giorni: buttarlo perche' l'avevi
  // conosciuto per primo e' il contrario di quello che serve
  let piena = [];
  for (let i = 0; i < MAX_SCHEDE; i += 1) piena = riponi(piena, voce(`n${i}`, 0), i + 1);
  t.eq("la cache e' piena", piena.length, MAX_SCHEDE);
  // la prima conosciuta torna a essere letta, e diventa la piu' fresca
  piena = tocca(piena, "chi:n0", 1000);
  t.eq("rileggerla la ringiovanisce", trova(piena, "chi:n0").usata, 1000);
  // adesso ne arriva una nuova: a cadere dev'essere la seconda, non la prima
  piena = riponi(piena, voce("nuova", 0), 1001);
  t.eq("il tetto regge", piena.length, MAX_SCHEDE);
  t.c("la prima conosciuta ma riletta resta", !!trova(piena, "chi:n0"));
  t.eq("cade quella che non guardavi da piu' tempo", trova(piena, "chi:n1"), null);
  t.c("e la nuova c'e'", !!trova(piena, "chi:nuova"));

  // toccare quello che non c'e' non fa danni
  t.eq("un tocco a vuoto", tocca(piena, "chi:mai").length, MAX_SCHEDE);

  // ---- niente da rompere -------------------------------------------------
  t.eq("riporre nel nulla", riponi(undefined, voce("a", 0), 1).length, 1);
  t.eq("cercare nel nulla", trova(undefined, "chi:a"), null);
  t.eq("toccare il nulla", tocca(undefined, "chi:a").length, 0);
  // una scatola arrivata storta da IndexedDB non deve buttare giu' la scheda
  t.eq("voci monche si saltano", trova([null, { chiave: "chi:b" }], "chi:b")?.chiave, "chi:b");
}
