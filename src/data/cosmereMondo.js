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
// e' il primo dei Secret Projects di quell'anno.
//
// LE STORIE DI MEZZO STANNO NELLA FILA (quarta colonna `true`), chiesto
// dal lettore coi suoi Eleventh Metal, Secret History, Elsecaller,
// Edgedancer e Dawnshard sullo scaffale: «fallo anche per il cosmoverso».
// Numerato col mondo, il loro 1,5 o 3,5 della serie le avrebbe messe fra i
// romanzi sbagliati; qui prendono il posto del mondo con un decimale (dopo
// il romanzo uscito prima di loro), non sono volumi da contare ne' passi.
// Date della prima edizione su Hardcover: The Eleventh Metal 11 aprile 2012,
// Secret History 26 gennaio 2016 (lo stesso giorno di The Bands of
// Mourning: viene dopo il romanzo), Edgedancer 20 novembre 2016,
// Dawnshard 5 novembre 2020, Elsecaller 1° dicembre 2025.
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
  [MISTBORN, "The Eleventh Metal", "2012-04-11", true],
  [STORMLIGHT, "Words of Radiance", "2014-03-04"],
  [MISTBORN, "Shadows of Self", "2015-10-06"],
  [MISTBORN, "The Bands of Mourning", "2016-01-26"],
  [MISTBORN, "Mistborn: Secret History", "2016-01-26", true],
  [STORMLIGHT, "Edgedancer", "2016-11-20", true],
  [STORMLIGHT, "Oathbringer", "2017-11-14"],
  [STORMLIGHT, "Dawnshard", "2020-11-05", true],
  [STORMLIGHT, "Rhythm of War", "2020-11-17"],
  [MISTBORN, "The Lost Metal", "2022-11-15"],
  [A_SE, "Tress of the Emerald Sea", "2023"],
  [A_SE, "Yumi and the Nightmare Painter", "2023-07-01"],
  [A_SE, "The Sunlit Man", "2023-10-10"],
  [STORMLIGHT, "Wind and Truth", "2024-12-06"],
  [A_SE, "Isles of the Emberdark", "2025-07-10"],
  [STORMLIGHT, "Elsecaller and King Lopen the First of Alethkar", "2025-12-01", true],
];
