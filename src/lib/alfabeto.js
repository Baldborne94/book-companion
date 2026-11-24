// UN TITOLO CHE IL LETTORE SA LEGGERE (segnalato con le schede di JoJo
// scritte in giapponese, poi: «puoi fare in modo che non ricapiti anche con
// altri manga o fumetti?»). Greco, cirillico, ebraico e arabo, thai, kana,
// ideogrammi, hangul: il lettore legge l'italiano e l'inglese.
export const ALTRO_ALFABETO = /[Ͱ-ϿЀ-ӿ֐-ۿ฀-๿぀-ヿ一-鿿가-힯]/;
export const inAltroAlfabeto = (t) => ALTRO_ALFABETO.test(String(t || ""));

// ALL'IMPORT: quel che il file dice di se' (il titolo e l'autore dell'ePub,
// la scheda ComicInfo di un fumetto, la collana) vale solo se si legge.
// Un titolo in un altro alfabeto lascia il posto al nome del file, se quello
// si legge; un autore resta vuoto (si scrive a mano, o lo dice il catalogo);
// una collana in un altro alfabeto non diventa una raccolta (la saga la
// trovano le altre strade, dal titolo o dal catalogo).
export function tieniLeggibile(meta, letto, nomeFile = "") {
  const dalNome = String(nomeFile || "").replace(/\.(epub|pdf|cbz|cbr)$/i, "").trim();
  if (inAltroAlfabeto(meta.title) && dalNome && !inAltroAlfabeto(dalNome)) meta.title = dalNome;
  if (inAltroAlfabeto(meta.author)) meta.author = "";
  if (letto?.collana && inAltroAlfabeto(letto.collana.serie)) letto.collana = null;
  return meta;
}
