// LA PARTE MANGA E' STATA TOLTA (chiesto dal lettore: i capitoli gratis
// che voleva stanno solo sui siti pirata, e quelli non si collegano). Sui
// dispositivi resta la lista delle serie seguite: se ne va da sola, una
// volta, come gli avanzi di Drive. I capitoli gia' scaricati sono fumetti
// della biblioteca e restano.
export const CHIAVI_MANGA = ["bc_serie"];
// E LA SEZIONE «I LIBRI DEI TUOI AUTORI», TOLTA anche lei (chiesto dal
// lettore con la foto di Gaunt's Ghosts: «2 libri», ed e' una saga di
// sedici): Wikidata non lega a una saga quasi nessun libro della Black
// Library. La memoria delle opere se ne va allo stesso modo.
export const CHIAVI_AUTORI = ["bc_altri_autore"];

export function avanziManga(st = globalThis.localStorage) {
  let tolte = 0;
  for (const k of [...CHIAVI_MANGA, ...CHIAVI_AUTORI]) {
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
