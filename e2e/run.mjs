// LE PROVE SULL'APP INTERA (chiesto dal lettore: «le prove nella CI»). I test
// di `test/` provano le decisioni una per una; qui si prova l'app costruita,
// in un browser vero, sulle strade dove un difetto e' gia' passato sotto i
// test di tutti i giorni: la saga scritta sul PC che non arrivava sul tablet
// (tre giri di fila, ognuno verde in `test/`), un libro che non si apre,
// l'Ingresso che perde un volume. Erano copioni fatti a mano e buttati via
// dopo ogni cura; qui restano, e la CI li rifa' a ogni PR.
//
//   npm run e2e   → costruisce l'app puntata sul Supabase finto, la serve,
//                   e fa girare le scene. Esce diverso da zero se una cade.
//
// Senza Playwright o senza un browser le scene si dichiarano SALTATE, come
// `test/tema.test.mjs`; nella CI (`CI=true`) saltare e' un fallimento.
import { existsSync } from "node:fs";
import { build, preview } from "vite";
import { avviaSupabase, sessioneFinta } from "./supabaseFinto.mjs";
import { fumetto, epub, FRASE, mondoDisco } from "./libri.mjs";

const PORTA_DB = 4599;
const PORTA_APP = 4190;
const URL_APP = `http://localhost:${PORTA_APP}/`;
const aspetta = (ms) => new Promise((r) => setTimeout(r, ms));

// finche' `vero()` non risponde, al massimo `ms`: ogni attesa ha un tetto
async function finche(vero, ms, perche) {
  const fine = Date.now() + ms;
  let ultimo;
  while (Date.now() < fine) {
    try {
      ultimo = await vero();
      if (ultimo) return ultimo;
    } catch {
      /* la pagina puo' essere a meta' di un caricamento */
    }
    await aspetta(250);
  }
  throw new Error(`${perche} (dopo ${ms / 1000} s)`);
}

async function lanciaBrowser() {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    return { saltato: "manca playwright — `npm i -D --no-save playwright && npx playwright install chromium`" };
  }
  const casa = process.env.PLAYWRIGHT_BROWSERS_PATH;
  const strade = [
    process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : null,
    {},
    casa && existsSync(`${casa}/chromium`) ? { executablePath: `${casa}/chromium` } : null,
    { channel: "chrome" },
  ].filter(Boolean);
  let ultimo = "";
  for (const opzioni of strade) {
    try {
      return { browser: await chromium.launch(opzioni) };
    } catch (e) {
      ultimo = String(e.message).split("\n")[0];
    }
  }
  return { saltato: `il browser non parte (${ultimo})` };
}

