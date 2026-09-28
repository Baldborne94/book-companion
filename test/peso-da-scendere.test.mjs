// QUANTO PESA «SCARICA QUI»: il numero sul tasto e' quel che il lettore
// legge prima di spendere connessione e tablet, e un numero sbagliato non
// alza nessun errore.
import { pesoDaScendere } from "../src/lib/driveCore.js";

export default async function (t) {
  const mappa = { a: { id: "A", byte: 1000 }, b: { id: "B", byte: 2500 } };
  const tutti = pesoDaScendere([{ id: "a" }, { id: "b" }], mappa);
  t.eq("somma le misure di Drive", tutti.byte, 3500);
  t.c("tutti misurati: il totale e' un totale", tutti.tutti);
  const parte = pesoDaScendere([{ id: "a" }, { id: "solo-nel-secchio" }], mappa);
  t.eq("chi non ha misura non si inventa", parte.byte, 1000);
  t.c("uno senza misura: si dice «almeno»", !parte.tutti);
  const storta = pesoDaScendere([{ id: "c" }], { c: { byte: "boh" } });
  t.eq("una misura storta non fa NaN", storta.byte, 0);
  t.c("e non conta come misurata", !storta.tutti);
  t.c("una misura zero non e' una misura", !pesoDaScendere([{ id: "z" }], { z: { byte: 0 } }).tutti);
  t.eq("niente mappa, zero", pesoDaScendere([{ id: "a" }], null).byte, 0);
  t.c("elenco vuoto: niente da dire, ma e' «tutto»", pesoDaScendere([], mappa).tutti);
}
