// La persistenza della memoria: le cinque situazioni che un browser vero
// puo' presentare. Sono cinque rami e nessuno si vede a occhio — questa
// funzione decide se il lettore si sente al sicuro o gli si dice che il
// browser puo' buttare via la sua biblioteca.
import { persistenza } from "../src/lib/bookStore.js";

// un `navigator.storage` finto: si dichiara cosa sa fare e cosa risponde
const finto = ({ haPersist = true, haPersisted = true, gia = false, concede = false, esplode = false } = {}) => {
  const s = {};
  if (haPersist) s.persist = async () => { if (esplode) throw new Error("permesso negato"); return concede; };
  if (haPersisted) s.persisted = async () => { if (esplode) throw new Error("permesso negato"); return gia; };
  return s;
};

export default async function (t) {
  // ---- chiedendo (l'avvio) ----------------------------------------------
  t.eq("il browser concede", await persistenza(finto({ concede: true })), "concessa");
  t.eq("il browser nega", await persistenza(finto({ concede: false })), "negata");
  t.eq("era gia' concessa", await persistenza(finto({ gia: true })), "concessa");
  t.eq("niente API: non si sa", await persistenza(finto({ haPersist: false })), "sconosciuta");
  t.eq("niente navigator del tutto", await persistenza(null), "sconosciuta");
  t.eq("niente navigator.storage", await persistenza(undefined), "sconosciuta");
  t.eq("il browser esplode invece di rispondere", await persistenza(finto({ esplode: true })), "sconosciuta");

  // ---- gia' concessa: NON si richiede -----------------------------------
  // su qualche browser il secondo giro ributta fuori il permesso, e chi sta
  // leggendo si vedrebbe comparire una richiesta dal nulla
  let chieste = 0;
  const contatore = {
    persisted: async () => true,
    persist: async () => { chieste += 1; return true; },
  };
  await persistenza(contatore);
  t.eq("se era gia' concessa non si richiede", chieste, 0);

  // ---- solo guardando (la Libreria) -------------------------------------
  let chiesteInLettura = 0;
  const spia = {
    persisted: async () => false,
    persist: async () => { chiesteInLettura += 1; return true; },
  };
  t.eq("in sola lettura, negata resta negata", await persistenza(spia, false), "negata");
  t.eq("e NON si e' chiesto niente", chiesteInLettura, 0);
  t.eq("in sola lettura, concessa si vede", await persistenza(finto({ gia: true }), false), "concessa");

  // il browser che sa chiedere ma non sa dire com'e' messo: in sola lettura
  // non si spaccia per un «negata», o manderemmo in pagina un avviso
  // inventato su un dispositivo che magari e' a posto
  t.eq(
    "sa chiedere ma non sa rispondere: in sola lettura e' un non-so",
    await persistenza(finto({ haPersisted: false }), false),
    "sconosciuta"
  );
  // chiedendo, invece, la risposta arriva
  t.eq(
    "e chiedendo, invece, si sa",
    await persistenza(finto({ haPersisted: false, concede: true }), true),
    "concessa"
  );

  // ---- l'avviso si mostra SOLO su «negata» ------------------------------
  // «sconosciuta» non e' un «no»: allarmare senza sapere sarebbe peggio del
  // silenzio, perche' il lettore non avrebbe niente da fare per rimediare
  const mostra = (stato) => stato === "negata";
  t.c("l'avviso compare se negata", mostra("negata"));
  t.c("non compare se concessa", !mostra("concessa"));
  t.c("non compare se sconosciuta", !mostra("sconosciuta"));
}
