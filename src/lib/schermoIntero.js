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
// L'APK invece tiene la barra di Android (`guscio` in `scripts/apk.mjs`: a
// tutto schermo la pagina saltava a ogni barra che ricompariva), e li' il
// tasto torna: si legge a tutto schermo quando si vuole.
//
// Un browser che la domanda non la capisce (o esplode a farla) vale «non a
// tutto schermo»: il tasto resta, che e' il lato sicuro — al peggio c'e' un
// tasto in piu', mai uno schermo intero irraggiungibile.
//
// MA LO SCHERMO INTERO CHIESTO COL TASTO NON E' «L'APP APERTA A TUTTO
// SCHERMO» (segnalato dal lettore, col tablet in mano: «se metto nel reader
// lo schermo intero questo non mi permette di tornare fuori»). Chrome risponde
// `display-mode: fullscreen` anche mentre un elemento e' a tutto schermo per
// conto della pagina: toccato «Schermo» il tasto si credeva inutile e spariva,
// e «Esci» con lui. Nel browser bastava il gesto indietro; nell'APK, da quando
// tiene la barra di Android, il tasto e' la sola porta e la porta si chiudeva
// alle spalle. Aperta a tutto schermo vuol dire: lo dice il modo, e nessun
// elemento lo ha chiesto.
export function apertaATuttoSchermo(finestra = globalThis) {
  try {
    return !!finestra?.matchMedia?.("(display-mode: fullscreen)")?.matches && !finestra.document?.fullscreenElement;
  } catch {
    return false;
  }
}

export const serveTastoSchermo = ({ abilitato, giaTuttoSchermo }) => !!abilitato && !giaTuttoSchermo;