// un dispositivo: un contesto suo (il suo localStorage, il suo IndexedDB), a
// misura del tablet del lettore, coi guasti della pagina raccolti
// LA RETE ESTERNA E' CHIUSA: le scene non devono dipendere da Open Library
// o da Google (la prima volta in CI il catalogo vero ha dato a «Racconti» la
// saga di Moravia, e la scena cadeva per una ragione che qui non c'era). Chi
// vuole il catalogo se lo porta: `catalogo(url)` risponde al posto suo.
async function dispositivo(browser, { sessione = false, prima = null, catalogo = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.route(
    (url) => !/^(localhost|127\.0\.0\.1)$/.test(url.hostname),
    async (route) => {
      const url = route.request().url();
      if (catalogo && /openlibrary\.org/.test(url)) {
        const json = await catalogo(url);
        if (json) return route.fulfill({ json });
      }
      return route.abort();
    }
  );
  if (sessione) await ctx.addInitScript(sessioneFinta);
  if (prima) await ctx.addInitScript(prima);
  const p = await ctx.newPage();
  const guasti = [];
  p.on("pageerror", (e) => guasti.push(e.message));
  return { ctx, p, guasti };
}

const libriDi = (p) => p.evaluate(() => JSON.parse(localStorage.getItem("bc_books") || "[]"));
const testoAvviso = (p, re) =>
  p.evaluate((src) => {
    const r = new RegExp(src);
    return [...document.querySelectorAll("div,span,p")].map((e) => (e.childElementCount === 0 ? e.textContent : "")).find((t) => r.test(t || "")) || "";
  }, re.source);

async function importa(p, nome, buffer, mimeType) {
  await p.goto(`${URL_APP}?apri=libreria`);
  await p.setInputFiles('input[accept^=".epub"]', { name: nome, mimeType, buffer });
  const titolo = nome.replace(/\.[^.]+$/, "");
  await finche(async () => (await libriDi(p)).some((b) => b.title === titolo), 20000, `«${titolo}» non entra in biblioteca`);
}

const SCENE = [
  {
    nome: "la saga scritta sul PC arriva sul tablet, e il tablet lo dice",
    async fai({ browser, db }) {
      // IL CATALOGO RISPONDE DOPO LA MANO (trovato in CI con la rete vera):
      // la risposta resta ferma finche' la saga non e' scritta nella scheda,
      // e poi propone un'altra saga — che non deve coprire quella scritta
      let lascia;
      const scritta = new Promise((ok) => (lascia = ok));
      const catalogo = async (url) => {
        await scritta;
        if (url.includes("search.json")) return { docs: [{ key: "/works/OL1W", title: "Racconti", author_name: ["Alberto Moravia"] }] };
        return { entries: [1, 2, 3].map(() => ({ title: "Racconti", series: ["Opere complete di Alberto Moravia ; 7"] })) };
      };
      const pc = await dispositivo(browser, { sessione: true, catalogo });
      const tab = await dispositivo(browser, { sessione: true });
      await importa(pc.p, "Racconti.cbz", await fumetto(), "application/zip");
      await finche(() => db.righe().some((r) => r.title === "Racconti"), 20000, "il libro non sale nel cloud");
      await tab.p.goto(URL_APP);
      await finche(async () => (await libriDi(tab.p)).some((b) => b.title === "Racconti"), 20000, "il libro non scende sul tablet");

      await pc.p.getByText("Racconti").first().click();
      await pc.p.locator('input[placeholder="es. The Realm of the Elderlings"]').fill("Miti di Cthulhu");
      await pc.p.getByRole("button", { name: "Chiudi", exact: true }).click();
      // la scheda si salva CHIUDENDOSI: se resta aperta la saga non e' scritta
      await finche(async () => !(await pc.p.locator('input[placeholder="es. The Realm of the Elderlings"]').count()), 10000, "la scheda non si chiude");
      lascia();
      await finche(() => db.righe().some((r) => r.title === "Racconti" && r.saga === "Miti di Cthulhu"), 30000, "la saga non sale nel cloud").catch(async (e) => {
        // quando cade, dice dove: la scheda sul PC, il suo timbro, la riga
        // lassu', l'ultimo giro e i guasti del PC
        const qui = await pc.p.evaluate(() => {
          const b = JSON.parse(localStorage.getItem("bc_books") || "[]").find((x) => x.title === "Racconti");
          return { saga: b?.saga, sch: b && localStorage.getItem(`bc_sch_${b.id}`), giro: localStorage.getItem("bc_sync_racconto"), errori: localStorage.getItem("bc_errori") };
        });
        const lassu = db.righe().find((r) => r.title === "Racconti");
        throw new Error(`${e.message} — PC: ${JSON.stringify(qui)} · cloud: saga=${lassu?.saga} scheda_at=${lassu?.scheda_at}`);
      });

      // il catalogo ha risposto: la saga scritta a mano resta, qui e lassu'
      await aspetta(4000);
      const sulPc = (await libriDi(pc.p)).find((b) => b.title === "Racconti")?.saga;
      if (sulPc !== "Miti di Cthulhu") throw new Error(`il catalogo ha coperto la saga scritta a mano: sul PC «${sulPc}»`);

      await tab.p.goto(URL_APP);
      await finche(async () => (await libriDi(tab.p)).find((b) => b.title === "Racconti")?.saga === "Miti di Cthulhu", 20000, "la saga non arriva sul tablet");
      const avviso = await finche(() => testoAvviso(tab.p, /Dall'altro dispositivo.*Miti di Cthulhu/), 10000, "il tablet non dice che la saga e' arrivata");
      return { guasti: [...pc.guasti, ...tab.guasti], nota: avviso };
    },
  },
  {
    nome: "un ePub si importa e si apre",
    async fai({ browser }) {
      const d = await dispositivo(browser);
      await importa(d.p, "La nebbia.epub", await epub(), "application/epub+zip");
      await d.p.getByText("La nebbia").first().click();
      await d.p.getByRole("button", { name: /Apri il libro|Comincia/ }).first().click();
      await finche(
        async () => {
          for (const f of d.p.frames()) if ((await f.evaluate(() => document.body?.innerText || "").catch(() => "")).includes(FRASE)) return true;
          return false;
        },
        25000,
        "il testo del libro non compare"
      );
      const registro = await d.p.evaluate(() => JSON.parse(localStorage.getItem("bc_errori") || "[]"));
      return { guasti: [...d.guasti, ...registro.map((e) => `registro: ${e.m}`)] };
    },
  },
  {
    nome: "l'Ingresso propone il volume rimesso «Da leggere» e l'inizio del ciclo dopo",
    async fai({ browser }) {
      const d = await dispositivo(browser, { prima: mondoDisco });
      await d.p.goto(URL_APP);
      const nota = await finche(() => testoAvviso(d.p, /Discworld n° 10 · inizia Industrial Revolution · già al 12%/), 15000, "Moving Pictures non e' fra i seguiti");
      await finche(() => testoAvviso(d.p, /^Discworld n° 11 · già al 30%$/), 5000, "Reaper Man, rimesso «Da leggere», non e' fra i seguiti");
      return { guasti: d.guasti, nota };
    },
  },
];

async function principale() {
  const avvio = await lanciaBrowser();
  if (avvio.saltato) {
    console.log(`⚠ prove sull'app SALTATE — ${avvio.saltato}`);
    process.exit(process.env.CI ? 1 : 0);
  }
  const { browser } = avvio;
  process.env.VITE_SUPABASE_URL = `http://localhost:${PORTA_DB}`;
  process.env.VITE_SUPABASE_ANON_KEY = "finta";
  console.log("costruisco l'app per le prove…");
  await build({ logLevel: "warn", build: { outDir: "dist-e2e", emptyOutDir: true } });
  const server = await preview({ logLevel: "warn", preview: { port: PORTA_APP, strictPort: true }, build: { outDir: "dist-e2e" } });

  let cadute = 0;
  for (const scena of SCENE) {
    // ogni scena col suo cloud vuoto: una non eredita i libri dell'altra
    const db = await avviaSupabase(PORTA_DB);
    const t0 = Date.now();
    try {
      const { guasti = [], nota = "" } = await scena.fai({ browser, db });
      if (guasti.length) throw new Error(`guasti nella pagina: ${guasti.join(" | ")}`);
      console.log(`✓ ${scena.nome} (${((Date.now() - t0) / 1000).toFixed(1)} s)${nota ? ` — ${nota}` : ""}`);
    } catch (e) {
      cadute += 1;
      console.log(`✗ ${scena.nome} — ${e.message.split("\n")[0]}`);
    } finally {
      await db.chiudi();
      for (const c of browser.contexts()) await c.close();
    }
  }
  await browser.close();
  await new Promise((ok) => server.httpServer.close(ok));
  console.log(cadute ? `\n${cadute} ${cadute === 1 ? "scena caduta" : "scene cadute"}` : `\n${SCENE.length} scene, tutte in piedi`);
  process.exit(cadute ? 1 : 0);
}

await principale();
