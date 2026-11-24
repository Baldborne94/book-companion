// LEGGI AD ALTA VOCE NEI PDF (`testoDellaPagina`, `creaVoce` in
// `lib/vocePdf.js`). Sbaglia in silenzio: una pausa a ogni riga stampata,
// «ventitré» letto a ogni numero di pagina, la frase spezzata al bordo, la
// voce che resta sulla pagina vecchia dopo che il dito ha girato, o un PDF
// di sole scansioni sfogliato tutto in un secondo.
import { testoDellaPagina, creaVoce, VUOTE_MAX, linguaDelTesto } from "../src/lib/vocePdf.js";

// una riga di pdf.js: y dal basso, altezza del corpo, fine riga
const riga = (str, y, h = 10) => [{ str, transform: [1, 0, 0, 1, 50, y], height: h, hasEOL: false }, { str: "", hasEOL: true }];
const pagina = (...righe) => righe.flat();

// una sintesi finta: le frasi si dicono quando si chiama `finisci()`
function sintesiFinta() {
  const s = { dette: [], inCorso: null, cancellate: 0 };
  s.speak = (u) => {
    s.inCorso = u;
  };
  s.cancel = () => {
    s.cancellate += 1;
    s.inCorso = null;
  };
  s.getVoices = () => [{ lang: "it-IT", localService: true, name: "Italiana" }];
  s.finisci = async (n = 1) => {
    for (let k = 0; k < n && s.inCorso; k++) {
      const u = s.inCorso;
      s.dette.push(u.text);
      s.inCorso = null;
      u.onend?.();
      await new Promise((r) => setTimeout(r, 0));
    }
  };
  return s;
}
class Frase {
  constructor(text) {
    this.text = text;
  }
}
const pausa = () => new Promise((r) => setTimeout(r, 0));

