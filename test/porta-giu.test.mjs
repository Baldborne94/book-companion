// I BYTE CHE VANNO SU E QUELLI CHE VENGONO GIÙ, e le parole per dirlo.
// Tutto staccato da Supabase e da IndexedDB apposta: qui si prova con dei
// finti quel che sbaglia in silenzio — un giro che non si ferma, un conto
// che dice «sceso» su un byte che non c'è, un tomo già in casa scaricato di
// nuovo, un file che non risale PER SEMPRE, e una frase che manda a
// reimportare un romanzo sano.
import { portaGiu, frasePortata, senzaCopia, fraseSenzaCopia, daCaricare, daPortare, nonCeLassu } from "../src/lib/syncCore.js";

const voci = (n) => Array.from({ length: n }, (_, i) => ({ id: `v${i}`, name: `Melodia ${i}` }));

// un cloud e una casa finti: `lassu` dice chi ha i byte nel cloud, `casa`
// chi li ha già qui
function banco({ lassu = new Set(), casa = new Set(), esplode = new Set() } = {}) {
  const posati = [];
  const chiesti = [];
  const passi = [];
  const deps = {
    manca: async (v) => !casa.has(v.id),
    scarica: async (v) => {
      chiesti.push(v.id);
      if (esplode.has(v.id)) throw new Error("rete caduta");
      return lassu.has(v.id) ? `byte di ${v.id}` : null;
    },
    posa: async (v, byte) => {
      posati.push([v.id, byte]);
      casa.add(v.id);
    },
    titolo: (v) => v.name,
    onProgress: (p) => passi.push(p),
  };
  return { deps, posati, chiesti, passi };
}

