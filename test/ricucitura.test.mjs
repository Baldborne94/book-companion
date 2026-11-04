// QUALI DOCUMENTI SI RICUCIONO (`gruppiDellaSpina` in
// `src/lib/unisciEpub.js`). I libri spezzati si cuciono in mezzo e in
// coda; il contorno in testa no (il lettore, con la foto di «A Thousand
// Sons»: titolo, motto, introduzione e contenuti attaccati sulla stessa
// pagina).
import { gruppiDellaSpina } from "../src/lib/unisciEpub.js";
import { tagliaAMetaFrase } from "../src/lib/visita.js";

const v = (id, inToc, testo = "") => ({ id, inToc, testo });
const forma = (gruppi) => gruppi.map((g) => g.map((x) => x.id).join("+")).join(" | ");
const lungo = (s) => s.padEnd(260, " parole");

export default async function (t) {
  // il libro della Black Library: il contorno in testa e fuori indice
  const bl = [v("titolo", false), v("motto", false), v("leggenda", false), v("contenuti", false), v("personae", true), v("c1", true), v("c2", true)];
  t.eq("il contorno in testa resta pagina per pagina", forma(gruppiDellaSpina(bl, tagliaAMetaFrase)), "titolo | motto | leggenda | contenuti | personae | c1 | c2");
  // Guards! Guards!: i pezzi fuori indice IN MEZZO alla storia si cuciono
  const spezzato = [v("titolo", false), v("c1", true), v("c1b", false), v("c1c", false), v("c2", true), v("c2b", false)];
  t.eq("in mezzo e in coda i pezzi fuori indice si cuciono", forma(gruppiDellaSpina(spezzato, tagliaAMetaFrase)), "titolo | c1+c1b+c1c | c2+c2b");
  // Calibre: una voce d'indice DENTRO lo split, ma il testo e' tagliato a
  // meta' frase — si cuce lo stesso, anche in testa
  const meta = [v("a", false, lungo("e la nebbia saliva dal fiume") + " mentre"), v("b", false, lungo("copriva le strade di Ankh-Morpork")), v("c1", true)];
  t.eq("il taglio a meta' frase si cuce anche in testa", forma(gruppiDellaSpina(meta, tagliaAMetaFrase)), "a+b | c1");
  const metaInToc = [v("c1", true, lungo("La nebbia saliva") + " mentre"), v("c1x", true, lungo("copriva le strade"))];
  t.eq("…e anche quando l'indice apre il pezzo", forma(gruppiDellaSpina(metaInToc, tagliaAMetaFrase)), "c1+c1x");
  t.eq("senza indice niente si cuce per l'indice", forma(gruppiDellaSpina([v("a", false), v("b", false)], tagliaAMetaFrase)), "a | b");
  t.eq("una spina vuota non fa gruppi", gruppiDellaSpina([], tagliaAMetaFrase).length, 0);
  t.eq("il primo documento in indice comincia sempre un gruppo", forma(gruppiDellaSpina([v("x", false), v("c1", true), v("y", false)], tagliaAMetaFrase)), "x | c1+y");
}
