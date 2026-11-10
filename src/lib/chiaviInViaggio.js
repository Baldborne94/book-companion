// LE CHIAVI VIAGGIANO FRA I DISPOSITIVI (chiesto dal lettore, che la chiave
// di Hardcover non se la ricordava: «falla sincronizzare sugli altri
// dispositivi», e «stessa cosa per la chiave di Claude»). Prima la chiave
// dell'Oracolo e quella di Hardcover stavano solo sul dispositivo dove le
// avevi incollate, e sull'altro bisognava ritrovarle.
//
// Viaggiano nella colonna delle raccolte (`raccolte_fav`), come i voti e i
// dispositivi (`votiRaccolte.js`): voci `chiave|<nome>` con l'ora in cui le
// hai cambiate, e vince la piu' nuova; una chiave tolta e' una lapide, e si
// toglie anche dall'altro. Nessuna colonna nuova da chiedere a Supabase.
// Stanno nella tua riga delle preferenze, nel tuo progetto Supabase, come
// tutto il resto che viaggia.
//
// Una chiave che c'era gia' prima di questo giro non ha una voce: la prende
// con l'ora 1, cosi' parte ma non copre mai una chiave cambiata altrove.

export const PREFISSO_CHIAVE = "chiave|";
const VOCI = "bc_chiavi_viaggio";
// il nome della chiave in viaggio → dove sta sul dispositivo
export const CHIAVI = { hardcover: "bc_hardcover_key", oracolo: "bc_ai_key" };
export const EVENTO = "bc:chiavi-cambiate";

const leggiVoci = (st) => {
  try {
    const v = JSON.parse(st?.getItem(VOCI) || "[]");
    return Array.isArray(v) ? v.filter((x) => x && typeof x.id === "string" && x.id.startsWith(PREFISSO_CHIAVE)) : [];
  } catch {
    return [];
  }
};

// vince la voce piu' nuova; a pari ora, la lapide
export function fondiChiavi(a = [], b = []) {
  const per = new Map();
  for (const v of [...(a || []), ...(b || [])]) {
    if (!v || typeof v.id !== "string" || !v.id.startsWith(PREFISSO_CHIAVE)) continue;
    const prima = per.get(v.id);
    const ora = Number(v.updatedAt) || 0;
    const oraPrima = Number(prima?.updatedAt) || 0;
    if (!prima || ora > oraPrima || (ora === oraPrima && v.deleted && !prima.deleted)) per.set(v.id, v);
  }
  return [...per.values()].sort((x, y) => (x.id < y.id ? -1 : 1));
}

// le voci da mandare: quelle scritte, e le chiavi gia' sul dispositivo
// senza voce (ora 1)
export function leggiChiavi(st = globalThis.localStorage) {
  const voci = leggiVoci(st);
  const nuove = [];
  for (const [nome, posto] of Object.entries(CHIAVI)) {
    const id = PREFISSO_CHIAVE + nome;
    if (voci.some((v) => v.id === id)) continue;
    let k = "";
    try {
      k = String(st?.getItem(posto) || "").trim();
    } catch {
      /* storage indisponibile */
    }
    if (k) nuove.push({ id, k, updatedAt: 1 });
  }
  return fondiChiavi(voci, nuove);
}

// la chiave cambiata qui: una voce con l'ora, e chi sincronizza lo sa
export function segnaChiave(nome, valore, { st = globalThis.localStorage, ora = Date.now(), avvisa = true } = {}) {
  if (!CHIAVI[nome]) return;
  const k = String(valore || "").trim();
  const voce = { id: PREFISSO_CHIAVE + nome, updatedAt: ora, ...(k ? { k } : { deleted: true }) };
  try {
    st?.setItem(VOCI, JSON.stringify(fondiChiavi(leggiVoci(st).filter((v) => v.id !== voce.id), [voce])));
  } catch {
    /* storage indisponibile: la chiave resta qui */
  }
  if (avvisa) {
    try {
      globalThis.dispatchEvent?.(new Event(EVENTO));
    } catch {
      /* fuori dal browser */
    }
  }
}

// le voci arrivate: fuse con quelle di qui, e ogni chiave vincente scritta
// (o tolta) al suo posto sul dispositivo
export function scriviChiavi(arrivate = [], { st = globalThis.localStorage } = {}) {
  const fuse = fondiChiavi(leggiChiavi(st), arrivate);
  try {
    st?.setItem(VOCI, JSON.stringify(fuse));
    for (const v of fuse) {
      const posto = CHIAVI[v.id.slice(PREFISSO_CHIAVE.length)];
      if (!posto) continue;
      if (v.deleted) st.removeItem(posto);
      else if (v.k) st.setItem(posto, v.k);
    }
  } catch {
    /* storage indisponibile */
  }
  return fuse;
}
