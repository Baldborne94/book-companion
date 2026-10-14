// LE MELODIE CHE VIAGGIANO: una voce da file sale solo col segno `drive`,
// scritto quando il brano stava su Google Drive. Drive non c'e' piu', e le
// voci segnate allora continuano a viaggiare (nome e raccolte), le altre
// restano sul dispositivo dove sono nate.
import { mergePrefs } from "../src/lib/syncCore.js";

const m = (trackId, extra = {}) => ({ id: `v-${trackId}`, trackId, name: `Brano ${trackId}`, size: 1000, mime: "audio/mpeg", addedAt: 100, updatedAt: 100, ...extra });

export default async function (t) {
  // ---- LA VOCE VIAGGIA SOLO COL SEGNO --------------------------------------
  {
    const locale = { music_favs: [m("a"), m("b", { drive: true, updatedAt: 200 })], music_lists: [], updated_at: 1 };
    const r = mergePrefs(locale, null);
    t.eq("sale solo la voce segnata", r.merged.music_favs.map((f) => f.trackId).join(","), "b");
    t.eq("qui restano tutt'e due", r.favsLocali.map((f) => f.trackId).sort().join(","), "a,b");
  }
  {
    const remoto = { music_favs: [m("b", { drive: true, updatedAt: 200 }), m("z", { updatedAt: 300 })], music_lists: [], updated_at: 5 };
    const r = mergePrefs({ music_favs: [], music_lists: [], updated_at: 1 }, remoto);
    t.eq("dal cloud entra la voce segnata, non quella senza segno", r.favsLocali.map((f) => f.trackId).join(","), "b");
  }
  {
    // la lapide di un brano che viaggiava arriva di la'
    const remoto = { music_favs: [m("b", { drive: true, deleted: true, updatedAt: 300 })], music_lists: [], updated_at: 5 };
    const r = mergePrefs({ music_favs: [m("b", { drive: true, updatedAt: 200 })], music_lists: [], updated_at: 1 }, remoto);
    t.c("la cancellazione arriva", r.favsLocali.find((f) => f.trackId === "b")?.deleted === true);
  }
  {
    // la stessa voce, qui ancora senza segno e lassu' segnata: resta una
    const remoto = { music_favs: [m("a", { drive: true, updatedAt: 200 })], music_lists: [], updated_at: 5 };
    const r = mergePrefs({ music_favs: [m("a")], music_lists: [], updated_at: 1 }, remoto);
    t.eq("una voce sola, non due", r.favsLocali.length, 1);
    t.c("ed e' quella segnata", r.favsLocali[0].drive === true);
  }

}