export default async function (t) {
  // ---- IL GIRO NORMALE ------------------------------------------------------
  {
    const b = banco({ lassu: new Set(["v0", "v1", "v2"]) });
    const e = await portaGiu(voci(3), b.deps);
    t.eq("tre lassù, tre scese", e.scesi, 3);
    t.eq("nessuna fallita", e.falliti, 0);
    t.c("non fermato", !e.fermato);
    t.eq("i byte sono posati col loro id", b.posati.map(([id, byte]) => `${id}=${byte}`).join(","), "v0=byte di v0,v1=byte di v1,v2=byte di v2");
    t.eq("l'avanzamento conta dal primo all'ultimo", b.passi.map((p) => p.i).join(","), "0,1,2");
    t.eq("e dice il totale di chi manca, non delle voci", b.passi[0].totale, 3);
    t.eq("e il titolo di chi sta scendendo", b.passi[1].titolo, "Melodia 1");
  }

  // ---- CHI È GIÀ IN CASA NON SI RISCARICA -----------------------------------
  // e si guarda ADESSO, non al conto di prima: fra il conto e il tocco il
  // lettore può aver suonato una melodia, che è scesa da sola
  {
    const b = banco({ lassu: new Set(["v0", "v1", "v2"]), casa: new Set(["v1"]) });
    const e = await portaGiu(voci(3), b.deps);
    t.eq("due scese, la terza era già qui", e.scesi, 2);
    t.eq("e non si è nemmeno chiesta", b.chiesti.join(","), "v0,v2");
    t.eq("il totale dell'avanzamento è due, non tre", b.passi[0].totale, 2);
  }

  // ---- «NON C'È LASSÙ» NON È «NON HO POTUTO CHIEDERE» -----------------------
  // I due casi arrivavano nello stesso conto, e il lettore leggeva «non è
  // sceso» su un file che lassù non c'era mai stato: un messaggio che non
  // suggerisce altro che premere ancora, cosa che non potrà mai riuscire.
  // `null` è una RISPOSTA, un guasto di passaggio si ALZA.
  {
    const b = banco({ lassu: new Set(["v0"]) });
    const e = await portaGiu(voci(2), b.deps);
    t.eq("una scesa", e.scesi, 1);
    t.eq("quel che lassù non c'è è ASSENTE", e.assenti, 1);
    t.eq("e non fallito: sono due cose diverse", e.falliti, 0);
    t.eq("e nessun byte vuoto posato", b.posati.length, 1);
  }
  // uno scaricamento che esplode è fallito, e non porta via il giro
  {
    const b = banco({ lassu: new Set(["v0", "v1", "v2"]), esplode: new Set(["v1"]) });
    const e = await portaGiu(voci(3), b.deps);
    t.eq("l'esplosione conta come fallita", e.falliti, 1);
    t.eq("e non come assente", e.assenti, 0);
    t.eq("e le altre due scendono lo stesso", e.scesi, 2);
  }

  // ---- IL FILO: FERMATO A METÀ, QUEL CHE È SCESO RESTA ----------------------
  {
    const b = banco({ lassu: new Set(["v0", "v1", "v2", "v3"]) });
    let giri = 0;
    const e = await portaGiu(voci(4), { ...b.deps, vivo: () => giri++ < 2 });
    t.eq("due scese prima dello stop", e.scesi, 2);
    t.c("dichiarato fermato", e.fermato);
    t.eq("e non si è più chiesto niente", b.chiesti.join(","), "v0,v1");
  }
  // senza filo si va fino in fondo
  {
    const b = banco({ lassu: new Set(["v0"]) });
    const e = await portaGiu(voci(1), { ...b.deps, vivo: undefined });
    t.eq("senza filo il giro è intero", e.scesi, 1);
  }
  t.eq("niente da portare → zeri", JSON.stringify(await portaGiu([], banco().deps)), '{"scesi":0,"assenti":0,"falliti":0,"fermato":false}');

  // ---- LE PAROLE DEL GIRO ---------------------------------------------------
  // Stavano dentro il componente, fuori dalla portata di ogni test, e una
  // frase che dice la cosa sbagliata non alza nessun errore.
  t.eq("niente da fare", frasePortata({ scesi: 0, assenti: 0, falliti: 0 }), "Non c'era niente da portare a casa");
  t.eq("un esito vuoto non esplode", frasePortata(), "Non c'era niente da portare a casa");
  t.eq("uno solo, al singolare", frasePortata({ scesi: 1 }), "1 tomo è qui");
  t.eq("più d'uno, al plurale", frasePortata({ scesi: 3 }), "3 tomi sono qui");
  // GLI ZERI NON SI DICONO: «0 non sono scesi» a ogni giro si impara a
  // saltare, e a forza di saltarlo non si legge nemmeno quello che conta
  t.c("lo zero degli assenti tace", !frasePortata({ scesi: 2 }).includes("copia"));
  t.c("e quello dei falliti pure", !frasePortata({ scesi: 2 }).includes("sceso"));
  // L'ASSENTE PORTA CON SÉ LA CURA: un guaio senza la strada accanto
  // lascia il lettore esattamente dov'era
  {
    const f = frasePortata({ assenti: 2 });
    t.c("l'assente dice che lassù non c'è", f.includes("non hanno copia lassù"));
    t.c("e dice cosa farci", f.includes("ricaricali dal file"));
    t.eq("al singolare si accorda", frasePortata({ assenti: 1 }), "1 non ha copia lassù — ricaricalo dal file");
  }
  t.eq("il fallito resta un «non è sceso»", frasePortata({ falliti: 1 }), "1 non è sceso");
  t.eq(
    "i tre conti stanno insieme, in quest'ordine",
    frasePortata({ scesi: 1, assenti: 1, falliti: 1 }),
    "1 tomo è qui, 1 non ha copia lassù — ricaricalo dal file, 1 non è sceso"
  );
  t.eq("il giro fermato si dichiara in coda", frasePortata({ scesi: 1, fermato: true }), "1 tomo è qui — giro fermato");
  t.c("ma su un giro senza niente non si aggiunge nulla", frasePortata({ fermato: true }) === "Non c'era niente da portare a casa");

  // «NON HO POTUTO CHIEDERE» NON È «NON C'ERA NIENTE DA FARE» — lo stesso
  // errore di `portaGiu` un piano più su. Segnalato con la Libreria in
  // mano: «perché mi dice porta qui 18 tomi e se lo clicco mi fa "non c'è
  // niente da portare a casa"?». Caduto l'accesso al cloud non si chiede
  // nulla al secchio (zero scaricamenti tentati) e il lettore si sentiva
  // rispondere il contrario del tasto che aveva appena toccato.
  {
    const f = frasePortata({ scollegato: true });
    t.c("lo scollegato dice che non ha potuto chiedere", f.includes("Non ho potuto chiedere al cloud"));
    t.c("e dice cosa farci", f.includes("Rientra dal pannello della nuvola"));
    t.c("e che i libri restano qui", f.includes("restano qui"));
    t.c("non è «non c'era niente»", !f.includes("niente da portare"));
    // gli zeri accanto NON lo fanno tornare la frase di prima: è il caso
    // che si distingue proprio perché tutti i conti sono a zero
    t.eq(
      "e vince su ogni conto",
      frasePortata({ scollegato: true, scesi: 0, assenti: 0, falliti: 0 }),
      frasePortata({ scollegato: true })
    );
    t.c("mentre collegato e a mani vuote resta la frase di sempre",
      frasePortata({ scollegato: false }) === "Non c'era niente da portare a casa");
  }

  // ---- QUELLI CHE IL TASTO PUÒ DAVVERO PORTARE --------------------------
  // Il tasto contava i tomi senza byte QUI, e fra quelli ci stanno anche i
  // perduti: offriva di scaricare file che l'app sapeva già non esserci,
  // con la riga d'avviso che lo diceva a mezzo centimetro di distanza.
  {
    const tomi = [{ id: "a" }, { id: "b" }, { id: "c" }];
    t.eq("scendono solo quelli che il secchio ha", daPortare(tomi, new Set(["a", "c"])).map((b) => b.id).join(","), "a,c");
    t.eq("nessuno lassù → il tasto non ha niente da offrire", daPortare(tomi, new Set()).length, 0);
    // IL VERSO OPPOSTO DI `senzaCopia`: senza l'elenco del secchio quella
    // non accusa nessuno, questa li offre TUTTI — non sapere non è un
    // allarme, ma non è nemmeno una ragione per togliere il tasto: lì
    // l'unico modo di scoprirlo è provare
    t.eq("senza l'elenco si offrono tutti", daPortare(tomi, null).length, 3);
    t.eq("e senza nemmeno i tomi non esplode", daPortare().length, 0);
    t.eq("una voce senza id non si offre", daPortare([{ nome: "storto" }], new Set()).length, 0);
    // le due funzioni spartiscono lo stesso elenco senza sovrapporsi: un
    // tomo o si può portare giù, o è perduto
    const lassu = new Set(["a"]);
    t.eq("insieme fanno l'elenco intero", daPortare(tomi, lassu).length + senzaCopia(tomi, lassu).length, tomi.length);
    t.c("e nessuno sta in tutt'e due", !daPortare(tomi, lassu).some((x) => senzaCopia(tomi, lassu).includes(x)));
  }

  // ---- «NON CE L'HO» CONTRO «NON HO POTUTO RISPONDERE» ----------------------
  // La riga che traduce la risposta del secchio nelle due strade: sbagliata
  // da un lato manda a reimportare un romanzo sano, dall'altro fa premere
  // per sempre un tasto che non può riuscire.
  t.c("statusCode è una stringa, e lo è davvero", nonCeLassu({ statusCode: "404" }));
  t.c("ma anche un numero passa", nonCeLassu({ status: 404 }));
  t.c("e le parole del servizio", nonCeLassu({ message: "Object not found" }));
  t.c("compreso lo stile con l'underscore", nonCeLassu({ error: "not_found" }));
  // TUTTO IL RESTO È UN GUASTO DI PASSAGGIO, e lì riprovare ha senso
  t.c("un 500 non è un «non ce l'ho»", !nonCeLassu({ statusCode: "500" }));
  t.c("né un permesso negato", !nonCeLassu({ statusCode: "403", message: "Unauthorized" }));
  t.c("né la rete caduta", !nonCeLassu(new TypeError("Failed to fetch")));
  t.c("né un errore che non c'è", !nonCeLassu(null));
  t.c("e un 4040 non è un 404", !nonCeLassu({ statusCode: "4040" }));

  // ---- QUALI FILE DEVONO SALIRE ---------------------------------------------
  // È la decisione della cura: un «no» di troppo è un romanzo senza copia
  // per sempre, un «sì» di troppo sono centinaia di megabyte rispediti da
  // un tablet sul traffico contato del piano gratuito.
  {
    const tomi = ["a", "b", "c"].map((id) => ({ id, title: id }));
    const tutti = new Set(["a", "b", "c"]);
    const su = (l) => l.map((b) => b.id).join(",");
    const chiedi = (o) => su(daCaricare(tomi, { qui: tutti, lassu: new Set(), gia: new Set(), ...o }));

    t.eq("nessuno lassù, salgono tutti", chiedi({}), "a,b,c");
    // IL DIFETTO CHE HA APERTO TUTTO QUESTO: i byte non sono in casa, e
    // allora non c'è niente da mandare — ma il giro deve tornare a
    // guardarlo, non dimenticarselo per sempre
    t.eq("senza i byte qui non si manda niente", chiedi({ qui: new Set(["a"]) }), "a");
    t.eq("chi è già nel secchio non risale", chiedi({ lassu: new Set(["a", "b"]) }), "c");
    // `bc_uploaded` da solo non basta — non sa niente di un libro sceso dal
    // cloud o ripristinato da un archivio — ma quel che dice vale
    t.eq("e nemmeno chi questo dispositivo ha già mandato", chiedi({ gia: new Set(["b"]) }), "a,c");
    // IL LIBRO CHE IL CLOUD DICE CANCELLATO fra poco se ne va anche da qui:
    // caricarlo adesso lo farebbe rinascere
    t.eq("chi sta per essere cancellato non sale", chiedi({ inUscita: new Set(["a"]) }), "b,c");
    // IL RIMANDO VINCE SU TUTTO: quel file è cambiato in casa (una
    // ricucitura), e lassù c'è la copia di prima — decidendo col solo
    // secchio si salterebbe per sempre
    t.eq("il file cambiato in casa risale anche se lassù c'è", chiedi({ lassu: tutti, rimandi: new Set(["b"]) }), "b");
    t.eq("e anche se il registro lo dà per mandato", chiedi({ lassu: tutti, gia: tutti, rimandi: new Set(["c"]) }), "c");
    // ma un rimando non scavalca la cancellazione né i byte mancanti
    t.eq("il rimando non resuscita un cancellato", chiedi({ rimandi: tutti, inUscita: new Set(["a"]) }), "b,c");
    t.eq("e non manda byte che non ci sono", chiedi({ qui: new Set(), rimandi: tutti }), "");
    // SENZA L'ELENCO DEL SECCHIO NON SI CARICA NIENTE: è il lato sicuro —
    // un giro saltato si rifà al prossimo, un rinvio in massa no
    t.eq("elenco mancante → niente", su(daCaricare(tomi, { qui: tutti, lassu: null })), "");
    t.eq("e senza nemmeno gli argomenti non esplode", su(daCaricare(tomi)), "");
    t.eq("una voce senza id si salta", su(daCaricare([{ title: "storto" }], { qui: tutti, lassu: new Set() })), "");
  }

  // ---- I TOMI CHE NON SONO DA NESSUNA PARTE ---------------------------------
  {
    const tomi = [{ id: "a", title: "Eric" }, { id: "b", title: "Mort" }];
    t.eq("chi il secchio ce l'ha non è perduto", senzaCopia(tomi, new Set(["a", "b"])).length, 0);
    t.eq("chi non c'è nemmeno lassù sì", senzaCopia(tomi, new Set(["a"])).map((b) => b.id).join(","), "b");
    // NON SAPERE NON È UN ALLARME: senza l'elenco del secchio si tace,
    // come per la persistenza e per lo spazio — allarmare senza sapere è
    // peggio del silenzio, perché non lascia niente da fare
    t.eq("senza l'elenco del secchio si tace", senzaCopia(tomi, null).length, 0);
    t.eq("e nessun tomo nel cloud → niente", senzaCopia([], new Set()).length, 0);
    t.eq("una voce senza id non si conta", senzaCopia([{ title: "storto" }], new Set()).length, 0);
  }
  {
    t.eq("nessuno → nessuna riga", fraseSenzaCopia([]), null);
    t.eq("e un elenco che non c'è nemmeno", fraseSenzaCopia(), null);
    t.eq(
      "uno solo, col suo nome",
      fraseSenzaCopia([{ id: "a", title: "Eric" }]),
      "«Eric» non è né qui né nel cloud: ricaricalo dal file."
    );
    // SI DICONO PER NOME: in una biblioteca da cento volumi «2 tomi»
    // lascia il lettore a cercare quali
    const tre = fraseSenzaCopia([
      { id: "a", title: "Eric" },
      { id: "b", title: "Mort" },
      { id: "c", title: "Pyramids" },
    ]);
    t.eq("tre ci stanno tutti", tre, "«Eric», «Mort», «Pyramids» non sono né qui né nel cloud: ricaricali dal file.");
    const cinque = fraseSenzaCopia(
      ["a", "b", "c", "d", "e"].map((id) => ({ id, title: id.toUpperCase() }))
    );
    t.c("oltre i tre si conta il resto", cinque.includes("«A», «B», «C» e altri 2"));
    t.c("e la cura resta in coda", cinque.endsWith("ricaricali dal file."));
    t.c("un tomo senza titolo non scrive «undefined»", !fraseSenzaCopia([{ id: "a" }]).includes("undefined"));
  }
}
