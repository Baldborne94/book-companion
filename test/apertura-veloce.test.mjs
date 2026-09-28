// L'APERTURA DI UN LIBRO SENZA RIFARE QUEL CHE SI SAPEVA GIA'. Tre memorie,
// e tre modi di sbagliare in silenzio: un avanzo di un'altra finestra
// taglierebbe una riga, una misura delle pagine di un altro file darebbe
// percentuali sballate per sempre, un ricucito sbagliato aprirebbe il
// libro spezzato.
import { chiaveAvanzo, avanzoRicordato, ricordaAvanzo, chiaveRicordo } from "../src/lib/avanzoRicordato.js";
import { misuraDaSalvare, misuraBuona, daButtareRicucendo } from "../src/lib/misuraSalvata.js";
import { ricuciInMemoria } from "../src/lib/ricuci.js";

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
    t.eq("sotto la chiave del libro", JSON.parse(st.m.get(chiaveRicordo("a"))).resto, 11);
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
    t.c("chi ricuce butta la sola misura che non dice di chi e'", daButtareRicucendo("[vecchia]") && !daButtareRicucendo(salvata) && !daButtareRicucendo(null));
  }

  // ---- la ricucitura in memoria ----
  {
    let giri = 0;
    const scritte = [];
    const aux = new Map([["loc_x", "[vecchia]"]]);
    const opz = {
      unisci: async (b) => {
        giri += 1;
        await new Promise((r) => setTimeout(r, 5));
        return { blob: { size: b.size + 100 }, cuciti: 2 };
      },
      leggiMisura: async (k) => aux.get(k),
      scriviMisura: async (k, v) => { scritte.push([k, v]); aux.set(k, v); },
    };
    const originale = { size: 1000, lontano: true };
    const [a, b] = await Promise.all([ricuciInMemoria("x", originale, opz), ricuciInMemoria("x", originale, opz)]);
    t.eq("due aperture insieme: una ricucitura sola", giri, 1);
    t.c("…e lo stesso ricucito", a === b && a.blob.size === 1100);
    await ricuciInMemoria("x", originale, opz);
    t.eq("riaperto lo stesso file: non si ricuce di nuovo", giri, 1);
    t.c("il ricucito e' lontano come l'originale", a.blob.lontano === true);
    t.c("e porta il segno che il controllo non lo deve visitare", a.blob.ricucito === true);
    t.eq("la misura vecchia, che non dice di chi e', si butta", JSON.stringify(scritte), JSON.stringify([["loc_x", null]]));
    aux.set("loc_y", misuraDaSalvare("[giusta]", 1100));
    const scritteY = scritte.length;
    await ricuciInMemoria("y", { size: 1000 }, opz);
    t.eq("quella con la grandezza resta: si scarta da se' se non e' sua", scritte.length, scritteY);
    await ricuciInMemoria("x", { size: 1000 }, opz);
    t.eq("un altro file (un altro oggetto) si ricuce", giri, 3);

    let rotte = 0;
    const guasto = { ...opz, unisci: async () => { rotte += 1; throw new Error("zip"); } };
    const f = { size: 5 };
    let preso = false;
    try { await ricuciInMemoria("z", f, guasto); } catch { preso = true; }
    t.c("un guasto arriva a chi chiama", preso);
    try { await ricuciInMemoria("z", f, guasto); } catch { /* atteso */ }
    t.eq("…e non si ricorda: al giro dopo si riprova", rotte, 2);

    const sano = { ...opz, unisci: async () => ({ blob: { size: 1 }, cuciti: 0 }) };
    t.eq("un libro che non aveva niente da ricucire torna null", await ricuciInMemoria("s", { size: 9 }, sano), null);
  }
}
