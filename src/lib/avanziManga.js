// LA PARTE MANGA E' STATA TOLTA (chiesto dal lettore: i capitoli gratis
// che voleva stanno solo sui siti pirata, e quelli non si collegano). Sui
// dispositivi resta la lista delle serie seguite: se ne va da sola, una
// volta, come gli avanzi di Drive. I capitoli gia' scaricati sono fumetti
// della biblioteca e restano.
export const CHIAVI_MANGA = ["bc_serie"];

export function avanziManga(st = globalThis.localStorage) {
  let tolte = 0;
  for (const k of CHIAVI_MANGA) {
    try {
      if (st?.getItem(k) == null) continue;
      st.removeItem(k);
      tolte += 1;
    } catch {
      /* senza memoria non c'e' niente da togliere */
    }
  }
  return tolte;
}
