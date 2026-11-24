// LE COPERTINE DEI FUMETTI DA RIFARE (`copertineDaRifare` in
// `copertina.js`, chiesto dal lettore: «sì, fai il tasto per rifare le
// copertine dei fumetti»). Si rifa' dal file solo un fumetto col file qui,
// con una copertina senza il segno della nitida per il suo peso, e mai una
// copertina messa a mano; l'ePub no (la sua copertina e' quella del file).
import { copertineDaRifare, resocontoCopertine } from "../src/lib/copertina.js";
import { chiaveNitida } from "../src/lib/miniature.js";

const F = (id, extra = {}) => ({ id, title: id, fileType: "cbz", ...extra });

export default async (t) => {
  const libri = [F("vecchia"), F("nitida"), F("cambiata"), F("amano"), F("altrove"), F("senza"), F("cbr", { fileType: "cbr" }), { id: "epub", title: "epub", fileType: "epub" }];
  const qui = new Set(libri.map((b) => b.id).filter((id) => id !== "altrove"));
  const misure = new Map([["vecchia", 100], ["nitida", 200], ["cambiata", 300], ["amano", 400], ["altrove", 500], ["cbr", 600], ["epub", 700]]);
  const nitide = new Set([chiaveNitida("nitida", 200), chiaveNitida("cambiata", 299)]);
  const scelti = copertineDaRifare(libri, { qui, misure, nitide, aMano: (id) => id === "amano" }).map((b) => b.id);
  t.eq("si rifanno i fumetti senza il segno, anche CBR, e quello cambiato dopo il segno", scelti.join(), "vecchia,cambiata,cbr");
  t.c("non la nitida", !scelti.includes("nitida"));
  t.c("non quella messa a mano", !scelti.includes("amano"));
  t.c("non chi ha il file altrove", !scelti.includes("altrove"));
  t.c("non chi non ha una copertina (la ritrova «Ritrova»)", !scelti.includes("senza"));
  t.c("non l'ePub", !scelti.includes("epub"));

  t.eq("il resoconto dice rifatte", resocontoCopertine({ ritrovate: 3 }, { rifatte: true }), "3 copertine rifatte 🖼");
  t.eq("un fumetto che non si apre tiene la copertina di prima", resocontoCopertine({ ritrovate: 1, senzaImmagine: 1 }, { rifatte: true }), "una copertina rifatta 🖼, un fumetto non si è lasciato aprire: resta la copertina di prima");
  t.eq("niente da rifare", resocontoCopertine({}, { rifatte: true }), "Le copertine dei fumetti erano già nitide");
  t.eq("«Ritrova» dice ancora ritrovate", resocontoCopertine({ ritrovate: 2 }), "2 copertine ritrovate 🖼");
};
