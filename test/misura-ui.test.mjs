// LA MISURA DELL'INTERFACCIA, E IL PATTO CHE LA SCALA NON PERDA MAI.
//
// `scala.test.mjs` difende la scala a grandezza naturale: otto gradini che
// salgono, tutti interi, nessuno a meno di un punto dal precedente. La
// levetta della dimensione moltiplica quegli otto numeri, e un fattore
// sbagliato NON alza nessun errore: arrotonda due gradini sullo stesso
// valore, e a quella misura — e solo a quella — la gerarchia sparisce. Il
// titolo di un pannello e l'intestazione di un gruppo diventano la stessa
// cosa, e chi guarda vede un'app leggermente sciatta senza sapere perche'.
//
// Quindi il patto di `scala.test.mjs` si rifa' qui a OGNI gradino della
// levetta, non solo a grandezza naturale.

const memoria = {};
for (const [nome, fn] of Object.entries({
  getItem: (k) => (k in memoria ? memoria[k] : null),
  setItem: (k, v) => {
    memoria[k] = String(v);
  },
  removeItem: (k) => {
    delete memoria[k];
  },
})) {
  Object.defineProperty(memoria, nome, { value: fn, enumerable: false });
}
globalThis.localStorage = memoria;

const {
  F, R, SCALE_UI, SCALA_DEFAULT, scalaDi, leggiScalaUI, applicaScalaUI, corpoAlFattore, px,
  misuraConsigliata, risolviScala, AUTO,
} = await import("../src/data/constants.js");

// I dispositivi veri contro cui si misura la regola. Il lato lungo è in px
// CSS come lo dichiara `screen`, il `dpr` è quello che il costruttore ha
// scelto. Il tablet del lettore è il primo: 1280×800 a densità 1, cioè un
// pannello da ~150 punti per pollice su cui la compensazione non è stata
// fatta — ed è esattamente lì che l'app si legge in miniatura.
const TABLET_LETTORE = { lato: 1280, dpr: 1, dito: true };
const IPAD = { lato: 1024, dpr: 2, dito: true };
const IPAD_PRO = { lato: 1366, dpr: 2, dito: true };
const TELEFONO = { lato: 852, dpr: 3, dito: true };
const COMPUTER = { lato: 1920, dpr: 1, dito: false };

// i valori a grandezza naturale, presi PRIMA di toccare qualunque cosa:
// sono il metro contro cui si misura tutto il resto
const BASE_F = { ...F };
const BASE_R = { ...R };

