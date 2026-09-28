// LE COPERTINE SULLO SCAFFALE: miniature fatte una volta e ricordate.
//
// Quel che sbaglia in silenzio, e che qui si prova:
//   - la miniatura VECCHIA mostrata sopra una copertina cambiata (il segno
//     `di` e' la misura della copertina da cui viene);
//   - la memoria che non dimentica una copertina cambiata;
//   - la stessa copertina letta due volte da due dorsi che la chiedono
//     insieme (la ricerca che rimonta lo scaffale);
//   - una risposta arrivata DOPO un cambio, che riporterebbe il libro di prima.
import {
  caricaCopertina,
  giaVista,
  copertinaCambiata,
  ascoltaCopertine,
  minBuona,
  dimenticaTutto,
  generazione,
} from "../src/lib/miniature.js";

const blob = (n, nome) => ({ size: n, nome });

function banco({ copertine = {}, min = {}, riduci } = {}) {
  const conti = { cover: 0, min: 0, riduci: 0, scrivi: 0, url: 0, revoche: [] };
  const scritte = {};
  let n = 0;
  const deps = {
    leggiCover: async (id) => {
      conti.cover += 1;
      return copertine[id] || null;
    },
    leggiMin: async (id) => {
      conti.min += 1;
      return min[id] || null;
    },
    scriviMin: async (id, v) => {
      conti.scrivi += 1;
      scritte[id] = v;
      min[id] = v;
    },
    riduci:
      riduci ||
      (async (b) => {
        conti.riduci += 1;
        return blob(Math.floor(b.size / 10), `min-${b.nome}`);
      }),
    creaUrl: (b) => {
      conti.url += 1;
      n += 1;
      return `blob:${b.nome}#${n}`;
    },
    revoca: (u) => conti.revoche.push(u),
  };
  return { deps, conti, scritte, copertine, min };
}

