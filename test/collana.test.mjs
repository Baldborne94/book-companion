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
import { collana, numeroDiCollana } from "../src/lib/collana.js";

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
}
