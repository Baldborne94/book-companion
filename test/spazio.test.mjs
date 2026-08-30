// QUANDO UN NUMERO MERITA DI ESSERE DETTO.
//
// La Libreria mostrava sempre il tetto locale del browser, e il lettore ha
// chiesto: «cosa sarebbero sti 500 GB?». La domanda e' il difetto: un
// numero che non chiede niente si impara a ignorare, e allora non lo si
// legge nemmeno il giorno che conta.
//
// Qui si prova la decisione, non la scrittura: quando quel tetto stringe
// davvero, e quanto della biblioteca sta nel piano del cloud.
import {
  stretto,
  parteDelPiano,
  fetta,
  spartisci,
  PIANO,
  PIENO,
  QUOTA_PARTE,
  QUOTA_RESTO,
} from "../src/lib/spazio.js";

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

  // ---- DI COSA È FATTO IL GIGABYTE ---------------------------------------
  //
  // In Libreria si leggeva solo il totale, ed è il numero giusto — è l'unico
  // spazio che vincola davvero — ma non risponde alla domanda del lettore:
  // «quanto spazio ho ancora per caricare la mia musica». Libri e melodie
  // stanno nello STESSO secchio, e un totale non dice quale dei due lo sta
  // riempiendo.
  const secchio = (l, c, m) => ({
    libri: { quanti: 53, byte: l },
    copertine: { quanti: 41, byte: c },
    melodie: { quanti: 12, byte: m },
    totale: l + c + m,
  });
  {
    const s = spartisci(secchio(280 * M, 6 * M, 60 * M));
    // LE COPERTINE VANNO COI LIBRI. Contate a parte, o dimenticate, i tre
    // pezzi non tornerebbero più il piano e la barra avrebbe un buco che
    // nessun errore segnala: si vedrebbe solo guardandola bene.
    t.eq("la copertina pesa sul libro, non per conto suo", s.libri, 286 * M);
    t.eq("le melodie restano le melodie", s.melodie, 60 * M);
    t.eq("e il resto è quel che resta", s.liberi, PIANO - 346 * M);
    t.eq("sotto il piano non si è sforato niente", s.sforato, 0);
    // IL PATTO CHE TIENE IN PIEDI LA BARRA: le tre regioni disegnate fanno
    // il piano esatto. È questo che casca se qualcuno lascia indietro le
    // copertine — non un errore, un buco silenzioso nel disegno.
    t.eq("le tre regioni fanno il piano intero", s.libri + s.melodie + s.liberi, PIANO);
  }
  {
    // il secchio vuoto: tutto libero, e non «niente»
    const s = spartisci(secchio(0, 0, 0));
    t.eq("un secchio vuoto è tutto libero", s.liberi, PIANO);
    t.eq("e le tre regioni tornano lo stesso", s.libri + s.melodie + s.liberi, PIANO);
  }
  {
    // OLTRE IL PIANO NON SI SCRIVE «0 LIBERI», che è vero solo per modo di
    // dire: un numero fermo a zero nasconderebbe proprio la misura del guaio
    const s = spartisci(secchio(900 * M, 20 * M, 400 * M));
    t.eq("sforato, il libero è zero", s.liberi, 0);
    t.eq("e si dice di quanto", s.sforato, 320 * M);
  }
  {
    // IL RESTO SI PRENDE DAL TOTALE, NON DALLA SOMMA DEI DUE PEZZI, e la
    // differenza si vede solo quando i due divergono: `contaSpazio` fa il
    // totale pesando TUTTO quel che sta nel secchio, mentre i pezzi contano
    // solo i libri, le loro copertine e le melodie. Se lassù finisse una
    // terza specie di file, la somma dei pezzi non la vedrebbe e la barra
    // prometterebbe spazio che non c'è più.
    //
    // Senza questo caso la regola è solo scritta nel commento: nel secchio
    // ordinario il totale È la somma dei pezzi, quindi le due formule danno
    // lo stesso numero e una mutazione che le scambia passa indisturbata —
    // ed è successo, provando a romperlo apposta.
    const misto = { ...secchio(280 * M, 6 * M, 60 * M), totale: 500 * M };
    const s = spartisci(misto);
    t.eq("il libero segue il totale vero del secchio", s.liberi, PIANO - 500 * M);
    t.c("e non la somma dei due pezzi disegnati", s.liberi !== PIANO - 346 * M);
    // conseguenza voluta: la barra ha un buco largo quanto quel che c'è
    // lassù e non sappiamo nominare. È spazio davvero occupato, e mostrarlo
    // libero sarebbe la bugia peggiore delle due.
    t.c("il buco nella barra è quello spazio", s.libri + s.melodie + s.liberi < PIANO);
  }
  {
    // un conto che non c'è non si inventa
    t.eq("senza dati non c'è spartizione", spartisci(null), null);
    // e i pezzi mancanti valgono zero, mai NaN: un NaN dentro `fetta`
    // darebbe una barra larga zero senza che niente lo dica
    const s = spartisci({ totale: 5 * M });
    t.c("un pezzo mancante vale zero, non NaN", s.libri === 0 && s.melodie === 0 && Number.isFinite(s.liberi));
    t.c("e la barra resta disegnabile", /^\d/.test(fetta(s.libri)));
  }
}
