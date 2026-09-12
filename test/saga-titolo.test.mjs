// LA SAGA SCRITTA NEL TITOLO.
//
// Segnalato con la Libreria in mano: quattro John Gwynne sotto il nome
// dell'autore e nessuna saga — «02 Valour», «Malice: The Faithful and the
// Fallen Series Book 1», «Ruin», «Wrath». La tavola non lo conosce, il
// file la collana non ce l'aveva, e la deduzione ha bisogno di un fratello
// che la saga ce l'abbia gia'. Ma uno dei quattro la porta scritta nel
// titolo, e da quello gli altri tre la ereditano.
//
// Qui si sbaglia in silenzio da tutt'e due i lati: una saga non letta e'
// un ripiano senza nome, una saga INVENTATA («Fahrenheit» volume 451)
// mette un libro in una storia che non esiste — ed e' il danno peggiore.
import { sagaDalTitolo } from "../src/lib/sagaDalTitolo.js";
import { deduciSaghe, ripassa } from "../src/lib/sagaBooks.js";

export default async function (t) {
  const s = (o) => sagaDalTitolo(typeof o === "string" ? { title: o } : o);

  // ---- le forme che gli ePub portano davvero ----------------------------
  t.eq("«Titolo: Saga Series Book N» → saga", s("Malice: The Faithful and the Fallen Series Book 1")?.saga, "The Faithful and the Fallen");
  t.eq("…e il numero", s("Malice: The Faithful and the Fallen Series Book 1")?.sagaOrder, 1);
  t.eq("«Titolo (Saga, #N)»", s("Eric (Discworld, #9)")?.saga, "Discworld");
  t.eq("«Titolo (Saga Book N)»", s("The Final Empire (Mistborn Book 1)")?.saga, "Mistborn");
  t.eq("«Titolo (Saga, Book N)» con l'articolo", s("The Way of Kings (The Stormlight Archive, Book 1)")?.saga, "The Stormlight Archive");
  t.eq("«Titolo: Saga, Book N»", s("A Game of Thrones: A Song of Ice and Fire, Book 1")?.saga, "A Song of Ice and Fire");
  t.eq("dentro le parentesi il numero puo' stare nudo", s("Eric (Discworld 9)")?.sagaOrder, 9);
  t.eq("«Saga NN - Titolo»", s("Discworld 09 - Eric")?.saga, "Discworld");
  t.eq("…col numero senza lo zero davanti", s("Discworld 09 - Eric")?.sagaOrder, 9);
  t.eq("«Saga N: Titolo»", s("Mistborn 1: The Final Empire")?.saga, "Mistborn");
  t.eq("«Saga Book N - Titolo»", s("The Faithful and the Fallen Book 1 - Malice")?.saga, "The Faithful and the Fallen");
  t.eq("la novella fra due volumi tiene il decimale", s("Title (Saga Book 2.5)")?.sagaOrder, 2.5);

  // il solo numero in testa dice il posto, non la saga
  t.eq("«02 Valour» non inventa una saga", s("02 Valour")?.saga, null);
  t.eq("…ma dice il posto", s("02 Valour")?.sagaOrder, 2);
  t.eq("«1 - Malice» pure", s("1 - Malice")?.sagaOrder, 1);

  // e il nome del file, quando il titolo tace
  t.eq("dal nome del file, con l'autore davanti tolto",
    s({ title: "Eric", fileName: "Terry Pratchett - Discworld 09 - Eric.epub", author: "Terry Pratchett" })?.saga, "Discworld");
  t.eq("il numero del titolo comanda su quello del file",
    s({ title: "02 Valour", fileName: "The Faithful and the Fallen 03 - Valour.epub" })?.sagaOrder, 2);
  t.eq("un file solo col numero", s({ title: "Valour", fileName: "02 - Valour.epub" })?.sagaOrder, 2);

  // ---- LA TABELLA DELLE FORME VERE ---------------------------------------
  //
  // Chiesto dal lettore: «non voglio che si ripresenti questo problema per
  // gli altri libri che metterò». Qui stanno le forme con cui gli ePub e i
  // nomi di file arrivano davvero, in inglese e in italiano, una riga per
  // forma: chi ne incontra una nuova la aggiunge QUI, con la saga e il
  // numero attesi, e il parser deve leggerla.
  const FORME = [
    // Goodreads / Amazon: la saga fra parentesi dopo il titolo
    ["The Name of the Wind (The Kingkiller Chronicle, #1)", "The Kingkiller Chronicle", 1],
    ["The Eye of the World (Wheel of Time, Book 1)", "Wheel of Time", 1],
    ["Gardens of the Moon (Malazan Book of the Fallen, #1)", "Malazan Book of the Fallen", 1],
    ["The Blade Itself (The First Law Trilogy Book 1)", "The First Law Trilogy", 1],
    ["Empire in Black and Gold (Shadows of the Apt 1)", "Shadows of the Apt", 1],
    ["Hyperion (Hyperion Cantos 1)", "Hyperion Cantos", 1],
    ["Harry Potter and the Chamber of Secrets (Harry Potter, Book 2)", "Harry Potter", 2],
    // dopo i due punti
    ["Assassin's Apprentice: The Farseer Trilogy Book 1", "The Farseer Trilogy", 1],
    ["The Way of Shadows: Night Angel Trilogy: Book 1", "Night Angel Trilogy", 1],
    ["The Lies of Locke Lamora: The Gentleman Bastard Sequence, Book 1", "The Gentleman Bastard Sequence", 1],
    ["A Game of Thrones: A Song of Ice and Fire, Book 1", "A Song of Ice and Fire", 1],
    // «Book N of the Saga», in coda e in testa
    ["The Dragon Reborn: Book 3 of the Wheel of Time", "The Wheel of Time", 3],
    ["The Dragon Reborn (Book 3 of the Wheel of Time)", "The Wheel of Time", 3],
    ["Book 3 of the Wheel of Time: The Dragon Reborn", "The Wheel of Time", 3],
    // la saga davanti
    ["Wheel of Time 03 - The Dragon Reborn", "Wheel of Time", 3],
    ["Wheel of Time #3 - The Dragon Reborn", "Wheel of Time", 3],
    ["The Wheel of Time, Book 3 - The Dragon Reborn", "The Wheel of Time", 3],
    ["Mistborn 1: The Final Empire", "Mistborn", 1],
    ["[Wheel of Time 03] The Dragon Reborn", "Wheel of Time", 3],
    ["[Wheel of Time #3] The Dragon Reborn", "Wheel of Time", 3],
    // in italiano
    ["Il nome del vento (Le cronache dell'assassino del re Vol. 1)", "Le cronache dell'assassino del re", 1],
    ["La paura del saggio: Le cronache dell'assassino del re, Libro 2", "Le cronache dell'assassino del re", 2],
    ["Il trono di spade: Cronache del ghiaccio e del fuoco, Libro 1", "Cronache del ghiaccio e del fuoco", 1],
    ["Cronache del ghiaccio e del fuoco 2 - Il grande inverno", "Cronache del ghiaccio e del fuoco", 2],
  ];
  for (const [titolo, saga, n] of FORME) {
    const r = s(titolo);
    t.eq(`forma «${titolo}» → saga`, r?.saga, saga);
    t.eq(`forma «${titolo}» → n.`, r?.sagaOrder, n);
  }
  // e le stesse forme quando stanno nel NOME DEL FILE e il titolo tace
  const FILE = [
    ["Robert Jordan - The Wheel of Time 03 - The Dragon Reborn.epub", "The Wheel of Time", 3],
    ["Jordan, Robert - Wheel of Time 03 - The Dragon Reborn.epub", "Wheel of Time", 3],
    ["[Wheel of Time 03] The Dragon Reborn.epub", "Wheel of Time", 3],
    ["The Dragon Reborn (Wheel of Time, #3).epub", "Wheel of Time", 3],
    ["The Wheel of Time, Book 3 - The Dragon Reborn.pdf", "The Wheel of Time", 3],
  ];
  for (const [fileName, saga, n] of FILE) {
    const r = s({ title: "The Dragon Reborn", fileName, author: "Robert Jordan" });
    t.eq(`file «${fileName}» → saga`, r?.saga, saga);
    t.eq(`file «${fileName}» → n.`, r?.sagaOrder, n);
  }
  t.c("«Titolo - Autore.epub» non e' una saga",
    s({ title: "The Dragon Reborn", fileName: "The Dragon Reborn - Robert Jordan.epub", author: "Robert Jordan" }) === null);

  // ---- QUEL CHE NON E' UNA SAGA, e non lo deve diventare ----------------
  for (const titolo of [
    "Fahrenheit 451", "2001: A Space Odyssey", "1984", "Catch-22", "Slaughterhouse 5", "Room 101",
    "Ruin", "Tigana", "Book 1", "The Blade Itself: Book One", "Mistborn - The Final Empire (v5.0)",
    "Tigana_Kay_Guy_Gavriel_zlibrary.sk_1lib.sk_zlib.sk.epub",
    // dietro un separatore l'etichetta e' OBBLIGATORIA: senza, «Star Wars:
    // Episode 4» finirebbe nella saga «Episode» (mutazione provata)
    "Star Wars: Episode 4", "Halo: Combat Evolved 2",
    // e l'etichetta vuole il confine di parola davanti, o «Season 2» si
    // legge «Seaso» + «n 2» e la saga diventa «Seaso» — preso provando,
    // non leggendo il codice
    "Foundation - Season 2", "Title: Chapter 3",
    // un sottotitolo non e' una saga, e nemmeno una parte
    "The Lord of the Rings: The Fellowship of the Ring", "A Storm of Swords: Part 1 Steel and Snow",
    "Dune Messiah", "Dune 2 Messiah", "Part 2 of 3",
  ]) {
    t.c(`«${titolo}» non e' una saga`, s(titolo) === null, JSON.stringify(s(titolo)));
  }
  // «Fahrenheit 451» e' la mutazione che conta: senza l'etichetta
  // obbligatoria fuori dalle parentesi, un titolo con un numero in coda
  // diventerebbe una saga col numero del titolo
  t.eq("un'etichetta da sola non e' un nome", s("Title (Book 3)"), null);
  t.eq("e nemmeno un numero", s("Title (3)"), null);

  // ---- IL CASO DEL LETTORE, per intero -----------------------------------
  const GWYNNE = [
    { id: "v", title: "02 Valour", author: "John Gwynne", saga: "", sagaOrder: null },
    { id: "m", title: "Malice: The Faithful and the Fallen Series Book 1", author: "John Gwynne", saga: "", sagaOrder: null },
    { id: "r", title: "Ruin", author: "John Gwynne", saga: "", sagaOrder: null },
    { id: "w", title: "Wrath", author: "John Gwynne", saga: "", sagaOrder: null },
    { id: "h", title: "Assassin's Apprentice", author: "Robin Hobb", saga: "Realm of the Elderlings", sagaOrder: 1 },
  ];
  const d = deduciSaghe(GWYNNE);
  t.eq("Malice la legge dal titolo", d.campi.m?.saga, "The Faithful and the Fallen");
  t.eq("…col numero", d.campi.m?.sagaOrder, 1);
  t.eq("una saga letta dal titolo", d.dalTitolo, 1);
  // ed e' QUESTO il giro che prima non si chiudeva: i tre fratelli la
  // ereditano nello stesso passaggio, senza un secondo tocco
  t.eq("Valour la eredita", d.campi.v?.saga, "The Faithful and the Fallen");
  t.eq("…col suo numero, che il titolo diceva gia'", d.campi.v?.sagaOrder, 2);
  t.eq("Ruin la eredita", d.campi.r?.saga, "The Faithful and the Fallen");
  t.eq("Wrath la eredita", d.campi.w?.saga, "The Faithful and the Fallen");
  t.c("Ruin resta senza numero: non si inventa", !("sagaOrder" in (d.campi.r || {})));
  t.eq("tre saghe dedotte", d.dedotte, 3);
  t.c("Hobb non si tocca", !d.campi.h);

  // la grafia di casa comanda anche sul titolo: se un fratello aveva gia'
  // «Faithful and the Fallen» scritto a mano, si scrive cosi'
  const conGrafia = deduciSaghe([
    { id: "a", title: "Malice: The Faithful and the Fallen Book 1", author: "John Gwynne", saga: "" },
    { id: "b", title: "Wrath", author: "John Gwynne", saga: "Faithful and the Fallen" },
  ]);
  t.eq("la grafia gia' in casa vince sul titolo", conGrafia.campi.a?.saga, "Faithful and the Fallen");

  // la guardia timida resta: due saghe diverse dello stesso autore, e il
  // titolo muto non eredita niente
  const due = deduciSaghe([
    { id: "a", title: "Malice: The Faithful and the Fallen Book 1", author: "John Gwynne", saga: "" },
    { id: "b", title: "The Shadow of the Gods", author: "John Gwynne", saga: "The Bloodsworn Saga" },
    { id: "c", title: "Ruin", author: "John Gwynne", saga: "" },
  ]);
  t.eq("dal titolo si legge lo stesso", due.campi.a?.saga, "The Faithful and the Fallen");
  t.c("ma il titolo muto, con due saghe in casa, resta fermo", !due.campi.c);

  // ---- e il tasto fa lo stesso -------------------------------------------
  const r = ripassa(GWYNNE[1], GWYNNE);
  t.eq("ripassa: saga dal titolo", r?.campi.saga, "The Faithful and the Fallen");
  t.c("ripassa: dichiarata come letta dal titolo, non dedotta", r?.dalTitolo === true && r?.dedotta === false);
  t.eq("ripassa: e il numero", r?.campi.sagaOrder, 1);
  // il numero in testa si prende SOLO se la saga c'e'
  t.c("ripassa: «02 Valour» senza saga in casa non tocca niente", ripassa(GWYNNE[0], [GWYNNE[0]]) === null);
  const conSaga = { ...GWYNNE[0], saga: "The Faithful and the Fallen" };
  t.eq("ripassa: «02 Valour» con la saga scritta a mano prende il posto", ripassa(conSaga, [conSaga])?.campi.sagaOrder, 2);
  t.c("ripassa: un posto gia' dato non si sovrascrive", ripassa({ ...conSaga, sagaOrder: 7 }, [conSaga]) === null);
}
