// LA RETE CHE CADE NON VA NEL REGISTRO DEI GUASTI. Il rapporto del tablet
// aveva due «TypeError: Failed to fetch» della sincronizzazione con la wifi
// a 1,5 Mbit/s: la sincronizzazione riprova da sola, e quelle righe
// coprivano i guasti veri. `eDiRete` decide cosa si tace (App.jsx).
import { eDiRete, spiegaSync } from "../src/lib/syncCore.js";

export default async (t) => {
  // il messaggio VERO del rapporto, e quelli degli altri browser
  t.c("«Failed to fetch» di Chrome è la rete", eDiRete(new TypeError("Failed to fetch")));
  t.c("«Load failed» di Safari è la rete", eDiRete(new TypeError("Load failed")));
  t.c("«NetworkError» di Firefox è la rete", eDiRete(new TypeError("NetworkError when attempting to fetch resource.")));

  // quel che resta nel registro: i guasti veri
  t.c("un errore del database non è la rete", !eDiRete({ message: 'null value in column "fav" violates not-null constraint', status: 400 }));
  t.c("una sessione scaduta non è la rete", !eDiRete({ message: "JWT expired", status: 401 }));
  t.c("un 5xx con «fetch» nel testo ha uno stato: non è la rete", !eDiRete({ message: "fetch failed upstream", status: 502 }));
  t.c("un errore senza messaggio non è la rete", !eDiRete(new Error("")));

  // la stessa regola dice la frase sullo schermo: le due strade non si separano
  t.c("la frase della rete viene dalla stessa regola", /rete/.test(spiegaSync(new TypeError("Failed to fetch")).frase));
};
