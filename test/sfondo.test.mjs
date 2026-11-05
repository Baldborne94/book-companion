// LA COPERTINA SULLA SCHERMATA DI BLOCCO, il lato della pagina
// (`lib/sfondo.js`). Chiesto dal lettore: «mi appare anche se decido di
// spegnere io il dispositivo?». Il guscio Android mette lo sfondo; qui si
// decide quando parlargli e cosa mandargli.
import { readFileSync } from "node:fs";
import {
  SALUTO, PACCHETTO, PEZZO, LATO_MAX, nelGuscio, salutoDelGuscio, risposta, pezzi, misuraSchermo, dentroIlRettangolo, leggiSfondo, scriviSfondo,
} from "../src/lib/sfondo.js";

const memoria = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
};

export default async function (t) {
  const SITO = "https://book-companion-ruddy.vercel.app";
  const porta = {};

  // ---- IL SALUTO --------------------------------------------------------
  t.c("il saluto del guscio, con la porta, dall'origine del sito", salutoDelGuscio({ data: SALUTO, origin: SITO, ports: [porta] }, SITO));
  t.c("…o dal pacchetto, se Chrome non ha verificato l'origine", salutoDelGuscio({ data: SALUTO, origin: `android-app://${PACCHETTO}`, ports: [porta] }, SITO));
  t.c("un messaggio da un'altra origine no", !salutoDelGuscio({ data: SALUTO, origin: "https://altro.example", ports: [porta] }, SITO));
  t.c("un saluto senza porta non serve a niente", !salutoDelGuscio({ data: SALUTO, origin: SITO, ports: [] }, SITO));
  t.c("un altro messaggio non e' un saluto", !salutoDelGuscio({ data: "ciao", origin: SITO, ports: [porta] }, SITO));
  t.c("il pacchetto e' quello di assetlinks", JSON.parse(readFileSync("public/.well-known/assetlinks.json", "utf8"))[0].target.package_name === PACCHETTO);
  t.c("e il saluto e' quello che il guscio manda", readFileSync("android/SchermataDiBlocco.java", "utf8").includes(`"${SALUTO}"`));
  t.c("nel guscio il referrer e' il pacchetto", nelGuscio(`android-app://${PACCHETTO}/`) && !nelGuscio("https://google.com/") && !nelGuscio(""));

  // ---- LA RISPOSTA ------------------------------------------------------
  t.eq("ok", JSON.stringify(risposta("grimorio:sfondo:ok")), '{"ok":true}');
  t.eq("un guasto, con la sua ragione", risposta("grimorio:sfondo:errore:non permesso")?.errore, "non permesso");
  t.eq("un guasto muto ha comunque una ragione", risposta("grimorio:sfondo:errore:")?.errore, "guasto sconosciuto");
  t.eq("altro non e' una risposta", risposta("grimorio:pronto"), null);

  // ---- A PEZZI ----------------------------------------------------------
  const b64 = "A".repeat(PEZZO * 2 + 10);
  const p = pezzi("libro1", b64).map((s) => JSON.parse(s).sfondo);
  t.eq("tre pezzi per due pezzi e dieci", p.length, 3);
  t.c("numerati, con quanti sono", p.every((x, i) => x.i === i && x.n === 3 && x.id === "libro1"));
  t.eq("e rimessi insieme sono l'immagine", p.map((x) => x.dati).join(""), b64);
  t.c("nessun pezzo supera il massimo", p.every((x) => x.dati.length <= PEZZO));
  t.eq("un'immagine piccola e' un pezzo solo", pezzi("x", "abc").length, 1);

  // ---- LA MISURA DELLO SCHERMO ------------------------------------------
  t.eq("il tablet del lettore, in pixel veri e in piedi", JSON.stringify(misuraSchermo({ width: 902, height: 1503, dpr: 1.33 })), JSON.stringify({ w: 1200, h: 1999 }));
  t.eq("sdraiato, lo stesso sfondo in piedi", JSON.stringify(misuraSchermo({ width: 1503, height: 902, dpr: 1.33 })), JSON.stringify({ w: 1200, h: 1999 }));
  const grande = misuraSchermo({ width: 1440, height: 3200, dpr: 1 });
  t.c("sopra il tetto si riduce tenendo le proporzioni", grande.h === LATO_MAX && Math.abs(grande.w / grande.h - 1440 / 3200) < 0.01, JSON.stringify(grande));
  t.eq("senza misure non si esplode", JSON.stringify(misuraSchermo({})), JSON.stringify({ w: 1, h: 1 }));

  // ---- INTERA DENTRO LO SCHERMO -----------------------------------------
  const r = dentroIlRettangolo(600, 900, 1200, 1999);
  t.eq("una copertina 2:3 su uno schermo 3:5 tocca i lati", r.w, 1200);
  t.c("…e sta in mezzo in altezza", r.h === 1800 && r.y === 99 && r.x === 0, JSON.stringify(r));
  const s = dentroIlRettangolo(1000, 1000, 1200, 1999);
  t.c("una quadrata tocca i lati e sta in mezzo", s.w === 1200 && s.h === 1200 && s.y === 399, JSON.stringify(s));
  t.eq("senza misure niente", dentroIlRettangolo(0, 10, 100, 100), null);

  // ---- LA SCELTA --------------------------------------------------------
  const m = memoria();
  t.c("spento finche' non lo accendi", !leggiSfondo(m));
  t.c("acceso resta acceso", scriviSfondo(true, m) && leggiSfondo(m));
  t.c("e spento resta spento", !scriviSfondo(false, m) && !leggiSfondo(m));
  t.c("una memoria rotta vuol dire spento", !leggiSfondo({ getItem: () => { throw new Error("no"); } }));
}
