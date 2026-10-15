// IL FILE DI UN LIBRO CHE QUI NON C'E', SCELTO DA «APRI» (chiesto dal
// lettore: «se clicco apri il libro puoi portarmi alle cartelle locali»).
// Sul computer il selettore parte dalla cartella del disco; dove non c'e'
// si usa l'input dei libri.
import { scegliDalDisco, ID_DISCO } from "../src/lib/sceltaFile.js";

const computer = (picker) => ({ navigator: { userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }, showDirectoryPicker: () => {}, showOpenFilePicker: picker });

export default async (t) => {
  let chiesto = null;
  const file = { name: "Mort.epub" };
  const scelti = await scegliDalDisco(computer(async (o) => ((chiesto = o), [{ getFile: async () => file }])));
  t.eq("sul computer il file scelto arriva", scelti[0], file);
  t.eq("dalla cartella del disco: lo stesso id di «Controlla il disco»", chiesto?.id, ID_DISCO);
  t.c("solo libri e fumetti", JSON.stringify(chiesto?.types).includes(".epub") && JSON.stringify(chiesto?.types).includes(".cbr"));
  t.eq("annullato: niente, e niente input", (await scegliDalDisco(computer(async () => { throw Object.assign(new Error("x"), { name: "AbortError" }); }))).length, 0);
  t.eq("un rifiuto vero (senza tocco): si ripiega sull'input", await scegliDalDisco(computer(async () => { throw Object.assign(new Error("x"), { name: "SecurityError" }); })), null);
  t.eq("sul tablet l'input dei libri, anche se Chrome sa scegliere", await scegliDalDisco({ navigator: { userAgent: "Mozilla/5.0 (Linux; Android 10; K)" }, showDirectoryPicker: () => {}, showOpenFilePicker: async () => [{ getFile: async () => file }] }), null);
  t.eq("un browser senza selettore: l'input", await scegliDalDisco({ navigator: { userAgent: "Windows" }, showDirectoryPicker: () => {} }), null);
};
