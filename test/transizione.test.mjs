// La voltata «spazzata» passa da `startViewTransition`, che restituisce tre
// promesse. Una transizione interrotta (tablet spento a meta' voltata)
// rompe `ready`: se nessuno la ascolta finisce nel registro dei guasti come
// «Transition was aborted because of timeout in DOM update».
import { seguiTransizione } from "../src/lib/transizione.js";

const interrotta = () => {
  const errore = Object.assign(new Error("Transition was aborted because of timeout in DOM update"), { name: "TimeoutError" });
  return {
    ready: Promise.reject(errore),
    updateCallbackDone: Promise.reject(errore),
    finished: Promise.reject(errore),
  };
};

export default async (t) => {
  const perse = [];
  const ascolta = (e) => perse.push(e?.message);
  process.on("unhandledRejection", ascolta);
  try {
    let chiusa = 0;
    seguiTransizione(interrotta(), () => (chiusa += 1));
    await new Promise((r) => setTimeout(r, 20));
    t.eq("una transizione interrotta non lascia promesse rotte senza nessuno", perse.length, 0);
    t.eq("la voltata si chiude lo stesso, una volta", chiusa, 1);

    let finita = 0;
    seguiTransizione({ ready: Promise.resolve(), updateCallbackDone: Promise.resolve(), finished: Promise.resolve() }, () => (finita += 1));
    await new Promise((r) => setTimeout(r, 0));
    t.eq("una transizione andata bene si chiude una volta", finita, 1);

    // un browser vecchio senza `ready` né `updateCallbackDone`
    let vecchia = 0;
    seguiTransizione({ finished: Promise.resolve() }, () => (vecchia += 1));
    await new Promise((r) => setTimeout(r, 0));
    t.eq("senza le promesse nuove si chiude da `finished`", vecchia, 1);
  } finally {
    process.off("unhandledRejection", ascolta);
  }
};