export default async function (t) {
  // ---- il testo della pagina ------------------------------------------------------
  const p1 = pagina(
    riga("Capitolo primo", 700, 14),
    riga("Era una notte buia e tempe-", 670),
    riga("stosa. Il vento soffiava", 658),
    riga("sulle torri di Ankh-Morpork", 646),
    riga("23", 60)
  );
  const testo1 = testoDellaPagina(p1);
  t.eq("le righe di un paragrafo si uniscono, la parola spezzata si ricuce", testo1, "Capitolo primo\nEra una notte buia e tempestosa. Il vento soffiava sulle torri di Ankh-Morpork");
  t.c("il numero di pagina non si legge", !/23/.test(testo1));
  t.eq(
    "un trattino vero resta (maiuscola dopo)",
    testoDellaPagina(pagina(riga("il dio Anoia-", 600), riga("Morpork disse", 588))),
    "il dio Anoia- Morpork disse"
  );
  t.eq("una colonna nuova (la riga risale) va a capo", testoDellaPagina(pagina(riga("fine colonna.", 100), riga("Inizio colonna", 700))), "fine colonna.\nInizio colonna");
  t.eq("niente pezzi, niente testo", testoDellaPagina([]), "");
  // un libro con l'interlinea larga: il passo e' della pagina, non del corpo
  t.eq(
    "interlinea larga: le righe di un paragrafo restano unite",
    testoDellaPagina(pagina(riga("una riga", 700), riga("e la dopo", 680), riga("e un'altra.", 660), riga("Nuovo paragrafo", 620))),
    "una riga e la dopo e un'altra.\nNuovo paragrafo"
  );
  t.eq(
    "un titolo a passo normale ma con un altro corpo va a capo",
    testoDellaPagina(pagina(riga("Capitolo primo", 700, 16), riga("La nebbia saliva", 688), riga("dal fiume.", 676))),
    "Capitolo primo\nLa nebbia saliva dal fiume."
  );

  t.eq(
    "il passo tipico e' quello di mezzo, non il salto che capita in mezzo",
    testoDellaPagina(pagina(riga("a", 700), riga("b", 688), riga("c", 648), riga("d", 636))),
    "a b\nc d"
  );

  // ---- la lingua dal testo --------------------------------------------------------------
  const italiano = "Era una notte buia e tempestosa, e il vento che soffiava sulle torri della città non smetteva di urlare per le strade del porto come un cane";
  const inglese = "It was a dark and stormy night, and the wind that was blowing over the towers of the city did not stop howling in the streets of the port like a dog";
  t.eq("italiano", linguaDelTesto(italiano), "it");
  t.eq("inglese", linguaDelTesto(inglese), "en");
  t.eq("poche parole non decidono", linguaDelTesto("Capitolo primo"), "");
  t.eq("mezzo e mezzo non decide", linguaDelTesto(`${italiano} ${inglese}`), "");
  t.eq("cinque parole comuni non bastano", linguaDelTesto("e il che non di"), "");
  const nomi = Array.from({ length: 40 }, (_, i) => `Nome${String.fromCharCode(97 + (i % 26))}`).join(" ");
  t.eq("un elenco di nomi con due «the» non e' inglese", linguaDelTesto(`${nomi} the the`), "");

  // ---- la voce che legge e gira pagina ------------------------------------------------
  const libro = {
    1: "Prima frase. Seconda frase che continua",
    2: "sulla pagina dopo. Terza.",
    3: "Ultima pagina senza punto",
  };
  const s = sintesiFinta();
  const girate = [];
  const stati = [];
  const avvisi = [];
  const sotto = [];
  const lette = [];
  const voce = creaVoce({
    sintesi: s,
    Frase,
    testo: async (n) => {
      lette.push(n);
      return libro[n] ?? "";
    },
    gira: (n) => {
      girate.push(n);
      // come React: la pagina nuova arriva a `vista` dopo un disegno
      setTimeout(() => voce.vista(n), 0);
    },
    pagine: () => 3,
    lingua: () => "it",
    cambia: (x) => stati.push(x),
    avvisa: (m) => avvisi.push(m),
    sottovoce: (si) => sotto.push(si),
  });
  voce.comincia(1);
  await pausa();
  t.eq("la voce e' quella della lingua del libro", s.inCorso?.voice?.name, "Italiana");

  // il PDF dichiara inglese (Chrome lo scrive sotto ogni cosa), il testo e' italiano
  const s1b = sintesiFinta();
  const v1b = creaVoce({ sintesi: s1b, Frase, testo: async () => `${italiano}.`, gira: () => {}, pagine: () => 1, lingua: () => "en-US" });
  v1b.comincia(1);
  await pausa();
  t.eq("vince la lingua del testo", `${s1b.inCorso?.lang}:${s1b.inCorso?.voice?.name}`, "it:Italiana");
  // …e resta su una pagina di poche parole
  const s1c = sintesiFinta();
  const v1c = creaVoce({ sintesi: s1c, Frase, testo: async (n) => (n === 1 ? `${italiano}.` : "Fine."), gira: () => {}, pagine: () => 2, lingua: () => "en-US" });
  v1c.comincia(1);
  await pausa();
  await s1c.finisci(1);
  await pausa();
  t.eq("la lingua resta su una pagina di poche parole", `${s1c.inCorso?.text}:${s1c.inCorso?.lang}`, "Fine.:it");
  await s.finisci(1);
  t.eq("la frase che scavalca il bordo aspetta la pagina dopo: gira", girate.join(), "2");
  await pausa();
  t.eq("…e si legge intera", s.inCorso?.text, "Seconda frase che continua sulla pagina dopo.");
  await s.finisci(2);
  await pausa();
  t.eq("l'ultima pagina si legge anche senza punto", s.inCorso?.text, "Ultima pagina senza punto");
  await s.finisci(1);
  t.eq("in fondo al libro si ferma e lo dice", avvisi.at(-1), "📖 Fine del libro");
  t.eq("la musica si abbassa e si rialza", sotto.join(), "true,false");
  t.eq("e lo stato torna zitto", voce.stato, null);
  t.eq("ogni pagina si legge una volta sola", lette.join(), "1,2,3");

  // ---- il dito gira pagina: la voce riparte da li' ----------------------------------------
  const s2 = sintesiFinta();
  const v2 = creaVoce({ sintesi: s2, Frase, testo: async (n) => libro[n] ?? "", gira: () => {}, pagine: () => 3 });
  v2.comincia(1);
  await pausa();
  v2.vista(3);
  await pausa();
  t.eq("pagina girata a mano: si legge quella", s2.inCorso?.text, "Ultima pagina senza punto");
  t.c("…e la frase vecchia e' stata zittita", s2.cancellate >= 2);

  // una pagina senza testo in mezzo passa in un lampo: la sua voltata
  // arriva quando la voce legge gia' quella dopo, e non e' il dito
  const s2c = sintesiFinta();
  const lette2c = [];
  const conFigura = { 1: "Prima.", 2: "", 3: "Dopo la figura." };
  const v2c = creaVoce({
    sintesi: s2c,
    Frase,
    testo: async (n) => (lette2c.push(n), conFigura[n]),
    gira: (n) => setTimeout(() => v2c.vista(n), 0),
    pagine: () => 3,
  });
  v2c.comincia(1);
  await pausa();
  await s2c.finisci(1);
  await new Promise((r) => setTimeout(r, 10));
  t.eq("la pagina della figura non fa ricominciare", lette2c.join(), "1,2,3");
  t.eq("…e si legge quella dopo", s2c.inCorso?.text, "Dopo la figura.");

  // React unisce due voltate: la 2 non arriva, la 3 si'. Poi il dito torna
  // alla 2, e quella e' una voltata vera
  const s2d = sintesiFinta();
  let consegna = [];
  const v2d = creaVoce({ sintesi: s2d, Frase, testo: async (n) => conFigura[n], gira: (n) => consegna.push(n), pagine: () => 3 });
  v2d.comincia(1);
  await pausa();
  await s2d.finisci(1);
  await pausa();
  v2d.vista(consegna.at(-1));
  v2d.vista(2);
  await pausa();
  t.eq("dopo voltate unite, il dito che torna indietro si ascolta: dalla 2 (muta) la voce rigira alla 3", consegna.join(), "2,3,3");
  t.eq("…e legge quella", s2d.inCorso?.text, "Dopo la figura.");

  // una voltata della voce che non arriva non deve rubare quella del dito:
  // voce alla 2, il dito torna alla 1 e poi rigira alla 2
  const s2e = sintesiFinta();
  const v2e = creaVoce({ sintesi: s2e, Frase, testo: async (n) => libro[n] ?? "", gira: () => {}, pagine: () => 3 });
  v2e.comincia(1);
  await pausa();
  await s2e.finisci(1);
  await pausa();
  v2e.vista(1);
  await pausa();
  v2e.vista(2);
  await pausa();
  t.eq("il dito che rigira alla pagina della voce si ascolta", s2e.inCorso?.text, "sulla pagina dopo.");

  // …e nemmeno dopo una fermata: voce alla 2, «smetti», si ricomincia dalla
  // 1 e il dito gira alla 2
  const s2f = sintesiFinta();
  const v2f = creaVoce({ sintesi: s2f, Frase, testo: async (n) => libro[n] ?? "", gira: () => {}, pagine: () => 3 });
  v2f.comincia(1);
  await pausa();
  await s2f.finisci(1);
  await pausa();
  v2f.taci();
  v2f.comincia(1);
  await pausa();
  v2f.vista(2);
  await pausa();
  t.eq("dopo una fermata la voltata vecchia non conta piu'", s2f.inCorso?.text, "sulla pagina dopo.");

  // il dito che gira mentre il testo della pagina scende ancora (da Drive
  // una pagina puo' metterci): vince la pagina a schermo
  const s2b = sintesiFinta();
  const lenta = (n) => new Promise((r) => setTimeout(() => r(libro[n] ?? ""), n === 1 ? 20 : 0));
  const v2b = creaVoce({ sintesi: s2b, Frase, testo: lenta, gira: () => {}, pagine: () => 3 });
  v2b.comincia(1);
  v2b.vista(3);
  await new Promise((r) => setTimeout(r, 40));
  t.eq("il testo arrivato tardi della pagina lasciata non si legge", s2b.inCorso?.text, "Ultima pagina senza punto");

  // ---- pausa e ripresa dalla frase ----------------------------------------------------------
  const s3 = sintesiFinta();
  const v3 = creaVoce({ sintesi: s3, Frase, testo: async (n) => libro[n] ?? "", gira: () => {}, pagine: () => 3 });
  v3.comincia(2);
  await pausa();
  await s3.finisci(1);
  v3.pausa();
  v3.comincia(2);
  t.eq("ripresa dalla frase in cui si era", s3.inCorso?.text, "Terza.");

  // ---- un PDF di scansioni --------------------------------------------------------------------
  const s4 = sintesiFinta();
  const girate4 = [];
  const avvisi4 = [];
  const v4 = creaVoce({
    sintesi: s4,
    Frase,
    testo: async () => "",
    gira: (n) => {
      girate4.push(n);
      queueMicrotask(() => v4.vista(n));
    },
    pagine: () => 400,
    avvisa: (m) => avvisi4.push(m),
  });
  v4.comincia(1);
  for (let k = 0; k < 10; k++) await pausa();
  t.eq(`dopo ${VUOTE_MAX} pagine mute si ferma`, girate4.length, VUOTE_MAX - 1);
  t.c("…e dice perche'", /immagini/.test(avvisi4.at(-1) || ""));

  // ---- chiudere il libro zittisce ---------------------------------------------------------------
  const s5 = sintesiFinta();
  const sotto5 = [];
  const v5 = creaVoce({ sintesi: s5, Frase, testo: async (n) => libro[n] ?? "", gira: () => {}, pagine: () => 3, sottovoce: (si) => sotto5.push(si) });
  v5.comincia(1);
  await pausa();
  const u = s5.inCorso;
  v5.chiudi();
  u.onend();
  await pausa();
  t.eq("a libro chiuso la frase finita non ne fa partire un'altra", s5.inCorso, null);
  t.eq("…e la musica torna su", sotto5.join(), "true,false");
}
