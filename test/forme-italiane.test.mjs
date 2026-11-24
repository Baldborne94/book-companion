// LA MORFOLOGIA ITALIANA DELLA RICERCA.
//
// Il motore conosceva solo l'inglese: «libro» non trovava «libri», «strega»
// non trovava «streghe». Su un romanzo italiano la ricerca falliva proprio
// dove la memoria sbaglia più spesso — una frase la ricordi al singolare e il
// libro la scrive al plurale — e falliva in silenzio, perché una ricerca che
// non trova sembra solo una ricerca senza risposta.
//
// Qui si prova la copertura (quel che deve trovare) e soprattutto il PREZZO:
// in inglese generare largo produce non-parole («musclees»), che nel testo non
// compaiono e non costano niente; in italiano produce PAROLE VERE, e allora
// ogni regola in più va pesata.
import { varianti, pluraliIt, singolariIt, queryRegex } from "../src/lib/wordForms.js";

const trova = (q, t) => (t.match(queryRegex(q)) || [])[0] ?? null;

export default async function (t) {
  // =======================================================================
  // QUEL CHE PRIMA NON FUNZIONAVA
  // =======================================================================
  {
    const casi = [
      ["libro", "due libri sul tavolo", "libri"],
      ["libri", "un libro solo", "libro"],
      ["strega", "tre streghe di Lancre", "streghe"],
      ["streghe", "la strega bussò", "strega"],
      ["cane", "i cani abbaiavano", "cani"],
      ["cani", "il cane dormiva", "cane"],
      ["guardia", "le guardie di Ankh", "guardie"],
      ["notte", "tre notti fa", "notti"],
      ["voce", "le voci correvano", "voci"],
    ];
    for (const [q, testo, atteso] of casi) t.eq(`«${q}» trova «${atteso}»`, trova(q, testo), atteso);
  }
  {
    // LA C E LA G CAMBIANO SUONO davanti alla i e alla e, e da una parola sola
    // non si sa quale delle due strade prenda: «amico» fa «amici», «banco» fa
    // «banchi». Si generano tutt'e due, e quella sbagliata non compare.
    t.eq("amico → amici", trova("amico", "i miei amici"), "amici");
    t.eq("banco → banchi", trova("banco", "i banchi di scuola"), "banchi");
    t.eq("lago → laghi", trova("lago", "i laghi del nord"), "laghi");
    t.eq("mago → maghi", trova("mago", "i maghi invisibili"), "maghi");
    t.eq("strega → streghe", trova("strega", "le streghe"), "streghe");
    t.eq("amica → amiche", trova("amica", "le amiche"), "amiche");
    // e all'indietro
    t.eq("amici → amico", trova("amici", "un amico"), "amico");
    t.eq("banchi → banco", trova("banchi", "un banco"), "banco");
    t.eq("maghi → mago", trova("maghi", "un mago"), "mago");
  }
  {
    // le uscite in -cia / -gia, che l'ortografia italiana scrive in due modi
    t.eq("camicia → camicie", trova("camicia", "le camicie stese"), "camicie");
    t.eq("spiaggia → spiagge", trova("spiaggia", "le spiagge deserte"), "spiagge");
    t.eq("arancia → arance", trova("arancia", "le arance mature"), "arance");
    // e il -io, che fa -i o -ii secondo l'accento
    t.eq("figlio → figli", trova("figlio", "i suoi figli"), "figli");
    t.c("e la strada in -ii c'è comunque", pluraliIt("zaino").size >= 1 && varianti("premio").has("premii"));
  }

  // =======================================================================
  // L'ORDINE DELLE FAMIGLIE
  // =======================================================================
  {
    // Le uscite stanno dalla più specifica alla più generica, e la prima che
    // risponde chiude.
    //
    // NOTA ONESTA su cosa fa quel `break`: NON serve a far uscire «banchi» —
    // provato a toglierlo, e la forma giusta esce comunque, perché la regola
    // generica produce quasi sempre un doppione di quella specifica. Serve a
    // tenere l'alternanza pulita: senza, «strega» genererebbe anche
    // «strege», che non è una parola e allunga l'espressione per niente.
    t.c("«banco» fa «banchi»", pluraliIt("banco").has("banchi"), [...pluraliIt("banco")].join(" "));
    t.c("«camicia» fa «camicie»", pluraliIt("camicia").has("camicie"));
    t.c("«strega» fa «streghe»", pluraliIt("strega").has("streghe"), [...pluraliIt("strega")].join(" "));
    // e questa è la parte che il `break` difende davvero
    t.c("e NON fa «strege», che non è niente", !pluraliIt("strega").has("strege"), [...pluraliIt("strega")].join(" "));
    t.c("né «amice» da «amica»", !pluraliIt("amica").has("amice"));
  }

  // =======================================================================
  // IL GENERE RESTA FUORI, ED È UNA RINUNCIA DECISA
  // =======================================================================
  //
  // Passare da -o a -a per prendere gli aggettivi («alto» → «alta») vorrebbe
  // dire generare anche «caso» da «casa». E quella non è una forma inventata
  // che nel testo non compare: è UN'ALTRA PAROLA, che compare eccome.
  {
    t.c("«casa» non genera «caso»", !varianti("casa").has("caso"), [...varianti("casa")].join(" "));
    t.c("né «caso» genera «casa»", !varianti("caso").has("casa"));
    t.c("«porto» non genera «porta»", !varianti("porto").has("porta"));
    t.c("«corso» non genera «corsa»", !varianti("corso").has("corsa"));
    // il numero invece sì, ed è quel che serve
    t.c("ma «casa» genera «case»", varianti("casa").has("case"));
    t.c("e «caso» genera «casi»", varianti("caso").has("casi"));
  }

  // =======================================================================
  // LA SOGLIA DELLE QUATTRO LETTERE
  // =======================================================================
  //
  // L'inglese si ferma a tre; l'italiano no, e la differenza ha un motivo
  // misurato: a tre, «che» diventerebbe «chi» e «uno» diventerebbe «uni» —
  // parole che stanno in ogni riga di ogni pagina. Una ricerca che le
  // confonde non trova, allaga.
  {
    for (const w of ["che", "chi", "uno", "una", "non", "con", "per"]) {
      t.eq(`«${w}» non prende forme italiane`, pluraliIt(w).size + singolariIt(w).size, 0);
    }
    t.c("«che» non diventa «chi»", !varianti("che").has("chi"));
    t.c("«uno» non diventa «uni»", !varianti("uno").has("uni"));
    // il prezzo, dichiarato: un nome di tre lettere resta fuori
    t.c("e il prezzo è che «zio» non trova «zii»", !varianti("zio").has("zii"));
    // dalle quattro in su si flette
    t.c("da quattro lettere in su sì", varianti("gatto").has("gatti"));
  }

  // =======================================================================
  // IL PREZZO VERO: si sbaglia SEMPRE per eccesso, mai per difetto
  // =======================================================================
  //
  // «-e» è ambiguo e non c'è modo di scioglierlo da una parola sola: «cane»
  // è un singolare che fa «cani», «porte» è già un plurale. Il motore legge
  // tutt'e due, quindi cercando «porte» si accende anche «porti».
  //
  // È il prezzo di far funzionare «cane → cani», «voce → voci», «notte →
  // notti» — cioè tutti i nomi italiani che al singolare finiscono in -e.
  // Rinunciarci per evitare qualche accensione di troppo vorrebbe dire
  // perdere una classe intera di parole, e una ricerca che trova qualcosa in
  // più si corregge con l'occhio; una che non trova non si corregge affatto.
  {
    t.c("«porte» si porta dietro «porti»", varianti("porte").has("porti"));
    t.c("e «conte» si porta dietro «conti»", varianti("conte").has("conti"));
    // ma la parola giusta c'è sempre: non si perde mai un riscontro vero
    t.eq("il riscontro vero resta il primo", trova("porte", "le porte chiuse"), "porte");
    t.eq("e la sua base pure", trova("porte", "la porta chiusa"), "porta");
  }

  // =======================================================================
  // L'INGLESE NON DEVE ESSERSI MOSSO
  // =======================================================================
  //
  // Le due lingue si generano SEMPRE tutt'e due: indovinare la lingua da una
  // parola sola non si può, e sbagliando si perderebbero proprio le ricerche
  // che questa cura deve salvare.
  {
    t.eq("«muscle in» trova ancora «muscled in»", trova("muscle in", "he muscled in"), "muscled in");
    t.eq("e «muscling in»", trova("muscle in", "muscling in"), "muscling in");
    t.eq("«scroll» trova «scrolls»", trova("scroll", "two scrolls"), "scrolls");
    t.eq("«carry» trova «carried»", trova("carry", "he carried it"), "carried");
    t.eq("«witch» trova «witches»", trova("witch", "three witches"), "witches");
    t.eq("«stop» trova «stopped»", trova("stop", "he stopped"), "stopped");
    // e la guardia che c'era resta: le parole corte non si flettono
    t.eq("«muscle ins» non è ancora «muscle in»", trova("muscle in", "muscle ins"), null);
  }
  {
    // le forme dell'altra lingua quasi mai esistono in questa, ed è il
    // motivo per cui si possono generare tutte insieme
    t.c("l'inglese «cane» si porta dietro l'italiano «cani»", varianti("cane").has("cani"));
    t.eq("ma in un testo inglese non compare", trova("cane", "he leaned on his cane"), "cane");
  }

  // =======================================================================
  // I CASI DI CONTORNO
  // =======================================================================
  {
    t.eq("niente non ha forme", pluraliIt("").size, 0);
    t.eq("né una parola cortissima", pluraliIt("a").size, 0);
    t.eq("una parola che non finisce come un italiano resta sola", pluraliIt("smartphon").size, 0);
    // LA PAROLA STESSA NON SI RIGENERA.
    //
    // NOTA ONESTA: `out.delete(w)` è cintura e bretelle. Provato a toglierlo
    // e non casca niente, perché su trentasei parole vere non c'è un solo
    // caso in cui un'uscita ridia la parola di partenza — le regole cambiano
    // sempre almeno una lettera finale. Resta perché costa niente ed è
    // corretto, ma nessun test lo difende e questa riga lo dice invece di
    // far finta.
    for (const w of ["libro", "strega", "cani", "porte", "amico"]) {
      t.c(`«${w}» non genera se stesso`, !pluraliIt(w).has(w) && !singolariIt(w).has(w));
    }
  }
}
