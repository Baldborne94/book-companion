// I NOMI DI UNA PERSONA, TROVATI NEL LIBRO.
//
// Chi legge tocca una parola sola — «Monza» — ma nelle stesse pagine quella
// persona è anche «Murcatto», «Monza Murcatto», «il Macellaio di Caprile».
// Senza il ponte fra i nomi metà della sua storia non viene raccolta, e la
// scheda esce monca proprio dove serviva piena.
//
// QUI SI PROVANO SOPRATTUTTO I TRE GUARDRAIL, perché è lì che sbagliare
// costa: un alias mancante lascia la scheda un po' più povera, un alias
// SBAGLIATO cuce insieme due personaggi e racconta di uno la storia
// dell'altro. Erano descritti per esteso nel piano e pinnati da niente.
import {
  sembraUnNome,
  varianti,
  regexNome,
  nuovoRegistro,
  annota,
  decidi,
} from "../src/lib/nomi.js";

// il giro vero come lo fa la scheda: un registro, il testo dei capitoli
// dentro la frontiera, e la decisione alla fine
const alias = (nome, ...pezzi) => {
  const reg = nuovoRegistro(nome);
  for (const p of pezzi) annota(reg, p);
  return decidi(reg);
};

export default async function (t) {
  // =======================================================================
  // IL CANCELLO: su cosa si offre «Chi è costui?»
  // =======================================================================
  {
    t.c("un nome intero", sembraUnNome("Logen Novedita"));
    t.c("e anche una parola sola", sembraUnNome("Monza"));
    // MEZZO PARAGRAFO NON È UN NOME: la scheda ha senso su una persona
    t.c("non mezza frase", !sembraUnNome("he walked into the room slowly"));
    t.c("né una riga lunghissima", !sembraUnNome("Bayaz".repeat(12)));
    t.c("né niente", !sembraUnNome(""));
    t.c("né uno spazio", !sembraUnNome("   "));
    t.c("né una parola minuscola", !sembraUnNome("vendetta"));
  }
  {
    // LA MAIUSCOLA SI CHIEDE A UNICODE, NON A UN INTERVALLO. C'era
    // `[A-ZÀ-Þ]` mentre tutto il resto del file usa `\p{Lu}`: due modi di
    // dire «maiuscola» nello stesso file, e quello stretto stava proprio sul
    // cancello. Questi nomi non offrivano la scheda affatto, IN SILENZIO —
    // nessun errore, il tasto semplicemente non compariva.
    for (const n of ["Łukasz", "Šárka", "Żeleński", "Ольга", "Δημήτρης", "Þórr"])
      t.c(`«${n}» è un nome come gli altri`, sembraUnNome(n), n);
    // e questi passavano già: la cura non deve portarseli via
    for (const n of ["Öztürk", "Ñuño", "Ærik", "Ãlvaro"])
      t.c(`«${n}» passava e continua a passare`, sembraUnNome(n), n);
    // il vecchio intervallo prendeva per una lettera anche «×», che sta fra
    // Ö e Ø: un segno di moltiplicazione non è l'inizio di un nome
    t.c("un segno di moltiplicazione non è una maiuscola", !sembraUnNome("× strano"));
  }

  // =======================================================================
  // LE PARTI DEL NOME VALGONO DA SOLE
  // =======================================================================
  {
    const v = varianti("Logen Novedita");
    t.c("il nome intero c'è", v.includes("Logen Novedita"));
    t.c("e il cognome da solo pure", v.includes("Novedita"));
    t.c("e il nome da solo", v.includes("Logen"));
    // ARTICOLI E TITOLI RESTANO FUORI: da soli acchiapperebbero mezzo libro
    const lord = varianti("Lord Brock");
    t.c("«Lord» da solo non è un alias", !lord.includes("Lord"), lord.join("|"));
    t.c("ma «Brock» sì", lord.includes("Brock"));
    t.c("e il titolo resta attaccato nell'intero", lord.includes("Lord Brock"));
    // le particelle brevi non fanno parte: «Sand dan Glokta»
    t.c("una particella di tre lettere non è un alias", !varianti("Sand dan Glokta").includes("dan"));
    t.eq("senza nome, niente varianti", varianti("").length, 0);
    t.eq("né con uno spazio", varianti("   ").length, 0);
    // i doppioni non si ripetono: «Bayaz Bayaz» non dà due volte lo stesso
    t.eq("niente doppioni", new Set(varianti("Monza Monza")).size, varianti("Monza Monza").length);
  }

  // =======================================================================
  // LA REGEX CHE SEGNA IL NOME SULLA PAGINA
  // =======================================================================
  {
    const r = regexNome("Death");
    // MAIUSCOLE RISPETTATE: «Death» il personaggio, non «the death of kings».
    // Con la flag `i` la scheda di un personaggio del Mondo Disco si
    // riempirebbe di frasi dove si parla della morte e basta.
    t.eq("il personaggio si trova", "Death rode out".match(r)?.length, 1);
    t.eq("la parola comune no", "the death of kings".match(r), null);
  }
  {
    // I NOMI LUNGHI PER PRIMI, o l'alternanza si ferma al pezzo corto e il
    // resto resta fuori dal colpo: «Monza Murcatto» dev'essere UNA presa,
    // non «Monza» più un avanzo.
    const r = regexNome("Monza Murcatto");
    const preso = "Monza Murcatto entrò".match(r);
    t.eq("il nome intero si prende in un colpo", preso?.[0], "Monza Murcatto");
  }
  {
    const r = regexNome("Monza");
    // un nome dentro un'altra parola non è quel nome
    t.eq("dentro un'altra parola non conta", "Monzambano".match(r), null);
    t.eq("ma attaccato alla punteggiatura sì", "«Monza!»".match(r)?.length, 1);
    t.eq("senza nomi non c'è regex", regexNome([]), null);
  }
  {
    // i caratteri speciali di una regex non devono far esplodere niente:
    // un nome col punto («St. Clair») è un nome come gli altri
    const r = regexNome("St. Clair");
    t.c("un punto nel nome non rompe la regex", "St. Clair arrivò".match(r)?.length >= 1);
  }

  // =======================================================================
  // GUARDRAIL 1 — UN COGNOME DI CASATA NON SI PRENDE
  // =======================================================================
  //
  // Se «Lannister» sta dietro a cinque nomi diversi è una famiglia, non una
  // persona: cercarlo tirerebbe dentro i fratelli con le loro storie, che
  // non sono la sua. È il guardrail che pesa più dei due segnali messi
  // insieme, e senza di lui la scheda di Cersei racconta anche Jaime.
  {
    const casata =
      "Cersei Lannister sorrise. Jaime Lannister non rispose. " +
      "Tywin Lannister li guardò. Tyrion Lannister rise. " +
      "Kevan Lannister annuì. Lancel Lannister tacque. " +
      "Cersei Lannister si voltò ancora.";
    t.c("il cognome di una casata resta fuori", !alias("Cersei", casata).includes("Lannister"), JSON.stringify(alias("Cersei", casata)));
  }
  {
    // MA IL CONTO DECIDE, NON L'ESISTENZA DI UN'ECCEZIONE. Un fratello che
    // porta lo stesso cognome non lo rende della casata: «Murcatto» sta
    // dietro a Monza molte volte e a Benna una, ed è suo. Senza questa metà
    // il guardrail butterebbe via ogni cognome che compare due volte.
    const suo =
      "Monza Murcatto entrò. Benna Murcatto la seguì. " +
      "Monza Murcatto sguainò la spada. Monza Murcatto non si voltò. " +
      "Monza Murcatto pensò a Caprile.";
    t.c("un cognome che è per lo più tuo si prende", alias("Monza", suo).includes("Murcatto"), JSON.stringify(alias("Monza", suo)));
  }

  // =======================================================================
  // GUARDRAIL 2 — UN EPITETO IN POSSESSIVO DICE DI CHI SEI
  // =======================================================================
  //
  // «the Bloody Nine's man» non è il Bloody Nine: un epiteto che finisce in
  // possessivo dice di chi sei, non come ti chiami, e prenderlo vorrebbe
  // dire cucire insieme due personaggi diversi.
  {
    const possessivo =
      "Logen Novedita, known as the Bloody Nine's man, walked north. " +
      "The Bloody Nine's man rode on. The Bloody Nine's man slept. " +
      "The Bloody Nine's man woke.";
    const a = alias("Logen", possessivo);
    t.c("un epiteto in possessivo non è un nome", !a.some((x) => /Bloody/.test(x)), JSON.stringify(a));
  }
  {
    // e senza il possessivo lo STESSO epiteto si prende: se no il guardrail
    // starebbe semplicemente buttando via tutti gli epiteti
    const vero =
      "Logen Novedita, known as the Bloody Nine, walked north. " +
      "The Bloody Nine rode on. The Bloody Nine slept. The Bloody Nine woke.";
    const a = alias("Logen", vero);
    t.c("l'epiteto vero invece si prende", a.some((x) => /Bloody Nine/.test(x)), JSON.stringify(a));
  }

  // =======================================================================
  // GUARDRAIL 3 — UN NOME VISTO UNA VOLTA SOLA NON È UN NOME
  // =======================================================================
  {
    // una parola maiuscola accanto al tuo nome una volta sola è un incontro
    // di passaggio, non un secondo modo di chiamarti
    const unaVolta = "Monza Zaffiro guardò il fiume. Monza tornò a casa. Monza dormì.";
    t.c("un accostamento unico non fa un alias", !alias("Monza", unaVolta).includes("Zaffiro"));
  }
  {
    // e un SOPRANNOME annunciato dalla formula ma mai più rivisto era una
    // frase di passaggio: se il libro non lo riusa, non è un nome
    const eco = "Monza Murcatto, detta la Vipera, entrò. Monza si sedette. Monza bevve.";
    const a = alias("Monza", eco);
    t.c("un soprannome che non ritorna non si tiene", !a.some((x) => /Vipera/.test(x)), JSON.stringify(a));
  }

  // =======================================================================
  // LE FORMULE D'APPELLATIVO, IN PIÙ LINGUE
  // =======================================================================
  {
    // le cerniere sono le stesse in ogni libro di quella lingua, ed è tutto
    // il punto: nessuna tabella di saghe, nessuna domanda al modello
    const prove = [
      ["it", "Monza Murcatto, detta il Macellaio, entrò. Il Macellaio salì. Il Macellaio rise. Il Macellaio tacque.", /Macellaio/],
      ["en", "Logen Ninefingers, known as the Bloody Nine, came. The Bloody Nine rode. The Bloody Nine slept. The Bloody Nine woke.", /Bloody Nine/],
      ["es", "Monza Murcatto, llamada la Carnicera, entró. La Carnicera subió. La Carnicera rió. La Carnicera calló.", /Carnicera/],
      ["de", "Monza Murcatto, genannt die Schlächterin, kam. Die Schlächterin ging. Die Schlächterin lachte. Die Schlächterin schwieg.", /Schlächterin/],
    ];
    for (const [lingua, testo, atteso] of prove) {
      const nome = testo.startsWith("Logen") ? "Logen" : "Monza";
      const a = alias(nome, testo);
      t.c(`la cerniera ${lingua} porta il soprannome`, a.some((x) => atteso.test(x)), `${lingua}: ${JSON.stringify(a)}`);
    }
  }
  {
    // MAI LA FLAG `i` SULLA REGEX DEGLI EPITETI: renderebbe `\p{Lu}`
    // indifferente alle maiuscole e l'epiteto si mangerebbe le parole comuni
    // che gli stanno dietro. L'iniziale ballerina si scrive a mano, quindi
    // la cerniera a inizio frase deve funzionare lo stesso...
    const a = alias(
      "Monza",
      "Monza Murcatto. Detta il Macellaio, salì al trono. Il Macellaio regnò. Il Macellaio vinse. Il Macellaio morì."
    );
    t.c("una cerniera in maiuscolo funziona", a.some((x) => /Macellaio/.test(x)), JSON.stringify(a));
    // ...ma un epiteto tutto minuscolo dopo la cerniera non è un nome
    const b = alias(
      "Monza",
      "Monza Murcatto, detta la vendetta di Talins, entrò. La vendetta arrivò. La vendetta bruciò. La vendetta finì."
    );
    t.c("una parola comune dopo la cerniera non è un nome", !b.some((x) => /vendetta/.test(x)), JSON.stringify(b));
  }

  // =======================================================================
  // IL GIRO NON DEVE MAI ESPLODERE
  // =======================================================================
  {
    const reg = nuovoRegistro("Monza");
    annota(reg, "");
    annota(reg, null);
    annota(reg, undefined);
    t.eq("un capitolo vuoto non dà alias", decidi(reg).length, 0);
    // Il registro si riusa capitolo dopo capitolo, e i conti si sommano.
    //
    // NOTA ONESTA su `FILA.lastIndex = 0` in `annota`: provato a toglierlo,
    // e questo test NON casca — perché `while (exec(…))` arriva fino a
    // `null`, e a quel punto `lastIndex` si azzera da sé. Quella riga è
    // cintura e bretelle, non è portante, e non c'è un test che la difenda:
    // scriverne uno che passa comunque varrebbe meno di questa riga di
    // commento.
    const due = alias(
      "Monza",
      "Monza Murcatto entrò. Monza Murcatto salì.",
      "Monza Murcatto rise. Monza Murcatto vinse."
    );
    t.c("due capitoli si sommano", due.includes("Murcatto"), JSON.stringify(due));
  }
  {
    // il tetto degli alias: sei, e non uno di più — cento nomi davanti al
    // modello non sono una scheda, sono un elenco
    let testo = "";
    for (let i = 0; i < 20; i++) testo += `Monza Nome${String.fromCharCode(65 + i)}xx entrò. Monza Nome${String.fromCharCode(65 + i)}xx uscì. `;
    t.c("gli alias hanno un tetto", alias("Monza", testo).length <= 6, String(alias("Monza", testo).length));
  }
}
