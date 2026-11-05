// IL TASTO «RICONOSCI SAGHE E CICLI» NON TOCCA LE RACCOLTE.
//
// Chiesto dal lettore: «non mi toccare quelli già presenti ma solo i libri
// che non sono già nelle raccolte, altrimenti mi sminchi le raccolte che ho
// messo a posto da solo». Un libro con la saga sta in una raccolta: il
// tasto prima gli aggiungeva numero e ciclo dalla tavola, e riuniva le
// grafie — su roba che il lettore aveva gia' sistemato a mano.
import { ripassaSciolti, sciolto, unificaSaghe } from "../src/lib/sagaBooks.js";

export default async function (t) {
  {
    const mio = { id: "q", title: "Guards! Guards!", author: "Terry Pratchett", saga: "Il mio Mondo Disco" };
    const solo = { id: "p", title: "Men at Arms", author: "Terry Pratchett", saga: "" };
    const { libri, esiti } = ripassaSciolti([mio, solo]);
    t.c("la raccolta del lettore resta com'era", libri[0] === mio);
    t.c("…e il libro sciolto viene riconosciuto", !!libri[1].saga);
    t.eq("un solo libro toccato", esiti.length, 1);
  }
  {
    // la deduzione impara ancora dalle raccolte: si leggono, non si scrivono
    const libri = [
      { id: "a", title: "Malice", author: "John Gwynne", saga: "The Faithful and the Fallen" },
      { id: "b", title: "Valour", author: "John Gwynne", saga: "" },
    ];
    const r = ripassaSciolti(libri);
    t.c("il fratello in raccolta non cambia", r.libri[0] === libri[0]);
    t.eq("lo sciolto eredita la saga", r.libri[1].saga, "The Faithful and the Fallen");
  }
  {
    // chi era sciolto quando il tasto e' stato premuto resta servito anche
    // dopo aver preso la saga dal file: numero e ciclo arrivano nello stesso giro
    const daFile = { id: "p", title: "Guards! Guards!", author: "Terry Pratchett", saga: "Discworld" };
    const r = ripassaSciolti([daFile], {}, (b) => b.id === "p");
    t.eq("il numero arriva", r.libri[0].sagaOrder, 8);
    t.c("una saga solo di spazi è sciolta", sciolto({ id: "x", saga: "  " }));
  }

  // ---- E IL GIRO AUTOMATICO ---------------------------------------------
  // «fai lasciare stare le raccolte anche al giro automatico»: le grafie
  // si riuniscono solo sui libri sciolti quando il giro e' partito, e
  // prendono quella della raccolta anche se il nuovo e' in maggioranza
  {
    const libri = [
      { id: "a", saga: "JoJo's Bizarre Adventure" },
      { id: "b", saga: "JoJo's Bizarre Adventure" },
      { id: "c", saga: "JoJo's Bizzare Adventure" },
      { id: "d", saga: "JoJo's Bizzare Adventure" },
      { id: "e", saga: "JoJo's Bizzare Adventure" },
    ];
    const sciolti = new Set(["c", "d", "e"]);
    const u = unificaSaghe(libri, { tocca: (b) => sciolti.has(b.id) });
    t.c("la raccolta del lettore non si riscrive", !u.campi.a && !u.campi.b);
    t.eq("il nuovo prende la grafia della raccolta, anche se è in maggioranza", u.campi.c?.saga, "JoJo's Bizarre Adventure");
    t.c("…tutti i nuovi", u.campi.d?.saga === u.campi.c?.saga && u.campi.e?.saga === u.campi.c?.saga);
    t.eq("e il resoconto dice il nome scelto", u.nomi.join(), "JoJo's Bizarre Adventure");
  }
  {
    const libri = [
      { id: "a", saga: "The Wheel of Time" },
      { id: "b", saga: "Wheel of Time" },
      { id: "c", saga: "Wheel of Time" },
    ];
    const u = unificaSaghe(libri, { tocca: (b) => b.id === "c" });
    t.c("le due grafie già in raccolta restano tutt'e due", !u.campi.a && !u.campi.b);
    t.eq("il nuovo con la grafia di casa non si tocca", u.unificate, 0);
    const n = unificaSaghe(libri, { tocca: (b) => b.id === "a" });
    t.eq("il nuovo con la grafia sola prende quella delle raccolte", n.campi.a?.saga, "Wheel of Time");
    t.c("…e nessun altro", Object.keys(n.campi).length === 1);
    t.eq("senza `tocca` resta il giro di sempre", unificaSaghe(libri).campi.a?.saga, "Wheel of Time");
  }
}
