// LA REGOLA DELLE NOVITA' DEL GUSCIO (`android/RegoleNovita.java`), provata
// col JDK: il guscio la usa ad app chiusa, e qui e' l'unico posto dove la si
// vede girare prima del tablet. Senza `javac` la prova si dichiara saltata.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Saltato } from "./aiuto.mjs";

export default async function (t) {
  let righe;
  const out = mkdtempSync(join(tmpdir(), "novita-"));
  try {
    try {
      execFileSync("javac", ["-version"], { stdio: "ignore" });
    } catch {
      throw new Saltato("niente javac: la regola delle novita' del guscio non si prova");
    }
    execFileSync("javac", ["-encoding", "UTF-8", "-d", out, "android/RegoleNovita.java", "test/java/ProvaNovita.java"], { stdio: "pipe" });
    righe = execFileSync("java", ["-Dfile.encoding=UTF-8", "-Dstdout.encoding=UTF-8", "-cp", out, "it.bookcompanion.app.ProvaNovita"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim().split("\n");
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
  const controlli = righe.filter((r) => /^(ok|NO) /.test(r));
  t.c("la prova Java ha fatto i suoi controlli", controlli.length >= 20, String(controlli.length));
  for (const r of controlli) t.c(r.slice(3), r.startsWith("ok "));
  t.eq("…e ha finito", righe.at(-1), "TUTTO BENE");

  // e il guscio la usa davvero, con le lingue chieste a Open Library
  const novita = readFileSync("android/Novita.java", "utf8");
  t.c("il guscio chiede le lingue delle opere", /fields=key,title,first_publish_year,language/.test(novita));
  t.c("…passa ogni opera dalla regola", /RegoleNovita\.candidato\(/.test(novita));
  t.c("…e guarda se e' una ristampa prima di avvisare", /RegoleNovita\.ristampa\(/.test(novita));
}
