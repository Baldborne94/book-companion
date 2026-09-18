// I RIPIANI A ETICHETTA: genere, voto, stato.
//
// Chiesto dal lettore dopo la divisione fra saga e autore: «aggiungi voto
// e stato». Qui non c'è niente da tenere insieme — nessuna saga, nessun
// ordine di lettura — c'è una chiave per libro e un mucchio per chiave.
//
// LA PARTE CHE SBAGLIA IN SILENZIO È L'ORDINE DEI RIPIANI. Il genere si
// legge in alfabetico e va bene; un voto e uno stato no. Sull'alfabeto «5
// stelle» finirebbe dopo «4 stelle» (il «5» viene dopo il «4»), e gli
// stati uscirebbero «Abbandonati, Da leggere, In lettura, Letti» — la fine
// della storia in cima. Nessuna delle due alza un errore: si legge e basta.
import { aEtichette, criterioVoto, criterioStato, STATI } from "../src/lib/ripiani.js";

const libro = (id, extra = {}) => ({ id, title: id, ...extra });
const nomi = (r) => r.map((x) => x.nome);
const conta = (r) => r.map((x) => `${x.nome}:${x.libri.length}`);

export default async function (t) {
  // ---- IL VOTO -----------------------------------------------------------
  {
    const c = criterioVoto();
    const r = aEtichette(
      [
        libro("a", { rating: 3 }),
        libro("b", { rating: 5 }),
        libro("c", { rating: 4 }),
        libro("d", { rating: 5 }),
        libro("e"),
        libro("f", { rating: 0 }),
      ],
      c
    );
    // IL PATTO: dal voto più alto, non in alfabetico
    t.eq("i voti scendono dal più alto", conta(r).join(" · "), "5 stelle:2 · 4 stelle:1 · 3 stelle:1 · Senza voto:2");
    t.c("e chi non ha voto chiude la fila", r[r.length - 1].nome === "Senza voto");
    t.c("…ed è spento", r[r.length - 1].spento === true);
    // zero NON è un voto: è «non l'ho votato», e un ripiano «0 stelle»
    // direbbe che gli hai dato il voto più basso
    t.eq("lo zero sta coi senza voto", r.find((x) => x.nome === "Senza voto").libri.length, 2);
  }
  {
    // LE MEZZE STELLE esistono (la scheda le dà, e lo schema del cloud ha un
    // gradino apposta): 4 e 4½ sono due voti diversi e restano due ripiani
    const r = aEtichette([libro("a", { rating: 4 }), libro("b", { rating: 4.5 })], criterioVoto());
    t.eq("mezza stella fa un ripiano suo", nomi(r).join(" · "), "4½ stelle · 4 stelle");
  }
  {
    // «1 stelle» si legge come un guasto, come «1 volumi» in `fraseTace`
    const r = aEtichette([libro("a", { rating: 1 }), libro("b", { rating: 2 })], criterioVoto());
    t.c("una stella è singolare", nomi(r).includes("1 stella"), nomi(r).join(","));
    t.c("due sono plurale", nomi(r).includes("2 stelle"), nomi(r).join(","));
  }
  {
    const r = aEtichette([libro("a", { rating: 0.5 })], criterioVoto());
    t.eq("mezza stella secca non scrive «0½»", r[0].nome, "½ stella");
  }

  // ---- LO STATO ----------------------------------------------------------
  {
    // `leggiStato` si passa da fuori: lo stato sta in `localStorage` e un
    // test in Node non ce l'ha
    const stati = { a: "read", b: "unread", c: "reading", d: "abandoned", e: "read" };
    const r = aEtichette(
      ["a", "b", "c", "d", "e"].map((x) => libro(x)),
      criterioStato((b) => stati[b.id])
    );
    // IL PATTO: l'ordine della vita di un libro, non l'alfabeto
    t.eq(
      "gli stati stanno in ordine di lettura",
      conta(r).join(" · "),
      "Da leggere:1 · In lettura:1 · Letti:2 · Abbandonati:1"
    );
  }
  {
    // le parole sono quelle dei FILTRI che stanno due righe sopra sullo
    // schermo: «Letti», non «Letto» — un'intestazione con un conto accanto
    // parla di più libri, e due nomi per la stessa cosa nella stessa
    // schermata si leggono come due cose diverse
    t.eq("i quattro stati hanno il nome dei filtri", STATI.map((s) => s.nome).join("|"), "Da leggere|In lettura|Letti|Abbandonati");
    t.c("nessuno stato è senza nome", STATI.every((s) => s.id && s.nome));
  }
  {
    // uno stato che non conosciamo NON è «senza stato»: è un valore che
    // qualcuno ha scritto e che noi non sappiamo nominare
    const r = aEtichette([libro("a"), libro("b")], criterioStato((b) => (b.id === "a" ? "prestato" : "read")));
    t.c("lo stato ignoto si mostra com'è", nomi(r).includes("prestato"), nomi(r).join(","));
    t.c("…e non finisce fra i senza stato", !nomi(r).includes("Senza stato"), nomi(r).join(","));
    // …ma sta in coda ai quattro conosciuti, non in mezzo
    t.eq("e chiude la fila dei conosciuti", nomi(r).join(" · "), "Letti · prestato");
  }
  {
    const r = aEtichette([libro("a")], criterioStato(() => ""));
    t.eq("chi non ha proprio stato ha il suo mucchio", r[0].nome, "Senza stato");
    t.c("…spento", r[0].spento === true);
  }

  // ---- LA PORTA COMUNE ---------------------------------------------------
  {
    // il genere non ha peso: alfabetico, e il vuoto in fondo
    const generi = {
      chiave: (b) => b.genre || "",
      vuoto: "Senza genere",
    };
    const r = aEtichette(
      [libro("a", { genre: "Thriller" }), libro("b", { genre: "Fantasy" }), libro("c")],
      generi
    );
    t.eq("senza peso si legge in alfabetico", nomi(r).join(" · "), "Fantasy · Thriller · Senza genere");
  }
  {
    t.eq("nessun libro, nessun ripiano", aEtichette([], criterioVoto()).length, 0);
    // un criterio senza chiave non deve esplodere: tutto finisce nel vuoto
    const r = aEtichette([libro("a")], {});
    t.eq("un criterio muto mette tutto nel mucchio", r.length, 1);
    t.c("…col nome di scorta", !!r[0].nome);
  }
  {
    // a parità di peso comanda l'alfabeto, o l'ordine dipenderebbe da come
    // i libri sono entrati in biblioteca — e cambierebbe a ogni import
    const r = aEtichette(
      [libro("a", { g: "Zeta" }), libro("b", { g: "Alfa" })],
      { chiave: (b) => b.g, peso: () => 1 }
    );
    t.eq("a parità di peso decide l'alfabeto", nomi(r).join(" · "), "Alfa · Zeta");
  }
}
