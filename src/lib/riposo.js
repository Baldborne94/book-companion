// A RIPOSO: quel che non serve al primo disegno aspetta che il browser sia
// libero (il video dell'avvio: la pagina vuota per un secondo e piu' mentre
// l'Ingresso contava i «da prendere» di duemila libri). Torna la funzione
// che annulla, per l'effetto che si smonta prima.
export function aRiposo(f, { finestra = globalThis.window, entro = 4000 } = {}) {
  if (typeof finestra?.requestIdleCallback === "function") {
    const id = finestra.requestIdleCallback(f, { timeout: entro });
    return () => finestra.cancelIdleCallback?.(id);
  }
  const id = setTimeout(f, 300);
  return () => clearTimeout(id);
}
