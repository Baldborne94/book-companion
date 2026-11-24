// LE COPERTINE DEL GIRO DICONO A CHE PUNTO SONO (`fraseCopertine`): il
// primo giro di un telefono ne scarica centinaia, e «Ricevo le novità…»
// fermo per un minuto sembra un'app bloccata. Gli zeri non si dicono.
import { fraseCopertine, COPERTINE_INSIEME, mandaCopertine } from "../src/lib/syncCore.js";

export default async (t) => {
  t.eq("all'inizio, quante", fraseCopertine(0, 727), "Riprendo 727 copertine…");
  t.eq("strada facendo, a che punto", fraseCopertine(300, 727), "Copertine: 300 di 727…");
  t.eq("una sola, al singolare", fraseCopertine(0, 1), "Riprendo una copertina…");
  t.eq("nessuna, niente da dire", fraseCopertine(0, 0), "");
  t.c("piu' d'una alla volta, ma non tutta la banda", COPERTINE_INSIEME > 1 && COPERTINE_INSIEME <= 8);

  // E SALGONO A GRUPPI, dicendo a che punto sono (segnalato dal lettore
  // davanti a «Mando su le copertine…» ferma senza conto)
  t.eq("su: all'inizio, quante", fraseCopertine(0, 840, { su: true }), "Mando su 840 copertine…");
  t.eq("su: strada facendo", fraseCopertine(120, 840, { su: true }), "Mando su le copertine: 120 di 840…");
  t.eq("su: una sola", fraseCopertine(0, 1, { su: true }), "Mando su una copertina…");

  const libri = Array.from({ length: 30 }, (_, i) => ({ id: `b${i}` }));
  const mandate = [];
  let inVolo = 0;
  let massimo = 0;
  const detto = [];
  const t0 = Date.now();
  const salite = await mandaCopertine(libri, {
    prendi: async (id) => (id === "b3" ? null : { size: Number(id.slice(1)) + 100 }),
    manda: async (id) => {
      mandate.push(id);
      inVolo += 1;
      massimo = Math.max(massimo, inVolo);
      await new Promise((r) => setTimeout(r, 20));
      inVolo -= 1;
      if (id === "b5") throw new Error("rete");
      return id !== "b7";
    },
    say: (m) => detto.push(m),
  });
  const ms = Date.now() - t0;
  t.eq("in volo insieme quante ne dice COPERTINE_INSIEME", massimo, COPERTINE_INSIEME);
  t.c(`a gruppi ci mette una frazione del tempo di una alla volta (${ms} ms contro ~600)`, ms < 250);
  t.eq("salgono tutte tranne chi non ha copertina, chi cade e chi e' rifiutata", salite.map((x) => x.id).sort().join(), libri.map((b) => b.id).filter((id) => !["b3", "b5", "b7"].includes(id)).sort().join());
  t.c("chi non ha copertina qui non si manda", !mandate.includes("b3") && mandate.length === 29);
  t.eq("col loro peso", salite.find((x) => x.id === "b12")?.byte, 112);
  t.eq("dice quante all'inizio e a che punto ogni dieci", detto.join(" | "), "Mando su 30 copertine… | Mando su le copertine: 10 di 30… | Mando su le copertine: 20 di 30…");
  t.eq("niente da mandare, niente da dire", (await mandaCopertine([], { prendi: async () => null, manda: async () => true, say: (m) => detto.push(m) })).length + detto.length, 3);
};
