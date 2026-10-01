// LE COPERTINE DEL GIRO DICONO A CHE PUNTO SONO (`fraseCopertine`): il
// primo giro di un telefono ne scarica centinaia, e «Ricevo le novità…»
// fermo per un minuto sembra un'app bloccata. Gli zeri non si dicono.
import { fraseCopertine, COPERTINE_INSIEME } from "../src/lib/syncCore.js";

export default async (t) => {
  t.eq("all'inizio, quante", fraseCopertine(0, 727), "Riprendo 727 copertine…");
  t.eq("strada facendo, a che punto", fraseCopertine(300, 727), "Copertine: 300 di 727…");
  t.eq("una sola, al singolare", fraseCopertine(0, 1), "Riprendo una copertina…");
  t.eq("nessuna, niente da dire", fraseCopertine(0, 0), "");
  t.c("piu' d'una alla volta, ma non tutta la banda", COPERTINE_INSIEME > 1 && COPERTINE_INSIEME <= 8);
};
