// IL TASTO ⛶ DOVE SERVE. Sbagliato in un verso, l'avviso di Chrome torna a
// ogni tocco dentro l'app installata; nell'altro, nella scheda del browser
// lo schermo intero non si raggiunge piu' da nessuna parte.
import { apertaATuttoSchermo, serveTastoSchermo } from "../src/lib/schermoIntero.js";

const finestra = (vero) => ({ matchMedia: (q) => ({ matches: vero && q === "(display-mode: fullscreen)" }) });

export default async function (t) {
  t.eq("l'app installata a tutto schermo si riconosce", apertaATuttoSchermo(finestra(true)), true);
  t.eq("la scheda del browser no", apertaATuttoSchermo(finestra(false)), false);
  // Chrome dice `display-mode: fullscreen` anche mentre un elemento e' a tutto
  // schermo per conto della pagina: toccato «Schermo», il tasto spariva e non
  // si usciva piu'
  t.eq("lo schermo intero chiesto col tasto non e' l'app a tutto schermo", apertaATuttoSchermo({ ...finestra(true), document: { fullscreenElement: {} } }), false);
  t.eq("uscito da quello, l'app installata torna a riconoscersi", apertaATuttoSchermo({ ...finestra(true), document: { fullscreenElement: null } }), true);
  t.eq("senza matchMedia vale «no»", apertaATuttoSchermo({}), false);
  t.eq(
    "una domanda che esplode vale «no»: il tasto resta, che e' il lato sicuro",
    apertaATuttoSchermo({ matchMedia: () => { throw new Error("x"); } }),
    false
  );
  t.eq("nel browser il tasto c'e'", serveTastoSchermo({ abilitato: true, giaTuttoSchermo: false }), true);
  t.eq("nell'app a tutto schermo non serve", serveTastoSchermo({ abilitato: true, giaTuttoSchermo: true }), false);
  t.eq("dove il browser non lo permette non c'e'", serveTastoSchermo({ abilitato: false, giaTuttoSchermo: false }), false);
}