export default async function (t) {
  // ---- senza copertina: il dorso ----
  {
    dimenticaTutto();
    const b = banco();
    t.eq("senza copertina l'indirizzo e' nullo (il dorso disegnato)", await caricaCopertina("x", b.deps), null);
    t.eq("e si ricorda anche il «niente»", giaVista("x"), null);
    await caricaCopertina("x", b.deps);
    t.eq("…cosi' la seconda volta non si rilegge", b.conti.cover, 1);
    t.eq("mai vista: non lo so", giaVista("mai"), undefined);
  }

  // ---- la prima volta si riduce e si scrive, col segno della copertina ----
  {
    dimenticaTutto();
    const b = banco({ copertine: { a: blob(80000, "A") } });
    const u = await caricaCopertina("a", b.deps);
    t.eq("l'indirizzo e' della MINIATURA, non della copertina intera", u, "blob:min-A#1");
    t.eq("la miniatura si scrive su disco", b.conti.scrivi, 1);
    t.eq("col segno della copertina da cui viene", b.scritte.a?.di, 80000);
    t.eq("…e la sua misura", b.scritte.a?.blob?.size, 8000);
    await caricaCopertina("a", b.deps);
    t.eq("ricordata: niente seconda lettura", b.conti.cover, 1);
    t.eq("ne' un secondo indirizzo", b.conti.url, 1);
    t.eq("e chi ridisegna la trova subito", giaVista("a"), "blob:min-A#1");
  }

  // ---- una miniatura buona non si rifa' ----
  {
    dimenticaTutto();
    const b = banco({ copertine: { a: blob(80000, "A") }, min: { a: { blob: blob(8000, "MIN"), di: 80000 } } });
    const u = await caricaCopertina("a", b.deps);
    t.eq("la miniatura su disco si usa com'e'", u, "blob:MIN#1");
    t.eq("…senza ridurre di nuovo", b.conti.riduci, 0);
    t.eq("…ne' riscriverla", b.conti.scrivi, 0);
  }

  // ---- una miniatura di un'ALTRA copertina si rifa' ----
  {
    dimenticaTutto();
    const b = banco({ copertine: { a: blob(90000, "NUOVA") }, min: { a: { blob: blob(8000, "VECCHIA"), di: 80000 } } });
    const u = await caricaCopertina("a", b.deps);
    t.eq("la miniatura della copertina di prima non si mostra", u, "blob:min-NUOVA#1");
    t.eq("…e si riscrive col segno nuovo", b.scritte.a?.di, 90000);
    t.c("minBuona vuole lo stesso segno", minBuona({ blob: {}, di: 5 }, { size: 5 }) && !minBuona({ blob: {}, di: 5 }, { size: 6 }));
    t.c("…e una miniatura con dentro qualcosa", !minBuona({ di: 5 }, { size: 5 }) && !minBuona(null, { size: 5 }) && !minBuona({ blob: {}, di: 5 }, null));
  }

  // ---- una copertina gia' piccola si usa lei ----
  {
    dimenticaTutto();
    const b = banco({ copertine: { a: blob(5000, "PICCOLA") }, riduci: async () => blob(6000, "PIU-GRANDE") });
    t.eq("una riduzione piu' pesante dell'originale non e' una miniatura", await caricaCopertina("a", b.deps), "blob:PICCOLA#1");
    t.eq("…e non si scrive", b.conti.scrivi, 0);
  }

  // ---- una riduzione che esplode lascia la copertina intera ----
  {
    dimenticaTutto();
    const b = banco({
      copertine: { a: blob(5000, "A") },
      riduci: () => {
        throw new Error("canvas negato");
      },
    });
    t.eq("il canvas negato non lascia il dorso: si mostra la copertina intera", await caricaCopertina("a", b.deps), "blob:A#1");
  }

  // ---- due richieste insieme sono una sola ----
  {
    dimenticaTutto();
    const b = banco({ copertine: { a: blob(80000, "A") } });
    const [u1, u2] = await Promise.all([caricaCopertina("a", b.deps), caricaCopertina("a", b.deps)]);
    t.eq("due dorsi che la chiedono insieme: una lettura sola", b.conti.cover, 1);
    t.c("…e lo stesso indirizzo", u1 === u2 && b.conti.url === 1, `${u1} ${u2}`);
  }

  // ---- una copertina cambiata si dimentica ----
  {
    dimenticaTutto();
    const b = banco({ copertine: { a: blob(80000, "A") } });
    await caricaCopertina("a", b.deps);
    const sentiti = [];
    const via = ascoltaCopertine((id) => sentiti.push(id));
    b.copertine.a = blob(70000, "B");
    copertinaCambiata("a");
    t.eq("chi ascolta sa quale libro e' cambiato", sentiti.join(","), "a");
    t.eq("l'indirizzo vecchio si revoca", b.conti.revoche.join(","), "blob:min-A#1");
    t.eq("e non si ricorda piu'", giaVista("a"), undefined);
    t.eq("la prossima lettura porta la copertina nuova", await caricaCopertina("a", b.deps), "blob:min-B#2");
    via();
    copertinaCambiata("a");
    t.eq("chi ha smesso di ascoltare non sente piu'", sentiti.length, 1);
  }

  // ---- un cambio a meta' lettura non riporta il libro di prima ----
  {
    dimenticaTutto();
    let sblocca;
    const b = banco({ copertine: { a: blob(80000, "A") } });
    const lenta = b.deps.leggiCover;
    const vecchia = b.copertine.a;
    // la lettura lenta torna la copertina di PRIMA del cambio
    b.deps.leggiCover = () =>
      new Promise((ok) => {
        sblocca = () => ok(vecchia);
      });
    const p = caricaCopertina("a", b.deps);
    await new Promise((r) => setTimeout(r, 0));
    b.deps.leggiCover = lenta;
    b.copertine.a = blob(60000, "NUOVA");
    copertinaCambiata("a");
    sblocca();
    const u = await p;
    t.eq("la risposta arrivata dopo il cambio e' quella nuova", u, "blob:min-NUOVA#1");
    t.eq("…e la miniatura su disco e' della copertina nuova", b.scritte.a?.di, 60000);
    t.eq("quella della copertina vecchia non si e' mai scritta", b.conti.scrivi, 1);
    t.eq("la generazione dice quante volte e' cambiata", generazione("a"), 1);
  }
}
