export const THEMES = {
  night: {
    id: "night",
    label: "Biblioteca Magica",
    hint: "Notte profonda, candele e polvere di stelle",
    tagline: "La tua biblioteca, di notte",
    colors: {
      bg: "#0f0d1a",
      surface: "#151226",
      card: "#1c1730",
      border: "#332a4f",
      accent: "#d9a94e",
      accentDeep: "#b8893a",
      onAccent: "#241c0a",
      arcane: "#9b7fd4",
      text: "#e2dac9",
      muted: "#948aad",
      dim: "#3a3354",
      green: "#5fae7e",
      red: "#b25050",
    },
    gradient:
      "radial-gradient(ellipse 120% 80% at 50% 0%, #1a1530 0%, #0f0d1a 55%, #0b0914 100%)",
    motes: { char: "✦", anim: "bc-rise", size: [7, 13], from: "bottom" },
    decor: null,
  },
  grove: {
    id: "grove",
    label: "Rifugio Silvano",
    hint: "Un'antica biblioteca tra le fronde, in pace",
    tagline: "La tua biblioteca, tra le fronde",
    colors: {
      bg: "#12170e",
      surface: "#1a2114",
      card: "#212a19",
      border: "#3c4b31",
      accent: "#dcb45f",
      accentDeep: "#bb9247",
      onAccent: "#251d0c",
      arcane: "#84b16b",
      text: "#ece5cf",
      muted: "#a5ae93",
      dim: "#3e4b34",
      green: "#8bc48d",
      red: "#c2705a",
    },
    gradient:
      "radial-gradient(ellipse 85% 45% at 50% -14%, #3b4726 0%, #26301a 38%, #171d10 68%, #0d1109 100%)",
    motes: { char: "🍃", anim: "bc-drift", size: [9, 16], from: "top" },
    decor: "foliage",
  },
  citadel: {
    id: "citadel",
    label: "Archivio della Cittadella",
    hint: "Sale di pietra, pergamene e oro di candela",
    tagline: "La tua biblioteca, tra le pergamene",
    colors: {
      bg: "#141210",
      surface: "#1e1a15",
      card: "#26201a",
      border: "#4a3d2c",
      accent: "#e3bd76",
      accentDeep: "#c19959",
      onAccent: "#261f0f",
      arcane: "#b6bcc6",
      text: "#f0e7d3",
      muted: "#a99a80",
      dim: "#443a2b",
      green: "#7fae72",
      red: "#c2684e",
    },
    gradient:
      "radial-gradient(ellipse 95% 55% at 50% -8%, #3a2e20 0%, #251e15 42%, #17130e 74%, #100d09 100%)",
    motes: { char: "·", anim: "bc-motes", size: [13, 24], from: "bottom" },
    decor: "scrolls",
  },
};

export const DEFAULT_THEME = "night";

// Palette viva: i componenti leggono C al render, quindi mutarla e
// ridisegnare l'albero basta per cambiare tema senza un context.
export const C = { ...THEMES[DEFAULT_THEME].colors };

// Il tema vivo per intero — serve a chi ha bisogno di qualcosa che un
// colore non e', tipo lo SFONDO A GRADIENTE. Prima ogni pannello a tutto
// schermo se lo ridisegnava a mano coi viola della notte, e sugli altri
// due temi ci si ritrovava un alone viola in mezzo al verde.
export const TEMA = { ...THEMES[DEFAULT_THEME] };

// Il colore di fondo si ricorda anche fuori da React: `index.html` lo
// rilegge PRIMA che il bundle parta, o a ogni avvio a freddo comparirebbe
// un lampo del tema di default sotto quello scelto.
const BG_KEY = "bc_bg";

export function applyAppTheme(id) {
  const t = THEMES[id] || THEMES[DEFAULT_THEME];
  Object.assign(C, t.colors);
  Object.assign(TEMA, t);
  if (typeof document !== "undefined") {
    const root = document.documentElement;
    root.style.setProperty("--bc-bg", t.colors.bg);
    // l'accento serve al CSS per l'anello del fuoco, che inline non si puo'
    // scrivere: `:focus-visible` non esiste come stile in linea
    root.style.setProperty("--bc-accent", t.colors.accent);
    document.body.style.color = t.colors.text;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", t.colors.bg);
    try {
      localStorage.setItem(BG_KEY, t.colors.bg);
    } catch {
      /* niente localStorage: al prossimo avvio il lampo torna, e basta */
    }
  }
  return t;
}

export const FONT_TITLE = '"Cormorant Garamond", Georgia, serif';
export const FONT_BODY = '"EB Garamond", Georgia, serif';

