// LE NOVITÀ DELLE SERIE E DEGLI AUTORI CHE SCEGLI (`android/Novita.java`).
// Chiesto dal lettore, tolta la parte manga: «inviarmi notifiche quando esce
// un nuovo libro, un nuovo capitolo, delle mie serie e dei miei autori
// preferiti, sia fumetti, manga, libri; poi vado a cercarmeli io». Si segue
// solo quel che sceglie lui («🔔 Avvisami» nella raccolta di una saga o di
// un autore), e l'avviso e' una notifica di Android anche ad app chiusa: la
// pagina manda la lista al guscio, il guscio controlla ogni qualche ora.
//
// Due modi di guardare, secondo cosa e' la raccolta:
// - un AUTORE, o una saga di libri o di fumetti: i libri nuovi dei suoi
//   autori su Open Library (il nuovo volume di una saga e' quasi sempre un
//   libro nuovo del suo autore);
// - una saga di MANGA: i capitoli nuovi su MangaDex, rimandi compresi (il
//   capitolo uscito su MANGA Plus e' un capitolo uscito). Solo avvisi: dove
//   leggerlo lo decide il lettore;
// - una saga che Wikidata riconosce dai titoli dei suoi volumi
//   (`lib/serieWikidata.js`): i volumi nuovi della serie, e non i libri
//   dell'autore che con la saga non c'entrano. La si cerca aperta la
//   raccolta seguita, una volta (`daCercare`, `conSerie`).
export const CHIAVE_NOVITA = "bc_novita";
export const STATO_NOVITA = "grimorio:novita:";
// gli autori di una saga che si guardano: i piu' presenti, al piu' tre (le
// antologie della Black Library hanno dieci nomi, e dieci domande a giro
// per una saga sola sono troppe)
export const AUTORI_MAX = 3;

export const puoAvvisare = (id) => /^(saga|autore):./.test(String(id || ""));

const pulito = (s) => String(s || "").trim();

// gli autori che contano in una raccolta: quelli dei suoi volumi, dal piu'
// presente, senza i vuoti, senza «Autore sconosciuto» e simili
export function autoriDi(libri = [], max = AUTORI_MAX) {
  const conto = new Map();
  for (const b of libri || []) {
    for (const a of String(b?.author || "").split(/\s*(?:;|&| e | and )\s*/i)) {
      const nome = pulito(a);
      if (!nome || /^(autore sconosciuto|sconosciuto|unknown|anonimo|various|aa\.? ?vv\.?)$/i.test(nome)) continue;
      conto.set(nome, (conto.get(nome) || 0) + 1);
    }
  }
  return [...conto.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, max).map(([n]) => n);
}

// cosa si guarda di una raccolta (`r` di `disponi`: id, nome, libri)
export function vocePerRaccolta(r) {
  if (!r || !puoAvvisare(r.id)) return null;
  const nome = pulito(r.nome);
  if (r.id.startsWith("autore:")) return nome ? { id: r.id, nome, tipo: "autori", autori: [nome] } : null;
  const libri = r.libri || [];
  const manga = libri.filter((b) => b?.tipo === "manga").length;
  if (libri.length && manga * 2 >= libri.length) return { id: r.id, nome, tipo: "manga", titolo: nome };
  const autori = autoriDi(libri);
  return autori.length ? { id: r.id, nome, tipo: "autori", autori } : null;
}

const TIPI = ["manga", "autori", "serie"];

export function leggiNovita(st = globalThis.localStorage) {
  try {
    const v = JSON.parse(st?.getItem(CHIAVE_NOVITA) || "[]");
    return Array.isArray(v) ? v.filter((x) => x && puoAvvisare(x.id) && TIPI.includes(x.tipo)) : [];
  } catch {
    return [];
  }
}
export function scriviNovita(lista, st = globalThis.localStorage) {
  try {
    st?.setItem(CHIAVE_NOVITA, JSON.stringify(lista));
  } catch {
    /* senza memoria la lista vale solo adesso */
  }
  return lista;
}

export const seguita = (lista, id) => (lista || []).some((x) => x.id === id);
// seguire di nuovo la stessa raccolta la aggiorna (gli autori di una saga
// cambiano coi volumi che arrivano), mai la raddoppia
export function seguiNovita(lista, voce) {
  if (!voce) return lista || [];
  return [...(lista || []).filter((x) => x.id !== voce.id), voce];
}
export const smettiNovita = (lista, id) => (lista || []).filter((x) => x.id !== id);

