// LA VISITA AI LIBRI.
//
// L'import dice com'è andata il giorno che il libro è entrato, e poi tace
// per sempre. Ma i guai di un ePub si scoprono a pagina duecento — una
// giuntura che lascia mezza facciata bianca, un capitolo che non si apre,
// l'encoding rotto che ti riempie il romanzo di «Ã¨» — e a quel punto non
// sai nemmeno se è colpa del file o dell'app.
//
// Qui si guarda ogni tomo e si dice PER NOME cosa non va, e cosa puoi
// farci. Quello che l'app sa già curare da sé non si segnala: sarebbe
// rumore, e il rumore fa ignorare anche le righe che contano.

// Sotto questa soglia un libro non ha davvero testo: è un guscio, o le
// pagine sono immagini scansionate.
export const TESTO_MINIMO = 2000;
// un documento della spina con meno di questo è una pagina vuota
export const DOC_VUOTO = 20;
// una giuntura è un documento corto che nessuna voce d'indice apre
export const GIUNTURA = 1500;
// e per parlare di «libro spezzato» ce ne vogliono parecchie: due o tre
// sono il frontespizio e il colophon, non un romanzo fatto a pezzi
export const GIUNTURE_TANTE = 5;

// L'ENCODING ROTTO si riconosce da poche sequenze, e sono sempre le
// stesse: UTF-8 letto come Latin-1. «perché» diventa «perchÃ©». Nessun
// reader può curarlo — i byte sbagliati sono nel file — quindi è proprio
// il caso in cui vale la pena dirlo, perché l'unica strada è un altro file.
const MOJIBAKE = /Ã[¨©à¬²¹¡°-]|â€[™œ]|Ã¢â‚¬/g;
export const MOJIBAKE_TANTI = 5;

// Un indice con una voce sola su un libro di venti capitoli non è un
// indice: la navigazione è mutilata, e si vede solo quando la cerchi.
export const POCHI_CAPITOLI = 3;

// Le voci sono dati e non frasi sparse nel componente: così un test può
// pretendere che ogni guaio sappia dire cosa fare, e nessuno ne aggiunge
// uno muto.
export const GUAI = {
  nonSiApre: {
    grave: true,
    dice: "non si apre",
    cura: "il file è rovinato: serve un'altra copia",
  },
  senzaTesto: {
    grave: true,
    dice: "non ha testo leggibile",
    cura: "se è una scansione, dizionario, ricerca e Oracolo non potranno funzionare",
  },
  mojibake: {
    grave: true,
    dice: "ha l'encoding rotto (accenti come «Ã¨»)",
    cura: "i byte sbagliati sono nel file: nessun reader può curarlo, serve un'altra copia",
  },
  spezzato: {
    grave: false,
    dice: "è spezzato in tanti pezzi che l'indice non apre",
    cura: "reimportalo: all'ingresso i pezzi si ricuciono, e le facciate bianche spariscono",
  },
  capitoliVuoti: {
    grave: false,
    dice: "ha capitoli senza niente dentro",
    cura: "sono pagine bianche in mezzo alla lettura",
  },
  senzaIndice: {
    grave: false,
    dice: "non ha un indice",
    cura: "l'elenco dei capitoli resterà vuoto",
  },
};

// Il cuore, e sta staccato apposta: prende i FATTI già raccolti — quanto
// testo, quanti documenti, quante voci d'indice — e decide. Così un test lo
// chiama con dei numeri, senza tirarsi dietro epub.js e un romanzo vero.
export function esamina(fatti = {}) {
  const guai = [];
  if (fatti.rotto) return ["nonSiApre"];
  const testo = fatti.caratteri || 0;
  if (testo < TESTO_MINIMO) guai.push("senzaTesto");
  // il mojibake si pesa sul testo: cinque «Ã¨» in un romanzo intero possono
  // essere una citazione, cinque in una pagina no
  if ((fatti.mojibake || 0) >= MOJIBAKE_TANTI) guai.push("mojibake");
  if ((fatti.giunture || 0) >= GIUNTURE_TANTE) guai.push("spezzato");
  if ((fatti.vuoti || 0) > 0) guai.push("capitoliVuoti");
  // «niente indice» ha senso solo su un libro che di capitoli ne ha:
  // un racconto in tre documenti non ha un indice perché non gli serve
  if ((fatti.indice || 0) <= 1 && (fatti.documenti || 0) > POCHI_CAPITOLI) guai.push("senzaIndice");
  return guai;
}

export const grave = (guai = []) => guai.some((g) => GUAI[g]?.grave);

