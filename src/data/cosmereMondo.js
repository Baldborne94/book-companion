// L'ORDINE DI LETTURA DEL COSMERE INTERO (`MONDI` in `sagaBooks.js`),
// chiesto dal lettore dopo quello di Malazan: «fai lo stesso ordine di
// lettura per il Cosmere». Le guide restano tre (Mistborn, Stormlight, i
// romanzi a se' coi Secret Projects), ognuna coi suoi numeri; questo e' solo
// l'ordine in cui si leggono insieme.
//
// E' L'ORDINE DI USCITA, quello che Sanderson consiglia per chi vuole tutto
// il Cosmere: i rimandi fra i mondi sono scritti per chi ha letto quel che
// era gia' uscito. Ogni riga e' [guida, titolo, data della prima edizione]:
// Wikidata (P577) dove la dice al giorno, se no la prima edizione inglese
// su Hardcover (un «1° gennaio» li' e' solo l'anno), misurato l'11
// novembre 2026. Tress of the Emerald Sea su Wikidata ha solo il 2023, ed
// e' il primo dei Secret Projects di quell'anno. Le storie di mezzo
// (Edgedancer, Dawnshard, The Eleventh Metal, Secret History) restano
// nelle loro guide, fuori dal cammino come sempre.
import { SAGA as MISTBORN } from "./mistborn.js";
import { SAGA as STORMLIGHT } from "./stormlight.js";
import { SAGA as A_SE } from "./cosmereStandalones.js";

export const ORDINE = [
  [A_SE, "Elantris", "2005-05-01"],
  [MISTBORN, "The Final Empire", "2006-07-17"],
  [MISTBORN, "The Well of Ascension", "2007-08-21"],
  [MISTBORN, "The Hero of Ages", "2008-10-14"],
  [A_SE, "Warbreaker", "2009-06-09"],
  [STORMLIGHT, "The Way of Kings", "2010-08-31"],
  [MISTBORN, "The Alloy of Law", "2011"],
  [STORMLIGHT, "Words of Radiance", "2014-03-04"],
  [MISTBORN, "Shadows of Self", "2015-10-06"],
  [MISTBORN, "The Bands of Mourning", "2016-01-26"],
  [STORMLIGHT, "Oathbringer", "2017-11-14"],
  [STORMLIGHT, "Rhythm of War", "2020-11-17"],
  [MISTBORN, "The Lost Metal", "2022-11-15"],
  [A_SE, "Tress of the Emerald Sea", "2023"],
  [A_SE, "Yumi and the Nightmare Painter", "2023-07-01"],
  [A_SE, "The Sunlit Man", "2023-10-10"],
  [STORMLIGHT, "Wind and Truth", "2024-12-06"],
  [A_SE, "Isles of the Emberdark", "2025-07-10"],
];
