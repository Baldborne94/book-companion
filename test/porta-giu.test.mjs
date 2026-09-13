// PORTARE GIU' UNO PER VOLTA, e chi sta lassu'. È il giro di «Porta qui i
// tomi», ora condiviso con le melodie (chiesto dal lettore dal browser:
// tre melodie da file identiche a quelle del tablet, e nessuna suonava).
// Staccato da Supabase e da IndexedDB apposta: qui si prova con dei finti
// quel che sbaglia in silenzio — un giro che non si ferma, un conto che
// dice «sceso» su un byte che non c'è, una nuvoletta su una melodia che è
// già in casa.
import { portaGiu, melodieLassu } from "../src/lib/syncCore.js";

const voci = (n) => Array.from({ length: n }, (_, i) => ({ id: `v${i}`, name: `Melodia ${i}` }));

// un cloud e una casa finti: `lassu` dice chi ha i byte nel cloud, `casa`
// chi li ha già qui
function banco({ lassu = new Set(), casa = new Set(), esplode = new Set() } = {}) {
  const posati = [];
  const chiesti = [];
  const passi = [];
  const deps = {
    manca: async (v) => !casa.has(v.id),
    scarica: async (v) => {
      chiesti.push(v.id);
      if (esplode.has(v.id)) throw new Error("rete caduta");
      return lassu.has(v.id) ? `byte di ${v.id}` : null;
    },
    posa: async (v, byte) => {
      posati.push([v.id, byte]);
      casa.add(v.id);
    },
    titolo: (v) => v.name,
    onProgress: (p) => passi.push(p),
  };
  return { deps, posati, chiesti, passi };
}

export default async function (t) {
  // ---- IL GIRO NORMALE ------------------------------------------------------
  {
    const b = banco({ lassu: new Set(["v0", "v1", "v2"]) });
    const e = await portaGiu(voci(3), b.deps);
    t.eq("tre lassù, tre scese", e.scesi, 3);
    t.eq("nessuna fallita", e.falliti, 0);
    t.c("non fermato", !e.fermato);
    t.eq("i byte sono posati col loro id", b.posati.map(([id, byte]) => `${id}=${byte}`).join(","), "v0=byte di v0,v1=byte di v1,v2=byte di v2");
    t.eq("l'avanzamento conta dal primo all'ultimo", b.passi.map((p) => p.i).join(","), "0,1,2");
    t.eq("e dice il totale di chi manca, non delle voci", b.passi[0].totale, 3);
    t.eq("e il titolo di chi sta scendendo", b.passi[1].titolo, "Melodia 1");
  }

  // ---- CHI È GIÀ IN CASA NON SI RISCARICA -----------------------------------
  // e si guarda ADESSO, non al conto di prima: fra il conto e il tocco il
  // lettore può aver suonato una melodia, che è scesa da sola
  {
    const b = banco({ lassu: new Set(["v0", "v1", "v2"]), casa: new Set(["v1"]) });
    const e = await portaGiu(voci(3), b.deps);
    t.eq("due scese, la terza era già qui", e.scesi, 2);
    t.eq("e non si è nemmeno chiesta", b.chiesti.join(","), "v0,v2");
    t.eq("il totale dell'avanzamento è due, non tre", b.passi[0].totale, 2);
  }

  // ---- QUEL CHE LASSÙ NON C'È È FALLITO, NON SCESO --------------------------
  {
    const b = banco({ lassu: new Set(["v0"]) });
    const e = await portaGiu(voci(2), b.deps);
    t.eq("una scesa", e.scesi, 1);
    t.eq("una fallita", e.falliti, 1);
    t.eq("e nessun byte vuoto posato", b.posati.length, 1);
  }
  // uno scaricamento che esplode è fallito, e non porta via il giro
  {
    const b = banco({ lassu: new Set(["v0", "v1", "v2"]), esplode: new Set(["v1"]) });
    const e = await portaGiu(voci(3), b.deps);
    t.eq("l'esplosione conta come fallita", e.falliti, 1);
    t.eq("e le altre due scendono lo stesso", e.scesi, 2);
  }

  // ---- IL FILO: FERMATO A METÀ, QUEL CHE È SCESO RESTA ----------------------
  {
    const b = banco({ lassu: new Set(["v0", "v1", "v2", "v3"]) });
    let giri = 0;
    const e = await portaGiu(voci(4), { ...b.deps, vivo: () => giri++ < 2 });
    t.eq("due scese prima dello stop", e.scesi, 2);
    t.c("dichiarato fermato", e.fermato);
    t.eq("e non si è più chiesto niente", b.chiesti.join(","), "v0,v1");
  }
  // senza filo si va fino in fondo
  {
    const b = banco({ lassu: new Set(["v0"]) });
    const e = await portaGiu(voci(1), { ...b.deps, vivo: undefined });
    t.eq("senza filo il giro è intero", e.scesi, 1);
  }
  t.eq("niente da portare → zeri", JSON.stringify(await portaGiu([], banco().deps)), '{"scesi":0,"falliti":0,"fermato":false}');

  // ---- CHI STA LASSÙ (la nuvoletta) -----------------------------------------
  const favs = [
    { id: "a", name: "File qui", trackId: "t1" },
    { id: "b", name: "File lassù", trackId: "t2" },
    { id: "c", name: "YouTube", url: "https://youtu.be/x" },
    { id: "d", name: "Cancellata", trackId: "t3", deleted: true },
  ];
  const qui = new Set(["t1"]);
  t.eq("lassù c'è solo il file senza byte in casa", melodieLassu(favs, qui, true).map((f) => f.id).join(","), "b");
  t.eq("YouTube non ha byte da nessuna parte", melodieLassu(favs, new Set(), true).some((f) => f.id === "c"), false);
  t.eq("una lapide non è lassù", melodieLassu(favs, new Set(), true).some((f) => f.id === "d"), false);
  // senza cloud collegato un file mancante è una melodia rotta, non «lassù»
  t.eq("senza cloud niente nuvolette", melodieLassu(favs, qui, false).length, 0);
  // e finché il conto di chi è in casa non è arrivato non si dice niente, o
  // al primo disegno ogni melodia avrebbe la nuvoletta per un attimo
  t.eq("senza il conto di casa niente nuvolette", melodieLassu(favs, null, true).length, 0);
  t.eq("un elenco assente non esplode", melodieLassu(null, qui, true).length, 0);
}
