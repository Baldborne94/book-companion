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
