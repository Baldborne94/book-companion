// LIBERA SPAZIO SUL TABLET (chiesto dal lettore, col tablet pieno: «su E ho
// tutto salvato quindi non si perde il file originale»). Il PC dice quali
// libri ha sul disco, il tablet propone di togliere gli ebook dei letti che
// il disco ha. Sbaglia in silenzio in due modi: proporre un libro che il
// disco non ha (il file se ne va per sempre), o fidarsi dell'altro
// dispositivo, dove «togli l'ebook» arriva e toglie il file anche la'.
import { aggiornaDisco, sulDiscoDa, altroveDa, aggiornaQui } from "../src/lib/dispositivi.js";
import { daLiberare, senzaCopiaNota, pesoTotale } from "../src/lib/liberaSpazio.js";
import { inViaggio, dalViaggio } from "../src/lib/votiRaccolte.js";
import { mergePrefs } from "../src/lib/syncCore.js";

const jsonb = (v) =>
  Array.isArray(v)
    ? v.map(jsonb)
    : v && typeof v === "object"
      ? Object.fromEntries(Object.keys(v).sort((a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0)).map((k) => [k, jsonb(v[k])]))
      : v;

export default async (t) => {
  // ---- la voce del disco --------------------------------------------------
  const pc = aggiornaQui([], ["p1"], { dispositivo: "P", nome: "computer", ora: 5 });
  const conDisco = aggiornaDisco(pc, ["b2", "b1", "b1"], { dispositivo: "P", ora: 10 });
  const voce = conDisco.find((v) => v.disco);
  t.eq("una voce sua, gli id in ordine e senza doppioni", JSON.stringify(voce), JSON.stringify({ id: "qui|P|disco", disco: true, libri: ["b1", "b2"], updatedAt: 10 }));
  t.c("la voce del dispositivo resta", conDisco.some((v) => v.id === "qui|P" && v.libri.join() === "p1"));
  t.c("lo stesso disco, gli stessi libri: niente ora nuova", aggiornaDisco(conDisco, ["b1", "b2"], { dispositivo: "P", ora: 99 }) === conDisco);
  t.eq("un libro in piu' sul disco: voce nuova", aggiornaDisco(conDisco, ["b1", "b2", "b3"], { dispositivo: "P", ora: 20 }).find((v) => v.disco).updatedAt, 20);
  t.eq("senza elenco del disco non si scrive niente", aggiornaDisco(conDisco, null, { dispositivo: "P" }), conDisco);
  const noto = sulDiscoDa(conDisco);
  t.eq("dal tablet: cosa ha il disco, e da quando", `${[...noto.ids]}|${noto.quando}`, "b1,b2|10");
  t.eq("nessun controllo: niente, mai guardato", sulDiscoDa(pc).quando, 0);
  t.eq("il disco non e' un dispositivo: un libro solo li' non si apre altrove", [...altroveDa(conDisco, "T").keys()].join(), "p1");
  t.eq("una voce del disco con la lapide non dice niente", sulDiscoDa([{ ...voce, deleted: true }]).ids.size, 0);

  // viaggia con le altre voci e in pari non rimbalza
  const viaggio = inViaggio([], [], conDisco);
  t.eq("torna dal viaggio fra i dispositivi", JSON.stringify(dalViaggio(viaggio).dispositivi), JSON.stringify(conDisco));
  const base = { music_favs: [], music_lists: [], glossari: {}, racconti: [], reader: null, last_opened: null, tempo: {}, obiettivi: {}, quaderno: [], da_prendere: [], updated_at: 5 };
  const fermo = mergePrefs({ ...base, raccolte_fav: viaggio }, { ...base, raccolte_fav: jsonb(viaggio) });
  t.c("dopo jsonb, niente da scrivere", !fermo.applyLocal && !fermo.pushRemote, JSON.stringify(fermo));
  const sale = mergePrefs({ ...base, raccolte_fav: viaggio }, { ...base, raccolte_fav: jsonb(inViaggio([], [], pc)) });
  t.c("il disco appena controllato sale", sale.pushRemote && !sale.applyLocal);

  // ---- cosa si propone ----------------------------------------------------
  const libri = [
    { id: "b1", title: "Mort" },
    { id: "b2", title: "Hellboy Omnibus" },
    { id: "b3", title: "In lettura" },
    { id: "b4", title: "Solo qui" },
    { id: "b5", title: "Gia' tolto", fileTolto: true },
    { id: "b6", title: "Non qui" },
  ];
  const stati = { b1: "read", b2: "read", b3: "reading", b4: "read", b5: "read", b6: "read" };
  const opz = {
    qui: new Set(["b1", "b2", "b3", "b4", "b5"]),
    sulDisco: new Set(["b1", "b2", "b3", "b5", "b6"]),
    pesi: new Map([["b1", 1000], ["b2", 900000]]),
    stato: (id) => stati[id],
  };
  const lista = daLiberare(libri, opz);
  t.eq("i letti con il file qui e la copia sul disco, il piu' pesante prima", lista.map((x) => x.titolo).join(), "Hellboy Omnibus,Mort");
  t.eq("col loro peso", pesoTotale(lista), 901000);
  t.c("mai un libro in lettura", !lista.some((x) => x.id === "b3"));
  t.c("mai un libro che il disco non ha", !lista.some((x) => x.id === "b4"));
  t.c("ne' uno gia' senza ebook, ne' uno che qui non c'e'", !lista.some((x) => x.id === "b5" || x.id === "b6"));
  t.eq("l'altro dispositivo non e' una copia", daLiberare(libri, { ...opz, sulDisco: new Set() }).length, 0);
  t.eq("senza la voce del disco non si propone niente", daLiberare(libri, { ...opz, sulDisco: null }).length, 0);
  t.eq("prima di aver contato i file di qui non si propone niente", daLiberare(libri, { ...opz, qui: null }).length, 0);
  t.eq("un peso che non si sa vale zero, non NaN", daLiberare([{ id: "b1", title: "Mort" }], { ...opz, pesi: null })[0].byte, 0);
  t.eq("a pari peso, in ordine di titolo", daLiberare([{ id: "b4", title: "B" }, { id: "b1", title: "A" }], { ...opz, sulDisco: new Set(["b1", "b4"]), pesi: new Map() }).map((x) => x.titolo).join(), "A,B");

  t.eq("senza i file di qui non si dice niente", senzaCopiaNota(libri, { ...opz, qui: null }).length, 0);
  t.eq("i letti di cui il disco non sa niente si dicono", senzaCopiaNota(libri, opz).map((b) => b.id).join(), "b4");
  t.eq("…tutti, se il disco non e' mai stato guardato", senzaCopiaNota(libri, { ...opz, sulDisco: new Set() }).map((b) => b.id).join(), "b1,b2,b4");
};
