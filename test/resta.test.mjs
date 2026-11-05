// IL TEMPO CHE RESTA, AL CAPITOLO E ALLA FINE (`lib/resta.js`). Chiesto dal
// lettore, come sul Kindle. Una stima sbagliata non alza nessun errore:
// dice un numero, e il numero sembra vero. Qui le regole che la tengono
// onesta.
import { aggiornaPasso, passoDi, leggiPasso, scriviPasso, fineDelCapitolo, tempoResta, fraseResta, PASSO_INIZIALE, PESO_INIZIALE, AVANZO_MAX, FINESTRA } from "../src/lib/resta.js";

const memoria = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
};

export default async function (t) {
  // ---- QUALI TRATTI CONTANO -----------------------------------------------
  const zero = { s: 0, u: 0 };
  t.c("un tratto sotto i due secondi e mezzo e' sfogliare", aggiornaPasso(zero, 2.4, 3) === zero);
  t.c("sopra i quattro minuti hai posato il libro", aggiornaPasso(zero, 241, 3) === zero);
  t.c("tornare indietro non conta", aggiornaPasso(zero, 30, -3) === zero && aggiornaPasso(zero, 30, 0) === zero);
  t.c("un salto oltre il massimo e' il cursore, non lettura", aggiornaPasso(zero, 30, AVANZO_MAX.epub + 1) === zero);
  t.c("nei fumetti il massimo e' il loro", aggiornaPasso(zero, 30, 3, AVANZO_MAX.fumetto) !== zero && aggiornaPasso(zero, 30, 4, AVANZO_MAX.fumetto) === zero);
  t.eq("una pagina letta si somma", JSON.stringify(aggiornaPasso(zero, 30, 3)), JSON.stringify({ s: 30, u: 3 }));
  t.eq("un tratto scartato torna lo stesso oggetto, anche da niente", aggiornaPasso(null, 1, 3), null);
  t.eq("un record rotto riparte da zero", JSON.stringify(aggiornaPasso({ s: "x" }, 30, 3)), JSON.stringify({ s: 30, u: 3 }));
  // oltre la finestra il conto si dimezza: la sera stanca pesa piu' del mese scorso
  const pieno = aggiornaPasso({ s: FINESTRA * 10, u: FINESTRA }, 60, 3);
  t.c("oltre la finestra il conto si dimezza e il passo resta", pieno.u < FINESTRA && Math.abs(passoDi(pieno, 10, 0) - (FINESTRA * 10 + 60) / (FINESTRA + 3)) < 0.01, JSON.stringify(pieno));

  // ---- IL PASSO: PRIMA QUELLO INIZIALE, POI IL TUO --------------------------
  t.eq("senza misure vale il passo iniziale", passoDi(zero), PASSO_INIZIALE.epub);
  t.eq("…anche senza record", passoDi(null, 30), 30);
  t.c("una pagina veloce lo abbassa un po', non lo rimpiazza", passoDi({ s: 10, u: 3 }) < PASSO_INIZIALE.epub && passoDi({ s: 10, u: 3 }) > 20);
  t.c("dopo tanto letto e' il tuo", Math.abs(passoDi({ s: 10 * 3000, u: 3000 }) - 10) < 0.2);
  t.c("il prior pesa quanto dichiarato", Math.abs(passoDi({ s: 10 * PESO_INIZIALE, u: PESO_INIZIALE }) - (10 + PASSO_INIZIALE.epub) / 2) < 1e-9);
  const m = memoria();
  t.eq("un libro mai letto parte da zero", JSON.stringify(leggiPasso("x", m)), JSON.stringify(zero));
  scriviPasso("x", { s: 90, u: 9 }, m);
  t.eq("e quel che si scrive si rilegge", JSON.stringify(leggiPasso("x", m)), JSON.stringify({ s: 90, u: 9 }));
  t.eq("una memoria rotta vuol dire zero", JSON.stringify(leggiPasso("x", { getItem: () => "{rotto" })), JSON.stringify(zero));

  // ---- LA FINE DEL CAPITOLO -----------------------------------------------
  const locs = ["epubcfi(/6/2!/4/2/1:0)", "epubcfi(/6/2!/4/4/1:0)", "epubcfi(/6/4[c1]!/4/2/1:0)", "epubcfi(/6/4[c1]!/4/6/1:0)", "epubcfi(/6/4[c1]!/4/8/1:0)", "epubcfi(/6/6!/4/2/1:0)"];
  t.eq("il capitolo finisce dove cambia il documento della spina", fineDelCapitolo(locs, 2), 4);
  t.eq("…anche dalla sua ultima location", fineDelCapitolo(locs, 4), 4);
  t.eq("il primo capitolo", fineDelCapitolo(locs, 0), 1);
  t.eq("l'ultimo capitolo finisce col libro", fineDelCapitolo(locs, 5), 5);
  t.eq("fuori dal libro niente", fineDelCapitolo(locs, 6), null);
  t.eq("senza elenco niente", fineDelCapitolo(null, 0), null);
  t.eq("un CFI senza «!» e' un capitolo a se'", fineDelCapitolo(["a", "b", "c"], 0), 0);

  // ---- IL TEMPO -----------------------------------------------------------
  const r = tempoResta({ qui: 2, fine: 6, fineCapitolo: 4, passo: 30 });
  t.eq("al capitolo: le location che restano, questa compresa", r.capitolo, 90);
  t.eq("alla fine: tutte quelle dopo", r.libro, 120);
  t.eq("senza capitolo resta la fine", tempoResta({ qui: 2, fine: 6, passo: 30 }).capitolo, null);
  t.eq("un capitolo gia' passato non e' un capitolo", tempoResta({ qui: 5, fine: 6, fineCapitolo: 4, passo: 30 }).capitolo, null);
  t.eq("in fondo resta zero", tempoResta({ qui: 6, fine: 6, passo: 30 }).libro, 0);
  t.eq("senza posizione niente", tempoResta({ qui: null, fine: 6, passo: 30 }), null);
  t.eq("senza passo niente", tempoResta({ qui: 1, fine: 6, passo: 0 }), null);

  // ---- LA FRASE -----------------------------------------------------------
  t.eq("capitolo e fine", fraseResta({ capitolo: 12 * 60, libro: 3 * 3600 }), "12 min al capitolo · 3 h alla fine");
  t.eq("solo la fine", fraseResta({ capitolo: null, libro: 65 * 60 }), "1 h 5 min alla fine");
  t.eq("in fondo al capitolo", fraseResta({ capitolo: 20, libro: 600 }), "meno di un minuto al capitolo · 10 min alla fine");
  t.eq("senza stima niente frase", fraseResta(null), null);
}
