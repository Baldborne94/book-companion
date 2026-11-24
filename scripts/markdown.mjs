// DA MARKDOWN A HTML, il minimo che serve alla privacy. Niente libreria:
// il documento usa titoli, paragrafi, elenchi puntati, grassetto, corsivo,
// codice in linea, collegamenti, una tabella e un filetto — e basta. Una
// libreria intera per sette costrutti sarebbe una dipendenza da tenere
// aggiornata per una pagina che cambia tre volte l'anno.
//
// Sta in `scripts/` e non in `src/lib/` perche' gira a build, non in app;
// e' esportata perche' il test la provi — una riga di Markdown lasciata
// cruda nella pagina della privacy non alza errori, si legge e basta.

const sfuggi = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// dentro una riga: codice PRIMA di tutto (dentro i backtick niente si
// interpreta), poi collegamenti, grassetto, corsivo
export function inLinea(testo) {
  const pezzi = [];
  const parti = sfuggi(testo).split(/(`[^`]+`)/);
  for (const p of parti) {
    if (/^`[^`]+`$/.test(p)) {
      pezzi.push(`<code>${p.slice(1, -1)}</code>`);
      continue;
    }
    pezzi.push(
      p
        .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" rel="noopener">$1</a>')
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, "$1<em>$2</em>")
    );
  }
  return pezzi.join("");
}

const cella = (riga) =>
  riga
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());

export function daMarkdown(md) {
  const righe = String(md || "").replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  let i = 0;
  const vuota = (r) => !r || !r.trim();

  while (i < righe.length) {
    const r = righe[i];
    if (vuota(r)) {
      i += 1;
      continue;
    }
    const titolo = /^(#{1,6})\s+(.*)$/.exec(r);
    if (titolo) {
      const n = titolo[1].length;
      out.push(`<h${n}>${inLinea(titolo[2].trim())}</h${n}>`);
      i += 1;
      continue;
    }
    if (/^---+\s*$/.test(r)) {
      out.push("<hr>");
      i += 1;
      continue;
    }
    // tabella: riga di intestazione, riga di trattini, poi le righe
    if (/^\|/.test(r) && /^\|?\s*:?-{3,}/.test(righe[i + 1] || "")) {
      const testa = cella(r);
      i += 2;
      const corpo = [];
      while (i < righe.length && /^\|/.test(righe[i])) {
        corpo.push(cella(righe[i]));
        i += 1;
      }
      out.push(
        "<table><thead><tr>" +
          testa.map((c) => `<th>${inLinea(c)}</th>`).join("") +
          "</tr></thead><tbody>" +
          corpo.map((cs) => "<tr>" + cs.map((c) => `<td>${inLinea(c)}</td>`).join("") + "</tr>").join("") +
          "</tbody></table>"
      );
      continue;
    }
    // elenco puntato: le righe rientrate sotto una voce sono la sua
    // continuazione (il documento va a capo a 78 colonne)
    if (/^[-*]\s+/.test(r)) {
      const voci = [];
      while (i < righe.length && /^[-*]\s+/.test(righe[i])) {
        let voce = righe[i].replace(/^[-*]\s+/, "");
        i += 1;
        while (i < righe.length && /^\s+\S/.test(righe[i])) {
          voce += " " + righe[i].trim();
          i += 1;
        }
        voci.push(voce);
      }
      out.push("<ul>" + voci.map((v) => `<li>${inLinea(v)}</li>`).join("") + "</ul>");
      continue;
    }
    // paragrafo: fino alla prima riga vuota o al primo blocco d'altro tipo
    const pezzi = [];
    while (
      i < righe.length &&
      !vuota(righe[i]) &&
      !/^(#{1,6}\s|---+\s*$|[-*]\s+|\|)/.test(righe[i])
    ) {
      pezzi.push(righe[i].trim());
      i += 1;
    }
    out.push(`<p>${inLinea(pezzi.join(" "))}</p>`);
  }
  return out.join("\n");
}

// quel che resta di Markdown dopo la conversione: serve al test e allo
// script, che si rifiuta di scrivere una pagina con dei segni crudi dentro
export const segniCrudi = (html) => {
  const testo = html.replace(/<[^>]+>/g, "");
  return /(^|\n)\s*(#{1,6}\s|[-*]\s|\|)|\*\*|\]\(/.test(testo);
};
