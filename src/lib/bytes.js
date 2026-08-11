// Una sola formattazione per tutti i pesi dell'app. Sta qui e non dentro un
// componente perche' due misure che si confrontano — lo spazio qui sul
// dispositivo e quello nel secchio — devono essere scritte allo stesso modo,
// o il confronto inganna.
// Il `max(1, …)` serve a non scrivere «0 MB» per mezzo mega — ma zero e'
// zero, e scriverlo «1 MB» faceva dire all'app che nessuna melodia occupa
// un megabyte.
export const fmtBytes = (n) =>
  !n ? "0 MB" : n >= 1e9 ? `${(n / 1e9).toFixed(1)} GB` : `${Math.max(1, Math.round(n / 1e6))} MB`;
