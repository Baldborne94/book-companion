// IL TITOLO RIPULITO. È la metà che `sagaDalTitolo` buttava via: tolta
// l'etichettatura di chi ha impacchettato il file, quel che resta è il
// nome del romanzo. Sbaglia in silenzio da tutt'e due i lati — un titolo
// tagliato male non alza nessun errore (si legge e basta), e un titolo
// lasciato lungo rende sei volumi di una saga indistinguibili sul
// ripiano, perché troncano tutti sulle stesse tre parole.
//
// La cura vera però è che NON si riscrive niente: si propone, e la
// Libreria fa spuntare. Qui si prova la proposta.
import { titoloPulito, proponiTitoli } from "../src/lib/titoli.js";

const p = (title, author) => titoloPulito({ title, author });

export default async function (t) {
  // ---- QUEL CHE SI TOGLIE ---------------------------------------------
  // I casi veri, presi dalla fotografia della Libreria del lettore: sei
  // Jordan che sullo scaffale cominciavano tutti con «Wheel of Time [».
  t.eq("la saga col numero fra parentesi", p("Wheel of Time [02]: The Great Hunt"), "The Great Hunt");
  t.eq("e senza i due punti", p("Wheel of Time [05] The Fires of Heaven"), "The Fires of Heaven");
  t.eq("lo zero del prequel non è «nessun numero» qui", p("Wheel of Time [00]: New Spring"), "New Spring");
  t.eq("la saga fra parentesi in coda", p("Eric (Discworld, #9)"), "Eric");
  t.eq("la saga dietro i due punti", p("Malice: The Faithful and the Fallen Series Book 1"), "Malice");
  t.eq("la saga davanti", p("Discworld 09 - Eric"), "Eric");
  t.eq("le quadre in testa", p("[Wheel of Time 03] The Dragon Reborn"), "The Dragon Reborn");
  t.eq("«Book N of the Saga» in coda", p("The Dragon Reborn: Book 3 of the Wheel of Time"), "The Dragon Reborn");
  t.eq("e in testa", p("Book 3 of the Wheel of Time: The Dragon Reborn"), "The Dragon Reborn");
  // il solo numero in testa: non dice la saga, ma è rumore lo stesso
  t.eq("il numero nudo in testa", p("02 Valour"), "Valour");
  t.eq("col trattino", p("1 - Malice"), "Malice");
  t.eq("in italiano", p("Il grande inverno (Cronache del ghiaccio e del fuoco, Libro 2)"), "Il grande inverno");

  // IL TITOLO PUÒ ESSERE IL NOME DEL FILE INTERO, autore compreso — e non
  // c'è niente da fare per toglierlo: il titolo è l'ultimo pezzo comunque,
  // perché è quello che l'espressione cattura dopo il numero. La prima
  // versione aveva una funzione apposta per levare l'autore davanti: si è
  // misurato che dà lo STESSO titolo su tutti e quattro i casi veri, ed è
  // stata tolta invece di restare lì a sembrare necessaria.
  t.eq(
    "l'autore davanti non disturba",
    p("Jordan, Robert - Wheel of Time 01 - The Eye of the World"),
    "The Eye of the World"
  );
  t.eq("in qualunque ordine sia scritto", p("Evan Winter - The Burning 01 - The Rage of Dragons"), "The Rage of Dragons");
  t.eq("e nemmeno col solo numero in mezzo", p("Rothfuss, Patrick - 01 - The Name of the Wind"), "The Name of the Wind");

  // ---- QUEL CHE NON SI TOCCA ------------------------------------------
  // Sono la maggioranza, ed è il lato dove sbagliare costa di più: un
  // titolo buono accorciato è un romanzo che non ritrovi più.
  for (const titolo of [
    "Piranesi", "Dune", "Between Two Fires", "The Lies of Locke Lamora",
    "Neuromancer", "Il nome della rosa", "The Shadow Rising",
    // i quattro che `sagaDalTitolo` difende già e che qui tornano nudi
    "Fahrenheit 451", "2001: A Space Odyssey", "1984", "Catch-22",
    "Halo: Combat Evolved 2", "Foundation - Season 2",
  ]) {
    t.eq(`«${titolo}» resta com'è`, p(titolo), null);
  }
  t.eq("un titolo vuoto non esplode", p(""), null);
  t.eq("e nemmeno uno che non c'è", p(), null);
  t.eq("né un titolo che non è una stringa", p(42), null);

  // ---- LE GUARDIE SUL RESTO -------------------------------------------
  // QUEL CHE RESTA DEVE ESSERE UN TITOLO, e quando non lo è la risposta
  // giusta è tacere: rinominare un romanzo «Book» è peggio di lasciarlo
  // com'era.
  t.eq("un resto senza lettere non è un titolo", p("Discworld 09 - 1977"), null);
  t.eq("un resto di una lettera sola nemmeno", p("Discworld 09 - X"), null);
  t.eq("e un resto che è solo un'etichetta", p("[Discworld 09] Book 2"), null);
  // «(ebook)», «retail», «ITA»: quel che certi archivi appiccicano e non è
  // né saga né titolo
  t.eq("il rumore dell'archivio non diventa un titolo", p("Discworld 09 - ebook"), null);
  t.eq("la punteggiatura ai bordi se ne va", p("Wheel of Time [02]:  The Great Hunt. "), "The Great Hunt");
  // DICHIARATO: il confronto `pulito === originale` è cintura e bretelle e
  // NON è portante (mutazione provata: toglierlo non fa cascare niente).
  // Oggi è irraggiungibile per costruzione — ogni espressione consuma
  // almeno una cifra, quindi quel che resta è sempre un pezzo più corto
  // del titolo. Sta lì per il giorno che qualcuno aggiunge una forma dove
  // il resto può essere tutto: senza, il pannello mostrerebbe una riga
  // «X → X» da spuntare, che non vuol dire niente.
  t.eq("un titolo senza numero non arriva nemmeno al confronto", p("Valour"), null);

  // ---- LA PASSATA SULLA BIBLIOTECA ------------------------------------
  {
    const libri = [
      { id: "a", title: "Wheel of Time [02]: The Great Hunt" },
      { id: "b", title: "Piranesi" },
      { id: "c", title: "02 Valour" },
      { id: "d", title: "Dune" },
    ];
    const fuori = proponiTitoli(libri);
    t.eq("propone solo dove c'è da togliere", fuori.length, 2);
    t.eq("e dice da dove a dove", JSON.stringify(fuori[0]), '{"id":"a","da":"Wheel of Time [02]: The Great Hunt","a":"The Great Hunt"}');
    t.eq("il secondo è quello col numero in testa", fuori[1].a, "Valour");
    // l'id è come si ritrova il libro quando il lettore spunta: senza, la
    // riscrittura non saprebbe a chi è rivolta
    t.c("ogni proposta porta il suo id", fuori.every((f) => f.id));
    t.eq("una voce senza id si salta", proponiTitoli([{ title: "02 Valour" }]).length, 0);
    t.eq("una biblioteca vuota non propone niente", proponiTitoli([]).length, 0);
    t.eq("e nemmeno una che non c'è", proponiTitoli().length, 0);
    t.eq("una voce storta non porta via il giro", proponiTitoli([null, { id: "x", title: "02 Valour" }]).length, 1);
  }
  t.eq(
    "e regge anche il titolo che è tutto il nome del file",
    proponiTitoli([{ id: "a", title: "Jordan, Robert - Wheel of Time 01 - The Eye of the World" }])[0].a,
    "The Eye of the World"
  );
}
