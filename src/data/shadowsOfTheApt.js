// SHADOWS OF THE APT, di Adrian Tchaikovsky: i dieci romanzi, in ordine.
//
// Il lettore l'ha cercata per nome in «📥 Senza file» e non ha trovato
// niente: su Wikidata la serie c'e' come voce, ma vuota, e nessun romanzo
// dice di farne parte. Quindi una guida. La fonte per i titoli e gli anni e'
// Wikidata, misurato il 9 novembre 2026, romanzo per romanzo (Empire in
// Black and Gold 2008 … Seal of the Worm 2014); l'ordine e' quello di uscita,
// che e' quello della storia.
export const SAGA = "Shadows of the Apt";

const A = "Adrian Tchaikovsky";

export default [
  { o: 1, t: "Empire in Black and Gold", c: SAGA, a: A },
  { o: 2, t: "Dragonfly Falling", c: SAGA, a: A },
  { o: 3, t: "Blood of the Mantis", c: SAGA, a: A },
  { o: 4, t: "Salute the Dark", c: SAGA, a: A },
  { o: 5, t: "The Scarab Path", c: SAGA, a: A },
  { o: 6, t: "The Sea Watch", c: SAGA, a: A },
  { o: 7, t: "Heirs of the Blade", c: SAGA, a: A },
  { o: 8, t: "The Air War", c: SAGA, a: A },
  { o: 9, t: "War Master's Gate", c: SAGA, a: A, alias: ["War Masters Gate"] },
  { o: 10, t: "Seal of the Worm", c: SAGA, a: A },
];

// LE STORIE DI MEZZO (chiesto dal lettore: «non mi consideri anche le storie
// di intramezzo delle serie?»): a parte dai romanzi, fuori dal cammino e dal
// riconoscimento, col loro numero; le usa solo l'elenco di «📥 Senza file»,
// che le propone senza spunta. Fonte: Hardcover, misurato il 10 novembre
// 2026 (la posizione nella serie e l'anno); solo quelle gia' uscite.
export const NOVELLE = [
  { o: 0.5, t: "Spoils of War", c: SAGA, a: "Adrian Tchaikovsky", anno: 2016 },
  { o: 10.6, t: "For Love of Distant Shores", c: SAGA, a: "Adrian Tchaikovsky", anno: 2018 },
  { o: 10.7, t: "The Scent of Tears", c: SAGA, a: "Adrian Tchaikovsky", anno: 2018 },
];
