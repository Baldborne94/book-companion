// L'APERTURA DI UN LIBRO SENZA RIFARE QUEL CHE SI SAPEVA GIA'. Tre memorie,
// e tre modi di sbagliare in silenzio: un avanzo di un'altra finestra
// taglierebbe una riga, una misura delle pagine di un altro file darebbe
// percentuali sballate per sempre.
import { chiaveAvanzo, avanzoRicordato, avanzoDaAltri, ricordaAvanzo, chiaveRicordo, CHIAVE_SCHERMO, GEOMETRIE_PER_LIBRO, GEOMETRIE_SCHERMO } from "../src/lib/avanzoRicordato.js";
import { misuraDaSalvare, misuraBuona } from "../src/lib/misuraSalvata.js";

function finto() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m };
}

export default async function (t) {
  // ---- l'avanzo ricordato ----
  {
    const s = { fontSize: 100, lineHeight: 1.5, font: "original", flow: "paginated", margin: 24, justify: true };
    const k = chiaveAvanzo({ larghezza: 1280, altezza: 800, settings: s });
    const st = finto();
    t.eq("mai misurato: niente", avanzoRicordato("a", k, st), null);
    ricordaAvanzo("a", k, 11, st);
    t.eq("stessa finestra e stesse impostazioni: lo stesso avanzo", avanzoRicordato("a", k, st), 11);
    t.eq("sotto la chiave del libro", JSON.parse(st.m.get(chiaveRicordo("a"))).voci[0][1], 11);
    t.eq("un altro libro non lo eredita", avanzoRicordato("b", k, st), null);
    const altra = (patch, dim = {}) => chiaveAvanzo({ larghezza: 1280, altezza: 800, ...dim, settings: { ...s, ...patch } });
    t.c("il tablet ruotato e' un'altra colonna", altra({}, { larghezza: 800, altezza: 1280 }) !== k);
    t.c("un'altra altezza della finestra", altra({}, { altezza: 790 }) !== k);
    t.c("un altro corpo", altra({ fontSize: 110 }) !== k);
    t.c("un'altra interlinea", altra({ lineHeight: 1.6 }) !== k);
    t.c("un altro carattere", altra({ font: "literata" }) !== k);
    t.c("lo scorrimento", altra({ flow: "scrolled" }) !== k);
    t.eq("il margine laterale non tocca la colonna in altezza", altra({ margin: 48 }), k);
    t.eq("la giustificazione nemmeno", altra({ justify: false }), k);
    t.eq("un avanzo di un'altra geometria non si usa", avanzoRicordato("a", altra({ fontSize: 110 }), st), null);
    ricordaAvanzo("a", k, 0, st);
    t.eq("lo zero e' un avanzo vero (misurato, non c'e')", avanzoRicordato("a", k, st), 0);
    ricordaAvanzo("a", k, NaN, st);
    ricordaAvanzo("a", k, -3, st);
    t.eq("un numero storto non si scrive", avanzoRicordato("a", k, st), 0);
    st.m.set(chiaveRicordo("d"), JSON.stringify({ chiave: k, resto: -4 }));
    t.eq("un avanzo negativo scritto da fuori non si usa", avanzoRicordato("d", k, st), null);
    st.m.set(chiaveRicordo("d"), JSON.stringify({ chiave: k, resto: "tanto" }));
    t.eq("…ne' uno che non e' un numero", avanzoRicordato("d", k, st), null);
    st.m.set(chiaveRicordo("c"), "{rotto");
    t.eq("una memoria illeggibile vale «non so»", avanzoRicordato("c", k, st), null);
    // PIU' GEOMETRIE PER LIBRO: girando il tablet la misura sdraiata non
    // cancella quella in piedi (il lettore legge in tutt'e due i versi)
    const sdraiato = chiaveAvanzo({ larghezza: 800, altezza: 1280, settings: s });
    ricordaAvanzo("a", k, 11, st);
    ricordaAvanzo("a", sdraiato, 19, st);
    t.eq("girato il tablet, la misura in piedi resta", avanzoRicordato("a", k, st), 11);
    t.eq("…e c'e' anche quella sdraiata", avanzoRicordato("a", sdraiato, st), 19);
    for (let i = 0; i < GEOMETRIE_PER_LIBRO + 2; i++) ricordaAvanzo("a", `g${i}`, i, st);
    t.eq("le geometrie per libro hanno un tetto", JSON.parse(st.m.get(chiaveRicordo("a"))).voci.length, GEOMETRIE_PER_LIBRO);
    t.eq("…e restano le piu' recenti", avanzoRicordato("a", `g${GEOMETRIE_PER_LIBRO + 1}`, st), GEOMETRIE_PER_LIBRO + 1);
    t.eq("…le vecchie escono", avanzoRicordato("a", k, st), null);
    // la forma di prima si legge ancora
    st.m.set(chiaveRicordo("v"), JSON.stringify({ chiave: k, resto: 7 }));
    t.eq("il ricordo scritto prima vale ancora", avanzoRicordato("v", k, st), 7);
    ricordaAvanzo("v", sdraiato, 3, st);
    t.eq("…e non si perde al primo ricordo nuovo", avanzoRicordato("v", k, st), 7);
    // E UN LIBRO NUOVO PARTE DALLO SCHERMO: un'ipotesi da altri libri,
    // non un ricordo suo
    const st2 = finto();
    t.eq("nessun libro misurato: nessuna ipotesi", avanzoDaAltri(k, st2), null);
    ricordaAvanzo("a", k, 13, st2);
    t.eq("un altro libro con lo stesso schermo da' l'ipotesi", avanzoDaAltri(k, st2), 13);
    t.eq("…ma non diventa un suo ricordo", avanzoRicordato("b", k, st2), null);
    t.eq("un altro schermo non da' ipotesi", avanzoDaAltri(sdraiato, st2), null);
    ricordaAvanzo("c", k, 15, st2);
    t.eq("vale l'ultimo libro misurato", avanzoDaAltri(k, st2), 15);
    for (let i = 0; i < GEOMETRIE_SCHERMO + 3; i++) ricordaAvanzo("x", `s${i}`, i, st2);
    t.eq("le geometrie dello schermo hanno un tetto", JSON.parse(st2.m.get(CHIAVE_SCHERMO)).voci.length, GEOMETRIE_SCHERMO);
    // una voce storta in memoria non deve far esplodere l'apertura del libro
    st2.m.set(chiaveRicordo("z"), JSON.stringify({ voci: [null, "x", [k, 5]] }));
    t.eq("le voci storte si saltano", avanzoRicordato("z", k, st2), 5);
    st2.m.set(CHIAVE_SCHERMO, "{rotto");
    t.eq("una memoria dello schermo illeggibile vale «non so»", avanzoDaAltri(k, st2), null);
    const esplode = { getItem: () => { throw new Error("negato"); }, setItem: () => { throw new Error("pieno"); } };
    t.eq("uno storage che esplode vale «non so»", avanzoRicordato("a", k, esplode), null);
    ricordaAvanzo("a", k, 5, esplode);
    t.c("…e scriverci non si porta via l'apertura", true);
  }

  // ---- la misura delle pagine dice di quale file e' ----
  {
    const salvata = misuraDaSalvare("[cfi]", 313031);
    t.eq("la misura del file giusto si usa", misuraBuona(salvata, 313031), "[cfi]");
    t.eq("quella di un altro file no", misuraBuona(salvata, 228718), null);
    t.eq("una misura scritta prima, senza grandezza, vale come prima", misuraBuona("[vecchia]", 1), "[vecchia]");
    t.eq("niente salvato: niente", misuraBuona(null, 1), null);
    t.eq("una forma storta: niente", misuraBuona({ di: 1 }, 1), null);
  }
}
