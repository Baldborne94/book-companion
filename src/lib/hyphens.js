// SAPERE SE QUESTO BROWSER SILLABA DAVVERO, invece di sperarlo.
//
// `hyphens: auto` non e' una promessa: il browser spezza le parole solo se
// ha il dizionario di quella lingua, e i dizionari cambiano da browser a
// browser e da dispositivo a dispositivo. Dove manca, la regola viene
// accettata senza fare niente — e una colonna giustificata che non puo'
// spezzare le parole apre fiumi di bianco fra una parola e l'altra, cioe'
// il difetto che la giustificazione doveva togliere.
//
// Qui si misura invece di fidarsi: una parola lunga in una colonna troppo
// stretta per contenerla. Se il browser sa sillabare la manda a capo e
// prende due righe; se non sa, la lascia sbordare su una riga sola.

const PAROLE = {
  it: "straordinariamente",
  en: "incomprehensibility",
  es: "extraordinariamente",
  pt: "extraordinariamente",
  fr: "incompréhensiblement",
  de: "Unverständlichkeit",
  nl: "onbegrijpelijkheid",
  ca: "extraordinàriament",
  sv: "otillfredsställande",
  da: "usandsynligheden",
  no: "usannsynligheten",
  pl: "nieprawdopodobnie",
  ru: "достопримечательность",
};

const visto = new Map();

export function sillaba(lingua) {
  if (!lingua) return false;
  if (visto.has(lingua)) return visto.get(lingua);
  const parola = PAROLE[lingua];
  // lingua che non sappiamo interrogare: meglio non giustificare che
  // giustificare alla cieca
  if (!parola || typeof document === "undefined") {
    visto.set(lingua, false);
    return false;
  }
  let esito = false;
  const box = document.createElement("div");
  box.lang = lingua;
  box.textContent = parola;
  Object.assign(box.style, {
    position: "absolute",
    left: "-9999px",
    top: "0",
    visibility: "hidden",
    // stretta la meta' della parola: chi sa sillabare va a capo, chi non sa
    // sborda e resta su una riga
    width: "3em",
    font: "16px serif",
    overflowWrap: "normal",
    wordBreak: "normal",
    lineHeight: "1",
  });
  try {
    document.body.appendChild(box);
    box.style.hyphens = "manual";
    box.style.webkitHyphens = "manual";
    const intera = box.getBoundingClientRect().height;
    box.style.hyphens = "auto";
    box.style.webkitHyphens = "auto";
    const spezzata = box.getBoundingClientRect().height;
    esito = spezzata > intera + 1;
  } catch {
    esito = false;
  } finally {
    box.remove();
  }
  visto.set(lingua, esito);
  return esito;
}
