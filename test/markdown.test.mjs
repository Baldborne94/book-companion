// DA MARKDOWN A HTML: la pagina della privacy si genera da `PRIVACY.md`, e
// un costrutto che il convertitore non conosce non alza errori — resta un
// «**» crudo in mezzo a una frase che lo store legge. Qui si provano i
// sette costrutti che il documento usa, e che il documento VERO passi
// intero senza segni crudi.
import { readFileSync } from "node:fs";
import { daMarkdown, inLinea, segniCrudi } from "../scripts/markdown.mjs";

export default async function (t) {
  // ---- IN LINEA ----------------------------------------------------------------
  t.eq("grassetto", inLinea("un **forte** no"), "un <strong>forte</strong> no");
  t.eq("corsivo", inLinea("*niente esce*"), "<em>niente esce</em>");
  t.eq("codice", inLinea("usa `localStorage` qui"), "usa <code>localStorage</code> qui");
  t.eq("collegamento", inLinea("vedi [qui](https://x.y/z)"), 'vedi <a href="https://x.y/z" rel="noopener">qui</a>');
  // dentro il codice niente si interpreta: `bc_*` non e' un corsivo aperto
  // e la guardia e' portante solo con due codici che INSIEME formerebbero
  // un corsivo: convertendo i backtick con un replace e basta, l'asterisco
  // del primo e quello del secondo si prenderebbero per mano (mutazione
  // provata: `<code><em>a</em></code>`)
  t.eq("dentro il codice niente si interpreta", inLinea("`*a*` e `*b*`"), "<code>*a*</code> e <code>*b*</code>");
  t.eq("l'HTML del testo si sfugge", inLinea("a <b> & c"), "a &lt;b&gt; &amp; c");
  t.eq("un asterisco in mezzo a una parola non e' corsivo", inLinea("2*3*4"), "2*3*4");

  // ---- I BLOCCHI -----------------------------------------------------------------
  t.eq("titolo", daMarkdown("## 1. Titolo"), "<h2>1. Titolo</h2>");
  t.eq("filetto", daMarkdown("---"), "<hr>");
  t.eq("paragrafo su due righe", daMarkdown("una riga\ne l'altra"), "<p>una riga e l'altra</p>");
  t.eq("due paragrafi", daMarkdown("uno\n\ndue"), "<p>uno</p>\n<p>due</p>");
  t.eq(
    "elenco con la continuazione rientrata",
    daMarkdown("- **uno** che va\n  a capo;\n- due"),
    "<ul><li><strong>uno</strong> che va a capo;</li><li>due</li></ul>"
  );
  t.eq(
    "tabella",
    daMarkdown("| A | B |\n| --- | --- |\n| 1 | `2` |"),
    "<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td><code>2</code></td></tr></tbody></table>"
  );
  // un titolo dopo un paragrafo senza riga vuota in mezzo chiude il paragrafo
  t.eq("titolo attaccato al paragrafo", daMarkdown("testo\n## T"), "<p>testo</p>\n<h2>T</h2>");
  t.eq("vuoto → vuoto", daMarkdown(""), "");
  t.eq("a capo di Windows", daMarkdown("a\r\n\r\nb"), "<p>a</p>\n<p>b</p>");

  // ---- IL DOCUMENTO VERO PASSA INTERO --------------------------------------------
  const md = readFileSync(new URL("../PRIVACY.md", import.meta.url), "utf8");
  const html = daMarkdown(md);
  t.c("nessun segno crudo nella privacy", !segniCrudi(html));
  t.c("il rilevatore vede un grassetto crudo", segniCrudi("<p>a **b** c</p>"));
  t.c("e una voce d'elenco cruda", segniCrudi("<p>x</p>\n- voce"));
  t.c("ma non un elenco convertito", !segniCrudi("<ul><li>voce</li></ul>"));
  const titoli = (md.match(/^#{1,3} /gm) || []).length;
  t.eq("tutti i titoli sono titoli", (html.match(/<h[1-3]>/g) || []).length, titoli);
  const voci = (md.match(/^- /gm) || []).length;
  t.eq("tutte le voci sono voci", (html.match(/<li>/g) || []).length, voci);
  t.c("la tabella dei servizi c'e'", /<table>/.test(html) && /openlibrary\.org/.test(html));
  t.c("e la data in cima", /Ultimo aggiornamento: \d+ \w+ \d{4}/.test(html));
  // la pagina generata e' in pari col documento: chi tocca PRIVACY.md e
  // non rigenera lascerebbe sul sito la versione vecchia (la build lo fa
  // da se', ma il repository deve dire quel che il sito serve)
  const pagina = readFileSync(new URL("../public/privacy.html", import.meta.url), "utf8");
  t.c("public/privacy.html e' generata da questo PRIVACY.md", pagina.includes(html));
}
