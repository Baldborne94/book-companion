// I DUE CONTI SUI PERCORSI DENTRO UN ePub, a parte: li usano la cura
// (`unisciEpub.js`) e la diagnosi (`visita.js`), e devono essere gli stessi
// — una diagnosi che risolveva i percorsi a modo suo vedeva un libro
// spezzato che la cura non trovava. Stanno in un modulo minuscolo perche'
// la diagnosi viaggia col reader, e non deve tirarsi dietro la ricucitura.
export const dir = (p) => p.replace(/[^/]*$/, "");

// percorso di `rel` visto da `base` (una cartella), senza URL assoluti
export function risolvi(base, rel) {
  if (!rel || /^[a-z][a-z0-9+.-]*:/i.test(rel) || rel.startsWith("#")) return null;
  const parti = (base + rel.split("#")[0]).split("/");
  const fuori = [];
  for (const p of parti) {
    if (!p || p === ".") continue;
    if (p === "..") fuori.pop();
    else fuori.push(p);
  }
  return fuori.join("/");
}