// Conta le sequenze da UTF-8 letto male. Sta fuori perché è l'unico pezzo
// che si può sbagliare in modo sottile.
export function quantoMojibake(testo) {
  return (String(testo || "").match(MOJIBAKE) || []).length;
}

// I fatti di un ePub GIA' APERTO. Come `trovaCopertina`, prende il libro
// aperto e non lo apre lui: un test lo chiama con un finto.
export async function fattiDaEpub(eb) {
  await eb.loaded?.spine;
  const voci = eb.spine?.spineItems || eb.spine?.items || [];
  // i bersagli dell'indice, per riconoscere i documenti che nessuna voce
  // apre — sono quelli che il testo non può scavalcare
  const inIndice = new Set();
  try {
    const nav = await eb.loaded?.navigation;
    const scendi = (elenco) => {
      for (const v of elenco || []) {
        if (v?.href) inIndice.add(String(v.href).split("#")[0].replace(/^\.?\//, ""));
        scendi(v.subitems);
      }
    };
    scendi(nav?.toc);
  } catch {
    /* un indice illeggibile è già un'informazione: resta vuoto */
  }
  let caratteri = 0;
  let mojibake = 0;
  let vuoti = 0;
  let giunture = 0;
  for (const item of voci) {
    let t = "";
    try {
      await item.load(eb.load.bind(eb));
      t = (item.document?.body?.textContent || "").replace(/\s+/g, " ").trim();
    } catch {
      /* un capitolo che non si carica conta come vuoto, che è quello che
         il lettore vedrebbe */
    } finally {
      try { item.unload(); } catch { /* già scaricato */ }
    }
    caratteri += t.length;
    mojibake += quantoMojibake(t);
    if (t.length < DOC_VUOTO) vuoti += 1;
    else if (t.length < GIUNTURA && !inIndice.has(String(item.href || "").replace(/^\.?\//, ""))) {
      giunture += 1;
    }
  }
  return { caratteri, mojibake, vuoti, giunture, documenti: voci.length, indice: inIndice.size };
}

// LA PASSATA, con la forma di ogni passata lunga dell'app: un tomo per
// volta (aprirne venti insieme su un tablet vuol dire tenere in memoria
// venti romanzi), avanzamento col titolo, e il filo `vivo` per fermarla a
// metà con quello che è fatto che resta fatto.
//
// `leggiByte` e `apri` arrivano da fuori per la ragione di sempre: un test
// li passa finti invece di tirarsi dietro IndexedDB ed epub.js.
export async function visita(libri = [], { leggiByte, apri, onProgress, vivo } = {}) {
  const attivo = vivo || (() => true);
  const esito = { esaminati: 0, lontani: [], malati: [], fermato: false };
  for (const [i, b] of libri.entries()) {
    if (!attivo()) {
      esito.fermato = true;
      break;
    }
    onProgress?.({ i, totale: libri.length, titolo: b.title });
    // un tomo rimasto nel cloud non si scarica per una visita: si conta e
    // si dice, come ovunque nell'app
    let file = null;
    try {
      file = await Promise.resolve().then(() => leggiByte?.(b.id));
    } catch {
      file = null;
    }
    if (!file) {
      esito.lontani.push(b.title);
      continue;
    }
    let guai = [];
    try {
      guai = esamina(await apri(b, file));
    } catch {
      guai = ["nonSiApre"];
    }
    esito.esaminati += 1;
    if (guai.length) esito.malati.push({ id: b.id, title: b.title, guai });
  }
  return esito;
}

// Il resoconto in una riga, con la stessa regola dell'import: gli zeri non
// si dicono, e quello che c'è da fare si dice per ultimo.
export function resocontoVisita(esito = {}) {
  const { esaminati = 0, malati = [], lontani = [], fermato } = esito;
  if (!esaminati && !lontani.length) return "Nessun tomo da guardare";
  const parti = [];
  if (!malati.length) {
    parti.push(esaminati === 1 ? "Il tomo è a posto ✓" : `Tutti e ${esaminati} i tomi sono a posto ✓`);
  } else {
    const gravi = malati.filter((m) => grave(m.guai)).length;
    parti.push(
      malati.length === 1 ? "Un tomo da guardare" : `${malati.length} tomi da guardare`
    );
    if (gravi) parti.push(gravi === 1 ? "uno è serio" : `${gravi} sono seri`);
  }
  if (lontani.length)
    parti.push(`${lontani.length} ${lontani.length === 1 ? "non è" : "non sono"} su questo dispositivo`);
  if (fermato) parti.push("giro fermato");
  return parti.join(" · ");
}
