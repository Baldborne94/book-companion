// I FILE CHE IL SELETTORE MOSTRA: sul computer solo i libri (chiesto da un
// amico del lettore: «mi mostra anche formati che non sono libri»), sul
// tablet anche i tipi larghi, senza i quali un ePub scaricato dal browser
// resta in grigio (il caso di Tigana).
import { tipiDaScegliere } from "../src/lib/importBook.js";

const TABLET = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36";
const PC = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36";
const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

const tipi = (s) => s.split(",");
const larghi = ["application/zip", "application/octet-stream"];

export default async (t) => {
  for (const [nome, ua, tocchi] of [["PC", PC, 0], ["Mac", MAC, 0]]) {
    const s = tipi(tipiDaScegliere(ua, tocchi));
    t.c(`${nome}: niente tipi larghi, che mostrano ogni archivio`, larghi.every((x) => !s.includes(x)), s.join());
    t.c(`${nome}: le quattro estensioni dei libri`, [".epub", ".pdf", ".cbz", ".cbr"].every((x) => s.includes(x)));
  }
  for (const [nome, ua, tocchi] of [["tablet Android", TABLET, 5], ["iPhone", IPHONE, 5], ["iPad (si dice Mac)", MAC, 5]]) {
    const s = tipi(tipiDaScegliere(ua, tocchi));
    t.c(`${nome}: anche i tipi larghi, o l'ePub scaricato resta in grigio`, larghi.every((x) => s.includes(x)), s.join());
    t.c(`${nome}: e le estensioni`, [".epub", ".pdf", ".cbz", ".cbr"].every((x) => s.includes(x)));
  }
};
