// IL TASTO ⛶ C'E' SOLO DOVE SERVE (chiesto dal lettore: «non voglio che mi
// appaia ogni volta quel messaggio sotto quando sono in fullscreen»). Il
// messaggio e' l'avviso di sicurezza che Chrome mette a ogni ingresso nello
// schermo intero chiesto da una pagina, e dalla pagina non si spegne. La cura
// e' il manifest: l'app installata si apre gia' a tutto schermo
// (`display: fullscreen`), e li' l'avviso non esiste.
//
// Quindi dentro l'app installata il tasto non serve piu' — lo schermo e' gia'
// tutto tuo — e toglierlo e' anche quel che impedisce di far ricomparire
// l'avviso toccandolo. Nella scheda del browser invece resta: li' lo schermo
// intero si ottiene solo col tasto, e il prezzo e' l'avviso.
//
// Un browser che la domanda non la capisce (o esplode a farla) vale «non a
// tutto schermo»: il tasto resta, che e' il lato sicuro — al peggio c'e' un
// tasto in piu', mai uno schermo intero irraggiungibile.
export function apertaATuttoSchermo(finestra = globalThis) {
  try {
    return !!finestra?.matchMedia?.("(display-mode: fullscreen)")?.matches;
  } catch {
    return false;
  }
}

export const serveTastoSchermo = ({ abilitato, giaTuttoSchermo }) => !!abilitato && !giaTuttoSchermo;
