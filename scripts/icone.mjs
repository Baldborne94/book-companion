// LE ICONE DELL'APP, DA UNA FONTE SOLA (chiesto dal lettore: «aggiornare
// l'icona con uno scheletro che legge»): uno scheletro incappucciato, la
// testa china e gli occhi accesi d'oro abbassati su un libro che tiene
// inclinato verso di se', sui colori della Biblioteca Magica. Disegno originale.
//
// COME SI TIENE UN LIBRO PER LEGGERLO (quattro giri col lettore): lo
// vediamo da davanti, quindi del libro vediamo le copertine da fuori e il
// taglio delle pagine in cima; le dita lo reggono da dietro, ai lati, e le
// maniche spuntano dai bordi. Col libro aperto verso di noi sembrava che lo
// mostrasse; con le mani sopra le pagine lo copriva; con le dita attorno ai
// bordi lo teneva «come un panino che deve mordere».
//
//   node scripts/icone.mjs   → public/icon.svg e public/icons/*.png
//
// Le regole imparate (docs/STORIA.md): i PNG a tela PIENA, senza angoli
// trasparenti (il launcher ci mette il suo bianco); scattati SULL'ELEMENTO,
// con l'SVG incorporato nella pagina (lo scatto a finestra di Chromium li
// tagliava all'84%); la mascherabile al 70%, dentro il cerchio di Android;
// l'SVG tondo fa da favicon. La mono e' bianca su trasparente.
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
const DEFS = `
  <linearGradient id="fondo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2e2450"/><stop offset="1" stop-color="#181233"/></linearGradient>
  <radialGradient id="alone" cx="50%" cy="48%" r="52%"><stop offset="0" stop-color="#d9a94e" stop-opacity="0.32"/><stop offset="0.6" stop-color="#9b7fd4" stop-opacity="0.10"/><stop offset="1" stop-color="#9b7fd4" stop-opacity="0"/></radialGradient>
  <linearGradient id="oro" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3d489"/><stop offset="1" stop-color="#c08f35"/></linearGradient>
  <linearGradient id="cappuccio" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a3878"/><stop offset="1" stop-color="#2a2048"/></linearGradient>
  <linearGradient id="osso" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4ead2"/><stop offset="1" stop-color="#cdbf9c"/></linearGradient>
  <linearGradient id="pagina" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7e9c4"/><stop offset="1" stop-color="#dcc48c"/></linearGradient>
  <radialGradient id="occhio" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff2c4"/><stop offset="0.45" stop-color="#f3c35a"/><stop offset="1" stop-color="#f3c35a" stop-opacity="0"/></radialGradient>`;

const TESCHIO = "M256 112 C 314 112 348 152 348 202 C 348 232 333 252 316 263 L 312 292 C 311 302 304 308 294 308 L 218 308 C 208 308 201 302 200 292 L 196 263 C 179 252 164 232 164 202 C 164 152 198 112 256 112 Z";
const CAPPUCCIO = "M256 64 C 352 64 408 146 408 246 L 408 344 L 104 344 L 104 246 C 104 146 160 64 256 64 Z";
const OCCHI = [[222, 204], [290, 204]];
// la testa china: scesa e ruotata, col mento dietro il libro
const TESTA = "translate(0 34) rotate(-5 256 214)";
// meta' libro visto da fuori (l'altra e' lo specchio), il taglio delle pagine, la manica
const COPERTA = "M256 322 L 104 306 L 100 452 L 256 476 Z";
const TAGLIO = "M256 310 L 116 294 L 116 312 L 256 330 L 396 312 L 396 294 Z";
const DITA = [364, 386, 408, 430];

