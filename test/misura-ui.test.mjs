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
} = await import("../src/data/constants.js");

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

  // ---- quel che si legge dallo storage ---------------------------------
  localStorage.removeItem("bc_ui_scala");
  t.eq("mai scelto: si parte da «Normale»", leggiScalaUI(), SCALA_DEFAULT);
  applicaScalaUI("piuGrande");
  t.eq("una scelta si ricorda", leggiScalaUI(), "piuGrande");
  localStorage.setItem("bc_ui_scala", "gigantesco");
  t.eq("un gradino che non esiste più torna al valore di partenza", leggiScalaUI(), SCALA_DEFAULT);

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
