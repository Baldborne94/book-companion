// IL SALVASCHERMO CON LA COPERTINA (`lib/salvaschermo.js`). Chiesto dal
// lettore: «molte copertine sono proprio artistiche, averle tipo
// salvaschermo sarebbe figo». E chi si addormenta col libro aperto non deve
// ritrovare il tablet acceso al mattino.
import { leggiSalvaschermo, scriviSalvaschermo, fase, prossimoCambio, PREDEFINITO, fraseMinuti } from "../src/lib/salvaschermo.js";

const memoria = (iniziale = {}) => {
  const m = new Map(Object.entries(iniziale));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
};
const MIN = 60000;

export default async function (t) {
  // ---- LE PREFERENZE ----------------------------------------------------
  t.eq("senza scelte, il predefinito", JSON.stringify(leggiSalvaschermo(memoria())), JSON.stringify(PREDEFINITO));
  const una = memoria({ bc_salvaschermo: JSON.stringify({ spegni: 30 }) });
  t.eq("una scelta sola sta sopra il predefinito", JSON.stringify(leggiSalvaschermo(una)), JSON.stringify({ copertina: PREDEFINITO.copertina, spegni: 30 }));
  t.eq("«mai» è una scelta, non un vuoto", leggiSalvaschermo(memoria({ bc_salvaschermo: '{"copertina":0}' })).copertina, 0);
  t.eq("una scelta rotta torna al predefinito", leggiSalvaschermo(memoria({ bc_salvaschermo: '{"copertina":-3}' })).copertina, PREDEFINITO.copertina);
  t.eq("un salvataggio vuoto («null») non rompe niente", leggiSalvaschermo(memoria({ bc_salvaschermo: "null" })).copertina, PREDEFINITO.copertina);
  t.eq("un salvataggio illeggibile non rompe niente", leggiSalvaschermo(memoria({ bc_salvaschermo: "{rotto" })).spegni, PREDEFINITO.spegni);
  const m = memoria();
  scriviSalvaschermo({ copertina: 3 }, m);
  scriviSalvaschermo({ spegni: 0 }, m);
  t.eq("scrivere un tempo non cancella l'altro", JSON.stringify(leggiSalvaschermo(m)), JSON.stringify({ copertina: 3, spegni: 0 }));

  // ---- LE FASI -----------------------------------------------------------
  const p = { copertina: 5, spegni: 10 };
  t.eq("appena toccato, sveglio", fase({ ...p, fermo: 0 }), "sveglio");
  t.eq("un attimo prima, ancora sveglio", fase({ ...p, fermo: 5 * MIN - 1 }), "sveglio");
  t.eq("ai cinque minuti, la copertina", fase({ ...p, fermo: 5 * MIN }), "copertina");
  t.eq("dieci minuti dopo la copertina, lo schermo si lascia", fase({ ...p, fermo: 15 * MIN }), "spento");
  t.eq("…non prima", fase({ ...p, fermo: 15 * MIN - 1 }), "copertina");
  t.eq("con «poi mai» resta la copertina", fase({ copertina: 5, spegni: 0, fermo: 600 * MIN }), "copertina");
  t.eq("con la copertina a «mai» tutto come prima", fase({ copertina: 0, spegni: 10, fermo: 600 * MIN }), "sveglio");
  t.eq("un lavoro lungo tiene sveglio", fase({ ...p, fermo: 600 * MIN, lavoroLungo: true }), "sveglio");

  // ---- UN TIMER SOLO -----------------------------------------------------
  t.eq("il prossimo cambio è la copertina", prossimoCambio({ ...p, fermo: 2 * MIN }), 3 * MIN);
  t.eq("a copertina accesa, lo spegnimento", prossimoCambio({ ...p, fermo: 6 * MIN }), 9 * MIN);
  t.eq("a schermo lasciato, niente più", prossimoCambio({ ...p, fermo: 20 * MIN }), null);
  t.eq("con «poi mai», niente dopo la copertina", prossimoCambio({ copertina: 5, spegni: 0, fermo: 6 * MIN }), null);
  t.eq("salvaschermo spento, nessun timer", prossimoCambio({ copertina: 0, spegni: 10, fermo: 0 }), null);
  t.eq("durante un lavoro lungo si riguarda ogni minuto", prossimoCambio({ ...p, fermo: 0, lavoroLungo: true }), MIN);

  t.eq("le scelte si dicono", [fraseMinuti(5), fraseMinuti(0)].join(), "5 min,Mai");
}
