// «LIBERA SPAZIO»: togliere dal tablet i libri che stanno gia' su Drive,
// senza perdere niente (chiesto dal lettore). La regola sbaglia in silenzio
// da tutt'e due i lati: un libro tolto che su Drive non c'e' e' perduto, e
// uno tolto che su Drive c'e' ma DIVERSO si riapre coi segni spostati —
// evidenziazioni su righe che non avevi scelto, senza un errore.
import { daLiberare, FERMO_DA, PERCHE_LIBERARE, LIBERARE_DI_PARTENZA } from "../src/lib/driveCore.js";

const GIORNO = 86_400_000;
const ADESSO = 1_800_000_000_000;

export default async function (t) {
  const libri = [
    { id: "letto", title: "Letto", addedAt: ADESSO },
    { id: "lasciato", title: "Lasciato", addedAt: ADESSO },
    { id: "fermo", title: "Fermo", addedAt: ADESSO - 400 * GIORNO },
    { id: "inLettura", title: "In lettura", addedAt: ADESSO - 400 * GIORNO },
    { id: "nuovo", title: "Appena entrato", addedAt: ADESSO - GIORNO },
    { id: "ricucito", title: "Ricucito", addedAt: ADESSO },
    { id: "senzaDrive", title: "Senza Drive", addedAt: ADESSO },
    { id: "lassu", title: "Solo lassu", addedAt: ADESSO },
    { id: "tolto", title: "Tolto", fileTolto: true, addedAt: ADESSO },
    { id: "cancellatoLassu", title: "Cancellato su Drive", addedAt: ADESSO },
    { id: "grosso", title: "Grosso", addedAt: ADESSO },
  ];
  const misureQui = new Map([
    ["letto", 100], ["lasciato", 200], ["fermo", 300], ["inLettura", 400], ["nuovo", 500],
    ["ricucito", 600], ["senzaDrive", 700], ["tolto", 800], ["cancellatoLassu", 900], ["grosso", 5000],
  ]);
  const mappa = {
    letto: { id: "f1", byte: 100 }, lasciato: { id: "f2", byte: 200 }, fermo: { id: "f3", byte: 300 },
    inLettura: { id: "f4", byte: 400 }, nuovo: { id: "f5", byte: 500 }, ricucito: { id: "f6", byte: 650 },
    lassu: { id: "f7", byte: 10 }, tolto: { id: "f8", byte: 800 }, cancellatoLassu: { id: "f9", byte: 900 },
    grosso: { id: "f10", byte: 5000 },
  };
  const stati = { letto: "read", lasciato: "abandoned", ricucito: "read", tolto: "read", cancellatoLassu: "read", grosso: "read", inLettura: "reading", lassu: "read" };
  // l'ultimo tocco: «inLettura» l'hai aperto ieri, «fermo» un anno fa, gli
  // altri non hanno un'ora loro e vale l'ingresso
  const tocchi = { inLettura: ADESSO - GIORNO, fermo: ADESSO - 365 * GIORNO };
  const base = {
    misureQui,
    mappa,
    stato: (id) => stati[id] || "unread",
    toccato: (b) => tocchi[b.id] ?? b.addedAt,
    adesso: ADESSO,
  };
  const e = daLiberare(libri, base);
  const per = Object.fromEntries(e.voci.map((v) => [v.id, v.perche]));
  t.eq("i letti", per.letto, "letto");
  t.eq("i lasciati", per.lasciato, "lasciato");
  t.eq("i fermi da tre mesi, qualunque sia lo stato", per.fermo, "fermo");
  t.eq("il libro in lettura sta fra gli «altri», non fra i fermi", per.inLettura, "altri");
  t.eq("il libro appena entrato pure: conta l'ingresso, non lo zero", per.nuovo, "altri");
  t.c("e gli «altri» non partono spuntati", !LIBERARE_DI_PARTENZA.includes("altri"));
  t.c("un libro senza copia su Drive resta", !per.senzaDrive);
  t.c("un libro che i byte qui non li ha non c'e' da togliere", !per.lassu);
  t.c("un ebook gia' tolto non si ripropone", !per.tolto);
  t.eq("su Drive c'e' un file DIVERSO: sta nel suo gruppo, non con gli identici", per.ricucito, "diverso");
  t.eq("e si ricorda perche' si proponeva", e.voci.find((v) => v.id === "ricucito")?.motivo, "letto");
  t.c("il gruppo dei diversi non parte spuntato", !LIBERARE_DI_PARTENZA.includes("diverso"));
  t.eq("e si conta", e.diversi, 1);
  t.eq("prima i piu' pesanti", e.voci[0].id, "grosso");
  t.eq("la misura e' quella di qui", e.voci.find((v) => v.id === "letto")?.byte, 100);

  // Drive guardato adesso comanda sulla mappa dell'ultimo giro
  const lassu = new Map([["f1", 100], ["f2", 999], ["f3", 300], ["f10", 5000], ["f6", 650]]);
  const v = daLiberare(libri, { ...base, lassu });
  const ids = v.voci.filter((x) => x.perche !== "diverso").map((x) => x.id);
  t.c("un file cancellato da Drive nel frattempo: il libro resta", !ids.includes("cancellatoLassu"));
  t.c("un file cambiato su Drive nel frattempo: non e' fra gli identici", !ids.includes("lasciato"));
  t.eq("ma fra i diversi", v.voci.find((x) => x.id === "lasciato")?.perche, "diverso");
  t.c("quelli ancora identici se ne vanno", ids.includes("letto") && ids.includes("fermo") && ids.includes("grosso"));
  t.eq("i diversi si contano anche guardando Drive adesso", v.diversi, 2);

  // la soglia
  const giusto = daLiberare([{ id: "x", addedAt: 0 }], {
    ...base,
    misureQui: new Map([["x", 1]]),
    mappa: { x: { id: "fx", byte: 1 } },
    toccato: () => ADESSO - FERMO_DA,
  });
  t.eq("a tre mesi esatti e' fermo", giusto.voci[0]?.perche, "fermo");
  const quasi = daLiberare([{ id: "x" }], {
    ...base,
    misureQui: new Map([["x", 1]]),
    mappa: { x: { id: "fx", byte: 1 } },
    toccato: () => ADESSO - FERMO_DA + 1,
  });
  t.eq("un attimo prima non e' fermo: e' fra gli altri", quasi.voci[0]?.perche, "altri");
  const ignota = daLiberare([{ id: "x" }], { ...base, misureQui: new Map([["x", 1]]), mappa: { x: { id: "fx", byte: 0 } }, stato: () => "read" });
  t.c("una misura su Drive che non si sa non e' «diversa» e non si toglie", !ignota.voci.length && !ignota.diversi);
  t.eq("le ragioni hanno tutte un gruppo nel pannello", PERCHE_LIBERARE.join(","), "letto,lasciato,fermo,altri,diverso");
  t.c("e quelle di partenza sono un pezzo di quelle", LIBERARE_DI_PARTENZA.every((p) => PERCHE_LIBERARE.includes(p)));
  const inCorso = daLiberare([{ id: "x" }], { ...base, misureQui: new Map([["x", 1]]), mappa: { x: { id: "fx", byte: 2 } }, stato: () => "reading", toccato: () => ADESSO });
  t.eq("un libro in lettura con la copia diversa sta fra i diversi, col suo motivo", inCorso.voci[0]?.perche + "/" + inCorso.voci[0]?.motivo, "diverso/altri");
  t.eq("senza niente, niente", daLiberare([], {}).voci.length, 0);
}
