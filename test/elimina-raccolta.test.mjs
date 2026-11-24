// ELIMINARE UNA RACCOLTA (`lib/eliminaRaccolta.js`), chiesto dal lettore con
// due raccolte «JoJo's Bizarre Adventure» una accanto all'altra: «mi permetti
// di cancellare direttamente una raccolta?». Sciogliere o eliminare i volumi.
import { puoEssereSciolta, contoDaEliminare, sciogliRaccolta, fraseEliminaRaccolta } from "../src/lib/eliminaRaccolta.js";

export default async (t) => {
  const J = "JoJo's Bizarre Adventure";
  const libri = [
    { id: "a", title: "Parte 2 v1", saga: J, series: "Parte 2", sagaOrder: 1 },
    { id: "b", title: "Parte 2 v2", saga: J, series: "Parte 2", sagaOrder: 2 },
    { id: "c", title: "Mort", saga: "Mondo Disco", sagaOrder: 4 },
  ];
  const r = { tipo: "saga", nome: J, libri: libri.slice(0, 2) };

  t.c("una saga si scioglie", puoEssereSciolta(r));
  t.c("la raccolta di un autore no (l'autore non si toglie)", !puoEssereSciolta({ tipo: "autore", libri }));

  const conto = contoDaEliminare(r, new Set(["a", "z"]));
  t.eq("i volumi e quanti hanno il file qui", `${conto.ids.join()}|${conto.conFile}`, "a,b|1");
  t.eq("senza sapere cosa sta qui, nessun file", contoDaEliminare(r).conFile, 0);

  const dopo = sciogliRaccolta(libri, ["a", "b"]);
  const a = dopo.find((b) => b.id === "a");
  t.c("sciolta: senza saga, serie e numero, e la saga tolta a mano (il giro non la rimette)", a.saga === "" && a.series === "" && a.sagaOrder === null && a.sagaTolta === true);
  t.eq("il titolo resta", a.title, "Parte 2 v1");
  t.c("un libro di un'altra raccolta e' lo stesso di prima", dopo.find((b) => b.id === "c") === libri[2]);
  t.c("la biblioteca di prima non si tocca", libri[0].saga === J);

  t.eq("la domanda dice quanti volumi e quanti file", fraseEliminaRaccolta(J, conto), `Elimino 2 volumi di «${J}», e il file di uno da questo dispositivo? Le schede spariscono anche dall'altro dispositivo, e non si torna indietro.`);
  t.eq("…senza file qui non li nomina", fraseEliminaRaccolta("X", { ids: ["a"], conFile: 0 }), "Elimino un volume di «X»? Le schede spariscono anche dall'altro dispositivo, e non si torna indietro.");
  t.c("…e piu' file", fraseEliminaRaccolta("X", { ids: ["a", "b", "c"], conFile: 3 }).includes("il file di 3 da questo dispositivo"));
};
