// LA MISURA DELLE PAGINE, un capitolo alla volta.
//
// Segnalato dal lettore su un Goosebumps: «come mai ti blocchi sul misurare
// le pagine?». In fondo alla pagina restava «misuro le pagine…» per sempre,
// e con lei sparivano la percentuale, il conto delle pagine, la barra del
// progresso e — in biblioteca — l'avanzamento di quel romanzo.
//
// Quel che sbaglia in silenzio qui e' il GIRO: una misura che non finisce
// non alza nessun errore, e una che si ferma al primo capitolo storto
// nemmeno — esce solo un numero piu' corto, che nessuno puo' verificare a
// occhio. I tre casi che il banco in Chromium ha mostrato appendere o
// troncare epub.js stanno qui sotto uno per uno.
import { misuraPagine, conAttesa, ATTESA, SCADENZA } from "../src/lib/misuraPagine.js";

// un capitolo finto: la stessa forma che `Locations.process` tocca di una
// `Section` vera — `linear`, `cfiBase`, `load(request)` e `unload()`
function sezione(n, modo = {}) {
  return {
    linear: modo.linear !== false,
    cfiBase: `/6/${n}`,
    caricate: 0,
    scaricate: 0,
    load() {
      this.caricate += 1;
      // IL LANCIO SINCRONO e' la forma che appende epub.js: scappa dal giro
      // della coda, la coda non si svuota piu' e la promessa non si chiude
      // mai (al banco: `decodeURIComponent` su un `%` nel nome di un file)
      if (modo.esplode) throw new Error("URIError");
      if (modo.rifiuta) return Promise.reject(new Error("file non trovato"));
      // e questa e' l'altra: una promessa che non si chiude e basta
      if (modo.muta) return new Promise(() => {});
      return Promise.resolve(modo.doc || `doc${n}`);
    },
    unload() {
      this.scaricate += 1;
    },
  };
}

function libro(sezioni, modo = {}) {
  const visti = [];
  return {
    visti,
    spine: { each: (f) => sezioni.forEach(f) },
    load: () => {},
    locations: {
      parse(contenuto, base, chars) {
        visti.push({ contenuto, base, chars });
        if (modo.parseEsplode === contenuto) throw new Error("body mancante");
        return [`${base}/1`, `${base}/2`];
      },
    },
  };
}

// IL CONTROLLO DI UN GIRO CHE PUO' APPENDERSI DEVE AVERE UN TETTO SUO, o
// togliendo la cura il test non fallirebbe: resterebbe li' per sempre, e un
// corridore fermo si legge come un corridore lento. Cosi' invece il file si
// dichiara esploso e dice quale giro non e' tornato.
function entro(ms, promessa) {
  let t;
  return Promise.race([
    Promise.resolve(promessa).finally(() => clearTimeout(t)),
    new Promise((_, no) => {
      t = setTimeout(() => no(new Error(`la misura non e' tornata entro ${ms}ms`)), ms);
    }),
  ]);
}

// un orologio che avanza di un tanto a ogni sguardo: e' l'unico modo di
// provare la scadenza senza aspettarla davvero
const orologio = (passo) => {
  let t = 0;
  return () => {
    const ora = t;
    t += passo;
    return ora;
  };
};

