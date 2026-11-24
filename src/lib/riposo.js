// A RIPOSO: quel che non serve al primo disegno aspetta che il browser sia
// libero (il video dell'avvio: la pagina vuota per un secondo e piu' mentre
// l'Ingresso contava i «da prendere» di duemila libri). Torna la funzione
// che annulla, per l'effetto che si smonta prima. La funzione riceve la
// scadenza del riposo (`timeRemaining`); senza `requestIdleCallback` se ne
// finge una breve.
export function aRiposo(f, { finestra = globalThis.window, entro = 4000 } = {}) {
  if (typeof finestra?.requestIdleCallback === "function") {
    const id = finestra.requestIdleCallback(f, { timeout: entro });
    return () => finestra.cancelIdleCallback?.(id);
  }
  const id = setTimeout(() => {
    const fine = Date.now() + FINTO_RIPOSO;
    f({ didTimeout: false, timeRemaining: () => Math.max(0, fine - Date.now()) });
  }, 300);
  return () => clearTimeout(id);
}
const FINTO_RIPOSO = 10;

// A FETTE (le copertine dell'Ingresso arrivavano un secondo dopo il testo):
// un conto su tutta la biblioteca fatto in un riposo solo teneva il filo
// occupato 600 ms, e le risposte di IndexedDB con le miniature aspettavano
// dietro di lui. Qui si fanno tanti elementi quanti ne stanno nel tempo
// libero che il browser concede, poi si lascia passare il resto e si
// riprende al riposo dopo. `fa` che torna `true` ferma il giro (come
// `some`), e `poi` riceve se si e' fermato. Almeno un elemento a fetta,
// o un browser mai libero non finirebbe mai.
export function aFette(lista, fa, { poi, finestra = globalThis.window, margine = 2 } = {}) {
  let i = 0;
  let via = false;
  let annulla = () => {};
  const fetta = (scadenza) => {
    if (via) return;
    do {
      if (fa(lista[i++]) === true) return poi?.(true);
    } while (i < lista.length && scadenza.timeRemaining() > margine);
    if (i < lista.length) annulla = aRiposo(fetta, { finestra });
    else poi?.(false);
  };
  if (!lista.length) {
    annulla = aRiposo(() => !via && poi?.(false), { finestra });
  } else annulla = aRiposo(fetta, { finestra });
  return () => {
    via = true;
    annulla();
  };
}
