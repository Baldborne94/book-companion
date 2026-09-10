// IL LEMMA NON SI SCRIVE DUE VOLTE.
//
// La scheda del dizionario ha un titolo di pannello — la parola che hai
// toccato — e poi, in testa alla voce, il lemma. Su una parola comune sono
// la stessa parola, e la si leggeva due volte a mezzo centimetro di
// distanza (visto in fotografia sul tablet: «whilst» e sotto «whilst»).
// Sul Collins, che è l'impaginazione scelta dal lettore, il lemma compare
// una volta sola: il titolo del pannello è una nostra aggiunta.
//
// Ma è il caso RARO quello che sbaglia in silenzio. Su una parola comune
// una regola storta non si vede — titolo e lemma coincidono comunque —
// mentre su una forma flessa nascondere il lemma toglie proprio la riga
// per cui quel rigo esiste: «fuming» in cima e «fume, participio
// presente» sotto, che è l'unica cosa che dice al lettore quale parola
// andare a cercare.
import { lemmaDoppione } from "../src/lib/dictionary.js";

export default async function (t) {
  // ---- il doppione, che è il caso da togliere -------------------------
  t.eq(
    "titolo e lemma uguali: il lemma è un doppione",
    lemmaDoppione({ word: "whilst", lemma: "whilst" }, "whilst"),
    true
  );
  t.eq(
    "e senza `lemma` vale la parola",
    lemmaDoppione({ word: "whilst" }, "whilst"),
    true
  );
  // la parola toccata arriva dal testo com'è scritta lì: a inizio frase è
  // maiuscola, e sarebbe lo stesso doppione
  t.eq(
    "le maiuscole non fanno due parole diverse",
    lemmaDoppione({ word: "Whilst", lemma: "whilst" }, "Whilst"),
    true
  );
  t.eq("né gli spazi attorno", lemmaDoppione({ lemma: " whilst " }, "whilst"), true);

  // ---- e i due casi in cui il lemma DEVE restare ----------------------
  // (1) LA FORMA FLESSA: «fuming» in cima, «fume (participio presente)»
  // nella voce. Toglierlo lascerebbe il lettore senza la parola da cercare.
  t.eq(
    "una forma flessa non è mai un doppione",
    lemmaDoppione({ word: "fuming", lemma: "fume", forma: "participio presente" }, "fuming"),
    false
  );
  // e nemmeno quando la forma c'è e il lemma per caso combacia col titolo
  t.eq(
    "la forma comanda anche a lemma uguale",
    lemmaDoppione({ word: "fume", lemma: "fume", forma: "participio presente" }, "fume"),
    false
  );
  // (2) IL LEMMA DIVERSO dalla parola toccata: «mice» → «mouse»
  t.eq(
    "un lemma diverso resta scritto",
    lemmaDoppione({ word: "mice", lemma: "mouse" }, "mice"),
    false
  );
  // il titolo può essere la FRASE selezionata o un termine di glossario, e
  // lì il lemma non ripete niente
  t.eq(
    "col titolo di una frase il lemma resta",
    lemmaDoppione({ word: "muscle in", lemma: "muscle" }, "muscle in"),
    false
  );

  // ---- il niente non nasconde niente ----------------------------------
  // qui l'errore per generosità cancella una riga vera, quindi nel dubbio
  // il lemma si scrive
  t.eq("senza voce non si nasconde niente", lemmaDoppione(null, "whilst"), false);
  t.eq("senza titolo nemmeno", lemmaDoppione({ lemma: "whilst" }, ""), false);
  t.eq("e due vuoti non sono un doppione", lemmaDoppione({ lemma: "" }, ""), false);
  t.eq("né un titolo che manca", lemmaDoppione({ lemma: "whilst" }, undefined), false);
}
