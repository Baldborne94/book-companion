// I DOPPIONI DEI TOMI CHE STANNO SU DRIVE (segnalato: «perche' mi dice che
// ci sono i doppioni di tre tomi e se ci clicco non succede nulla?»).
// Tre tomi oltre la soglia dell'impronta intera, entrati da Drive senza
// impronta e senza byte qui: il tasto li contava per sempre e ogni tocco
// rispondeva «non sono su questo dispositivo». Qui si prova che adesso
// l'impronta si prende da lassu', e che il tasto conta solo quel che puo'
// servire.
import { ripassaImpronte, improntaLassu, impronteDaFare, IMPRONTA_INTERA } from "../src/lib/importBook.js";
import { riconosci } from "../src/lib/sagaBooks.js";

const SHA = (c) => c.repeat(64);

function grosso(misura, pezzi) {
  return {
    size: misura,
    slice: (a, b) => ({
      arrayBuffer: async () => {
        pezzi.push([a, b]);
        return new Uint8Array(Math.max(0, Math.min(b, misura) - a)).fill(a % 251).buffer;
      },
    }),
  };
}

export default async function (t) {
  // ---- l'impronta da lassu' ----
  {
    const dettagli = async (ids) => ids.map((id) => ({ piccolo: { size: 100, sha256Checksum: SHA("A") }, grosso: { size: IMPRONTA_INTERA + 5 }, storto: { size: 100, sha256Checksum: "xyz" }, muto: {} }[id] || {}));
    t.eq("sotto la soglia e' la SHA di Drive, in minuscolo", await improntaLassu("piccolo", { dettagli }), SHA("a"));
    const pezzi = [];
    const remoti = [];
    const imp = await improntaLassu("grosso", {
      dettagli,
      remoto: (id, m) => {
        remoti.push([id, m]);
        return grosso(m, pezzi);
      },
    });
    t.c("sopra la soglia si prende a campioni, come l'import dal tablet", /^c:[0-9a-f]{64}$/.test(imp || ""), imp);
    t.eq("…dal file lontano, con la misura che dice Drive", JSON.stringify(remoti), JSON.stringify([["grosso", IMPRONTA_INTERA + 5]]));
    t.c("…senza scaricarlo: dieci pezzi da un mega al massimo", pezzi.length === 10 && pezzi.every(([a, b]) => b - a <= 1024 * 1024));
    const piccoli = [];
    await improntaLassu("piccolo", { dettagli, remoto: () => grosso(100, piccoli) });
    t.eq("un file piccolo non si scarica affatto: la SHA la dice Drive", piccoli.length, 0);
    t.eq("una SHA che non e' una SHA non si scrive", await improntaLassu("storto", { dettagli }), null);
    t.eq("una misura che Drive non dice non si indovina", await improntaLassu("muto", { dettagli }), null);
    t.eq("senza file su Drive, niente", await improntaLassu(null, { dettagli }), null);
  }

  // ---- il ripasso usa lassu' quando qui non c'e' niente ----
  {
    const libri = [
      { id: "qui", title: "Qui" },
      { id: "lassu", title: "Lassu" },
      { id: "rotto", title: "Rotto" },
      { id: "sparito", title: "Sparito" },
    ];
    const leggiByte = async (id) => (id === "qui" ? new Blob([new Uint8Array([1, 2, 3])]) : null);
    const e = await ripassaImpronte(libri, {
      leggiByte,
      improntaLassu: async (b) => {
        if (b.id === "lassu") return SHA("b");
        if (b.id === "rotto") throw new Error("rete");
        return null;
      },
    });
    t.eq("il tomo che sta su Drive prende l'impronta da lassu'", e.campi.lassu, SHA("b"));
    t.c("quello coi byte qui la prende dai byte", /^[0-9a-f]{64}$/.test(e.campi.qui || ""));
    t.eq("due riconosciuti", e.scritte, 2);
    t.eq("un guasto lassu' e' «non letto», non «non c'e'»", e.illeggibili, 1);
    t.eq("e solo chi non sta da nessuna parte e' «non su questo dispositivo»", e.senzaByte, 1);
    const senza = await ripassaImpronte(libri, { leggiByte });
    t.eq("senza la strada di Drive si conta come prima", senza.senzaByte, 3);
  }

  // ---- il tasto conta solo quel che puo' servire ----
  {
    const libri = [
      { id: "a", impronta: SHA("a") },
      { id: "b" },
      { id: "c" },
      { id: "d" },
    ];
    const qui = new Set(["b"]);
    const lassu = new Set(["c"]);
    t.eq("chi ha i byte qui o il file su Drive si conta, chi non sta da nessuna parte no", impronteDaFare(libri, { qui, lassu }).map((b) => b.id).join(","), "b,c");
    t.eq("chi l'impronta ce l'ha gia' mai", impronteDaFare(libri, { qui: null }).map((b) => b.id).join(","), "b,c,d");
    t.eq("senza Drive guardato valgono i soli byte di qui", impronteDaFare(libri, { qui, lassu: null }).map((b) => b.id).join(","), "b");
  }

  // ---- il riconoscimento delle saghe si ricorda, e torna una copia ----
  {
    const r1 = riconosci({ title: "Mort", author: "Terry Pratchett" });
    t.eq("lo stesso libro riconosciuto come prima", r1?.saga, "Discworld");
    r1.saga = "Guastata";
    const r2 = riconosci({ title: "Mort", author: "Terry Pratchett" });
    t.eq("chi tocca la risposta non la cambia agli altri", r2?.saga, "Discworld");
    t.c("…perche' ognuno riceve una copia sua", r1 !== r2);
    t.eq("il «niente» si ricorda come niente", riconosci({ title: "Un titolo che nessuna tavola conosce", author: "Nessuno" }), null);
    t.eq("…anche la seconda volta", riconosci({ title: "Un titolo che nessuna tavola conosce", author: "Nessuno" }), null);
    t.eq("un titolo diverso e' una domanda diversa", riconosci({ title: "Eric", author: "Terry Pratchett" })?.saga, "Discworld");
    t.c("col nome del file si guarda da capo, e combacia lo stesso", riconosci({ title: "", author: "", fileName: "Mort - Terry Pratchett.epub" })?.saga === "Discworld");
  }
}
