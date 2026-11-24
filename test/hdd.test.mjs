// IL DISCO DEL COMPUTER: i nomi che Windows accetta, e i tasti del disco
// solo dove c'e' l'HDD della biblioteca (il computer, non il tablet).
import { nomeSicuro, hddPossibile, cartellaDentro } from "../src/lib/hdd.js";

function cartellaFinta(nome = "") {
  const dentro = new Map();
  return {
    name: nome,
    dentro,
    async getDirectoryHandle(n, { create = false } = {}) {
      if (!dentro.has(n)) {
        if (!create) throw Object.assign(new Error("no"), { name: "NotFoundError" });
        dentro.set(n, cartellaFinta(n));
      }
      return dentro.get(n);
    },
  };
}

export default async (t) => {
  t.eq("i nomi che Windows rifiuta", nomeSicuro('Hellboy: Year 2?.cbz'), "Hellboy_ Year 2_.cbz");
  t.eq("niente punto in fondo", nomeSicuro("Fine. "), "Fine");
  t.eq("un nome vuoto non fa una cartella senza nome", nomeSicuro("  "), "_");

  const radice = cartellaFinta("book-companion");
  const c = await cartellaDentro(radice, ["Fumetti", "Hellboy: Omnibus"]);
  t.eq("le cartelle si fanno una dentro l'altra, coi nomi sicuri", `${[...radice.dentro.keys()]}/${[...radice.dentro.get("Fumetti").dentro.keys()]}/${c.name}`, "Fumetti/Hellboy_ Omnibus/Hellboy_ Omnibus");
  t.c("rifatte, sono le stesse", (await cartellaDentro(radice, ["Fumetti", "Hellboy: Omnibus"])) === c);

  t.c("senza showDirectoryPicker (Firefox) non si offre", !hddPossibile({}) && hddPossibile({ showDirectoryPicker() {} }));
  const android = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36";
  t.c("sul tablet no, anche se Chrome per Android sa scegliere una cartella", !hddPossibile({ showDirectoryPicker() {}, navigator: { userAgent: android } }));
  t.c("nemmeno sull'iPad che si dice Mac", !hddPossibile({ showDirectoryPicker() {}, navigator: { userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", maxTouchPoints: 5 } }));
  t.c("il Mac col mouse si'", hddPossibile({ showDirectoryPicker() {}, navigator: { userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", maxTouchPoints: 0 } }));
};