// al guscio va solo quel che gli serve per chiedere
const perIlGuscio = (x) => {
  if (x.tipo === "manga") return { id: x.id, nome: x.nome, tipo: "manga", titolo: x.titolo || x.nome };
  if (x.tipo === "serie") return { id: x.id, nome: x.nome, tipo: "serie", wikidata: (x.serie || []).map((s) => s.id) };
  return { id: x.id, nome: x.nome, tipo: "autori", autori: (x.autori || []).slice(0, AUTORI_MAX) };
};
export const messaggioNovita = (lista) => JSON.stringify({ novita: (lista || []).map(perIlGuscio) });

// LA SERIE SU WIKIDATA si cerca per una saga seguita che guarda gli autori
// e non e' ancora stata cercata; trovata, la saga guarda la serie (gli
// autori restano, se la si dovesse ricercare); non trovata, resta agli
// autori e non si ricerca. Un intoppo di rete non segna niente: si riprova.
export const daCercare = (voce) => !!voce && voce.tipo === "autori" && String(voce.id).startsWith("saga:") && !voce.cercata;
export function conSerie(lista, id, serie, quando = Date.now()) {
  return (lista || []).map((x) => {
    if (x.id !== id || !daCercare(x)) return x;
    const trovate = (serie || []).filter((s) => /^Q\d+$/.test(s?.id || "")).map((s) => ({ id: s.id, nome: String(s.nome || s.id), membri: s.membri || 0 }));
    return trovate.length ? { ...x, tipo: "serie", serie: trovate, cercata: quando } : { ...x, cercata: quando };
  });
}
// le parole della serie seguita
export const nomiSerie = (voce) => (voce?.serie || []).map((s) => `«${s.nome}»`).join(", ");

export function statoNovita(dato) {
  if (typeof dato !== "string" || !dato.startsWith(STATO_NOVITA)) return null;
  const s = dato.slice(STATO_NOVITA.length);
  return ["si", "no", "chiedo", "guasto"].includes(s) ? s : null;
}

export function fraseNovita(stato, { nelGuscio = false, quante = 0 } = {}) {
  if (!quante) return "Non segui ancora niente: apri la raccolta di una saga o di un autore in Libreria e tocca «🔔 Avvisami delle novità».";
  const cosa = quante === 1 ? "1 raccolta seguita" : `${quante} raccolte seguite`;
  if (!nelGuscio) return `${cosa}. Le notifiche le manda l'app Android: aprila dall'icona «Book Companion».`;
  if (stato === "si") return `🔔 ${cosa}: ogni qualche ora guardo se è uscito qualcosa, e te lo dice una notifica.`;
  if (stato === "no") return `🔕 ${cosa}, ma Android non lascia mandare notifiche a Book Companion: Impostazioni Android → Notifiche → Book Companion, e riaccendile.`;
  if (stato === "chiedo") return `🔔 ${cosa}: Android ti chiede se Book Companion può mandarti notifiche, rispondi sì.`;
  if (stato === "guasto") return `⚠ ${cosa}, ma Android non ha accettato il controllo periodico: gli avvisi non partono. Installa l'APK più recente.`;
  return `${cosa}. L'app Android di questo tablet non sa ancora mandare gli avvisi: installa l'APK più recente.`;
}

// cosa dice il tasto nella raccolta
export function tastoNovita(r, lista) {
  const voce = vocePerRaccolta(r);
  if (!voce) return null;
  const si = seguita(lista, r.id);
  const mia = (lista || []).find((x) => x.id === r.id);
  const come =
    mia?.tipo === "serie"
      ? `i volumi nuovi di ${nomiSerie(mia)} (Wikidata)`
      : voce.tipo === "manga"
        ? "i capitoli nuovi"
        : voce.autori.length === 1 && voce.autori[0] === voce.nome
          ? "i libri nuovi"
          : `i libri nuovi di ${voce.autori.join(", ")}`;
  return { si, testo: si ? "🔔 Ti avviso delle novità" : "🔕 Avvisami delle novità", spiega: `Avviso: ${come}` };
}

// cosa dice la riga sotto il tasto, a raccolta seguita
export function fraseSerie(voce, { cerco = false, guasto = false } = {}) {
  if (!voce) return "";
  if (voce.tipo === "serie") {
    const membri = (voce.serie || []).reduce((n, s) => n + (s.membri || 0), 0);
    return `Su Wikidata: ${nomiSerie(voce)}${membri ? `, ${membri === 1 ? "1 volume" : `${membri} volumi`}` : ""}. Ti avviso dei volumi nuovi.`;
  }
  if (voce.tipo !== "autori" || !String(voce.id).startsWith("saga:")) return "";
  if (cerco) return "🔎 Cerco la saga su Wikidata…";
  if (guasto) return "Wikidata non risponde adesso: riprovo la prossima volta che apri la raccolta. Intanto ti avviso dei libri nuovi dei suoi autori.";
  if (voce.cercata) return `Su Wikidata non l'ho trovata: ti avviso dei libri nuovi di ${(voce.autori || []).join(", ")}.`;
  return "";
}
