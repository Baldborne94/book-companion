import { chromium } from "playwright";
import JSZip from "jszip";
const W = Number(process.env.W || 1280), H = Number(process.env.H || 768);
async function libro() {
  const z = new JSZip();
  z.file("mimetype", "application/epub+zip", { compression: "STORE" });
  z.file("META-INF/container.xml", `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`);
  z.file("OEBPS/content.opf", `<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">urn:uuid:banco-margini</dc:identifier><dc:title>Banco</dc:title><dc:language>en</dc:language><meta property="dcterms:modified">2026-01-01T00:00:00Z</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="c1" href="c1.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c1"/></spine></package>`);
  z.file("OEBPS/nav.xhtml", `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>T</title></head><body><nav epub:type="toc"><ol><li><a href="c1.xhtml">Uno</a></li></ol></nav></body></html>`);
  const frase = "Dalia glanced up at the psykers embedded in the walls of the chamber, understanding that they were the mortal fuel used to power this device. ";
  const p = Array.from({ length: 200 }, (_, i) => `<p>${frase.repeat(1 + (i % 4))}</p>`).join("");
  z.file("OEBPS/c1.xhtml", `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>Uno</title><style>p{text-indent:1.2em}</style></head><body>${p}</body></html>`);
  return z.generateAsync({ type: "nodebuffer" });
}
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: W, height: H } });
await ctx.route((u) => !/^(localhost|127\.0\.0\.1)$/.test(u.hostname), (r) => r.abort());
if (process.env.IMP) await ctx.addInitScript((imp) => { if (!localStorage.getItem("bc_reader")) localStorage.setItem("bc_reader", imp); }, process.env.IMP);
const p = await ctx.newPage();
await p.goto("http://localhost:4180/?apri=libreria");
await p.setInputFiles('input[accept^=".epub"]', { name: "Banco.epub", mimeType: "application/epub+zip", buffer: await libro() });
await p.getByText("Banco").first().click({ timeout: 20000 });
await p.getByRole("button", { name: /Apri il libro|Comincia/ }).first().click();
await p.waitForTimeout(6000);
if (process.env.VEDOVE) { await p.evaluate(() => { const d = [...document.querySelectorAll("iframe")].find((f) => f.contentDocument?.body?.innerText?.length > 100).contentDocument; const st = d.createElement("style"); st.textContent = "p{widows:1!important;orphans:1!important}"; d.head.appendChild(st); }); await p.waitForTimeout(800); console.log("con vedove a 1"); }
for (let giro = 0; giro < (Number(process.env.VOLTE) || 3); giro++) {
  const m = await p.evaluate(() => {
    const ifr = [...document.querySelectorAll("iframe")].find((f) => f.contentDocument?.body?.innerText?.length > 100);
    const v = ifr.closest("div[style*='padding']");
    const vr = v.getBoundingClientRect(), cs = getComputedStyle(v);
    const doc = ifr.contentDocument, ir = ifr.getBoundingClientRect();
    const bs = getComputedStyle(doc.body);
    const sx = (ifr.contentWindow.scrollX || doc.scrollingElement.scrollLeft);
    // righe visibili: rettangoli dei client rects delle parole dentro la vista
    const r = doc.createRange(); r.selectNodeContents(doc.body);
    const rects = [...r.getClientRects()].map((x) => ({ l: x.left - (ifr.contentWindow.scrollX||0), t: x.top, b: x.bottom })).filter((x) => x.l >= -1 && x.l < ir.width && x.b - x.t > 5);
    const top = Math.min(...rects.map((x) => x.t)), bot = Math.max(...rects.map((x) => x.b));
    const meta = ir.width / 2;
    const sin = rects.filter((x) => x.l < meta), des = rects.filter((x) => x.l >= meta);
    return {
      riquadro: [vr.top, vr.bottom], padding: [cs.paddingTop, cs.paddingBottom],
      iframe: [ir.top, ir.bottom], bodyPad: [bs.paddingTop, bs.paddingBottom], riga: getComputedStyle(doc.querySelector("p")).lineHeight,
      testoSin: [ir.top + Math.min(...sin.map((x) => x.t)), ir.top + Math.max(...sin.map((x) => x.b))],
      testoDes: des.length ? [ir.top + Math.min(...des.map((x) => x.t)), ir.top + Math.max(...des.map((x) => x.b))] : null,
      avanzo: localStorage.getItem(Object.keys(localStorage).find((k) => k.includes("avanzo")) || "x"),
    };
  });
  const s = m.testoSin, d = m.testoDes || s;
  console.log(JSON.stringify(m));
  console.log(`sopra: ${(s[0] - m.riquadro[0]).toFixed(1)}  sotto sin: ${(m.riquadro[1] - s[1]).toFixed(1)}  sotto des: ${(m.riquadro[1] - d[1]).toFixed(1)}`);
  await p.screenshot({ path: process.env.SHOT || "/tmp/claude-0/-home-user-book-companion/bc16680d-bf59-53a1-b939-bada45eba10f/scratchpad/banco/pagina.png" });
  await p.keyboard.press("ArrowRight"); await p.waitForTimeout(1500);
}
await b.close();
