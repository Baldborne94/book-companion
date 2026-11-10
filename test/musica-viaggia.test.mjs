// LE MELODIE CHE VIAGGIANO: ogni voce da file sale e scende (nome, peso,
// chiave dei byte, lapidi), i byte restano sul dispositivo. Chiesto dal
// lettore: «c'è modo di allineare i due dispositivi senza però usare il
// cloud?». Il file portato a mano si riconosce dalla voce (`music.js`).
import { mergePrefs } from "../src/lib/syncCore.js";

const m = (trackId, extra = {}) => ({ id: `v-${trackId}`, trackId, name: `Brano ${trackId}`, size: 1000, mime: "audio/mpeg", addedAt: 100, updatedAt: 100, ...extra });

export default async function (t) {
  {
    const locale = { music_favs: [m("a"), m("b", { drive: true, updatedAt: 200 })], music_lists: [], updated_at: 1 };
    const r = mergePrefs(locale, null);
    t.eq("salgono tutte, anche senza il segno di Drive", r.merged.music_favs.map((f) => f.trackId).join(","), "a,b");
  }
  {
    const remoto = { music_favs: [m("b", { drive: true, updatedAt: 200 }), m("z", { updatedAt: 300 })], music_lists: [], updated_at: 5 };
    const r = mergePrefs({ music_favs: [], music_lists: [], updated_at: 1 }, remoto);
    t.eq("dal cloud entrano tutte", r.favsLocali.map((f) => f.trackId).join(","), "b,z");
  }
  {
    const remoto = { music_favs: [m("b", { deleted: true, updatedAt: 300 })], music_lists: [], updated_at: 5 };
    const r = mergePrefs({ music_favs: [m("b", { updatedAt: 200 })], music_lists: [], updated_at: 1 }, remoto);
    t.c("la cancellazione arriva", r.favsLocali.find((f) => f.trackId === "b")?.deleted === true);
  }
  {
    const remoto = { music_favs: [m("a", { name: "Rinominato", updatedAt: 200 })], music_lists: [], updated_at: 5 };
    const r = mergePrefs({ music_favs: [m("a")], music_lists: [], updated_at: 1 }, remoto);
    t.eq("la stessa voce resta una", r.favsLocali.length, 1);
    t.eq("ed è la più nuova", r.favsLocali[0].name, "Rinominato");
  }
}
