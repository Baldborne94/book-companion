// Il corridore. Trova i `*.test.mjs` qui accanto, li esegue in fila e
// conta. Esce diverso da zero se qualcosa e' rotto, cosi' `npm test` puo'
// stare accanto a `npm run build` fra le cose che devono essere verdi
// prima di un commit.
import { readdirSync } from "fs";
import { banco } from "./aiuto.mjs";

const qui = new URL(".", import.meta.url);
const files = readdirSync(qui).filter((f) => f.endsWith(".test.mjs")).sort();
const solo = process.argv[2];

let ok = 0;
const guai = [];
const saltati = [];

for (const f of files) {
  if (solo && !f.includes(solo)) continue;
  const { t, esito } = banco();
  let errore = null;
  try {
    const mod = await import(new URL(f, qui));
    await mod.default(t);
  } catch (e) {
    if (e?.saltato) {
      saltati.push([f, e.message]);
      continue;
    }
    errore = e;
  }
  const r = esito();
  ok += r.ok;
  for (const g of r.guai) guai.push(`${f}: ${g}`);
  // un test che esplode a meta' ha comunque contato i controlli fatti
  // prima: si dicono, ma l'esplosione e' un guaio a se'
  if (errore) guai.push(`${f}: e' esploso — ${errore.message}`);
  const segno = r.guai.length || errore ? "✗" : "✓";
  console.log(`${segno} ${f.padEnd(26)} ${String(r.ok).padStart(4)} passati${r.guai.length ? `, ${r.guai.length} falliti` : ""}${errore ? " (esploso)" : ""}`);
}

for (const [f, perche] of saltati) console.log(`⚠ ${f.padEnd(26)} SALTATO — ${perche}`);

if (guai.length) {
  console.log(`\n${guai.length} ${guai.length === 1 ? "guaio" : "guai"}:`);
  for (const g of guai) console.log(`  ${g}`);
}
console.log(`\n${ok} controlli passati, ${guai.length} falliti${saltati.length ? `, ${saltati.length} file saltati` : ""}`);
// un file saltato NON fa fallire il giro (su una macchina senza browser
// `npm test` deve poter girare), ma resta scritto a schermo
process.exit(guai.length ? 1 : 0);