// LA SCALA. Prima c'erano ventisette corpi diversi — 12,5 · 13 · 13,5 · 14
// · 14,5 · 15, sei gradini in due punti e mezzo — e tredici raggi. Nessuno
// di quei mezzi punti comunicava una gerarchia: comunicavano che ogni
// componente aveva scelto per conto suo, e la differenza si vede quando ne
// metti due schermate accanto.
//
// Otto gradini, ognuno con un mestiere. Il valore in se' conta meno del
// fatto che sia UNO SOLO: adesso ritoccare tutta l'app e' cambiare un
// numero qui, non rincorrerne duecento nei file.
// I gradini a grandezza naturale. Restano il metro: la levetta della
// dimensione li moltiplica, non li riscrive, cosi' la gerarchia fra un
// gradino e l'altro e' la stessa a ogni misura.
const SCALA_BASE = {
  minuscolo: 12, // conteggi e nuvolette sulle copertine
  piccolo: 13, // etichette dei campi, righe di servizio
  nota: 14, // testo secondario: date, autori, spiegazioni sotto
  corpo: 15, // il testo dell'interfaccia, tasti e campi
  rilievo: 17, // le voci che devono staccarsi dal resto
  titoletto: 19, // intestazioni di gruppo
  titolo: 22, // titoli di pannello
  grande: 27, // i titoli grossi delle schermate vuote
};

// Scala viva, come `C`: i componenti la leggono al render, quindi mutarla
// e ridisegnare basta a cambiare misura senza un context.
export const F = { ...SCALA_BASE };

// Stessa storia per gli angoli: quattro raggi piu' il tondo.
const RAGGI_BASE = {
  minimo: 3, // barrette di avanzamento e segni sottili
  piccolo: 10, // tasti e campi
  medio: 14, // schede e riquadri
  grande: 18, // i pannelli che si aprono sopra tutto
  tondo: 999, // pastiglie
};

export const R = { ...RAGGI_BASE };

// ---------------------------------------------------------------------------
// QUANTO E' GRANDE L'INTERFACCIA.
//
// Tutti i corpi sono in pixel fissi e non hanno mai guardato lo schermo. Su
// un tablet dove un pixel CSS e' un pixel VERO — densita' 1, che sui tablet
// da 1280×800 e' la norma — quei 15px sono fisicamente la meta' di quanto
// sarebbero su uno schermo a densita' doppia, e l'app si legge piccola
// (segnalato dal lettore: «come mai e' piu' piccolo rispetto a prima?»).
// Il libro una levetta ce l'aveva gia'; tutto il resto dell'app no.
//
// SI MOLTIPLICA LA SCALA, NON SI ZOOMA LA PAGINA. Un `zoom` sul guscio
// prenderebbe anche le copertine e le spaziature — sarebbe piu' completo —
// ma andrebbe a toccare `100dvh`, i pannelli in `position: fixed` e
// soprattutto il reader, dove epub.js misura il riquadro in pixel e ci
// costruisce le colonne, l'avanzo di riga e il ritaglio. Quella e' proprio
// la macchina che non si puo' provare da qui, perche' il motore del lettore
// e' Gecko e qui c'e' solo Chromium. Numeri diversi invece si comportano
// allo stesso modo su ogni motore: e' la strada che si puo' garantire.
// Prezzo dichiarato: cresce la scrittura, non le copertine.
export const SCALE_UI = [
  { id: "normale", label: "Normale", fattore: 1 },
  { id: "grande", label: "Grande", fattore: 1.15 },
  { id: "piuGrande", label: "Più grande", fattore: 1.3 },
  { id: "enorme", label: "Molto grande", fattore: 1.5 },
  // I DUE DI SOPRA SONO ARRIVATI DOPO, chiesti dal lettore («permettimi di
  // ingrandire di piu'»): sul suo tablet a densita' 1 nemmeno una volta e
  // mezzo bastava. Gli id e i fattori dei quattro di prima NON si toccano —
  // cambiare il significato di `enorme` sposterebbe sotto i piedi la misura
  // gia' scelta da chi l'aveva messa, senza che nessuno gliel'abbia chiesto.
  { id: "gigante", label: "Enorme", fattore: 1.75 },
  { id: "massima", label: "Massima", fattore: 2 },
];

// Il gradino di ripiego: quello che si usa quando non c'e' niente da
// adattare, o quando il browser non sa dire niente del suo schermo.
export const SCALA_DEFAULT = "normale";

