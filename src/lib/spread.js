// epub.js passa al capitolo successivo appena non resta un doppio foglio
// intero (DefaultViewManager.next: `left <= scrollWidth`). Se un capitolo
// finisce su una colonna dispari, quella pagina non viene mostrata mai.
// Qui si guarda se resta carta: in tal caso la si scorre invece di saltare.
//
// Inerte quando la libreria si comporta — con i contenuti che riempiono il
// doppio foglio il residuo e' zero e si delega a next() come sempre — e
// incapace di bloccare la lettura: dopo aver scorso il residuo il giro
// successivo trova zero e passa al capitolo.
export function leftoverScroll(manager) {
  const c = manager?.container;
  if (!c || !manager.isPaginated) return 0;
  if (manager.settings?.axis !== "horizontal") return 0;
  const dir = manager.settings?.direction;
  if (dir && dir !== "ltr") return 0;
  const delta = manager.layout?.delta || 0;
  if (delta <= 0) return 0;
  const rest = c.scrollWidth - c.scrollLeft - c.offsetWidth;
  return rest > 4 && rest < delta - 4 ? rest : 0;
}

// LA VOLTATA RESTA DENTRO IL CAPITOLO?
//
// È la domanda su cui gira tutta l'animazione, e la risposta si sa PRIMA
// di voltare: dentro un capitolo epub.js non ricostruisce niente, sposta
// solo `container.scrollLeft` di una facciata — il testo della pagina
// dopo è già lì, di fianco. Quella è la voltata che può scivolare.
//
// Al confine invece il capitolo si smonta e si rimonta, la misura balla
// finché non arrivano i font, e lì resta il velo color carta: è la
// ragione per cui il velo esiste, e non si tocca.
//
// Il conto è lo STESSO di `DefaultViewManager.next()` — `left <=
// scrollWidth` — perché la domanda è letteralmente «epub.js scorrerà o
// cambierà capitolo?»: rispondere con una regola nostra vorrebbe dire
// indovinare quello che lui poi farà davvero.
export function dentroIlCapitolo(manager, dir) {
  const c = manager?.container;
  if (!c || !manager.isPaginated) return false;
  if (manager.settings?.axis !== "horizontal") return false;
  const d = manager.settings?.direction;
  if (d && d !== "ltr") return false;
  const delta = manager.layout?.delta || 0;
  if (delta <= 0) return false;
  if (dir === "prev") return c.scrollLeft > 0;
  return c.scrollLeft + c.offsetWidth + delta <= c.scrollWidth;
}
