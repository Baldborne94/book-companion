// Del dizionario in rete (Wiktionary + glossa MyMemory) qui restava un
// piccolo motore di ricerca: il lettore l'ha congedato — per le definizioni
// parola per parola preferisce il dizionario del tablet, che compare da se'
// nel menu di selezione ed e' migliore del nostro. Restano le due funzioni
// di testo che i reader usano per capire COSA e' stato selezionato; la
// scheda di casa risponde con glossario di saga, modi di dire e Oracolo
// (lib/glossary.js, lib/oracle.js).

export const cleanWord = (raw) =>
  String(raw || "")
    .replace(/[.,;:!?«»"“”'’()\[\]…—–-]/g, " ")
    .trim()
    .replace(/\s+/g, " ");

export const wordCount = (s) => (cleanWord(s) ? cleanWord(s).split(" ").length : 0);