const specchio = (s) => `<g transform="translate(512 0) scale(-1 1)">${s}</g>`;
// un osso: un'asta con la sua testa
const osso = (x1, y1, x2, y2, r) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke-width="${r * 2}"/><circle cx="${x2}" cy="${y2}" r="${r * 1.15}"/>`;
// le quattro dita che spuntano da dietro il bordo e si posano sulla copertina;
// due passate, il contorno scuro sotto e l'osso sopra, o sul viola non si leggono
function dita() {
  const su = DITA.map((y, i) => osso(94, y, 122, y + 1, 5.6) + osso(122, y + 1, 144 - (i === 3 ? 8 : 0), y + 4, 5)).join("");
  const sotto = su.replace(/stroke-width="([\d.]+)"/g, (m, w) => `stroke-width="${Number(w) + 5}"`).replace(/ r="([\d.]+)"/g, (m, r) => ` r="${Number(r) + 2.5}"`);
  return `<g stroke="#3a2c1c" fill="#3a2c1c" stroke-linecap="round">${sotto}</g><g stroke="#efe4c8" fill="#efe4c8" stroke-linecap="round">${su}</g>`;
}

function figura() {
  // la luce sta in fondo alle orbite: guarda in giu', dentro il libro
  const occhi = OCCHI.map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="27" ry="25" fill="#160f2b"/><ellipse cx="${x}" cy="${y + 12}" rx="14" ry="10" fill="url(#occhio)"/>`).join("");
  const manica = `<rect x="58" y="346" width="60" height="104" rx="22" fill="#2a2048" stroke="url(#oro)" stroke-width="5"/>`;
  const meta = `<path d="${COPERTA}" fill="#4b357a" stroke="url(#oro)" stroke-width="7" stroke-linejoin="round"/><path d="M238 340 L 120 328 L 117 436 L 238 454 Z" fill="none" stroke="url(#oro)" stroke-width="3" opacity="0.6"/>`;
  return `
  <path d="${CAPPUCCIO}" fill="url(#cappuccio)" stroke="url(#oro)" stroke-width="6"/>
  <path d="M150 300 C 150 200 190 126 256 116 C 322 126 362 200 362 300 Z" fill="#140e28" opacity="0.55"/>
  <g transform="${TESTA}"><path d="${TESCHIO}" fill="url(#osso)"/>${occhi}<path d="M256 228 L 245 254 L 267 254 Z" fill="#160f2b"/></g>
  <path d="${TAGLIO}" fill="url(#pagina)" stroke="#b39456" stroke-width="3" stroke-linejoin="round"/>
  ${manica}${specchio(manica)}
  ${meta}${specchio(meta)}
  <rect x="246" y="322" width="20" height="154" rx="6" fill="#2f2152" stroke="url(#oro)" stroke-width="4"/>
  <path d="M256 372 l 16 22 l -16 22 l -16 -22 Z" fill="url(#oro)"/>
  ${dita()}${specchio(dita())}`;
}

// tela: "tonda" (favicon, angoli arrotondati), "piena" (raster: il sistema ritaglia), "maschera" (70%), "mono"
function svg(tela) {
  if (tela === "mono") {
    // la sagoma: il teschio che spunta sopra il libro, il dorso e le dita come vuoti
    const vuoti = DITA.map((y) => `<line x1="92" y1="${y}" x2="142" y2="${y + 3}" stroke="black" stroke-width="9" stroke-linecap="round"/>`).join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512"><defs>${DEFS}
      <mask id="buchi"><rect width="512" height="512" fill="black"/>
        <g transform="translate(256 256) scale(0.86) translate(-256 -296)">
          <g transform="${TESTA}"><path d="${TESCHIO}" fill="white"/>${OCCHI.map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="27" ry="25" fill="black"/>`).join("")}<path d="M256 228 L 245 254 L 267 254 Z" fill="black"/></g>
          <path d="M256 296 L 96 280 L 92 458 L 256 484 L 420 458 L 416 280 Z" fill="black"/>
          <path d="${COPERTA}" fill="white"/>${specchio(`<path d="${COPERTA}" fill="white"/>`)}
          <path d="M256 322 L 256 476" stroke="black" stroke-width="8"/>
          ${vuoti}${specchio(vuoti)}
        </g></mask></defs>
      <rect width="512" height="512" fill="white" mask="url(#buchi)"/></svg>`;
  }
  const fondo = tela === "tonda" ? `<rect width="512" height="512" rx="104" fill="url(#fondo)"/>` : `<rect width="512" height="512" fill="url(#fondo)"/>`;
  const scala = tela === "maschera" ? `translate(256 256) scale(0.70) translate(-256 -272)` : `translate(0 0)`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512"><defs>${DEFS}</defs>
  ${fondo}<circle cx="256" cy="250" r="236" fill="url(#alone)"/>
  <g transform="${scala}">${figura()}</g></svg>`;
}

const LAVORI = [
  ["icons/icon-512.png", "piena", 512],
  ["icons/icon-192.png", "piena", 192],
  ["icons/apple-touch-icon.png", "piena", 180],
  ["icons/icon-maskable-512.png", "maschera", 512],
  ["icons/icon-mono-512.png", "mono", 512],
];

const pubblico = new URL("../public/", import.meta.url);
writeFileSync(new URL("icon.svg", pubblico), svg("tonda") + "\n");
const { chromium } = createRequire(import.meta.url)("playwright");
const browser = await chromium.launch();
const pagina = await browser.newPage({ deviceScaleFactor: 1 });
for (const [via, tela, lato] of LAVORI) {
  const s = svg(tela).replace('width="512" height="512"', `width="${lato}" height="${lato}"`);
  await pagina.setContent(`<html><body style="margin:0;background:transparent">${s}</body></html>`);
  await pagina.locator("svg").first().screenshot({ path: new URL(via, pubblico).pathname, omitBackground: tela === "mono" });
}
await browser.close();
console.log(`icone: icon.svg e ${LAVORI.length} PNG in public/`);
