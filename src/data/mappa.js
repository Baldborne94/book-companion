// COSA SA FARE L'APP, scritto una volta in un posto solo.
//
// Chiesto dal lettore («c'è modo di rendere più user friendly
// l'applicazione?») dopo che sei segnalazioni su sei dicevano la stessa
// cosa: «dove regolo le dimensioni?», «ma dove sarebbe quello che hai
// fatto?», «serve avere sia raggruppa che ordina?». Non che l'app sia
// fatta male — che **non dice quello che sa fare**, e le funzioni si
// scoprono per caso o chiedendole a qualcun altro.
//
// NON E' UN TUTORIAL, ED E' LA DIFFERENZA CHE CONTA: un tutorial si legge
// una volta, quando non serve, e non lo si ritrova il giorno che servirebbe.
// Questa e' una MAPPA — si apre quando ti chiedi «ma l'app lo sa fare?» e
// si scorre. Per questo non compare mai da sola e non si mette in mezzo.
//
// **E SI RAGGRUPPA PER DOVE SEI, non per categoria**: la domanda che uno
// ha in testa non e' «quali funzioni di annotazione esistono», e' «sto
// leggendo, cosa posso fare da qui». I luoghi sono i posti dove ti trovi
// davvero, e il primo e' il libro perche' e' li' che si passa il tempo.
//
// STA IN `data/` E NON NEL COMPONENTE per la ragione di sempre: un test in
// Node non importa un `.jsx`, e qui c'e' qualcosa da difendere. Una voce
// muta — senza il cosa o senza il dove — non alza nessun errore: si legge
// e lascia il lettore esattamente dov'era, che e' il difetto da cui questa
// pagina nasce. Vale la regola di `GUAI` e di `ESITI_CONTROLLO`.
//
// **IL PERICOLO VERO E' L'INVECCHIAMENTO**: una mappa che nomina una
// funzione tolta e' PEGGIO di nessuna mappa, perche' il lettore le crede e
// va a cercare un tasto che non c'e'. Una parte si puo' difendere — le
// voci che nominano una levetta del reader portano la sua `chiave`, e il
// test pretende che quella chiave esista davvero in `deviceDefaults` —
// ma il resto no: che un tasto sia ancora sullo schermo nessun test in
// Node lo sa. **Chi toglie una funzione la toglie anche da qui**, ed e'
// scritto qui perche' non si dimentichi.

// I luoghi, nell'ordine in cui ci si passa il tempo. `sezione` lega il
// luogo a una voce di `SECTIONS` quando ce n'e' una: il test controlla che
// esista, o la mappa manderebbe in una stanza che non c'e'.
export const LUOGHI = [
  {
    id: "libro",
    nome: "Mentre leggi",
    sotto: "I tasti nelle due barre, che compaiono toccando il centro della pagina",
  },
  {
    id: "parola",
    nome: "Su una parola",
    sotto: "Tieni premuto su una parola del testo: si apre il menu della selezione",
  },
  {
    id: "scheda",
    nome: "Nella scheda di un libro",
    sotto: "Si apre toccando la copertina, in Libreria o nell'Ingresso",
  },
  { id: "libreria", nome: "In Libreria", sezione: "library", sotto: "Lo scaffale e la cassetta degli attrezzi" },
  { id: "ingresso", nome: "Nell'Ingresso", sezione: "home", sotto: "La prima schermata" },
  { id: "musica", nome: "Nella sala della musica", sezione: "music" },
  { id: "impostazioni", nome: "In Impostazioni", sotto: "Il tasto in cima a ogni schermata" },
];

