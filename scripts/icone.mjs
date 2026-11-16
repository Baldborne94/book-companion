// LE ICONE DELL'APP, DA UNA FONTE SOLA (chiesto dal lettore: «aggiornare
// l'icona con uno scheletro che legge»): uno scheletro incappucciato, gli occhi
// accesi d'oro, chino su un libro aperto tenuto da due mani d'osso, sui colori
// della Biblioteca Magica. Disegno originale.
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
const COPERTINA = "M256 350 C 212 332 150 328 96 336 L 96 438 C 150 430 212 434 256 452 C 300 434 362 430 416 438 L 416 336 C 362 328 300 332 256 350 Z";
const PAGINA_S = "M256 342 C 216 324 160 320 112 326 L 112 424 C 160 418 216 422 256 440 Z";
const PAGINA_D = "M256 342 C 296 324 352 320 400 326 L 400 424 C 352 418 296 422 256 440 Z";
const OCCHI = [[222, 204], [290, 204]];

function righe() {
  let r = "";
  for (let i = 0; i < 4; i++) {
    const y = 350 + i * 18;
    r += `<path d="M132 ${y + 2} C 172 ${y - 4} 214 ${y} 240 ${y + 10}" />`;
    r += `<path d="M380 ${y + 2} C 340 ${y - 4} 298 ${y} 272 ${y + 10}" />`;
  }
  return r;
}
function dita(lato) {
  // tre falangi che stringono il bordo della pagina, piu' il pollice sopra
  const x = lato < 0 ? 84 : 388;
  let d = "";
  for (const y of [352, 374, 396]) d += `<rect x="${x}" y="${y - 7}" width="40" height="14" rx="7" /><circle cx="${x + (lato < 0 ? 26 : 14)}" cy="${y}" r="3.2" fill="#a8997a" />`;
  return d;
}

function figura() {
  const occhi = OCCHI.map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="27" ry="25" fill="#160f2b"/><circle cx="${x}" cy="${y + 6}" r="15" fill="url(#occhio)"/>`).join("");
  const denti = [228, 241, 254, 267, 280].map((x) => `<line x1="${x + 3}" y1="282" x2="${x + 3}" y2="304" />`).join("");
  return `
  <path d="${CAPPUCCIO}" fill="url(#cappuccio)" stroke="url(#oro)" stroke-width="6"/>
  <path d="M150 300 C 150 200 190 126 256 116 C 322 126 362 200 362 300 Z" fill="#140e28" opacity="0.55"/>
  <path d="${TESCHIO}" fill="url(#osso)"/>
  ${occhi}
  <path d="M256 228 L 245 254 L 267 254 Z" fill="#160f2b"/>
  <path d="M220 278 L 292 278" stroke="#7d6f55" stroke-width="3"/>
  <g stroke="#7d6f55" stroke-width="3">${denti}</g>
  <path d="${COPERTINA}" fill="#4b357a" stroke="url(#oro)" stroke-width="7" stroke-linejoin="round"/>
  <path d="${PAGINA_S}" fill="url(#pagina)"/>
  <path d="${PAGINA_D}" fill="url(#pagina)"/>
  <path d="M256 342 L 256 440" stroke="#b39456" stroke-width="3"/>
  <g fill="none" stroke="#9c8152" stroke-width="3" stroke-linecap="round" opacity="0.75">${righe()}</g>
  <g fill="url(#osso)" stroke="#8f8165" stroke-width="2">${dita(-1)}${dita(1)}</g>`;
}

// tela: "tonda" (favicon, angoli arrotondati), "piena" (raster: il sistema ritaglia), "maschera" (70%), "mono"
function svg(tela) {
  if (tela === "mono") {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512"><defs>${DEFS}
      <mask id="buchi"><rect width="512" height="512" fill="black"/>
        <g transform="translate(256 256) scale(0.82) translate(-256 -258)">
          <path d="${TESCHIO}" fill="white"/><path d="${COPERTINA}" fill="white"/>
          ${OCCHI.map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="27" ry="25" fill="black"/>`).join("")}
          <path d="M256 228 L 245 254 L 267 254 Z" fill="black"/>
          <path d="M218 280 L 294 280" stroke="black" stroke-width="6"/>
          <path d="M256 350 L 256 446" stroke="black" stroke-width="6"/>
        </g></mask></defs>
      <rect width="512" height="512" fill="white" mask="url(#buchi)"/></svg>`;
  }
  const fondo = tela === "tonda" ? `<rect width="512" height="512" rx="104" fill="url(#fondo)"/>` : `<rect width="512" height="512" fill="url(#fondo)"/>`;
  const scala = tela === "maschera" ? `translate(256 256) scale(0.70) translate(-256 -258)` : `translate(0 0)`;
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
