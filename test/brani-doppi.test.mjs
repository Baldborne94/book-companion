// I BRANI DOPPI (`braniDoppi`, `unisciDoppi`, `traslocaLapidi`, `tracciaViva`
// in `music.js`): segnalato dal lettore con la sala del tablet, «65 brani · 32
// non qui», e la raccolta aperta in due giri alfabetici, il secondo tutto «non
// è su questo dispositivo». La stessa cartella importata su tutt'e due i
// dispositivi: ogni canzone due volte, una coi byte qui e una coi byte
// sull'altro.
import { braniDoppi, unisciDoppi, traslocaLapidi, tracciaViva, comeRiprendere } from "../src/lib/music.js";

// un dispositivo finto: i byte per chiave
function memoria(chiavi) {
  const m = new Map(chiavi.map((k) => [k, { byte: `byte di ${k}` }]));
  return {
    m,
    qui: () => new Set(m.keys()),
    prendi: async (k) => m.get(k) || null,
    metti: async (k, b) => void m.set(k, b),
    togli: async (k) => void m.delete(k),
  };
}

export default async function (t) {
  // il tablet ha importato la cartella (t-), il PC pure (p-), prima che i brani
  // viaggiassero; la raccolta col suo nome li ha presi tutti e due
  const voce = (id, name, size, trackId, addedAt, file) => ({ id, name, size, trackId, addedAt, mime: "audio/mpeg", ...(file ? { file } : {}) });
  const favs = [
    voce("t1", "Honour", 4100, "kt1", 10, "Honour.mp3"),
    voce("t2", "Horizon", 5200, "kt2", 11, "Horizon.mp3"),
    voce("t3", "Swan Lake", 6300, "kt3", 12, "Swan Lake.mp3"),
    voce("p1", "Honour", 4100, "kp1", 20, "Honour.mp3"),
    voce("p2", "Orizzonte", 5200, "kp2", 21, "Horizon.mp3"), // rinominato sul PC: lo dice il nome del file
    voce("p3", "Swan Lake", 6301, "kp3", 22, "Swan Lake.mp3"), // un altro peso: un'altra canzone
    { id: "y1", name: "Honour", url: "https://youtu.be/abcdefghijk", addedAt: 5 },
  ];
  const horror = { id: "r1", name: "Horror playlist", brani: ["t1", "t2", "t3", "p1", "p2", "p3"], updatedAt: 1 };
  const altra = { id: "r2", name: "Altra", brani: ["p1", "y1"], updatedAt: 1 };

  // ---- SUL TABLET: QUALI SONO DOPPI, E QUALE SI TIENE -----------------------
  const tablet = memoria(["kt1", "kt2", "kt3"]);
  const doppi = braniDoppi(favs, tablet.qui());
  t.eq("doppi: stesso peso e stesso nome, o stesso nome di file", doppi.map((d) => `${d.tieni.id}<${d.via.map((v) => v.id).join("+")}`).join(), "t1<p1,t2<p2");
  t.c("un peso diverso non è un doppio, e YouTube nemmeno", !doppi.some((d) => [d.tieni, ...d.via].some((x) => x.id === "p3" || x.id === "y1")));
  const sulPc = braniDoppi(favs, new Set(["kp1", "kp2"]));
  t.eq("si tiene quello coi byte qui (sul PC quello del PC)", sulPc.map((d) => d.tieni.id).join(), "p1,p2");
  t.eq("senza byte né qui né là, il più vecchio", braniDoppi(favs, new Set()).map((d) => d.tieni.id).join(), "t1,t2");

  // ---- L'UNIONE ---------------------------------------------------------------
  const { favs: dopo, raccolte } = unisciDoppi(favs, [horror, altra], doppi, 99);
  const lapide = dopo.find((f) => f.id === "p1");
  t.c("la copia in più è una lapide che dice dove è andata", lapide.deleted === true && lapide.unito === "t1" && lapide.updatedAt === 99);
  t.c("le tenute restano vive", dopo.filter((f) => ["t1", "t2", "t3", "p3"].includes(f.id)).every((f) => !f.deleted));
  t.eq("nella raccolta un brano solo per canzone, al suo posto", raccolte[0].brani.join(), "t1,t2,t3,p3");
  t.eq("anche nelle altre raccolte la copia diventa quella tenuta", raccolte[1].brani.join(), "t1,y1");
  t.c("la raccolta cambiata porta l'ora, e così viaggia", raccolte[0].updatedAt === 99);

  // ---- I BYTE ------------------------------------------------------------------
  // sul tablet le lapidi non hanno byte: niente si tocca
  await traslocaLapidi(dopo, { ...tablet, qui: tablet.qui() });
  t.eq("sul tablet i file della SD restano", [...tablet.m.keys()].sort().join(), "kt1,kt2,kt3");
  // sul PC arrivano le lapidi: i suoi byte vanno sotto la chiave del brano tenuto
  const pc = memoria(["kp1", "kp2", "kp3"]);
  const esito = await traslocaLapidi(dopo, { ...pc, qui: pc.qui() });
  t.eq("sul PC i byte passano al brano tenuto, e il suo vecchio posto si libera", [...pc.m.keys()].sort().join(), "kp3,kt1,kt2");
  t.eq("…sono proprio quei byte", pc.m.get("kt1").byte, "byte di kp1");
  t.eq("il conto", `${esito.spostati}|${esito.tolti}`, "2|2");
  // rifatto (un giro interrotto, o il giro dopo): niente cambia
  await traslocaLapidi(dopo, { ...pc, qui: pc.qui() });
  t.eq("rifarlo non cambia niente", [...pc.m.keys()].sort().join(), "kp3,kt1,kt2");
  // un intoppo nel portare i byte: restano dove sono
  const rotto = memoria(["kp1"]);
  await traslocaLapidi(dopo, { ...rotto, qui: rotto.qui(), metti: async () => { throw new Error("pieno"); } });
  t.c("un intoppo lascia i byte dov'erano", rotto.m.has("kp1"));
  // due voci con la stessa chiave dei byte: la lapide non cancella quelli della tenuta
  const stessa = memoria(["kq"]);
  await traslocaLapidi([{ id: "q1", trackId: "kq" }, { id: "q2", deleted: true, unito: "q1", trackId: "kq" }], { ...stessa, qui: stessa.qui() });
  t.c("una copia con la stessa chiave non porta via i byte della tenuta", stessa.m.has("kq"));
  // una lapide qualunque lascia andare i suoi byte, come prima
  const via = memoria(["kz"]);
  await traslocaLapidi([{ id: "z", deleted: true, trackId: "kz" }], { ...via, qui: via.qui() });
  t.c("una melodia tolta a mano lascia andare i suoi byte", !via.m.has("kz"));

  // ---- IL LIBRO CHE SUONAVA UNA COPIA ---------------------------------------------
  t.eq("un legame alla copia tolta trova la tenuta", tracciaViva("kp1", dopo), "kt1");
  t.eq("…un legame qualunque resta com'è", tracciaViva("kt3", dopo), "kt3");
  const vivi = dopo.filter((f) => !f.deleted);
  const ripresa = comeRiprendere({ trackId: "kp2", name: "Orizzonte", raccolta: "r1" }, { raccolte, favs: vivi, tutte: dopo });
  t.c("«▶ Riprendi» di un libro che suonava la copia riparte dalla tenuta, nella raccolta", ripresa.raccolta?.id === "r1" && ripresa.brani[ripresa.da]?.id === "t2");
}
