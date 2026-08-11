// Una sola formattazione per tutti i pesi dell'app. Sta qui e non dentro un
// componente perche' due misure che si confrontano — lo spazio qui sul
// dispositivo e quello nel secchio — devono essere scritte allo stesso modo,
// o il confronto inganna.
export const fmtBytes = (n) =>
  n >= 1e9 ? `${(n / 1e9).toFixed(1)} GB` : `${Math.max(1, Math.round(n / 1e6))} MB`;
