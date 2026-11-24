// LA SCALA, E IL PATTO CHE LA TIENE INSIEME.
//
// Prima c'erano ventisette corpi diversi e tredici raggi: 12,5 · 13 · 13,5 ·
// 14 · 14,5 · 15 — sei gradini in due punti e mezzo. Nessuno di quei mezzi
// punti comunicava una gerarchia; comunicavano che ogni componente aveva
// scelto per conto suo.
//
// Il valore di ogni gradino conta meno del fatto che sia UNO SOLO: ritoccare
// tutta l'app dev'essere cambiare un numero in `constants.js`, non
// rincorrerne duecento nei file. Questo test e' quello che impedisce alla
// scala di sfarinarsi di nuovo, un mezzo punto alla volta.
import { readdirSync, readFileSync } from "node:fs";
import { F, R } from "../src/data/constants.js";

// Sopra questa soglia non c'e' piu' testo ma illustrazione: le emoji grosse
// delle schermate vuote (🔮 64px, 🕯️ 40px) non sono tipografia, e infilarle
// nella scala vorrebbe dire inventarsi gradini che non servono a niente.
const ILLUSTRAZIONE = 28;

const sorgenti = () => {
  const out = [["src/App.jsx", readFileSync("src/App.jsx", "utf8")]];
  for (const f of readdirSync("src/components")) {
    if (f.endsWith(".jsx")) out.push([`src/components/${f}`, readFileSync(`src/components/${f}`, "utf8")]);
  }
  return out;
};

export default async function (t) {
  // ---- la scala e' una scala -------------------------------------------
  const corpi = Object.values(F);
  t.c("i corpi salgono e basta", corpi.every((v, i) => i === 0 || v > corpi[i - 1]), corpi.join(" "));
  t.c("nessun gradino doppio", new Set(corpi).size === corpi.length);
  t.c("e nessun mezzo punto", corpi.every(Number.isInteger), corpi.join(" "));
  // due gradini a meno di un punto e mezzo non sono due gradini: sono la
  // stessa cosa scritta due volte, ed e' il difetto che stiamo curando
  t.c(
    "ogni gradino si distingue dal precedente",
    corpi.every((v, i) => i === 0 || v - corpi[i - 1] >= 1),
    corpi.join(" ")
  );
  const raggi = Object.values(R);
  t.c("i raggi salgono", raggi.every((v, i) => i === 0 || v > raggi[i - 1]), raggi.join(" "));
  t.c("e finiscono col tondo", raggi[raggi.length - 1] >= 999);

  // ---- e NESSUNO scrive piu' numeri a mano ------------------------------
  const fuori = [];
  for (const [nome, testo] of sorgenti()) {
    for (const m of testo.matchAll(/fontSize: (\d+(?:\.\d+)?)\b/g)) {
      if (parseFloat(m[1]) < ILLUSTRAZIONE) fuori.push(`${nome}: fontSize ${m[1]}`);
    }
    for (const m of testo.matchAll(/borderRadius: (\d+(?:\.\d+)?)\b/g)) {
      fuori.push(`${nome}: borderRadius ${m[1]}`);
    }
  }
  t.c(
    "nessun corpo e nessun raggio scritto a mano nei componenti",
    fuori.length === 0,
    fuori.slice(0, 6).join(" · ")
  );

  // ---- ma la scala si usa davvero ---------------------------------------
  // un test che passa perche' nessuno usa niente non varrebbe niente
  const tutto = sorgenti()
    .map(([, s]) => s)
    .join("\n");
  for (const nome of Object.keys(F)) {
    t.c(`F.${nome} è usato`, tutto.includes(`F.${nome}`));
  }
  for (const nome of Object.keys(R)) {
    t.c(`R.${nome} è usato`, tutto.includes(`R.${nome}`));
  }
}
