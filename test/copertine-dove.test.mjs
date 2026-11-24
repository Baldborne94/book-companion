// DOVE STA IL FILE DI CHI NON HA LA COPERTINA (`copertineDaDove`,
// `fraseCopertineAltrove` in `lib/copertina.js`). Segnalato dal lettore sul
// PC: «Ritrova 183 copertine», e al tocco «183 non sono su questo
// dispositivo». Il tasto contava tutta la biblioteca e poteva leggere solo
// i file di qui; adesso conta quelli, e il resto si dice con la sua strada.
import { copertineDaDove, fraseCopertineAltrove } from "../src/lib/copertina.js";

const L = (id, extra = {}) => ({ id, title: id, fileType: "epub", ...extra });

export default async (t) => {
  const libri = [
    L("qui"),
    L("conCop"),
    L("guardato"),
    L("disco"),
    L("tablet"),
    L("discoETablet"),
    L("senza", { fileType: "nessuno", fileTolto: true }),
    L("perso"),
  ];
  const d = copertineDaDove(libri, {
    conCopertina: new Set(["conCop"]),
    guardati: new Set(["guardato"]),
    qui: new Set(["qui", "conCop"]),
    sulDisco: new Set(["disco", "discoETablet"]),
    altrove: new Map([["tablet", "Tablet"], ["discoETablet", "Tablet"]]),
  });
  const ids = (xs) => xs.map((b) => b.id).join(",");
  t.eq("il tasto conta solo chi ha il file qui", ids(d.qui), "qui");
  t.eq("sul disco (anche se c'e' sul tablet: il disco si legge da qui)", ids(d.disco), "disco,discoETablet");
  t.eq("sull'altro dispositivo", ids(d.altrove), "tablet");
  t.eq("le schede senza ebook a parte", ids(d.senzaFile), "senza");
  t.eq("e quel che non sta da nessuna parte nota", ids(d.persi), "perso");
  t.eq(
    "la frase dice ognuna con la sua strada",
    fraseCopertineAltrove(d),
    "5 copertine che mancano non si ritrovano da qui: 2 hanno il file sul disco (le legge «Controlla il disco»), 1 su un altro dispositivo (ritrovala da lì, poi arriva anche qui), 1 è una scheda senza ebook (la copertina si mette dalla scheda), 1 ha un file che non so dove sia."
  );
  t.eq("tutte qui: niente da dire", fraseCopertineAltrove(copertineDaDove([L("a")], { qui: new Set(["a"]) })), "");
  t.eq(
    "al plurale",
    fraseCopertineAltrove({ altrove: [1, 2], senzaFile: [1, 2] }),
    "4 copertine che mancano non si ritrovano da qui: 2 su un altro dispositivo (ritrovale da lì, poi arrivano anche qui), 2 sono schede senza ebook (la copertina si mette dalla scheda)."
  );
  t.eq("una sola", fraseCopertineAltrove({ disco: [1] }), "Una copertina che manca non si ritrova da qui: 1 ha il file sul disco (le legge «Controlla il disco»).");
};
