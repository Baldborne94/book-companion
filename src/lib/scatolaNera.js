// LA SCATOLA NERA DEL READER.
//
// Il libro ogni tanto salta, e succede solo su un tablet Android in Firefox
// — dove chi scrive il codice non puo' guardare. Indovinare la causa da qui
// e' costato tre tentativi e tre correzioni che non hanno chiuso la
// faccenda. Allora si smette di indovinare: il reader registra le ultime
// volte in cui il libro si e' mosso e CHI l'ha mosso, e chi legge puo'
// leggerlo sul suo dispositivo e mandarlo.
//
// La riga che conta e' la causa. Se dice «motore» vuol dire che a spostare
// il libro non e' stato nessuno dei nostri giri ma epub.js per conto suo, e
// la caccia va da tutt'altra parte.
//
// Vive in memoria e basta: e' un attrezzo da officina, non un archivio, e
// scrivere su disco a ogni voltata sarebbe un prezzo assurdo per una cosa
// che serve durante una sessione.

const TETTO = 40;
const righe = [];

export function segna(voce) {
  righe.push({ ...voce, t: Date.now() });
  if (righe.length > TETTO) righe.shift();
}

export const scatola = () => righe.slice();

export function svuota() {
  righe.length = 0;
}

const ora = (t) =>
  new Date(t).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

// Una riga per movimento, corta abbastanza da stare in uno screenshot.
// `→` separa da dove a dove; fra parentesi la misura della finestra, che su
// Android cambia da sola quando la barra del browser va e viene.
export function racconta() {
  if (!righe.length) return "Nessun movimento registrato.";
  const primo = righe[0].t;
  return righe
    .map((r) => {
      const dt = `+${((r.t - primo) / 1000).toFixed(1)}s`;
      const dove = `${r.daCap ?? "?"}:${r.daPag ?? "?"} → ${r.aCap ?? "?"}:${r.aPag ?? "?"}`;
      return `${ora(r.t)} ${dt.padStart(7)} ${String(r.causa).padEnd(12)} ${dove}  [${r.w}×${r.h}]`;
    })
    .join("\n");
}