// ---------------------------------------------------------------------------
// LA MISURA SCELTA DALLO SCHERMO.
//
// Chiesto dal lettore: «non riesci a farlo adattare in automatico?». Si puo',
// ma va detto fino a dove arriva, perche' la domanda a cui servirebbe
// rispondere — «quanto e' GRANDE questo testo in millimetri?» — il browser
// non la sa. Le unita' fisiche del CSS non aiutano: `in` e `mm` sono definiti
// per specifica come 96px per pollice, cioe' sono px travestiti. Nessuna API
// dice i pollici dello schermo.
//
// L'UNICO SEGNALE ONESTO E' LA COMPENSAZIONE DEL COSTRUTTORE. Il rapporto fra
// pixel del dispositivo e pixel CSS (`devicePixelRatio`) esiste apposta per
// tenere il px CSS a una misura fisica piu' o meno costante: su un pannello
// fitto il costruttore dichiara 2 o 3, e il testo torna della misura giusta.
// I tablet economici saltano quel passo — dichiarano 1 su un pannello da 150
// punti per pollice — ed e' esattamente li' che il px CSS viene fuori piccolo
// e l'app si legge in miniatura. Quindi:
//
//   · dispositivo non a dito (un computer): non si tocca niente. Una finestra
//     larga non dice niente della densita', e da un metro di distanza la
//     misura di partenza va bene.
//   · `dpr` da 1,5 in su: il costruttore ha gia' fatto il suo lavoro, e
//     rifarlo noi raddoppierebbe la correzione. Fuori i tablet grandi ben
//     tarati, che sul lato lungo di px CSS ne hanno tanti ma fitti.
//   · `dpr` 1 a dito: la compensazione non c'e', e quanto manca si legge da
//     quanti px CSS stanno sul lato lungo.
//
// IL LATO LUNGO E' QUELLO DELLO SCHERMO, NON DELLA FINESTRA: ruotando il
// tablet la densita' non cambia di un capello, e misurare la finestra
// rimpicciolirebbe il testo in verticale senza nessuna ragione fisica.
//
// 1024 e' il riferimento perche' e' il lato lungo del tablet tarato bene di
// sempre: li' la scala a grandezza naturale si legge come e' stata disegnata.
const LATO_RIFERIMENTO = 1024;
const DPR_COMPENSATO = 1.5;

export const AUTO = "auto";

// Pura, e con tutto quel che le serve passato da fuori: cosi' un test la
// interroga su un tablet che non c'e', che e' l'unico modo di provare una
// regola che parla di dispositivi diversi da quello su cui gira.
export function misuraConsigliata({ lato, dpr = 1, dito = true } = {}) {
  const l = Number(lato);
  if (!dito || !Number.isFinite(l) || l <= 0) return SCALA_DEFAULT;
  if (Number(dpr) >= DPR_COMPENSATO) return SCALA_DEFAULT;
  const ideale = l / LATO_RIFERIMENTO;
  // Il gradino piu' vicino. Sotto la grandezza naturale non si scende mai, e
  // NON c'e' una guardia che lo impedisca: e' una proprieta' della scala, che
  // parte da 1. Ce n'era una, ed era codice morto travestito da guardia — un
  // test l'ha presa, perche' rompendola non falliva niente. Chi un giorno
  // aggiungesse un gradino sotto 1 (un «Piccola») la deve rimettere qui,
  // insieme al controllo che la prova: un'app che si rimpicciolisce da sola
  // senza che nessuno gliel'abbia chiesto e' un difetto, non un adattamento.
  let scelto = SCALE_UI[0];
  for (const s of SCALE_UI) {
    if (Math.abs(s.fattore - ideale) < Math.abs(scelto.fattore - ideale)) scelto = s;
  }
  return scelto.id;
}

// Quel che il browser sa dire di questo schermo, raccolto in un punto solo.
export function datiSchermo() {
  if (typeof window === "undefined") return {};
  const s = window.screen || {};
  return {
    lato: Math.max(s.width || 0, s.height || 0),
    dpr: window.devicePixelRatio || 1,
    // «a dito»: un computer non si tocca, e li' non si scala niente
    dito: window.matchMedia?.("(pointer: coarse)")?.matches ?? false,
  };
}

// STA SUL DISPOSITIVO, e non nelle preferenze che viaggiano nel cloud —
// come il volume della musica e per la stessa ragione. Questa levetta non
// dice come vedi tu: dice quanto e' fitto QUESTO schermo. Lo stesso lettore
// sul telefono a densita' tripla e sul tablet a densita' uno vuole due
// valori diversi, e sincronizzarla porterebbe su un dispositivo il rimedio
// del difetto di un altro.
const SCALA_KEY = "bc_ui_scala";

export const scalaDi = (id) => SCALE_UI.find((s) => s.id === id) || SCALE_UI[0];

