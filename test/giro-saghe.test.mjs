// LA MEMORIA DEL GIRO DELLE SAGHE ALL'APERTURA (`lib/giroSaghe.js`).
// La firma sbaglia in silenzio: un campo che manca vuol dire un giro
// saltato che doveva girare, e una saga che non arriva senza che nessuno
// lo dica. Qui si prova che ogni cosa che il giro guarda cambia la firma,
// e che quel che il giro NON guarda non la cambia.
import { firmaGiro, leggiGiro, ricordaGiro, giroFinito, CHIAVE_GIRO } from "../src/lib/giroSaghe.js";

const base = [
  { id: "a", title: "Mort", author: "Terry Pratchett", saga: "Discworld", sagaOrder: 4, fileType: "epub" },
  { id: "b", title: "Tigana", author: "Guy Gavriel Kay", fileType: "epub" },
  { id: "c", title: "Hellboy", author: "Mignola", fileType: "cbz" },
];
const conByte = new Set(["b"]);
const f = (libri, o = {}) => firmaGiro(libri, { conByte, versione: "1", ...o });
const con = (id, campi) => base.map((b) => (b.id === id ? { ...b, ...campi } : b));

function finto() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m };
}

export default async function (t) {
  const prima = f(base);
  t.eq("la stessa biblioteca da' la stessa firma", f(base.map((b) => ({ ...b }))), prima);
  t.eq("l'ordine dello scaffale non e' un fatto sui libri", f([...base].reverse()), prima);
  t.c("la firma e' corta: sta in localStorage a ogni giro", prima.length < 20, prima);

  // tutto quel che il giro guarda
  t.c("un libro in piu'", f([...base, { id: "d", title: "X", fileType: "epub" }]) !== prima);
  t.c("un libro in meno", f(base.slice(0, 2)) !== prima);
  t.c("il titolo (tavola, titolo, catalogo)", f(con("b", { title: "Tigana (Book 1)" })) !== prima);
  t.c("l'autore", f(con("b", { author: "Kay, Guy Gavriel" })) !== prima);
  t.c("la saga (chi e' candidato)", f(con("b", { saga: "Fionavar" })) !== prima);
  t.c("la saga tolta a mano", f(con("b", { sagaTolta: true })) !== prima);
  t.c("il numero", f(con("a", { sagaOrder: 5 })) !== prima);
  t.c("il tipo di file, attraverso chi e' candidato (la collana si legge dai soli ePub)", f(con("b", { fileType: "pdf" })) !== prima);
  t.c("la versione dell'app: una regola nuova deve poter girare", f(base, { versione: "2" }) !== prima);
  t.c("un ePub senza saga che scende sul tablet va guardato", f(base, { conByte: new Set() }) !== prima);
  t.c("senza sapere dei byte non si finge di saperlo", f(base, { conByte: null }) !== prima);

  // quel che il giro non guarda
  t.eq("un fumetto che diventa un PDF non conta: nessuno dei due si apre per la collana", f(con("c", { fileType: "pdf" })), prima);
  t.eq("i byte di chi la saga ce l'ha non contano", f(base, { conByte: new Set(["a", "b"]) }), prima);
  t.eq("…ne' quelli di un fumetto", f(base, { conByte: new Set(["b", "c"]) }), prima);
  t.eq("un voto non fa rigirare niente", f(con("a", { rating: 5 })), prima);
  t.eq("un libro senza id non conta", f([...base, { title: "fantasma" }]), prima);

  // i separatori non si confondono coi campi
  t.c(
    "due campi che si scambiano un pezzo non fanno la stessa firma",
    firmaGiro([{ id: "x", title: "ab", author: "c" }]) !== firmaGiro([{ id: "x", title: "a", author: "bc" }])
  );

  // la memoria
  {
    const s = finto();
    t.eq("mai girato: niente", leggiGiro(s), null);
    ricordaGiro(prima, s);
    t.eq("si ritrova", leggiGiro(s), prima);
    t.eq("sotto la sua chiave", s.m.get(CHIAVE_GIRO), prima);
    const rotto = {
      getItem: () => {
        throw new Error("negato");
      },
      setItem: () => {
        throw new Error("pieno");
      },
    };
    t.eq("uno storage che esplode vale «mai girato»", leggiGiro(rotto), null);
    ricordaGiro(prima, rotto);
    t.c("…e scriverci non si porta via il giro", true);
  }

  // solo un giro finito bene si ricorda
  t.c("un giro senza passi lunghi e' finito", giroFinito({}));
  t.c("uno col catalogo che ha risposto a tutto", giroFinito({ collane: { fermato: false }, catalogo: { rete: 0, fermato: false } }));
  t.c("un buco di rete si rifa' la volta dopo", !giroFinito({ catalogo: { rete: 1 } }));
  t.c("un catalogo fermato a meta'", !giroFinito({ catalogo: { rete: 0, fermato: true } }));
  t.c("una passata sui file fermata a meta'", !giroFinito({ collane: { fermato: true } }));
}
