// IL TASTO INDIETRO DEL DISPOSITIVO NON DEVE PORTARE FUORI DALL'APP.
//
// Misurato su un libro vero, in un browser vero: aprire la Libreria,
// importare un tomo, aprirlo, voltare sei pagine, saltare a un capitolo
// dall'indice — `history.length` resta DUE, esattamente quanto valeva
// all'avvio. Nessun pezzo dell'app scriveva una tappa nella storia del
// browser: ne' le sezioni, ne' le schede, ne' il reader (gli iframe di
// epub.js non ne lasciano nessuna). Il tasto indietro del tablet non
// trovava quindi niente da chiudere e faceva l'unica cosa che gli
// restava: uscire dalla pagina. Atterraggio misurato: `about:blank`, ed
// e' lo schermo nero che il lettore vedeva.
//
// La cura e' UNA TAPPA SOLA, la guardia: finche' c'e' qualcosa di aperto
// — un pannello del reader, il libro, una scheda, una sezione che non e'
// l'ingresso — in cima alla storia c'e' una nostra tappa, e l'indietro se
// la mangia invece di portarsi via l'app. Chiuso quel livello, se sotto ce
// n'e' un altro la guardia si rimette; quando non resta piu' niente non si
// rimette, cosi' l'indietro successivo fa quello che deve fare davvero:
// chiudere l'app.
//
// Una tappa sola e non una per livello: una pila di tappe va tenuta in
// pari con lo stato di React a ogni apertura e a ogni chiusura, ed e' il
// modo classico di ritrovarsi la storia sfasata di uno e un tasto indietro
// che ogni tanto non fa niente. Qui lo stato vero sta tutto da una parte
// (i livelli aperti li conosce App) e qui c'e' solo un interruttore.
//
// L'unica finezza sta nel distinguere i ritorni: quello del LETTORE, che
// va servito chiudendo qualcosa, e quello che ci siamo provocati da soli.
// Chiuso l'ultimo livello col dito, la guardia va tolta — se restasse
// sarebbe una tappa morta che si mangia il primo indietro buono — e
// toglierla vuol dire chiamare `back()`, che fa scattare un `popstate`
// identico a quello del lettore. Il conto `nostri` e' tutto qui.
export function creaIndietro(storia) {
  // Ricaricando la pagina con qualcosa di aperto — un aggiornamento del
  // service worker, un riavvio della PWA — la guardia resta scritta nella
  // storia mentre l'app riparte dall'ingresso, con tutto chiuso. Si
  // riconosce dal marchio, e la prima sincronizzazione la porta via: senza
  // questa riga resterebbe li' a mangiarsi un indietro per niente.
  let guardia = !!(storia.state && storia.state.bc);
  let nostri = 0;
  return {
    // `aperto`: c'e' almeno un livello che il tasto indietro deve chiudere
    sincronizza(aperto) {
      if (aperto === guardia) return;
      if (aperto) {
        storia.pushState({ bc: 1 }, "");
      } else {
        nostri += 1;
        storia.back();
      }
      guardia = aperto;
    },
    // La risposta al `popstate`: `true` = e' stato il lettore, tocca a chi
    // chiama chiudere quello che sta sopra.
    tornato() {
      if (nostri > 0) {
        nostri -= 1;
        return false;
      }
      guardia = false;
      return true;
    },
    get guardia() {
      return guardia;
    },
  };
}
