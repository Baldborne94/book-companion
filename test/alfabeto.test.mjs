// UN TITOLO CHE IL LETTORE SA LEGGERE ALL'IMPORT (`lib/alfabeto.js`): dopo
// le schede di JoJo scritte in giapponese, «puoi fare in modo che non
// ricapiti anche con altri manga o fumetti?»
import { inAltroAlfabeto, tieniLeggibile } from "../src/lib/alfabeto.js";

export default async (t) => {
  t.eq(
    "giapponese, cinese, coreano, cirillico, greco sono altri alfabeti; gli accenti e le virgolette no",
    ["ジョジョ", "石之海", "원피스", "Война и мир", "Ἰλιάς", "Città — «Perché» Ōkubo’s"].map(inAltroAlfabeto).join(),
    "true,true,true,true,true,false"
  );
  const m = tieniLeggibile({ title: "ワンピース 1", author: "尾田栄一郎" }, null, "One Piece v01 (2003).cbz");
  t.eq("un titolo in un altro alfabeto prende il nome del file, l'autore resta vuoto", `${m.title}|${m.author}`, "One Piece v01 (2003)|");
  t.eq("un titolo latino resta quello del file", tieniLeggibile({ title: "Romance of the Three Kingdoms", author: "Luo Guanzhong" }, null, "三国志.epub").title, "Romance of the Three Kingdoms");
  t.eq("…e se anche il nome del file e' in un altro alfabeto, resta quello letto", tieniLeggibile({ title: "ワンピース 1" }, null, "ワンピース.cbz").title, "ワンピース 1");
  const letto = { collana: { serie: "ワンピース", numero: 1 } };
  tieniLeggibile({ title: "One Piece" }, letto, "One Piece.cbz");
  t.eq("una collana in un altro alfabeto non diventa una raccolta", letto.collana, null);
  const buona = { collana: { serie: "One Piece", numero: 1 } };
  tieniLeggibile({ title: "One Piece" }, buona, "x.cbz");
  t.eq("…una latina resta", buona.collana?.serie, "One Piece");
};
