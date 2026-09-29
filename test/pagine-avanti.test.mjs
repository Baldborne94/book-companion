// LE PAGINE AVANTI DEI FUMETTI (`pagineAvanti`, `daPreparare` in
// `lib/fumetto.js`). Sbagliano in silenzio: troppo poche e le voltate
// svelte aspettano Drive, troppe sul cellulare e i byte si pagano.
import { pagineAvanti, daPreparare, AVANTI_DA_LONTANO, AVANTI_A_CONSUMO, AVANTI_QUI } from "../src/lib/fumetto.js";

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
}