// Il corpo del testo a un fattore qualunque, che non e' quello in vigore:
// serve ai tasti della levetta, dove ognuno si scrive nella misura che
// offre. Sta qui e non nel componente perche' il valore di partenza deve
// restare in UN posto solo — scriverci 15 a mano la' sarebbe l'inizio dello
// sfarinamento che la scala e' venuta a fermare.
export const corpoAlFattore = (fattore) => Math.round(SCALA_BASE.corpo * fattore);

// LA SCELTA E IL GRADINO SONO DUE COSE DIVERSE, e tenerle separate e' tutto.
// «Automatica» e' una scelta che non ha un fattore suo: si risolve in un
// gradino ogni volta che serve. Scrivendo nello storage il gradino RISOLTO
// invece della scelta, «Automatica» durerebbe fino al primo riavvio e poi
// resterebbe congelata sul numero di allora — cioe' smetterebbe di essere
// automatica proprio quando cambi dispositivo, che e' l'unico momento in cui
// serviva a qualcosa.
// E CHI NON HA MAI SCELTO PARTE DA «AUTOMATICA», che e' la richiesta presa
// alla lettera: «non riesci a farlo adattare in automatico?». Lasciarla come
// un'opzione da andare a scovare nel pannello dell'aspetto vorrebbe dire che
// il tablet dove serve continua a mostrare l'app in miniatura finche' non la
// si trova — cioe' esattamente il difetto di partenza. Chi un gradino l'ha
// scelto a mano se lo tiene: la sua scelta e' scritta, e non si tocca.
export const SCELTA_DEFAULT = AUTO;

export function leggiScalaUI() {
  try {
    const v = localStorage.getItem(SCALA_KEY);
    if (v === AUTO) return AUTO;
    if (v === null) return SCELTA_DEFAULT;
    return SCALE_UI.some((s) => s.id === v) ? v : SCELTA_DEFAULT;
  } catch {
    // storage negato: non si sa cosa avesse scelto, e lo schermo lo si puo'
    // ancora guardare
    return SCELTA_DEFAULT;
  }
}

// Da scelta a gradino vero. Fuori da `applicaScalaUI` perche' la scheda deve
// poter dire QUALE misura ha scelto lo schermo senza applicare niente: un
// automatismo che non dice cosa ha deciso e' un automatismo su cui non si
// puo' essere d'accordo.
export function risolviScala(scelta, dati) {
  if (scelta !== AUTO) return scalaDi(scelta).id;
  return misuraConsigliata(dati || datiSchermo());
}

// LA SCALA VALE ANCHE PER QUEL CHE NON E' UN CORPO. Con i soli `F` e `R`,
// a due volte la scritta della barra in basso diventava 30px dentro una
// barra alta 40, accanto a glifi rimasti di 20: testo gigante, icone
// minuscole, e la barra che non cresceva — misurato a 2× e visto in
// fotografia. Le poche altezze che devono seguire la scrittura passano di
// qui, e restano numeri scritti UNA volta nel loro componente invece di
// diventare otto voci nuove in una scala che e' fatta di corpi.
//
// `px` legge il fattore VIVO, aggiornato da `applicaScalaUI`: chiamarla al
// render e' l'unico modo di seguire la levetta, come per `F` e `R`.
let fattoreVivo = 1;
export const px = (n) => Math.round(n * fattoreVivo);
export const fattoreCorrente = () => fattoreVivo;

// Il `tondo` NON si scala: 999 non e' una misura, e' il modo di dire
// «pastiglia» al browser. Moltiplicarlo darebbe un numero piu' grosso e
// nessuna differenza, cioe' un valore che sembra vivo e non lo e'.
export function applicaScalaUI(scelta, dati) {
  const s = scalaDi(risolviScala(scelta, dati));
  fattoreVivo = s.fattore;
  for (const k of Object.keys(SCALA_BASE)) F[k] = Math.round(SCALA_BASE[k] * s.fattore);
  for (const k of Object.keys(RAGGI_BASE)) {
    R[k] = k === "tondo" ? RAGGI_BASE[k] : Math.round(RAGGI_BASE[k] * s.fattore);
  }
  try {
    // si scrive la SCELTA, non il gradino risolto: vedi `leggiScalaUI`
    localStorage.setItem(SCALA_KEY, scelta === AUTO ? AUTO : s.id);
  } catch {
    /* storage negato: la misura vale per questa sessione, e basta */
  }
  return s;
}

export const SECTIONS = [
  { id: "home", label: "Ingresso" },
  { id: "library", label: "Libreria" },
  { id: "music", label: "Musica" },
];
