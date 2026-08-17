// IL GIARDINO NON AVEVA UNA PORTA D'USCITA. Le citazioni si vedevano, si
// cancellavano e ci si tornava dentro nel libro: non si copiavano, non si
// esportavano e non si cercavano. Eppure sono la cosa che piu' naturalmente
// vuoi portare FUORI dall'app — in un messaggio, in un quaderno.
//
// Qui c'e' tutto quello che si puo' provare senza un DOM: raccolta,
// ricerca, e il testo da mettere negli appunti o in un file.

const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

// `leggi(id)` torna `{ highlights, marks }`: il modulo non sa da dove
// vengano, cosi' un test puo' dargliele a mano.
export function raccogli(books = [], leggi = () => ({})) {
  return (books || [])
    .map((book) => {
      const { highlights = [], marks = [] } = leggi(book.id) || {};
      return { book, citazioni: [...highlights], segni: [...marks] };
    })
    .filter((g) => g.citazioni.length || g.segni.length);
}

// A RIPOSO IL GIARDINO E' UN GIARDINO: solo citazioni, come e' sempre
// stato. Diventa una ricerca solo quando scrivi qualcosa, e allora comprende
// anche i segnalibri — le loro etichette portano il nome del capitolo, ed e'
// li' che uno cerca «dove avevo messo il segno nel capitolo dei nani».
//
// Il titolo del libro vale come chiave per le citazioni ma NON per i
// segnalibri: quelle etichette se le scrive l'app da sola, e su un romanzo
// pieno di segni cercare l'autore avrebbe seppellito le citazioni sotto
// quaranta righe che non hai scritto tu.
export function filtra(gruppi = [], query = "") {
  const q = norm(query).trim();
  if (!q) return gruppi.map((g) => ({ ...g, segni: [] })).filter((g) => g.citazioni.length);
  const dentro = (s) => norm(s).includes(q);
  return gruppi
    .map((g) => {
      const suo = dentro(g.book?.title) || dentro(g.book?.author);
      return {
        ...g,
        citazioni: suo ? g.citazioni : g.citazioni.filter((c) => dentro(c.text) || dentro(c.note)),
        segni: g.segni.filter((m) => dentro(m.label)),
      };
    })
    .filter((g) => g.citazioni.length || g.segni.length);
}

export function conta(gruppi = []) {
  return gruppi.reduce(
    (acc, g) => ({
      citazioni: acc.citazioni + g.citazioni.length,
      segni: acc.segni + g.segni.length,
      libri: acc.libri + 1,
    }),
    { citazioni: 0, segni: 0, libri: 0 }
  );
}

const dataIt = (ts) =>
  ts ? new Date(ts).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" }) : "";

// Una citazione copiata da sola deve reggersi in piedi dove la incolli:
// senza il libro da cui viene e' una frase orfana, e fra un mese non sapresti
// piu' di chi era. La nota tua ci va sotto, perche' e' tua e non dell'autore.
export function testoCitazione(c = {}, book = {}) {
  const righe = [`«${String(c.text || "").trim()}»`];
  const da = [book.title, book.author].filter(Boolean).join(" — ");
  if (da) righe.push(`— ${da}`);
  if (c.note) righe.push(`✎ ${c.note}`);
  return righe.join("\n");
}

// L'archivio delle citazioni e' Markdown e non JSON: non serve a rientrare
// nell'app — per quello c'e' l'archivio vero — serve a finire in un quaderno,
// in una nota, in un messaggio. Deve essere leggibile cosi' com'e'.
export function esporta(gruppi = [], ora = Date.now()) {
  const n = conta(gruppi);
  const out = ["# Il giardino delle citazioni", ""];
  const sommario = [
    `${n.citazioni} ${n.citazioni === 1 ? "passaggio" : "passaggi"}`,
    n.segni ? `${n.segni} ${n.segni === 1 ? "segnalibro" : "segnalibri"}` : null,
    `${n.libri} ${n.libri === 1 ? "libro" : "libri"}`,
  ].filter(Boolean);
  out.push(`_${sommario.join(" · ")} — ${dataIt(ora)}_`, "");
  for (const { book, citazioni, segni } of gruppi) {
    out.push(`## ${book.title || "Senza titolo"}`);
    if (book.author) out.push(`*${book.author}*`);
    out.push("");
    for (const c of citazioni) {
      out.push(`> ${String(c.text || "").trim().replace(/\n+/g, "\n> ")}`);
      if (c.note) out.push(`>`, `> ✎ ${c.note}`);
      const d = dataIt(c.createdAt);
      if (d) out.push("", `<sub>${d}</sub>`);
      out.push("");
    }
    for (const m of segni) out.push(`- 🔖 ${m.label || "Segnalibro"}`);
    if (segni.length) out.push("");
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
