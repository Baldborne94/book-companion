// LA FUSIONE DELLE MELODIE E DELLE RACCOLTE fra dispositivi. È la sorella
// di `fondiAnnotazioni` — «unione, non sostituzione» — e ne aveva la metà
// dei controlli: nessuno. Una fusione storta non alza errori: fa sparire
// una melodia salvata sul telefono, o riporta in vita quella cancellata.
import { mergeFavorites, mergePrefs } from "../src/lib/syncCore.js";

const ids = (l) => l.map((f) => f.id).join(",");
const insieme = (l) => l.map((f) => f.id).sort().join(",");
const f = (id, extra = {}) => ({ id, name: `Melodia ${id}`, url: `https://youtu.be/${id}`, addedAt: 100, updatedAt: 100, ...extra });

export default async function (t) {
  // ---- UNIONE, NON SOSTITUZIONE -------------------------------------------
  t.eq("quel che c'è solo di qua sopravvive", ids(mergeFavorites([f("a")], [])), "a");
  t.eq("quel che c'è solo di là sopravvive", ids(mergeFavorites([], [f("b")])), "b");
  t.eq("tutt'e due, senza doppioni", insieme(mergeFavorites([f("a"), f("c")], [f("c"), f("b")])), "a,b,c");
  t.eq("niente da nessuna parte", mergeFavorites([], []).length, 0);
  t.eq("e i null non fanno esplodere niente", mergeFavorites(null, undefined).length, 0);

  // ---- VINCE LA PIÙ RECENTE PER ID ----------------------------------------
  {
    const r = mergeFavorites([f("a", { name: "vecchio", updatedAt: 100 })], [f("a", { name: "nuovo", updatedAt: 200 })]);
    t.eq("il nome più recente vince, anche se viene dal cloud", r[0].name, "nuovo");
    const r2 = mergeFavorites([f("a", { name: "nuovo", updatedAt: 200 })], [f("a", { name: "vecchio", updatedAt: 100 })]);
    t.eq("e anche se viene da qui", r2[0].name, "nuovo");
  }
  // chi non ha `updatedAt` vale per il suo `addedAt`: un preferito salvato
  // da una versione vecchia dell'app non deve perdere contro tutto
  {
    const r = mergeFavorites([{ id: "a", name: "vecchia app", addedAt: 300 }], [f("a", { name: "cloud", updatedAt: 200 })]);
    t.eq("senza updatedAt conta addedAt", r[0].name, "vecchia app");
  }

  // ---- LE CANCELLAZIONI NON TORNANO INDIETRO -------------------------------
  {
    const r = mergeFavorites([f("a", { deleted: true, updatedAt: 300 })], [f("a", { updatedAt: 200 })]);
    t.eq("una lapide più recente vince sulla melodia viva", r[0].deleted, true);
    const r2 = mergeFavorites([f("a", { updatedAt: 200 })], [f("a", { deleted: true, updatedAt: 300 })]);
    t.eq("da qualunque lato arrivi", r2[0].deleted, true);
    // e resta nell'elenco, o l'altro dispositivo la rimanderebbe su viva
    t.eq("la lapide resta nell'elenco", r2.length, 1);
  }

  // ---- A PARITÀ DI OROLOGIO VINCE QUELLO DI QUI ---------------------------
  // Dichiarato, non scelto: l'elenco si scorre cloud prima e casa dopo, e
  // il `>=` fa vincere l'ultimo letto. È diverso da `fondiAnnotazioni`, dove
  // a parità resta quel che c'è già. Con timbri al millisecondo la parità è
  // rara, ma se un giorno si vuole la stessa regola delle annotazioni si
  // sappia che questo controllo va girato.
  {
    const r = mergeFavorites([f("a", { name: "qui", updatedAt: 200 })], [f("a", { name: "cloud", updatedAt: 200 })]);
    t.eq("a parità vince la copia di casa", r[0].name, "qui");
  }

  // ---- L'ORDINE È QUELLO DI NASCITA, non quello d'arrivo -----------------
  {
    // la più vecchia sta di QUA e il cloud si legge per primo: senza
    // l'ordinamento uscirebbe per ultima (mutazione provata)
    const r = mergeFavorites([f("presto", { addedAt: 100 })], [f("tardi", { addedAt: 300 }), f("mezzo", { addedAt: 200 })]);
    t.eq("dal più vecchio al più nuovo", ids(r), "presto,mezzo,tardi");
  }

  // ---- UNA VOCE SENZA ID NON ENTRA -----------------------------------------
  t.eq("senza id si salta", mergeFavorites([{ name: "orfana" }, null], [f("a")]).length, 1);

  // ---- E LE RACCOLTE PASSANO DALLA STESSA PORTA ---------------------------
  {
    const local = { music_favs: [f("a")], music_lists: [{ id: "r1", name: "Sera", brani: ["a"], addedAt: 100, updatedAt: 100 }], glossari: {}, updated_at: 100 };
    const remote = { music_favs: [f("b")], music_lists: [{ id: "r2", name: "Studio", brani: ["b"], addedAt: 150, updatedAt: 150 }], glossari: {}, updated_at: 150 };
    const { merged, applyLocal, pushRemote } = mergePrefs(local, remote);
    t.eq("le melodie si uniscono", insieme(merged.music_favs), "a,b");
    t.eq("e le raccolte pure", insieme(merged.music_lists), "r1,r2");
    t.c("qui c'è da scrivere, perché b e r2 mancavano", applyLocal);
    t.c("e lassù pure, perché a e r1 mancavano", pushRemote);
    // in pari non si muove niente: ogni giro rispedirebbe le stesse liste
    const pari = mergePrefs({ ...local, music_favs: merged.music_favs, music_lists: merged.music_lists, updated_at: 150 }, { ...remote, music_favs: merged.music_favs, music_lists: merged.music_lists });
    t.c("in pari non si riscrive qui", !pari.applyLocal);
  }

  // ---- I BRANI VIAGGIANO, I BYTE NO --------------------------------------
  // Chiesto dal lettore, con le raccolte del tablet vuote sul PC: «c'è modo
  // di allineare i due dispositivi senza però usare il cloud?». Prima una
  // voce con `trackId` restava dov'era nata («ogni dispositivo ha i suoi
  // file»): le raccolte viaggiavano coi loro id e di là restavano vuote.
  // Adesso ogni voce sale e scende — nome, peso, chiave dei byte, lapidi —
  // e i byte restano sul dispositivo.
  {
    const mioFile = { id: "f1", name: "Pioggia", trackId: "t1", addedAt: 105, updatedAt: 105 };
    const suoFile = { id: "f2", name: "Camino (dal tablet)", trackId: "t2", addedAt: 120, updatedAt: 120 };
    const lapideFile = { id: "f3", name: "Vento", trackId: "t3", deleted: true, addedAt: 90, updatedAt: 130 };
    const local = { music_favs: [mioFile, f("a"), lapideFile], music_lists: [], glossari: {}, updated_at: 100 };
    const remote = { music_favs: [suoFile, f("b", { addedAt: 110 })], music_lists: [], glossari: {}, updated_at: 150 };
    const { merged, favsLocali, applyLocal, pushRemote } = mergePrefs(local, remote);
    t.eq("lassù vanno link e brani da file", insieme(merged.music_favs), "a,b,f1,f2,f3");
    t.c("il file dell'altro dispositivo entra qui, con la chiave dei suoi byte", favsLocali.some((x) => x.id === "f2" && x.trackId === "t2"));
    t.c("e la lapide del mio sale (lo toglie anche di là)", merged.music_favs.some((x) => x.id === "f3" && x.deleted));
    t.c("qui c'è da scrivere: sono arrivati «b» e «Camino»", applyLocal);
    t.c("e lassù pure: mancano «a» e i miei file", pushRemote);
    const pari = mergePrefs({ ...local, music_favs: favsLocali, updated_at: 150 }, { ...remote, music_favs: merged.music_favs });
    t.c("in pari non si riscrive qui", !pari.applyLocal);
    t.c("né lassù", !pari.pushRemote);
    t.eq("l'ordine di nascita si tiene", ids(favsLocali), "f3,a,f1,b,f2");
  }
}
