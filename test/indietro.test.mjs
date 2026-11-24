// IL TASTO INDIETRO, PROVATO SULLA STORIA FINTA.
//
// Il difetto che si cura qui e' misurato in un browser vero: aprendo la
// Libreria, importando un tomo, aprendolo e voltando pagine, la storia del
// browser resta lunga due — l'app non ci scriveva mai niente — e il tasto
// indietro del tablet finiva su `about:blank`. La cura sta in una tappa
// sola, e le due trappole sono qui sotto: la guardia che si rimette da
// sola, e il ritorno che ci siamo provocati da noi e che non va servito
// come se fosse un tocco del lettore.
import { creaIndietro } from "../src/lib/indietro.js";

// La storia del browser ridotta all'osso: una pila di tappe e il conto di
// chi ha chiamato che cosa. `back()` non fa scattare niente da solo —
// il `popstate` lo consegna il test, come farebbe il browser.
function storiaFinta(stato = null) {
  const s = {
    state: stato,
    pile: [],
    pushState(st) {
      s.pile.push(st);
      s.state = st;
    },
    back() {
      s.pile.pop();
      s.state = s.pile[s.pile.length - 1] || null;
    },
  };
  return s;
}

export default async function (t) {
  // ---- niente aperto, niente scritto -----------------------------------
  {
    const s = storiaFinta();
    const g = creaIndietro(s);
    g.sincronizza(false);
    t.eq("a mani vuote non si scrive nella storia", s.pile.length, 0);
  }

  // ---- un livello aperto mette la guardia, e una sola ------------------
  {
    const s = storiaFinta();
    const g = creaIndietro(s);
    g.sincronizza(true);
    g.sincronizza(true);
    g.sincronizza(true);
    t.eq("un livello aperto = una tappa", s.pile.length, 1);
    t.c("ed e' marchiata come nostra", !!s.state?.bc);
    t.c("la guardia si dichiara alzata", g.guardia === true);
  }

  // ---- il ritorno del lettore va servito -------------------------------
  {
    const s = storiaFinta();
    const g = creaIndietro(s);
    g.sincronizza(true);
    s.back(); // il dito sul tasto del dispositivo
    t.c("il ritorno del lettore chiede di chiudere", g.tornato() === true);
    t.c("e la guardia se n'e' andata con lui", g.guardia === false);
    // chiuso l'ultimo livello, non si deve chiamare `back()` una seconda
    // volta: la tappa l'ha gia' consumata il lettore, e un altro passo
    // indietro porterebbe fuori dall'app
    const prima = s.pile.length;
    g.sincronizza(false);
    t.eq("chiuso il livello, nessun passo in piu'", s.pile.length, prima);
  }

  // ---- ne restava un altro sotto: la guardia si rimette ----------------
  {
    const s = storiaFinta();
    const g = creaIndietro(s);
    g.sincronizza(true);
    s.back();
    g.tornato();
    g.sincronizza(true);
    t.eq("con un livello ancora aperto la guardia torna", s.pile.length, 1);
    t.c("e la storia non cresce a ogni giro", g.guardia === true);
  }

  // ---- chiuso col dito: la tappa morta si toglie -----------------------
  {
    const s = storiaFinta();
    const g = creaIndietro(s);
    g.sincronizza(true);
    g.sincronizza(false);
    t.eq("chiudendo col dito la guardia si toglie", s.pile.length, 0);
    // ed e' il `back()` di poco fa a far scattare il popstate: servirlo
    // come un tocco del lettore vorrebbe dire chiudere DUE livelli con un
    // tocco solo
    t.c("il ritorno provocato da noi non si serve", g.tornato() === false);
    t.c("e non e' rimasta una guardia fantasma", g.guardia === false);
  }

  // ---- due giri di fila, che e' il caso di tutti i giorni --------------
  {
    const s = storiaFinta();
    const g = creaIndietro(s);
    for (let i = 0; i < 5; i++) {
      g.sincronizza(true);
      s.back();
      if (g.tornato()) g.sincronizza(false);
    }
    t.eq("aprendo e chiudendo cinque volte la storia resta pulita", s.pile.length, 0);
  }

  // ---- ricaricata la pagina con qualcosa di aperto ---------------------
  {
    // il service worker aggiorna, la PWA riparte: l'app torna all'ingresso
    // con tutto chiuso, ma la guardia e' rimasta scritta nella storia
    const s = storiaFinta({ bc: 1 });
    s.pile.push({ bc: 1 });
    const g = creaIndietro(s);
    t.c("la guardia di prima si riconosce", g.guardia === true);
    g.sincronizza(false);
    t.eq("e la prima sincronizzazione la porta via", s.pile.length, 0);
  }

  // ---- una tappa che non e' nostra non ci riguarda ---------------------
  {
    const s = storiaFinta({ altro: true });
    const g = creaIndietro(s);
    t.c("una tappa d'altri non si scambia per la guardia", g.guardia === false);
  }
}