export default async (t) => {
  // ── IL GIRO NORMALE ───────────────────────────────────────────────────
  {
    const sezioni = [sezione(1), sezione(2), sezione(3)];
    const eb = libro(sezioni);
    const m = await misuraPagine(eb);
    t.eq("ogni capitolo mette le sue locations", m.locations.length, 6);
    t.eq("e stanno nell'ordine del libro", m.locations.join(" "), "/6/1/1 /6/1/2 /6/2/1 /6/2/2 /6/3/1 /6/3/2");
    t.eq("nessun capitolo perso", m.rotti, 0);
    t.eq("nessun tetto scattato", m.interrotta, false);
    t.c("e la misura si puo' tenere su disco", m.intera);
    t.eq("ogni capitolo si scarica dopo", sezioni.map((s) => s.scaricate).join(""), "111");
  }

  // la misura del taglio arriva fino a `parse`: con un numero diverso le
  // locations sarebbero altre, e il conto delle pagine con loro
  {
    const eb = libro([sezione(1)]);
    await misuraPagine(eb, { chars: 900 });
    t.eq("il taglio arriva a chi misura", eb.visti[0].chars, 900);
    t.eq("e cosi' il pezzo di CFI del capitolo", eb.visti[0].base, "/6/1");
    t.eq("…col documento caricato", eb.visti[0].contenuto, "doc1");
  }

  // solo la spina della lettura, come fa `generate`: il contorno non conta
  // nel conto del libro, e non si apre nemmeno
  {
    const fuori = sezione(2, { linear: false });
    const eb = libro([sezione(1), fuori, sezione(3)]);
    const m = await misuraPagine(eb);
    t.eq("i documenti fuori dalla lettura non si contano", m.locations.length, 4);
    t.eq("…e non si aprono affatto", fuori.caricate, 0);
  }

  // ── UN CAPITOLO CHE NON RISPONDE COSTA SE STESSO ──────────────────────
  //
  // Le tre forme, e sono davvero tre cose diverse: la prima e' quella che
  // appendeva epub.js, la seconda quella che sopravviveva gia', la terza
  // quella che nessun `try` puo' prendere.
  {
    const rotto = sezione(2, { esplode: true });
    const eb = libro([sezione(1), rotto, sezione(3)]);
    const m = await misuraPagine(eb);
    t.eq("il lancio sincrono non si porta via il libro", m.locations.length, 4);
    t.eq("…e il capitolo si conta fra i rotti", m.rotti, 1);
    t.c("…quindi la misura non si scrive su disco", !m.intera);
    t.eq("…e quel capitolo si scarica comunque", rotto.scaricate, 1);
  }
  {
    const eb = libro([sezione(1), sezione(2, { rifiuta: true }), sezione(3)]);
    const m = await misuraPagine(eb);
    t.eq("un capitolo che si rifiuta costa se stesso", m.locations.length, 4);
    t.eq("…e si conta", m.rotti, 1);
  }
  {
    // IL TETTO E' LA RIGA CHE CONTA: un `try` prende quel che esplode, non
    // quel che resta appeso — senza `ATTESA` il giro si fermerebbe qui
    // esattamente come prima, e per sempre.
    const eb = libro([sezione(1), sezione(2, { muta: true }), sezione(3)]);
    const m = await entro(2000, misuraPagine(eb, { attesa: 20 }));
    t.eq("un capitolo muto non appende il giro", m.locations.length, 4);
    t.eq("…e si conta come rotto", m.rotti, 1);
  }
  {
    // e il capitolo che si apre ma non si lascia misurare e' lo stesso caso
    const eb = libro([sezione(1), sezione(2), sezione(3)], { parseEsplode: "doc2" });
    const m = await misuraPagine(eb);
    t.eq("una misura che esplode costa quel capitolo", m.locations.length, 4);
    t.eq("…e si conta", m.rotti, 1);
  }

  // ── IL TETTO DEL TETTO ────────────────────────────────────────────────
  {
    // con dei capitoli muti a decine il tetto del singolo non basta piu':
    // qui l'orologio salta un minuto per capitolo, quindi il terzo non
    // parte nemmeno
    const terzo = sezione(3);
    const eb = libro([sezione(1), sezione(2), terzo]);
    const m = await misuraPagine(eb, { adesso: orologio(60000), scadenza: 180000 });
    t.eq("il giro si ferma alla scadenza", terzo.caricate, 0);
    t.c("…e lo dichiara", m.interrotta);
    t.eq("…tenendosi quel che ha gia' misurato", m.locations.length, 4);
    t.c("…ma non lo scrive su disco", !m.intera);
  }

  // ── UNA MISURA VUOTA NON E' UNA MISURA ────────────────────────────────
  {
    // qui nessun capitolo si e' rotto e nessun tetto e' scattato, quindi
    // «intera» direbbe di si' per esclusione — e scriverla in cache vorrebbe
    // dire un libro senza pagine PER SEMPRE, senza che nessun errore lo dica
    const eb = libro([]);
    const m = await misuraPagine(eb);
    t.eq("un libro senza capitoli non da' locations", m.locations.length, 0);
    t.c("e una misura vuota non si tiene", !m.intera);
  }
  {
    const eb = libro([sezione(1, { esplode: true })]);
    const m = await misuraPagine(eb);
    t.eq("se si rompe tutto non resta niente", m.locations.length, 0);
    t.c("…e non si tiene niente", !m.intera);
  }

  // ── I DUE TETTI SONO DUE COSE DIVERSE ─────────────────────────────────
  {
    t.c("il tetto del capitolo sta in secondi", ATTESA >= 1000 && ATTESA <= 30000);
    t.c("quello del giro sta molto piu' in la'", SCADENZA > ATTESA * 2);
  }

  // ── L'OROLOGIO ACCANTO A UNA PROMESSA ─────────────────────────────────
  //
  // Lo usa anche il reader sulla misura salvata: da li' in giu' c'e' tutto
  // quel che accende la percentuale, e un'attesa senza fondo la' lascerebbe
  // «misuro le pagine…» acceso per sempre, soltanto un passo piu' su.
  {
    t.eq("chi risponde passa com'e'", await conAttesa(Promise.resolve("qui"), 500), "qui");
    let esito = "mai";
    try {
      await conAttesa(Promise.reject(new Error("rotta")), 500);
    } catch (e) {
      esito = e.message;
    }
    t.eq("chi si rifiuta si rifiuta e basta", esito, "rotta");
    let muta = "mai";
    try {
      await conAttesa(new Promise(() => {}), 20);
    } catch (e) {
      muta = e.message;
    }
    t.c("e chi non torna diventa un errore invece di un'attesa", muta !== "mai");
    // anche un valore che non e' una promessa: `getAux` potrebbe tornare
    // un valore secco il giorno che cambia deposito
    t.eq("un valore secco passa lo stesso", await conAttesa("secco", 500), "secco");
  }
};