// Ogni voce: COSA FA e DOVE si tocca. Il «dove» non e' un ornamento — e'
// la meta' che serve, perche' sapere che una funzione esiste senza sapere
// da dove si apre lascia esattamente dove si era.
export const MAPPA = [
  // ---- MENTRE LEGGI ------------------------------------------------------
  {
    luogo: "libro",
    nome: "Le barre vanno e vengono",
    cosa: "Un tocco al centro della pagina le nasconde e le rimette; ai bordi, volta la pagina.",
    dove: "Se il tocco non risponde, c'è una linguetta sul bordo in alto che le richiama sempre.",
  },
  {
    luogo: "libro",
    nome: "Mappe e illustrazioni da vicino",
    cosa: "Una mappa o un'illustrazione del libro si apre a tutto schermo: due dita o un doppio tocco per avvicinarti, il dito per spostarti.",
    dove: "Tocca l'immagine al centro della pagina (ai bordi il tocco volta pagina). Negli ePub; nei PDF c'è già lo zoom.",
  },
  {
    luogo: "libro",
    nome: "Indice",
    cosa: "I capitoli del libro, per saltare dove vuoi.",
    dove: "Il tasto ☰ nella barra in alto.",
  },
  {
    luogo: "libro",
    nome: "Segnalibri",
    cosa: "Segni un punto e gli dai un'etichetta; li ritrovi tutti in un elenco.",
    dove: "Il tasto 🔖 nella barra.",
  },
  {
    luogo: "libro",
    nome: "Evidenziazioni",
    cosa: "Le frasi che hai segnato, con la tua nota accanto; da qui si torna al punto del libro.",
    dove: "Il tasto ✍ nella barra.",
  },
  {
    luogo: "libro",
    nome: "Cerca nel tomo",
    cosa: "Cerca una frase dentro il libro, e trova anche le forme flesse: «correva» risponde a «correre».",
    dove: "Il tasto 🔍 nella barra.",
  },
  {
    luogo: "libro",
    nome: "Dove eravamo rimasti",
    cosa: "Il riassunto della storia fino al punto in cui sei, senza una riga su quel che viene dopo. Vuole la chiave dell'Oracolo.",
    dove: "Il tasto 🧭 nella barra.",
  },
  {
    luogo: "libro",
    nome: "Come volta la pagina",
    cosa: "Dissolvenza, spazzata o niente. La spazzata è la più bella e costa: sotto la levetta c'è scritto quanto.",
    dove: "Il tasto «Aa» → «La pagina svolta».",
    chiave: "svolta",
  },
  {
    luogo: "libro",
    nome: "Come si segnano i paragrafi",
    cosa: "Rientrati, staccati, o come nel libro senza toccare niente. Su certi ePub convertiti cambia tutta la pagina.",
    dove: "Il tasto «Aa» → «Paragrafi».",
    chiave: "paragrafi",
  },
  {
    luogo: "libro",
    nome: "Corpo, interlinea, margine, colonna",
    cosa: "La misura del testo, e una pagina sola o due affiancate. In verticale la doppia pagina non esiste e la levetta sparisce.",
    dove: "Il tasto «Aa».",
    chiave: "fontSize",
  },
  {
    luogo: "libro",
    nome: "Caldo e luminosità",
    cosa: "Due veli sulla pagina, per leggere al buio senza cambiare tema.",
    dove: "Il tasto «Aa».",
    chiave: "warmth",
  },
  {
    luogo: "libro",
    nome: "Schermo intero",
    cosa: "Toglie di mezzo la barra del browser: su un PDF è un terzo di pagina in più.",
    dove: "Il tasto ⛶ nella barra.",
  },
  {
    luogo: "libro",
    nome: "Le note a piè di pagina si leggono sul posto",
    cosa: "Tocchi l'asterisco e la nota arriva in una scheda: chiusa quella, sei dove eri. Anche le note dentro le note.",
    dove: "Il rimando nel testo — il bersaglio è più largo di quel che sembra.",
  },
  {
    luogo: "libro",
    nome: "Ritaglio dei margini (solo PDF)",
    cosa: "Toglie il bianco attorno alla stampa, così il testo riempie lo schermo.",
    dove: "Il pannello delle impostazioni del PDF.",
    chiave: "ritaglia",
  },
  {
    luogo: "libro",
    nome: "La musica ti segue",
    cosa: "La barra dice cosa sta suonando e ti porta alla sala della musica chiudendo il libro dalla porta giusta.",
    dove: "La striscia nella barra, quando una melodia suona.",
  },

  // ---- SU UNA PAROLA -----------------------------------------------------
  {
    luogo: "parola",
    nome: "Definisci",
    cosa: "Il dizionario dell'app: sensi numerati, resa italiana, modi di dire e verbi frasali. Risponde anche senza rete se hai scaricato il dizionario.",
    dove: "Tieni premuto su una parola → «Definisci».",
    chiave: "dizionario",
  },
  {
    luogo: "parola",
    nome: "Chi è costui?",
    cosa: "La scheda di un personaggio cucita SOLO su quello che hai letto: niente arriva dai volumi che non hai ancora aperto. Vuole la chiave dell'Oracolo.",
    dove: "Tieni premuto su un nome → «Chi è».",
  },
  {
    luogo: "parola",
    nome: "Evidenzia",
    cosa: "Quattro colori, e la citazione finisce nel giardino con la tua nota.",
    dove: "Tieni premuto → i pallini colorati.",
  },
  {
    luogo: "parola",
    nome: "Il glossario della saga",
    cosa: "I termini di una saga restano segnati sulla pagina; tocchi e ti dice cosa sono. Puoi aggiungere le tue voci.",
    dove: "I termini segnati nel testo, e «📖 Tieni nel glossario» nella scheda del dizionario.",
    chiave: "terms",
  },

  // ---- NELLA SCHEDA DI UN LIBRO ------------------------------------------
  {
    luogo: "scheda",
    nome: "La copertina si gira",
    cosa: "Sul rovescio c'è la quarta di copertina, presa dal file o cercata nei cataloghi in rete.",
    dove: "Tocca l'immagine della copertina.",
  },
  {
    luogo: "scheda",
    nome: "Prima di cominciare",
    cosa: "Il riassunto dei volumi PRECEDENTI, da leggere prima di aprire il libro nuovo. Se il tasto non c'è, una riga dice perché.",
    dove: "Sopra «Apri il libro», sui volumi di una saga dal secondo in poi.",
  },
  {
    luogo: "scheda",
    nome: "Stato, voto, cuore",
    cosa: "Da leggere · In lettura · Letto · Abbandonato; le stelle sono un voto, il cuore sceglie i preferiti dell'Ingresso.",
    dove: "In cima alla scheda.",
  },
  {
    luogo: "scheda",
    nome: "L'anno in cui l'hai finito",
    cosa: "Sui libri vecchi, che hai letto prima di metterli qui, l'app non inventa una data: l'anno lo scrivi tu, e lasciarlo vuoto va bene lo stesso.",
    dove: "Sotto lo stato, quando il libro è segnato «Letto».",
  },
  {
    luogo: "scheda",
    nome: "Togli l'ebook, tieni la scheda",
    cosa: "Il file se ne va da qui e dal cloud; copertina, voto, note, evidenziazioni e il posto sullo scaffale restano. Per rileggerlo, reimporta il file: torna nella stessa scheda.",
    dove: "In fondo alla scheda, sopra «Elimina questo libro».",
  },
  {
    luogo: "scheda",
    nome: "Saga, serie e numero",
    cosa: "L'app prova a riconoscerli da sola in cinque modi, ma quel che scrivi tu comanda sempre. Da qui dipendono lo scaffale e i riassunti.",
    dove: "I campi della scheda.",
  },
  {
    luogo: "scheda",
    nome: "Il genere si sceglie col dito",
    cosa: "Un pannello di famiglie e sottogeneri, senza aprire la tastiera.",
    dove: "Il tasto «Scegli» accanto al campo Genere.",
  },
  {
    luogo: "scheda",
    nome: "La copertina si mette a mano",
    cosa: "Una foto dal rullino, rimpicciolita da sola; con ↺ torna quella del file.",
    dove: "Il tasto 🖼 sotto l'immagine.",
  },
  {
    luogo: "scheda",
    nome: "La musica di questo libro",
    cosa: "Leghi una melodia o una raccolta a un romanzo: riaprendolo riparte da sola.",
    dove: "Nella scheda, sezione della musica.",
  },

  // ---- IN LIBRERIA -------------------------------------------------------
  {
    luogo: "libreria",
    nome: "La ricerca cerca anche le tue note",
    cosa: "Titolo, autore, saga, genere, ciclo e le note che hai scritto nella scheda — accenti compresi.",
    dove: "La casella in cima.",
  },
  {
    luogo: "libreria",
    nome: "Cerca dentro i tomi",
    cosa: "Cerca una frase dentro TUTTI i libri, uno per volta. I tomi rimasti nel cloud si contano e si dicono.",
    dove: "Il tasto 🔍 accanto alla ricerca.",
  },
  {
    luogo: "libreria",
    nome: "Il cammino di una saga",
    cosa: "La guida di lettura per intero — anche i volumi che non hai — con dentro i tuoi, in ordine e divisa per parti. Per l'Eresia di Horus è il percorso CD8D: settantuno tappe, antologie e romanzi 40K al loro posto.",
    dove: "Il tasto 📜 sull'intestazione del ripiano, dove la saga è una di quelle riconosciute.",
  },
  {
    luogo: "libreria",
    nome: "Il tuo prossimo passo nel cammino",
    cosa: "In cima al cammino, dove sei arrivato e cosa viene dopo: il passo della guida — anche quando è un volume che non hai — e, quando non ce l'hai, il primo che puoi aprire stasera. Il prologo dell'Eresia sono quattro percorsi alternativi, quindi ne propone uno solo dopo che ne hai cominciato uno tu.",
    dove: "In cima a «Il cammino», sopra i filtri.",
  },
  {
    luogo: "libreria",
    nome: "I racconti delle antologie",
    cosa: "Nel cammino ogni racconto e audiodramma ha la sua riga, nel punto in cui la guida lo chiede, e dice da quale antologia si pesca: non sono file, quindi si spuntano invece di aprirsi. La spunta viaggia col resto delle preferenze.",
    dove: "Dentro «Il cammino», fra un volume e l'altro.",
  },
  {
    luogo: "libreria",
    nome: "Mettere i volumi in ordine di guida",
    cosa: "Scrive su ogni tuo volume il posto e la parte che ha nella guida: il numero è quel che dice all'Oracolo cosa viene prima e cosa viene dopo, la parte è quel che divide lo scaffale nei capitoli della storia. Propone «da → a» una riga per volta, e quello che lasci non si tocca.",
    dove: "Dentro «Il cammino», il tasto 🔢 sotto il conto dei volumi.",
  },
  {
    luogo: "libreria",
    nome: "Come è disposto lo scaffale",
    cosa: "Raggruppa per saga e autore, solo saga, solo autore, genere, voto o stato; e l'ordine dentro e fra i ripiani.",
    dove: "Il tasto ⇅ in fondo alla riga dei filtri.",
  },
  {
    luogo: "libreria",
    nome: "Controlla i tuoi libri",
    cosa: "Apre ogni tomo e dice per nome cosa non va e cosa farci — e quel che sa curare da sé lo cura.",
    dove: "🧰 Manutenzione → «🩺 Controlla i tuoi libri».",
  },
  {
    luogo: "libreria",
    nome: "Riconosci saghe e cicli",
    cosa: "Ripassa i libri che una saga non ce l'hanno: tavole, collana nel file, titolo, catalogo in rete, e i tuoi altri libri.",
    dove: "🧰 Manutenzione.",
  },
  {
    luogo: "libreria",
    nome: "Ripulisci i titoli",
    cosa: "Toglie dal titolo l'etichettatura di chi ha impacchettato il file. Ti mostra «da → a» e rinomina solo quel che spunti.",
    dove: "🧰 Manutenzione.",
  },
  {
    luogo: "libreria",
    nome: "Ritrova le copertine",
    cosa: "Va a ripescare nel file le copertine che mancano sullo scaffale.",
    dove: "🧰 Manutenzione.",
  },
  {
    luogo: "libreria",
    nome: "Riconosci i doppioni",
    cosa: "Calcola l'impronta dei libri entrati prima che l'app la calcolasse, così lo stesso file non entra due volte.",
    dove: "🧰 Manutenzione.",
  },
  {
    luogo: "libreria",
    nome: "Esporta e ripristina",
    cosa: "Un archivio con libri, segni, glossari e melodie. Ripristinando puoi scegliere cosa far entrare.",
    dove: "«Esporta biblioteca» in vista, «↩ Ripristina» nella cassetta degli attrezzi.",
  },

  // ---- NELL'INGRESSO -----------------------------------------------------
  {
    luogo: "ingresso",
    nome: "Continua da dove ti sei fermato",
    cosa: "L'ultimo libro aperto, col punto di lettura e quanto manca alla fine.",
    dove: "In cima all'Ingresso.",
  },
  {
    luogo: "ingresso",
    nome: "Il prossimo della saga",
    cosa: "Finito un volume, ti propone quello dopo — e solo se sa davvero qual è.",
    dove: "Nell'Ingresso, sotto il libro in corso.",
  },
  {
    luogo: "ingresso",
    nome: "Il giardino delle citazioni",
    cosa: "Tutte le frasi che hai evidenziato, cercabili anche nelle tue note; si copiano e si esportano in un quaderno.",
    dove: "Il tasto nell'Ingresso.",
  },
  {
    luogo: "ingresso",
    nome: "Il diario di lettura",
    cosa: "Cosa hai letto e quando, anno per anno.",
    dove: "Il tasto nell'Ingresso.",
  },

  // ---- MUSICA ------------------------------------------------------------
  {
    luogo: "musica",
    nome: "Due sorgenti, un elenco solo",
    cosa: "I tuoi file audio e i link di YouTube. Solo i file suonano a schermo spento: il lettore di YouTube si mette in pausa da sé, e non è nostro.",
    dove: "La sala della musica.",
  },
  {
    luogo: "musica",
    nome: "Raccolte e timer del sonno",
    cosa: "Metti insieme le melodie che ti accompagnano, e la musica si spegne da sola con una dissolvenza.",
    dove: "La sala della musica.",
  },

  // ---- IMPOSTAZIONI ------------------------------------------------------
  {
    luogo: "impostazioni",
    nome: "Tema e dimensione",
    cosa: "Quattro temi e sei misure della scrittura, o «Automatica», che guarda lo schermo e decide — e dice cosa ha deciso.",
    dove: "Impostazioni → Aspetto.",
  },
  {
    luogo: "impostazioni",
    nome: "L'Oracolo",
    cosa: "La chiave di Anthropic, la sua scadenza, il tetto di spesa del mese e quanto hai speso. La chiave resta sul dispositivo.",
    dove: "Impostazioni → Oracolo.",
  },
  {
    luogo: "impostazioni",
    nome: "Il dizionario sul dispositivo",
    cosa: "Tre megabyte e mezzo da scaricare una volta: il dizionario risponde anche senza rete, con la resa italiana.",
    dove: "Impostazioni → Dizionario.",
  },
  {
    luogo: "impostazioni",
    nome: "La sincronizzazione",
    cosa: "Facoltativa: i libri restano tuoi e sul dispositivo, e nel cloud ci va una copia per ritrovarli altrove.",
    dove: "Impostazioni → il rimando al pannello della nuvola.",
  },
];

// Le voci di un luogo, nell'ordine in cui stanno scritte: l'ordine e' una
// scelta (prima quel che si usa sempre), non l'alfabeto.
export const vociDi = (luogo) => MAPPA.filter((v) => v.luogo === luogo);
