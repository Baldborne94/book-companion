// LA COLLANA SCRITTA DENTRO L'ePub.
//
// Chiesto dal lettore: «per ogni libro che inserisci devi già riconoscere
// se appartiene a una saga e che numero è». Le tavole scritte a mano non ci
// arriveranno mai, ma chi impacchetta un ePub la collana ce la mette quasi
// sempre — e noi la buttavamo via, come si faceva col retro di copertina.
//
// È la parte che sbaglia in silenzio: una collana letta storta non alza
// nessun errore, mette il libro in una saga sbagliata, e da lì «Prima di
// cominciare» racconta la storia di altri libri.
import { collana, numeroDiCollana, ripassaCollane } from "../src/lib/collana.js";

const opf = (dentro) => `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:title>Un romanzo</dc:title><dc:creator>Un autore</dc:creator>
${dentro}
</metadata></package>`;

export default async function (t) {
  // ---- CALIBRE, che è quello che si incontra davvero -------------------
  const cal = collana(opf(`<meta name="calibre:series" content="The Second Apocalypse"/>
    <meta name="calibre:series_index" content="1"/>`));
  t.eq("Calibre: la collana si legge", cal?.serie, "The Second Apocalypse");
  t.eq("e il suo numero", cal?.numero, 1);

  // gli attributi non hanno un ordine garantito
  t.eq(
    "l'ordine degli attributi non conta",
    collana(opf(`<meta content="Malazan" name="calibre:series"/>`))?.serie,
    "Malazan"
  );
  // e nemmeno le virgolette singole
  t.eq(
    "nemmeno le virgolette singole",
    collana(opf(`<meta name='calibre:series' content='Malazan'/>`))?.serie,
    "Malazan"
  );

  // ---- EPUB 3, quello dello standard -----------------------------------
  const tre = collana(opf(`<meta property="belongs-to-collection" id="c1">The Stormlight Archive</meta>
    <meta refines="#c1" property="collection-type">series</meta>
    <meta refines="#c1" property="group-position">2</meta>`));
  t.eq("EPUB 3: la collana si legge", tre?.serie, "The Stormlight Archive");
  t.eq("e il numero arriva da `group-position`", tre?.numero, 2);

  // il `refines` deve legare il numero alla SUA collana: con due collane
  // nello stesso file, sbagliare legame dà il numero dell'altra
  const due = collana(opf(`<meta property="belongs-to-collection" id="a">Prima</meta>
    <meta refines="#a" property="group-position">7</meta>
    <meta property="belongs-to-collection" id="b">Seconda</meta>
    <meta refines="#b" property="group-position">3</meta>`));
  t.eq("con due collane si prende la prima", due?.serie, "Prima");
  t.eq("col numero legato a LEI, non all'altra", due?.numero, 7);

  // il tipo mancante non è una smentita: moltissimi file non lo scrivono
  t.eq(
    "senza `collection-type` vale come serie",
    collana(opf(`<meta property="belongs-to-collection" id="c1">Discworld</meta>
      <meta refines="#c1" property="group-position">9</meta>`))?.numero,
    9
  );

  // ---- UN COFANETTO NON È UNA SAGA -------------------------------------
  // `set` vuol dire «i tre romanzi in un file»: darlo per saga metterebbe
  // il volume nella collana sbagliata, col numero del cofanetto.
  t.eq(
    "un `set` non è una serie",
    collana(opf(`<meta property="belongs-to-collection" id="c1">La Trilogia in un volume</meta>
      <meta refines="#c1" property="collection-type">set</meta>
      <meta refines="#c1" property="group-position">1</meta>`)),
    null
  );
  // ...ma se accanto c'è una serie vera, quella si prende
  t.eq(
    "il `set` si salta e la serie accanto si legge",
    collana(opf(`<meta property="belongs-to-collection" id="s">Cofanetto</meta>
      <meta refines="#s" property="collection-type">set</meta>
      <meta property="belongs-to-collection" id="v">First Law</meta>
      <meta refines="#v" property="collection-type">series</meta>
      <meta refines="#v" property="group-position">1</meta>`))?.serie,
    "First Law"
  );

  // ---- QUELLO CHE NON È UNA COLLANA ------------------------------------
  for (const niente of ["Unknown", "n/a", "None", "series", "calibre", "  "]) {
    t.eq(`«${niente}» non è una collana`, collana(opf(`<meta name="calibre:series" content="${niente}"/>`)), null);
  }
  t.eq("un ePub che non la dichiara torna null", collana(opf("")), null);
  t.eq("e nemmeno il niente esplode", collana(undefined), null);
  t.eq("né una stringa vuota", collana(""), null);

  // ---- IL NUMERO -------------------------------------------------------
  // Calibre scrive i decimali, e `2.5` è la novella fra il secondo e il
  // terzo: arrotondarla la metterebbe sopra a un romanzo vero.
  t.eq("i decimali si tengono", numeroDiCollana("2.5"), 2.5);
  t.eq("e la virgola vale come punto", numeroDiCollana("2,5"), 2.5);
  t.eq("«1.0» è uno", numeroDiCollana("1.0"), 1);
  // lo zero è il modo di Calibre di dire «non lo so»
  t.eq("lo zero non è un numero di collana", numeroDiCollana("0"), null);
  for (const storto of ["", "  ", "abc", null, undefined, "-3"]) {
    t.eq(`«${String(storto)}» non dà un numero`, numeroDiCollana(storto), null);
  }
  // LA COLLANA SENZA NUMERO RESTA UNA COLLANA: sapere la saga e non il
  // posto è meglio che non sapere niente — il numero non si inventa.
  const senza = collana(opf(`<meta name="calibre:series" content="Malazan"/>`));
  t.eq("una collana senza numero si tiene lo stesso", senza?.serie, "Malazan");
  t.eq("col numero a null, che non si inventa", senza?.numero, null);

  // ---- le entità, perché è XML -----------------------------------------
  t.eq(
    "le entità si sciolgono",
    collana(opf(`<meta name="calibre:series" content="Vlad &amp; Co."/>`))?.serie,
    "Vlad & Co."
  );
  t.eq(
    "anche nel testo di una collezione EPUB 3",
    collana(opf(`<meta property="belongs-to-collection">Sword &amp; Sorcery</meta>`))?.serie,
    "Sword & Sorcery"
  );

  // ---- LA PASSATA SUI LIBRI GIA' IN CASA -------------------------------
  // La collana si leggeva solo all'import, quindi la biblioteca di prima
  // restava senza e il tasto rispondeva «erano già tutti a posto» dicendo
  // il vero. Qui si sbaglia in silenzio: una saga scritta sul libro
  // sbagliato non alza nessun errore, sposta il volume di ripiano.
  const serie = (nome, n) =>
    opf(`<meta name="calibre:series" content="${nome}"/>
      ${n == null ? "" : `<meta name="calibre:series_index" content="${n}"/>`}`);

  {
    const libri = [
      { id: "a", title: "Empire in Black and Gold", fileType: "epub" },
      { id: "b", title: "Un romanzo solo", fileType: "epub" },
    ];
    const esito = await ripassaCollane(libri, {
      leggiOpf: (id) => (id === "a" ? serie("Shadows of the Apt", 1) : opf("")),
    });
    t.eq("la collana si legge dal file", esito.campi.a?.saga, "Shadows of the Apt");
    t.eq("col suo numero", esito.campi.a?.sagaOrder, 1);
    t.eq("e si contano quelle scritte", esito.scritte, 1);
    // un file che la collana non ce l'ha non è un guasto di nessuno
    t.eq("il libro che tace non prende niente", esito.campi.b, undefined);
    t.eq("e si conta fra i muti", esito.mute, 1);
  }

  // LA SAGA GIA' SCRITTA COMANDA SEMPRE, e il file non si apre nemmeno:
  // l'ha messa il lettore a mano o l'ha riconosciuta la tavola, e riaprire
  // trenta megabyte per confermarla sarebbe lavoro buttato.
  {
    const aperti = [];
    const esito = await ripassaCollane(
      [
        { id: "a", title: "Eric", saga: "Discworld", fileType: "epub" },
        { id: "b", title: "Vuota", saga: "   ", fileType: "epub" },
      ],
      { leggiOpf: (id) => (aperti.push(id), serie("Un'altra saga", 3)) }
    );
    t.eq("un libro con la saga non si riapre", aperti.join(","), "b");
    t.eq("e la sua saga resta intatta", esito.campi.a, undefined);
    t.eq("mentre una saga di soli spazi non è una saga", esito.campi.b?.saga, "Un'altra saga");
  }

  // IL NUMERO NON SI SOVRASCRIVE: se un posto gliel'avevi già dato, quello
  // comanda — la saga invece mancava, quindi quella si scrive.
  {
    const esito = await ripassaCollane([{ id: "a", title: "T", fileType: "epub", sagaOrder: 9 }], {
      leggiOpf: () => serie("Malazan", 2),
    });
    t.eq("la saga si scrive", esito.campi.a?.saga, "Malazan");
    t.eq("ma il numero che avevi resta", esito.campi.a?.sagaOrder, undefined);
  }
  // e una collana senza numero non ne inventa uno
  {
    const esito = await ripassaCollane([{ id: "a", title: "T", fileType: "epub" }], {
      leggiOpf: () => serie("Malazan", null),
    });
    t.eq("una collana senza numero dà la sola saga", esito.campi.a?.saga, "Malazan");
    t.eq("e nessun numero", "sagaOrder" in (esito.campi.a || {}), false);
  }

  // UN PDF UN OPF NON CE L'HA: contarlo fra i muti direbbe «guardato, non
  // c'era», mentre non c'era niente da guardare — e aprirlo è tempo buttato
  {
    const aperti = [];
    const esito = await ripassaCollane([{ id: "p", title: "Un PDF", fileType: "pdf" }], {
      leggiOpf: (id) => (aperti.push(id), serie("Mai", 1)),
    });
    t.eq("un PDF non si apre nemmeno", aperti.length, 0);
    t.eq("e non finisce fra i muti", esito.mute, 0);
  }

  // ---- I TRE MODI DI NON RIUSCIRCI SONO TRE COSE DIVERSE ---------------
  // chiedono al lettore cose diverse: il tomo lassù si risolve con «Porta
  // qui i tomi», il file rotto è un guasto suo, la collana che non c'è non
  // è un guasto di nessuno
  {
    const esito = await ripassaCollane(
      [
        { id: "cloud", title: "Lassù", fileType: "epub" },
        { id: "rotto", title: "Rotto", fileType: "epub" },
        { id: "muto", title: "Muto", fileType: "epub" },
      ],
      {
        leggiOpf: (id) => {
          if (id === "cloud") return null;
          // ESPLODE SUBITO, senza tornare una promessa: è il caso che
          // scavalcherebbe un `try` scritto male e si porterebbe via il
          // giro intero con tutte le collane già lette
          if (id === "rotto") throw new Error("archivio illeggibile");
          return opf("");
        },
      }
    );
    t.eq("il tomo rimasto nel cloud si conta a parte", esito.senzaByte, 1);
    t.eq("il file che non si apre pure", esito.illeggibili, 1);
    t.eq("e quello che tace pure", esito.mute, 1);
    t.eq("e nessuno dei tre ferma il giro", esito.fermato, false);
  }

  // ---- fermabile a metà, e quel che è fatto resta fatto ----------------
  {
    let visti = 0;
    const libri = [1, 2, 3, 4].map((n) => ({ id: `x${n}`, title: `T${n}`, fileType: "epub" }));
    const esito = await ripassaCollane(libri, {
      leggiOpf: () => ((visti += 1), serie("Saga", 1)),
      vivo: () => visti < 2,
    });
    t.eq("il giro si ferma", esito.fermato, true);
    t.eq("e quel che era letto resta letto", esito.scritte, 2);
    t.eq("senza toccare i successivi", esito.campi.x4, undefined);
  }

  // l'avanzamento dice il titolo, o una passata lunga è una barra muta
  {
    const passi = [];
    await ripassaCollane([{ id: "a", title: "Empire in Black and Gold", fileType: "epub" }], {
      leggiOpf: () => opf(""),
      onProgress: (p) => passi.push(`${p.i + 1}/${p.totale} ${p.titolo}`),
    });
    t.eq("l'avanzamento porta il titolo", passi.join(" · "), "1/1 Empire in Black and Gold");
  }

  // il niente non esplode
  t.eq("nessun libro, nessun guaio", (await ripassaCollane([], {})).scritte, 0);
  t.eq("e nemmeno senza argomenti", (await ripassaCollane()).fermato, false);
}
