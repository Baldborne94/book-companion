// I TITOLI IN UN ALTRO ALFABETO (`lib/titoliLeggibili.js`): le schede di
// JoJo aggiunte da Hardcover col titolo giapponese («ジョジョの奇妙な冒険 1
// 侵略者ディオ»). Su Hardcover, il 14 novembre, 85 dei 130 numeri della
// serie hanno solo il titolo giapponese.
import { daRileggere, titoliDaProporre } from "../src/lib/titoliLeggibili.js";
import { titoloLeggibile } from "../src/lib/hardcover.js";

const libro = (id, title, sagaOrder) => ({ id, title, sagaOrder, saga: "JoJo's Bizarre Adventure" });
const RACCOLTA = [
  libro("a", "ジョジョの奇妙な冒険 1 侵略者ディオ", 1),
  libro("b", "ジョジョの奇妙な冒険 20 爆弾仕かけのオレンジ", 20),
  libro("c", "スティール・ボール・ラン 1", 81),
  libro("d", "JoJo's Bizarre Adventure: Part 1--Phantom Blood, Vol. 2", 2),
  libro("e", "ジョジョの奇妙な冒険 番外", null),
];
// come li da' `serieHardcover`: il titolo latino dove c'e', se no ricostruito
const HC = [
  { numero: 1, titolo: "Jojo's Bizarre Adventure, Tome 1: Dio, L'envahisseur" },
  { numero: 20, titolo: "JoJo’s Bizarre Adventure, Vol. 20", ricostruito: true },
  { numero: 81, titolo: "JoJo’s Bizarre Adventure: Part 7 — Steel Ball Run, Vol. 1" },
  { numero: 81.5, titolo: "Uno spin-off", novella: true },
];

export default async (t) => {
  t.eq("si rileggono i titoli in un altro alfabeto col loro numero", daRileggere(RACCOLTA).map((b) => b.id).join(), "a,b,c");
  const p = titoliDaProporre(RACCOLTA, "JoJo's Bizarre Adventure", HC);
  t.eq(
    "il titolo latino di Hardcover allo stesso numero, se no il nome della raccolta col numero",
    p.map((x) => `${x.numero} ${x.fonte} ${x.a}`).join(" | "),
    "1 hardcover Jojo's Bizarre Adventure, Tome 1: Dio, L'envahisseur | 20 numero JoJo's Bizarre Adventure, Vol. 20 | 81 hardcover JoJo’s Bizarre Adventure: Part 7 — Steel Ball Run, Vol. 1"
  );
  t.eq("senza Hardcover, il nome della raccolta col numero", titoliDaProporre(RACCOLTA, "JoJo's Bizarre Adventure").map((x) => x.a).join(" | "), "JoJo's Bizarre Adventure, Vol. 1 | JoJo's Bizarre Adventure, Vol. 20 | JoJo's Bizarre Adventure, Vol. 81");
  t.eq("…e una storia di mezzo non presta il titolo al romanzo", titoliDaProporre([libro("x", "ジョジョ", 81)], "", [{ numero: 81, titolo: "Spin", novella: true }]).length, 0);
  t.eq("un titolo di Hardcover ancora giapponese non si propone", titoliDaProporre([libro("x", "ジョジョ 5", 5)], "", [{ numero: 5, titolo: "ジョジョの奇妙な冒険 5" }]).length, 0);
  t.eq("una raccolta col nome in un altro alfabeto non da' titoli", titoliDaProporre(RACCOLTA, "ジョジョの奇妙な冒険").length, 0);
  t.eq("un titolo latino resta com'e'", titoloLeggibile("Stone Ocean 1", "JoJo", 64), "Stone Ocean 1");
  t.eq("…e senza numero anche quello giapponese", titoloLeggibile("ジョジョ", "JoJo", null), "ジョジョ");
};
