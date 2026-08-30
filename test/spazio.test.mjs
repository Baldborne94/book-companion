// QUANDO UN NUMERO MERITA DI ESSERE DETTO.
//
// La Libreria mostrava sempre il tetto locale del browser, e il lettore ha
// chiesto: «cosa sarebbero sti 500 GB?». La domanda e' il difetto: un
// numero che non chiede niente si impara a ignorare, e allora non lo si
// legge nemmeno il giorno che conta.
//
// Qui si prova la decisione, non la scrittura: quando quel tetto stringe
// davvero, e quanto della biblioteca sta nel piano del cloud.
import { stretto, parteDelPiano, fetta, PIANO, PIENO, QUOTA_PARTE, QUOTA_RESTO } from "../src/lib/spazio.js";

const G = 1e9;
const M = 1e6;

export default async function (t) {
  // ---- il tetto locale tace quasi sempre, ed e' giusto cosi' -------------
  {
    // il caso del lettore: 152 MB su mezzo tera, cioe' lo 0,03%. Un numero
    // che non dice niente a nessuno
    t.c("152 MB su 500 GB non sono una notizia", !stretto({ usage: 152 * M, quota: 499.6 * G }));
    t.c("neanche 20 GB su 500", !stretto({ usage: 20 * G, quota: 500 * G }));
  }
  {
    // LA PRIMA SOGLIA: la biblioteca e' grossa per questo dispositivo
    t.c("a meta' del tetto si comincia a dirlo", stretto({ usage: 5 * G, quota: 10 * G }));
    t.c("appena sotto la meta' si tace ancora", !stretto({ usage: 4.9 * G, quota: 10 * G }));
    t.eq("e la meta' e' proprio la soglia dichiarata", QUOTA_PARTE, 0.5);
  }
  {
    // LA SECONDA SOGLIA, e non e' un doppione: prende il caso «il tablet e'
    // pieno, la biblioteca non c'entra». Una soglia in percentuale non lo
    // vedrebbe MAI su un dispositivo con un tetto grande — 1 GB rimasto su
    // 500 e' lo 0,2% usato, cioe' silenzio, mentre e' esattamente il momento
    // in cui bisogna parlare.
    t.c("con poco spazio rimasto si parla, anche se la biblioteca e' minuscola", stretto({ usage: 1 * M, quota: 1.5 * G }));
    t.c("mentre col doppio di margine si tace", !stretto({ usage: 1 * M, quota: 400 * G }));
    t.eq("il margine sotto il quale si parla", QUOTA_RESTO, 2e9);
  }
  {
    // NON SAPERE NON E' UN ALLARME. E' la stessa regola dell'avviso sulla
    // persistenza: allarmare senza sapere e' peggio del silenzio, perche'
    // non lasci al lettore niente da fare.
    t.c("senza stima non si dice niente", !stretto(null));
    t.c("ne' con un oggetto vuoto", !stretto({}));
    t.c("un tetto a zero e' un browser che non risponde, non un tetto pieno", !stretto({ usage: 5 * M, quota: 0 }));
    t.c("e un tetto che non e' un numero non si interpreta", !stretto({ usage: 5 * M, quota: "tanto" }));
    t.c("ne' un uso mancante", !stretto({ quota: 10 * G }));
  }
  {
    // il caso limite vero: usato piu' del tetto. Succede, perche' la stima
    // e' una stima
    t.c("oltre il tetto si parla di sicuro", stretto({ usage: 12 * G, quota: 10 * G }));
  }

  // ---- quanto della biblioteca sta nel piano ----------------------------
  {
    t.eq("mezzo piano", parteDelPiano(PIANO / 2), 0.5);
    t.eq("piano pieno", parteDelPiano(PIANO), 1);
    t.c("e oltre il piano il conto non si ferma: dice che hai sforato", parteDelPiano(1.4 * G) > 1);
    t.eq("un secchio vuoto e' zero, non niente", parteDelPiano(0), 0);
  }
  {
    // `null` e non zero quando non c'e' niente da dire: uno zero sullo
    // schermo sembra una misura, e direbbe «non hai niente lassu'» anche
    // quando la verita' e' «non lo so»
    t.eq("senza conto non si inventa uno zero", parteDelPiano(undefined), null);
    t.eq("ne' con una stringa", parteDelPiano("boh"), null);
    t.eq("e un peso negativo non e' un peso", parteDelPiano(-5), null);
  }

  // ---- la striscia da disegnare -----------------------------------------
  {
    t.eq("mezzo piano riempie mezza barra", fetta(PIANO / 2), "50%");
    t.eq("un secchio vuoto non disegna niente", fetta(0), "0%");
    // UNA BARRA NON ESCE MAI DAL SUO BINARIO: senza il tetto, una biblioteca
    // piu' grande del piano darebbe una striscia piu' lunga del contenitore,
    // e le due strisce (libri e melodie) si spingerebbero fuori a vicenda
    t.eq("oltre il piano la barra si ferma al bordo", fetta(3 * G), "100%");
    t.eq("e un peso storto vale zero invece di rompere il disegno", fetta(undefined), "0%");
    t.eq("anche negativo", fetta(-1), "0%");
  }

  // ---- i riferimenti dichiarati -----------------------------------------
  {
    // Il piano non e' una misura: non si puo' chiedere al server, dipende da
    // quale piano hai. E' un riferimento, e sta in UN posto solo — prima era
    // un numero in `SyncPanel` piu' la stringa «1 GB» due righe sotto, cioe'
    // due cose da cambiare insieme e da dimenticare separatamente.
    t.eq("il piano gratuito", PIANO, 1e9);
    t.eq("e la soglia oltre cui la barra parla", PIENO, 0.8);
  }
}
