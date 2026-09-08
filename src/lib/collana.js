// LA SAGA ERA GIÀ DENTRO IL FILE, e la buttavamo via.
//
// Chiesto dal lettore: «per ogni libro che inserisci devi sempre
// anticiparmi e già riconoscere se appartiene a una saga e che numero è di
// quella specifica saga». Le tavole scritte a mano non ci arriveranno mai —
// ne conoscono tre saghe su tutte quelle che esistono — e la deduzione
// dalla biblioteca ha bisogno di un ALTRO libro dello stesso autore su cui
// tu la saga l'abbia già scritta.
//
// Ma chi impacchetta un ePub la collana ce la mette quasi sempre, e noi
// all'import leggevamo titolo, autore e copertina e la lasciavamo lì. È la
// stessa identica storia di `dc:description`: non costa rete, non passa da
// nessun modello, funziona sul primo libro di un autore che non conosciamo,
// e l'ha scritta chi il libro l'aveva in mano.
//
// DUE DIALETTI, e vanno letti tutt'e due.
//
//   EPUB 3, quello dello standard:
//     <meta property="belongs-to-collection" id="c1">The Second Apocalypse</meta>
//     <meta refines="#c1" property="collection-type">series</meta>
//     <meta refines="#c1" property="group-position">1</meta>
//
//   Calibre, che è quello che si incontra davvero:
//     <meta name="calibre:series" content="The Second Apocalypse"/>
//     <meta name="calibre:series_index" content="1"/>
//
// Si lavora sul TESTO dell'OPF e non su un documento XML, per la ragione di
// sempre: così la funzione si prova con una stringa invece di tirarsi
// dietro un DOM, ed è esattamente la parte che sbaglia in silenzio — una
// collana letta storta non alza nessun errore, mette il libro nella saga
// sbagliata, e da lì «Prima di cominciare» racconta un'altra storia.

// un `<meta …/>` o un `<meta …>testo</meta>`: attributi e contenuto
const META = /<meta\b([^>]*?)(?:\/\s*>|>([\s\S]*?)<\/\s*meta\s*>)/gi;
const ATTR = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

const attributi = (s) => {
  const fuori = {};
  ATTR.lastIndex = 0;
  let m;
  while ((m = ATTR.exec(s))) fuori[m[1].toLowerCase()] = m[2] ?? m[3] ?? "";
  return fuori;
};

// le entità che si incontrano in un nome di collana: è XML, e «Vlad Taltos
// & Co.» arriva scappato
const ENTITA = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'", nbsp: " " };
const testo = (s) =>
  String(s || "")
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (tutto, cosa) => {
      if (cosa[0] === "#" && cosa[1] !== "x" && ENTITA[cosa]) return ENTITA[cosa];
      if (cosa[0] === "#") {
        const n = cosa[1] === "x" || cosa[1] === "X" ? parseInt(cosa.slice(2), 16) : parseInt(cosa.slice(1), 10);
        return Number.isFinite(n) && n > 0 ? String.fromCodePoint(n) : tutto;
      }
      return ENTITA[cosa.toLowerCase()] ?? tutto;
    })
    .replace(/\s+/g, " ")
    .trim();

// Quello che NON è il nome di una collana. Stessa famiglia della spazzatura
// del retro di copertina: mostrarlo sarebbe peggio che non mostrare niente,
// perché il libro finirebbe in una saga che non esiste.
const SPAZZATURA = /^(unknown|n\/?a|none|null|undefined|series|serie|collana|default|calibre)$/i;

// IL NUMERO È UN NUMERO, e Calibre ci scrive anche i decimali: `2.5` è la
// novella fra il secondo e il terzo, ed è un'informazione vera che non si
// arrotonda. Lo zero invece è il modo di Calibre di dire «non lo so».
export function numeroDiCollana(grezzo) {
  const n = Number(String(grezzo ?? "").trim().replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function collana(opf) {
  const s = String(opf || "");
  if (!s) return null;

  const calibre = {};
  const collezioni = new Map(); // id → { nome, tipo, posto }
  let primaSenzaId = null;

  META.lastIndex = 0;
  let m;
  while ((m = META.exec(s))) {
    const a = attributi(m[1]);
    const dentro = testo(m[2]);

    if (a.name === "calibre:series") calibre.nome = testo(a.content);
    else if (a.name === "calibre:series_index") calibre.numero = a.content;

    const prop = (a.property || "").toLowerCase();
    if (prop === "belongs-to-collection") {
      const voce = { nome: dentro || testo(a.content), tipo: "", posto: null };
      if (a.id) collezioni.set(a.id, voce);
      else if (!primaSenzaId) primaSenzaId = voce;
    } else if (prop === "collection-type" || prop === "group-position") {
      // `refines` punta all'id con il cancelletto davanti
      const chi = (a.refines || "").replace(/^#/, "");
      const voce = chi ? collezioni.get(chi) : primaSenzaId;
      if (!voce) continue;
      if (prop === "collection-type") voce.tipo = (dentro || testo(a.content)).toLowerCase();
      else voce.posto = dentro || a.content;
    }
  }

  // UN COFANETTO NON È UNA SAGA. `collection-type="set"` vuol dire «i tre
  // romanzi in un file», che nell'app è un'altra faccenda per intero: darlo
  // per saga metterebbe il volume nella collana sbagliata col numero del
  // cofanetto. Il tipo mancante invece non è una smentita — moltissimi file
  // non lo scrivono — e vale come serie.
  for (const voce of [...collezioni.values(), primaSenzaId].filter(Boolean)) {
    if (voce.tipo === "set") continue;
    const nome = testo(voce.nome);
    if (!nome || SPAZZATURA.test(nome)) continue;
    return { serie: nome, numero: numeroDiCollana(voce.posto) };
  }

  const nome = testo(calibre.nome);
  if (!nome || SPAZZATURA.test(nome)) return null;
  return { serie: nome, numero: numeroDiCollana(calibre.numero) };
}