export default async function (t) {
  // ---- la scala resta una scala a OGNI gradino della levetta ------------
  for (const s of SCALE_UI) {
    applicaScalaUI(s.id);
    const corpi = Object.values(F);
    t.c(
      `«${s.label}»: i corpi salgono e basta`,
      corpi.every((v, i) => i === 0 || v > corpi[i - 1]),
      corpi.join(" ")
    );
    t.c(`«${s.label}»: nessun gradino doppio`, new Set(corpi).size === corpi.length, corpi.join(" "));
    t.c(`«${s.label}»: e nessun mezzo punto`, corpi.every(Number.isInteger), corpi.join(" "));
    t.c(
      `«${s.label}»: ogni gradino si distingue dal precedente`,
      corpi.every((v, i) => i === 0 || v - corpi[i - 1] >= 1),
      corpi.join(" ")
    );
    const raggi = Object.values(R);
    t.c(`«${s.label}»: i raggi salgono`, raggi.every((v, i) => i === 0 || v > raggi[i - 1]), raggi.join(" "));
    t.c(`«${s.label}»: e finiscono col tondo`, raggi[raggi.length - 1] >= 999);
  }

  // ---- e cresce davvero, o la levetta sarebbe una decorazione -----------
  //
  // Il gradino più grande deve dare numeri PIÙ GRANDI di quello normale:
  // senza questo, un fattore rotto (tutti 1) passerebbe ogni controllo qui
  // sopra a bandiere spiegate — la scala resterebbe perfetta e la levetta
  // non muoverebbe niente.
  applicaScalaUI("normale");
  const normale = { ...F };
  applicaScalaUI("enorme");
  t.c(
    "il gradino più grande scrive più grande, in ogni corpo",
    Object.keys(F).every((k) => F[k] > normale[k]),
    Object.keys(F)
      .map((k) => `${k} ${normale[k]}→${F[k]}`)
      .join(" · ")
  );

  // ---- IL TONDO NON È UNA MISURA ---------------------------------------
  // 999 vuol dire «pastiglia», non «999 pixel». Scalarlo darebbe un numero
  // più grosso e nessuna differenza a vedersi: un valore che sembra vivo e
  // non lo è.
  t.eq("il tondo resta il tondo anche a misura grande", R.tondo, BASE_R.tondo);
  t.c("mentre gli altri raggi crescono", R.medio > BASE_R.medio, `${BASE_R.medio}→${R.medio}`);

  // ---- SI MOLTIPLICA LA BASE, MAI IL VALORE IN VIGORE -------------------
  //
  // È la trappola vera di questo file, ed è silenziosa per un giro intero:
  // moltiplicando `F[k]` invece di `SCALA_BASE[k]`, il primo cambio di
  // misura sembra perfetto e il secondo compone col primo. Chi passa da
  // «Normale» a «Grande» e poi a «Molto grande» si ritroverebbe corpi da
  // titolo dappertutto, e tornando a «Normale» NON tornerebbe indietro.
  applicaScalaUI("grande");
  applicaScalaUI("enorme");
  applicaScalaUI("normale");
  t.c(
    "tornando a «Normale» si torna esattamente ai valori di partenza",
    Object.keys(BASE_F).every((k) => F[k] === BASE_F[k]),
    Object.keys(BASE_F)
      .filter((k) => F[k] !== BASE_F[k])
      .map((k) => `${k}: ${BASE_F[k]}→${F[k]}`)
      .join(" · ")
  );
  applicaScalaUI("grande");
  const grandeUnaVolta = { ...F };
  applicaScalaUI("grande");
  t.c(
    "e lo stesso gradino applicato due volte non compone",
    Object.keys(F).every((k) => F[k] === grandeUnaVolta[k]),
    Object.keys(F)
      .filter((k) => F[k] !== grandeUnaVolta[k])
      .join(" ")
  );

  // ---- l'anteprima dei tasti non guarda la misura in vigore -------------
  // Ogni tasto della levetta si scrive nella misura che OFFRE: se leggesse
  // la scala viva, i quattro tasti sarebbero tutti della stessa misura e la
  // scelta tornerebbe a indovinello.
  applicaScalaUI("enorme");
  const aEnorme = SCALE_UI.map((s) => corpoAlFattore(s.fattore));
  applicaScalaUI("normale");
  const aNormale = SCALE_UI.map((s) => corpoAlFattore(s.fattore));
  t.c(
    "l'anteprima di un gradino è la stessa qualunque misura sia in vigore",
    aEnorme.join() === aNormale.join(),
    `${aEnorme.join()} contro ${aNormale.join()}`
  );
  t.c(
    "e i quattro tasti si scrivono di quattro misure diverse",
    new Set(aNormale).size === SCALE_UI.length,
    aNormale.join(" ")
  );

  // ---- `px`: le misure che non sono corpi ------------------------------
  //
  // È l'ESATTO CONTRARIO di `corpoAlFattore`: quella deve ignorare la misura
  // in vigore (è l'anteprima di un altro gradino), questa deve seguirla. Se
  // `px` leggesse la base, la barra in basso resterebbe alta 40 mentre la
  // sua scritta arriva a 26px, coi glifi fermi a 20 — cioè esattamente il
  // difetto fotografato a due volte la scala.
  applicaScalaUI("normale");
  t.eq("a grandezza naturale `px` non tocca niente", px(40), 40);
  t.eq("nemmeno i numeri dispari", px(27), 27);
  applicaScalaUI("massima");
  t.eq("al massimo la barra raddoppia", px(40), 80);
  // L'INTERO SI CONTROLLA DOVE IL CONTO NON TORNA GIÀ DA SÉ. A due volte
  // ogni misura è intera per conto suo, e il controllo passerebbe anche
  // senza arrotondare — cioè non proverebbe niente (mutazione provata: a
  // «massima» sopravviveva). 27 × 1,75 fa 47,25, e lì si vede.
  applicaScalaUI("gigante");
  t.c("e torna sempre un intero, anche dove il conto non torna", Number.isInteger(px(27)), String(px(27)));
  applicaScalaUI("grande");
  t.eq("e a ogni gradino segue il fattore", px(40), Math.round(40 * scalaDi("grande").fattore));

  // il glifo della barra non deve mai restare indietro rispetto alla scritta
  // che gli sta accanto: e' quello il sintomo che si vede in fotografia
  for (const s of SCALE_UI) {
    applicaScalaUI(s.id);
    t.c(
      `«${s.label}»: la scatola del glifo resta più alta della scritta accanto`,
      px(27) >= F.piccolo,
      `scatola ${px(27)} contro scritta ${F.piccolo}`
    );
    t.c(
      `«${s.label}»: e la barra contiene la sua scatola`,
      px(40) > px(27),
      `barra ${px(40)} contro scatola ${px(27)}`
    );
  }

  // ---- la misura scelta dallo schermo ----------------------------------
  //
  // Il browser non sa quanto è grande fisicamente il suo schermo: `in` e
  // `mm` in CSS sono definiti come 96px per pollice, cioè sono px
  // travestiti. L'unico segnale onesto è la compensazione del costruttore,
  // e la regola sta in piedi o cade su questi cinque dispositivi.
  t.eq(
    "il tablet del lettore (1280 a densità 1) chiede di ingrandire",
    misuraConsigliata(TABLET_LETTORE),
    "piuGrande"
  );
  // I due iPad sono la prova che serve DAVVERO, e sono il motivo per cui non
  // basta guardare quanti px CSS ci sono sul lato lungo: l'iPad Pro ne ha
  // PIÙ del tablet del lettore (1366 contro 1280) ed è comodissimo così,
  // perché quei px sono fitti e il costruttore l'ha dichiarato. Senza la
  // guardia sul `dpr`, la regola gli gonfierebbe il testo del 30%.
  t.eq("l'iPad è già tarato bene e non si tocca", misuraConsigliata(IPAD), SCALA_DEFAULT);
  t.eq(
    "e nemmeno l'iPad Pro, che di px CSS ne ha più del tablet del lettore",
    misuraConsigliata(IPAD_PRO),
    SCALA_DEFAULT
  );
  t.eq("un telefono resta a grandezza naturale", misuraConsigliata(TELEFONO), SCALA_DEFAULT);
  // su un computer una finestra larga non dice niente della densità, e da un
  // metro di distanza la misura di partenza va bene: non si tocca niente
  t.eq("un computer non si scala, per quanto larga sia la finestra", misuraConsigliata(COMPUTER), SCALA_DEFAULT);

  // NON SI RIMPICCIOLISCE MAI DA SOLI. Qui il controllo passa perché la
  // scala parte da 1, non perché `misuraConsigliata` si difenda: una guardia
  // c'era, e romperla non faceva fallire niente — codice morto travestito da
  // guardia, tolto. Il controllo resta, e diventerà quello che serve il
  // giorno che qualcuno aggiunge un gradino sotto la grandezza naturale.
  t.eq(
    "uno schermo piccolo non fa rimpicciolire l'app",
    misuraConsigliata({ lato: 640, dpr: 1, dito: true }),
    SCALA_DEFAULT
  );
  t.c(
    "e infatti nella scala non c'è nessun gradino sotto la grandezza naturale",
    SCALE_UI.every((s) => s.fattore >= 1),
    SCALE_UI.map((s) => s.fattore).join(" ")
  );
  // e quel che il browser non sa dire non diventa mai un `NaN` addosso a uno
  // stile: lì il testo sparirebbe senza che nessun errore lo dica
  for (const [nome, d] of [
    ["senza dati", undefined],
    ["schermo muto", { lato: 0, dpr: 1, dito: true }],
    ["lato non numerico", { lato: "boh", dpr: 1, dito: true }],
  ]) {
    const id = misuraConsigliata(d);
    t.c(`${nome}: si ripiega su un gradino vero`, SCALE_UI.some((s) => s.id === id), String(id));
  }

  // ---- «Automatica» è una SCELTA, non un gradino -----------------------
  //
  // La trappola: scrivendo nello storage il gradino RISOLTO invece della
  // scelta, «Automatica» durerebbe fino al primo riavvio e poi resterebbe
  // congelata sul numero di allora — cioè smetterebbe di essere automatica
  // proprio quando cambi dispositivo, che è l'unico momento in cui serviva.
  applicaScalaUI(AUTO, TABLET_LETTORE);
  t.eq("la scelta che si ricorda è «Automatica», non il gradino risolto", leggiScalaUI(), AUTO);
  t.eq("ma i corpi sono quelli del gradino risolto", F.corpo, corpoAlFattore(scalaDi("piuGrande").fattore));
  t.eq("e si risolve di nuovo a ogni giro, sul dispositivo di adesso", risolviScala(AUTO, IPAD), SCALA_DEFAULT);
  t.eq("un gradino scelto a mano si risolve in se stesso", risolviScala("enorme", TABLET_LETTORE), "enorme");
  // lo stesso storage riletto su un altro dispositivo dà un'altra misura:
  // è tutto il punto di «Automatica»
  applicaScalaUI(leggiScalaUI(), TELEFONO);
  t.eq("sullo stesso profilo, un telefono torna a grandezza naturale", F.corpo, corpoAlFattore(1));
  t.eq("e la scelta resta «Automatica»", leggiScalaUI(), AUTO);

  // ---- quel che si legge dallo storage ---------------------------------
  // CHI NON HA MAI SCELTO PARTE DA «AUTOMATICA»: è la richiesta presa alla
  // lettera. Lasciarla come un'opzione da scovare nel pannello vorrebbe dire
  // che il tablet dove serve continua a mostrare l'app in miniatura finché
  // non la si trova — cioè il difetto di partenza, con in più un rimedio
  // nascosto.
  localStorage.removeItem("bc_ui_scala");
  t.eq("mai scelto: si parte da «Automatica»", leggiScalaUI(), AUTO);
  applicaScalaUI("piuGrande");
  t.eq("una scelta a mano si ricorda", leggiScalaUI(), "piuGrande");
  t.c("e non viene sopraffatta dall'automatica", leggiScalaUI() !== AUTO);
  localStorage.setItem("bc_ui_scala", "gigantesco");
  t.eq("un gradino che non esiste più ricade sull'automatica", leggiScalaUI(), AUTO);

  // un id sconosciuto non deve far esplodere niente: `scalaDi` ripiega sul
  // primo gradino, o `s.fattore` sarebbe `undefined` e ogni corpo `NaN` —
  // e un `NaN` dentro uno stile in linea non è un errore, è testo che
  // sparisce senza che nessuno lo dica
  t.eq("un id sconosciuto ripiega sul primo gradino", scalaDi("boh").id, SCALE_UI[0].id);
  applicaScalaUI("boh");
  t.c(
    "e applicarlo lascia numeri veri, non NaN",
    Object.values(F).every(Number.isFinite) && Object.values(R).every(Number.isFinite),
    Object.values(F).join(" ")
  );

  applicaScalaUI(SCALA_DEFAULT);
}
