import { chiaveSaga, nienteSaga } from "./sagaBooks.js";

// NUMERARE I TUOI VOLUMI COME LA GUIDA.
//
// Chiesto dal lettore con l'Eresia in biblioteca: «in che modo posso
// ordinare la Horus Heresy affinche' il nostro Oracolo possa lavorare al
// meglio senza rivelare eventuali spoiler e che segue la trama cosi' come
// la suggeriscono dal sito per l'ordine migliore di lettura?».
//
// LA FRONTIERA GUARDA UN CAMPO SOLO. `frontiera.js` decide «prima» e
// «dopo» sul NUMERO DI LETTURA, e su niente altro: un volume senza numero
// non si sa collocare e resta fuori — non e' uno spoiler, e' un buco, e il
// personaggio conosciuto li' per la scheda non esiste. L'altra meta' e' la
// SAGA, confrontata lettera per lettera: due grafie diverse sono due
// storie per ogni funzione che attraversa la saga.
//
// IL NUMERO E' IL POSTO NELLA GUIDA, NON NELLA TUA BIBLIOTECA. Si conta su
// TUTTE le tappe, comprese quelle che non hai: contando solo i tuoi,
// importare un volume in piu' rinumererebbe tutti gli altri, e i numeri
// gia' scritti diventerebbero bugie. Cosi' invece il posto di «Fulgrim» e'
// lo stesso oggi e fra un anno.
//
// ED E' LO STESSO NUMERO CHE SCRIVE `riconosci`, che e' la cura di un
// difetto vero e non un'eleganza. Qui si contavano le righe-file del
// cammino (1-71) mentre l'import chiedeva il numero alla tavola (1-39): due
// numerazioni per la stessa guida, e meta' biblioteca su una scala e meta'
// sull'altra fa un ordine che non vuol dire niente — **e la frontiera ci
// crede**. Per giunta il quindicesimo posto di «Horus Rising» era proprio
// quello che il lettore aveva gia' fatto togliere una volta («perche' mi
// dice numero lettura 15 quando e' il primo?»), e tornava da questa porta.
// Il posto lo calcola adesso `postiDelCammino`, in un punto solo, e quel
// che la guida non numera si infila con un decimale invece di restare
// senza: il perche' sta scritto per esteso li'.
//
// NON SI RISCRIVE NIENTE IN SILENZIO, come per i titoli: qui si calcola
// soltanto, e il pannello mostra «da → a» una riga per volta. Un numero
// storto non alza nessun errore — sposta soltanto il confine di quel che
// l'Oracolo puo' dire, e non se ne accorge nessuno.

// I volumi che hai, col posto che gli darebbe la guida. Solo quelli in cui
// il numero CAMBIA: chi ce l'ha gia' giusto non e' una proposta, e' lavoro
// gia' fatto — cosi' al secondo giro non resta niente da spuntare.
export function numerazioneGuida(cammino) {
  // IL POSTO NON SI RICONTA QUI. Arriva da `postiDelCammino`, che lo chiede
  // alla tavola: ricontarlo su queste righe vorrebbe dire una seconda
  // numerazione accanto a quella dell'import, ed e' il difetto che questa
  // cura chiude.
  //
  // E UN RACCONTO NON HA POSTO (`null`), quindi si salta: la sua riga porta
  // il libro della sua ANTOLOGIA — che un numero ce l'ha, preso dalla
  // propria riga — e senza questa guardia gli si proporrebbe `null`, cioe'
  // di CANCELLARGLI il numero che ha appena preso.
  const fuori = [];
  for (const t of cammino?.tappe || []) {
    if (!t?.libro || t.posto == null) continue;
    const a = t.posto;
    const da = t.libro.sagaOrder == null ? null : Number(t.libro.sagaOrder);
    if (da === a) continue;
    fuori.push({ id: t.libro.id, title: t.libro.title || t.voce?.t || "senza titolo", da, a });
  }
  return fuori;
}

