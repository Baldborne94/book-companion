// IL QUADERNO DI COLAB (`strumenti/cbr-in-cbz.ipynb`) porta dentro il codice
// di `strumenti/cbr_in_cbz.py`, che e' quello provato al banco. Se i due si
// separano, su Colab girerebbe un codice che nessuno ha provato.
import { readFileSync } from "node:fs";

export default async (t) => {
  const qui = new URL("../strumenti/", import.meta.url);
  const nb = JSON.parse(readFileSync(new URL("cbr-in-cbz.ipynb", qui), "utf8"));
  const codice = readFileSync(new URL("cbr_in_cbz.py", qui), "utf8");
  const celle = nb.cells.filter((c) => c.cell_type === "code").map((c) => c.source.join(""));
  t.c("il quaderno porta il codice provato, uguale", celle.includes(codice));
  t.c("…e lo chiama sulla cartella dell'app", celle.some((c) => /MyDrive\/book-companion/.test(c) && /converti_tutti\(CARTELLA\)/.test(c)));
  t.c("…dopo aver montato Drive", celle.findIndex((c) => /drive\.mount/.test(c)) < celle.findIndex((c) => /converti_tutti\(CARTELLA\)/.test(c)));
};
