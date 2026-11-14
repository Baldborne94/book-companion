// I TITOLI IN UN ALTRO ALFABETO (segnalato dal lettore con la scheda del
// primo JoJo, «ジョジョの奇妙な冒険 1 侵略者ディオ»: «come mai i titoli
// sono così e non vengono riportati?»). Le schede aggiunte senza file da
// Hardcover prendevano di ogni numero l'edizione piu' letta, che per JoJo e'
// la giapponese (`volumiDaHardcover` ora sceglie prima un titolo latino).
// Per quelle gia' sullo scaffale, nella raccolta aperta: di ogni volume col
// titolo in un altro alfabeto e il suo numero, il titolo latino di
// Hardcover allo stesso numero, se c'e' (con la chiave); se no il nome della
// raccolta e il numero (`titoloLeggibile`). Si propone, riga per riga, e si
// scrive solo quel che resta spuntato.
import { inAltroAlfabeto, titoloLeggibile } from "./hardcover.js";

const numeroDi = (b) => {
  const n = Number(b?.sagaOrder);
  return Number.isInteger(n) && n > 0 ? n : null;
};

export const daRileggere = (libri = []) => libri.filter((b) => inAltroAlfabeto(b?.title) && numeroDi(b) != null);

// `volumi`: quelli di Hardcover (gia' passati da `titoloLeggibile`), o niente
export function titoliDaProporre(libri = [], nome = "", volumi = []) {
  const perNumero = new Map();
  for (const v of volumi || []) if (!v.novella && !v.ricostruito && !inAltroAlfabeto(v.titolo)) perNumero.set(v.numero, v.titolo);
  const proposte = [];
  for (const b of daRileggere(libri)) {
    const n = numeroDi(b);
    const daHC = perNumero.get(n);
    const a = daHC || titoloLeggibile(b.title, nome, n);
    if (a !== b.title) proposte.push({ id: b.id, numero: n, da: b.title, a, fonte: daHC ? "hardcover" : "numero" });
  }
  return proposte;
}
