// XMLDOM NON ARRIVA MAI AL BROWSER, MA VIAGGIAVA LO STESSO.
//
// `npm audit` segnala due falle ALTE in produzione, e tutt'e due sono la
// stessa: `@xmldom/xmldom`, che epub.js si porta dietro. L'unico rimedio
// che npm propone è `epubjs@0.4.2`, che è una versione con rotture — cioè
// rifare il reader per una libreria che qui dentro non gira mai.
//
// Non gira mai, ed è misurato. epub.js la nomina in due punti soli:
//
//   utils/core.js  →  if (typeof DOMParser === "undefined" || forceXMLDom)
//   section.js     →  if (typeof XMLSerializer === "undefined" || isIE)
//
// Il primo ripiego è per Node, dove `DOMParser` non c'è; il secondo per
// Internet Explorer, che si riconosce da «Trident» nell'user agent. In un
// browser di oggi tutt'e due le condizioni sono false, e `forceXMLDom`
// non lo passa nessuno — né epub.js a sé stesso, né noi (cercato in
// tutt'e due i sorgenti: compare solo nella firma e nel commento).
//
// Quindi quei 60 kB non sono una dipendenza: sono codice morto con un
// bollino rosso sopra, spedito a ogni lettore. Questo file prende il suo
// posto (alias in `vite.config.js`) e l'app smette di imbarcarlo.
//
// SE PERÒ QUALCUNO LA CHIAMA DAVVERO, DEVE SENTIRSI. Un finto che
// restituisce un documento vuoto farebbe fallire l'apertura di un libro
// in un modo incomprensibile, tre passaggi più in là. Meglio l'eccezione,
// col nome di chi l'ha chiamata: chi la incontra sa subito che il
// ragionamento qui sopra non vale più su quel dispositivo, e che la
// strada è togliere l'alias, non aggirarlo.
const spiega = (chi) => {
  throw new Error(
    `Book Companion: ${chi} di @xmldom/xmldom è stato invocato davvero. ` +
      "Qui è sostituito da un finto perché nei browser epub.js non ci arriva mai " +
      "(vedi src/lib/xmldomFinto.js). Togliere l'alias in vite.config.js."
  );
};

export class DOMParser {
  constructor() {
    spiega("DOMParser");
  }
}

export class XMLSerializer {
  constructor() {
    spiega("XMLSerializer");
  }
}

export default { DOMParser, XMLSerializer };
