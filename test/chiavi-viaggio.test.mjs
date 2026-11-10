// LE CHIAVI VIAGGIANO FRA I DISPOSITIVI (`lib/chiaviInViaggio.js`): chiesto
// dal lettore, che la chiave di Hardcover non se la ricordava: «falla
// sincronizzare sugli altri dispositivi», e «stessa cosa per la chiave di
// Claude». Voci `chiave|<nome>` nella colonna delle raccolte, vince la piu'
// nuova, una chiave tolta e' una lapide.
import { leggiChiavi, scriviChiavi, segnaChiave, fondiChiavi, PREFISSO_CHIAVE, CHIAVI } from "../src/lib/chiaviInViaggio.js";
import { inViaggio, dalViaggio } from "../src/lib/votiRaccolte.js";
import { salvaChiaveHardcover } from "../src/lib/hardcover.js";
import { fondiPreferite } from "../src/lib/raccoltePreferite.js";

const memoria = () => {
  const m = new Map();
  return { m, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};

export default async (t) => {
  // ── NELLA COLONNA DELLE RACCOLTE ──────────────────────────────────────
  const voce = { id: "chiave|hardcover", k: "hc_pat_A", updatedAt: 5 };
  const lista = inViaggio([{ id: "saga|x", updatedAt: 1 }], [], [{ id: "qui|tab", updatedAt: 1 }], [voce]);
  const tornate = dalViaggio(lista);
  t.eq("partono con le altre voci e tornano al loro posto", `${tornate.chiavi.map((v) => v.id)} | ${tornate.preferite.map((v) => v.id)} | ${tornate.dispositivi.map((v) => v.id)}`, "chiave|hardcover | saga|x | qui|tab");
  t.eq("…e la fusione della colonna le tratta come ogni voce (la piu' nuova vince)", fondiPreferite([voce], [{ ...voce, k: "hc_pat_B", updatedAt: 9 }])[0].k, "hc_pat_B");

  // ── LE CHIAVI DI QUI ──────────────────────────────────────────────────
  const qui = memoria();
  qui.setItem(CHIAVI.oracolo, "sk-ant-vecchia");
  t.eq("una chiave che c'era gia' parte, con l'ora 1 (non copre mai una cambiata altrove)", JSON.stringify(leggiChiavi(qui)), JSON.stringify([{ id: `${PREFISSO_CHIAVE}oracolo`, k: "sk-ant-vecchia", updatedAt: 1 }]));
  segnaChiave("hardcover", "hc_pat_qui", { st: qui, ora: 100, avvisa: false });
  t.eq("salvata qui: la voce con la sua ora", leggiChiavi(qui).find((v) => v.id === "chiave|hardcover")?.updatedAt, 100);
  segnaChiave("hardcover", "", { st: qui, ora: 200, avvisa: false });
  t.eq("tolta qui: una lapide", JSON.stringify(leggiChiavi(qui).find((v) => v.id === "chiave|hardcover")), JSON.stringify({ id: "chiave|hardcover", updatedAt: 200, deleted: true }));
  segnaChiave("altro", "x", { st: qui, ora: 300, avvisa: false });
  t.c("un nome che non e' una chiave dell'app non si segna", !leggiChiavi(qui).some((v) => v.id === "chiave|altro"));

  // ── L'ARRIVO ──────────────────────────────────────────────────────────
  const tablet = memoria();
  tablet.setItem(CHIAVI.oracolo, "sk-ant-vecchia");
  scriviChiavi([{ id: "chiave|hardcover", k: "hc_pat_dal_pc", updatedAt: 500 }, { id: "chiave|oracolo", k: "sk-ant-nuova", updatedAt: 400 }], { st: tablet });
  t.eq("arrivate dal PC: la chiave di Hardcover al suo posto", tablet.getItem(CHIAVI.hardcover), "hc_pat_dal_pc");
  t.eq("…e quella dell'Oracolo cambiata la' vince su quella di prima qui", tablet.getItem(CHIAVI.oracolo), "sk-ant-nuova");
  segnaChiave("oracolo", "sk-ant-del-tablet", { st: tablet, ora: 900, avvisa: false });
  tablet.setItem(CHIAVI.oracolo, "sk-ant-del-tablet");
  scriviChiavi([{ id: "chiave|oracolo", k: "sk-ant-nuova", updatedAt: 400 }], { st: tablet });
  t.eq("una chiave piu' vecchia che arriva non copre quella cambiata qui dopo", tablet.getItem(CHIAVI.oracolo), "sk-ant-del-tablet");
  scriviChiavi([{ id: "chiave|hardcover", updatedAt: 600, deleted: true }], { st: tablet });
  t.eq("tolta sull'altro, si toglie anche qui", tablet.getItem(CHIAVI.hardcover), null);
  t.eq("a pari ora vince la lapide", fondiChiavi([{ id: "chiave|oracolo", k: "a", updatedAt: 7 }], [{ id: "chiave|oracolo", updatedAt: 7, deleted: true }])[0].deleted, true);

  // ── CHI SALVA LA CHIAVE LA SEGNA ──────────────────────────────────────
  const pc = memoria();
  salvaChiaveHardcover("Bearer hc_pat_salvata", pc);
  const hcPc = leggiChiavi(pc).find((v) => v.id === "chiave|hardcover");
  // con l'ora vera: con l'ora 1 delle chiavi di prima perderebbe con qualunque chiave salvata altrove
  t.eq("la chiave di Hardcover salvata dalle Impostazioni si segna per il viaggio, nuda, con la sua ora", `${hcPc?.k} ${hcPc?.updatedAt > 1e12}`, "hc_pat_salvata true");
  const prima = globalThis.localStorage;
  globalThis.localStorage = memoria();
  try {
    const { setOracleKey } = await import("../src/lib/oracle.js");
    setOracleKey("sk-ant-dall-oracolo");
    const or = leggiChiavi(globalThis.localStorage).find((v) => v.id === "chiave|oracolo");
    t.eq("…e cosi' quella dell'Oracolo", `${or?.k} ${or?.updatedAt > 1e12}`, "sk-ant-dall-oracolo true");
  } finally {
    if (prima === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = prima;
  }
};
