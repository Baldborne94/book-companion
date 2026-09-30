// UNA DISCESA PER FILE (`lib/inVolo.js`): aprire un CBR da 72 MB ne faceva
// scendere 144, perche' il lettore e il giro dei libri in lettura lo
// chiedevano insieme. Sbaglia in silenzio in tre modi: due discese dello
// stesso file, una discesa finita che resta «in volo» per sempre (e un
// file cambiato su Drive non si riscarica piu'), e chi si aggancia che non
// sente l'avanzamento.
import { unaPerChiave } from "../src/lib/inVolo.js";

export default async (t) => {
  const una = unaPerChiave();
  let partite = 0;
  let lascia;
  const fai = (avvisa) => {
    partite += 1;
    return new Promise((ok) => (lascia = () => {
      avvisa({ presi: 5 });
      ok(`blob${partite}`);
    }));
  };
  const sentitiA = [];
  const sentitiB = [];
  const a = una("f1", fai, { onProgress: (p) => sentitiA.push(p) });
  const b = una("f1", fai, { onProgress: (p) => sentitiB.push(p) });
  await Promise.resolve();
  t.eq("lo stesso file chiesto due volte scende una volta", partite, 1);
  lascia();
  t.eq("…e tutt'e due hanno lo stesso file", `${await a}+${await b}`, "blob1+blob1");
  t.c("…e tutt'e due sentono l'avanzamento", sentitiA.length === 1 && sentitiB.length === 1);

  const c = una("f1", fai);
  await Promise.resolve();
  t.eq("finita, la discesa dopo riparte da capo", partite, 2);
  lascia();
  t.eq("…col file nuovo", await c, "blob2");

  const d = una("f2", fai);
  await Promise.resolve();
  t.eq("un altro file e' un'altra discesa", partite, 3);
  lascia();
  await d;

  const rotta = una("f3", () => Promise.reject(new Error("rete caduta")));
  let perche = "";
  await rotta.catch((e) => (perche = e.message));
  t.eq("una discesa caduta dice perche'", perche, "rete caduta");
  const ancora = una("f3", fai);
  await Promise.resolve();
  t.eq("…e non resta in volo: si riprova", partite, 4);
  lascia();
  await ancora;
};
