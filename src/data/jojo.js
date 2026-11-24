// LE BIZZARRE AVVENTURE DI JOJO, le parti i cui volumi non dicono la saga.
//
// Segnalato dal lettore: «sistemami tutte le saghe che da solo non è
// riuscito a sistemare, tipo JoJo». Le parti 2-5 e i primi quattro volumi
// della 6 portano il nome intero nel file («JoJo's_Bizarre_Adventure_Part_5
// _v16_…») e le legge `sagaDalTitolo`. Dal quinto volume della 6 in poi i
// file si chiamano solo «Volume 20 - Love Train - The World is One»: la saga
// stava nel nome della cartella di Drive, e la scheda non la ricorda. Il
// titolo si cerca col numero davanti, com'e' scritto nei file: «Escape» o
// «High Voltage» da soli starebbero dentro i titoli di chiunque.
//
// `n` e' il volume dentro la parte (ogni parte riparte da uno), `c` la parte,
// che e' il ciclo: il prossimo volume segue la parte.
export const SAGA = "JoJo's Bizarre Adventure";

const parte = (c, titoli, da = 1) => titoli.map((t, i) => ({ n: da + i, c, t: `Volume ${String(da + i).padStart(2, "0")} - ${t}` }));

export default [
  ...parte(
    "Parte 6",
    [
      "Savage Garden Strategy Head for the Courtyard",
      "Flash Flood Warning",
      "Ultra Security Solitary",
      "Burn Dragon's Dream",
      "Birth of the Green",
      "Awaken",
      "Head Out! Paradise Time",
      "Escape",
      "Sky High!",
      "Three Days to the New Moon",
      "Heavy Weather",
      "Coming to Cape Canaveral",
      "Made In Heaven",
    ],
    5
  ),
  ...parte("Parte 7", [
    "September 5th, 1890 San Diego Beach",
    "First Stage, 15,000 Meters",
    "Second Stage, Arizona Desert Crossing",
    "Gyro Zeppeli's Mission",
    "The President's Conspiracy",
    "Scary Monsters",
    "A Little Grave on the Wide, Wide Prairie",
    "To a Man's World",
    "A Stormy Night is Coming",
    "Illinois Skyline, Michigan Lakeline",
    "Create the Golden Rectangle!",
    "Qualifications for the Corpse, Qualifications for Friendship",
    "Wrecking Ball",
    "The Victor's Rights",
    "A Dream of Gettysburg",
    "Dirty Deeds Done Dirt Cheap",
    "D4C",
    "Ticket to Ride",
    "You Can't Get Rich",
    "Love Train - The World is One",
    "Ball Breaker",
    "Break My Heart, Break Your Heart",
    "High Voltage",
    "The Stars and Stripes Forever",
  ]),
  ...parte("Parte 8", [
    "Welcome to Morioh",
    "The Name Josuke Higashikata",
    "That Family Tree",
    "The Lemon and the Tangerine",
    "Morioh Town Year 1901",
    "Tsurugi Hogashikata's Goal, and the Architect",
    "King Nothing",
    "Every Day is a Summer Vacation",
    "Eldest Son- Jobin Higashikata",
    "Follow the Rokakaka Tree!",
    "The Twins Come to Town",
    "Hato-chan Brought a Boyfriend Over",
    "Walking Heart",
    "Dawn at the Higashikata House",
    "Dolomité's Blue Lagoon",
    "Mother and Son",
  ]),
];
