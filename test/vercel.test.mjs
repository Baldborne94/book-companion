// LE ANTEPRIME DEI RAMI DI LAVORO NON SI PUBBLICANO (`vercel.json`,
// `scripts/saltaAnteprima.sh`): ogni anteprima era una copia intera
// dell'app su Vercel, e lo spazio gratuito si e' riempito. Lo script dice a
// Vercel di saltare la build (uscita 0) solo per i rami `claude/*`.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const esce = (ramo) => spawnSync("sh", ["scripts/saltaAnteprima.sh"], { env: { ...process.env, VERCEL_GIT_COMMIT_REF: ramo } }).status;

export default async (t) => {
  t.eq("vercel.json chiede allo script se costruire", JSON.parse(readFileSync("vercel.json", "utf8")).ignoreCommand, "sh scripts/saltaAnteprima.sh");
  t.eq("un ramo di lavoro: anteprima saltata", esce("claude/amazing-archimedes-pz1w86"), 0);
  t.eq("main: la produzione si costruisce", esce("main"), 1);
  t.eq("un altro ramo si costruisce come prima", esce("prova"), 1);
  t.eq("…anche uno che ha «claude» dentro ma non davanti", esce("fix-claude/x"), 1);
};
