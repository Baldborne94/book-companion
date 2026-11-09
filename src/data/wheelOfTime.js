// LA RUOTA DEL TEMPO (The Wheel of Time), di Robert Jordan e, per gli ultimi
// tre, Brandon Sanderson dalle sue note: i quattordici romanzi e il prequel.
//
// Chiesto dal lettore: «fai le guide… e altre se vedi che contengono molti
// libri». La Ruota sta sul suo scaffale (la saga scritta in due modi, «The
// Wheel of Time» e «Wheel of Time», e' in `docs/STORIA.md`). La fonte e'
// Wikidata, misurato il 9 novembre 2026: ogni titolo col suo anno (1990 …
// 2013). Il prequel (New Spring, 2004; per Wikidata il n° 0) sta dopo il quattordicesimo: i numeri
// da 1 a 14 sono quelli dei nomi dei file, e non si spostano.
//
// Gli ALIAS sono i titoli italiani che Wikidata registra.
//
// L'autore e' Jordan su ogni volume: le edizioni degli ultimi tre lo
// scrivono per primo, accanto a Sanderson.
export const SAGA = "The Wheel of Time";

const A = "Robert Jordan";

export default [
  { o: 1, t: "The Eye of the World", c: SAGA, a: A, alias: ["L'occhio del mondo"] },
  { o: 2, t: "The Great Hunt", c: SAGA, a: A, alias: ["La grande caccia"] },
  { o: 3, t: "The Dragon Reborn", c: SAGA, a: A, alias: ["Il drago rinato"] },
  { o: 4, t: "The Shadow Rising", c: SAGA, a: A, alias: ["L'ascesa dell'Ombra"] },
  { o: 5, t: "The Fires of Heaven", c: SAGA, a: A },
  { o: 6, t: "Lord of Chaos", c: SAGA, a: A, alias: ["Il signore del caos"] },
  { o: 7, t: "A Crown of Swords", c: SAGA, a: A, alias: ["La corona di spade"] },
  { o: 8, t: "The Path of Daggers", c: SAGA, a: A, alias: ["Il sentiero dei pugnali"] },
  { o: 9, t: "Winter's Heart", c: SAGA, a: A, alias: ["Winters Heart", "Il cuore dell'inverno"] },
  { o: 10, t: "Crossroads of Twilight", c: SAGA, a: A, alias: ["Crocevia del crepuscolo"] },
  { o: 11, t: "Knife of Dreams", c: SAGA, a: A, alias: ["La lama dei sogni"] },
  { o: 12, t: "The Gathering Storm", c: SAGA, a: A, alias: ["Presagi di tempesta"] },
  { o: 13, t: "Towers of Midnight", c: SAGA, a: A, alias: ["Le torri di mezzanotte"] },
  { o: 14, t: "A Memory of Light", c: SAGA, a: A, alias: ["Memoria di luce"] },
  { o: 15, t: "New Spring", c: SAGA, a: A, alias: ["Nuova Primavera"], nota: "prequel" },
];
