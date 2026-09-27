// Una sola formattazione per tutti i pesi dell'app. Sta qui e non dentro un
// componente perche' due misure che si confrontano — lo spazio qui sul
// dispositivo e quello nel secchio — devono essere scritte allo stesso modo,
// o il confronto inganna.
// Il `max(1, …)` serve a non scrivere «0 MB» per mezzo mega — ma zero e'
// zero, e scriverlo «1 MB» faceva dire all'app che nessuna melodia occupa
// un megabyte.
export const fmtBytes = (n) =>
  !n ? "0 MB" : n >= 1e9 ? `${(n / 1e9).toFixed(1)} GB` : `${Math.max(1, Math.round(n / 1e6))} MB`;

// E I PESI DI GOOGLE SI SCRIVONO COME LI SCRIVE GOOGLE. Il piano «Basic da
// 100 GB» e' 107.374.182.400 byte — Google conta in potenze di due e le
// chiama GB — e scritto con `fmtBytes` diventava «107.4 GB»: un numero che
// non combacia con quello che il lettore ha comprato, cioe' un numero che
// sembra sbagliato. Dentro la barra di Drive si usa questa, tutta insieme,
// cosi' i pezzi tornano col totale.
const GIGA = 2 ** 30;
export const fmtGoogle = (n) => {
  if (!n) return "0 MB";
  if (n >= GIGA) return `${(n / GIGA).toFixed(1).replace(/\.0$/, "")} GB`;
  return `${Math.max(1, Math.round(n / 2 ** 20))} MB`;
};
