// «SCARICA LA RACCOLTA» (`daPortareQui`, `portaQuiTutte`, `fraseScarico` in
// `lib/music.js`): quali melodie scendono, una alla volta, e cosa si dice.
import { daPortareQui, portaQuiTutte, fraseScarico } from "../src/lib/music.js";

export default async function (t) {
  const brani = [
    { name: "Pioggia", trackId: "a", drive: true, size: 3_000_000 },
    { name: "Camino", trackId: "b", drive: true, size: 2_000_000 },
    { name: "Arpa", trackId: "c", size: 1_000_000 },
    { name: "Vento", url: "https://youtu.be/x" },
  ];
  const d = daPortareQui(brani, new Set(["b"]));
  t.eq("scende solo quel che sta su Drive e qui manca", d.brani.map((b) => b.name).join(), "Pioggia");
  t.eq("e si dice quanto pesa", d.byte, 3_000_000);
  t.eq("tutta qui, niente da scaricare", daPortareQui(brani, new Set(["a", "b"])).brani.length, 0);

  // una alla volta, e un intoppo e' di quella melodia
  let inVolo = 0;
  let massimo = 0;
  const viste = [];
  const porta = async (b) => {
    inVolo += 1;
    massimo = Math.max(massimo, inVolo);
    await new Promise((r) => setTimeout(r, 5));
    inVolo -= 1;
    viste.push(b.name);
    if (b.name === "Camino") throw new Error("rete");
    return b.name === "Arpa" ? null : new Blob(["x"]);
  };
  const tre = brani.slice(0, 3);
  const passi = [];
  const e = await portaQuiTutte(tre, { porta, onProgress: (p) => passi.push(`${p.i + 1}/${p.totale}`) });
  t.eq("una alla volta", massimo, 1);
  t.eq("tutte provate, anche dopo un intoppo", viste.join(), "Pioggia,Camino,Arpa");
  t.eq("scese", e.fatte, 1);
  t.eq("mancate, coi nomi", e.mancate.join(), "Camino,Arpa");
  t.eq("dice a che punto e'", passi.join(), "1/3,2/3,3/3");

  // fermato dalla barra
  let quante = 0;
  const f = await portaQuiTutte(tre, { porta: async () => new Blob(["x"]), vivo: () => quante++ < 1 });
  t.c("fermato, si ferma", f.fermato && f.fatte === 1, JSON.stringify(f));

  // la chiave di Drive che chiede un tocco ferma il giro
  const giu = [];
  const s = await portaQuiTutte(tre, {
    porta: async (b) => {
      giu.push(b.name);
      const x = new Error("Google Drive non collegato");
      x.name = "DriveScollegato";
      throw x;
    },
  });
  t.c("Drive scollegato ferma tutto alla prima", s.scollegato && giu.length === 1, JSON.stringify(s));

  t.eq("il resoconto", fraseScarico(e), "1 melodia ora sta sul dispositivo · 2 non sono scese («Camino», «Arpa») 🎵");
  t.eq("e quando Drive aspetta", fraseScarico(s), "Google Drive aspetta un tocco: il resto lo scarichi riprovando 🎵");
  t.c("e quando e' fermato", /fermato/.test(fraseScarico(f)) && /1 melodia/.test(fraseScarico(f)));
}
