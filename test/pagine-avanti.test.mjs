// LE PAGINE AVANTI DEI FUMETTI (`pagineAvanti`, `daPreparare` in
// `lib/fumetto.js`). Sbagliano in silenzio: troppo poche e le voltate
// svelte aspettano Drive, troppe sul cellulare e i byte si pagano.
import { pagineAvanti, daPreparare, daLasciare, MEMORIA_PAGINE, AVANTI_DA_LONTANO, AVANTI_A_CONSUMO, AVANTI_QUI } from "../src/lib/fumetto.js";

export default async function (t) {
  t.eq("sul tablet bastano le vicine", pagineAvanti({ lontano: false, connessione: { type: "wifi" } }), AVANTI_QUI);
  t.eq("da Drive in Wi-Fi, parecchie", pagineAvanti({ lontano: true, connessione: { type: "wifi" } }), AVANTI_DA_LONTANO);
  t.eq("da Drive sul cellulare, poche", pagineAvanti({ lontano: true, connessione: { type: "cellular" } }), AVANTI_A_CONSUMO);
  t.eq("col «risparmio dati» acceso, poche anche in Wi-Fi", pagineAvanti({ lontano: true, connessione: { type: "wifi", saveData: true } }), AVANTI_A_CONSUMO);
  t.eq("una rete che il browser non dice (il PC) vale libera", pagineAvanti({ lontano: true, connessione: null }), AVANTI_DA_LONTANO);
  t.c("da lontano piu' che qui, e sul cellulare meno che in Wi-Fi", AVANTI_DA_LONTANO > AVANTI_A_CONSUMO && AVANTI_A_CONSUMO >= AVANTI_QUI);

  t.eq("le pagine dopo quella a schermo, in ordine", daPreparare(5, 100, 4).join(), "6,7,8,9");
  t.eq("saltando quelle gia' pronte", daPreparare(5, 100, 4, new Set([6, 8])).join(), "7,9");
  t.eq("mai oltre la fine del volume", daPreparare(98, 100, 10).join(), "99,100");
  t.eq("in fondo, niente", daPreparare(100, 100, 10).length, 0);

  // ---- le pagine gia' aperte restano, fino al tetto (`daLasciare`) -------------
  const MB = 1024 * 1024;
  const pronte = (da, a, mb) => Array.from({ length: a - da + 1 }, (_, i) => [da + i, mb * MB]);
  const f = { attorno: 20, dietro: 4, avanti: 12 };
  t.eq("sotto il tetto non se ne va nessuna, neanche le lontane", daLasciare(pronte(1, 30, 3), f).length, 0);
  const via = daLasciare(pronte(1, 30, 10), f);
  t.c("oltre il tetto se ne va qualcuna", via.length > 0);
  t.eq("…le piu' lontane per prime", via.slice(0, 3).join(), "1,2,3");
  const resta = pronte(1, 30, 10).filter(([n]) => !via.includes(n));
  t.c("…fino a stare sotto il tetto", resta.length * 10 * MB <= MEMORIA_PAGINE, `${resta.length} pagine`);
  t.c("…e non una di piu'", (resta.length + 1) * 10 * MB > MEMORIA_PAGINE, `${resta.length} pagine`);
  t.eq("oltre il tetto se ne vanno solo quelle fuori dalla finestra, dietro e avanti", daLasciare(pronte(14, 34, 100), f).sort((a, b) => a - b).join(), "14,15,33,34");
  t.eq("dietro e avanti conta la distanza, non il verso", daLasciare([[5, 60 * MB], [34, 60 * MB], [20, 60 * MB]], { ...f, tetto: 130 * MB }).join(), "5");
  t.eq("…anche quando la lontana sta avanti (un salto col cursore)", daLasciare([[12, 60 * MB], [40, 60 * MB], [20, 60 * MB]], { ...f, tetto: 130 * MB }).join(), "40");
}