// LE PARTI DELLA GUIDA, SUI TUOI VOLUMI.
//
// Chiesto dal lettore con lo scaffale in mano: «rimettimi a posto tutta la
// Horus Heresy sotto la saga Warhammer 40K con le parti corrette». Sul suo
// ripiano cinquanta volumi stavano sotto un ciclo solo, «The Horus
// Heresy» — che e' il nome della COLLANA letto dal file, non una parte del
// cammino — e la guida invece ne ha tredici, che sono i capitoli della
// storia.
//
// Il tasto «Riconosci saghe e cicli» non poteva farlo, e la sua guardia ha
// ragione: aggiorna i cicli VUOTI e quelli che avevamo scritto noi, e
// «The Horus Heresy» non e' ne' l'uno ne' l'altro — per lui e' un nome
// scritto da qualcun altro, e su quel campo l'ultima parola e' del
// lettore. Quindi qui si PROPONE, riga per riga, come per i numeri e per
// i titoli: un ciclo sbagliato non alza nessun errore, cambia solo come
// si raggruppa lo scaffale e cosa racconta «Prima di cominciare».
export function partiDaScrivere(cammino) {
  const fuori = [];
  for (const t of cammino?.tappe || []) {
    if (!t?.libro || t.voce?.tipo === "racconto") continue;
    const a = String(t.voce?.c || "").trim();
    if (!a) continue;
    const da = String(t.libro.series || "").trim();
    if (da === a) continue;
    fuori.push({ id: t.libro.id, title: t.libro.title || t.voce.t || "senza titolo", da, a });
  }
  return fuori;
}

// LA SAGA E' L'ALTRA META', e da sola non si vede. Fra i volumi che hai,
// se le grafie sono piu' d'una la frontiera li spezza in due gruppi che non
// si parlano — e sullo scaffale sembra tutto a posto.
//
// La grafia scelta e' quella del lettore e non la nostra: si conta quella
// piu' usata fra i suoi, a parita' la piu' lunga e poi l'alfabetica (le
// stesse regole di `unificaSaghe`, o la scelta cambierebbe a ogni import).
// Solo se nessuno dei suoi ha una saga si propone il nome della tavola.
//
// Torna `null` quando non c'e' niente da fare: e' la risposta normale.
export function sagaComune(cammino) {
  const miei = (cammino?.tappe || []).map((t) => t?.libro).filter(Boolean);
  if (!miei.length) return null;
  const grafie = new Map();
  for (const b of miei) {
    const s = String(b.saga || "").trim();
    if (s) grafie.set(s, (grafie.get(s) || 0) + 1);
  }
  const nome = grafie.size
    ? [...grafie.entries()].sort(
        (a, b) => b[1] - a[1] || b[0].length - a[0].length || a[0].localeCompare(b[0])
      )[0][0]
    : String(cammino?.saga || "").trim();
  if (!nome) return null;
  // chi sta gia' sotto la stessa CHIAVE non si tocca: «The Horus Heresy» e
  // «the horus heresy» sono la stessa saga per tutta l'app, e riscriverne
  // una per la maiuscola sarebbe una modifica che non cura niente
  // E LA SAGA TOLTA A MANO RESTA TOLTA, anche da qui. Il campo svuotato e'
  // una scelta che non si vede, e questa e' un'altra porta da cui la saga
  // rientrerebbe: il volume resta nel cammino — quello si riconosce dal
  // titolo — e prende il suo numero, ma la saga no.
  const k = chiaveSaga(nome);
  const quali = miei
    .filter((b) => !nienteSaga(b) && chiaveSaga(String(b.saga || "").trim()) !== k)
    .map((b) => b.id);
  return quali.length ? { nome, quali } : null;
}

// Quel che il pannello consegna a chi scrive: una mappa id → campi da
// cambiare. Si mettono insieme qui e non nel componente perche' i due
// pezzi toccano lo STESSO libro — un volume puo' avere insieme la saga
// sbagliata e il numero sbagliato, e due scritture separate si
// sovrascriverebbero a vicenda.
export function campiDaScrivere({
  numeri = [],
  parti = [],
  saga = null,
  scelti,
  sagaScelta = true,
} = {}) {
  const campi = new Map();
  const dentro = (id) => {
    if (!campi.has(id)) campi.set(id, {});
    return campi.get(id);
  };
  // LA SPUNTA E' PER RIGA, NON PER LIBRO: lo stesso volume puo' comparire
  // due volte — una per il numero e una per la parte — e con un insieme di
  // soli id togliendo la spunta a una si toglierebbe anche all'altra, in
  // silenzio. Da qui le chiavi `n:` e `p:`.
  for (const p of numeri) {
    if (scelti && !scelti.has(`n:${p.id}`)) continue;
    dentro(p.id).sagaOrder = p.a;
  }
  // la parte passa dalla STESSA mappa del numero e della saga, per la
  // ragione di sempre: uno stesso volume puo' avere tutt'e tre i campi
  // storti, e tre scritture separate si sovrascriverebbero a vicenda
  for (const p of parti) {
    if (scelti && !scelti.has(`p:${p.id}`)) continue;
    dentro(p.id).series = p.a;
  }
  if (saga && sagaScelta) for (const id of saga.quali) dentro(id).saga = saga.nome;
  return campi;
}
