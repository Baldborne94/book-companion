// LE PROMESSE DI UNA VIEW TRANSITION CHE NESSUNO ASCOLTAVA. Il reader
// aspettava `finished` per chiudere la voltata, ma `startViewTransition`
// ne restituisce tre: quando la transizione si interrompe — il tablet
// spento a meta' voltata, il disegno sospeso oltre il tempo che Chrome
// concede — `ready` si rompe con «Transition was aborted because of
// timeout in DOM update», e senza nessuno che la prenda finiva nel
// registro dei guasti come promessa (il rapporto del tablet, 06/11). La
// pagina era gia' voltata: non e' un guasto, e la voltata si chiude lo
// stesso da `finished`.
const zitta = () => {};

export function seguiTransizione(vt, chiudi) {
  vt?.ready?.catch?.(zitta);
  vt?.updateCallbackDone?.catch?.(zitta);
  vt?.finished?.then?.(chiudi, chiudi);
}
