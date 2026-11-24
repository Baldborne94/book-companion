// IL NUMERO DELL'OBIETTIVO SCRITTO A MANO. Un numero letto storto non alza
// errori: diventa l'obiettivo dell'anno, e da li' ogni «in pari» e ogni
// «indietro» del diario racconta una cosa falsa.
import { numeroObiettivo, MAX_OBIETTIVO, conObiettivo, obiettivoDi } from "../src/lib/obiettivo.js";

export default async function (t) {
  t.eq("un numero scritto vale", numeroObiettivo("80"), 80);
  t.eq("gli spazi attorno non contano", numeroObiettivo(" 30 "), 30);
  t.eq("uno e' un obiettivo", numeroObiettivo("1"), 1);
  t.eq("lo zero ha il suo tasto, non si scrive", numeroObiettivo("0"), null);
  t.eq("vuoto non e' un numero", numeroObiettivo(""), null);
  t.eq("… nemmeno gli spazi", numeroObiettivo("   "), null);
  t.eq("niente decimali: un libro e' un libro", numeroObiettivo("12.5"), null);
  t.eq("niente negativi", numeroObiettivo("-5"), null);
  t.eq("niente lettere", numeroObiettivo("12a"), null);
  t.eq("il tetto e' ancora un obiettivo", numeroObiettivo(String(MAX_OBIETTIVO)), MAX_OBIETTIVO);
  t.eq("oltre il tetto e' un dito scivolato", numeroObiettivo(String(MAX_OBIETTIVO + 1)), null);
  t.eq("null non esplode", numeroObiettivo(null), null);
  // la catena fino all'obiettivo dell'anno
  const tutti = conObiettivo({}, 2026, numeroObiettivo("80"), 5);
  t.eq("scritto, diventa l'obiettivo dell'anno", obiettivoDi(tutti, 2026), 80);
}
