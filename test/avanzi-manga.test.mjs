// GLI AVANZI DELLA PARTE MANGA (`lib/avanziManga.js`): la lista delle serie
// seguite se ne va, il resto della memoria resta.
import { avanziManga, CHIAVI_MANGA, CHIAVI_AUTORI } from "../src/lib/avanziManga.js";

const memoria = (voci) => {
  const m = new Map(Object.entries(voci));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), removeItem: (k) => m.delete(k), m };
};

export default async function (t) {
  const st = memoria({ bc_serie: "[]", bc_books: "[1]", bc_sfondo: "1" });
  t.eq("la lista delle serie seguite se ne va", avanziManga(st), 1);
  t.c("…e il resto resta", !st.m.has("bc_serie") && st.m.get("bc_books") === "[1]" && st.m.get("bc_sfondo") === "1");
  t.eq("la seconda volta non c'e' niente", avanziManga(st), 0);
  t.eq("senza memoria non cade", avanziManga({ getItem: () => { throw new Error("no"); } }), 0);
  t.c("le chiavi sono quelle della stanza tolta", CHIAVI_MANGA.length === 1 && CHIAVI_MANGA[0] === "bc_serie");
  // e la memoria della sezione «I libri dei tuoi autori», tolta: la lista
  // Da prendere, dove quella sezione scriveva, resta
  const a = memoria({ bc_altri_autore: "{}", bc_da_prendere: "[2]" });
  t.eq("la memoria delle opere degli autori se ne va", avanziManga(a), 1);
  t.c("…e Da prendere resta", !a.m.has("bc_altri_autore") && a.m.get("bc_da_prendere") === "[2]");
  t.c("la chiave e' quella della sezione tolta", CHIAVI_AUTORI.length === 1 && CHIAVI_AUTORI[0] === "bc_altri_autore");
}
