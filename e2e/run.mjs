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
import { existsSync, readFileSync } from "node:fs";
import { build, preview } from "vite";
import { avviaNas } from "./nasFinto.mjs";
import { avviaSupabase, sessioneFinta } from "./supabaseFinto.mjs";
import { fumetto, fumettoGrosso, fumettoLungo, epub, epubConContorno, epubConPagine, pdf, wav, FRASE, mondoDisco, png, pngRighe, pngFasce } from "./libri.mjs";
import { rar4 } from "../test/rar-finto.mjs";
import catalogoMonster from "../test/monster-catalogo.mjs";
import { lexicanumFinto, fandomFinto } from "./lexicanumFinto.mjs";
import { DIZIONARI } from "../src/lib/fonteDizionari.js";

// le richieste del service worker passano dalle rotte del contesto solo
// cosi' (Chromium): servono alla scena della melodia che suona mentre scende
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = "1";

const PORTA_DB = 4599;
const PORTA_APP = 4190;
const PORTA_NAS = 4610;
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
// I DIZIONARI OFFLINE invece sono file del repository (`dizionario/`), che
// GitHub serve dal ramo `main` (`lib/fonteDizionari.js`): qui li serve la
// cartella, con lo stesso CORS e lo stesso tipo di GitHub.
const dalRepository = (route, url) => {
  const file = new URL(`../dizionario/${url.slice(DIZIONARI.length + 1)}`, import.meta.url);
  const cors = { "access-control-allow-origin": "*" };
  if (!existsSync(file)) return route.fulfill({ status: 404, headers: cors, body: "" });
  return route.fulfill({ body: readFileSync(file), contentType: url.endsWith(".gz") ? "application/octet-stream" : "text/plain; charset=utf-8", headers: cors });
};
async function dispositivo(browser, { sessione = false, prima = null, catalogo = null, oracolo = null, misura = null, lexicanum = null, fandom = null, wikidata = null, copertine = null, hardcover = null } = {}) {
  const ctx = await browser.newContext(misura || { viewport: { width: 1280, height: 800 } });
  await ctx.route(
    (url) => !/^(localhost|127\.0\.0\.1)$/.test(url.hostname),
    async (route) => {
      const url = route.request().url();
      if (url.startsWith(`${DIZIONARI}/`)) return dalRepository(route, url);
      if (oracolo && /api\.anthropic\.com/.test(url)) return route.fulfill({ json: await oracolo(JSON.parse(route.request().postData() || "{}")) });
      if (lexicanum && /wh40k\.lexicanum\.com/.test(url)) return lexicanum(route);
      if (fandom && /warhammer40k\.fandom\.com|static\.wikia\.nocookie\.net/.test(url)) return fandom(route);
      // le immagini di Hardcover: senza intestazioni CORS, come le vere
      if (hardcover && /assets\.hardcover\.app/.test(url)) return route.fulfill({ body: pngRighe(300, 450, 4, [40, 120, 200], [10, 10, 30]), contentType: "image/png" });
      if (hardcover && /api\.hardcover\.app/.test(url)) {
        const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization,content-type", "access-control-allow-methods": "POST, OPTIONS" };
        if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors, body: "" });
        return route.fulfill({ json: await hardcover(JSON.parse(route.request().postData() || "{}"), route.request().headers().authorization || ""), headers: cors });
      }
      if (wikidata && /www\.wikidata\.org\/w\/api\.php/.test(url)) return route.fulfill({ json: await wikidata(new URL(url).searchParams), headers: { "access-control-allow-origin": "*" } });
      if (copertine && /covers\.openlibrary\.org/.test(url)) {
        const body = await copertine(url);
        return body ? route.fulfill({ body, contentType: "image/png", headers: { "access-control-allow-origin": "*" } }) : route.fulfill({ status: 404, headers: { "access-control-allow-origin": "*" }, body: "" });
      }
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

// SELEZIONA UNA PAROLA NEL LIBRO e apre la scheda del dizionario. La pagina
// si rimonta dopo la prima misura (l'avanzo di riga) e una selezione fatta
// prima si perde: si riseleziona finche' il menu della selezione c'e'.
async function definisci(p, parola) {
  const tasto = () => p.getByRole("button", { name: /Definisci|Significato/ });
  await finche(
    async () => {
      for (const f of p.frames()) {
        const fatto = await f
          .evaluate((w) => {
            const it = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
            for (let n = it.nextNode(); n; n = it.nextNode()) {
              const i = n.nodeValue.indexOf(w);
              if (i < 0) continue;
              const r = document.createRange();
              r.setStart(n, i);
              r.setEnd(n, i + w.length);
              document.getSelection().removeAllRanges();
              document.getSelection().addRange(r);
              return true;
            }
            return false;
          }, parola)
          .catch(() => false);
        if (!fatto) continue;
        for (let i = 0; i < 8; i++) {
          if (await tasto().count()) return true;
          await aspetta(250);
        }
      }
      return false;
    },
    25000,
    `«${parola}» non si lascia selezionare, o il menu non compare`
  );
  await tasto().first().click();
}

// il tablet del lettore (CLAUDE.md): Chrome Android, 902×1503 a densita' 1,33, col dito
const TABLET = {
  viewport: { width: 902, height: 1503 },
  deviceScaleFactor: 1.33,
  hasTouch: true,
  isMobile: true,
  userAgent: "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36",
};

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
    // chiesto dal lettore, che la chiave di Hardcover non se la ricordava:
    // «falla sincronizzare sugli altri dispositivi», e lo stesso per Claude
    nome: "la chiave di Hardcover salvata sul PC arriva sul tablet, e tolta sul PC si toglie anche li'",
    async fai({ browser, db }) {
      const pc = await dispositivo(browser, { sessione: true });
      const tab = await dispositivo(browser, { sessione: true, misura: TABLET });
      const chiaveSu = () => (db.prefs()?.raccolte_fav || []).find((v) => v?.id === "chiave|hardcover");
      await pc.p.goto(URL_APP);
      await pc.p.getByRole("button", { name: /^Impostazioni/ }).first().click();
      await pc.p.getByRole("textbox", { name: "Chiave di Hardcover" }).fill("hc_pat_dal_pc");
      await pc.p.getByRole("button", { name: "Salva la chiave di Hardcover" }).click();
      await finche(() => chiaveSu()?.k === "hc_pat_dal_pc", 20000, "la chiave non sale nelle preferenze");
      await tab.p.goto(URL_APP);
      await finche(async () => (await tab.p.evaluate(() => localStorage.getItem("bc_hardcover_key"))) === "hc_pat_dal_pc", 20000, "la chiave non arriva sul tablet");
      await tab.p.getByRole("button", { name: /^Impostazioni/ }).first().click();
      await finche(() => tab.p.getByText(/✓ Chiave salvata/).count(), 8000, "le Impostazioni del tablet non la dicono salvata");
      // tolta sul PC: una lapide, che arriva e la toglie anche dal tablet
      await pc.p.getByRole("button", { name: "Togli la chiave" }).click();
      await finche(() => chiaveSu()?.deleted === true, 20000, "la chiave tolta non sale come lapide");
      await tab.p.goto(URL_APP);
      await finche(async () => (await tab.p.evaluate(() => localStorage.getItem("bc_hardcover_key"))) === null, 20000, "la chiave tolta sul PC resta sul tablet");
      return { guasti: [...pc.guasti, ...tab.guasti], nota: "salvata sul PC, arrivata sul tablet e detta nelle Impostazioni; tolta sul PC, tolta anche sul tablet" };
    },
  },
  {
    // chiesto dal lettore, con Kingdom aperto sul tablet e «Da leggere» sul
    // PC: «fai solo in modo che quando apro l'app questa si sincronizzi
    // tutto». Il tablet il libro aperto lo manda su da solo; il PC, con la
    // finestra sempre davanti, non chiedeva niente finche' non si cambiava
    // scheda del browser
    nome: "il libro aperto sul tablet sale da solo, e il PC lo riceve quando torni sulla sua finestra",
    async fai({ browser, db }) {
      const tab = await dispositivo(browser, { sessione: true, misura: TABLET });
      const pc = await dispositivo(browser, { sessione: true });
      await importa(tab.p, "Racconti.cbz", await fumetto(), "application/zip");
      await finche(() => db.righe().some((r) => r.title === "Racconti"), 20000, "il libro non sale nel cloud");
      await pc.p.goto(URL_APP);
      await finche(async () => (await libriDi(pc.p)).some((b) => b.title === "Racconti"), 20000, "il libro non scende sul PC");
      const statoSulPc = () => pc.p.evaluate(() => {
        const b = JSON.parse(localStorage.getItem("bc_books") || "[]").find((x) => x.title === "Racconti");
        return b && localStorage.getItem(`bc_status_${b.id}`);
      });
      // il PC resta davanti, e il giro dell'avvio e' finito
      await aspetta(4000);

      await tab.p.getByText("Racconti").first().click();
      await tab.p.getByRole("button", { name: /Apri il libro|Comincia/ }).first().click();
      await finche(() => tab.p.locator("img").count(), 15000, "il fumetto non si apre");
      // il libro resta aperto e l'app va dietro (il tasto Home del tablet)
      await tab.p.evaluate(() => {
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await finche(() => db.righe().find((r) => r.title === "Racconti")?.status === "reading", 15000, "il libro aperto sul tablet non sale nel cloud");

      // sul PC si torna sulla finestra: niente cambio di scheda del browser
      if ((await statoSulPc()) === "reading") throw new Error("il PC sapeva gia' del libro aperto: la scena non prova niente");
      await pc.p.evaluate(() => window.dispatchEvent(new Event("focus")));
      await finche(async () => (await statoSulPc()) === "reading", 15000, "tornando sulla finestra il PC non riceve il libro aperto sul tablet");
      return { guasti: [...tab.guasti, ...pc.guasti], nota: "aperto sul tablet, salito da solo, arrivato sul PC tornando sulla finestra" };
    },
  },
  {
    // E IL DIFETTO TROVATO CERCANDO QUELLO («sistema il difetto», chiesto dal
    // lettore): la lettura viaggiava con l'ora della riga, e una scheda
    // cambiata sul PC dopo la lettura sul tablet rimandava su «Da leggere»
    nome: "una scheda cambiata sul PC non copre il libro che il tablet sta leggendo",
    async fai({ browser, db }) {
      const tab = await dispositivo(browser, { sessione: true, misura: TABLET });
      const pc = await dispositivo(browser, { sessione: true });
      await importa(tab.p, "Racconti.cbz", await fumettoLungo(6), "application/zip");
      await finche(() => db.righe().some((r) => r.title === "Racconti"), 20000, "il libro non sale nel cloud");
      await pc.p.goto(`${URL_APP}?apri=libreria`);
      await finche(async () => (await libriDi(pc.p)).some((b) => b.title === "Racconti"), 20000, "il libro non scende sul PC");
      await aspetta(4000);

      await tab.p.getByText("Racconti").first().click();
      await tab.p.getByRole("button", { name: /Apri il libro|Comincia/ }).first().click();
      const lassu = () => db.righe().find((r) => r.title === "Racconti");
      await finche(() => lassu()?.status === "reading", 20000, "il libro aperto sul tablet non sale");
      const progresso = lassu().progress;

      // il PC non ha ricevuto niente, e cambia la saga
      const sulPc = () => pc.p.evaluate(() => {
        const b = JSON.parse(localStorage.getItem("bc_books") || "[]").find((x) => x.title === "Racconti");
        return b && { stato: localStorage.getItem(`bc_status_${b.id}`), saga: b.saga };
      });
      if ((await sulPc()).stato === "reading") throw new Error("il PC sapeva gia' del libro aperto: la scena non prova niente");
      await pc.p.getByText("Racconti").first().click();
      await pc.p.locator('input[placeholder="es. The Realm of the Elderlings"]').fill("Racconti brevi");
      await pc.p.getByRole("button", { name: "Chiudi", exact: true }).click();
      await finche(() => lassu()?.saga === "Racconti brevi", 20000, "la saga del PC non sale");
      const dopo = lassu();
      if (dopo.status !== "reading" || dopo.progress !== progresso) throw new Error(`la scheda del PC ha coperto la lettura del tablet: lassu' «${dopo.status}» al ${dopo.progress}`);
      await finche(async () => (await sulPc()).stato === "reading", 10000, "il PC non prende la lettura del tablet");
      // e chi riceve la lettura posa la SUA ora, non quella in cui l'ha
      // ricevuta: con l'ora del ricevimento, la lettura vecchia di qui
      // vincerebbe su quella fatta di la' nel frattempo
      const oraDi = (p) => p.evaluate(() => {
        const b = JSON.parse(localStorage.getItem("bc_books") || "[]").find((x) => x.title === "Racconti");
        return Number(localStorage.getItem(`bc_let_${b?.id}`) || 0);
      });
      const ora = lassu().lettura_at;
      if (!(ora > 0)) throw new Error(`lassu' la lettura non ha la sua ora: ${ora}`);
      if ((await oraDi(pc.p)) !== ora) throw new Error(`il PC ha posato la lettura con l'ora sbagliata: ${await oraDi(pc.p)} invece di ${ora}`);
      const tel = await dispositivo(browser, { sessione: true });
      await tel.p.goto(URL_APP);
      await finche(async () => (await libriDi(tel.p)).some((b) => b.title === "Racconti"), 20000, "il libro non scende sul terzo dispositivo");
      await finche(async () => (await oraDi(tel.p)) === ora, 10000, `il terzo dispositivo ha posato la lettura con l'ora sbagliata: ${await oraDi(tel.p)} invece di ${ora}`);
      return { guasti: [...tab.guasti, ...pc.guasti, ...tel.guasti], nota: `lassu' «${dopo.saga}», ${dopo.status} al ${Math.round(dopo.progress * 100)}%, e la sua ora su PC e telefono` };
    },
  },
  {
    // segnalato dal lettore: «a me sembra che alcune copertine siano
    // sgranate». Una copertina a righe di un pixel, ridotta bene, e' un
    // grigio uniforme; col filtro veloce del canvas fa bande
    nome: "una copertina grande si riduce senza grana: la miniatura dell'ePub, e la copertina del fumetto e la sua miniatura",
    async fai({ browser }) {
      // ridotta bene, una tela a righe di un pixel e' un grigio uniforme
      const righe = pngRighe(1666, 2500, 1, [255, 255, 255], [0, 0, 0]);
      const d = await dispositivo(browser);
      await importa(d.p, "La nebbia.epub", await epub({ copertina: righe }), "application/epub+zip");
      await importa(d.p, "Racconti.cbz", await fumetto({ prima: righe }), "application/zip");
      await d.p.goto(`${URL_APP}?apri=libreria`);
      const oscilla = (titolo) =>
        d.p.evaluate(async (titolo) => {
          const libro = JSON.parse(localStorage.getItem("bc_books") || "[]").find((b) => b.title === titolo);
          const db = await new Promise((ok, ko) => {
            const r = indexedDB.open("bc_library");
            r.onsuccess = () => ok(r.result);
            r.onerror = () => ko(r.error);
          });
          const leggi = (store, k) => new Promise((ok) => {
            const r = db.transaction(store).objectStore(store).get(k);
            r.onsuccess = () => ok(r.result);
            r.onerror = () => ok(null);
          });
          const scarto = async (blob) => {
            if (!blob) return null;
            const img = await createImageBitmap(blob);
            const t = new OffscreenCanvas(img.width, img.height).getContext("2d");
            t.drawImage(img, 0, 0);
            const px = t.getImageData(0, 0, img.width, img.height).data;
            let somma = 0, quadri = 0, n = 0;
            for (let i = 0; i < px.length; i += 4) {
              somma += px[i];
              quadri += px[i] * px[i];
              n++;
            }
            const media = somma / n;
            return { lato: Math.max(img.width, img.height), scarto: Math.round(Math.sqrt(quadri / n - media * media) * 10) / 10 };
          };
          return { copertina: await scarto(await leggi("covers", libro.id)), miniatura: await scarto((await leggi("aux", `min_${libro.id}`))?.blob) };
        }, titolo);
      const misura = (titolo) => finche(async () => {
        const x = await oscilla(titolo);
        return x.copertina && x.miniatura && x;
      }, 15000, `la copertina o la miniatura di «${titolo}» non ci sono`);
      const libro = await misura("La nebbia");
      const comic = await misura("Racconti");
      // ridotta bene il grigio oscilla di pochi punti (il JPEG); a bande, di decine
      const guai = [
        libro.miniatura.scarto > 12 && `la miniatura dell'ePub e' a bande (${libro.miniatura.scarto})`,
        comic.copertina.scarto > 12 && `la copertina del fumetto e' a bande (${comic.copertina.scarto})`,
        comic.miniatura.scarto > 12 && `la miniatura del fumetto e' a bande (${comic.miniatura.scarto})`,
      ].filter(Boolean);
      if (guai.length) throw new Error(guai.join("; "));
      return { guasti: d.guasti, nota: `il grigio oscilla di ${libro.miniatura.scarto} nella miniatura dell'ePub (la copertina resta quella del file, da ${libro.copertina.lato}), di ${comic.copertina.scarto} nella copertina del fumetto (da ${comic.copertina.lato}) e di ${comic.miniatura.scarto} nella sua miniatura` };
    },
  },
  {
    // chiesto dal lettore: «sì, fai il tasto per rifare le copertine dei
    // fumetti». Una copertina salvata prima della cura (ridotta a bande,
    // senza il segno della nitida) si rifa' dal file, e il tasto se ne va
    nome: "le copertine dei fumetti salvate sgranate si rifanno dal file dalla Manutenzione, e il tasto se ne va",
    async fai({ browser }) {
      const d = await dispositivo(browser);
      await importa(d.p, "Racconti.cbz", await fumetto({ prima: pngRighe(1666, 2500, 1, [255, 255, 255], [0, 0, 0]) }), "application/zip");
      const tasto = () => d.p.getByRole("button", { name: /^🖼 Rifai / });
      const apri = async () => {
        await d.p.goto(`${URL_APP}?apri=libreria`);
        await d.p.getByRole("button", { name: /Manutenzione/ }).first().click();
        await aspetta(1500);
      };
      await apri();
      if (await tasto().count()) throw new Error("una copertina nata dopo la cura e' gia' nitida, e il tasto non dovrebbe esserci");
      // la copertina di prima della cura: a bande, e senza il segno
      const stato = (azione) =>
        d.p.evaluate(async (azione) => {
          const libro = JSON.parse(localStorage.getItem("bc_books") || "[]").find((b) => b.title === "Racconti");
          const db = await new Promise((ok, ko) => {
            const r = indexedDB.open("bc_library");
            r.onsuccess = () => ok(r.result);
            r.onerror = () => ko(r.error);
          });
          const fai = (store, modo, f) => new Promise((ok, ko) => {
            const tx = db.transaction(store, modo);
            const r = f(tx.objectStore(store));
            tx.oncomplete = () => ok(r?.result);
            tx.onerror = () => ko(tx.error);
          });
          if (azione === "sgrana") {
            const tela = new OffscreenCanvas(533, 800);
            const g = tela.getContext("2d");
            for (let y = 0; y < 800; y += 6) {
              g.fillStyle = "#fff";
              g.fillRect(0, y, 533, 3);
            }
            const bande = await tela.convertToBlob({ type: "image/jpeg", quality: 0.85 });
            await fai("covers", "readwrite", (s) => s.put(bande, libro.id));
            await fai("aux", "readwrite", (s) => s.delete(IDBKeyRange.bound(`nitida_${libro.id}_`, `nitida_${libro.id}_\uffff`)));
            return null;
          }
          const cover = await fai("covers", "readonly", (s) => s.get(libro.id));
          const segni = await fai("aux", "readonly", (s) => s.getAllKeys(IDBKeyRange.bound(`nitida_${libro.id}_`, `nitida_${libro.id}_\uffff`)));
          const img = await createImageBitmap(cover);
          const t = new OffscreenCanvas(img.width, img.height).getContext("2d");
          t.drawImage(img, 0, 0);
          const px = t.getImageData(0, 0, img.width, img.height).data;
          let somma = 0, quadri = 0, n = 0;
          for (let i = 0; i < px.length; i += 4) {
            somma += px[i];
            quadri += px[i] * px[i];
            n++;
          }
          const media = somma / n;
          return { scarto: Math.round(Math.sqrt(quadri / n - media * media) * 10) / 10, segno: segni.includes(`nitida_${libro.id}_${cover.size}`) };
        }, azione);
      const prima = await stato();
      if (!prima.segno) throw new Error("la copertina nata all'import non ha il segno della nitida");
      await stato("sgrana");
      const sgranata = await stato();
      if (sgranata.scarto < 40 || sgranata.segno) throw new Error(`la copertina di prima della cura non e' quella voluta: ${JSON.stringify(sgranata)}`);
      await apri();
      await finche(() => tasto().count(), 8000, "la copertina sgranata non fa comparire «Rifai»");
      const scritta = await tasto().first().textContent();
      await tasto().first().click();
      await finche(() => testoAvviso(d.p, /una copertina rifatta/), 15000, "il giro non dice di aver rifatto la copertina");
      const dopo = await stato();
      if (dopo.scarto > 12 || !dopo.segno) throw new Error(`la copertina rifatta non e' nitida o non ha il segno: ${JSON.stringify(dopo)}`);
      await apri();
      if (await tasto().count()) throw new Error("rifatta la copertina, il tasto c'e' ancora");
      return { guasti: d.guasti, nota: `«${scritta.trim()}»: il grigio oscillava di ${sgranata.scarto}, rifatta di ${dopo.scarto}, col segno; poi il tasto non c'e' piu'` };
    },
  },
  {
    // chiesto dal lettore con la foto della raccolta di Monster: «per Monster
    // riesci a recuperarmi le copertine?». La raccolta aperta cerca su Open
    // Library (qui la risposta vera, salvata nei test), mostra l'elenco, e
    // mette solo quel che resta spuntato
    nome: "le copertine di una raccolta dal catalogo: l'elenco, una tolta, le altre messe e ricordate come scelte a mano",
    async fai({ browser }) {
      const domande = [];
      const catalogo = (url) => {
        const q = new URL(url).searchParams;
        if (/search\.json/.test(url)) domande.push(q.get("q") || q.get("title"));
        return q.get("q") === "Monster vol" ? { docs: catalogoMonster } : { docs: [] };
      };
      // il catalogo: il volume 1 blu, il 2 rosso, il 3 verde
      const COLORI = { 863480: [30, 60, 200], 764859: [200, 30, 30], 764959: [30, 170, 60] };
      const copertine = (url) => {
        const n = Number(url.match(/\/id\/(\d+)-/)?.[1]);
        return COLORI[n] ? png(300, 450, COLORI[n]) : null;
      };
      const raccolte = () => localStorage.setItem("bc_vista", JSON.stringify({ aspetto: "raccolte" }));
      const d = await dispositivo(browser, { misura: TABLET, prima: `(${raccolte})();`, catalogo, copertine });
      // tre grigi appena diversi: tre file uguali sarebbero lo stesso libro
      for (const n of [1, 2, 3]) await importa(d.p, `Monster v0${n}.cbz`, await fumetto({ prima: png(300, 450, [126 + n, 128, 128]) }), "application/zip");
      const libri = await libriDi(d.p);
      const ids = Object.fromEntries(libri.map((b) => [b.sagaOrder, b.id]));
      if (libri.length !== 3 || libri.some((b) => b.saga !== "Monster") || !ids[1] || !ids[2] || !ids[3]) throw new Error(`i volumi non sono una raccolta numerata: ${JSON.stringify(libri.map((b) => [b.title, b.saga, b.sagaOrder]))}`);
      await d.p.goto(`${URL_APP}?apri=libreria`);
      await d.p.getByRole("button", { name: /^Monster/ }).first().click();
      domande.length = 0;
      await d.p.getByRole("button", { name: "🖼 Copertine dal catalogo" }).click();
      await finche(() => d.p.getByRole("button", { name: "🖼 Metti le 3 copertine" }).count(), 10000, "l'elenco delle copertine non arriva");
      const viste = await d.p.locator('img[alt^="Copertina del catalogo"]').count();
      if (viste !== 3) throw new Error(`nell'elenco ${viste} copertine del catalogo (attese 3)`);
      // alla misura del tablet l'elenco sta nello schermo
      const sborda = await d.p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (sborda > 0) throw new Error(`l'elenco sborda di ${sborda}px`);
      await d.p.getByRole("checkbox", { name: "Volume 3" }).click();
      await d.p.getByRole("button", { name: "🖼 Metti le 2 copertine" }).click();
      await finche(() => testoAvviso(d.p, /^🖼 2 copertine dal catalogo$/), 10000, "non dice di aver messo le copertine");
      const stato = await d.p.evaluate(async (ids) => {
        const db = await new Promise((ok, ko) => { const r = indexedDB.open("bc_library"); r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); });
        const colore = async (id) => {
          const c = await new Promise((ok) => { const r = db.transaction("covers").objectStore("covers").get(id); r.onsuccess = () => ok(r.result); });
          const b = await createImageBitmap(c);
          const t = new OffscreenCanvas(b.width, b.height).getContext("2d");
          t.drawImage(b, 0, 0);
          const [r, g, bl] = t.getImageData(b.width >> 1, b.height >> 1, 1, 1).data;
          return r > 150 && g < 80 ? "rossa" : bl > 150 && r < 80 ? "blu" : g > 130 && r < 80 ? "verde" : "grigia";
        };
        return Promise.all([1, 2, 3].map(async (n) => `${n}:${await colore(ids[n])}${localStorage.getItem(`bc_cov_mano_${ids[n]}`) === "1" ? " a mano" : ""}`));
      }, ids);
      const atteso = "1:blu a mano,2:rossa a mano,3:grigia";
      if (stato.join() !== atteso) throw new Error(`copertine: ${stato.join()} (attese ${atteso})`);
      if (domande.join() !== "Monster vol") throw new Error(`domande al catalogo: ${domande.join(" | ")}`);
      return { guasti: d.guasti, nota: `${stato.join(", ")}; una domanda sola al catalogo` };
    },
  },
  {
    // segnalato dal lettore con la foto dello scaffale di Kingdom: dal volume
    // 10 la prima pagina e' la sovraccoperta giapponese aperta, 800×543, e
    // sullo scaffale c'erano il dorso e il codice a barre. Manga e' segnato
    // il solo primo volume (senza file qui): gli altri lo sono per la saga
    nome: "la sovraccoperta aperta di un manga mostra il fronte a sinistra, quella di un fumetto a destra, sullo scaffale e nella scheda",
    async fai({ browser }) {
      const semina = () => {
        if (localStorage.getItem("bc_books")) return;
        localStorage.setItem("bc_books", JSON.stringify([{ id: "k1", title: "Kingdom v01", saga: "Kingdom", sagaOrder: 1, fileType: "cbz", tipo: "manga", fileTolto: true, addedAt: 1 }]));
      };
      const d = await dispositivo(browser, { misura: TABLET, prima: `(${semina})();` });
      // fronte del manga rosso, dorso grigio, retro blu; il fumetto al contrario
      const ROSSO = [200, 30, 30], GRIGIO = [128, 128, 128], BLU = [30, 60, 200], VERDE = [30, 170, 60];
      await importa(d.p, "Kingdom v10.cbz", await fumetto({ prima: pngFasce(800, 543, [[348, ROSSO], [452, GRIGIO], [800, BLU]]) }), "application/zip");
      await importa(d.p, "Spawn v01.cbz", await fumetto({ prima: pngFasce(800, 543, [[348, BLU], [452, GRIGIO], [800, VERDE]]) }), "application/zip");
      const libri = await libriDi(d.p);
      const k10 = libri.find((b) => b.title === "Kingdom v10");
      if (k10?.saga !== "Kingdom" || k10.tipo) throw new Error(`Kingdom v10 non e' entrato nella saga senza tipo suo: ${JSON.stringify(k10)}`);
      // il colore al centro dell'immagine, e le sue proporzioni
      const guarda = (via = []) =>
        d.p.evaluate(async (via) => {
          const out = [];
          for (const img of document.querySelectorAll("img")) {
            if (!img.src.startsWith("blob:") || !img.naturalWidth || via.includes(img.src)) continue;
            const t = new OffscreenCanvas(img.naturalWidth, img.naturalHeight).getContext("2d");
            t.drawImage(img, 0, 0);
            const [r, g, b] = t.getImageData(img.naturalWidth >> 1, img.naturalHeight >> 1, 1, 1).data;
            const colore = r > 150 && g < 80 ? "rosso" : b > 150 && r < 80 ? "blu" : g > 130 && r < 80 ? "verde" : "grigio";
            out.push(`${colore} ${img.naturalWidth < img.naturalHeight ? "in piedi" : "sdraiata"}`);
          }
          return out.sort().join(", ");
        }, via);
      await d.p.goto(`${URL_APP}?apri=libreria`);
      const scaffale = await finche(async () => { const v = await guarda(); return v.split(", ").length === 2 && v; }, 15000, "sullo scaffale non ci sono le due copertine");
      const miniature = await d.p.evaluate(() => [...document.querySelectorAll("img")].map((i) => i.src));
      if (scaffale !== "rosso in piedi, verde in piedi") throw new Error(`sullo scaffale: ${scaffale} (attesi il fronte rosso di Kingdom e quello verde di Spawn)`);
      // la scheda mostra la copertina intera (un indirizzo nuovo): anche li' il fronte
      await d.p.getByText("Kingdom v10").first().click();
      const scheda = await finche(() => guarda(miniature), 8000, "la scheda non mostra la copertina");
      if (scheda !== "rosso in piedi") throw new Error(`nella scheda di Kingdom v10: ${scheda}`);
      // la copertina salvata resta la pagina com'e' (si ritaglia quando si mostra)
      const salvata = await d.p.evaluate(async (id) => {
        const db = await new Promise((ok, ko) => { const r = indexedDB.open("bc_library"); r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); });
        const c = await new Promise((ok) => { const r = db.transaction("covers").objectStore("covers").get(id); r.onsuccess = () => ok(r.result); });
        const b = await createImageBitmap(c);
        return `${b.width}×${b.height}`;
      }, k10.id);
      if (salvata !== "800×543") throw new Error(`la copertina salvata e' stata cambiata: ${salvata}`);
      return { guasti: d.guasti, nota: `scaffale: ${scaffale}; scheda: ${scheda}; salvata ${salvata}` };
    },
  },
  {
    // chiesto dal lettore, con la foto del pannello: «The World of Elan che
    // comprende diverse saghe scritta da Michael J. Sullivan come mai non le
    // riconosce ma le vede solo come saghe singole a parte?»
    nome: "«The World of Elan»: per nome il mondo intero nella raccolta «The World of Elan», e i libri gia' sullo scaffale ci tornano da «Saghe da sistemare» con le serie della guida",
    async fai({ browser }) {
      // la biblioteca della foto del lettore: le Leggende come raccolta, con
      // dentro The Rise and Fall e le Cronache; le Rivelazioni a parte
      const S = "Michael J. Sullivan";
      const r = (id, title, saga, series, sagaOrder) => ({ id, title, author: S, saga, series, sagaOrder, fileType: "nessuno", fileTolto: true, addedAt: 1 });
      const libri = [
        r("e1", "The Crown Conspiricy", "The Riyria Revelations", "", 1),
        r("e2", "Avempartha", "The Riyria Revelations", "", 2),
        r("l1", "Age of Myth", "The Legends of the First Empire", "", 1),
        r("l2", "Age of Swords", "The Legends of the First Empire", "", 2),
        r("n1", "Nolyn", "The Legends of the First Empire", "The Rise and Fall", 1),
        r("c1", "The Crown Tower", "The Legends of the First Empire", "The Riyria Chronicles", 1),
      ];
      const d = await dispositivo(browser, {
        misura: TABLET,
        prima: `localStorage.getItem("bc_books") || localStorage.setItem("bc_books", ${JSON.stringify(JSON.stringify(libri))});`,
      });
      const { p } = d;
      await p.goto(`${URL_APP}?apri=libreria`);
      await p.getByRole("button", { name: "📥 Senza file" }).click();
      await p.getByRole("textbox", { name: "Nome della saga" }).fill("The World of Elan");
      await p.getByRole("button", { name: "🔍 Cerca i libri" }).click();
      await finche(() => p.getByText(/tutte le guide dell'app di questo mondo/).count(), 5000, "«The World of Elan» non e' un mondo dell'app");
      const raccolta = await p.getByRole("combobox", { name: "Raccolta" }).inputValue();
      if (raccolta !== "The World of Elan") throw new Error(`la raccolta proposta non e' «The World of Elan»: «${raccolta}»`);
      const gia = await p.getByText("✓ è già sullo scaffale").count();
      if (gia !== 6) throw new Error(`gia' sullo scaffale: ${gia} invece dei sei del lettore`);
      for (const t of ["Age of Myth", "The Crown Tower", "Nolyn", "Drumindor"]) if (!(await p.getByText(t, { exact: true }).count())) throw new Error(`nel mondo manca «${t}»`);
      await p.getByRole("button", { name: "Chiudi", exact: true }).click();

      // e quelli gia' sullo scaffale si propongono, riga per riga
      await p.getByRole("button", { name: /Manutenzione/ }).first().click();
      await p.getByRole("button", { name: "📚 Saghe da sistemare" }).click();
      await finche(() => p.getByText("The World of Elan · Legends of the First Empire · n. 1").count(), 5000, "Age of Myth non si propone in «The World of Elan»");
      if ((await libriDi(p)).find((b) => b.id === "l1").saga !== "The Legends of the First Empire") throw new Error("la saga si e' riscritta prima del tocco");
      await p.getByRole("button", { name: "Sistema 6" }).click();
      const scaffale = async () =>
        (await libriDi(p))
          .map((b) => `${b.title}=${b.saga}/${b.series}/${b.sagaOrder}`)
          .sort()
          .join(" | ");
      const atteso = [
        "Age of Myth=The World of Elan/Legends of the First Empire/1",
        "Age of Swords=The World of Elan/Legends of the First Empire/2",
        "Avempartha=The World of Elan/The Riyria Revelations/2",
        "Nolyn=The World of Elan/The Rise and Fall/1",
        "The Crown Conspiricy=The World of Elan/The Riyria Revelations/1",
        "The Crown Tower=The World of Elan/The Riyria Chronicles/1",
      ].join(" | ");
      await finche(async () => (await scaffale()) === atteso, 5000, `lo scaffale non e' in «The World of Elan» con le serie della guida`).catch(async (e) => {
        throw new Error(`${e.message}: ${await scaffale()}`);
      });
      return { guasti: d.guasti, nota: `per nome in «${raccolta}»; sistemati sei libri nelle quattro serie` };
    },
  },
  {
    // chiesto dal lettore: «ho dei problemi con Covenant, Enderverse che ha
    // Ender Saga a parte». Le sue schede, sparse in cinque raccolte: «Saghe
    // da sistemare» le porta in «Thomas Covenant» ed «Enderverse», con la
    // serie e il numero del mondo
    nome: "Thomas Covenant e l'Enderverse: da «Saghe da sistemare» i volumi sparsi tornano nelle raccolte del lettore, con la serie e il numero del mondo",
    async fai({ browser }) {
      const r = (id, title, author, saga, series, sagaOrder) => ({ id, title, author, saga, series, sagaOrder, fileType: "epub", fileTolto: true, addedAt: 1 });
      const D = "Stephen R. Donaldson";
      const C = "Orson Scott Card";
      const libri = [
        r("lfb", "Lord Foul's Bane", D, "The Last Chronicles of Thomas Covenant", "", 1),
        r("ld", "The Last Dark", D, "The Complete Chronicles of Thomas Covenant", "", 4),
        r("wl", "The Wounded Land", D, "The 2nd Chronicles of Thomas Covenant", "", 1),
        r("eg", "Ender's Game", C, "Ender Saga", "The Ender Quintet", 1),
        r("eie", "Ender in Exile", C, "Ender Saga", "The Ender Quintet", 5),
        r("es", "Ender's Shadow", C, "Enderverse", "", 5),
      ];
      const d = await dispositivo(browser, {
        misura: TABLET,
        prima: `localStorage.getItem("bc_books") || localStorage.setItem("bc_books", ${JSON.stringify(JSON.stringify(libri))});`,
      });
      const { p } = d;
      await p.goto(`${URL_APP}?apri=libreria`);
      await p.getByRole("button", { name: /Manutenzione/ }).first().click();
      await p.getByRole("button", { name: "📚 Saghe da sistemare" }).click();
      await finche(() => p.getByText("Enderverse · The Ender Quintet · n. 11").count(), 5000, "Ender in Exile non si propone all'undicesimo dell'Enderverse");
      await p.getByRole("button", { name: "Sistema 6" }).click();
      const scaffale = async () =>
        (await libriDi(p))
          .map((b) => `${b.title}=${b.saga}/${b.series}/${b.sagaOrder}`)
          .sort()
          .join(" | ");
      const atteso = [
        "Ender in Exile=Enderverse/The Ender Quintet/11",
        "Ender's Game=Enderverse/The Ender Quintet/1",
        "Ender's Shadow=Enderverse/The Shadow Series/5",
        "Lord Foul's Bane=Thomas Covenant/The Chronicles of Thomas Covenant the Unbeliever/1",
        "The Last Dark=Thomas Covenant/The Last Chronicles of Thomas Covenant/10",
        "The Wounded Land=Thomas Covenant/The Second Chronicles of Thomas Covenant/4",
      ].join(" | ");
      await finche(async () => (await scaffale()) === atteso, 5000, "le schede non tornano nelle due raccolte").catch(async (e) => {
        throw new Error(`${e.message}: ${await scaffale()}`);
      });
      return { guasti: d.guasti, nota: "sei schede da cinque raccolte a due, con la serie e il numero del mondo" };
    },
  },
  {
    // chiesto dal lettore: «il nas proprio come nas locale», «vorrei leggere
    // anche fuori casa». Il NAS su un'altra origine, come il nginx di
    // docs/NAS.md dietro Tailscale: l'indirizzo nelle Impostazioni, il
    // controllo, e «Apri» su un libro senza file qui lo prende da li'
    nome: "il NAS: l'indirizzo nelle Impostazioni, il controllo trova i libri, e un libro senza file qui si prende dal NAS e si apre",
    async fai({ browser }) {
      const nas = await avviaNas(PORTA_NAS, { file: { "book-companion/Libri/La nebbia.epub": await epub(), "book-companion/Fumetti/Racconti/Racconti 01.cbz": await fumetto() } });
      try {
        const libri = [{ id: "nb", title: "La nebbia", author: "Autore di Prova", fileType: "epub", fileTolto: true, addedAt: 1 }];
        const d = await dispositivo(browser, { misura: TABLET, prima: `localStorage.getItem("bc_books") || localStorage.setItem("bc_books", ${JSON.stringify(JSON.stringify(libri))});` });
        const { p } = d;
        await p.goto(URL_APP);
        await p.getByRole("button", { name: /^Impostazioni/ }).first().click();
        await p.getByRole("textbox", { name: "Indirizzo del NAS" }).fill(`http://localhost:${PORTA_NAS}/libri`);
        await p.getByRole("button", { name: "Salva e prova" }).click();
        const risponde = await finche(() => testoAvviso(p, /^Il NAS risponde/), 8000, "il NAS non risponde dalle Impostazioni");
        await p.getByRole("button", { name: "🔍 Guarda cosa c'è sul NAS" }).click();
        const trovati = await finche(() => testoAvviso(p, /un libro della biblioteca ha il file sul NAS/), 8000, "il controllo del NAS non trova il libro");
        if (!/un file senza scheda/.test(trovati)) throw new Error(`il fumetto senza scheda non si dice: «${trovati}»`);
        // il libro senza file qui: «Scegli il file» lo prende dal NAS e lo apre
        await p.goto(`${URL_APP}?apri=libreria`);
        await p.getByText("La nebbia").first().click();
        await p.getByRole("button", { name: "📂 Scegli il file" }).click();
        await finche(
          async () => {
            for (const f of p.frames()) if ((await f.evaluate(() => document.body?.innerText || "").catch(() => "")).includes(FRASE)) return true;
            return false;
          },
          25000,
          "il libro preso dal NAS non si apre"
        );
        const scheda = (await libriDi(p)).filter((b) => b.title === "La nebbia");
        if (scheda.length !== 1 || scheda[0].fileTolto) throw new Error(`il file non e' tornato nella sua scheda: ${JSON.stringify(scheda)}`);
        return { guasti: d.guasti, nota: `«${risponde}» · ${nas.viste.filter((v) => v.endsWith(".epub")).length} richiesta del file` };
      } finally {
        await nas.chiudi();
      }
    },
  },
  {
    nome: "un ePub si importa e si apre",
    async fai({ browser }) {
      const d = await dispositivo(browser);
      await d.p.goto(URL_APP);
      await d.p.getByRole("button", { name: "Libreria" }).first().click();
      // la Libreria e' un pezzo a parte: la misura si scrive quando e' a schermo
      await finche(() => d.p.evaluate(() => JSON.parse(localStorage.getItem("bc_tempi") || "[]").some((x) => x.c === "libreria")), 10000, "la Libreria aperta dal menu non e' misurata");
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
      // e i tempi sono misurati (`lib/tempi.js`): l'avvio, la Libreria aperta
      // dal menu, l'ePub dal tocco alla pagina
      const tempi = await finche(
        async () => {
          const v = await d.p.evaluate(() => JSON.parse(localStorage.getItem("bc_tempi") || "[]"));
          return ["avvio", "libreria", "epub"].every((c) => v.some((x) => x.c === c)) ? v : null;
        },
        10000,
        "i tempi dell'avvio, della Libreria e dell'ePub non sono annotati"
      );
      if (!tempi.every((x) => x.ver)) throw new Error(`una misura senza la versione della build: ${JSON.stringify(tempi.find((x) => !x.ver))}`);
      const ep = tempi.find((x) => x.c === "epub");
      if (!("pagina" in ep.f) || !("byte" in ep.f)) throw new Error(`apertura dell'ePub misurata male: ${JSON.stringify(ep)}`);
      const registro = await d.p.evaluate(() => JSON.parse(localStorage.getItem("bc_errori") || "[]"));
      return { guasti: [...d.guasti, ...registro.map((e) => `registro: ${e.m}`)], nota: tempi.map((x) => `${x.c} ${Object.values(x.f).reduce((a, b) => a + b, 0)} ms`).join(" · ") };
    },
  },
  {
    // chiesto dal lettore: «mi sembra di aver letto di più di quanto dici».
    // Il tempo di lettura butta i tratti oltre i 4 minuti fra due voltate, e
    // prima di cambiare la regola si misura quanto si butta: il rapporto dei
    // guasti lo dice, giorno per giorno e per lettore
    nome: "il rapporto dei guasti dice quanto tempo di lettura si è contato e quante pause si sono scartate",
    async fai({ browser }) {
      const d = await dispositivo(browser, {
        misura: TABLET,
        // l'orologio parte da mezzogiorno di oggi: i tratti si contano per
        // giorno, e la CI partita alle 23:56 coi cinque minuti di salto
        // finiva a domani («la pausa lunga non si annota» nel giorno di ieri)
        prima: () => {
          const vero = Date.now;
          const inizio = vero();
          const mezzogiorno = new Date(inizio).setHours(12, 0, 0, 0);
          Date.now = () => mezzogiorno + (vero() - inizio) + (window.__salto || 0);
        },
      });
      await d.p.goto(URL_APP);
      await importa(d.p, "La nebbia.epub", await epub({ quanti: 80 }), "application/epub+zip");
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
      const tratti = () => d.p.evaluate(() => JSON.parse(localStorage.getItem("bc_pause") || "[]")[0] || { v: 0, x: [] });
      await d.p.keyboard.press("ArrowRight");
      await finche(async () => (await tratti()).v >= 1, 8000, "la voltata non si conta");
      // cinque minuti sulla stessa pagina, poi la voltata
      await d.p.evaluate(() => (window.__salto = 5 * 60 * 1000 + 5000));
      await d.p.keyboard.press("ArrowRight");
      await finche(async () => (await tratti()).x.length >= 1, 8000, "la pausa lunga non si annota");
      await d.p.goto(URL_APP);
      await d.p.getByRole("button", { name: /^Impostazioni/ }).first().click();
      await d.p.getByRole("button", { name: "Vedi il rapporto" }).click();
      const testo = await finche(() => d.p.evaluate(() => [...document.querySelectorAll("pre")].map((e) => e.textContent).find((t) => t.includes("rapporto dei guasti")) || ""), 5000, "il rapporto non si vede");
      for (const atteso of ["Tempo di lettura su questo dispositivo (un giorno):", "scartate 1 pausa per 5 min", "Pause scartate per durata: 4–10 min 1", "per lettore: ePub 1"])
        if (!testo.includes(atteso)) throw new Error(`nel rapporto manca «${atteso}»:\n${testo.split("Tempo di lettura")[1] || testo.slice(-400)}`);
      return { guasti: d.guasti, nota: testo.split("\n").find((r) => r.includes("scartate")).trim() };
    },
  },
  {
    // chiesto dal lettore, fra le cose del Kindle: «fai il tempo che resta
    // nel capitolo e nel libro». Qui il passo si misura con l'orologio
    // spostato: trenta secondi a pagina, e un salto di dieci minuti che non
    // e' lettura
    nome: "il tempo che resta al capitolo e alla fine sta in fondo alla pagina, e il passo e' quello misurato su questo libro",
    async fai({ browser }) {
      const d = await dispositivo(browser, {
        prima: () => {
          const vero = Date.now;
          Date.now = () => vero() + (window.__salto || 0);
        },
      });
      await d.p.goto(URL_APP);
      await importa(d.p, "La nebbia.epub", await epub({ quanti: 80 }), "application/epub+zip");
      const id = (await libriDi(d.p)).find((b) => b.title === "La nebbia").id;
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
      // alla prima pagina c'e' gia' un numero: il passo iniziale
      const riga = d.p.getByText(/^\d+% · .+ al capitolo · .+ alla fine$/);
      await finche(() => riga.count(), 15000, "il tempo che resta non si legge in fondo alla pagina");
      const prima = await riga.first().textContent();
      const passo = () => d.p.evaluate((id) => JSON.parse(localStorage.getItem(`bc_passo_${id}`) || "null"), id);
      if (await passo()) throw new Error("un libro appena aperto ha gia' un passo misurato");
      // tre pagine da trenta secondi: il passo e' misurato su questo libro
      for (let i = 0; i < 3; i++) {
        await d.p.evaluate(() => (window.__salto = (window.__salto || 0) + 30000));
        await d.p.keyboard.press("ArrowRight");
        await aspetta(600);
      }
      const p = await finche(async () => (await passo())?.u > 0 && (await passo()), 8000, "il passo non si e' misurato dopo tre pagine");
      if (!(p.s >= 60 && p.s <= 120)) throw new Error(`tre tratti da trenta secondi valgono ${p.s} s`);
      // dieci minuti sulla stessa pagina non sono lettura: il passo non cambia
      await d.p.evaluate(() => (window.__salto += 10 * 60 * 1000));
      await d.p.keyboard.press("ArrowRight");
      await aspetta(800);
      const dopo = await passo();
      if (dopo.s !== p.s) throw new Error(`una pausa di dieci minuti e' entrata nel passo: ${p.s} → ${dopo.s}`);
      const poi = await riga.first().textContent();
      if (poi === prima) throw new Error(`dopo quattro pagine la riga non e' cambiata: ${poi}`);
      // e un fumetto dice le pagine e il tempo, col passo suo
      await d.p.goto(URL_APP);
      await importa(d.p, "Il segreto di Arcadia.cbz", await fumettoLungo(30), "application/zip");
      const idF = (await libriDi(d.p)).find((b) => b.title === "Il segreto di Arcadia").id;
      await d.p.getByText("Il segreto di Arcadia").first().click();
      await d.p.getByRole("button", { name: /Apri il libro|Comincia/ }).first().click();
      const rigaF = d.p.getByText(/^\d+ pagine · ~.+ alla fine$/);
      await finche(() => rigaF.count(), 20000, "nel fumetto le pagine e il tempo che resta non si leggono");
      // la pagina e' nuova: l'orologio riparte da zero
      await d.p.evaluate(() => (window.__salto = (window.__salto || 0) + 20000));
      await d.p.keyboard.press("ArrowRight");
      const pf = await finche(async () => {
        const v = await d.p.evaluate((id) => JSON.parse(localStorage.getItem(`bc_passo_${id}`) || "null"), idF);
        return v?.u > 0 && v;
      }, 8000, "il passo del fumetto non si e' misurato");
      if (!(pf.s >= 19 && pf.s <= 22 && pf.u >= 1 && pf.u <= 2)) throw new Error(`una tavola da venti secondi vale ${JSON.stringify(pf)}`);
      return { guasti: d.guasti, nota: `ePub: «${prima}» → «${poi}»; fumetto: ${JSON.stringify(pf)}` };
    },
  },
  {
    // il rapporto del lettore: il 3/11 un minuto contato e 42 scartati, il
    // 4/11 77 secondi in media a pagina. Il tempo si contava solo fra due
    // voltate, e quello passato nella scheda del dizionario o in una voce
    // dei wiki non era lettura. Scelto da lui: «conta anche il tempo nel
    // dizionario e nei wiki»
    nome: "il tempo passato nella scheda del dizionario si conta come lettura, finche' la tocchi",
    async fai({ browser }) {
      const d = await dispositivo(browser, {
        misura: TABLET,
        prima: () => {
          const vero = Date.now;
          Date.now = () => vero() + (window.__salto || 0);
        },
      });
      await d.p.goto(URL_APP);
      await importa(d.p, "La nebbia.epub", await epub({ quanti: 80 }), "application/epub+zip");
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
      const secondi = () => d.p.evaluate(() => Object.values(JSON.parse(localStorage.getItem("bc_tempo") || "{}")).reduce((a, g) => a + Object.values(g).reduce((x, y) => x + y, 0), 0));
      await d.p.keyboard.press("ArrowRight");
      await finche(async () => (await secondi()) >= 0 && (await d.p.evaluate(() => JSON.parse(localStorage.getItem("bc_pause") || "[]")[0]?.v)) >= 1, 8000, "la voltata non si conta");
      const prima = await secondi();
      await definisci(d.p, "nebbia");
      const tocca = async () => {
        const r = await d.p.getByText("nebbia", { exact: true }).first().boundingBox();
        await d.p.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2);
      };
      // sette minuti nella scheda, toccandola ogni tre: poi si chiude e si volta
      for (const min of [3, 6]) {
        await d.p.evaluate((m) => (window.__salto = m * 60 * 1000), min);
        await tocca();
        await aspetta(300);
      }
      await d.p.evaluate(() => (window.__salto = 6.5 * 60 * 1000));
      await d.p.mouse.click(450, 1450);
      await d.p.evaluate(() => (window.__salto = 7 * 60 * 1000));
      await d.p.keyboard.press("ArrowRight");
      const dopo = await finche(async () => {
        const s = await secondi();
        return s - prima >= 400 ? s : null;
      }, 8000, `i sette minuti nella scheda non si contano (contati ${(await secondi()) - prima} s)`);
      const scartate = await d.p.evaluate(() => JSON.parse(localStorage.getItem("bc_pause") || "[]")[0]?.x?.length || 0);
      if (scartate) throw new Error(`${scartate} pause scartate: il tempo nella scheda e' stato buttato`);
      return { guasti: d.guasti, nota: `${Math.round((dopo - prima) / 60)} min contati fra le due voltate` };
    },
  },
  {
    // segnalato dal lettore con la foto del tablet sdraiato: «un gap in
    // fondo alla pagina più spesso della parte sopra… solo in orizzontale».
    // L'avanzo di riga si toglieva tutto da sotto: a scrittura ×1,5 puo'
    // valere quasi una riga intera
    nome: "sul tablet sdraiato lo spazio sopra e sotto il testo della pagina e' lo stesso",
    async fai({ browser }) {
      const SDRAIATO = { ...TABLET, viewport: { width: 1503, height: 902 }, screen: { width: 1503, height: 902 } };
      // come nella foto: paragrafi rientrati senza stacco, corpo al 130%
      const d = await dispositivo(browser, { misura: SDRAIATO, prima: () => localStorage.setItem("bc_reader", JSON.stringify({ fontSize: 130 })) });
      await d.p.goto(URL_APP);
      await importa(d.p, "La nebbia.epub", await epub({ quanti: 80, rientri: true }), "application/epub+zip");
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
      await aspetta(2500);
      const spazi = async () => {
        const fr = d.p.frames().find((f) => f !== d.p.mainFrame());
        const righe = await fr.evaluate(() => {
          const out = [];
          for (const p of document.querySelectorAll("p")) {
            const r = document.createRange();
            r.selectNodeContents(p);
            for (const q of r.getClientRects()) out.push({ l: q.left, t: q.top, b: q.bottom });
          }
          return out;
        });
        return d.p.evaluate((righe) => {
          const ifr = document.querySelector("iframe");
          const box = ifr.getBoundingClientRect();
          const carta = ifr.closest(".epub-container").parentElement.parentElement.getBoundingClientRect();
          // la pagina di destra, tutta di prosa: le righe nella sua meta'
          const meta = carta.left + carta.width / 2;
          const viste = righe.map((r) => ({ l: r.l + box.left, t: r.t + box.top, b: r.b + box.top })).filter((r) => r.l >= meta && r.l < carta.right && r.b > carta.top && r.t < carta.bottom);
          if (!viste.length) return null;
          const sopra = Math.min(...viste.map((r) => r.t)) - carta.top;
          const sotto = carta.bottom - Math.max(...viste.map((r) => r.b));
          return { sopra: Math.round(sopra), sotto: Math.round(sotto) };
        }, righe);
      };
      const m = await finche(spazi, 8000, "le righe della pagina non si misurano");
      if (Math.abs(m.sotto - m.sopra) > 3) throw new Error(`sopra ${m.sopra}px, sotto ${m.sotto}px: la pagina non e' simmetrica`);
      return { guasti: d.guasti, nota: `sopra ${m.sopra}px, sotto ${m.sotto}px` };
    },
  },
  {
    // il rapporto del lettore: un'apertura con 5,3 s di «pagina pronta»
    // contro le solite 0,6. Alla prima apertura di un libro (e a ogni giro
    // del tablet) l'avanzo di riga non era ricordato, e il ritaglio
    // reimpaginava il capitolo sotto la candela. Adesso un libro nuovo nasce
    // col ritaglio misurato sullo stesso schermo da un altro libro
    nome: "un libro nuovo nasce col ritaglio dell'avanzo gia' misurato sullo stesso schermo",
    async fai({ browser }) {
      const SDRAIATO = { ...TABLET, viewport: { width: 1503, height: 902 }, screen: { width: 1503, height: 902 } };
      const d = await dispositivo(browser, { misura: SDRAIATO, prima: () => localStorage.getItem("bc_reader") || localStorage.setItem("bc_reader", JSON.stringify({ fontSize: 130 })) });
      await d.p.goto(URL_APP);
      await importa(d.p, "Primo.epub", await epub({ titolo: "Primo", quanti: 80, rientri: true }), "application/epub+zip");
      await importa(d.p, "Secondo.epub", await epub({ titolo: "Secondo", quanti: 80, rientri: true }), "application/epub+zip");
      const apri = async (titolo) => {
        await d.p.goto(`${URL_APP}?apri=libreria`);
        await d.p.getByText(titolo, { exact: true }).first().click();
        await d.p.getByRole("button", { name: /Apri il libro|Comincia/ }).first().click();
        // il riquadro appena nato, prima che la misura abbia fatto il suo giro
        return finche(() => d.p.evaluate(() => {
          const ifr = document.querySelector("iframe");
          const v = ifr?.closest(".epub-container")?.parentElement;
          return v ? getComputedStyle(v).paddingBottom : null;
        }), 15000, `«${titolo}» non si apre`);
      };
      const primoNato = await apri("Primo");
      await aspetta(3000);
      const ritaglio = await d.p.evaluate(() => getComputedStyle(document.querySelector("iframe").closest(".epub-container").parentElement).paddingBottom);
      if (primoNato === ritaglio) throw new Error(`la scena non ha un avanzo da ritagliare (${ritaglio})`);
      const secondoNato = await apri("Secondo");
      if (secondoNato !== ritaglio) throw new Error(`il libro nuovo nasce con ${secondoNato} sotto, e il ritaglio dello schermo e' ${ritaglio}`);
      return { guasti: d.guasti, nota: `primo nato con ${primoNato}, ritagliato a ${ritaglio}; il secondo nasce gia' a ${secondoNato}` };
    },
  },
  {
    // segnalato dal lettore con la foto di «A Thousand Sons»: titolo,
    // motto, introduzione e contenuti tutti attaccati sulla stessa pagina.
    // La ricucitura all'ingresso attaccava al precedente OGNI documento
    // che l'indice non apre, e il contorno in testa (frontespizio,
    // introduzione, contenuti) nell'indice della Black Library non c'e'
    nome: "la ricucitura all'ingresso non attacca il frontespizio, l'introduzione e i contenuti",
    async fai({ browser }) {
      const d = await dispositivo(browser, { misura: TABLET });
      await d.p.goto(URL_APP);
      await importa(d.p, "Mille Figli.epub", await epubConContorno(), "application/epub+zip");
      await d.p.getByText("Mille Figli").first().click();
      await d.p.getByRole("button", { name: /Apri il libro|Comincia/ }).first().click();
      const primo = await finche(
        async () => {
          for (const f of d.p.frames()) {
            const t = await f.evaluate(() => document.body?.innerText || "").catch(() => "");
            if (t.includes("A THOUSAND SONS")) return t;
          }
          return null;
        },
        25000,
        "il frontespizio non compare"
      );
      if (/time of legend|CONTENTS/.test(primo)) throw new Error(`il frontespizio e' cucito con quel che viene dopo: «${primo.replace(/\s+/g, " ").slice(0, 160)}…»`);
      return { guasti: d.guasti, nota: "frontespizio da solo, come nel libro" };
    },
  },
  {
    // segnalato dal lettore con due foto: «Questo libro è spezzato… 🪡
    // Ricucilo ora», e al tocco «La ricucitura non ha trovato pezzi da
    // unire: reimporta il file». Con l'indice in una cartella a parte la
    // diagnosi non riconosceva nessuna voce, e il contorno in testa contava
    // come pezzi; e un libro su cui la cura passa a vuoto non si offre piu'
    nome: "un libro sano con l'indice in una cartella a parte non e' «spezzato», e una ricucitura a vuoto non si offre due volte",
    async fai({ browser }) {
      const d = await dispositivo(browser, { misura: TABLET });
      const salute = (titolo) =>
        d.p.evaluate(async (titolo) => {
          const id = JSON.parse(localStorage.getItem("bc_books")).find((b) => b.title === titolo).id;
          const db = await new Promise((r, e) => { const q = indexedDB.open("bc_library"); q.onsuccess = () => r(q.result); q.onerror = e; });
          return new Promise((r) => { const q = db.transaction("aux").objectStore("aux").get(`salute_${id}`); q.onsuccess = () => r(q.result || null); q.onerror = () => r(null); });
        }, titolo);
      const scriviSalute = (titolo, v) =>
        d.p.evaluate(async ([titolo, v]) => {
          const id = JSON.parse(localStorage.getItem("bc_books")).find((b) => b.title === titolo).id;
          const db = await new Promise((r, e) => { const q = indexedDB.open("bc_library"); q.onsuccess = () => r(q.result); q.onerror = e; });
          await new Promise((r, e) => { const tx = db.transaction("aux", "readwrite"); tx.objectStore("aux").put(v, `salute_${id}`); tx.oncomplete = r; tx.onerror = e; });
        }, [titolo, v]);
      // un segno: il libro e' in lettura, e il banner chiede invece di ricucire
      const inLettura = (titolo) => d.p.evaluate((t) => { const id = JSON.parse(localStorage.getItem("bc_books")).find((b) => b.title === t).id; localStorage.setItem(`bc_prog_${id}`, "0.1"); }, titolo);
      const apri = async (titolo) => {
        await d.p.goto(`${URL_APP}?apri=libreria`);
        await d.p.getByText(titolo).first().click();
        await d.p.getByRole("button", { name: /Apri il libro|Comincia|Riprendi|Continua/ }).first().click({ timeout: 5000 }).catch(() => {});
      };
      const banner = () => d.p.getByText(/spezzato in più pezzi/).first().isVisible().catch(() => false);
      // il verdetto si scrive dietro la pagina: si aspetta lui, poi si guarda
      const verdetto = (titolo, ok, perche) => finche(async () => { const s = await salute(titolo); return s && s.v && ok(s) ? s : null; }, 20000, perche);

      await d.p.goto(URL_APP);
      await importa(d.p, "Mille Figli.epub", await epubConContorno({ cartella: "Text/" }), "application/epub+zip");
      await inLettura("Mille Figli");
      await apri("Mille Figli");
      const sano = await verdetto("Mille Figli", () => true, "il verdetto di «Mille Figli» non si scrive");
      if (sano.giunture || sano.monconi) throw new Error(`l'indice in Text/ non si legge: ${JSON.stringify(sano)}`);
      if (await banner()) throw new Error("il banner della ricucitura su un libro sano");

      // un «più tardi» detto alla diagnosi di prima resta detto
      await importa(d.p, "Le Pagine.epub", await epubConPagine(), "application/epub+zip");
      await inLettura("Le Pagine");
      const peso = await d.p.evaluate(async () => {
        const id = JSON.parse(localStorage.getItem("bc_books")).find((b) => b.title === "Le Pagine").id;
        const db = await new Promise((r, e) => { const q = indexedDB.open("bc_library"); q.onsuccess = () => r(q.result); q.onerror = e; });
        return new Promise((r) => { const q = db.transaction("files").objectStore("files").get(id); q.onsuccess = () => r(q.result?.size ?? q.result?.byteLength ?? null); });
      });
      await scriviSalute("Le Pagine", { size: peso, monconi: 0, giunture: 5, taciuto: true });
      await apri("Le Pagine");
      const taciuto = await verdetto("Le Pagine", (s) => s.v, "il verdetto vecchio non si riguarda");
      if (!taciuto.taciuto) throw new Error(`il «più tardi» si e' perso col verdetto nuovo: ${JSON.stringify(taciuto)}`);
      await new Promise((r) => setTimeout(r, 1500));
      if (await banner()) throw new Error("il banner torna dopo un «più tardi»");

      // senza «più tardi»: il banner, il tocco, la cura che non trova niente
      await scriviSalute("Le Pagine", { ...taciuto, taciuto: false });
      await apri("Le Pagine");
      await finche(banner, 15000, "il banner della ricucitura non compare su «Le Pagine»");
      await d.p.getByText(/Ricucilo ora/).first().click();
      const detto = await finche(() => testoAvviso(d.p, /pezzi da unire/), 15000, "la ricucitura a vuoto non si dice");
      if (/reimport/i.test(detto)) throw new Error(`manda a reimportare, che rifa' la stessa cura: «${detto}»`);
      await verdetto("Le Pagine", (s) => s.vano, "la cura a vuoto non si ricorda");
      await apri("Le Pagine");
      await new Promise((r) => setTimeout(r, 3000));
      if (await banner()) throw new Error("dopo una cura a vuoto il banner torna");
      return { guasti: d.guasti, nota: `indice in Text/: ${sano.giunture} giunture; «più tardi» tenuto; a vuoto: «${detto}», poi niente banner` };
    },
  },
  {
    nome: "un PDF si importa e si apre, e l'apertura e' misurata fino alla prima pagina",
    async fai({ browser }) {
      const d = await dispositivo(browser);
      await importa(d.p, "Prova dei tempi.pdf", pdf(), "application/pdf");
      await d.p.getByText("Prova dei tempi").first().click();
      await d.p.getByRole("button", { name: /Apri il libro|Comincia/ }).first().click();
      await finche(() => testoAvviso(d.p, /Pagina 1 della prova/), 25000, "il testo della prima pagina non compare");
      const ap = await finche(
        async () => (await d.p.evaluate(() => JSON.parse(localStorage.getItem("bc_tempi") || "[]"))).find((x) => x.c === "pdf"),
        10000,
        "l'apertura del PDF non e' annotata"
      );
      if (!["codice", "byte", "libro", "pagina"].every((k) => k in ap.f)) throw new Error(`apertura del PDF misurata male: ${JSON.stringify(ap)}`);
      const registro = await d.p.evaluate(() => JSON.parse(localStorage.getItem("bc_errori") || "[]"));
      return { guasti: [...d.guasti, ...registro.map((e) => `registro: ${e.m}`)], nota: Object.entries(ap.f).map(([k, ms]) => `${k} ${ms} ms`).join(" + ") };
    },
  },
  {
    // chiesto dal lettore: «per me l'importante è che l'applicazione risulti
    // funzionante anche offline e che recuperi i libri che ho salvato in locale»
    nome: "senza rete l'app si riapre sul tablet e apre i libri salvati qui: ePub, PDF e fumetto, e quel che si fa offline sale quando torna la rete",
    async fai({ browser, db }) {
      const d = await dispositivo(browser, { sessione: true, misura: TABLET });
      await importa(d.p, "La nebbia.epub", await epub(), "application/epub+zip");
      await importa(d.p, "Prova dei tempi.pdf", pdf(), "application/pdf");
      await importa(d.p, "Racconti.cbz", await fumetto(), "application/zip");
      // il service worker non prende la pagina che l'ha installato
      // (`clientsClaim: false`): la prende quella dopo, come sul tablet
      await d.p.evaluate(() => navigator.serviceWorker.ready);
      await d.p.reload();
      await finche(() => d.p.evaluate(() => !!navigator.serviceWorker.controller), 10000, "il service worker non prende la pagina");

      await d.ctx.setOffline(true);
      await d.p.close();
      const p = await d.ctx.newPage();
      const guasti = [];
      p.on("pageerror", (e) => guasti.push(e.message));
      await p.goto(URL_APP);
      await finche(() => p.getByRole("button", { name: "Libreria" }).count(), 15000, "senza rete l'app non si riapre");

      const apri = async (titolo) => {
        await p.goto(`${URL_APP}?apri=libreria`);
        await p.getByText(titolo).first().click();
        await p.getByRole("button", { name: /Apri il libro|Comincia/ }).first().click();
      };
      await apri("La nebbia");
      await finche(
        async () => {
          for (const f of p.frames()) if ((await f.evaluate(() => document.body?.innerText || "").catch(() => "")).includes(FRASE)) return true;
          return false;
        },
        25000,
        "senza rete l'ePub non si apre"
      );
      await apri("Prova dei tempi");
      await finche(() => testoAvviso(p, /Pagina 1 della prova/), 25000, "senza rete il PDF non si apre");
      await apri("Racconti");
      await finche(
        () => p.evaluate(() => [...document.querySelectorAll("img[data-pagina]")].some((im) => im.complete && im.naturalWidth === 60)),
        25000,
        "senza rete il fumetto non mostra la pagina"
      );
      // e quel che si fa senza rete parte quando la rete torna
      await p.goto(`${URL_APP}?apri=libreria`);
      await p.getByText("Prova dei tempi").first().click();
      await p.getByRole("button", { name: "Letto", exact: true }).click();
      await finche(async () => (await libriDi(p)).length && p.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith("bc_status_") && localStorage.getItem(k) === "read")), 5000, "il libro non si segna letto senza rete");
      await d.ctx.setOffline(false);
      await p.goto(URL_APP);
      await finche(() => db.righe().some((r) => r.title === "Prova dei tempi" && r.status === "read"), 30000, "tornata la rete, il libro letto offline non sale nel cloud");
      // SENZA RETE IL GIRO NON ARRIVA AL CLOUD, e lo annota: e' il racconto
      // di quel che e' successo, non un guasto dell'app
      const rete = (e) => e.d === "sincronizzazione" && /Failed to fetch/.test(e.m);
      const registro = (await p.evaluate(() => JSON.parse(localStorage.getItem("bc_errori") || "[]"))).filter((e) => !rete(e));
      return { guasti: [...d.guasti, ...guasti, ...registro.map((e) => `registro: ${e.m}`)] };
    },
  },
  {
    nome: "una cartella del tablet diventa le sue raccolte, una per sottocartella, e rifarlo non fa doppioni",
    async fai({ browser }) {
      // il selettore delle cartelle non si apre da una prova: lo si finge
      // con la forma che ha in Chrome, la cartella «Music» del lettore
      const prima = (b64) => {
        const byte = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const file = (nome) => ({ kind: "file", getFile: async () => new File([byte], nome, { type: nome.endsWith(".jpg") ? "image/jpeg" : "" }) });
        const cartella = (voci) => ({
          kind: "directory",
          async *entries() {
            for (const [nome, v] of Object.entries(voci)) yield [nome, v === 1 ? file(nome) : v];
          },
        });
        const music = cartella({
          ".thumbnails": cartella({ "a.jpg": 1 }),
          "WARHAMMER 40k": cartella({ "10 - Siege of Terra.wav": 1, "2 - Cadia Stands.wav": 1 }),
          "Horror playlist": cartella({ "Night.wav": 1, "cover.jpg": 1 }),
        });
        window.showDirectoryPicker = async () => Object.assign(music, { name: "Music" });
      };
      const d = await dispositivo(browser, { misura: TABLET });
      await d.ctx.addInitScript(prima, wav(2).toString("base64"));
      await d.p.goto(`${URL_APP}?apri=musica`);
      await d.p.getByRole("button", { name: "＋ Aggiungi" }).click();
      await d.p.getByRole("button", { name: "📁 Da una cartella" }).click();
      const detto = await finche(() => d.p.getByText(/📁 Dalla cartella «Music»/).textContent().catch(() => null), 15000, "la cartella non diventa raccolte");
      if (!/«Horror playlist» \(1\)/.test(detto) || !/«WARHAMMER 40k» \(2\)/.test(detto)) throw new Error(`raccolte sbagliate: ${detto}`);
      // fatte le raccolte, la sala mostra le raccolte
      for (const nome of ["WARHAMMER 40k", "Horror playlist"]) await d.p.getByRole("button", { name: new RegExp(`^${nome}`) }).waitFor({ timeout: 5000 });
      if (await d.p.getByRole("button", { name: /^\.thumbnails/ }).count()) throw new Error("la cartella nascosta e' diventata una raccolta");
      // i brani nell'ordine dei nomi: il 2 prima del 10
      await d.p.getByRole("button", { name: /^WARHAMMER 40k/ }).click();
      await d.p.getByRole("button", { name: /^1\s*2 - Cadia Stands/ }).waitFor({ timeout: 5000 });
      await d.p.getByRole("button", { name: /^2\s*10 - Siege of Terra/ }).waitFor({ timeout: 5000 });
      const largo = await d.p.evaluate(() => document.scrollingElement.scrollWidth - innerWidth);
      if (largo > 0) throw new Error(`col tasto della cartella la sala sborda di ${largo}px`);
      // rifarlo non fa doppioni
      await d.p.getByRole("button", { name: "📁 Da una cartella" }).click();
      await finche(() => d.p.getByText(/avevano già tutti i loro brani/).count(), 15000, "la seconda volta non dice che c'era gia' tutto");
      const conti = await d.p.evaluate(() => ({
        melodie: JSON.parse(localStorage.getItem("bc_music_favs") || "[]").filter((f) => !f.deleted).length,
        raccolte: JSON.parse(localStorage.getItem("bc_music_lists") || "[]").filter((r) => !r.deleted).length,
      }));
      if (conti.melodie !== 3 || conti.raccolte !== 2) throw new Error(`rifatto, doppioni: ${JSON.stringify(conti)}`);
      return { guasti: d.guasti, nota: `${conti.raccolte} raccolte, ${conti.melodie} melodie, nessun doppione` };
    },
  },
  {
    // chiesto dal lettore con la foto della sala dopo la cartella «Music»:
    // «rendermelo come una piccola app musicale affinché sia più ordinato e
    // non sia una sfilza lunghissima di brani uno sotto l'altro, ma con
    // ricerca, selezione e tutto ciò che richiede un player musicale»
    nome: "la sala della musica come un lettore musicale: raccolte in griglia, ricerca, lettere, menu del brano, lettore ripiegato e indietro",
    async fai({ browser }) {
      const nomi = ["Acolyte", "Administratum", "Atonement", "Ave Dominus Nox", "Binary Signal", "Black Templars (Warhammer 40,000)", "Burning Skies", "Cadia Stands", "Dark Mechanicus", "Eisenhorn", "Forge World", "Grimdark", "Hive City", "Imperium", "Lord Inquisitor", "Macragge", "Necron Tomb", "Ork Waaagh", "Psykana", "Terra", "Ultramar", "Xenos"];
      const prima = ([b64, nomi]) => {
        const byte = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const file = (nome) => ({ kind: "file", getFile: async () => new File([byte], nome, { type: "" }) });
        const cartella = (voci) => ({
          kind: "directory",
          async *entries() {
            for (const [nome, v] of Object.entries(voci)) yield [nome, v === 1 ? file(nome) : v];
          },
        });
        const music = cartella({
          "WARHAMMER 40k": cartella(Object.fromEntries(nomi.map((n) => [`${n}.wav`, 1]))),
          "Horror playlist": cartella({ "Night.wav": 1 }),
        });
        window.showDirectoryPicker = async () => Object.assign(music, { name: "Music" });
      };
      const d = await dispositivo(browser, { misura: TABLET });
      const { p } = d;
      await d.ctx.addInitScript(prima, [wav(30).toString("base64"), nomi]);
      await p.goto(`${URL_APP}?apri=musica`);
      // scelta la vista dei brani, una cartella fatta raccolte riporta alle raccolte
      await p.getByRole("tab", { name: /Brani/ }).click();
      await p.getByRole("button", { name: "＋ Aggiungi" }).click();
      await p.getByRole("button", { name: "📁 Da una cartella" }).click();
      await finche(() => p.getByText(/📁 Dalla cartella «Music»/).count(), 20000, "la cartella non diventa raccolte");

      // le raccolte in griglia, ognuna col suo ▶
      await p.getByRole("button", { name: "Suona WARHAMMER 40k" }).waitFor({ timeout: 5000 });
      if (!(await p.getByRole("tab", { name: /Raccolte/ }).getAttribute("aria-selected")).includes("true")) throw new Error("fatte le raccolte, la sala non le mostra");

      // la ricerca trova i brani anche dalla vista delle raccolte, a parole sparse
      await p.getByLabel("Cerca nella musica").fill("templ black");
      await p.getByRole("button", { name: /^Black Templars/ }).click();
      await finche(() => p.evaluate(() => (document.querySelector("audio")?.currentTime ?? 0) > 0.3), 10000, "il brano trovato non suona");
      await p.getByRole("button", { name: "Cancella la ricerca" }).click();

      // sul tablet il lettore sta ripiegato: una riga coi tre tasti, e la barra del punto si apre col tocco
      if (await p.getByRole("slider", { name: "Punto del brano" }).count()) throw new Error("sul tablet il lettore non sta ripiegato");
      await p.getByRole("button", { name: /^Apri il lettore: Black Templars/ }).click();
      await p.getByRole("slider", { name: "Punto del brano" }).waitFor({ timeout: 3000 });
      await p.getByRole("button", { name: "Riduci il lettore" }).click();
      await finche(async () => !(await p.getByRole("slider", { name: "Punto del brano" }).count()), 3000, "il lettore non si riduce");

      // i brani: le lettere per saltare, matita e cestino solo nel menu «⋯»
      await p.getByRole("tab", { name: /Brani/ }).click();
      await p.getByRole("button", { name: "X", exact: true }).waitFor({ timeout: 3000 });
      if (await p.getByRole("button", { name: /^Rinomina|^Dimentica/ }).count()) throw new Error("matita e cestino stanno in vista su ogni riga");
      await p.getByRole("button", { name: "Altro per Night", exact: true }).click();
      await p.getByRole("button", { name: "✧ Nelle raccolte" }).click();
      await p.getByRole("button", { name: "＋ WARHAMMER 40k" }).click();
      const dentro = await p.evaluate(() => {
        const favs = JSON.parse(localStorage.getItem("bc_music_favs") || "[]");
        const night = favs.find((f) => f.name === "Night");
        return JSON.parse(localStorage.getItem("bc_music_lists") || "[]").find((r) => r.name === "WARHAMMER 40k").brani.includes(night.id);
      });
      if (!dentro) throw new Error("dal menu del brano «Night» non entra nella raccolta");

      // la pagina della raccolta, e l'indietro torna alle raccolte senza lasciare la sala
      await p.getByRole("tab", { name: /Raccolte/ }).click();
      await p.getByRole("button", { name: /^WARHAMMER 40k/ }).click();
      await p.getByRole("button", { name: /^23\s*Night/ }).waitFor({ timeout: 3000 });
      const largo = await p.evaluate(() => document.scrollingElement.scrollWidth - innerWidth);
      if (largo > 0) throw new Error(`la sala sborda di ${largo}px`);
      // la raccolta che suona: il tasto grande e' pausa, non un nuovo inizio
      await p.getByRole("button", { name: "▶ In ordine" }).click();
      await p.getByRole("button", { name: "❚❚ Pausa" }).click();
      await finche(() => p.evaluate(() => document.querySelector("audio")?.paused), 3000, "«❚❚ Pausa» non ferma la raccolta");
      await p.getByRole("button", { name: "▶ Riprendi" }).waitFor({ timeout: 3000 });
      await p.goBack();
      await p.getByRole("button", { name: "Suona Horror playlist" }).waitFor({ timeout: 3000 });
      if (!(await p.getByRole("tab", { name: /Raccolte/ }).count())) throw new Error("l'indietro dalla raccolta ha lasciato la sala");

      // ELIMINARE UNA RACCOLTA SI TROVA: «⋯» sulla casella, poi la conferma
      // (segnalato dal lettore: «al momento non posso farlo»)
      const stato = () =>
        p.evaluate(() => ({
          rac: JSON.parse(localStorage.getItem("bc_music_lists") || "[]").filter((r) => !r.deleted).map((r) => r.name),
          brani: JSON.parse(localStorage.getItem("bc_music_favs") || "[]").filter((f) => !f.deleted).length,
        }));
      await p.getByRole("button", { name: "Altro per Horror playlist" }).click();
      await p.getByRole("button", { name: "🗑 Elimina raccolta" }).click();
      await p.getByRole("button", { name: "🗑 Elimina", exact: true }).click();
      await finche(async () => !(await p.getByRole("button", { name: "Suona Horror playlist" }).count()), 3000, "eliminata, la raccolta resta nella griglia");
      // e dalla sua pagina, col menu «⋯»
      await p.getByRole("button", { name: /^WARHAMMER 40k/ }).click();
      await p.getByRole("button", { name: "Altro per WARHAMMER 40k" }).click();
      await p.getByRole("button", { name: "🗑 Elimina raccolta" }).click();
      await p.getByRole("button", { name: "🗑 Elimina", exact: true }).click();
      await p.getByRole("button", { name: "＋ Nuova raccolta" }).waitFor({ timeout: 3000 });
      const dopo = await stato();
      if (dopo.rac.length || dopo.brani !== 23) throw new Error(`eliminate le raccolte: ${JSON.stringify(dopo)}`);
      // e non tornano riaprendo l'app
      await p.goto(`${URL_APP}?apri=musica`);
      await p.getByRole("tab", { name: /Brani/ }).waitFor({ timeout: 5000 });
      if (await p.getByRole("button", { name: /^Suona / }).count()) throw new Error("riaperta l'app, una raccolta eliminata e' tornata");
      return { guasti: d.guasti, nota: "23 brani, ricerca a parole sparse, lettore ripiegato, lettere, menu del brano, indietro, raccolte eliminate (i brani restano)" };
    },
  },
  {
    // chiesto dal lettore: «selezionare cosa riprodurre nelle raccolte e
    // quando si ferma la melodia ripartire dal punto in cui si è interrotta»
    nome: "in una raccolta si sceglie il brano, e la musica riprende da dove si era fermata anche ad app chiusa",
    async fai({ browser }) {
      const d = await dispositivo(browser);
      const audio = (p) => p.evaluate(() => ({ t: document.querySelector("audio")?.currentTime ?? -1, d: document.querySelector("audio")?.duration ?? 0 }));
      await d.p.goto(`${URL_APP}?apri=musica`);
      await d.p.getByRole("button", { name: "＋ Aggiungi" }).click();
      for (const nome of ["Pioggia", "Camino", "Arpa"]) await d.p.setInputFiles('input[accept="audio/*"]', { name: `${nome}.wav`, mimeType: "audio/wav", buffer: wav() });
      await finche(() => d.p.getByText("Arpa", { exact: true }).count(), 10000, "le melodie non entrano");
      await d.p.getByRole("tab", { name: /Raccolte/ }).click();
      await d.p.getByRole("button", { name: "＋ Nuova raccolta" }).click();
      await d.p.getByPlaceholder(/Come la chiami/).fill("Notti");
      await d.p.getByRole("button", { name: "✧ Crea" }).click();
      for (const nome of ["Pioggia", "Camino", "Arpa"]) await d.p.getByRole("button", { name: nome }).first().click();
      await d.p.getByRole("button", { name: "Fatto" }).first().click();

      // il brano scelto dalla raccolta suona, e la raccolta lo ricorda
      // la raccolta e' una pagina: i brani in vista, il resto sta in «⋯»
      if (await d.p.getByRole("button", { name: "Scegli i brani" }).count()) throw new Error("«Scegli i brani» sta in vista, non nel menu «⋯»");
      await d.p.getByRole("button", { name: "Altro per Notti" }).click();
      if (!(await d.p.getByRole("button", { name: "Scegli i brani" }).isVisible())) throw new Error("nel menu «⋯» manca «Scegli i brani»");
      await d.p.getByRole("button", { name: /^2\s*Camino/ }).click();
      await finche(async () => (await audio(d.p)).t > 0.5, 10000, "il brano scelto non suona");
      await d.p.evaluate(() => (document.querySelector("audio").currentTime = 40));
      // il punto si scrive mentre suona: l'app chiusa dal sistema non avvisa
      await finche(async () => JSON.parse((await d.p.evaluate(() => localStorage.getItem("bc_melodia_punti"))) || "{}"), 10000, "il punto non si scrive");
      await aspetta(6000);
      // l'app uccisa di colpo, come la chiude il sistema in secondo piano:
      // nessun «Spegni», nessun evento d'uscita
      // si aspetta che il processo sia morto davvero, poi si chiude la pagina:
      // una pagina nuova dello stesso sito aperta prima poteva finire nel
      // processo moribondo e restare appesa (visto in CI: `page.goto` scaduto)
      const morta = new Promise((ok) => d.p.once("crash", ok));
      const cdp = await d.ctx.newCDPSession(d.p);
      cdp.send("Page.crash").catch(() => {});
      await Promise.race([morta, aspetta(10000)]);
      await d.p.close().catch(() => {});
      const p2 = await d.ctx.newPage();
      p2.on("pageerror", (e) => d.guasti.push(e.message));
      await p2.goto(`${URL_APP}?apri=musica`);
      await p2.getByRole("button", { name: /^Notti/ }).click();
      const detto = await finche(() => testoAvviso(p2, /eri a «Camino», 0:4\d/), 10000, "la raccolta non dice dove si era");
      await p2.getByRole("button", { name: "▶ Riprendi" }).click();
      const t = await finche(async () => {
        const a = await audio(p2);
        return a.t > 0 ? a.t : 0;
      }, 10000, "riprendendo non suona niente");
      if (t < 40) throw new Error(`«▶ Riprendi» e' ripartito da ${t.toFixed(1)} s, non da 40`);
      return { guasti: d.guasti, nota: `${detto.trim()} → ripreso a ${t.toFixed(1)} s` };
    },
  },
  {
    // segnalato dal lettore: «il player riproduce sempre la stessa canzone…
    // sto ascoltando la raccolta di Warhammer». Il libro ricordava il brano
    // e non la raccolta: «▶ Riprendi» lo suonava da solo, in ripetizione
    nome: "la musica di un libro riprende la sua raccolta, e la raccolta va al brano dopo",
    async fai({ browser }) {
      const d = await dispositivo(browser, { misura: TABLET });
      const dove = () => d.p.evaluate(() => (document.body.innerText.match(/Notti · (\d) di 3/) || [])[1] || null);
      // il libro prima: entrare in biblioteca ricarica la pagina
      await importa(d.p, "La nebbia.epub", await epub(), "application/epub+zip");
      await d.p.goto(`${URL_APP}?apri=musica`);
      await d.p.getByRole("button", { name: "＋ Aggiungi" }).click();
      for (const nome of ["Pioggia", "Camino", "Arpa"]) await d.p.setInputFiles('input[accept="audio/*"]', { name: `${nome}.wav`, mimeType: "audio/wav", buffer: wav(3) });
      await finche(() => d.p.getByText("Arpa", { exact: true }).count(), 10000, "le melodie non entrano");
      await d.p.getByRole("tab", { name: /Raccolte/ }).click();
      await d.p.getByRole("button", { name: "＋ Nuova raccolta" }).click();
      await d.p.getByPlaceholder(/Come la chiami/).fill("Notti");
      await d.p.getByRole("button", { name: "✧ Crea" }).click();
      for (const nome of ["Pioggia", "Camino", "Arpa"]) await d.p.getByRole("button", { name: nome }).first().click();
      await d.p.getByRole("button", { name: "Fatto" }).first().click();
      await d.p.getByRole("button", { name: /In ordine/ }).first().click();
      await finche(async () => (await dove()) === "1", 8000, "la raccolta non parte");
      await finche(async () => (await dove()) === "2", 10000, "nella sala, finito il brano, la raccolta non va avanti");
      // aperto un libro con la raccolta che suona, il libro la ricorda
      await d.p.getByRole("button", { name: "Libreria" }).first().click();
      await d.p.getByText("La nebbia").first().click();
      await d.p.getByRole("button", { name: /Apri il libro|Comincia/ }).first().click();
      await finche(() => d.p.evaluate(() => Object.keys(localStorage).some((k) => /^bc_music_(?!favs|lists)/.test(k) && JSON.parse(localStorage.getItem(k))?.raccolta)), 10000, "il libro non ricorda la raccolta");
      // l'app riaperta, musica spenta: il libro propone la sua raccolta
      await d.p.goto(`${URL_APP}?apri=libreria`);
      await d.p.getByText("La nebbia").first().click();
      await d.p.getByRole("button", { name: /Apri il libro|Continua|Comincia/ }).first().click();
      await finche(() => d.p.getByText(/Questo libro suona con la raccolta «Notti»/).count(), 10000, "il libro non propone la sua raccolta");
      await d.p.getByRole("button", { name: "▶ Riprendi" }).click();
      const src = () => d.p.evaluate(() => document.querySelector("audio")?.src || "");
      const primo = await finche(() => src(), 8000, "«▶ Riprendi» non suona niente");
      if (await d.p.evaluate(() => document.querySelector("audio")?.loop)) throw new Error("il brano ripreso gira in ripetizione, da solo");
      // finito il brano (tre secondi), suona quello dopo della raccolta
      await finche(async () => (await src()) && (await src()) !== primo, 10000, "finito il brano, non arriva quello dopo");
      return { guasti: d.guasti, nota: "ripresa la raccolta dal suo brano, e finito il brano e' arrivato il prossimo" };
    },
  },
  {
    // chiesto dal lettore: «vorrei novità di tutto il mondo 40k… lo vedo
    // quando apro l'applicazione». Le pagine nuove di Lexicanum, solo i libri
    nome: "le uscite del 40K da Lexicanum stanno nell'Ingresso, si mettono in Da prendere e, viste, se ne vanno",
    async fai({ browser }) {
      const libri = [{ id: "w1", title: "Horus Rising", author: "Dan Abnett", saga: "Warhammer 40K", fileType: "epub", addedAt: 1 }];
      const chieste = [];
      const lexicanum = async (route) => {
        const u = new URL(route.request().url());
        const q = Object.fromEntries(u.searchParams);
        const headers = { "access-control-allow-origin": "*" };
        if (u.pathname !== "/mediawiki/api.php") return route.fulfill({ status: 404, headers, body: "non qui" });
        if (q.meta === "siteinfo") return route.fulfill({ headers, json: { query: { general: { sitename: "Lexicanum" }, statistics: { articles: 1 } } } });
        chieste.push(q.list);
        return route.fulfill({ headers, json: { query: { recentchanges: [
          { title: "Hive (Novel)", timestamp: "2026-11-07T10:00:00Z" },
          { title: "Ordo Minoris", timestamp: "2026-11-06T10:00:00Z" },
          { title: "Sons of the Emperor (Anthology)", timestamp: "2026-11-05T10:00:00Z" },
        ] } } });
      };
      const d = await dispositivo(browser, {
        misura: TABLET,
        lexicanum,
        prima: `localStorage.getItem("bc_books") || localStorage.setItem("bc_books", ${JSON.stringify(JSON.stringify(libri))});`,
      });
      const { p } = d;
      await p.goto(URL_APP);
      await finche(() => p.getByText("Uscite del 40K").count(), 10000, "nell'Ingresso non ci sono le uscite del 40K");
      await finche(() => p.getByText(/^2 libri nuovi su Lexicanum/).count(), 5000, "non dice quanti libri nuovi");
      if (await p.getByText("Ordo Minoris").count()) throw new Error("fra le uscite c'e' una pagina che non e' un libro");
      const link = await p.getByRole("link", { name: "Lexicanum ↗" }).first().getAttribute("href");
      if (link !== "https://wh40k.lexicanum.com/wiki/Hive_(Novel)") throw new Error(`il collegamento porta a ${link}`);
      await p.getByRole("button", { name: "Metti «Hive» in Da prendere" }).click();
      await finche(() => p.getByText("✓ in Da prendere").count(), 3000, "il tocco non dice che il libro e' in Da prendere");
      await p.getByRole("button", { name: "✓ Viste" }).click();
      await finche(async () => !(await p.getByText("Uscite del 40K").count()), 3000, "viste, le uscite restano nell'Ingresso");
      await p.reload();
      await aspetta(2500);
      if (await p.getByText("Uscite del 40K").count()) throw new Error("riaperta l'app, le uscite viste tornano");
      if (chieste.length !== 1) throw new Error(`Lexicanum e' stato chiesto ${chieste.length} volte in sei ore`);
      // chi non legge il 40K non chiede niente
      const altro = await dispositivo(browser, { misura: TABLET, lexicanum, prima: `localStorage.setItem("bc_books", ${JSON.stringify(JSON.stringify([{ id: "m1", title: "Mort", author: "Terry Pratchett", fileType: "epub", addedAt: 1 }]))});` });
      await altro.p.goto(URL_APP);
      await aspetta(2500);
      if (chieste.length !== 1 || (await altro.p.getByText("Uscite del 40K").count())) throw new Error("chi non legge il 40K ha chiesto a Lexicanum");
      return { guasti: [...d.guasti, ...altro.guasti], nota: "2 libri nuovi, «Hive» in Da prendere, viste e sparite, una domanda in sei ore" };
    },
  },
  {
    // chiesto dal lettore dopo «I libri dei tuoi autori» tolta: le guide
    // scritte a mano, a partire da Gaunt's Ghosts. Sul suo tablet sta sotto
    // «Warhammer 40K» accanto all'Eresia, e di Gaunt's non ha niente
    nome: "Gaunt's Ghosts ed Eisenhorn: i loro cammini accanto all'Eresia, l'omnibus che contiene i romanzi, i mancanti in Da prendere, e la guida si apre anche senza volumi",
    async fai({ browser }) {
      const w = (id, title) => ({ id, title, author: "Dan Abnett", saga: "Warhammer 40K", fileType: "epub", addedAt: 1 });
      const libri = [
        w("h1", "Horus Rising"),
        w("h2", "Know No Fear"),
        w("h3", "Prospero Burns"),
        w("g1", "First and Only"),
        w("e1", "Eisenhorn Omnibus"),
        { id: "m1", title: "Mort", author: "Terry Pratchett", saga: "Discworld", fileType: "epub", addedAt: 1 },
      ];
      const d = await dispositivo(browser, {
        misura: TABLET,
        prima: `
          localStorage.getItem("bc_books") || localStorage.setItem("bc_books", ${JSON.stringify(JSON.stringify(libri))});
          localStorage.setItem("bc_vista", JSON.stringify({ aspetto: "raccolte" }));`,
      });
      const { p } = d;
      await p.goto(`${URL_APP}?apri=libreria`);
      await p.getByRole("button", { name: /^Warhammer 40K/ }).first().click();
      // due guide sullo stesso ripiano, un tasto per una
      await finche(() => p.getByRole("button", { name: "📜 Gaunt's Ghosts" }).count(), 8000, "sul ripiano del 40K non c'e' il cammino di Gaunt's Ghosts");
      if (!(await p.getByRole("button", { name: "📜 The Horus Heresy" }).count())) throw new Error("il cammino dell'Eresia e' sparito dal ripiano del 40K");
      // le tre del ripiano, e le guide del 40K da cominciare (Ravenor e le
      // saghe di `data/warhammer40k.js`) dietro un tasto solo
      if ((await p.getByRole("button", { name: /^📜 / }).count()) !== 4) throw new Error("sul ripiano del 40K non ci sono tre cammini e il tasto delle altre guide (Eresia, Gaunt's Ghosts, Eisenhorn, «Altre N guide»)");
      if (await p.getByRole("button", { name: "📜 Ravenor · 0/3" }).count()) throw new Error("le guide accanto non stanno dietro il loro tasto");
      await p.getByRole("button", { name: /^📜 Altre \d+ guide$/ }).click();
      // «dove vedo le saghe che mi mancano?»: la guida del 40K mai cominciata sta accanto, col conto
      await p.getByRole("button", { name: "📜 Ravenor · 0/3" }).click();
      await finche(() => p.getByText(/Hai 0 dei 3 volumi della guida/).count(), 5000, "la guida di Ravenor accanto non si apre");
      await p.getByRole("button", { name: "Chiudi" }).click();
      await p.getByRole("button", { name: "📜 Gaunt's Ghosts" }).click();
      await finche(() => p.getByText("Il cammino · Gaunt's Ghosts").count(), 5000, "il cammino di Gaunt's Ghosts non si apre");
      await finche(() => p.getByText(/Hai 1 dei 15 volumi della guida/).count(), 3000, "il cammino non dice 1 dei 15");
      // «altri N dei tuoi libri»: l'Eresia e l'omnibus di Eisenhorn stanno fuori da questa guida
      for (const ciclo of ["The Founding (1-3)", "The Victory (12-15)"]) if (!(await p.getByText(ciclo).count())) throw new Error(`nel cammino manca il ciclo «${ciclo}»`);
      if (await p.getByRole("button", { name: "Metti «First and Only» in Da prendere" }).count()) throw new Error("si propone di prendere un volume che hai");
      await p.getByRole("button", { name: "Metti «Ghostmaker» in Da prendere" }).click();
      await finche(() => p.getByText("✓ in Da prendere").count(), 3000, "il tocco non dice che «Ghostmaker» e' in Da prendere");
      const lista = await p.evaluate(() => JSON.parse(localStorage.getItem("bc_da_prendere") || "[]"));
      if (!lista.some((v) => v.titolo === "Ghostmaker" && v.autore === "Dan Abnett" && v.saga === "Gaunt's Ghosts" && v.numero === 2)) throw new Error(`«Ghostmaker» non e' in lista con saga e numero: ${JSON.stringify(lista)}`);
      await p.getByRole("button", { name: "Chiudi" }).click();
      // EISENHORN: il lettore ha l'omnibus, cioe' i primi tre romanzi
      await finche(() => p.getByRole("button", { name: "📜 Eisenhorn" }).count(), 5000, "sul ripiano del 40K non c'e' il cammino di Eisenhorn");
      await p.getByRole("button", { name: "📜 Eisenhorn" }).click();
      await finche(() => p.getByText(/Hai 3 dei 4 volumi della guida/).count(), 5000, "con l'omnibus il cammino di Eisenhorn non dice 3 dei 4");
      if (!(await p.getByText(/dentro «Eisenhorn Omnibus»/).count())) throw new Error("i romanzi dentro l'omnibus non dicono dove sono");
      if (await p.getByRole("button", { name: "Metti «Malleus» in Da prendere" }).count()) throw new Error("si propone di prendere Malleus, che sta nell'omnibus");
      await p.getByRole("button", { name: "Metti «The Magos» in Da prendere" }).click();
      await finche(() => p.getByText("✓ in Da prendere").count(), 3000, "il tocco non dice che «The Magos» e' in Da prendere");
      await p.getByRole("button", { name: "Chiudi" }).click();
      // il Mondo Disco ha il suo cammino anche se l'Eresia ha piu' volumi
      await p.getByRole("button", { name: /Tutte le raccolte/ }).click();
      await p.getByRole("button", { name: /^Discworld/ }).first().click();
      await finche(() => p.getByRole("button", { name: "📜 Il cammino" }).count(), 5000, "il ripiano del Mondo Disco non ha piu' il suo cammino");

      // UN ALTRO DISPOSITIVO, SENZA NESSUN GAUNT'S: la guida da «Da prendere»
      const altro = await dispositivo(browser, {
        misura: TABLET,
        prima: `localStorage.getItem("bc_books") || localStorage.setItem("bc_books", ${JSON.stringify(JSON.stringify([w("h1", "Horus Rising")]))});`,
      });
      const q = altro.p;
      await q.goto(URL_APP);
      await q.getByRole("button", { name: /Da prendere/ }).first().click();
      await finche(() => q.getByText("📜 Le guide complete").count(), 8000, "in Da prendere non ci sono le guide");
      await q.getByRole("button", { name: /^Gaunt's Ghosts/ }).click();
      await finche(() => q.getByText(/Hai 0 dei 15 volumi della guida/).count(), 5000, "la guida senza volumi non si apre");
      await q.getByRole("button", { name: "Metti «First and Only» in Da prendere" }).click();
      await finche(() => q.getByText("✓ in Da prendere").count(), 3000, "il tocco non dice che e' in Da prendere");
      // l'indietro chiude prima il cammino, e la lista sotto si e' riletta
      await q.goBack();
      await finche(async () => !(await q.getByText("Il cammino · Gaunt's Ghosts").count()), 3000, "l'indietro non chiude il cammino");
      await finche(() => q.getByText("La tua lista").count(), 3000, "chiuso il cammino non si torna a Da prendere");
      // la lista era vuota quando il cammino si e' aperto: si rilegge o resta vuota
      await finche(async () => !(await q.getByText(/^Ancora vuota/).count()) && (await q.getByText("First and Only", { exact: true }).count()) > 0, 3000, "la lista sotto non mostra la voce messa dal cammino");
      return { guasti: [...d.guasti, ...altro.guasti], nota: "tre cammini sul ripiano del 40K e Ravenor accanto a 0/3, Ghostmaker e The Magos in lista, l'omnibus da' 3 dei 4 di Eisenhorn, il Disco ha il suo tasto, la guida si apre senza volumi da Da prendere" };
    },
  },
  {
    // chiesto dal lettore: «aggiungere libri o saghe senza dover per forza
    // caricare il libro… mi aggiungi la copertina», e «quando aggiungo il
    // nome di una saga in automatico mi aggiungi nell'ordine corretto i
    // libri con copertina». Poi il file si sceglie dalla scheda, e ci entra
    nome: "schede senza file: una saga dal suo nome o dal suo autore, in ordine e con le copertine, e il file scelto dalla scheda entra in quella scheda",
    async fai({ browser }) {
      const w = (id, title) => ({ id, title, author: "Dan Abnett", saga: "Warhammer 40K", series: "The Horus Heresy", fileType: "epub", addedAt: 1 });
      const libri = [w("h1", "Horus Rising"), w("h2", "Know No Fear")];
      const cercate = [];
      const immagine = pngRighe(300, 450, 4, [200, 40, 40], [20, 20, 20]);
      const d = await dispositivo(browser, {
        misura: TABLET,
        prima: `
          localStorage.getItem("bc_books") || localStorage.setItem("bc_books", ${JSON.stringify(JSON.stringify(libri))});
          localStorage.setItem("bc_vista", JSON.stringify({ aspetto: "raccolte" }));`,
        catalogo: (url) => {
          if (!/search\.json/.test(url)) return null;
          const q = new URL(url).searchParams;
          cercate.push(q.get("title"));
          return { docs: [{ key: `/works/${cercate.length}`, title: q.get("title"), author_name: ["Dan Abnett"], cover_i: 1000 + cercate.length }] };
        },
        copertine: () => immagine,
      });
      const { p } = d;
      await p.goto(`${URL_APP}?apri=libreria`);
      await p.getByRole("button", { name: "📥 Senza file" }).click();
      await p.getByRole("textbox", { name: "Nome della saga" }).fill("Gaunt's Ghosts");
      await p.getByRole("button", { name: "🔍 Cerca i libri" }).click();
      await finche(() => p.getByText(/«Gaunt's Ghosts»: l'elenco della guida dell'app/).count(), 5000, "la saga non si trova fra le guide");
      if ((await p.getByRole("combobox", { name: "Raccolta" }).inputValue()) !== "Warhammer 40K") throw new Error("la raccolta proposta non e' quella del 40K del lettore");
      // e la serie accanto, come l'Eresia nel 40K (il lettore: «anche il nome della serie»)
      if ((await p.getByRole("combobox", { name: "Serie", exact: true }).inputValue()) !== "Gaunt's Ghosts") throw new Error("la serie proposta non e' Gaunt's Ghosts");
      // si toglie l'ultimo: l'elenco si mostra prima di scriverlo
      await p.locator("label", { hasText: "The Anarch" }).getByRole("checkbox").uncheck();
      await p.getByRole("button", { name: "📥 Aggiungi 14 schede" }).click();
      await finche(() => testoAvviso(p, /14 schede senza file sullo scaffale/), 5000, "l'aggiunta non si dice");
      const nuove = (await libriDi(p)).filter((b) => b.fileType === "nessuno");
      if (nuove.length !== 14) throw new Error(`schede senza file: ${nuove.length}`);
      const ordine = nuove.sort((a, b) => a.sagaOrder - b.sagaOrder).map((b) => `${b.sagaOrder} ${b.title}`).join(" | ");
      if (!/^1 First and Only \| 2 Ghostmaker \| 3 Necropolis/.test(ordine) || /Anarch/.test(ordine)) throw new Error(`l'ordine non e' quello della guida: ${ordine}`);
      if (!nuove.every((b) => b.fileTolto && b.saga === "Warhammer 40K" && b.series === "Gaunt's Ghosts" && b.author === "Dan Abnett")) throw new Error(`saga, serie o autore sbagliati: ${JSON.stringify(nuove[0])}`);
      // IL PANNELLO RESTA APERTO («magari voglio rimanere lì e aggiungerne
      // altre»): lo dice accanto al tasto, e quel che e' entrato e' gia' sullo scaffale
      await finche(() => p.getByRole("status").filter({ hasText: "✓ 14 schede aggiunte in «Warhammer 40K». Puoi cercarne un'altra." }).count(), 5000, "aggiunta la saga, il pannello non resta aperto a dirlo");
      if ((await p.getByText("✓ è già sullo scaffale").count()) < 14) throw new Error("le schede appena aggiunte non risultano gia' sullo scaffale nell'elenco");
      if (!(await p.getByRole("button", { name: "Spunta quelli da aggiungere" }).count())) throw new Error("il tasto offre ancora di aggiungere quel che e' entrato");
      await p.getByRole("button", { name: "Chiudi", exact: true }).click();
      // le copertine scendono dopo, due alla volta
      const copertine = () =>
        p.evaluate(
          () =>
            new Promise((ok) => {
              const r = indexedDB.open("bc_library");
              r.onsuccess = () => {
                const q = r.result.transaction("covers").objectStore("covers").getAllKeys();
                q.onsuccess = () => ok(q.result.length);
              };
            })
        );
      await finche(async () => (await copertine()) >= 14, 15000, "le copertine delle schede non arrivano");
      // nella raccolta stanno coi loro titoli, e il cammino non le conta fra i tuoi
      await p.getByRole("button", { name: /^Warhammer 40K/ }).first().click();
      await finche(() => p.getByRole("button", { name: "📜 Gaunt's Ghosts" }).count(), 5000, "le schede non portano il cammino di Gaunt's Ghosts sul ripiano");
      await p.getByRole("button", { name: "📜 Gaunt's Ghosts" }).click();
      await finche(() => p.getByText(/Hai 0 dei 15 volumi della guida/).count(), 5000, "il cammino conta le schede senza file fra i libri che hai");
      if ((await p.getByText("📥 sullo scaffale, senza file").count()) < 14) throw new Error("le righe del cammino non dicono «senza file»");
      await p.getByRole("button", { name: "Chiudi" }).click();
      // IL FILE SCELTO DALLA SCHEDA ENTRA IN QUELLA SCHEDA, anche col titolo scritto diverso
      const ghost = nuove.find((b) => b.title === "Ghostmaker");
      await p.getByText("Ghostmaker", { exact: true }).first().evaluate((e) => e.closest("button").click());
      const scelta = p.waitForEvent("filechooser");
      await p.getByRole("button", { name: "📂 Scegli il file" }).click();
      await finche(() => testoAvviso(p, /Questa scheda non ha ancora il suo ebook/), 5000, "la scheda senza file non dice di scegliere l'ebook");
      await (await scelta).setFiles({ name: "Ghostmaker (Gaunt's Ghosts Book 2).epub", mimeType: "application/epub+zip", buffer: await epub({ titolo: "Ghostmaker (Gaunt's Ghosts Book 2)", autore: "Dan Abnett" }) });
      await finche(async () => (await libriDi(p)).find((b) => b.id === ghost.id)?.fileType === "epub", 15000, "il file non e' entrato nella scheda di Ghostmaker");
      const dopo = await libriDi(p);
      const sua = dopo.find((b) => b.id === ghost.id);
      if (sua.fileTolto || sua.title !== "Ghostmaker" || sua.sagaOrder !== 2) throw new Error(`la scheda di Ghostmaker dopo il file: ${JSON.stringify(sua)}`);
      if (dopo.length !== libri.length + 14) throw new Error(`il file ha fatto una scheda nuova accanto: ${dopo.length} libri`);
      // UN LIBRO SOLO: «a quale saga appartiene di quelle che ho già
      // creato?», e uno che c'e' gia' non si aggiunge di nuovo
      await p.goto(`${URL_APP}?apri=libreria`);
      await p.getByRole("button", { name: "📥 Senza file" }).click();
      const titolo = p.getByRole("textbox", { name: "Titolo", exact: true });
      await titolo.fill("Ghostmaker");
      await p.getByRole("textbox", { name: "Autore", exact: true }).fill("Dan Abnett");
      await finche(() => p.getByText(/Questo libro è già sullo scaffale/).count(), 5000, "il libro che c'e' gia' non si dice");
      if (await p.getByRole("button", { name: "📥 Aggiungi", exact: true }).isEnabled()) throw new Error("il libro che c'e' gia' si puo' aggiungere di nuovo");
      if (!(await p.getByRole("button", { name: /^Warhammer 40K · \d+$/ }).count())) throw new Error("le raccolte dell'autore non si propongono");
      await titolo.fill("Malleus");
      await p.getByRole("button", { name: "🔍 Di che saga è?" }).click();
      await finche(() => p.getByText(/È nella guida di Eisenhorn: va in «Warhammer 40K», Eisenhorn, n° 2/).count(), 5000, "Malleus non si riconosce nella raccolta del 40K");
      const proposta = `${await p.getByRole("combobox", { name: "Saga", exact: true }).inputValue()} ${await p.getByRole("textbox", { name: "Numero", exact: true }).inputValue()}`;
      if ((await p.getByPlaceholder("Serie", { exact: true }).inputValue()) !== "Eisenhorn") throw new Error("la serie proposta per Malleus non si vede");
      if (proposta !== "Warhammer 40K 2") throw new Error(`la proposta scritta nei campi: ${proposta}`);
      await p.getByRole("button", { name: "📥 Aggiungi", exact: true }).click();
      await finche(async () => (await libriDi(p)).some((b) => b.title === "Malleus"), 5000, "Malleus non entra");
      const malleus = (await libriDi(p)).find((b) => b.title === "Malleus");
      if (`${malleus.saga}|${malleus.series}|${malleus.sagaOrder}` !== "Warhammer 40K|Eisenhorn|2") throw new Error(`Malleus sullo scaffale: ${JSON.stringify(malleus)}`);
      // LA RACCOLTA SI SCEGLIE («permettimi anche di metterlo in una raccolta
      // o saga se serve»): i campi propongono le raccolte che hai e, scelta
      // la raccolta, le sue serie (aggiunto Malleus, il pannello e' ancora li')
      const opzioni = (id) => p.evaluate((x) => [...document.querySelectorAll(`#${x} option`)].map((o) => o.value), id);
      const campoRaccolta = p.getByPlaceholder("Raccolta", { exact: true });
      if ((await campoRaccolta.getAttribute("list")) !== "bc-raccolte" || !(await opzioni("bc-raccolte")).includes("Warhammer 40K")) throw new Error(`il campo della raccolta non propone le raccolte: ${await opzioni("bc-raccolte")}`);
      await campoRaccolta.fill("warhammer 40k");
      await finche(async () => (await opzioni("bc-serie-libro")).includes("Eisenhorn") && (await opzioni("bc-serie-libro")).includes("Gaunt's Ghosts"), 5000, "scelta la raccolta, le sue serie non si propongono");
      if ((await p.getByPlaceholder("Serie", { exact: true }).getAttribute("list")) !== "bc-serie-libro") throw new Error("il campo della serie non ha l'elenco");
      // UN MANGA SENZA FILE («l'aggiungi senza file vale anche per manga e
      // fumetti?»): il tipo scelto nel pannello, e lo scaffale lo sa subito
      await p.getByRole("button", { name: "🏮 Manga", exact: true }).click();
      const unoSolo = async (titolo) => {
        await p.getByRole("textbox", { name: "Titolo", exact: true }).fill(titolo);
        await p.getByRole("textbox", { name: "Autore", exact: true }).fill("Eiichiro Oda");
        await campoRaccolta.fill("One Piece");
        await p.getByRole("button", { name: "📥 Aggiungi", exact: true }).click();
        await finche(async () => (await libriDi(p)).some((b) => b.title === titolo), 5000, `«${titolo}» non entra`);
      };
      await unoSolo("One Piece, Vol. 1");
      const op = (await libriDi(p)).find((b) => b.title === "One Piece, Vol. 1");
      if (op.tipo !== "manga" || op.fileType !== "nessuno") throw new Error(`il manga senza file: ${JSON.stringify(op)}`);
      // E UNO AGGIUNTO FRA I LIBRI SEGUE LA SUA SAGA («come lo cambio e lo
      // posso mettere sotto fumetti?»): segnarne uno basta
      await p.getByRole("button", { name: "📖 Libri", exact: true }).click();
      await unoSolo("One Piece, Vol. 2");
      if ((await libriDi(p)).find((b) => b.title === "One Piece, Vol. 2").tipo) throw new Error("il secondo volume e' nato con un tipo: la prova non prova niente");
      await p.getByRole("button", { name: "Chiudi", exact: true }).click();
      await p.getByRole("button", { name: "🏮 Manga", exact: true }).click();
      await finche(() => p.getByRole("button", { name: "One Piece: 2 volumi" }).count(), 5000, "fra i manga non ci sono tutt'e due i One Piece senza file");
      if (await p.getByText("Warhammer 40K", { exact: true }).count()) throw new Error("fra i manga ci sono i romanzi del 40K");
      // il secondo «Tutti» e' quello dei tipi
      await p.getByRole("button", { name: "Tutti", exact: true }).nth(1).click();
      // UN MONDO INTERO («fai le guide di Cosmoverso e Malazan»): tutte le
      // sue guide, una dopo l'altra, in una raccolta
      await p.getByRole("button", { name: "📥 Senza file" }).click();
      await p.getByRole("textbox", { name: "Nome della saga" }).fill("Cosmoverso");
      await p.getByRole("button", { name: "🔍 Cerca i libri" }).click();
      await finche(() => p.getByText(/«Cosmere»: tutte le guide dell'app di questo mondo/).count(), 5000, "il Cosmere non si trova come mondo");
      if (!(await p.getByRole("button", { name: "📥 Aggiungi 18 schede" }).count())) throw new Error("il Cosmere non ha i suoi diciotto romanzi");
      if ((await p.getByRole("combobox", { name: "Raccolta" }).inputValue()) !== "Cosmere") throw new Error("senza Cosmere sullo scaffale, la raccolta proposta non e' il mondo");
      // LE SAGHE DI UN AUTORE («permettimi la ricerca per autore»): la
      // guida dell'app e la serie di Wikidata, e un tocco porta i libri
      const tipo = (...q) => q.map((id) => ({ mainsnak: { datavalue: { value: { id } } } }));
      const libroW = (en, n) => ({ labels: { en: { value: en } }, claims: { P31: tipo("Q7725634"), P7937: tipo("Q8261"), P50: tipo("Q1"), P179: [{ mainsnak: { datavalue: { value: { id: "Q11" } } }, qualifiers: { P1545: [{ datavalue: { value: String(n) } }] } }] } });
      const W = { Q1: { labels: { en: { value: "Jonathan Stroud" } }, claims: { P106: tipo("Q6625963") } }, Q11: { labels: { en: { value: "Bartimaeus Sequence" } }, claims: { P31: tipo("Q1667921") } }, Q30: { labels: { en: { value: "Heroes of the Valley" } }, claims: { P31: tipo("Q7725634"), P7937: tipo("Q8261"), P50: tipo("Q1"), P179: [{ mainsnak: { datavalue: { value: { id: "Q12" } } }, qualifiers: { P1545: [{ datavalue: { value: "1" } }] } }] } }, Q12: { labels: { en: { value: "Valley Tales" } }, claims: { P31: tipo("Q1667921") } }, Q31: libroW("The Amulet of Samarkand", 1), Q32: { labels: { en: { value: "Buried Fire" } }, claims: { P31: tipo("Q7725634"), P7937: tipo("Q8261"), P50: tipo("Q1") } } };
      const altro = await dispositivo(browser, {
        misura: TABLET,
        wikidata: async (q) => {
          if (q.get("action") === "wbsearchentities") return { search: [{ id: "Q1" }] };
          if (q.get("action") === "query" && /P50=Q1/.test(q.get("srsearch"))) return { query: { search: [{ title: "Q30" }, { title: "Q31" }, { title: "Q32" }] } };
          if (q.get("action") === "query") return { query: { search: [{ title: "Q30" }] } };
          return { entities: Object.fromEntries(q.get("ids").split("|").filter((i) => W[i]).map((i) => [i, W[i]])) };
        },
      });
      const a = altro.p;
      await a.goto(`${URL_APP}?apri=libreria`);
      await a.getByRole("button", { name: "📥 Senza file" }).click();
      await a.getByRole("textbox", { name: "Autore delle saghe" }).fill("Jonathan Stroud");
      await a.getByRole("button", { name: "🔍 Le sue saghe" }).click();
      await finche(() => a.getByRole("button", { name: /📜 Lockwood & Co\. · 5 libri/ }).count(), 8000, "fra le saghe dell'autore manca la guida di Lockwood");
      if (!(await a.getByRole("button", { name: /📜 Bartimaeus · 4 libri/ }).count())) throw new Error("fra le saghe dell'autore manca la guida di Bartimaeus");
      if (await a.getByRole("button", { name: /^Bartimaeus Sequence/ }).count()) throw new Error("la serie di Wikidata che ha gia' la sua guida si ripete");
      await a.getByRole("button", { name: /^Valley Tales · 1 libro/ }).click();
      await finche(() => a.getByText("Heroes of the Valley").count(), 8000, "toccata la saga di Wikidata, i suoi libri non arrivano");
      // e i suoi libri che Wikidata non mette in nessuna serie («e le altre
      // saghe di questo autore non le consideri?»)
      await a.getByRole("button", { name: /📚 Altri libri · 1 libro/ }).click();
      await finche(() => a.getByText(/I suoi libri che su Wikidata non stanno in nessuna serie/).count(), 8000, "gli altri libri dell'autore non si aprono");
      if (!(await a.getByText("Buried Fire").count())) throw new Error("fra gli altri libri manca Buried Fire");
      await a.getByRole("button", { name: /📜 Lockwood & Co\./ }).click();
      await finche(() => a.getByText(/«Lockwood & Co\.»: l'elenco della guida/).count(), 5000, "toccata la guida, i suoi libri non arrivano");
      if (!(await a.getByRole("button", { name: "📥 Aggiungi 5 schede" }).count())) throw new Error("i cinque libri di Lockwood non si possono aggiungere");
      return { guasti: [...d.guasti, ...altro.guasti], nota: `14 schede in ordine sotto «Warhammer 40K», ${await copertine()} copertine, Ghostmaker col suo ePub nella sua scheda e non raddoppiato, Malleus riconosciuto nel 40K, il Cosmere come mondo; le saghe di Stroud: le guide, la serie di Wikidata e gli altri libri` };
    },
  },
  {
    // chiesto dal lettore: «siti affidabili dove vedere la lista completa
    // delle serie ce l'abbiamo?», poi «sì, aggiungi hardcover»
    nome: "con la chiave di Hardcover nelle Impostazioni, una saga si trova su Hardcover: un romanzo per numero, le storie di mezzo e l'annunciato senza spunta",
    async fai({ browser }) {
      const chiavi = [];
      const libriCercati = [];
      // il narratore davanti all'autore, come Hardcover lo da' per «Pile of Bones»
      const libro = (position, id, title, { anno = 2015, data = `${anno}-10-06`, lettori = 900, lingua = "eng" } = {}) => ({
        position,
        book: { id, title, release_year: anno, release_date: data, users_count: lettori, contributions: [{ contribution: "Narrator", author: { name: "Kieran Culkin" } }, { contribution: "Author", author: { name: "Rick  Riordan" } }], default_physical_edition: { language: { code3: lingua } } },
      });
      const d = await dispositivo(browser, {
        misura: TABLET,
        // il terzo volume c'e' gia', col nome del suo file: lo dice il posto, non il titolo
        prima: () => {
          if (!localStorage.getItem("bc_books"))
            localStorage.setItem("bc_books", JSON.stringify([{ id: "mc3", title: "Magnus Chase 03 (2017) (retail)", author: "", saga: "Rick Riordan", series: "Magnus Chase and the Gods of Asgard", sagaOrder: 3, fileType: "epub", fileTolto: true, addedAt: 1 }]));
        },
        hardcover: async ({ query, variables }, chiave) => {
          chiavi.push(chiave);
          if (/query_type: "Series"/.test(query)) return { data: { search: { results: { hits: [{ document: { id: "1585", name: "Magnus Chase and the Gods of Asgard", readers_count: 2729 } }, { document: { id: "260530", name: "Magnus Chase ve Asgard Tanrıları", readers_count: 0 } }] } } } };
          // le copertine che mancano: la ricerca di un libro col suo indirizzo
          if (/query_type: "Book"/.test(query)) {
            libriCercati.push(variables.q);
            return { data: { search: { results: { hits: /Hammer of Thor/.test(variables.q) ? [{ document: { title: "The Hammer of Thor", author_names: ["Rick Riordan"], users_count: 900, image: { url: "https://assets.hardcover.app/editions/2/thor.jpg" } } }] : [] } } } };
          }
          if (/series_by_pk/.test(query) && variables.id === 1585)
            return { data: { series_by_pk: { id: 1585, name: "Magnus Chase and the Gods of Asgard", book_series: [
              libro(1, 1, "Yaz Kılıcı", { lettori: 2000, lingua: "tur" }),
              libro(1, 2, "The Sword of Summer"),
              libro(1.5, 3, "Hotel Valhalla Guide to the Norse Worlds", { anno: 2016 }),
              libro(2, 4, "The Hammer of Thor", { anno: 2016 }),
              libro(3, 5, "The Ship of the Dead", { anno: 2017 }),
              libro(4, 6, "The Next Magnus", { anno: 2030, data: "2030-05-01", lettori: 3 }),
            ] } } };
          return { data: {} };
        },
      });
      const { p } = d;
      await p.goto(URL_APP);
      await p.getByRole("button", { name: /^Impostazioni/ }).first().click();
      await p.getByRole("textbox", { name: "Chiave di Hardcover" }).fill("Bearer hc_pat_prova");
      await p.getByRole("button", { name: "Salva la chiave di Hardcover" }).click();
      await finche(() => p.getByText(/✓ Chiave salvata: in «📥 Senza file»/).count(), 5000, "la chiave di Hardcover non si salva");
      await p.goto(`${URL_APP}?apri=libreria`);
      await p.getByRole("button", { name: "📥 Senza file" }).click();
      await p.getByRole("textbox", { name: "Nome della saga" }).fill("Magnus Chase");
      await p.getByRole("button", { name: "🔍 Cerca i libri" }).click();
      await finche(() => p.getByText(/«Magnus Chase and the Gods of Asgard» su Hardcover/).count(), 8000, "la saga non si trova su Hardcover");
      if (!chiavi.length || !chiavi.every((c) => c === "Bearer hc_pat_prova")) throw new Error(`la chiave non arriva com'e' scritta da Hardcover: ${chiavi.join(" | ")}`);
      for (const t of ["The Sword of Summer", "The Hammer of Thor", "The Ship of the Dead", "The Next Magnus"]) if (!(await p.getByText(t, { exact: true }).count())) throw new Error(`nell'elenco manca «${t}»`);
      if (await p.getByText("Yaz Kılıcı", { exact: true }).count()) throw new Error("nell'elenco c'e' la traduzione turca");
      // la storia di mezzo (il lettore: «non mi consideri anche le storie di intramezzo?»): c'e', al suo numero, senza spunta
      const storia = p.locator("label", { hasText: "Hotel Valhalla Guide to the Norse Worlds" });
      if (!(await storia.getByText(/storia di mezzo/).count()) || !(await storia.getByText("n° 1.5").count())) throw new Error("la storia di mezzo non si vede al suo numero");
      if (await storia.getByRole("checkbox").isChecked()) throw new Error("la storia di mezzo parte spuntata");
      if (await p.locator("label", { hasText: "The Next Magnus" }).getByRole("checkbox").isChecked()) throw new Error("il libro annunciato parte spuntato");
      if (!(await p.locator("label", { hasText: "The Next Magnus" }).getByText(/annunciato/).count())) throw new Error("il libro annunciato non lo dice");
      await p.getByRole("combobox", { name: "Raccolta" }).fill("Rick Riordan");
      if ((await p.getByRole("combobox", { name: "Serie", exact: true }).inputValue()) !== "Magnus Chase and the Gods of Asgard") throw new Error("la serie proposta non e' quella di Hardcover");
      // nella raccolta e nella serie scelte il terzo c'e' gia' (il lettore: «non lo avevi già visto nella raccolta?»)
      await finche(() => p.locator("label", { hasText: "The Ship of the Dead" }).getByText(/già sullo scaffale/).count(), 5000, "il volume gia' nella raccolta col suo numero non si riconosce");
      await p.getByRole("button", { name: "📥 Aggiungi 2 schede" }).click();
      // (l'avviso dell'aggiunta lo copre subito quello delle copertine: qui il catalogo non risponde)
      await finche(async () => (await libriDi(p)).filter((b) => b.fileType === "nessuno").length === 2, 5000, "le due schede non entrano");
      const nuove = (await libriDi(p)).filter((b) => b.fileType === "nessuno").sort((a, b) => a.sagaOrder - b.sagaOrder);
      const scritte = nuove.map((b) => `${b.sagaOrder} ${b.title} · ${b.saga} / ${b.series} · ${b.author}`).join(" | ");
      if (scritte !== "1 The Sword of Summer · Rick Riordan / Magnus Chase and the Gods of Asgard · Rick Riordan | 2 The Hammer of Thor · Rick Riordan / Magnus Chase and the Gods of Asgard · Rick Riordan")
        throw new Error(`le schede: ${scritte}`);
      // LE COPERTINE CHE MANCANO (il lettore: «sì, mostra le copertine di
      // Hardcover quando mancano»): sullo scaffale la sua, dove la nostra non c'e'
      await p.keyboard.press("Escape");
      await p.goto(`${URL_APP}?apri=libreria`);
      await finche(() => p.locator('img[src="https://assets.hardcover.app/editions/2/thor.jpg"]').count(), 10000, "la copertina di Hardcover non si mostra");
      const senza = await p.evaluate(() => [...document.querySelectorAll("img")].filter((i) => /assets\.hardcover\.app/.test(i.src)).length);
      if (senza !== 1) throw new Error(`copertine di Hardcover sullo scaffale: ${senza} (attesa una: le altre Hardcover non le ha)`);
      if (!libriCercati.some((q) => /The Sword of Summer/.test(q))) throw new Error("i libri senza copertina non si cercano");
      return { guasti: d.guasti, nota: `${chiavi.length} domande a Hardcover; ${scritte.split(" | ").length} schede in «Rick Riordan», serie Magnus Chase, 1–2 (il 3 c'era gia' col nome del file); la traduzione turca fuori, la storia di mezzo 1.5 e l'annunciato senza spunta; la copertina di Hardcover dove manca (${libriCercati.length} libri cercati)` };
    },
  },
  {
    // chiesto dal lettore davanti alle raccolte dei manga: «permettimi di
    // mettere tutti i volumi all'interno di una raccolta come letti o meno e
    // di valutare l'intera saga con un suo voto»
    nome: "in una raccolta si segnano tutti i volumi letti e si vota la saga, e il tablet lo vede",
    async fai({ browser, db }) {
      const semina = () => {
        if (localStorage.getItem("bc_books")) return;
        const libri = [1, 2, 3, 4].map((i) => ({ id: `be${i}`, title: `Berserk ${i}`, author: "Kentaro Miura", saga: "Berserk", sagaOrder: i, fileType: "cbz", addedAt: i, rating: i === 1 ? 5 : 0 }));
        localStorage.setItem("bc_books", JSON.stringify(libri));
      };
      const raccolte = () => localStorage.setItem("bc_vista", JSON.stringify({ aspetto: "raccolte" }));
      const pc = await dispositivo(browser, { sessione: true, prima: `(${semina})(); (${raccolte})();` });
      await pc.p.goto(`${URL_APP}?apri=libreria`);
      await finche(() => db.righe().length >= 4, 20000, "i volumi non salgono");
      await pc.p.getByRole("button", { name: /^Berserk/ }).first().click();
      await finche(() => testoAvviso(pc.p, /media dei volumi ★ 5 \(1 votato su 4\)/), 8000, "la raccolta non dice la media dei volumi");
      // il voto parte da solo, prima di ogni altro cambio
      await pc.p.getByRole("button", { name: "4.5 stelle" }).first().click();
      const voto = () => (db.prefs()?.raccolte_fav || []).find((x) => x.id === "voto|saga:berserk")?.voto;
      await finche(() => voto() === 4.5, 15000, `il voto non sale (lassu': ${voto()})`);
      await pc.p.getByRole("button", { name: "✓ Tutti letti" }).click();
      await finche(() => testoAvviso(pc.p, /^Segno 4 volumi letti\?$/), 5000, "non chiede conferma");
      await pc.p.getByRole("button", { name: "Sì" }).click();
      await finche(() => db.righe().filter((r) => r.status === "read").length === 4, 15000, `i letti non salgono (${db.righe().filter((r) => r.status === "read").length})`);
      const tab = await dispositivo(browser, { sessione: true, prima: `(${raccolte})();` });
      await tab.p.goto(`${URL_APP}?apri=libreria`);
      await finche(() => testoAvviso(tab.p, /^tutti letti ✓$/), 20000, "sul tablet la raccolta non e' tutta letta");
      const visto = await finche(() => testoAvviso(tab.p, /★ 4,5/), 10000, "sul tablet il voto della saga non c'e'");
      return { guasti: [...pc.guasti, ...tab.guasti], nota: `4 volumi letti e «${visto.trim()}» sul tablet` };
    },
  },
  {
    // chiesto dal lettore, lasciato Drive: «fai sapere al PC quali libri sono
    // sul tablet». Il libro aggiunto sul tablet compariva sul PC col
    // triangolo «né qui né nel cloud», e aperto finiva sul guasto.
    nome: "il libro aggiunto sul tablet, sul PC sta «sul tablet» e non è perduto, e da «Apri» se ne sceglie il file",
    async fai({ browser, db }) {
      const tab = await dispositivo(browser, { sessione: true, misura: TABLET });
      const libro = await epub();
      await importa(tab.p, "La nebbia.epub", libro, "application/epub+zip");
      const id = (await libriDi(tab.p)).find((b) => b.title === "La nebbia").id;
      const voce = () => (db.prefs()?.raccolte_fav || []).find((x) => x.id.startsWith("qui|") && x.libri?.includes(id));
      await finche(() => voce()?.nome === "tablet", 20000, `il tablet non dice lassu' cosa tiene (${JSON.stringify(db.prefs()?.raccolte_fav)})`);
      await finche(() => db.righe().some((r) => r.id === id), 20000, "la scheda del tablet non sale");

      // il selettore dei file del computer: la prima volta il lettore annulla
      const prima = `window.showOpenFilePicker = async (o) => {
        window.__chiesto = o;
        if (!window.__scelta) throw new DOMException("annullato", "AbortError");
        const f = window.__scelta;
        return [{ getFile: async () => f }];
      };`;
      const pc = await dispositivo(browser, { sessione: true, prima });
      await pc.p.goto(`${URL_APP}?apri=libreria`);
      await finche(async () => (await libriDi(pc.p)).some((b) => b.id === id), 20000, "il libro non scende sul PC");
      const segno = await finche(() => pc.p.locator('span[title="Sta sul tablet: lì si legge"]').count(), 15000, "sul dorso non c'e' il segno del tablet");
      await aspetta(1500);
      const perso = await testoAvviso(pc.p, /né qui né nel cloud/);
      if (perso) throw new Error(`sul PC il libro del tablet e' detto perduto: «${perso}»`);
      if (await pc.p.locator('span[title^="Né qui né nel cloud"]').count()) throw new Error("sul dorso c'e' il triangolo dei perduti");

      await pc.p.getByText("La nebbia").first().click();
      await pc.p.getByRole("button", { name: /Apri il libro|Comincia/ }).first().click();
      const detto = await finche(() => testoAvviso(pc.p, /^Questo libro sta sul tablet 📱/), 8000, "aprendolo, il PC non dice che sta sul tablet");
      if (await pc.p.locator("iframe").count()) throw new Error("il reader si e' aperto su un libro che qui non c'e'");
      const chiesto = await pc.p.evaluate(() => window.__chiesto?.id);
      if (chiesto !== "bc-hdd") throw new Error(`«Apri» non porta alle cartelle del disco: ${chiesto}`);
      // la seconda volta sceglie il file, ed entra nella sua scheda
      await pc.p.evaluate((b) => { window.__scelta = new File([new Uint8Array(b)], "La nebbia.epub", { type: "application/epub+zip" }); }, [...libro]);
      await pc.p.getByRole("button", { name: /Apri il libro|Comincia/ }).first().click();
      await finche(async () => {
        const n = await pc.p.evaluate(async (id) => {
          const db = await new Promise((ok, ko) => { const r = indexedDB.open("bc_library"); r.onsuccess = () => ok(r.result); r.onerror = ko; });
          return await new Promise((ok) => { const g = db.transaction("files").objectStore("files").count(id); g.onsuccess = () => ok(g.result); g.onerror = () => ok(0); });
        }, id);
        return n === 1;
      }, 15000, "il file scelto non entra nella scheda del tablet");
      const schede = (await libriDi(pc.p)).filter((b) => b.title === "La nebbia");
      if (schede.length !== 1) throw new Error(`le schede della nebbia sul PC: ${schede.length}`);
      return { guasti: [...pc.guasti, ...tab.guasti], nota: `${segno} segno 📱 · «${detto}» · poi il file scelto entra nella sua scheda` };
    },
  },
  {
    // chiesto dal lettore, col tablet pieno: «su E ho tutto salvato quindi
    // non si perde il file originale». Il PC controlla il disco e lo dice
    // lassu'; il tablet propone di togliere gli ebook dei letti che il disco
    // ha, e solo quelli.
    nome: "il tablet libera spazio: via gli ebook letti che il disco del computer ha, e solo quelli",
    async fai({ browser, db }) {
      const tab = await dispositivo(browser, { sessione: true, misura: TABLET });
      await importa(tab.p, "La nebbia.epub", await epub(), "application/epub+zip");
      await importa(tab.p, "Il faro.epub", await epub({ titolo: "Il faro" }), "application/epub+zip");
      await importa(tab.p, "Il ponte.epub", await epub({ titolo: "Il ponte" }), "application/epub+zip");
      await importa(tab.p, "Il bosco.epub", await epub({ titolo: "Il bosco" }), "application/epub+zip");
      const ids = Object.fromEntries((await libriDi(tab.p)).map((b) => [b.title, b.id]));
      // letti la nebbia, il bosco e il faro; il ponte e' in lettura
      await tab.p.evaluate((ids) => {
        localStorage.setItem(`bc_status_${ids["La nebbia"]}`, "read");
        localStorage.setItem(`bc_status_${ids["Il bosco"]}`, "read");
        localStorage.setItem(`bc_status_${ids["Il faro"]}`, "read");
        localStorage.setItem(`bc_status_${ids["Il ponte"]}`, "reading");
      }, ids);

      await finche(() => Object.values(ids).every((id) => db.righe().some((r) => r.id === id)), 20000, "i libri del tablet non salgono");
      // sul disco del computer ci sono la nebbia, il bosco e il ponte, il faro no
      const prima = `window.showDirectoryPicker = async () => (await navigator.storage.getDirectory()).getDirectoryHandle("HDD", { create: true });`;
      const pc = await dispositivo(browser, { sessione: true, prima });
      await pc.p.goto(`${URL_APP}?apri=libreria`);
      await finche(async () => (await libriDi(pc.p)).filter((b) => Object.values(ids).includes(b.id)).length === 4, 20000, "i libri del tablet non scendono sul PC");
      await pc.p.evaluate(async () => {
        const r = await (await navigator.storage.getDirectory()).getDirectoryHandle("HDD", { create: true });
        const libri = await (await r.getDirectoryHandle("book-companion", { create: true })).getDirectoryHandle("Libri", { create: true });
        for (const nome of ["La nebbia.epub", "Il bosco.epub", "Il ponte.epub"]) {
          const w = await (await libri.getFileHandle(nome, { create: true })).createWritable();
          await w.write(new Uint8Array(400).fill(1));
          await w.close();
        }
      });
      await pc.p.getByRole("button", { name: /Manutenzione/ }).first().click();
      await pc.p.getByRole("button", { name: "🔍 Controlla il disco" }).click();
      await finche(() => pc.p.getByText(/Sul disco ci sono 3 volumi della biblioteca/).count(), 10000, "il rapporto del disco non si vede");

      await finche(() => (db.prefs()?.raccolte_fav || []).some((v) => v.disco && v.libri?.length === 3), 20000, "il PC non dice lassu' cosa ha il disco");
      // il tablet lo sa al giro dopo
      await tab.p.goto(`${URL_APP}?apri=libreria`);
      await tab.p.getByRole("button", { name: /Manutenzione/ }).first().click();
      const tasto = tab.p.getByRole("button", { name: /🧹 Libera spazio: 2 libri letti sono anche sul disco del computer/ });
      await finche(() => tasto.count(), 20000, "sul tablet non c'e' «Libera spazio»");
      const faro = await finche(() => testoAvviso(tab.p, /Un libro letto non era sul disco del computer/), 5000, "il letto che il disco non ha non si dice");
      await tasto.click();
      const elenco = await tab.p.locator("li").allInnerTexts();
      if (!elenco.some((t) => /La nebbia/.test(t)) || !elenco.some((t) => /Il bosco/.test(t)) || elenco.some((t) => /Il faro|Il ponte/.test(t))) throw new Error(`nell'elenco: ${elenco.join(" | ")}`);
      await tab.p.getByRole("button", { name: "Togli i 2 ebook" }).click();
      await finche(() => testoAvviso(tab.p, /2 ebook tolti/), 8000, "il tablet non dice di aver tolto gli ebook");
      const libri = await libriDi(tab.p);
      const tolto = (t) => libri.find((b) => b.id === ids[t])?.fileTolto === true;
      if (!tolto("La nebbia") || !tolto("Il bosco") || tolto("Il faro") || tolto("Il ponte")) throw new Error(`segnati: ${libri.filter((b) => b.fileTolto).map((b) => b.title).join(", ")}`);
      const byte = await tab.p.evaluate(async (ids) => {
        const db = await new Promise((ok, ko) => { const r = indexedDB.open("bc_library"); r.onsuccess = () => ok(r.result); r.onerror = ko; });
        const c = (id) => new Promise((ok) => { const g = db.transaction("files").objectStore("files").count(id); g.onsuccess = () => ok(g.result); g.onerror = () => ok(-1); });
        return [await c(ids["La nebbia"]), await c(ids["Il bosco"]), await c(ids["Il faro"]), await c(ids["Il ponte"])].join(",");
      }, ids);
      if (byte !== "0,0,1,1") throw new Error(`file sul tablet (nebbia, bosco, faro, ponte): ${byte}`);
      return { guasti: [...tab.guasti, ...pc.guasti], nota: `via la nebbia e il bosco; restano il faro («${faro.slice(0, 40)}…») e il ponte in lettura` };
    },
  },
  {
    // chiesto dal lettore sul PC, 1920 di larghezza: «far si' che occupi bene
    // lo spazio a schermo». La colonna stava a 960 e mezzo schermo restava vuoto
    nome: "sul computer largo la colonna usa tutto lo schermo, sul tablet resta com'era",
    async fai({ browser }) {
      const prima = () => {
        if (localStorage.getItem("bc_books")) return;
        localStorage.setItem("bc_books", JSON.stringify([{ id: "m", title: "Mort", author: "Terry Pratchett", fileType: "epub", addedAt: 1 }]));
        localStorage.setItem("bc_status_m", "reading");
      };
      const pc = await dispositivo(browser, { misura: { viewport: { width: 1920, height: 1040 } }, prima });
      await pc.p.goto(URL_APP);
      const larga = await finche(() => pc.p.evaluate(() => document.querySelector("main")?.getBoundingClientRect().width), 8000, "l'Ingresso non si vede");
      // tutta la finestra (il lettore: «affinché venga preso tutto lo schermo»): a 1440 restavano 214 pixel vuoti per parte
      if (larga < 1919) throw new Error(`sul PC la colonna e' larga ${larga} su 1920`);
      // le stanze accanto al libro in mano, sopra le file; sul tablet in fondo
      const sopra = (p) =>
        p.evaluate(() => {
          const stanza = [...document.querySelectorAll("button")].find((b) => /Il giardino/.test(b.textContent))?.getBoundingClientRect();
          const libro = [...document.querySelectorAll("button")].find((b) => /Comincia|Riprendi/.test(b.textContent))?.getBoundingClientRect();
          return stanza && libro ? stanza.top < libro.bottom && stanza.left > libro.right - 1 : null;
        });
      await finche(() => sopra(pc.p).then((x) => x !== null), 8000, "il libro in mano o le stanze non si vedono");
      if ((await sopra(pc.p)) !== true) throw new Error("sul PC le stanze non stanno accanto al libro in mano");
      // e nella stessa fascia, alte quanto lui: allineate in fondo
      // galleggiavano a meta' altezza sotto un vuoto (la foto del lettore)
      const fascia = await pc.p.evaluate(() => {
        const bottoni = [...document.querySelectorAll("button")];
        const libro = bottoni.find((b) => /Comincia|Riprendi/.test(b.textContent)).getBoundingClientRect();
        const stanze = bottoni.find((b) => /Il giardino/.test(b.textContent)).parentElement.getBoundingClientRect();
        return [libro.top, libro.bottom, stanze.top, stanze.bottom].map(Math.round);
      });
      if (Math.abs(fascia[0] - fascia[2]) > 1 || Math.abs(fascia[1] - fascia[3]) > 1)
        throw new Error(`sul PC il libro sta fra ${fascia[0]} e ${fascia[1]}, le stanze fra ${fascia[2]} e ${fascia[3]}`);
      // la finestra stretta: le stanze tornano in fondo senza riaprire l'app
      await pc.p.setViewportSize({ width: 1100, height: 1040 });
      await finche(() => sopra(pc.p).then((x) => x === false), 5000, "stringendo la finestra le stanze restano accanto al libro");
      const tab = await dispositivo(browser, { misura: TABLET, prima });
      await tab.p.goto(URL_APP);
      const t = await finche(() => tab.p.evaluate(() => [document.querySelector("main")?.getBoundingClientRect().width, document.documentElement.scrollWidth, innerWidth]), 8000, "l'Ingresso del tablet non si vede");
      if (t[0] !== t[2] || t[1] > t[2]) throw new Error(`sul tablet: colonna ${t[0]}, pagina ${t[1]}, schermo ${t[2]}`);
      await finche(() => sopra(tab.p).then((x) => x !== null), 8000, "sul tablet il libro in mano o le stanze non si vedono");
      if ((await sopra(tab.p)) !== false) throw new Error("sul tablet le stanze non stanno in fondo");
      // e sdraiato e' largo 1503, ma con la scrittura ×1,5 non e' un computer
      const sdr = await dispositivo(browser, { misura: { ...TABLET, viewport: { width: 1503, height: 902 } }, prima });
      await sdr.p.goto(URL_APP);
      await finche(() => sopra(sdr.p).then((x) => x !== null), 8000, "sul tablet sdraiato il libro in mano o le stanze non si vedono");
      if ((await sopra(sdr.p)) !== false) throw new Error("sul tablet sdraiato le stanze sono salite accanto al libro");
      return { guasti: [...pc.guasti, ...tab.guasti, ...sdr.guasti], nota: `PC: colonna ${Math.round(larga)} su 1920, stanze accanto al libro · tablet: colonna a tutta larghezza (${t[2]}), niente che sborda, stanze in fondo anche sdraiato` };
    },
  },
  {
    // chiesto dal lettore: «E le altre saghe?» diceva «correggi il numero
    // di uno dei due nella scheda» e non ci portava. Ogni riga apre la
    // scheda del volume di cui parla; due numeri uguali, un tasto ciascuno.
    nome: "«E le altre saghe?» apre la scheda del volume di cui parla",
    async fai({ browser }) {
      const prima = () => {
        if (localStorage.getItem("bc_books")) return;
        const v = (id, title, saga, n) => ({ id, title, author: "A", saga, sagaOrder: n, fileType: "epub", addedAt: 1 });
        localStorage.setItem(
          "bc_books",
          JSON.stringify([v("s9", "Spawn Nove", "Spawn", 9), v("s10a", "Spawn Dieci", "Spawn", 10), v("s10b", "Spawn Dieci bis", "Spawn", 10), v("m1", "Mort", "Discworld", 1)])
        );
        localStorage.setItem("bc_status_s9", "read");
        localStorage.setItem("bc_status_m1", "read");
      };
      const d = await dispositivo(browser, { misura: TABLET, prima });
      await d.p.goto(URL_APP);
      const apri = d.p.getByRole("button", { name: /E le altre saghe/ });
      await finche(() => apri.isVisible(), 8000, "«E le altre saghe?» non c'e'");
      await apri.click();
      const titoloInScheda = (t) => d.p.evaluate((t) => [...document.querySelectorAll("input")].some((i) => i.value === t), t);
      // due numeri uguali: un tasto per volume, e il secondo apre il secondo
      const bis = d.p.getByRole("button", { name: "Apri «Spawn Dieci bis» ›" });
      await finche(() => bis.isVisible(), 5000, "la riga dei due n° 10 non ha il tasto del secondo volume");
      if (!(await d.p.getByRole("button", { name: "Apri «Spawn Dieci» ›" }).isVisible())) throw new Error("manca il tasto del primo n° 10");
      await bis.click();
      await finche(() => titoloInScheda("Spawn Dieci bis"), 8000, "il tasto non apre la scheda di «Spawn Dieci bis»");
      // e una riga con un volume solo si tocca tutta
      await d.p.goto(URL_APP);
      await finche(() => apri.isVisible(), 8000, "tornati all'Ingresso, «E le altre saghe?» non c'e'");
      await apri.click();
      const mort = d.p.getByRole("button", { name: /Discworld: «Mort»/ });
      await finche(() => mort.isVisible(), 5000, "la riga di Mort non si tocca");
      const alta = (await mort.boundingBox()).height;
      if (alta < 44) throw new Error(`la riga di Mort e' alta ${alta}px, meno di un dito`);
      await mort.click();
      await finche(() => titoloInScheda("Mort"), 8000, "la riga di Mort non apre la sua scheda");
      return { guasti: d.guasti, nota: "i due n° 10 di Spawn hanno un tasto ciascuno, la riga di Mort (alta un dito) apre la sua scheda" };
    },
  },
  {
    // chiesto dal lettore: «fammi fare il login senza usare google», poi
    // «voglio cancellare l'accesso a google per la mia applicazione». Il
    // pannello d'ingresso ha email e password in vista, e niente Google.
    // Poi «fai come per Ciak»: «Password dimenticata?» manda l'email di
    // reimpostazione, e il ritorno (`type=recovery`) chiede la password.
    nome: "si entra con email e password, senza Google, e «Password dimenticata?» fa scegliere la password",
    async fai({ browser, db }) {
      const d = await dispositivo(browser, { misura: TABLET });
      await d.p.goto(URL_APP);
      await d.p.getByRole("button", { name: "Sincronizzazione" }).first().click();
      await d.p.getByRole("button", { name: /Sincronizzazione nel cloud/ }).first().click();
      const email = d.p.getByPlaceholder("la-tua@email.it");
      await finche(() => email.isVisible(), 8000, "il campo dell'email non si vede subito");
      if (!(await d.p.getByPlaceholder("password").isVisible())) throw new Error("il campo della password non si vede");
      if (!(await d.p.getByRole("button", { name: "Entra", exact: true }).isVisible())) throw new Error("il tasto «Entra» non si vede");
      const testo = await d.p.locator("body").innerText();
      if (/google/i.test(testo)) throw new Error(`nel pannello c'e' ancora Google: ${testo.match(/.{0,40}google.{0,40}/i)?.[0]}`);
      // «Password dimenticata?»: l'email di reimpostazione, che riporta alla radice
      await email.fill("prova@esempio.it");
      await d.p.getByRole("button", { name: /Password dimenticata/ }).click();
      await finche(() => testoAvviso(d.p, /scegli la password nuova/), 5000, "il pannello non dice di aprire l'email");
      const ritorno = await finche(() => db.link().at(-1), 5000, "l'email di reimpostazione non parte");
      if (ritorno !== new URL(URL_APP).origin) throw new Error(`il link riporta a ${ritorno}`);
      // aperto il link: Supabase torna con `type=recovery`, e si chiede subito la password
      const t = await dispositivo(browser, { misura: TABLET });
      const sessione = new URLSearchParams({ access_token: "a.b.c", refresh_token: "r", expires_in: "3600", expires_at: String(Math.floor(Date.now() / 1000) + 3600), token_type: "bearer", type: "recovery" });
      await t.p.goto(`${URL_APP}#${sessione}`);
      const campo = t.p.getByPlaceholder("Nuova password");
      await finche(() => campo.isVisible(), 10000, "tornati dal link, la password nuova non si chiede");
      if (!(await t.p.getByText("🔑 Scegli la nuova password").isVisible())) throw new Error("manca il titolo della password nuova");
      // scritta due volte: se non sono uguali non parte
      await campo.fill("segreta123");
      await t.p.getByPlaceholder("Ripetila").fill("segreta124");
      await t.p.getByRole("button", { name: "Salva" }).first().click();
      await finche(() => testoAvviso(t.p, /non sono uguali/), 5000, "due password diverse non si dicono");
      if (db.password().length) throw new Error("due password diverse sono partite lo stesso");
      await t.p.getByPlaceholder("Ripetila").fill("segreta123");
      await t.p.getByRole("button", { name: "Salva" }).first().click();
      await finche(() => db.password().includes("segreta123"), 5000, "la password nuova non arriva a Supabase");
      await finche(async () => !(await t.p.getByText("🔑 Scegli la nuova password").count()), 5000, "la richiesta della password resta lì dopo averla salvata");
      // un link scaduto torna con l'errore nel frammento: si dice, e l'indirizzo si pulisce
      const s = await dispositivo(browser, { misura: TABLET });
      await s.p.goto(`${URL_APP}#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired`);
      await finche(() => testoAvviso(s.p, /scaduto o è già stato usato/), 10000, "il link scaduto non si dice");
      if (!(await s.p.getByPlaceholder("la-tua@email.it").isVisible())) throw new Error("col link scaduto il pannello d'ingresso non e' aperto");
      const resta = await s.p.evaluate(() => location.hash);
      if (resta) throw new Error(`l'errore resta nell'indirizzo: ${resta}`);
      return { guasti: [...d.guasti, ...t.guasti, ...s.guasti], nota: "email e password in vista, nessun Google · «Password dimenticata?» manda la reimpostazione, al ritorno la password due volte · il link scaduto si dice" };
    },
  },
  {
    // chiesto dal lettore: «deve sincronizzarsi anche la sezione musica, se
    // metto nuove raccolte o altro queste devo vederle anche sugli altri
    // dispositivi»
    nome: "una raccolta musicale fatta sul PC arriva da sola sul tablet, anche a sala della musica aperta",
    async fai({ browser, db }) {
      const pc = await dispositivo(browser, { sessione: true });
      const tab = await dispositivo(browser, { sessione: true });
      const nomiRaccolte = () => (db.prefs()?.music_lists || []).filter((r) => !r.deleted).map((r) => r.name);
      await pc.p.goto(`${URL_APP}?apri=musica`);
      await tab.p.goto(`${URL_APP}?apri=musica`);
      // il primo giro di tutt'e due e' passato: da qui in poi conta solo la mano
      await aspetta(4000);
      await pc.p.getByRole("button", { name: "＋ Aggiungi" }).click();
      await pc.p.getByRole("button", { name: "＋ Da YouTube" }).click();
      await pc.p.getByPlaceholder("Incolla un link YouTube (video o playlist)…").fill("https://www.youtube.com/watch?v=abcdefghijk");
      await pc.p.getByPlaceholder(/Nome/).fill("Pioggia e camino");
      await pc.p.getByRole("button", { name: "☆ Custodisci" }).click();
      await pc.p.getByRole("tab", { name: /Raccolte/ }).click();
      await pc.p.getByRole("button", { name: "＋ Nuova raccolta" }).click();
      await pc.p.getByPlaceholder(/Come la chiami/).fill("Notti d'inverno");
      await pc.p.getByRole("button", { name: "✧ Crea" }).click();
      await pc.p.getByRole("button", { name: "Pioggia e camino" }).first().click();
      await pc.p.getByRole("button", { name: "Fatto" }).first().click();
      // il PC resta li', a finestra aperta: nessun avvio, nessun ritorno
      await finche(() => nomiRaccolte().includes("Notti d'inverno"), 15000, `la raccolta non sale nel cloud (lassu': ${JSON.stringify(nomiRaccolte())})`);
      // e il tablet, con la sala gia' aperta, la vede al suo prossimo giro
      // (il ritorno nell'app), senza uscire e rientrare dalla sala
      await tab.p.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
      await finche(() => testoAvviso(tab.p, /^Notti d'inverno$/), 15000, "la raccolta non compare sul tablet");
      await finche(() => testoAvviso(tab.p, /^1 brano$/), 5000, "la raccolta arriva vuota sul tablet");
      return { guasti: [...pc.guasti, ...tab.guasti], nota: `lassu': ${nomiRaccolte().join(", ")}; sul tablet a sala aperta` };
    },
  },
  {
    // chiesto dal lettore, con le raccolte del tablet vuote sul PC: «c'è
    // modo di allineare i due dispositivi senza però usare il cloud?». I nomi
    // dei brani viaggiano, i byte no; i file portati a mano si riconoscono e
    // suonano nelle stesse raccolte, senza doppioni
    nome: "i brani del tablet arrivano sul PC coi nomi, e portati i file suonano nelle stesse raccolte",
    async fai({ browser, db }) {
      const prima = ([b64, brani]) => {
        const byte = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const file = (nome) => ({ kind: "file", getFile: async () => new File([byte], nome, { type: "" }) });
        const cartella = (voci) => ({
          kind: "directory",
          async *entries() {
            for (const [nome, v] of Object.entries(voci)) yield [nome, v === 1 ? file(nome) : v];
          },
        });
        const music = cartella({ "Horror playlist": cartella(Object.fromEntries(brani.map((b) => [b, 1]))) });
        window.showDirectoryPicker = async () => Object.assign(music, { name: "Music" });
      };
      const tab = await dispositivo(browser, { sessione: true, misura: TABLET });
      await tab.ctx.addInitScript(prima, [wav(2).toString("base64"), ["Night.wav", "Fog.wav"]]);
      // sul PC la cartella copiata dal tablet ha solo «Fog»: «Night» arriva a parte
      const pc = await dispositivo(browser, { sessione: true });
      await pc.ctx.addInitScript(prima, [wav(2).toString("base64"), ["Fog.wav"]]);
      await tab.p.goto(`${URL_APP}?apri=musica`);
      await tab.p.getByRole("button", { name: "＋ Aggiungi" }).click();
      await tab.p.getByRole("button", { name: "📁 Da una cartella" }).click();
      await finche(() => tab.p.getByText(/📁 Dalla cartella «Music»/).count(), 15000, "la cartella non diventa una raccolta sul tablet");
      const lassu = () => (db.prefs()?.music_favs || []).filter((f) => f.trackId && !f.deleted);
      await finche(() => lassu().length === 2, 15000, `i brani da file non salgono (lassu': ${lassu().length})`);
      if (lassu().some((f) => f.track || f.blob)) throw new Error("con i nomi sono saliti anche i byte");

      await pc.p.goto(`${URL_APP}?apri=musica`);
      await finche(() => pc.p.getByText(/2 brani stanno su un altro dispositivo/).count(), 15000, "sul PC l'avviso dei brani del tablet non compare");
      await finche(() => testoAvviso(pc.p, /^2 brani · non qui$/), 5000, "la raccolta sul PC non dice che i brani non sono qui");
      // niente da suonare qui, e lo dice invece di tacere
      await pc.p.getByRole("button", { name: "Suona Horror playlist" }).click();
      await finche(() => pc.p.getByText(/Nessuno di questi brani è su questo dispositivo/).count(), 8000, "la raccolta senza byte non dice perché non suona");

      // portati i file (col cavo, con Quick Share): li si sceglie dall'avviso.
      // Prima uno solo: la raccolta salta quello che manca e suona l'altro
      const porta = async (nomi) => {
        const [scelta] = await Promise.all([pc.p.waitForEvent("filechooser"), pc.p.getByRole("button", { name: "♫ Scegli i file" }).click()]);
        await scelta.setFiles(nomi.map((name) => ({ name, mimeType: "audio/wav", buffer: wav(2) })));
      };
      await porta(["Night.wav"]);
      await finche(() => pc.p.getByText(/«Night» ora suona anche qui/).count(), 15000, "il file portato non si riconosce");
      await finche(() => testoAvviso(pc.p, /^2 brani · 1 non qui$/), 5000, "la raccolta non dice che ne manca uno solo");
      await pc.p.getByRole("button", { name: "Suona Horror playlist" }).click();
      await finche(() => testoAvviso(pc.p, /^2 brani · 1 non qui · ♫ in ascolto$/), 8000, "la raccolta si ferma sul brano che manca invece di suonare quello che c'e'");
      // poi la cartella copiata dal tablet: le sue raccolte restano quelle
      await pc.p.getByRole("button", { name: "📁 Scegli la cartella" }).click();
      await finche(() => pc.p.getByText(/1 brano dell'altro dispositivo ora suona anche qui/).count(), 15000, "il brano della cartella portata non si riconosce");
      await finche(async () => !(await pc.p.getByText(/su un altro dispositivo/).count()), 5000, "portati i file, l'avviso resta");
      await finche(() => testoAvviso(pc.p, /^2 brani · ♫ in ascolto$/), 5000, "la raccolta dice ancora che dei brani non sono qui");
      const qui = await pc.p.evaluate(() => ({
        melodie: JSON.parse(localStorage.getItem("bc_music_favs") || "[]").filter((f) => !f.deleted).map((f) => f.id).sort(),
        brani: JSON.parse(localStorage.getItem("bc_music_lists") || "[]").filter((r) => !r.deleted).map((r) => [...r.brani].sort()),
      }));
      const delTablet = lassu().map((f) => f.id).sort();
      if (JSON.stringify(qui.melodie) !== JSON.stringify(delTablet)) throw new Error(`doppioni sul PC: ${JSON.stringify(qui.melodie)} contro ${JSON.stringify(delTablet)}`);
      if (JSON.stringify(qui.brani) !== JSON.stringify([delTablet])) throw new Error(`la raccolta sul PC non e' quella del tablet: ${JSON.stringify(qui.brani)}`);
      return { guasti: [...tab.guasti, ...pc.guasti], nota: `${delTablet.length} brani: nomi lassu', byte sul PC sotto la loro chiave` };
    },
  },
  {
    // segnalato dal lettore con la sala del tablet: «65 brani · 32 non qui»,
    // e la raccolta aperta in due giri alfabetici, il secondo tutto «non è su
    // questo dispositivo». La stessa cartella importata su tutt'e due i
    // dispositivi quando i brani non viaggiavano ancora: ogni canzone due
    // volte. Quella storia l'app di oggi non la rifà (adotta i brani
    // dell'altro), quindi lo stato si posa com'era: le voci di tutt'e due,
    // la raccolta con tutt'e quattro, i byte di ognuno sul suo dispositivo
    nome: "i brani doppi (la stessa cartella importata su tablet e PC) si uniscono, e sul PC i file passano alla copia tenuta",
    async fai({ browser, db }) {
      const peso = wav(2).length;
      const voce = (id, name, trackId, addedAt) => ({ id, name, file: `${name}.wav`, trackId, mime: "audio/wav", size: peso, addedAt, updatedAt: addedAt });
      const favs = [voce("t1", "Honour", "kt1", 1000), voce("t2", "Horizon", "kt2", 1001), voce("p1", "Honour", "kp1", 2000), voce("p2", "Horizon", "kp2", 2001)];
      // e una raccolta fatta sul PC con la sola copia del PC
      const liste = [
        { id: "r1", name: "Horror playlist", brani: ["t1", "t2", "p1", "p2"], addedAt: 1000, updatedAt: 2001 },
        { id: "r2", name: "Battaglie", brani: ["p1"], addedAt: 2000, updatedAt: 2002 },
      ];
      const posa = ([f, l]) => {
        if (localStorage.getItem("bc_music_favs")) return;
        localStorage.setItem("bc_music_favs", JSON.stringify(f));
        localStorage.setItem("bc_music_lists", JSON.stringify(l));
      };
      const byte = (p, chiavi) =>
        p.evaluate(
          ([b64, chiavi]) =>
            new Promise((ok, ko) => {
              const req = indexedDB.open("bc_library", 3);
              req.onupgradeneeded = () => {
                for (const n of ["files", "covers", "aux", "tracks"]) if (!req.result.objectStoreNames.contains(n)) req.result.createObjectStore(n);
              };
              req.onerror = () => ko(req.error);
              req.onsuccess = () => {
                const tx = req.result.transaction("tracks", "readwrite");
                const dati = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
                for (const k of chiavi) tx.objectStore("tracks").put(new Blob([dati], { type: "audio/wav" }), k);
                tx.oncomplete = () => (req.result.close(), ok());
                tx.onerror = () => ko(tx.error);
              };
            }),
          [wav(2).toString("base64"), chiavi]
        );
      const chiaviQui = (p) =>
        p.evaluate(
          () =>
            new Promise((ok) => {
              const req = indexedDB.open("bc_library", 3);
              req.onsuccess = () => {
                const r = req.result.transaction("tracks").objectStore("tracks").getAllKeys();
                r.onsuccess = () => (req.result.close(), ok(r.result.map(String).sort().join()));
              };
            })
        );

      const tab = await dispositivo(browser, { sessione: true, misura: TABLET });
      await tab.ctx.addInitScript(posa, [favs, liste]);
      await tab.p.goto(`${URL_APP}?apri=ingresso`);
      await byte(tab.p, ["kt1", "kt2"]);
      await tab.p.goto(`${URL_APP}?apri=musica`);
      await finche(() => testoAvviso(tab.p, /^4 brani · 2 non qui$/), 10000, "la raccolta del tablet non dice i suoi doppioni come «non qui»");
      await finche(() => tab.p.getByText(/2 brani ci sono due volte/).count(), 5000, "l'avviso dei doppioni non compare");
      await tab.p.getByRole("button", { name: "Guarda i doppioni" }).click();
      await finche(async () => (await tab.p.getByText(/2 copie, 1 qui/).count()) === 2, 5000, "l'elenco dei doppioni non dice le copie");
      await tab.p.getByRole("button", { name: "Unisci i 2 doppioni" }).click();
      await finche(() => testoAvviso(tab.p, /^2 brani$/), 8000, "unita, la raccolta dice ancora dei brani non qui");
      if (await tab.p.getByText(/ci sono due volte/).count()) throw new Error("unita, l'avviso dei doppioni resta");
      await finche(() => testoAvviso(tab.p, /^1 brano$/), 5000, "la raccolta che aveva solo la copia tolta perde la canzone");
      if ((await chiaviQui(tab.p)) !== "kt1,kt2") throw new Error(`sul tablet i file della SD non sono quelli: ${await chiaviQui(tab.p)}`);
      const lapidi = () => (db.prefs()?.music_favs || []).filter((f) => f.deleted && f.unito).map((f) => `${f.id}>${f.unito}`).sort().join();
      await finche(() => lapidi() === "p1>t1,p2>t2", 15000, `l'unione non sale (lassu': ${lapidi()})`);

      // il PC: le sue copie hanno i byte qui, e l'unione arriva col giro
      const pc = await dispositivo(browser, { sessione: true });
      await pc.ctx.addInitScript(posa, [favs, liste]);
      await pc.p.goto(`${URL_APP}?apri=ingresso`);
      await byte(pc.p, ["kp1", "kp2"]);
      await pc.p.goto(`${URL_APP}?apri=musica`);
      await finche(async () => (await chiaviQui(pc.p)) === "kt1,kt2", 15000, `sul PC i file non passano alla copia tenuta (chiavi: ${await chiaviQui(pc.p)})`);
      await finche(() => testoAvviso(pc.p, /^2 brani$/), 8000, "sul PC la raccolta non è quella unita");
      await pc.p.getByRole("button", { name: "Suona Horror playlist" }).click();
      await finche(() => testoAvviso(pc.p, /^2 brani · ♫ in ascolto$/), 8000, "sul PC la raccolta unita non suona");
      // un PC che ha ricevuto l'unione ma si e' fermato prima di spostare i
      // byte (l'app chiusa a meta'): la sala lo riprende, senza account
      const unite = await tab.p.evaluate(() => [JSON.parse(localStorage.getItem("bc_music_favs")), JSON.parse(localStorage.getItem("bc_music_lists"))]);
      const fermo = await dispositivo(browser);
      await fermo.ctx.addInitScript(posa, unite);
      await fermo.p.goto(`${URL_APP}?apri=ingresso`);
      await byte(fermo.p, ["kp1", "kp2"]);
      await fermo.p.goto(`${URL_APP}?apri=musica`);
      await finche(async () => (await chiaviQui(fermo.p)) === "kt1,kt2", 10000, `il trasloco interrotto non riprende nella sala (chiavi: ${await chiaviQui(fermo.p)})`);
      await finche(() => testoAvviso(fermo.p, /^2 brani$/), 8000, "ripreso il trasloco, la raccolta dice ancora dei brani non qui");
      return { guasti: [...tab.guasti, ...pc.guasti, ...fermo.guasti], nota: "4 voci e 2 canzoni: unite sul tablet, sul PC i byte sotto le chiavi tenute, e un trasloco interrotto riprende" };
    },
  },
  {
    // chiesto dal lettore: «un mini player fatto come si deve, come se
    // avessi YouTube o Spotify»
    nome: "il lettore della musica va avanti, torna indietro, salta nel brano e suona il prossimo scelto",
    async fai({ browser }) {
      const d = await dispositivo(browser);
      const t = () => d.p.evaluate(() => document.querySelector("audio")?.currentTime ?? -1);
      const dove = (n) => finche(() => testoAvviso(d.p, new RegExp(`Le tue melodie · ${n} di 3`)), 8000, `non si arriva al brano ${n} di 3`);
      await d.p.goto(`${URL_APP}?apri=musica`);
      await d.p.getByRole("button", { name: "＋ Aggiungi" }).click();
      // «▶ Tutti» suona nell'ordine dei nomi
      for (const nome of ["Arpa", "Camino", "Pioggia"]) await d.p.setInputFiles('input[accept="audio/*"]', { name: `${nome}.wav`, mimeType: "audio/wav", buffer: wav(200) });
      await finche(() => d.p.getByText("Pioggia", { exact: true }).count(), 10000, "le melodie non entrano");
      await d.p.getByRole("button", { name: "▶ Tutti", exact: true }).click();
      await finche(async () => (await t()) > 0.3, 10000, "non suona");

      // la barretta fuori dalla sala: ⏭, poi ⏮ subito (brano prima)
      await d.p.getByRole("button", { name: "Ingresso" }).first().click();
      await d.p.getByRole("button", { name: "Brano dopo" }).click();
      await dove(2);
      await d.p.getByRole("button", { name: "Brano prima" }).click();
      await dove(1);
      // ⏮ a brano avviato riavvolge e resta li'
      await d.p.evaluate(() => (document.querySelector("audio").currentTime = 30));
      await d.p.getByRole("button", { name: "Brano prima" }).click();
      await aspetta(400);
      const riavvolto = await t();
      if (riavvolto > 3) throw new Error(`«⏮» a brano avviato non riavvolge: ${riavvolto.toFixed(1)} s`);
      await dove(1);

      // nella sala: la barra si tocca a meta' brano, e «Prossimi» suona il brano scelto
      await d.p.getByRole("button", { name: "Musica" }).first().click();
      const barra = d.p.getByRole("slider", { name: "Punto del brano" });
      await finche(async () => Number(await barra.getAttribute("aria-valuemax")) > 100, 8000, "la barra non conosce la durata");
      const r = await barra.boundingBox();
      await d.p.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
      await aspetta(400);
      const meta = await t();
      if (Math.abs(meta - 100) > 12) throw new Error(`toccata a meta' la barra, il brano e' a ${meta.toFixed(1)} s invece di ~100`);
      await d.p.getByRole("button", { name: "Pioggia" }).first().click();
      await dove(3);
      // il timer e' un tasto solo: le durate si aprono da lui, e scelta una
      // il tasto dice quanto manca. La durata si cerca col nome ESATTO: il
      // tasto del timer diventa «🌙 15 min», e un nome cercato come pezzo
      // trovava lui, a menu gia' chiuso, ogni volta che il conto arrivava
      // prima del controllo
      const durata = () => d.p.getByRole("button", { name: "15 min", exact: true });
      if (await durata().count()) throw new Error("le durate del timer stanno in vista");
      await d.p.getByRole("button", { name: "🌙 Timer" }).click();
      await durata().click();
      await finche(async () => !(await durata().count()), 3000, "scelta la durata, le durate restano aperte");
      const orologio = await finche(() => d.p.getByRole("button", { name: /^🌙 \d/ }).textContent().catch(() => null), 3000, "il tasto del timer non dice quanto manca");
      // e un link YouTube si suona dal riquadro di «＋ Da YouTube», dentro «＋ Aggiungi»
      await d.p.getByRole("button", { name: "＋ Aggiungi" }).click();
      await d.p.getByRole("button", { name: "＋ Da YouTube" }).click();
      if (!(await d.p.getByRole("button", { name: "▶ Suona ora" }).isVisible())) throw new Error("nel riquadro di YouTube manca «▶ Suona ora»");
      return { guasti: d.guasti, nota: `⏭ ⏮ e il riavvolgimento (${riavvolto.toFixed(1)} s), barra a ${meta.toFixed(0)} s, «Pioggia» dai prossimi, timer «${orologio.trim()}»` };
    },
  },
  {
    // chiesto dal lettore: l'Oracolo anche per fumetti e manga, «dalli tutti
    // e 3». L'API di Anthropic e' finta: risponde e annota cosa le arriva
    nome: "l'Oracolo guarda le tavole di un fumetto: la tavola a schermo, dove eravamo, chi e' il personaggio toccato",
    async fai({ browser }) {
      const chieste = [];
      const oracolo = async (corpo) => {
        chieste.push(corpo);
        return { content: [{ type: "text", text: `Risposta finta ${chieste.length}` }], usage: { input_tokens: 1000, output_tokens: 20 }, stop_reason: "end_turn" };
      };
      const d = await dispositivo(browser, { oracolo, prima: () => localStorage.setItem("bc_ai_key", "sk-finta") });
      await importa(d.p, "Il segreto di Arcadia.cbz", await fumettoLungo(30), "application/zip");
      await d.p.getByText("Il segreto di Arcadia").first().click();
      await d.p.getByRole("button", { name: /Apri il libro|Comincia/ }).first().click();
      const vista = () =>
        d.p.evaluate(() => {
          const ims = [...document.querySelectorAll("img[data-pagina]")].filter((x) => getComputedStyle(x.closest("[style]")).opacity !== "0.01" && !x.closest("[data-dopo]") && !x.hasAttribute("data-dopo") && !x.hasAttribute("data-via"));
          if (!ims.length || ims.some((im) => !im.complete || !im.naturalWidth)) return [];
          return ims.map((x) => Number(x.dataset.pagina));
        });
      await finche(async () => (await vista()).length, 20000, "il fumetto non si apre");
      for (let i = 0; i < 20 && !(await vista()).includes(14); i++) {
        const prima = (await vista()).join();
        await d.p.keyboard.press("ArrowRight");
        await finche(async () => (await vista()).join() !== prima && (await vista()).length, 8000, "la voltata non arriva");
      }
      const aSchermo = await vista();
      if (!aSchermo.includes(14)) throw new Error(`non si arriva a pagina 14 (${aSchermo})`);
      const fino = Math.max(...aSchermo);
      const immagini = (c) => c.messages[0].content.filter((b) => b.type === "image").length;
      const pagineDette = (c) => c.messages[0].content.filter((b) => b.type === "text").flatMap((b) => [...b.text.matchAll(/[Pp]agin[ae] (\d+)/g)].map((m) => Number(m[1])));
      const senzaTitolo = (c) => {
        if (/Arcadia/.test(JSON.stringify(c))) throw new Error("il titolo e' arrivato al modello");
      };

      // 1. la tavola a schermo
      // le tre domande stanno nel menu di un tasto solo
      const domanda = async (nome) => {
        await d.p.getByRole("button", { name: "Oracolo", exact: true }).click();
        await d.p.getByRole("menuitem", { name: nome }).click();
      };
      await domanda(/Cosa succede/);
      await finche(() => testoAvviso(d.p, /Risposta finta 1/), 10000, "la risposta sulla tavola non compare");
      if (immagini(chieste[0]) !== aSchermo.length) throw new Error(`la tavola manda ${immagini(chieste[0])} immagini, a schermo ${aSchermo.length}`);
      senzaTitolo(chieste[0]);

      // 2. dove eravamo: mai oltre la pagina a cui sei
      await d.p.getByRole("button", { name: "Chiudi il pannello" }).click();
      await domanda(/Dove eravamo/);
      await finche(() => testoAvviso(d.p, /Risposta finta 2/), 10000, "il riassunto non compare");
      const viste = pagineDette(chieste[1]);
      if (viste.some((n) => n > fino)) throw new Error(`il riassunto ha visto pagine dopo la ${fino}: ${viste}`);
      if (immagini(chieste[1]) > 10 || !viste.includes(fino)) throw new Error(`riassunto: ${immagini(chieste[1])} immagini, pagine ${viste}`);
      senzaTitolo(chieste[1]);

      // 3. chi e': si tocca il personaggio sulla tavola
      await d.p.getByRole("button", { name: "Chiudi il pannello" }).click();
      await domanda(/Chi è costui/);
      await finche(() => testoAvviso(d.p, /Tocca il personaggio/), 5000, "non chiede di toccare il personaggio");
      const tavola = d.p.locator(`img[data-pagina="${aSchermo[0]}"]`).first();
      const r = await tavola.boundingBox();
      await d.p.mouse.click(r.x + r.width / 2, r.y + r.height / 3);
      await finche(() => testoAvviso(d.p, /Risposta finta 3/), 10000, "la scheda del personaggio non compare");
      const chi = pagineDette(chieste[2]);
      if (chi.at(-1) !== aSchermo[0] || chi.slice(0, -1).some((n) => n >= aSchermo[0])) throw new Error(`chi e': pagine ${chi}, toccata la ${aSchermo[0]}`);
      senzaTitolo(chieste[2]);
      // la tavola cerchiata ha davvero il cerchio rosso (la pagina 14 e' azzurra)
      const ultima = chieste[2].messages[0].content.filter((b) => b.type === "image").at(-1).source.data;
      const rossi = await d.p.evaluate(async (b64) => {
        const im = new Image();
        im.src = `data:image/jpeg;base64,${b64}`;
        await im.decode();
        const c = document.createElement("canvas");
        c.width = im.naturalWidth;
        c.height = im.naturalHeight;
        const g = c.getContext("2d");
        g.drawImage(im, 0, 0);
        const px = g.getImageData(0, 0, c.width, c.height).data;
        let n = 0;
        for (let i = 0; i < px.length; i += 4) if (px[i] > 200 && px[i + 1] < 80 && px[i + 2] < 80) n++;
        return n;
      }, ultima);
      if (rossi < 20) throw new Error(`nella tavola mandata non c'e' il cerchio rosso (${rossi} pixel rossi)`);
      // 4. tradurre e' una domanda a parte: «Cosa succede» non traduce
      await d.p.getByRole("button", { name: "Chiudi il pannello" }).click();
      await domanda(/Traduci i balloon/);
      await finche(() => testoAvviso(d.p, /Risposta finta 4/), 10000, "la traduzione non compare");
      if (!/Traduci in italiano balloon/.test(chieste[3].system) || /Traduci/.test(chieste[0].system)) throw new Error("racconto e traduzione non sono due domande");
      if (immagini(chieste[3]) !== aSchermo.length) throw new Error(`la traduzione manda ${immagini(chieste[3])} immagini, a schermo ${aSchermo.length}`);
      senzaTitolo(chieste[3]);
      return { guasti: d.guasti, nota: `a schermo ${aSchermo.join("+")}: tavola ${immagini(chieste[0])} img, traduzione a parte, riassunto ${immagini(chieste[1])} img (fino a ${fino}), chi e' ${immagini(chieste[2])} img, cerchio di ${rossi} pixel` };
    },
  },
  {
    // segnalato dal lettore con una foto di Hellboy: «la disposizione non mi
    // fa proprio impazzire». Il suo tablet e' 902×1503 a densita' 1,33, a
    // dito, aperto nel browser (dal suo rapporto: non 1280×800 a densita' 1,
    // come si credeva), e li' la scrittura e' ×1,5. Con la musica accesa la
    // barra andava su tre righe nei fumetti, e su piu' ancora in ePub e PDF:
    // la musica nella riga del titolo le riporta a due
    nome: "sul tablet del lettore in verticale, con la musica accesa, le barre dei tre lettori stanno su due righe",
    async fai({ browser }) {
      const ctx = await browser.newContext({ viewport: { width: 902, height: 1503 }, screen: { width: 902, height: 1503 }, deviceScaleFactor: 1.33, hasTouch: true, isMobile: true });
      await ctx.route((u) => !/^(localhost|127\.0\.0\.1)$/.test(u.hostname), (r) => r.abort());
      const p = await ctx.newPage();
      const guasti = [];
      p.on("pageerror", (e) => guasti.push(e.message));
      await importa(p, "Il segreto di Arcadia.cbz", await fumettoLungo(6), "application/zip");
      await importa(p, "La nebbia.epub", await epub(), "application/epub+zip");
      await importa(p, "Carte.pdf", pdf(3), "application/pdf");
      await p.goto(`${URL_APP}?apri=musica`);
      await p.getByRole("button", { name: "＋ Aggiungi" }).click();
      for (const nome of ["D&D Dark Ambient Campaign Music", "Camino"]) await p.setInputFiles('input[accept="audio/*"]', { name: `${nome}.wav`, mimeType: "audio/wav", buffer: wav(200) });
      await finche(() => p.getByText("Camino", { exact: true }).count(), 10000, "le melodie non entrano");
      await p.getByRole("button", { name: "▶ Tutti", exact: true }).click();
      await finche(() => p.evaluate(() => (document.querySelector("audio")?.currentTime || 0) > 0.2), 10000, "non suona");
      // le righe della barra: i tasti si raggruppano per altezza del centro
      const misura = () =>
        p.evaluate(() => {
          const chiudi = document.querySelector('[aria-label="Chiudi il libro"]');
          if (!chiudi) return null;
          const barra = chiudi.closest("div[style*='position: absolute']");
          // la linguetta dell'ePub sporge sotto la barra: non e' una riga
          const fondo = barra.getBoundingClientRect().bottom;
          const centri = [...barra.querySelectorAll("button")].map((b) => b.getBoundingClientRect()).filter((r) => r.height && r.bottom <= fondo).map((r) => r.top + r.height / 2).sort((x, y) => x - y);
          const righe = centri.filter((c, i) => i === 0 || c - centri[i - 1] > 30).length;
          return { alta: Math.round(barra.getBoundingClientRect().height), righe, musica: !!barra.querySelector('[aria-label="Pausa musica"]') };
        });
      const note = [];
      for (const titolo of ["Il segreto di Arcadia", "La nebbia", "Carte"]) {
        await p.getByRole("button", { name: "Libreria" }).first().click();
        await p.getByText(titolo).first().click();
        await p.getByRole("button", { name: /Apri il libro|Comincia/ }).first().click();
        // a dito il libro si apre senza barre: un tocco solo, a pagina pronta,
        // le chiama (due di fila sarebbero un doppio tocco)
        if (titolo === "Il segreto di Arcadia") await finche(() => p.locator("img[data-pagina]").count(), 20000, "il fumetto non si apre");
        await aspetta(2500);
        if (!(await misura())) await p.touchscreen.tap(451, 750);
        const m = await finche(async () => {
          const x = await misura();
          return x?.musica && x;
        }, 8000, `la barra di «${titolo}» non c'e', o senza la musica`);
        if (m.righe > 2) throw new Error(`la barra di «${titolo}» va su ${m.righe} righe (${m.alta} px)`);
        note.push(`${titolo.split(" ").pop()} ${m.alta} px`);
        if (titolo === "Il segreto di Arcadia") {
          await p.getByRole("button", { name: "Oracolo", exact: true }).click();
          await finche(() => p.getByRole("menuitem", { name: /Dove eravamo/ }).count(), 3000, "il menu dell'Oracolo non si apre");
          await p.keyboard.press("Escape");
        }
        // IL PANNELLO APPESO ALLA BARRA VA E VIENE CON LEI (chiesto dal
        // lettore: «appaia e scompaia assieme all'header e non rimanga
        // appesa da sola»): la luce del fumetto, la notte del PDF
        const pannelli = {
          "Il segreto di Arcadia": [["Luce", () => p.getByText("Luminosità", { exact: true })], ["Oracolo", () => p.getByRole("menu", { name: "Chiedi all'Oracolo" })]],
          Carte: [["Notte", () => p.getByText("Filtro notte caldo", { exact: true })]],
        }[titolo] || [];
        for (const [tasto, riga] of pannelli) {
          const aperto = () => riga().count();
          await p.getByRole("button", { name: tasto, exact: true }).click();
          await finche(aperto, 3000, `il pannello «${tasto}» non si apre`);
          await p.touchscreen.tap(300, 1100);
          await finche(async () => !(await misura()) && !(await aperto()), 3000, `nascosta la barra, il pannello «${tasto}» resta appeso da solo`);
          await p.touchscreen.tap(300, 1100);
          await finche(async () => (await misura()) && (await aperto()), 3000, `tornata la barra, il pannello «${tasto}» non torna con lei`);
          await p.getByRole("button", { name: tasto, exact: true }).click();
        }
        await p.getByRole("button", { name: "Chiudi il libro" }).click();
        await finche(async () => !(await p.locator('[aria-label="Chiudi il libro"]').count()), 5000, `«${titolo}» non si chiude`);
      }
      await ctx.close();
      return { guasti, nota: `due righe: ${note.join(", ")}` };
    },
  },
  {
    // segnalato dal lettore con «Batman - Hush (2019) (digital) (Son of
    // Ultron-Empire).cbr»: «archivio non leggibile», e basta. Un 7-Zip
    // rinominato si dice per nome, e un PDF rinominato entra come PDF.
    nome: "un .cbr che non e' un fumetto dice cos'e'",
    async fai({ browser }) {
      const d = await dispositivo(browser);
      await d.p.goto(`${URL_APP}?apri=libreria`);
      const sette = Buffer.concat([Buffer.from([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c, 0, 4]), Buffer.alloc(200)]);
      await d.p.setInputFiles('input[accept^=".epub"]', { name: "Batman - Hush (2019).cbr", mimeType: "application/octet-stream", buffer: sette });
      const detto = await finche(() => testoAvviso(d.p, /Batman - Hush \(2019\)\.cbr.*7-Zip/), 20000, "il 7-Zip rinominato non dice cos'e'");
      return { guasti: d.guasti, nota: detto.slice(0, 120) };
    },
  },
  {
    // segnalato da un amico del lettore: «per la parte di caricamento libri
    // da file, mi mostra anche formati che non sono libri». Sul computer il
    // selettore filtra per estensione, e i tipi larghi (zip, octet-stream)
    // gli facevano mostrare ogni archivio; sul tablet servono, o un ePub
    // scaricato dal browser resta in grigio (il caso di Tigana)
    nome: "il selettore dei libri mostra solo libri sul computer, e sul tablet anche gli ePub scaricati",
    async fai({ browser }) {
      const accetta = async (p) => {
        await p.goto(`${URL_APP}?apri=libreria`);
        return finche(() => p.evaluate(() => document.querySelector('input[type=file][multiple][accept*=".epub"]')?.accept || ""), 15000, "l'input dei libri non c'e'");
      };
      const d = await dispositivo(browser);
      const pc = (await accetta(d.p)).split(",");
      if (pc.includes("application/octet-stream") || pc.includes("application/zip")) throw new Error(`sul computer il selettore mostra ogni archivio: ${pc.join()}`);
      if (![".epub", ".pdf", ".cbz", ".cbr"].every((x) => pc.includes(x))) throw new Error(`sul computer mancano dei libri: ${pc.join()}`);
      const ctx = await browser.newContext({
        viewport: { width: 902, height: 1503 },
        deviceScaleFactor: 1.33,
        hasTouch: true,
        isMobile: true,
        userAgent: "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36",
      });
      try {
        await ctx.route((u) => !/^(localhost|127\.0\.0\.1)$/.test(u.hostname), (r) => r.abort());
        const tablet = (await accetta(await ctx.newPage())).split(",");
        if (!tablet.includes("application/octet-stream") || !tablet.includes("application/zip")) throw new Error(`sul tablet un ePub scaricato resterebbe in grigio: ${tablet.join()}`);
        return { guasti: d.guasti, nota: `computer ${pc.length} tipi, tablet ${tablet.length}` };
      } finally {
        await ctx.close();
      }
    },
  },
  {
    // segnalato dal lettore con la foto della Manutenzione del tablet: Chrome
    // per Android ora sa scegliere una cartella, e «Copia sul disco» copiava i
    // volumi nella memoria del tablet. L'HDD della biblioteca e' del computer
    nome: "i tasti del disco stanno sul computer, non sul tablet",
    async fai({ browser }) {
      const libri = [{ id: "s3", title: "Sandman 03", saga: "The Sandman", fileType: "cbz", tipo: "fumetti", addedAt: 1 }];
      const prima = `window.showDirectoryPicker = async () => (await navigator.storage.getDirectory()).getDirectoryHandle("HDD", { create: true });
        localStorage.setItem("bc_books", ${JSON.stringify(JSON.stringify(libri))});`;
      const tasti = async (ctx) => {
        await ctx.route((u) => !/^(localhost|127\.0\.0\.1)$/.test(u.hostname), (r) => r.abort());
        await ctx.addInitScript(prima);
        const p = await ctx.newPage();
        await p.goto(`${URL_APP}?apri=libreria`);
        await p.getByRole("button", { name: /Manutenzione/ }).first().click();
        await p.waitForTimeout(1500);
        return await p.getByRole("button", { name: /Controlla il disco/ }).count();
      };
      const pcCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const tabCtx = await browser.newContext(TABLET);
      try {
        const pc = await tasti(pcCtx);
        if (!pc) throw new Error("sul computer manca «Controlla il disco»");
        const tab = await tasti(tabCtx);
        if (tab) throw new Error("sul tablet c'e' «Controlla il disco»");
        return { guasti: [], nota: `computer: controlla ${pc} · tablet: nessuno` };
      } finally {
        await pcCtx.close();
        await tabCtx.close();
      }
    },
  },
  {
    // chiesto dal lettore: «sistemami tutte le saghe che da solo non è
    // riuscito a sistemare, tipo JoJo» — i nomi sono quelli dei suoi file
    nome: "le saghe dei fumetti: JoJo con la parte, le saghe lette male si propongono e si sistemano",
    async fai({ browser }) {
      const libri = [
        { id: "s1", title: "The Sandman - The Deluxe Edition Book 02 (2021) (digital) (Son of Ultron-Empire)", saga: "The Deluxe Edition Book", fileType: "cbz", tipo: "fumetti", addedAt: 1 },
        { id: "j5", title: "JoJo's_Bizarre_Adventure_Part_5_v16_The_Requiem_Plays_Quietly", fileType: "cbz", tipo: "manga", addedAt: 2 },
        { id: "j7", title: "Volume 20 - Love Train - The World is One", fileType: "cbz", tipo: "manga", addedAt: 3 },
      ];
      const d = await dispositivo(browser, { prima: `localStorage.getItem("bc_books") || localStorage.setItem("bc_books", ${JSON.stringify(JSON.stringify(libri))});` });
      await d.p.goto(`${URL_APP}?apri=libreria`);
      // il giro automatico legge il titolo: saga e parte
      await finche(async () => (await libriDi(d.p)).find((b) => b.id === "j5")?.series === "Parte 5", 10000, "JoJo parte 5 non riconosciuto dal giro");
      await d.p.getByRole("button", { name: /Manutenzione/ }).first().click();
      // la tavola: il volume che il nome non dice
      await d.p.getByRole("button", { name: "🔖 Riconosci saghe e cicli" }).click();
      await finche(async () => (await libriDi(d.p)).find((b) => b.id === "j7")?.saga === "JoJo's Bizarre Adventure", 10000, "Love Train non è finito in JoJo");
      const j7 = (await libriDi(d.p)).find((b) => b.id === "j7");
      if (j7.series !== "Parte 7" || j7.sagaOrder !== 20) throw new Error(`Love Train: ${j7.series} n. ${j7.sagaOrder}`);
      // la saga letta male si propone, e si sistema solo spuntata
      await d.p.getByRole("button", { name: "📚 Saghe da sistemare" }).click();
      await finche(() => d.p.getByText("The Sandman · n. 2").count(), 5000, "la proposta per Sandman non si vede");
      if ((await libriDi(d.p)).find((b) => b.id === "s1").saga !== "The Deluxe Edition Book") throw new Error("la saga si è riscritta prima del tocco");
      await d.p.getByRole("button", { name: "Sistema 1" }).click();
      await finche(async () => (await libriDi(d.p)).find((b) => b.id === "s1")?.saga === "The Sandman", 5000, "Sandman non sistemato");
      return { guasti: d.guasti, nota: "JoJo 5 dal giro, JoJo 7 dalla tavola, Sandman dalla proposta" };
    },
  },
  {
    // chiesto dal lettore: la copertina di quel che sta leggendo sullo
    // schermo con l'app in secondo piano, «tipo stile Kindle». Fuori
    // dall'app il sistema mostra la scheda della musica: lì va la copertina
    nome: "con la musica accesa, la scheda del sistema mostra la copertina del libro che stai leggendo, intera",
    async fai({ browser }) {
      const libri = [{ id: "lc", title: "Il libro in mano", author: "Un'autrice", fileType: "epub", addedAt: 1 }];
      const d = await dispositivo(browser, {
        prima: `localStorage.getItem("bc_books") || (localStorage.setItem("bc_books", ${JSON.stringify(JSON.stringify(libri))}), localStorage.setItem("bc_lastopen", "lc"));`,
      });
      await d.p.goto(URL_APP);
      // una copertina vera, in piedi e rossa: la scheda la deve tenere intera
      await d.p.evaluate(
        () =>
          new Promise((ok, ko) => {
            const c = document.createElement("canvas");
            c.width = 300;
            c.height = 450;
            const g = c.getContext("2d");
            g.fillStyle = "#ff0000";
            g.fillRect(0, 0, 300, 450);
            c.toBlob((blob) => {
              const r = indexedDB.open("bc_library", 3);
              r.onsuccess = () => {
                const tx = r.result.transaction("covers", "readwrite");
                tx.objectStore("covers").put(blob, "lc");
                tx.oncomplete = ok;
                tx.onerror = () => ko(tx.error);
              };
              r.onerror = () => ko(r.error);
            }, "image/jpeg");
          })
      );
      const scheda = () =>
        d.p.evaluate(() => {
          const m = navigator.mediaSession?.metadata;
          return m ? { title: m.title, artist: m.artist, src: m.artwork?.[0]?.src || "" } : null;
        });
      if ((await scheda())?.src) throw new Error("a musica spenta la scheda ha già un'immagine");
      await d.p.goto(`${URL_APP}?apri=musica`);
      await d.p.getByRole("button", { name: "＋ Aggiungi" }).click();
      await d.p.setInputFiles('input[accept="audio/*"]', { name: "Pioggia.wav", mimeType: "audio/wav", buffer: wav(20) });
      await finche(() => d.p.getByText("Pioggia", { exact: true }).count(), 10000, "la melodia non entra");
      await d.p.getByRole("button", { name: "▶ Tutti", exact: true }).click();
      const s = await finche(async () => ((await scheda())?.src.startsWith("data:image/jpeg") ? scheda() : null), 10000, "la scheda della musica non ha la copertina");
      if (s.title !== "Pioggia") throw new Error(`il titolo della scheda è «${s.title}», non il brano`);
      if (s.artist !== "Il libro in mano — Un'autrice") throw new Error(`sotto il brano c'è «${s.artist}»`);
      // intera: rossa in mezzo, fondo scuro ai lati (una copertina ritagliata sarebbe rossa ovunque)
      const pixel = await d.p.evaluate(async (src) => {
        const img = await createImageBitmap(await (await fetch(src)).blob());
        const c = new OffscreenCanvas(img.width, img.height);
        const g = c.getContext("2d");
        g.drawImage(img, 0, 0);
        const a = (x, y) => [...g.getImageData(x, y, 1, 1).data.slice(0, 3)];
        return { lato: [img.width, img.height], mezzo: a(256, 256), lato_sx: a(10, 256) };
      }, s.src);
      if (pixel.lato.join() !== "512,512") throw new Error(`l'immagine è ${pixel.lato.join("×")}, non quadrata`);
      if (!(pixel.mezzo[0] > 200 && pixel.mezzo[1] < 60)) throw new Error(`in mezzo non c'è la copertina: ${pixel.mezzo}`);
      if (pixel.lato_sx[0] > 60) throw new Error(`ai lati la copertina è stata allargata: ${pixel.lato_sx}`);
      return { guasti: d.guasti, nota: `${s.title} · ${s.artist} · copertina ${pixel.lato.join("×")} intera` };
    },
  },
  {
    // chiesto dal lettore: «molte copertine sono proprio artistiche, averle
    // tipo salvaschermo sarebbe figo» — e chi si addormenta col libro aperto
    // non deve ritrovare il tablet acceso al mattino
    nome: "il salvaschermo: senza tocchi la copertina prende lo schermo, poi la presa si lascia, e il tocco che lo chiude non volta la pagina",
    async fai({ browser }) {
      const d = await dispositivo(browser, {
        misura: TABLET,
        // una presa finta che dice quando la si chiede e quando la si lascia
        prima: () => {
          const log = [];
          window.__presa = log;
          Object.defineProperty(navigator, "wakeLock", {
            configurable: true,
            value: {
              request: async () => {
                log.push("chiesta");
                const t = new EventTarget();
                t.release = async () => {
                  log.push("lasciata");
                  t.dispatchEvent(new Event("release"));
                };
                return t;
              },
            },
          });
        },
      });
      await d.p.goto(URL_APP);
      await importa(d.p, "La nebbia.epub", await epub({ quanti: 80 }), "application/epub+zip");
      const id = (await libriDi(d.p)).find((b) => b.title === "La nebbia").id;
      // una copertina in piedi, rossa
      await d.p.evaluate(
        (id) =>
          new Promise((ok, ko) => {
            const c = document.createElement("canvas");
            c.width = 300;
            c.height = 450;
            const g = c.getContext("2d");
            g.fillStyle = "#c01010";
            g.fillRect(0, 0, 300, 450);
            c.toBlob((blob) => {
              const r = indexedDB.open("bc_library", 3);
              r.onsuccess = () => {
                const tx = r.result.transaction("covers", "readwrite");
                tx.objectStore("covers").put(blob, id);
                tx.oncomplete = ok;
                tx.onerror = () => ko(tx.error);
              };
              r.onerror = () => ko(r.error);
            }, "image/jpeg");
          }),
        id
      );
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
      await d.p.keyboard.press("ArrowRight");
      const segno = () => d.p.evaluate((id) => localStorage.getItem(`bc_cfi_${id}`), id);
      await finche(segno, 8000, "la voltata non scrive il segno");
      await aspetta(2500);
      const prima = await segno();
      const quadro = d.p.getByRole("button", { name: /^Salvaschermo: La nebbia/ });
      // UN TOCCO DENTRO IL TESTO E' UN SEGNO DI VITA anche se non volta
      // (il lettore: «la copertina mi appare molto prima dei 3 minuti»): il
      // testo sta in un iframe, e un dito li' dentro non fa alzare un solo
      // evento qui fuori. Sei secondi alla copertina, un tocco in mezzo
      // alla pagina ogni due: la copertina non deve arrivare
      await d.p.evaluate(() => {
        localStorage.setItem("bc_salvaschermo", JSON.stringify({ copertina: 0.1, spegni: 0.05 }));
        document.dispatchEvent(new PointerEvent("pointerdown"));
      });
      for (let i = 0; i < 5; i++) {
        await aspetta(2000);
        await d.p.touchscreen.tap(451, 750);
        // si guarda fra un tocco e l'altro: un tocco sul salvaschermo lo chiuderebbe, e non si vedrebbe
        await aspetta(1500);
        if (await quadro.count()) throw new Error(`la copertina è arrivata mentre toccavo la pagina del libro (tocco ${i + 1})`);
      }
      // tempi di secondi invece che di minuti; la scelta vale al primo segno di vita
      await d.p.evaluate(() => {
        localStorage.setItem("bc_salvaschermo", JSON.stringify({ copertina: 0.05, spegni: 0.05 }));
        document.dispatchEvent(new PointerEvent("pointerdown"));
      });
      await finche(() => quadro.isVisible(), 10000, "la copertina non prende lo schermo");
      const misure = await finche(
        () => d.p.evaluate(() => {
          const img = document.querySelector('img[alt^="Copertina di La nebbia"]');
          return img?.complete && img.naturalWidth ? { w: img.naturalWidth, h: img.naturalHeight, r: img.getBoundingClientRect().height } : null;
        }),
        5000,
        "la copertina non si carica"
      );
      if (misure.r < 600) throw new Error(`la copertina è piccola: alta ${Math.round(misure.r)} px su 1503`);
      if ((await d.p.evaluate(() => window.__presa)).includes("lasciata")) throw new Error("la presa si è lasciata insieme alla copertina, non dopo");
      await finche(async () => (await d.p.evaluate(() => window.__presa)).includes("lasciata"), 10000, "la presa sullo schermo non si lascia");
      const chieste = (await d.p.evaluate(() => window.__presa)).filter((x) => x === "chiesta").length;
      // il tocco dove di solito si volta: chiude il salvaschermo, e basta
      await d.p.touchscreen.tap(Math.round(902 * 0.85), 750);
      await finche(async () => !(await quadro.count()), 3000, "il tocco non chiude il salvaschermo");
      await aspetta(1500);
      if ((await segno()) !== prima) throw new Error("il tocco che chiude il salvaschermo ha voltato la pagina");
      const dopo = (await d.p.evaluate(() => window.__presa)).filter((x) => x === "chiesta").length;
      if (dopo <= chieste) throw new Error("tornati dal salvaschermo, la presa sullo schermo non si richiede");
      return { guasti: d.guasti, nota: `copertina alta ${Math.round(misure.r)} px, presa lasciata e richiesta, pagina ferma` };
    },
  },
  {
    // «questa cosa la voglio per qualunque tipo di schermo android, tablet o
    // telefono»: la copertina intera e grande, e la riga sotto in vista, su
    // un telefono piccolo nei due versi e sul tablet del lettore nei due versi
    nome: "il salvaschermo su ogni schermo: telefono e tablet, in piedi e sdraiati, la copertina intera e la riga sotto in vista",
    async fai({ browser }) {
      const libri = [{ id: "sv", title: "Un titolo abbastanza lungo da andare a capo sul telefono", author: "Qualcuno", fileType: "epub", addedAt: 1 }];
      const d = await dispositivo(browser, {
        misura: { viewport: { width: 360, height: 800 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true },
        prima: `localStorage.getItem("bc_books") || (localStorage.setItem("bc_books", ${JSON.stringify(JSON.stringify(libri))}), localStorage.setItem("bc_lastopen", "sv"), localStorage.setItem("bc_salvaschermo", JSON.stringify({ copertina: 0.03, spegni: 0 })));`,
      });
      await d.p.goto(URL_APP);
      await d.p.evaluate(
        () =>
          new Promise((ok, ko) => {
            const c = document.createElement("canvas");
            c.width = 600;
            c.height = 900;
            c.getContext("2d").fillRect(0, 0, 600, 900);
            c.toBlob((blob) => {
              const r = indexedDB.open("bc_library", 3);
              r.onsuccess = () => {
                const tx = r.result.transaction("covers", "readwrite");
                tx.objectStore("covers").put(blob, "sv");
                tx.oncomplete = ok;
                tx.onerror = () => ko(tx.error);
              };
              r.onerror = () => ko(r.error);
            }, "image/jpeg");
          })
      );
      await d.p.goto(URL_APP);
      const quadro = d.p.getByRole("button", { name: /^Salvaschermo:/ });
      await finche(() => quadro.isVisible(), 10000, "la copertina non prende lo schermo");
      const viste = [];
      for (const [w, h] of [[360, 800], [800, 360], [902, 1503], [1503, 902]]) {
        await d.p.setViewportSize({ width: w, height: h });
        await aspetta(300);
        const m = await d.p.evaluate(() => {
          const img = document.querySelector('img[alt^="Copertina di"]');
          const riga = img?.nextElementSibling;
          if (!img?.naturalWidth || !riga) return null;
          const a = img.getBoundingClientRect();
          const b = riga.getBoundingClientRect();
          // quanto e' alta la copertina DISEGNATA dentro il riquadro (contain)
          const k = Math.min(a.width / img.naturalWidth, a.height / img.naturalHeight);
          return { img: [a.left, a.top, a.right, a.bottom], riga: [b.left, b.top, b.right, b.bottom], disegnata: [img.naturalWidth * k, img.naturalHeight * k] };
        });
        if (!m) throw new Error(`${w}×${h}: la copertina o la riga sotto non ci sono`);
        const fuori = (r) => r[0] < -1 || r[1] < -1 || r[2] > w + 1 || r[3] > h + 1;
        if (fuori(m.img)) throw new Error(`${w}×${h}: la copertina esce dallo schermo (${m.img.map(Math.round)})`);
        if (fuori(m.riga)) throw new Error(`${w}×${h}: la riga del titolo esce dallo schermo (${m.riga.map(Math.round)})`);
        // grande: tocca l'altezza o la larghezza disponibile, non un francobollo
        const [dw, dh] = m.disegnata;
        if (dh < h * 0.55 && dw < w * 0.8) throw new Error(`${w}×${h}: la copertina è piccola (${Math.round(dw)}×${Math.round(dh)})`);
        viste.push(`${w}×${h} → ${Math.round(dw)}×${Math.round(dh)}`);
      }
      return { guasti: d.guasti, nota: viste.join(", ") };
    },
  },
  {
    // chiesto dal lettore: «mi appare anche se decido di spegnere io il
    // dispositivo?» — lo sfondo della schermata di blocco lo mette il guscio
    // Android; qui si recita il guscio (il saluto con la porta) e si guarda
    // cosa la pagina gli manda
    nome: "la copertina per la schermata di blocco: il guscio saluta, la pagina la manda a pezzi, alla misura dello schermo, intera, e cambia col libro",
    async fai({ browser }) {
      const libri = [{ id: "lb", title: "Il libro di ieri", author: "Qualcuno", fileType: "epub", addedAt: 1 }];
      const d = await dispositivo(browser, {
        misura: TABLET,
        prima: `
          Object.defineProperty(document, "referrer", { configurable: true, get: () => "android-app://it.bookcompanion.app/" });
          localStorage.getItem("bc_books") || (localStorage.setItem("bc_books", ${JSON.stringify(JSON.stringify(libri))}), localStorage.setItem("bc_lastopen", "lb"));`,
      });
      const copertina = (id, colore) =>
        d.p.evaluate(
          ([id, colore]) =>
            new Promise((ok, ko) => {
              const c = document.createElement("canvas");
              c.width = 300;
              c.height = 450;
              const g = c.getContext("2d");
              g.fillStyle = colore;
              g.fillRect(0, 0, 300, 450);
              c.toBlob((blob) => {
                const r = indexedDB.open("bc_library", 3);
                r.onsuccess = () => {
                  const tx = r.result.transaction("covers", "readwrite");
                  tx.objectStore("covers").put(blob, id);
                  tx.oncomplete = ok;
                  tx.onerror = () => ko(tx.error);
                };
                r.onerror = () => ko(r.error);
              }, "image/jpeg");
            }),
          [id, colore]
        );
      await d.p.goto(URL_APP);
      await copertina("lb", "#d01010");
      await d.p.goto(URL_APP);
      // senza il saluto, le Impostazioni dicono cosa manca e non promettono niente
      await d.p.getByRole("button", { name: /^Impostazioni/ }).first().click();
      await finche(() => d.p.getByText(/serve l'app Android più recente/).count(), 5000, "senza il guscio non si dice cosa manca");
      if (await d.p.getByRole("switch", { name: /schermata di blocco/ }).count()) throw new Error("l'interruttore c'è prima del saluto");
      // il guscio saluta: una porta, come fa Chrome — e lo rifa' a ogni
      // pagina caricata, perche' la porta di prima muore con lei
      const ricevuti = () => d.p.evaluate(() => window.__ricevuti.splice(0));
      // come fa Chrome davvero (l'APK 1110 l'ha insegnato): prima la porta
      // del canale con un messaggio vuoto, poi il saluto SULLA porta
      const saluta = () =>
        d.p.evaluate(() => {
          const canale = new MessageChannel();
          window.__ricevuti = [];
          window.__porta = canale.port1;
          canale.port1.onmessage = (m) => window.__ricevuti.push(m.data);
          // l'origine com'e' davvero sul tablet: android-app:// con l'host del sito
          window.dispatchEvent(new MessageEvent("message", { data: "", origin: `android-app://${location.host}`, ports: [canale.port2] }));
          canale.port1.postMessage("grimorio:pronto");
        });
      await saluta();
      const interruttore = d.p.getByRole("switch", { name: /schermata di blocco/ });
      await finche(() => interruttore.count(), 5000, "dopo il saluto l'interruttore non compare");
      await aspetta(800);
      // al saluto la pagina risponde (o il guscio risaluta), e nient'altro parte
      const primi = await ricevuti();
      if (!primi.length || primi.some((x) => x !== "grimorio:ciao")) throw new Error(`al saluto la pagina ha mandato: ${JSON.stringify(primi)}`);
      await interruttore.click();
      const intera = async (id, dove = "") => {
        const pezzi = [];
        await finche(async () => {
          // nel mucchio c'e' anche il «ciao» al saluto: non e' un pezzo, e
          // un'esplosione qui dentro buttava via tutto il mucchio preso
          pezzi.push(...(await ricevuti()).filter((s) => s.startsWith("{")).map((s) => JSON.parse(s).sfondo));
          const miei = pezzi.filter((p) => p.id === id);
          return miei.length && miei.length === miei[0].n;
        }, 15000, `la copertina di «${id}» non arriva intera ${dove} (visti: ${pezzi.map((p) => `${p.i}/${p.n}`).join(" ")}; invio: ${await d.p.evaluate(() => sessionStorage.getItem("bc_sfondo_invio"))})`);
        const miei = pezzi.filter((p) => p.id === id).sort((a, b) => a.i - b.i);
        if (miei.some((p, i) => p.i !== i || p.n !== miei.length)) throw new Error(`pezzi storti: ${miei.map((p) => `${p.i}/${p.n}`).join()}`);
        return miei.map((p) => p.dati).join("");
      };
      const b64 = await intera("lb");
      const m = await d.p.evaluate(async (b64) => {
        const img = await createImageBitmap(await (await fetch(`data:image/jpeg;base64,${b64}`)).blob());
        const c = new OffscreenCanvas(img.width, img.height);
        const g = c.getContext("2d");
        g.drawImage(img, 0, 0);
        const a = (x, y) => [...g.getImageData(x, y, 1, 1).data.slice(0, 3)];
        const attesa = { w: Math.round(Math.min(screen.width, screen.height) * devicePixelRatio), h: Math.round(Math.max(screen.width, screen.height) * devicePixelRatio) };
        return { lato: [img.width, img.height], attesa: [attesa.w, attesa.h], mezzo: a(Math.round(img.width / 2), Math.round(img.height / 2)), alto: a(Math.round(img.width / 2), 5) };
      }, b64);
      if (m.lato.join() !== m.attesa.join()) throw new Error(`lo sfondo è ${m.lato.join("×")}, lo schermo ${m.attesa.join("×")}`);
      if (!(m.mezzo[0] > 180 && m.mezzo[1] < 60)) throw new Error(`in mezzo non c'è la copertina: ${m.mezzo}`);
      if (m.alto[0] > 60) throw new Error(`in alto la copertina è stata ritagliata invece che messa intera: ${m.alto}`);
      // la risposta del guscio: la prima volta si dice, un guasto sempre
      await d.p.evaluate(() => window.__porta.postMessage("grimorio:sfondo:ok"));
      await finche(() => testoAvviso(d.p, /La copertina è sulla schermata di blocco/), 5000, "l'ok del guscio non si dice");
      await d.p.evaluate(() => window.__porta.postMessage("grimorio:sfondo:errore:non permesso qui"));
      await finche(() => testoAvviso(d.p, /non è andata sulla schermata di blocco: non permesso qui/), 5000, "il guasto del guscio non si dice");
      // e le Impostazioni dicono l'ultima mandata e cosa ne ha detto il
      // guscio: sul tablet la schermata di blocco mostrava il libro di prima
      await finche(() => d.p.getByText(/Ultima copertina mandata: «Il libro di ieri».*guasto: non permesso qui/).count(), 5000, "l'ultimo invio e la sua risposta non si dicono");
      // IL GUSCIO RISALUTA (la scheda torna davanti) e la pagina non
      // rimanda una copertina che aveva avuto l'ok: ce l'ha gia'
      await d.p.evaluate(() => window.__porta.postMessage("grimorio:sfondo:ok"));
      await d.p.evaluate(() => window.__porta.postMessage("grimorio:pronto"));
      await aspetta(1500);
      const dopoIlSaluto = await ricevuti();
      if (dopoIlSaluto.some((x) => x !== "grimorio:ciao")) throw new Error(`al risaluto la pagina ha rimandato una copertina gia' messa: ${dopoIlSaluto.length} messaggi`);
      if (!dopoIlSaluto.includes("grimorio:ciao")) throw new Error("al risaluto la pagina non risponde");
      // SPEGNENDO SI TOGLIE (il lettore: «ho bloccato la feature e vedo ancora
      // Asterix»): la pagina lo chiede al guscio, e la risposta si dice
      await interruttore.click();
      await finche(async () => (await ricevuti()).includes("grimorio:sfondo:togli"), 5000, "spento l'interruttore, la pagina non chiede di togliere lo sfondo");
      await d.p.evaluate(() => window.__porta.postMessage("grimorio:sfondo:rimesso"));
      await finche(() => testoAvviso(d.p, /tornata allo sfondo di prima/), 5000, "lo sfondo rimesso non si dice");
      await finche(() => d.p.getByText(/Sfondo rimesso alle .* quello di prima/).count(), 5000, "sotto l'interruttore spento non si legge che lo sfondo e' stato rimesso");
      // e riacceso, la copertina riparte da capo
      await interruttore.click();
      await intera("lb", "riacceso l'interruttore");
      // e un altro libro in mano manda la sua — GRANDE, dal file: la
      // copertina salvata e' da 800 pixel e a 2000 arrivava morbida («riesci
      // a rendermi l'immagine full HD?»). Righe blu da 4 pixel: ingrandite
      // da 800 si sciolgono, dal file restano righe
      await d.p.keyboard.press("Escape").catch(() => {});
      await importa(d.p, "La nebbia.epub", await epub({ quanti: 20, copertina: pngRighe(1200, 1800, 4, [16, 64, 208], [0, 0, 40]) }), "application/epub+zip");
      const nuovo = (await libriDi(d.p)).find((b) => b.title === "La nebbia").id;
      await copertina(nuovo, "#1040d0");
      await saluta();
      await d.p.getByText("La nebbia").first().click();
      await d.p.getByRole("button", { name: /Apri il libro|Comincia/ }).first().click();
      const b2 = await intera(nuovo, "aperto l'altro libro");
      const blu = await d.p.evaluate(async (b64) => {
        const img = await createImageBitmap(await (await fetch(`data:image/jpeg;base64,${b64}`)).blob());
        const c = new OffscreenCanvas(img.width, img.height);
        const g = c.getContext("2d");
        g.drawImage(img, 0, 0);
        const x = Math.round(img.width / 2);
        const y0 = Math.round(img.height / 2);
        const col = [];
        for (let y = y0 - 30; y < y0 + 30; y++) col.push([...g.getImageData(x, y, 1, 1).data.slice(0, 3)]);
        return { maxB: Math.max(...col.map((p) => p[2])), minB: Math.min(...col.map((p) => p[2])), maxR: Math.max(...col.map((p) => p[0])) };
      }, b2);
      if (!(blu.maxB > 150 && blu.maxR < 80)) throw new Error(`aperto l'altro libro, lo sfondo non è la sua copertina: ${JSON.stringify(blu)}`);
      if (blu.maxB - blu.minB < 100) throw new Error(`la copertina è arrivata morbida: le righe da 4 pixel si sono sciolte (contrasto ${blu.maxB - blu.minB}), cioe' e' quella salvata da 800 e non quella del file`);
      // UNA PORTA NUOVA (la sessione di Chrome e' cambiata) mentre quella
      // copertina non ha avuto l'ok: si rimanda, perche' la porta di prima
      // era morta — e' il caso del tablet, che mostrava il libro di prima
      await saluta();
      await intera(nuovo, "sulla porta nuova, senza l'ok");
      // e con l'ok un altro saluto non la rimanda
      await d.p.evaluate(() => window.__porta.postMessage("grimorio:sfondo:ok"));
      await saluta();
      await aspetta(1500);
      const dopoLOk = await ricevuti();
      if (dopoLOk.some((x) => x !== "grimorio:ciao")) throw new Error(`con l'ok gia' avuto, la porta nuova ha ricevuto di nuovo la copertina: ${dopoLOk.length} messaggi`);
      // e l'indirizzo di avvio del guscio racconta l'ultimo tentativo: la
      // pagina dice fin dove e' arrivato, al posto di «serve l'app nuova»
      await d.p.goto(`${URL_APP}?guscio=1099&esito=${encodeURIComponent("l=1;k=1;n=1;u=6;s=1;c=1;r=1;v=0;p=0;a=0;f=0;e=")}`);
      await d.p.getByRole("button", { name: /^Impostazioni/ }).first().click();
      await finche(() => d.p.getByText(/L'app Android installata è la 1099/).count(), 5000, "la versione del guscio non si legge");
      if (!(await d.p.getByText(/non ha verificato l'origine/).count())) throw new Error("l'esito dell'ultimo tentativo non si dice");
      if (!(await d.p.getByText("l=1;k=1;n=1;u=6;s=1;c=1;r=1;v=0;p=0;a=0;f=0;e=").count())) throw new Error("il resoconto grezzo non si vede");
      // e una ricarica (l'aggiornamento automatico) non fa dimenticare il guscio
      await d.p.goto(URL_APP);
      await d.p.evaluate(() => { Object.defineProperty(document, "referrer", { configurable: true, get: () => "" }); });
      await d.p.getByRole("button", { name: /^Impostazioni/ }).first().click();
      await finche(() => d.p.getByText(/L'app Android installata è la 1099/).count(), 5000, "dopo una ricarica la pagina ha dimenticato il guscio");
      return { guasti: d.guasti, nota: `sfondo ${m.lato.join("×")} intero, poi quello del libro aperto; esito del guscio letto` };
    },
  },
  {
    // chiesto dal lettore: «non mi toccare quelli già presenti ma solo i
    // libri che non sono già nelle raccolte», e poi «fai lasciare stare le
    // raccolte anche al giro automatico»
    nome: "le raccolte messe a posto a mano non si toccano, né dal giro automatico né dal tasto",
    async fai({ browser }) {
      const libri = [
        { id: "a1", title: "Golden Wind 1", saga: "JoJo's Bizarre Adventure", fileType: "cbz", tipo: "manga", addedAt: 1 },
        { id: "a2", title: "Stone Ocean 1", saga: "JoJo's Bizzare Adventure", fileType: "cbz", tipo: "manga", addedAt: 2 },
        { id: "p1", title: "Guards! Guards!", author: "Terry Pratchett", saga: "Il mio Mondo Disco", fileType: "epub", addedAt: 3 },
        { id: "s1", title: "JoJo's_Bizzare_Adventure_Part_6_v05_Stone_Ocean", fileType: "cbz", tipo: "manga", addedAt: 4 },
      ];
      const d = await dispositivo(browser, { prima: `localStorage.getItem("bc_books") || localStorage.setItem("bc_books", ${JSON.stringify(JSON.stringify(libri))});` });
      await d.p.goto(`${URL_APP}?apri=libreria`);
      // il giro automatico serve lo sciolto…
      await finche(async () => (await libriDi(d.p)).find((b) => b.id === "s1")?.series === "Parte 6", 10000, "il volume sciolto non è stato riconosciuto dal giro");
      const intatte = async (quando) => {
        const ora = await libriDi(d.p);
        for (const x of libri.filter((b) => b.saga)) {
          const b = ora.find((y) => y.id === x.id);
          const fuori = ["saga", "series", "sagaOrder"].filter((k) => (b[k] ?? null) !== (x[k] ?? null));
          if (fuori.length) throw new Error(`${quando}: «${x.title}» cambiato in ${fuori.map((k) => `${k}=${JSON.stringify(b[k])}`).join(", ")}`);
        }
      };
      // …e le due grafie delle raccolte restano due
      await intatte("giro automatico");
      await d.p.getByRole("button", { name: /Manutenzione/ }).first().click();
      await d.p.getByRole("button", { name: "🔖 Riconosci saghe e cicli" }).click();
      // il giro del tasto finisce sempre con un resoconto
      await finche(() => d.p.getByText(/Erano già tutti a posto|sistemat|rinominat|dedott|lett[ei] dal|trovat/).count(), 15000, "il tasto non ha finito il giro");
      // il Mondo Disco del lettore non prende né numero né ciclo dalla tavola
      await intatte("tasto");
      const s1 = (await libriDi(d.p)).find((b) => b.id === "s1");
      return { guasti: d.guasti, nota: `raccolte intatte; sciolto in «${s1.saga}» · ${s1.series}` };
    },
  },
  {
    // chiesto dal lettore: «sistemami tutti i libri di Hellboy mettendoli
    // dentro la saga di Hellboy con l'ordine consigliato» — le schede sono
    // le sue, con le saghe e le serie che avevano
    nome: "Hellboy nell'ordine della Comics Beat: le schede si propongono e si mettono in fila",
    async fai({ browser }) {
      const libri = [
        { id: "h1", title: "v01 - Seed of Destruction", saga: "Hellboy", series: "Hellboy Omnibus", sagaOrder: 1, fileType: "cbz", tipo: "fumetti", addedAt: 1 },
        { id: "h2", title: "B.P.R.D. Omnibus v01 (2022) (digital) (Son of Ultron-Empire)", saga: "B.P.R.D", series: "B.P.R.D. Omnibus", sagaOrder: 1, fileType: "cbz", tipo: "fumetti", addedAt: 2 },
        { id: "h3", title: "Sir Edward Grey, Witchfinder Omnibus01", saga: "Hellboy", series: "Witchfinder Omnibus", sagaOrder: 1, fileType: "cbz", tipo: "fumetti", addedAt: 3 },
        { id: "h4", title: "Hellboy Omnibus - The Wild Hunt v3-522", saga: "Hellboy", sagaOrder: 3, fileType: "cbz", tipo: "fumetti", addedAt: 4 },
        // e una saga scritta che il titolo non dice resta com'e' (segnalato:
        // «Dragon Haven (trwc-2)» proposto «Trwc · n. 2»)
        { id: "dh", title: "Dragon Haven (trwc-2)", author: "Robin Hobb", saga: "The Realm of the Elderlings", series: "The Rain Wilds Chronicles", sagaOrder: 11, fileType: "epub", addedAt: 5 },
      ];
      const d = await dispositivo(browser, { prima: `localStorage.getItem("bc_books") || localStorage.setItem("bc_books", ${JSON.stringify(JSON.stringify(libri))});` });
      await d.p.goto(`${URL_APP}?apri=libreria`);
      await d.p.getByRole("button", { name: /Manutenzione/ }).first().click();
      await d.p.getByRole("button", { name: "📚 Saghe da sistemare" }).click();
      // la serie che il lettore aveva scritto resta; chi non ne ha prende quella della guida
      await finche(() => d.p.getByText("Hellboy · Witchfinder Omnibus · n. 11").count(), 5000, "la proposta per Witchfinder non si vede");
      for (const f of ["Hellboy · B.P.R.D. Omnibus · n. 5", "Hellboy · Hellboy Omnibus · n. 9"]) if (!(await d.p.getByText(f, { exact: true }).count())) throw new Error(`manca la proposta «${f}»`);
      if ((await libriDi(d.p)).find((b) => b.id === "h2").saga !== "B.P.R.D") throw new Error("la saga si è riscritta prima del tocco");
      if (await d.p.getByText(/Trwc/).count()) throw new Error("Dragon Haven proposto: la sigla del file letta come saga");
      // tre righe: l'Omnibus 1, gia' a posto, non si propone
      await d.p.getByRole("button", { name: "Sistema 3" }).click();
      const fila = async () =>
        (await libriDi(d.p))
          .filter((b) => b.saga === "Hellboy")
          .sort((a, b) => a.sagaOrder - b.sagaOrder)
          .map((b) => `${b.id}:${b.sagaOrder}:${b.series}`)
          .join();
      await finche(async () => (await fila()) === "h1:1:Hellboy Omnibus,h2:5:B.P.R.D. Omnibus,h4:9:Hellboy Omnibus,h3:11:Witchfinder Omnibus", 5000, "Hellboy non è in fila");
      return { guasti: d.guasti, nota: await fila() };
    },
  },
  {
    // segnalato dal lettore: «vedo che mancano ancora copertine» e «ci sono
    // file CBR che non mi fa mettere in CBZ» — i volumi spostati sull'HDD non
    // sono ne' qui ne' su Drive, e i due tasti non avevano niente da leggere
    nome: "i fumetti che stanno solo sul disco: le copertine si leggono dal disco, e il CBR diventa CBZ lì",
    async fai({ browser }) {
      const nomeSpawn = "Spawn Origins Collection v29 (2024) (digital) (Son of Ultron-Empire)";
      const nomeLocke = "Locke & Key v01 - Welcome to Lovecraft (2008) (Digital) (Zone-Empire)";
      const libri = [
        { id: "sp", title: nomeSpawn, saga: "Spawn Origins Collection", sagaOrder: 29, fileType: "cbr", tipo: "fumetti", fileTolto: true, addedAt: 1 },
        { id: "lk", title: nomeLocke, saga: "Locke & Key", sagaOrder: 1, fileType: "cbz", tipo: "fumetti", fileTolto: true, addedAt: 2 },
        // senza copertina e senza file: «Ritrova» ne conta tre, il disco due
        { id: "via", title: "Un fumetto perso", fileType: "cbz", tipo: "fumetti", fileTolto: true, addedAt: 3 },
      ];
      // il disco si fa lento a comando, per vedere i conti a giro in corso
      const prima = `localStorage.getItem("bc_books") || localStorage.setItem("bc_books", ${JSON.stringify(JSON.stringify(libri))});
        window.showDirectoryPicker = async () => (await navigator.storage.getDirectory()).getDirectoryHandle("HDD", { create: true });
        const getFileVero = FileSystemFileHandle.prototype.getFile;
        FileSystemFileHandle.prototype.getFile = async function () { if (window.__lento) await new Promise((ok) => setTimeout(ok, 1500)); return getFileVero.call(this); };`;
      const d = await dispositivo(browser, { prima });
      await d.p.goto(`${URL_APP}?apri=libreria`);
      const cbr = rar4([["pagina 01.png", png(60, 90, [200, 30, 30])], ["pagina 02.png", png(60, 90, [30, 200, 30])]]);
      const cbz = await fumetto();
      await d.p.evaluate(
        async ([voci]) => {
          const r = await (await navigator.storage.getDirectory()).getDirectoryHandle("HDD", { create: true });
          for (const [via, byte] of voci) {
            const pezzi = via.split("/");
            let c = r;
            for (const n of pezzi.slice(0, -1)) c = await c.getDirectoryHandle(n, { create: true });
            const w = await (await c.getFileHandle(pezzi.at(-1), { create: true })).createWritable();
            await w.write(new Uint8Array(byte));
            await w.close();
          }
        },
        // e la cartella «CBR convertiti» di quel giorno, con un CBR che il suo CBZ ce l'ha
        [[[`book-companion/Fumetti/Spawn Origins Collection/${nomeSpawn}.cbr`, [...cbr]], [`book-companion/Fumetti/Locke & Key/${nomeLocke}.cbz`, [...cbz]], ["book-companion/CBR convertiti/Fumetti/Spawn Origins Collection/Spawn Origins Collection v28.cbr", [...cbr]], ["book-companion/Fumetti/Spawn Origins Collection/Spawn Origins Collection v28.cbz", [...cbz]]]]
      );
      await d.p.getByRole("button", { name: /Manutenzione/ }).first().click();
      await d.p.getByRole("button", { name: "🔍 Controlla il disco" }).click();
      // ogni giro ha il suo conto sul suo tasto (segnalato: «perché i fermo
      // qui non corrispondono?»)
      // la cartella a parte di quel giorno si svuota (segnalato: «perché vedo
      // questa cartella in più? ogni saga ha il suo posto dove stare»)
      await d.p.getByRole("button", { name: /🗑 Svuota «CBR convertiti»: un CBR già CBZ/ }).click();
      await finche(() => testoAvviso(d.p, /Un CBR tolto da «CBR convertiti», e la cartella non c'è più/), 5000, "la cartella a parte non si svuota");
      await d.p.evaluate(() => (window.__lento = true));
      await d.p.getByRole("button", { name: "🖼 2 copertine dal disco" }).click();
      await finche(() => d.p.getByRole("button", { name: "Fermo qui (1 di 2)" }).count(), 5000, "il giro del disco non dice il suo conto");
      // e «Ritrova» non c'e': qui nessuno dei tre ha il file (segnalato sul
      // PC: «Ritrova 183 copertine» e poi «183 non sono su questo
      // dispositivo»); accanto si dice dove stanno, e il disco ha il suo tasto
      if (await d.p.getByRole("button", { name: /Ritrova/ }).count()) throw new Error("«Ritrova» promette copertine che qui non si leggono");
      await finche(() => d.p.getByText(/3 copertine che mancano non si ritrovano da qui: 2 hanno il file sul disco .*1 ha un file che non so dove sia/).count(), 5000, "la riga non dice dove stanno le copertine");
      await d.p.evaluate(() => (window.__lento = false));
      const copertine = () =>
        d.p.evaluate(
          () =>
            new Promise((ok) => {
              const q = indexedDB.open("bc_library");
              q.onsuccess = () => {
                const t = q.result.transaction("covers").objectStore("covers").getAllKeys();
                t.onsuccess = () => ok(t.result.sort().join());
              };
            })
        );
      await finche(async () => (await copertine()) === "lk,sp", 20000, "le copertine dal disco non sono arrivate");
      await d.p.evaluate(() => (window.__lento = true));
      await d.p.getByRole("button", { name: "🔁 Converti in CBZ il CBR del disco" }).click();
      await finche(() => d.p.getByText("🔁 CBR in CBZ sul disco: 1 di 1").count(), 5000, "la barra non dice il giro del disco");
      if (await d.p.getByText(/Fermo qui/).count()) throw new Error("un altro tasto ha preso il conto del disco");
      await d.p.evaluate(() => (window.__lento = false));
      const frase = await finche(() => testoAvviso(d.p, /Un CBR è diventato CBZ/), 30000, "la conversione sul disco non si dice");
      const sulDisco = await d.p.evaluate(async () => {
        const out = [];
        const giu = async (dir, via) => {
          for await (const [n, h] of dir.entries()) {
            if (h.kind === "directory") await giu(h, `${via}${n}/`);
            else out.push(`${via}${n}:${(await h.getFile()).size > 0}`);
          }
        };
        await giu(await (await navigator.storage.getDirectory()).getDirectoryHandle("HDD"), "");
        // la copia della biblioteca la guarda la scena del riordino
        return out.filter((f) => !f.startsWith("book-companion/_Copie/")).sort();
      });
      // il CBZ nella cartella della saga, il CBR andato, nessuna cartella a parte
      const attesi = [`book-companion/Fumetti/Locke & Key/${nomeLocke}.cbz:true`, "book-companion/Fumetti/Spawn Origins Collection/Spawn Origins Collection v28.cbz:true", `book-companion/Fumetti/Spawn Origins Collection/${nomeSpawn}.cbz:true`];
      if (sulDisco.join(" | ") !== attesi.join(" | ")) throw new Error(`sul disco: ${sulDisco.join(" | ")}`);
      await finche(async () => (await libriDi(d.p)).find((b) => b.id === "sp")?.fileType === "cbz", 5000, "la scheda è ancora CBR");
      if (!(await libriDi(d.p)).find((b) => b.id === "sp").fileTolto) throw new Error("la scheda non sta più sul disco");
      return { guasti: d.guasti, nota: `2 copertine dal disco · ${frase.slice(0, 70)}…` };
    },
  },
  {
    // dal rapporto del disco del lettore: la scheda col nome della copia di
    // Drive («B.P.R.D. Omnibus v02-0053») non trovava il file col nome vero
    nome: "il disco abbina la scheda col nome della copia di Drive («v02-0053») al file col nome vero",
    async fai({ browser }) {
      // e dal rapporto dopo: la copia dopo un numero in lettere, e due «The
      // Truth» che il file divide con l'autore nel nome
      const libri = [
        { id: "b2", title: "B.P.R.D. Omnibus v02-0053", saga: "Hellboy", series: "B.P.R.D. Omnibus", sagaOrder: 6, fileType: "cbz", tipo: "fumetti", fileTolto: true, addedAt: 1 },
        { id: "s4", title: "The Deluxe Edition Book Four-020", saga: "The Sandman", sagaOrder: 4, fileType: "cbz", tipo: "fumetti", fileTolto: true, addedAt: 1 },
        { id: "tt", title: "The Truth", author: "Terry Pratchett", saga: "Discworld", series: "Industrial Revolution", sagaOrder: 25, fileType: "epub", fileTolto: true, addedAt: 1 },
        { id: "ttc", title: "The Truth", author: "Ryan Cahill", saga: "The Bound and the Broken", sagaOrder: 4.5, fileType: "nessuno", fileTolto: true, addedAt: 1 },
      ];
      const prima = `localStorage.getItem("bc_books") || localStorage.setItem("bc_books", ${JSON.stringify(JSON.stringify(libri))});
        window.showDirectoryPicker = async () => (await navigator.storage.getDirectory()).getDirectoryHandle("HDD2", { create: true });`;
      const d = await dispositivo(browser, { prima });
      await d.p.goto(`${URL_APP}?apri=libreria`);
      await d.p.evaluate(async () => {
        let c = await (await navigator.storage.getDirectory()).getDirectoryHandle("HDD2", { create: true });
        const metti = async (via, peso) => {
          const pezzi = ["book-companion", ...via.split("/")];
          let d = c;
          for (const n of pezzi.slice(0, -1)) d = await d.getDirectoryHandle(n, { create: true });
          const w = await (await d.getFileHandle(pezzi.at(-1), { create: true })).createWritable();
          await w.write(new Uint8Array(peso).fill(1));
          await w.close();
        };
        await metti("Fumetti/Hellboy/B.P.R.D. Omnibus/B.P.R.D. Omnibus v02 (2022) (digital) (Son of Ultron-Empire).cbz", 900);
        await metti("Fumetti/The Sandman/The Deluxe Edition Book Four-020.cbz", 800);
        await metti("Fumetti/The Sandman/The Sandman - The Deluxe Edition Book 04 (2021) (digital) (Son of Ultron-Empire).cbz", 810);
        await metti("Libri/Discworld/The Truth - Terry Pratchett.epub", 700);
      });
      await d.p.getByRole("button", { name: /Manutenzione/ }).first().click();
      await d.p.getByRole("button", { name: "🔍 Controlla il disco" }).click();
      await finche(() => d.p.getByText(/Sul disco ci sono/).count(), 10000, "il rapporto del disco non si vede");
      const testo = await d.p.locator("body").innerText();
      const rapporto = testo.slice(testo.indexOf("Sul disco ci sono"), testo.indexOf("Sul disco ci sono") + 600);
      if (!/Sul disco ci sono 3 volumi della biblioteca/.test(rapporto) || /B\.P\.R\.D\. Omnibus v02 \(2022\)/.test(rapporto) || /nessuna scheda riconosce/.test(testo))
        throw new Error(`le schede e i file non si trovano: ${rapporto}`);
      if (!/altra edizione[^\n]*Book 04 \(2021\)[^\n]*→ The Deluxe Edition Book Four-020/.test(testo)) throw new Error(`il Book 04 (2021) non e' detto altra edizione del Book Four: ${rapporto}`);
      return { guasti: d.guasti, nota: "«v02-0053» e «v02 (2022) …» sono lo stesso volume; «Book Four-020» ha il suo file e il «Book 04 (2021)» e' un'altra edizione; The Truth va a Pratchett" };
    },
  },
  {
    // chiesto dal lettore: «ora su E:\book-companion abbiamo tutti i volumi?
    // mi hai sistemato anche dentro le cartelle i file nel modo giusto per saga?»
    nome: "il disco si controlla e si riordina: ogni volume nella cartella della sua saga, niente si copre",
    async fai({ browser }) {
      const libri = [
        { id: "j", title: "Volume 20 - Love Train", saga: "JoJo's Bizarre Adventure", series: "Parte 7", fileType: "cbz", tipo: "manga", fileTolto: true, addedAt: 1 },
        { id: "k", title: "Kagurabachi 100 (2025) (Digital) (LuCaZ)", saga: "Kagurabachi", fileType: "cbz", tipo: "manga", fileTolto: true, addedAt: 2 },
        { id: "m", title: "Mort", saga: "Discworld", fileType: "epub", addedAt: 3 },
        { id: "p", title: "Perso", fileType: "epub", addedAt: 4, fileTolto: true },
        // dal secondo rapporto del lettore: il resto del titolo sta nella
        // cartella (senza accento: l'OPFS del Chromium delle prove non crea
        // cartelle con le lettere accentate)
        { id: "e", title: "La Saga di Elric Di Melniboné", saga: "Elric Di Melnibone", fileType: "epub", addedAt: 5, fileTolto: true },
      ];
      const prima = `localStorage.getItem("bc_books") || localStorage.setItem("bc_books", ${JSON.stringify(JSON.stringify(libri))});
        window.showDirectoryPicker = async () => (await navigator.storage.getDirectory()).getDirectoryHandle("HDD", { create: true });
        window.showOpenFilePicker = async (o) => { window.__chiesto = o; throw new DOMException("annullato", "AbortError"); };`;
      const d = await dispositivo(browser, { prima });
      await d.p.goto(`${URL_APP}?apri=libreria`);
      const cbzVero = await fumetto();
      await d.p.evaluate(async (cbz) => {
        const r = await (await navigator.storage.getDirectory()).getDirectoryHandle("HDD", { create: true });
        const metti = async (via, peso) => {
          const pezzi = via.split("/");
          let c = r;
          for (const n of pezzi.slice(0, -1)) c = await c.getDirectoryHandle(n, { create: true });
          const w = await (await c.getFileHandle(pezzi.at(-1), { create: true })).createWritable();
          await w.write(new Uint8Array(peso).fill(1));
          await w.close();
        };
        await metti("book-companion/Manga/JoJo's_Bizarre_Adventure/Parte 7/Volume 20 - Love Train.cbz", 7000);
        await metti("book-companion/Manga/Kagurabachi 100 (2025) (Digital) (LuCaZ).cbz", 1000);
        await metti("book-companion/Libri/Discworld/Mort.epub", 500);
        await metti("book-companion/Fumetti/Sconosciuto.cbz", 50);
        await metti("book-companion/Libri/Elric Di Melnibone/Elric. La saga (Michael Moorcock).epub", 300);
        // un'altra edizione di Mort: non e' «senza scheda»
        await metti("book-companion/Libri/Discworld/Mort - Terry Pratchett.epub", 600);
        // un fumetto vero che nessuna scheda conosce: si aggiunge dal disco
        const w = await (await (await (await r.getDirectoryHandle("book-companion")).getDirectoryHandle("Fumetti", { create: true })).getFileHandle("Locke & Key v01 - Welcome to Lovecraft (2008).cbz", { create: true })).createWritable();
        await w.write(new Uint8Array(cbz));
        await w.close();
      }, [...cbzVero]);
      await d.p.getByRole("button", { name: /Manutenzione/ }).first().click();
      await d.p.getByRole("button", { name: "🔍 Controlla il disco" }).click();
      await finche(() => d.p.getByText(/Sul disco ci sono 4 volumi della biblioteca/).count(), 10000, "il rapporto del disco non si vede");
      const testo = await d.p.locator("body").innerText();
      for (const atteso of ["2 non stanno nella cartella della loro saga", "Manga / JoJo's_Bizarre_Adventure / Parte 7 → Manga / JoJo's Bizarre Adventure / Parte 7", "Manga → Manga / Kagurabachi", "senza il file da nessuna parte: Perso", "Fumetti / Sconosciuto.cbz", "Un file è un'altra edizione di volumi che hanno già il loro file (restano dove sono): Libri / Discworld / Mort - Terry Pratchett.epub → Mort"])
        if (!testo.includes(atteso)) throw new Error(`nel rapporto manca «${atteso}»`);
      if (/Elric\. La saga/.test(testo)) throw new Error("il file di Elric resta senza scheda");
      // Mort è sul disco ma la scheda non lo sapeva: si segna
      await d.p.getByRole("button", { name: "📦 Segna 1 come sul disco" }).click();
      await finche(async () => (await libriDi(d.p)).find((b) => b.id === "m")?.fileTolto === true, 5000, "Mort non è segnato come sul disco");
      // il rapporto intero si copia (il pannello taglia le liste lunghe)
      await d.ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: URL_APP });
      await d.p.getByRole("button", { name: "📋 Copia il rapporto" }).click();
      await finche(async () => /senza file da nessuna parte \(1\):\n  - Perso/.test(await d.p.evaluate(() => navigator.clipboard.readText())), 5000, "il rapporto copiato non c'è");
      // una riga si toglie: quel file resta dov'è
      await d.p.locator("li button", { hasText: "Kagurabachi 100" }).click();
      await d.p.getByRole("button", { name: "🗂 Riordina 1" }).click();
      const frase = await finche(() => testoAvviso(d.p, /Un volume nella cartella della sua saga/), 10000, "il riordino non si dice");
      const sulDiscoTutto = await d.p.evaluate(async () => {
        const out = [];
        const giu = async (dir, via) => {
          for await (const [n, h] of dir.entries()) {
            if (h.kind === "directory") await giu(h, `${via}${n}/`);
            else out.push(`${via}${n}:${(await h.getFile()).size}`);
          }
        };
        await giu(await (await navigator.storage.getDirectory()).getDirectoryHandle("HDD"), "");
        return out.sort().join(" ");
      });
      // la copia della biblioteca, accanto ai libri e detta nel rapporto
      const copia = sulDiscoTutto.split(" ").filter((f) => f.startsWith("book-companion/_Copie/"));
      if (copia.length !== 1 || !/^book-companion\/_Copie\/biblioteca-\d{4}-\d{2}-\d{2}\.zip:[1-9]\d+$/.test(copia[0])) throw new Error(`la copia della biblioteca sul disco: ${copia.join(" ") || "nessuna"}`);
      if (!testo.includes("📦 Copia della biblioteca scritta sul disco: «_Copie/biblioteca-")) throw new Error("il rapporto non dice della copia");
      // e vale per il promemoria «Non hai mai fatto un archivio»
      if (!(await d.p.evaluate(() => localStorage.getItem("bc_last_export")))) throw new Error("la copia sul disco non conta come archivio");
      const sulDisco = sulDiscoTutto.split(" ").filter((f) => !f.startsWith("book-companion/_Copie/")).join(" ");
      const atteso = `book-companion/Fumetti/Locke & Key v01 - Welcome to Lovecraft (2008).cbz:${cbzVero.length} book-companion/Fumetti/Sconosciuto.cbz:50 book-companion/Libri/Discworld/Mort - Terry Pratchett.epub:600 book-companion/Libri/Discworld/Mort.epub:500 book-companion/Libri/Elric Di Melnibone/Elric. La saga (Michael Moorcock).epub:300 book-companion/Manga/JoJo's Bizarre Adventure/Parte 7/Volume 20 - Love Train.cbz:7000 book-companion/Manga/Kagurabachi 100 (2025) (Digital) (LuCaZ).cbz:1000`;
      if (sulDisco !== atteso) throw new Error(`sul disco: ${sulDisco}`);
      // il fumetto che nessuna scheda conosce entra in biblioteca dal disco:
      // la scheda sola, già sul disco, niente byte nel browser
      await d.p.getByRole("button", { name: "🔍 Controlla il disco" }).click();
      await d.p.getByRole("button", { name: "📥 Aggiungili alla biblioteca (solo dal disco)" }).click();
      const locke = await finche(async () => (await libriDi(d.p)).find((b) => /^Locke & Key v01/.test(b.title)), 15000, "Locke & Key non entra in biblioteca");
      if (locke.fileTolto !== true || locke.tipo !== "fumetti" || locke.saga !== "Locke & Key") throw new Error(`la scheda dal disco: ${JSON.stringify({ fileTolto: locke.fileTolto, tipo: locke.tipo, saga: locke.saga })}`);
      const byteQui = await d.p.evaluate(async (id) => {
        const db = await new Promise((ok, ko) => { const r = indexedDB.open("bc_library"); r.onsuccess = () => ok(r.result); r.onerror = ko; });
        if (!db.objectStoreNames.contains("files")) return false;
        return await new Promise((ok) => { const g = db.transaction("files").objectStore("files").get(id); g.onsuccess = () => ok(!!g.result); g.onerror = () => ok(false); });
      }, locke.id);
      if (byteQui) throw new Error("i byte del fumetto sono entrati nel browser");
      if ((await libriDi(d.p)).some((b) => /Terry Pratchett/.test(b.title))) throw new Error("l'altra edizione di Mort è entrata come doppione");
      // «Metti da parte» sposta solo le copie identiche: l'altra edizione di
      // Mort resta dov'e' («mi hai tolto libri che non dovevi togliere»)
      const leggi = () =>
        d.p.evaluate(async () => {
          const bc = await (await (await navigator.storage.getDirectory()).getDirectoryHandle("HDD")).getDirectoryHandle("book-companion");
          const c = async (via) => { let x = bc; for (const n of via.slice(0, -1)) x = await x.getDirectoryHandle(n); return (await (await x.getFileHandle(via.at(-1))).getFile()).size; };
          return [["_Doppioni", "Libri", "Mort.epub"], ["Libri", "Mort.epub"], ["Libri", "Discworld", "Mort - Terry Pratchett.epub"], ["_Doppioni", "Libri", "Discworld", "Mort - Terry Pratchett.epub"]].reduce(async (acc, via) => [...(await acc), await c(via).catch(() => -1)], []).then((x) => x.join(","));
        });
      await d.p.evaluate(async () => {
        const libri = await (await (await (await navigator.storage.getDirectory()).getDirectoryHandle("HDD")).getDirectoryHandle("book-companion")).getDirectoryHandle("Libri");
        const w = await (await libri.getFileHandle("Mort.epub", { create: true })).createWritable();
        await w.write(new Uint8Array(500));
        await w.close();
      });
      await d.p.getByRole("button", { name: "🔍 Controlla il disco" }).click();
      await d.p.getByRole("button", { name: /🗃 Metti da parte la copia in più/ }).click();
      await finche(() => testoAvviso(d.p, /Un file messo da parte in «_Doppioni»/), 10000, "la copia non va da parte");
      const daParte = await leggi();
      if (daParte !== "500,-1,600,-1") throw new Error(`da parte la copia, al suo posto l'altra edizione: ${daParte}`);
      // e quel che e' in _Doppioni torna da dove era venuto
      await d.p.getByRole("button", { name: "🔍 Controlla il disco" }).click();
      await finche(() => d.p.getByText(/altre edizioni|un'altra edizione/).count(), 10000, "l'altra edizione non si dice piu'");
      await d.p.getByRole("button", { name: "↩ Rimetti a posto il file di «_Doppioni»" }).click();
      await finche(() => testoAvviso(d.p, /Un file rimesso al suo posto/), 10000, "il ritorno da _Doppioni non si dice");
      const rimesso = await leggi();
      if (rimesso !== "-1,500,600,-1") throw new Error(`rimesso a posto: ${rimesso}`);
      // Mort sta solo sul disco: dalla sua scheda se ne sceglie il file
      await d.p.getByText("Mort", { exact: true }).first().evaluate((e) => e.closest("button").click());
      await d.p.getByRole("button", { name: "📂 Scegli il file" }).click();
      await finche(() => testoAvviso(d.p, /scegli il file per rimetterlo/), 5000, "«Apri» su un libro senza ebook non dice di scegliere il file");
      const chiesto = await finche(() => d.p.evaluate(() => window.__chiesto?.id), 5000, "«Apri» su un libro senza ebook non apre il selettore");
      if (chiesto !== "bc-hdd") throw new Error(`il selettore non parte dal disco: ${chiesto}`);
      return { guasti: d.guasti, nota: `${frase.slice(0, 50)}… · JoJo nella sua saga, Kagurabachi tolto e fermo, Mort fermo` };
    },
  },
  {
    // la fotografia del lettore: il Mondo Disco proponeva un seguito per
    // ogni ciclo cominciato (Reaper Man 11, Men at Arms 15…) e lui ha scelto
    // «uno per saga, sempre»: il numero dopo il più alto letto o in lettura
    nome: "l'Ingresso propone un seguito per saga, il numero dopo, anche rimesso «Da leggere», e in un mondo il primo non letto",
    async fai({ browser }) {
      const d = await dispositivo(browser, { prima: mondoDisco });
      await d.p.goto(URL_APP);
      const nota = await finche(() => testoAvviso(d.p, /Discworld n° 10 · inizia Industrial Revolution · già al 12%/), 15000, "Moving Pictures non e' fra i seguiti");
      const note = await d.p.evaluate(() => [...document.querySelectorAll("div,span,p")].filter((e) => e.childElementCount === 0 && /^Discworld n° /.test(e.textContent || "")).map((e) => e.textContent));
      if (note.length !== 1) throw new Error(`il Mondo Disco propone piu' di un seguito: ${note.join(" | ")}`);
      // nel Cosmoverse numerato col mondo il seguito e' Elantris, il primo
      // non letto, e non Warbreaker, il numero dopo i Mistborn letti
      const cosmo = await finche(() => testoAvviso(d.p, /^Cosmoverse n° \d/), 10000, "il Cosmoverse non ha un seguito");
      if (!/^Cosmoverse n° 1\b/.test(cosmo)) throw new Error(`nel Cosmoverse il seguito non e' Elantris: «${cosmo}»`);
      return { guasti: d.guasti, nota: `${nota} · ${cosmo}` };
    },
  },
  {
    // «adattala a qualsiasi tipo di schermo», chiesto dal lettore pensando a
    // un tablet piu' piccolo. Misurata su dieci schermi (telefoni, 7", 8,7"
    // e 8,4" nei due versi, il suo tablet, il computer): niente sbordava, ma
    // sul telefono la Libreria era fatta di intestazione e filtri — il
    // titolo su due righe, i filtri su quattro, due copertine giganti per
    // riga — e il primo libro cominciava a meta' schermo
    nome: "sul telefono la Libreria comincia presto: titolo su una riga, filtri in una fila, tre copertine per riga; sul tablet resta com'era",
    async fai({ browser }) {
      const misura = async (vp) => {
        const ctx = await browser.newContext({ viewport: vp, screen: vp, deviceScaleFactor: vp.width < 500 ? 3 : 1.33, hasTouch: true, isMobile: true });
        await ctx.route((u) => !/^(localhost|127\.0\.0\.1)$/.test(u.hostname), (r) => r.abort());
        const p = await ctx.newPage();
        for (const [nome, buf, tipo] of [["Uno.epub", await epub({ titolo: "Uno" }), "application/epub+zip"], ["Due.epub", await epub({ titolo: "Due" }), "application/epub+zip"], ["Tre.epub", await epub({ titolo: "Tre" }), "application/epub+zip"], ["Arcadia.cbz", await fumetto(), "application/zip"]])
          await importa(p, nome, buf, tipo);
        await p.goto(`${URL_APP}?apri=libreria`);
        await p.getByRole("button", { name: "Fumetti", exact: false }).first().waitFor({ timeout: 8000 });
        await aspetta(800);
        const m = await p.evaluate(() => {
          const titolo = [...document.querySelectorAll("header span, h1")].find((e) => e.textContent.trim() === "Book Companion");
          const filtri = [...document.querySelectorAll("button")].filter((b) => ["Tutti", "Da leggere", "In lettura", "Letti", "Abbandonati", "♥ Preferiti"].includes(b.textContent.trim()));
          const righeFiltri = new Set(filtri.map((b) => Math.round(b.getBoundingClientRect().top))).size;
          return {
            titoloAlto: titolo ? Math.round(titolo.getBoundingClientRect().height) : -1,
            righeFiltri,
            sborda: document.scrollingElement.scrollWidth - innerWidth,
          };
        });
        // le copertine della prima riga: quante stanno alla stessa altezza
        const tops = await p.evaluate(() => {
          const grid = [...document.querySelectorAll("div")].find((d) => getComputedStyle(d).display === "grid" && d.querySelectorAll("button").length >= 3);
          if (!grid) return [];
          return [...grid.children].map((c) => Math.round(c.getBoundingClientRect().top));
        });
        const primaRiga = tops.filter((t) => t === tops[0]).length;
        await ctx.close();
        return { ...m, primaRiga, primoLibro: tops[0] };
      };
      const tel = await misura({ width: 360, height: 740 });
      if (tel.sborda > 0) throw new Error(`a 360 la Libreria sborda di ${tel.sborda}px`);
      if (tel.titoloAlto > 40) throw new Error(`a 360 il titolo va a capo (${tel.titoloAlto}px)`);
      if (tel.righeFiltri !== 1) throw new Error(`a 360 i filtri stanno su ${tel.righeFiltri} righe`);
      if (tel.primaRiga !== 3) throw new Error(`a 360 la prima riga ha ${tel.primaRiga} copertine`);
      if (tel.primoLibro > 370) throw new Error(`a 360 il primo libro comincia a ${tel.primoLibro}px, oltre meta' schermo`);
      const tab = await misura(TABLET.viewport);
      if (tab.sborda > 0) throw new Error(`sul tablet la Libreria sborda di ${tab.sborda}px`);
      // sul tablet i filtri non scorrono di lato: la fila che scorre e' del telefono
      if (!tab.righeFiltri) throw new Error("sul tablet i filtri non si vedono");
      return { nota: `a 360: titolo ${tel.titoloAlto}px, filtri su 1 riga, ${tel.primaRiga} copertine, primo libro a ${tel.primoLibro}px · tablet: filtri su ${tab.righeFiltri} righe, ${tab.primaRiga} per riga` };
    },
  },
  {
    // segnalato dal lettore col telefono: «non è allineato con le cose che
    // ci sono su tablet e pc, si porta dietro cose in meno, la
    // sincronizzazione è molto lenta». La sua biblioteca passa i mille
    // libri, e Supabase da' al piu' mille righe per richiesta.
    nome: "una biblioteca di piu' di mille libri arriva intera sul telefono, e un giro senza novita' non rimanda niente",
    async fai({ browser, db }) {
      const N = 1100;
      // lo script entra nella pagina come testo: N ci va scritto dentro
      const semina = (n) => {
        if (localStorage.getItem("bc_books")) return;
        const libri = Array.from({ length: n }, (_, i) => ({ id: `l${String(i).padStart(4, "0")}`, title: `Volume ${i + 1}`, author: "Autore di prova", fileType: "epub", addedAt: 1000 + i }));
        localStorage.setItem("bc_books", JSON.stringify(libri));
      };
      const pc = await dispositivo(browser, { sessione: true, prima: `(${semina})(${N})` });
      await pc.p.goto(URL_APP);
      await finche(() => db.righe().length >= N, 60000, `i ${N} libri del PC non salgono tutti (${db.righe().length})`);
      const tel = await dispositivo(browser, { sessione: true });
      await tel.p.goto(URL_APP);
      const arrivati = await finche(
        async () => {
          const n = (await libriDi(tel.p)).length;
          return n >= N ? n : 0;
        },
        60000,
        `sul telefono non arrivano tutti i ${N} libri`
      ).catch(async (e) => {
        throw new Error(`${e.message}: ne arrivano ${(await libriDi(tel.p)).length}`);
      });
      const primaDelGiro = await pc.p.evaluate(() => localStorage.getItem("bc_lastsync"));
      const salitePrima = db.salite();
      await pc.p.reload();
      await finche(async () => (await pc.p.evaluate(() => localStorage.getItem("bc_lastsync"))) !== primaDelGiro, 60000, "il secondo giro del PC non finisce");
      const rimandate = db.salite() - salitePrima;
      if (rimandate) throw new Error(`un giro senza novita' ha rimandato ${rimandate} righe nel cloud`);
      return { guasti: [...pc.guasti, ...tel.guasti], nota: `${arrivati} libri sul telefono; il giro dopo non rimanda niente` };
    },
  },
  {
    // il primo giro del telefono dopo giorni (727 libri cambiati): le
    // schede c'erano dopo un secondo, ma si salvavano solo dopo le
    // copertine, scese una alla volta — sul banco 99 secondi a scaffale
    // vuoto. Adesso le schede si vedono subito e le copertine arrivano a
    // gruppi, dopo.
    nome: "il telefono mostra i libri scesi prima che finiscano le copertine",
    async fai({ browser, db }) {
      const N = 80;
      const semina = (n) => {
        if (localStorage.getItem("bc_books")) return;
        localStorage.setItem("bc_books", JSON.stringify(Array.from({ length: n }, (_, i) => ({ id: `cop${String(i).padStart(3, "0")}`, title: `Copertina ${i + 1}`, author: "Autore", fileType: "epub", addedAt: 5000 + i }))));
      };
      const pc = await dispositivo(browser, { sessione: true, prima: `(${semina})(${N})` });
      await pc.p.goto(URL_APP);
      await finche(() => db.righe().filter((r) => r.id.startsWith("cop")).length >= N, 30000, "i libri del PC non salgono");
      for (let i = 0; i < N; i++) db.metti(`books/u1/cop${String(i).padStart(3, "0")}.cover`, Buffer.alloc(2000, i));
      await pc.ctx.close();
      db.rallenta(100);
      try {
        const scese = () => db.richieste()["GET /storage/v1/object/…"] || 0;
        const prima = scese();
        const tel = await dispositivo(browser, { sessione: true });
        await tel.p.goto(`${URL_APP}?apri=libreria`);
        const quando = await finche(async () => ((await testoAvviso(tel.p, /^Copertina 1$/)) ? scese() - prima : null), 60000, "i libri non compaiono sullo scaffale del telefono");
        if (quando >= N / 2) throw new Error(`i libri si vedono solo dopo ${quando} copertine su ${N}`);
        await finche(() => scese() - prima >= N, 60000, `le copertine non scendono tutte (${scese() - prima} di ${N})`);
        return { guasti: tel.guasti, nota: `scaffale pieno dopo ${quando} copertine su ${N}, poi le altre` };
      } finally {
        db.rallenta(0);
      }
    },
  },
  {
    // segnalato dal lettore davanti a «Mando su le copertine…» ferma: «non
    // capisco che sta facendo e perché ci mette tanto». Salivano una alla
    // volta, ognuna ad aspettare la sua risposta
    nome: "le copertine del PC salgono a gruppi, non una alla volta",
    async fai({ browser, db }) {
      const N = 60;
      const RETE = 100;
      const semina = (n) => {
        if (localStorage.getItem("bc_books")) return;
        localStorage.setItem("bc_books", JSON.stringify(Array.from({ length: n }, (_, i) => ({ id: `su${String(i).padStart(3, "0")}`, title: `Sale ${i + 1}`, author: "Autore", fileType: "epub", addedAt: 7000 + i }))));
      };
      const pc = await dispositivo(browser, { sessione: true, prima: `(${semina})(${N})` });
      await pc.p.goto(URL_APP);
      await finche(() => db.righe().filter((r) => r.id.startsWith("su")).length >= N, 30000, "i libri del PC non salgono");
      // le copertine arrivano dopo (un «Ritrova copertine», un import da Drive)
      await pc.p.evaluate(
        (n) =>
          new Promise((ok, ko) => {
            const r = indexedDB.open("bc_library", 3);
            r.onsuccess = () => {
              const tx = r.result.transaction("covers", "readwrite");
              for (let i = 0; i < n; i++) tx.objectStore("covers").put(new Blob([new Uint8Array(3000).fill(i)], { type: "image/jpeg" }), `su${String(i).padStart(3, "0")}`);
              tx.oncomplete = ok;
              tx.onerror = () => ko(tx.error);
            };
            r.onerror = () => ko(r.error);
          }),
        N
      );
      const salite = () => db.richieste()["POST /storage/v1/object/…"] || 0;
      const prima = salite();
      db.rallenta(RETE);
      try {
        const t0 = Date.now();
        await pc.p.reload();
        // e dicono a che punto sono, nel pannello della sincronizzazione
        await pc.p.getByRole("button", { name: "Sincronizzazione" }).first().click();
        await pc.p.getByRole("button", { name: /Sincronizzazione nel cloud/ }).first().click();
        const detto = await finche(() => testoAvviso(pc.p, /^Mando su (60 copertine|le copertine: \d+ di 60)…$/), 15000, "il pannello non dice quante copertine salgono");
        await finche(() => salite() - prima >= N, 60000, `le copertine non salgono tutte (${salite() - prima} di ${N})`);
        const ms = Date.now() - t0;
        // una alla volta sarebbero almeno N viaggi uno dopo l'altro
        if (ms > (N * RETE) / 2) throw new Error(`${N} copertine salite in ${ms} ms: una alla volta ne vorrebbero ${N * RETE}`);
        return { guasti: pc.guasti, nota: `«${detto}», ${N} copertine in ${(ms / 1000).toFixed(1)} s con ${RETE} ms di rete (una alla volta: almeno ${(N * RETE) / 1000} s)` };
      } finally {
        db.rallenta(0);
      }
    },
  },
  {
    // dal rapporto delle voltate del lettore: pagine tutte in memoria, e
    // 108 ms su 111 a DISEGNARLE. La pagina dopo aspetta sotto quella a
    // schermo, e alla voltata dev'essere LO STESSO elemento: un <img> nuovo
    // si rilegge e si ridecodifica (misurato: nessun guadagno). E la pagina
    // che se ne va svanisce col suo elemento, non con una foto su canvas.
    nome: "alla voltata del fumetto la pagina dopo (e tornando, quella prima) era gia' li', e quella di prima esce di lato senza sovrapporsi",
    async fai({ browser }) {
      const bytes = await fumettoGrosso();
      {
        const d = await dispositivo(browser);
        await importa(d.p, "Tavole.cbz", bytes, "application/zip");
        await d.p.getByText("Tavole").first().click();
        await d.p.getByRole("button", { name: /Apri il libro/ }).first().click();
        const pronta = await finche(
          () =>
            d.p.evaluate(() => {
              const dopo = document.querySelector("img[data-dopo]");
              const vista = [...document.querySelectorAll("img:not([data-dopo]):not([data-via])")].find((x) => /pagina \d+\.png$/.test(x.alt));
              if (!dopo?.complete || !dopo.naturalWidth || !vista?.complete) return "";
              dopo.bcSegno = "dopo";
              vista.bcSegno = "prima";
              return vista.alt;
            }),
          20000,
          "la pagina dopo non si prepara sotto quella a schermo"
        );
        // LA VOLTATA SCORRE (il lettore, col video di Kingdom: «quel rimasuglio
        // di pixel tra una pagina e l'altra»): fotogramma per fotogramma, il
        // foglio di prima esce a sinistra, il nuovo entra da destra, e i due
        // non stanno mai uno sopra l'altro
        const film = d.p.evaluate(
          () =>
            new Promise((ok) => {
              const t0 = performance.now();
              const fot = [];
              const giro = () => {
                const imVia = document.querySelector("img[data-via]");
                const via = imVia?.parentElement?.getBoundingClientRect();
                const nuova = [...document.querySelectorAll("img[data-pagina]")].find((x) => !x.closest("[aria-hidden]"))?.parentElement?.getBoundingClientRect();
                if (via && nuova) fot.push({ t: Math.round(performance.now() - t0), segno: imVia.bcSegno || "nuova", via: [Math.round(via.left), Math.round(via.right)], nuova: [Math.round(nuova.left), Math.round(nuova.right)] });
                if (performance.now() - t0 < 2500) requestAnimationFrame(giro);
                else ok(fot);
              };
              requestAnimationFrame(giro);
            })
        );
        await d.p.keyboard.press("ArrowRight");
        const fotogrammi = await film;
        const mossi = fotogrammi.filter((f) => f.via[0] !== f.nuova[0]);
        if (mossi.length < 5) throw new Error(`la voltata non scorre: ${JSON.stringify(fotogrammi.slice(0, 6))}`);
        const sopra = mossi.filter((f) => f.via[1] > f.nuova[0] + 1);
        if (sopra.length) throw new Error(`le due pagine si sovrappongono: ${JSON.stringify(sopra.slice(0, 3))}`);
        if (!mossi.every((f, i) => i === 0 || f.via[0] <= mossi[i - 1].via[0])) throw new Error(`la pagina di prima non esce a sinistra: ${JSON.stringify(mossi.map((f) => f.via[0]))}`);
        const esito = await finche(
          () =>
            d.p.evaluate((prima) => {
              const vista = [...document.querySelectorAll("img:not([data-dopo]):not([data-via])")].find((x) => /pagina \d+\.png$/.test(x.alt));
              if (!vista || vista.alt === prima) return "";
              return JSON.stringify({ pagina: vista.alt, vista: vista.bcSegno || "nuova", via: [...document.querySelectorAll("img[data-via]")].map((x) => x.bcSegno || "nuova") });
            }, pronta),
          15000,
          "la voltata non arriva"
        );
        const e = JSON.parse(esito);
        if (e.vista !== "dopo") throw new Error(`a schermo c'e' un <img> nuovo, non quello preparato sotto (${esito})`);
        if (!fotogrammi.length || fotogrammi.some((f) => f.segno !== "prima")) throw new Error(`la pagina di prima non esce col suo elemento (${JSON.stringify(fotogrammi.slice(0, 2))})`);
        const num = (alt) => Number(alt.match(/(\d+)\.png$/)[1]);
        // E ALL'INDIETRO (chiesto dal lettore, «fai la 3»): finita la
        // dissolvenza, la pagina di prima aspetta sotto anche lei
        await finche(
          () =>
            d.p.evaluate(() => {
              const sotto = [...document.querySelectorAll("img[data-dopo]")];
              if (sotto.length < 2 || document.querySelector("img[data-via]") || sotto.some((im) => !im.complete)) return false;
              for (const im of sotto) im.bcSegno = "sotto";
              return true;
            }),
          15000,
          "la pagina di prima non si prepara sotto quella a schermo"
        );
        await d.p.keyboard.press("ArrowLeft");
        const indietro = await finche(
          () =>
            d.p.evaluate((ora) => {
              const vista = [...document.querySelectorAll("img:not([data-dopo]):not([data-via])")].find((x) => /pagina \d+\.png$/.test(x.alt));
              return vista && vista.alt !== ora ? JSON.stringify({ pagina: vista.alt, vista: vista.bcSegno || "nuova" }) : "";
            }, e.pagina),
          15000,
          "la voltata all'indietro non arriva"
        );
        const ind = JSON.parse(indietro);
        if (ind.vista !== "sotto") throw new Error(`tornando indietro a schermo c'e' un <img> nuovo (${indietro})`);
        return { guasti: d.guasti, nota: `pagina ${num(pronta)} → ${num(e.pagina)} → ${num(ind.pagina)}: ogni volta la <img> preparata sotto; la voltata in ${mossi.length} fotogrammi, mai sovrapposte` };
      }
    },
  },
  {
    // segnalato dal lettore coi Dragonriders of Pern: ogni volume due volte
    // sullo scaffale, una scheda col file e una col triangolo «né qui né nel
    // cloud», e la Manutenzione che non li vedeva («non dovrebbe
    // riconoscermi i doppioni? o anche solo quando reimporto i libri»)
    nome: "un libro reimportato torna nella scheda che l'aveva perso, e i doppioni dei libri si uniscono",
    async fai({ browser }) {
      const volo = await epub({ titolo: "Dragonflight", autore: "Anne McCaffrey" });
      const quest = await epub({ titolo: "Dragonquest", autore: "Anne McCaffrey" });
      const autore = "Anne McCaffrey";
      const libri = [
        // l'ebook tolto apposta: reimportandolo, il libro si riapre subito
        { id: "pern", title: "Dragonflight", author: autore, fileType: "epub", addedAt: 1, fileTolto: true },
        // una scheda gia' letta, senza file: il file nuovo non la adotta
        // (i segni sono ancorati ad altri byte), entra accanto, e sono due
        { id: "q1", title: "Dragonquest", author: autore, fileType: "epub", addedAt: 2 },
      ];
      const d = await dispositivo(browser, {
        prima: `if (!localStorage.getItem("bc_books")) { localStorage.setItem("bc_books", ${JSON.stringify(JSON.stringify(libri))}); localStorage.setItem("bc_prog_q1", "0.3"); }`,
      });
      await d.p.goto(`${URL_APP}?apri=libreria`);
      await d.p.setInputFiles('input[accept^=".epub"]', { name: "Anne McCaffrey - Dragonflight.epub", mimeType: "application/epub+zip", buffer: volo });
      await finche(async () => (await libriDi(d.p)).find((b) => b.id === "pern")?.fileTolto === false, 20000, "il file non torna nella scheda di prima");
      const voli = (await libriDi(d.p)).filter((b) => b.title === "Dragonflight");
      if (voli.length !== 1) throw new Error(`«Dragonflight» sullo scaffale ${voli.length} volte`);
      await d.p.setInputFiles('input[accept^=".epub"]', { name: "Dragonquest.epub", mimeType: "application/epub+zip", buffer: quest });
      const conFile = await finche(async () => (await libriDi(d.p)).find((b) => b.title === "Dragonquest" && b.id !== "q1")?.id, 20000, "il secondo «Dragonquest» non entra");
      // la coppia: la Manutenzione la vede e la unisce
      await d.p.getByRole("button", { name: /Manutenzione/ }).first().click();
      await d.p.getByRole("button", { name: /Un volume ha una copia in più/ }).first().click({ timeout: 15000 });
      await d.p.getByRole("button", { name: /Unisci i doppioni/ }).first().click();
      const quests = await finche(async () => {
        const q = (await libriDi(d.p)).filter((b) => b.title === "Dragonquest");
        return q.length === 1 && q;
      }, 10000, "i due «Dragonquest» non si uniscono");
      if (quests[0].id !== conFile) throw new Error(`dei due «Dragonquest» e' rimasto quello senza file (${quests[0].id})`);
      return { guasti: d.guasti, nota: "«Dragonflight» ha ritrovato il suo file; dei due «Dragonquest» resta quello col file" };
    },
  },
  {
    // dalla copia della biblioteca del lettore (12 novembre), coi suoi nomi:
    // schede senza ebook aggiunte da una lista accanto a libri che c'erano
    // gia', e la Manutenzione che non le vedeva. Il lettore: «sì fai i doppioni»
    nome: "le schede senza ebook nello stesso posto di un libro si uniscono dai doppioni, e resta il libro con l'autore vero",
    async fai({ browser }) {
      const senza = (id, title, author, saga, n, addedAt = 1) => ({ id, title, author, saga, sagaOrder: n, fileType: "nessuno", fileTolto: true, addedAt });
      const libri = [
        senza("cs-elmore", "The Crystal Shard", "Larry Elmore", "The Legend of Drizzt", 4, 1),
        senza("cs", "The Crystal Shard", "R. A. Salvatore", "The Legend of Drizzt", 4, 2),
        senza("hl", "Homeland", "R. A. Salvatore", "The Legend of Drizzt", 1, 3),
        senza("gk", "The Ghost King", "R. A. Salvatore", "The Legend of Drizzt", 22, 3),
        senza("es", "El Rey Fantasma", "R. A. Salvatore", "The Legend of Drizzt", 22, 4),
        { id: "kg1", title: "Kagurabachi v01", saga: "Kagurabachi", sagaOrder: 1, fileType: "cbz", tipo: "manga", fileTolto: true, addedAt: 9 },
        senza("kg1s", "Kagurabachi, Vol. 1", "Takeru Hokazono", "Kagurabachi", 1, 1),
        { id: "wn", title: "White Night", author: "Jim Butcher", saga: "Dresden Files", sagaOrder: 9, fileType: "epub", fileTolto: true, addedAt: 5 },
        senza("wn2", "White Night", "Chris McGrath", "The Dresden Files", 9, 1),
        // e la copia di Drive col titolo vero vuoto
        { id: "sp2", title: "Spawn Origins Collection v02", saga: "Spawn Origins Collection", sagaOrder: 2, fileType: "cbz", fileTolto: true, addedAt: 1 },
        { id: "sp2d", title: "Spawn Origins Collection Vol. 02-017", saga: "Spawn Origins Collection", sagaOrder: 2, fileType: "cbz", fileTolto: true, addedAt: 2 },
      ];
      const d = await dispositivo(browser, {
        misura: TABLET,
        prima: `if (!localStorage.getItem("bc_books")) localStorage.setItem("bc_books", ${JSON.stringify(JSON.stringify(libri))});`,
      });
      await d.p.goto(`${URL_APP}?apri=libreria`);
      await d.p.getByRole("button", { name: /Manutenzione/ }).first().click();
      await d.p.getByRole("button", { name: /4 volumi hanno una copia in più/ }).first().click({ timeout: 15000 });
      const elenco = await d.p.locator("li", { hasText: "via:" }).allTextContents();
      if (!elenco.some((r) => r.includes("The Crystal Shard (R. A. Salvatore) · via: «The Crystal Shard» (Larry Elmore, senza ebook)")))
        throw new Error(`l'elenco non dice quale «The Crystal Shard» se ne va: ${JSON.stringify(elenco)}`);
      if (!elenco.some((r) => r.includes("«White Night» (Chris McGrath, in «The Dresden Files», senza ebook)"))) throw new Error(`l'elenco non dice la raccolta della copia: ${JSON.stringify(elenco)}`);
      await d.p.getByRole("button", { name: /Unisci i doppioni/ }).first().click();
      const resta = await finche(async () => {
        const ids = (await libriDi(d.p)).map((b) => b.id).sort().join();
        return ids.split(",").length === 7 && ids;
      }, 10000, "i doppioni non se ne vanno");
      if (resta !== "cs,es,gk,hl,kg1,sp2,wn") throw new Error(`restano: ${resta}`);
      return { guasti: d.guasti, nota: "tre copie senza ebook tolte (l'illustratore, il segnaposto di Kagurabachi, la seconda raccolta di Dresden) e la copia di Drive di Spawn; la traduzione resta" };
    },
  },
  {
    nome: "Lexicanum scende dalle Impostazioni, i nomi si segnano nel testo, e nella scheda del dizionario la voce vela quel che viene da un volume dopo",
    async fai({ browser }) {
      const chieste = [];
      const d = await dispositivo(browser, { misura: TABLET, lexicanum: lexicanumFinto(chieste) });
      const { p } = d;
      await p.goto(URL_APP);
      await p.getByRole("button", { name: /^Impostazioni/ }).first().click();
      await p.getByRole("button", { name: "⚔ Scarica Lexicanum" }).click();
      // il lavoro si vede da ogni sezione, nella sua riga
      await finche(() => p.getByText(/⚔ Lexicanum:/).count(), 8000, "la riga del lavoro non compare");
      await finche(() => p.getByText(/Lexicanum sul dispositivo: /).count(), 20000, "lo scaricamento non finisce");
      if (!chieste.every((u) => u.includes("origin=*"))) throw new Error("una richiesta a Lexicanum senza origin=*: il browser la rifiuterebbe");
      // Lexicanum non dichiara l'immagine principale: niente tasti di immagini, e si dice dove stanno
      await finche(() => p.getByText(/Lexicanum non segna le immagini delle sue voci/).count(), 8000, "Lexicanum non dice che le immagini vengono da Fandom");
      if (await p.getByRole("button", { name: /🖼 Misura le immagini|🖼 Scarica le immagini/ }).count()) throw new Error("un tasto promette immagini che Lexicanum non da'");
      // il riepilogo in cima dice cosa c'e' e cosa manca
      await finche(() => p.getByText(/^Da scaricare: Fandom, Immagini principali di Fandom, Altre illustrazioni di Fandom\.$/).count(), 5000, "il riepilogo non dice cosa manca");
      // a Lexicanum sceso la spiegazione si chiude, e si riapre a un tocco
      if (await p.getByText(/I paragrafi che Lexicanum cita da un volume/).count()) throw new Error("a Lexicanum sceso la spiegazione resta aperta");
      await p.getByRole("button", { name: "ℹ Cos'è Lexicanum e come funziona" }).click();
      await p.getByText(/I paragrafi che Lexicanum cita da un volume/).waitFor({ timeout: 3000 });
      await p.keyboard.press("Escape");

      const frase = "I was there, the day that Horus slew the Emperor. Garviel Loken watched the Warmaster from the deck. 'Two hundred and fifty,' came the answer. Kilometres away, the Titan stopped. Princeps Kasim's engine fired into the flanking Reavers, and their void shields soaked up the barrage.";
      await importa(p, "Horus Rising.epub", await epub({ titolo: "Horus Rising", autore: "Dan Abnett", frase, lingua: "en" }), "application/epub+zip");
      await p.getByText("Horus Rising").first().click();
      // l'interruttore del libro: acceso dalla saga riconosciuta
      await finche(() => p.getByRole("button", { name: /I wiki del 40K nella scheda del dizionario: accesi/ }).count(), 8000, "la scheda del libro non dice che i wiki sono accesi");
      await p.getByRole("button", { name: /Apri il libro|Comincia/ }).first().click();
      // i nomi del 40K segnati nel testo, come i termini del glossario
      await finche(() => p.locator('[data-bc-lore="Garviel Loken"]').count(), 15000, "«Garviel Loken» non e' segnato nel testo");
      await definisci(p, "Loken");
      // il rinvio «Loken» porta alla voce, e l'incipit (da un'altra opera) si legge
      await finche(() => p.getByText(/was a Captain of the Luna Wolves/).count(), 8000, "la scheda non mostra la voce di Lexicanum");
      await p.getByRole("button", { name: "Leggi la voce ▸" }).click();
      const veli = await finche(async () => {
        const v = await p.getByText(/Paragrafo velato/).allTextContents();
        return v.length ? v : null;
      }, 5000, "nessun paragrafo velato");
      const attesi = [/da questo libro/, /«False Gods», che viene dopo/, /«Galaxy in Flames», che viene dopo/];
      if (veli.length !== 3 || !attesi.every((re, i) => re.test(veli[i]))) throw new Error(`veli sbagliati: ${JSON.stringify(veli)}`);
      // la voce come sul wiki: la citazione, il riquadro dei dati velato
      // (non cita fonti), l'indice delle sezioni che porta al titoletto
      if (!(await p.locator("blockquote", { hasText: "I was never a Son of Horus." }).count())) throw new Error("la citazione non e' una citazione");
      if (await p.getByText("Captain", { exact: true }).count()) throw new Error("il riquadro dei dati non e' velato");
      await p.getByText(/Riquadro dei dati velato/).click();
      await finche(() => p.getByText("Captain", { exact: true }).count(), 5000, "il riquadro toccato non si apre");
      await p.getByText("In questa voce").waitFor({ timeout: 5000 });
      const sotto = await p.getByText("Personality", { exact: true }).last().boundingBox();
      if (!sotto || sotto.y < 1503) throw new Error("la voce di prova non e' abbastanza lunga da scorrere");
      await p.getByRole("button", { name: "Personality" }).click();

      await finche(async () => {
        const titolo = p.getByText("Personality", { exact: true }).last();
        const r = await titolo.boundingBox();
        return r && r.y >= 0 && r.y + r.height <= 1503;
      }, 5000, "l'indice non porta alla sezione");
      if (await p.getByText(/first signs of corruption/).count()) throw new Error("il testo velato e' gia' nella pagina");
      await p.getByText(/Paragrafo velato: da «False Gods»/).click();
      await finche(() => p.getByText(/first signs of corruption/).count(), 5000, "il velo toccato non si apre");
      // un link a un rinvio porta alla voce, e «indietro» torna
      await p.getByRole("button", { name: "Luna Wolves" }).last().click();
      await finche(() => p.getByText(/were the XVI Legion/).count(), 5000, "il link non porta alla voce");
      // la tabella del wiki scorre dentro la scheda, la pagina non sborda
      await p.locator("table", { hasText: "Tarik Torgaddon" }).waitFor({ timeout: 5000 });
      const largo = await p.evaluate(() => document.scrollingElement.scrollWidth - innerWidth);
      if (largo > 0) throw new Error(`con la tabella la pagina sborda di ${largo}px`);
      await p.getByRole("button", { name: /◂ Garviel Loken/ }).click();
      await finche(() => p.getByText(/Isstvan III/).count(), 5000, "indietro non torna alla voce di prima");
      // «Two hundred» in minuscolo e' la distanza: non si segna, e la voce
      // «Two Hundred» viene dopo la parola
      if (await p.locator('[data-bc-lore="Two Hundred"]').count()) throw new Error("«Two hundred», un numero, e' segnato come un nome");
      // «Kilometres» apre la frase: la maiuscola non dice che e' un nome
      if (await p.locator('[data-bc-lore="Kilometres"]').count()) throw new Error("«Kilometres» a inizio frase e' segnato come un nome del 40K");
      await p.getByRole("button", { name: "◂ La parola" }).click();
      await p.getByRole("button", { name: "✕" }).first().click();
      await p.route("**/api/rest_v1/page/definition/**", (r) =>
        r.fulfill({ headers: { "access-control-allow-origin": "*" }, json: { en: [{ partOfSpeech: "Numeral", language: "English", definitions: [{ definition: "The cardinal number two hundred." }] }] } })
      );
      await p.route("https://en.wiktionary.org/w/api.php?**", (r) =>
        r.fulfill({ headers: { "access-control-allow-origin": "*" }, json: { query: { pages: [{ ns: 0, title: "two hundred" }] } } })
      );
      await definisci(p, "Two hundred");
      const sopra = async (testo) => (await p.getByText(testo).first().boundingBox())?.y;
      const [parola, voce] = await finche(async () => {
        const a = await sopra(/The cardinal number two hundred/);
        const b = await sopra(/^Two Hundred$/);
        return a != null && b != null ? [a, b] : null;
      }, 10000, "nella scheda di «Two hundred» manca la parola o la voce «Two Hundred»");
      if (voce < parola) throw new Error("«Two hundred», un numero, mette la voce «Two Hundred» prima della parola");
      // UN NOME, PIU' VOCI: «Reavers» rinvia agli Eldar Oscuri, ma il
      // paragrafo parla di un Princeps, di un motore e di scudi: il Titano.
      // E sotto le altre voci col nome, per correggere la scelta
      // fuori dalla scheda: il velo sotto la chiude (il ✕ della barra chiuderebbe il libro)
      await p.mouse.click(450, 1450);
      await definisci(p, "Reavers");
      await finche(() => p.getByText(/Battle Titan of the Collegia Titanica/).count(), 8000, "«Reavers» nel paragrafo dei Titani non apre il Titano");
      await p.getByText("scelta dal paragrafo che leggi").waitFor({ timeout: 3000 });
      await p.getByText("Altre voci con questo nome").waitFor({ timeout: 3000 });
      await p.getByRole("button", { name: "Reaver Jetbike", exact: true }).click();
      await finche(() => p.getByText(/twisted Dark Eldar cousins/).count(), 5000, "la voce scelta fra le altre non si apre");
      if (await p.getByText("scelta dal paragrafo che leggi").count()) throw new Error("la voce scelta a mano si dice scelta dal paragrafo");
      await p.getByRole("button", { name: "Reaver Titan", exact: true }).waitFor({ timeout: 3000 });
      return { guasti: d.guasti, nota: `${chieste.length} richieste a Lexicanum, ${veli.length} veli` };
    },
  },
  {
    nome: "Lexicanum interrotto da un ricaricamento riparte da solo da dove era arrivato, e quello fermato dal lettore resta fermo",
    async fai({ browser }) {
      const chieste = [];
      // la seconda pagina tarda, perche' «Ferma» arrivi mentre e' in volo (se
      // arriva quando e' gia' partita l'ultima, il giro finisce prima di
      // fermarsi: su una macchina lenta la scena cadeva una volta su quattro);
      // e tarda l'ultima, perche' il ricaricamento la colga a meta'
      const d = await dispositivo(browser, { misura: TABLET, lexicanum: lexicanumFinto(chieste, { attesa: (i) => (i >= 1 ? 4000 : 600) }) });
      const { p } = d;
      const pagine = () => chieste.filter((u) => u.includes("generator=allpages"));
      const allaSeconda = () => pagine().some((u) => u.includes("gapcontinue=1"));
      await p.goto(URL_APP);
      await p.getByRole("button", { name: /^Impostazioni/ }).first().click();
      await p.getByRole("button", { name: "⚔ Scarica Lexicanum" }).click();
      await finche(allaSeconda, 8000, "la seconda pagina non viene chiesta");
      // fermato a mano: dopo un ricaricamento non riparte
      // il Ferma delle Impostazioni: quello della riga del lavoro sta sotto il pannello
      await p.getByText("⚔ Lexicanum sta scendendo").locator("..").getByRole("button", { name: "Ferma" }).click({ timeout: 8000 });
      await finche(() => p.getByText(/Lexicanum fermato a/).count(), 8000, "il lavoro non si ferma");
      const ferme = pagine().length;
      await p.reload();
      await aspetta(7000);
      if (pagine().length !== ferme) throw new Error("lo scaricamento fermato dal lettore e' ripartito da solo");
      // ripreso a mano e interrotto da un ricaricamento: riparte da solo
      await p.getByRole("button", { name: /^Impostazioni/ }).first().click();
      await p.getByRole("button", { name: "⚔ Riprendi lo scaricamento" }).click({ timeout: 8000 });
      await finche(() => pagine().length > ferme, 8000, "la ripresa a mano non chiede pagine");
      await p.reload();
      await finche(() => p.getByText(/⚔ Lexicanum:/).count(), 10000, "dopo il ricaricamento lo scaricamento non riparte");
      await finche(() => p.getByText(/Lexicanum sul dispositivo: /).count(), 20000, "lo scaricamento ripreso non finisce");
      const daCapo = pagine().filter((u) => !u.includes("gapcontinue")).length;
      if (daCapo !== 1) throw new Error(`la prima pagina chiesta ${daCapo} volte: e' ripartito da capo invece che da dove era arrivato`);
      return { guasti: d.guasti, nota: `${pagine().length} pagine chieste, la prima una volta sola` };
    },
  },
  {
    nome: "Wiktionary scende dalle Impostazioni, e senza rete la scheda spiega le parole in inglese con gli esempi, anche un modo di dire al passato",
    async fai({ browser }) {
      const d = await dispositivo(browser, { misura: TABLET });
      const { p } = d;
      await p.goto(URL_APP);
      await p.getByRole("button", { name: /^Impostazioni/ }).first().click();
      await p.getByRole("button", { name: /Scarica Wiktionary/ }).click();
      await finche(() => p.getByText(/📚 Wiktionary:/).count(), 8000, "la riga del lavoro non compare");
      await finche(() => p.getByText(/Wiktionary inglese sul dispositivo: /).count(), 120000, "Wiktionary non scende");
      await p.keyboard.press("Escape");
      const frase = "The captain stared with a grim face while old Vorn finally kicked the bucket on the deck.";
      await importa(p, "Grim.epub", await epub({ titolo: "Grim", autore: "Autore di Prova", frase, lingua: "en" }), "application/epub+zip");
      await p.getByText("Grim").first().click();
      await p.getByRole("button", { name: /Apri il libro|Comincia/ }).first().click();
      await definisci(p, "grim");
      await finche(() => p.getByText("Wiktionary · sul dispositivo").count(), 8000, "la scheda non risponde da Wiktionary sul dispositivo");
      // il senso principale per primo, con il suo esempio
      const primo = await p.getByText(/Dismal and gloomy/).count();
      const esempio = await p.getByText(/«Life was grim/).count();
      if (!primo || !esempio) throw new Error("«grim» non comincia dall'aggettivo col suo esempio");
      await p.mouse.click(450, 1450);
      await definisci(p, "kicked the bucket");
      await finche(() => p.getByText(/To die\./).count(), 8000, "il modo di dire al passato non si spiega alla sua forma base");
      return { guasti: d.guasti };
    },
  },
  {
    nome: "le immagini di Fandom interrotte da un ricaricamento ripartono da sole da dove erano arrivate",
    async fai({ browser }) {
      const chieste = [];
      const d = await dispositivo(browser, { misura: TABLET, lexicanum: lexicanumFinto([]), fandom: fandomFinto(chieste, { lento: 4000 }) });
      const { p } = d;
      const pagineImg = () => chieste.filter((u) => u.includes("prop=pageimages"));
      await p.goto(URL_APP);
      await p.getByRole("button", { name: /^Impostazioni/ }).first().click();
      await p.getByRole("button", { name: "📜 Scarica Fandom" }).click();
      await finche(() => p.getByText(/📜 Fandom sul dispositivo: /).count(), 20000, "Fandom non scende");
      await p.getByRole("button", { name: "🖼 Misura le immagini" }).click();
      await p.getByRole("button", { name: /🖼 Scarica le immagini · circa/ }).click({ timeout: 8000 });
      await finche(() => pagineImg().some((u) => u.includes("gapcontinue=1")), 10000, "la seconda pagina delle immagini non viene chiesta");
      await p.reload();
      await finche(() => p.getByText(/🖼 Immagini di Fandom:/).count(), 10000, "dopo il ricaricamento le immagini non ripartono");
      await finche(() => p.getByText(/Immagini di Fandom sul dispositivo: 2 immagini/).count(), 20000, "le immagini riprese non finiscono");
      const daCapo = pagineImg().filter((u) => !u.includes("gapcontinue") && !u.includes("gapfrom")).length;
      if (daCapo !== 1) throw new Error(`la prima pagina delle immagini chiesta ${daCapo} volte: e' ripartito da capo`);
      return { guasti: d.guasti, nota: `${pagineImg().length} pagine di immagini chieste` };
    },
  },
  {
    nome: "le illustrazioni di Fandom interrotte da un ricaricamento ripartono da sole, senza rifare l'elenco",
    async fai({ browser }) {
      const chieste = [];
      const d = await dispositivo(browser, { misura: TABLET, lexicanum: lexicanumFinto([]), fandom: fandomFinto(chieste, { lentoIll: 4000 }) });
      const { p } = d;
      const elenchi = () => chieste.filter((u) => u.includes("prop=images%7Cpageimages") && !u.includes("gapfrom"));
      const miniature = () => chieste.filter((u) => u.includes("prop=imageinfo") && u.includes("iiurlwidth=250"));
      await p.goto(URL_APP);
      await p.getByRole("button", { name: /^Impostazioni/ }).first().click();
      await p.getByRole("button", { name: "📜 Scarica Fandom" }).click();
      await finche(() => p.getByText(/📜 Fandom sul dispositivo: /).count(), 20000, "Fandom non scende");
      await p.getByRole("button", { name: "🖼 Misura le illustrazioni" }).click();
      await p.getByRole("button", { name: /🖼 Scarica a 250 px · circa/ }).click({ timeout: 8000 });
      await finche(() => miniature().length > 0, 10000, "dopo l'elenco le illustrazioni non vengono chieste");
      await p.reload();
      // ripartono da sole: la richiesta interrotta si rifà, e il giro finisce
      await finche(() => miniature().length >= 2, 15000, "dopo il ricaricamento le illustrazioni non ripartono");
      await p.getByRole("button", { name: /^Impostazioni/ }).first().click();
      await finche(() => p.getByText(/Illustrazioni sul dispositivo · un'illustrazione · 250 px/).count(), 20000, "le illustrazioni riprese non finiscono");
      if (elenchi().length !== 1) throw new Error(`l'elenco dei file chiesto ${elenchi().length} volte: e' ripartito da capo`);
      // rimosse le illustrazioni, il riepilogo in cima lo dice subito
      await p.getByRole("button", { name: "Rimuovi le illustrazioni" }).click();
      await p.getByRole("button", { name: "Rimuovi le illustrazioni" }).click();
      await finche(() => p.getByText(/^Da scaricare: .*Altre illustrazioni di Fandom\.$/).count(), 5000, "rimosse le illustrazioni, il riepilogo non lo dice");
      return { guasti: d.guasti, nota: `${miniature().length} richieste di miniature, un elenco solo` };
    },
  },
  {
    nome: "Fandom scende accanto a Lexicanum, e nella scheda la sua voce si legge dietro l'avviso coi libri che vengono dopo",
    async fai({ browser }) {
      const d = await dispositivo(browser, { misura: TABLET, lexicanum: lexicanumFinto([]), fandom: fandomFinto([]) });
      const { p } = d;
      await p.goto(URL_APP);
      await p.getByRole("button", { name: /^Impostazioni/ }).first().click();
      await p.getByRole("button", { name: "⚔ Scarica Lexicanum" }).click();
      await p.getByRole("button", { name: "📜 Scarica Fandom" }).click();
      await finche(() => p.getByText(/📜 Fandom sul dispositivo: /).count(), 20000, "Fandom non scende");
      await finche(() => p.getByText(/⚔ Lexicanum sul dispositivo: /).count(), 20000, "Lexicanum non scende");
      // le immagini: prima si misurano e si dice il peso, poi si scaricano
      await p.getByRole("button", { name: "🖼 Misura le immagini" }).last().click();
      await p.getByRole("button", { name: /🖼 Scarica le immagini · circa/ }).click({ timeout: 8000 });
      await finche(() => p.getByText(/Immagini di Fandom sul dispositivo: un'immagine/).count(), 15000, "le immagini di Fandom non scendono");
      // le altre illustrazioni: misurate, poi scelta la misura col suo peso
      await p.getByRole("button", { name: "🖼 Misura le illustrazioni" }).click();
      await p.getByRole("button", { name: /🖼 Scarica a 400 px · circa/ }).waitFor({ timeout: 8000 });
      await p.getByRole("button", { name: /🖼 Scarica a 250 px · circa/ }).click();
      await finche(() => p.getByText(/Illustrazioni sul dispositivo · un'illustrazione · 250 px/).count(), 15000, "le illustrazioni di Fandom non scendono");
      await finche(() => p.getByText("Tutto è sul dispositivo: non c'è altro da scaricare.").count(), 5000, "con tutto sceso il riepilogo non dice che non c'e' altro");
      const chiesteIll = await p.evaluate(() => performance.getEntriesByType("resource").map((r) => r.name).filter((n) => n.includes("static.wikia")));
      if (chiesteIll.some((n) => /Aquila|Loken\.jpg/.test(decodeURIComponent(n)) && n.includes("scale-to-width-down"))) throw new Error(`scaricate anche l'icona o la principale: ${chiesteIll.join(" ")}`);
      await p.keyboard.press("Escape");
      const frase = "I was there, the day that Horus slew the Emperor. Garviel Loken watched the Warmaster from the deck.";
      await importa(p, "Horus Rising.epub", await epub({ titolo: "Horus Rising", autore: "Dan Abnett", frase, lingua: "en" }), "application/epub+zip");
      await p.getByText("Horus Rising").first().click();
      await p.getByRole("button", { name: /Apri il libro|Comincia/ }).first().click();
      await definisci(p, "Loken");
      // le due schede; la prima e' Lexicanum
      await finche(() => p.getByRole("tab", { name: /Fandom/ }).count(), 8000, "la scheda di Fandom non compare");
      // L'IMMAGINE ACCANTO ALLA DEFINIZIONE: su Lexicanum quella di Fandom,
      // velata finche' non la tocchi
      const ritratto = () => p.locator('img[alt="Garviel Loken"]').evaluate((img) => img.complete && img.naturalWidth === 30).catch(() => false);
      await p.getByRole("button", { name: "🖼 Immagine velata · mostrala" }).waitFor({ timeout: 5000 });
      if (await p.locator('img[alt="Garviel Loken"]').count()) throw new Error("accanto alla definizione di Lexicanum l'immagine non e' velata");
      await p.getByRole("button", { name: "🖼 Immagine velata · mostrala" }).click();
      await finche(ritratto, 5000, "toccato il velo, l'immagine non compare accanto alla definizione");
      await p.getByText("da Fandom", { exact: true }).waitFor({ timeout: 3000 });
      await p.getByRole("tab", { name: /Fandom/ }).click();
      const avviso = await finche(async () => (await p.getByText(/Questa voce può spoilerare/).count()) && p.getByText(/Questa voce può spoilerare/).first().locator("..").textContent(), 5000, "l'avviso di Fandom non compare");
      // su Fandom sta dietro l'avviso, come il testo: si guarda dopo che i
      // byte, dal dispositivo, hanno avuto il tempo di arrivare
      await aspetta(1000);
      if (await p.locator('img[alt="Garviel Loken"]').count()) throw new Error("l'immagine di Fandom sta in vista davanti all'avviso");
      if (!/False Gods/.test(avviso) || /left for dead/.test(await p.locator("body").textContent())) throw new Error(`avviso sbagliato o testo gia' in vista: ${avviso}`);
      await p.getByText(/Questa voce può spoilerare/).first().click();
      await finche(() => p.getByText(/originally the Captain/).count(), 5000, "toccato l'avviso, l'incipit non compare");
      await finche(ritratto, 5000, "toccato l'avviso, l'immagine di Fandom non compare accanto alla definizione");
      // piu' grande di prima, e un tocco la apre in grande con le altre illustrazioni della voce
      const tastoImmagini = p.getByRole("button", { name: "Guarda le immagini di Garviel Loken (2)" });
      const larga = (await tastoImmagini.boundingBox())?.width || 0;
      if (larga < 200) throw new Error(`l'immagine accanto alla definizione e' larga ${larga} px`);
      if (!(await tastoImmagini.textContent()).includes("+1")) throw new Error("l'immagine non dice che ce n'e' un'altra");
      await tastoImmagini.click();
      await finche(() => testoAvviso(p, /1 di 2/), 3000, "toccata l'immagine, non si apre in grande con le altre");
      await p.getByRole("button", { name: "Illustrazione dopo" }).click();
      await p.getByRole("dialog", { name: "Loken e Torgaddon" }).waitFor({ timeout: 3000 });
      // grande quanto lo schermo, anche se l'immagine scesa e' piccola
      const vista = await p.getByRole("dialog", { name: "Loken e Torgaddon" }).locator("img").boundingBox();
      if (!vista || vista.width < 450 || vista.height < 700) throw new Error(`in grande l'illustrazione e' ${Math.round(vista?.width)}×${Math.round(vista?.height)} px`);
      await p.getByRole("button", { name: "Chiudi l'illustrazione" }).click();
      if (!(await p.getByRole("button", { name: "Leggi la voce ▸" }).count())) throw new Error("chiusa l'illustrazione, la scheda non c'e' piu'");
      // la voce intera si apre gia' letta: l'avviso si accetta una volta
      await p.getByRole("button", { name: "Leggi la voce ▸" }).click();
      await finche(() => p.getByText(/left for dead/).count(), 5000, "la voce intera di Fandom non si apre");
      // il ritratto di Loken, dal dispositivo, in cima alla voce
      await finche(
        () => p.locator('img[alt="Garviel Loken"]').evaluate((img) => img.complete && img.naturalWidth === 30 && img.src.startsWith("blob:")).catch(() => false),
        5000,
        "l'immagine principale della voce non c'e'"
      );
      await finche(() => p.getByText("Fandom · sul dispositivo").count(), 5000, "la voce non dice da quale wiki viene");
      // in fondo alla voce, le altre illustrazioni: un tocco le apre in grande
      await p.getByRole("button", { name: "Apri in grande: Loken e Torgaddon" }).click({ timeout: 5000 });
      await p.getByRole("dialog", { name: "Loken e Torgaddon" }).waitFor({ timeout: 3000 });
      await p.getByRole("button", { name: "Chiudi l'illustrazione" }).click();
      // e la voce di Lexicanum, che l'immagine non la segna, prende quella di
      // Fandom: velata col riquadro, e detta da dove viene
      await p.getByRole("button", { name: "◂ La parola" }).click();
      await p.getByRole("tab", { name: /Lexicanum/ }).click();
      await p.getByRole("button", { name: "Leggi la voce ▸" }).click();
      if (await p.locator('img[alt="Garviel Loken"]').count()) throw new Error("l'immagine di Fandom non e' velata nella voce di Lexicanum");
      await p.getByText(/Riquadro dei dati e immagine velati/).click();
      await finche(() => p.locator('img[alt="Garviel Loken"]').evaluate((img) => img.complete && img.naturalWidth === 30).catch(() => false), 5000, "nella voce di Lexicanum l'immagine di Fandom non c'e'");
      await p.getByText("Immagine da Fandom").waitFor({ timeout: 3000 });
      // e le altre illustrazioni di Fandom, velate anche loro
      if (await p.getByRole("button", { name: /Apri in grande/ }).count()) throw new Error("le illustrazioni di Fandom non sono velate nella voce di Lexicanum");
      await p.getByText(/Un'illustrazione da Fandom velata/).click();
      await p.getByRole("button", { name: "Apri in grande: Loken e Torgaddon" }).waitFor({ timeout: 3000 });
      return { guasti: d.guasti };
    },
  },
  {
    // chiesto dal lettore, tolta la parte manga: «notifiche quando esce un
    // nuovo libro, un nuovo capitolo, delle mie serie e dei miei autori» —
    // solo quel che sceglie lui. La notifica la manda il guscio (Novita.java);
    // qui si recita il guscio e si guarda cosa gli arriva
    nome: "le novità: dalla raccolta si segue una saga, la lista va al guscio, le Impostazioni dicono lo stato e si smette con un tocco",
    async fai({ browser }) {
      const libri = [1, 2].map((i) => ({ id: `bk${i}`, title: `Berserk ${i}`, author: "Kentaro Miura", saga: "Berserk", sagaOrder: i, fileType: "cbz", tipo: "manga", addedAt: i }));
      const d = await dispositivo(browser, {
        misura: TABLET,
        prima: `
          Object.defineProperty(document, "referrer", { configurable: true, get: () => "android-app://it.bookcompanion.app/" });
          localStorage.getItem("bc_books") || localStorage.setItem("bc_books", ${JSON.stringify(JSON.stringify(libri))});
          localStorage.setItem("bc_vista", JSON.stringify({ aspetto: "raccolte" }));`,
      });
      const { p } = d;
      await p.goto(`${URL_APP}?apri=libreria`);
      // il guscio saluta, e alle novita' risponde lo stato delle notifiche
      await p.evaluate(() => {
        const canale = new MessageChannel();
        window.__novita = [];
        canale.port1.onmessage = (m) => {
          if (typeof m.data !== "string" || !m.data.startsWith('{"novita"')) return;
          window.__novita.push(JSON.parse(m.data).novita);
          canale.port1.postMessage("grimorio:novita:si");
        };
        window.dispatchEvent(new MessageEvent("message", { data: "", origin: `android-app://${location.host}`, ports: [canale.port2] }));
        canale.port1.postMessage("grimorio:pronto");
      });
      await aspetta(500);
      if ((await p.evaluate(() => window.__novita.length)) !== 0) throw new Error("al saluto, senza niente da seguire, la lista e' partita");
      await p.getByRole("button", { name: /^Berserk/ }).first().click();
      const tasto = p.getByRole("button", { name: "🔕 Avvisami delle novità" });
      await finche(() => tasto.count(), 5000, "nella raccolta di una saga non c'e' il tasto delle novita'");
      if ((await tasto.getAttribute("title")) !== "Avviso: i capitoli nuovi") throw new Error(`il tasto di una saga di manga promette altro: ${await tasto.getAttribute("title")}`);
      await tasto.click();
      await finche(() => p.evaluate(() => window.__novita.some((l) => l.length === 1 && l[0].id === "saga:berserk" && l[0].tipo === "manga" && l[0].titolo === "Berserk")), 5000, "la saga seguita non arriva al guscio");
      await finche(() => p.getByRole("button", { name: "🔔 Ti avviso delle novità" }).count(), 3000, "il tasto non dice che la saga e' seguita");
      // le Impostazioni: lo stato che il guscio ha detto, e cosa si segue
      await p.getByRole("button", { name: /^Impostazioni/ }).first().click();
      await finche(() => p.getByText(/🔔 1 raccolta seguita: ogni qualche ora/).count(), 5000, "le Impostazioni non dicono che gli avvisi sono accesi");
      if (!(await p.getByText("capitoli nuovi · MangaDex").count())) throw new Error("le Impostazioni non dicono cosa si guarda della saga");
      await p.getByRole("button", { name: "Smetti di seguire Berserk" }).click();
      await finche(() => p.evaluate(() => window.__novita.at(-1)?.length === 0), 5000, "smettendo, la lista vuota non arriva al guscio");
      await finche(() => p.getByText(/Non segui ancora niente/).count(), 3000, "smettendo, le Impostazioni non lo dicono");
      if ((await p.evaluate(() => localStorage.getItem("bc_novita"))) !== "[]") throw new Error("la lista non si e' svuotata");
      return { guasti: d.guasti };
    },
  },
  {
    // chiesto dal lettore: «come fa a sapere della raccolta Cosmoverse chi
    // e' l'autore e cosa ne uscira' dopo? … non riesci a riconoscermi
    // nessuna saga?». Seguita, la saga si cerca su Wikidata dai TITOLI (il
    // nome «Cosmoverse» Wikidata non lo conosce) e al guscio va la serie
    nome: "le novità di una saga: Wikidata la riconosce dai titoli dei volumi, la raccolta lo dice e al guscio va la serie",
    async fai({ browser }) {
      const libri = ["The Way of Kings", "Words of Radiance"].map((title, i) => ({ id: `sl${i}`, title, author: "Brandon Sanderson", saga: "Cosmoverse", sagaOrder: i + 1, fileType: "epub", addedAt: i + 1 }));
      const chieste = [];
      const etichetta = (en) => ({ labels: { en: { value: en } } });
      const d = await dispositivo(browser, {
        misura: TABLET,
        prima: `
          Object.defineProperty(document, "referrer", { configurable: true, get: () => "android-app://it.bookcompanion.app/" });
          localStorage.getItem("bc_books") || localStorage.setItem("bc_books", ${JSON.stringify(JSON.stringify(libri))});
          localStorage.setItem("bc_vista", JSON.stringify({ aspetto: "raccolte" }));`,
        wikidata: async (q) => {
          chieste.push(q.get("action"));
          if (q.get("action") === "wbsearchentities") return { search: q.get("search") === "The Way of Kings" ? [{ id: "Q1" }] : [] };
          if (q.get("action") === "query") return { query: { search: /P179=Q7766706/.test(q.get("srsearch")) ? [{ title: "Q1" }, { title: "Q2" }, { title: "Q3" }] : [] } };
          const tutte = {
            Q1: { ...etichetta("The Way of Kings"), claims: { P179: [{ mainsnak: { datavalue: { value: { id: "Q7766706" } } } }] } },
            Q2: etichetta("Words of Radiance"),
            Q3: etichetta("Oathbringer"),
            Q7766706: etichetta("The Stormlight Archive"),
          };
          return { entities: Object.fromEntries(q.get("ids").split("|").filter((id) => tutte[id]).map((id) => [id, tutte[id]])) };
        },
      });
      const { p } = d;
      await p.goto(`${URL_APP}?apri=libreria`);
      await p.evaluate(() => {
        const canale = new MessageChannel();
        window.__novita = [];
        canale.port1.onmessage = (m) => {
          if (typeof m.data !== "string" || !m.data.startsWith('{"novita"')) return;
          window.__novita.push(JSON.parse(m.data).novita);
          canale.port1.postMessage("grimorio:novita:si");
        };
        window.dispatchEvent(new MessageEvent("message", { data: "", origin: `android-app://${location.host}`, ports: [canale.port2] }));
        canale.port1.postMessage("grimorio:pronto");
      });
      await p.getByRole("button", { name: /^Cosmoverse/ }).first().click();
      const tasto = p.getByRole("button", { name: "🔕 Avvisami delle novità" });
      await finche(() => tasto.count(), 5000, "nella raccolta della saga non c'e' il tasto delle novita'");
      if (chieste.length) throw new Error("Wikidata si e' chiesto prima di seguire la saga");
      await tasto.click();
      await finche(() => p.getByText("Su Wikidata: «The Stormlight Archive», 3 volumi. Ti avviso dei volumi nuovi e dei libri nuovi di Brandon Sanderson, anche fuori dalla saga.").count(), 8000, "la raccolta non dice la serie trovata su Wikidata");
      await finche(() => p.evaluate(() => window.__novita.some((l) => l.length === 1 && l[0].tipo === "serie" && l[0].wikidata.join() === "Q7766706" && l[0].autori.join() === "Brandon Sanderson")), 5000, "la serie e i suoi autori non arrivano al guscio");
      if ((await p.getByRole("button", { name: "🔔 Ti avviso delle novità" }).getAttribute("title")) !== "Avviso: i volumi nuovi di «The Stormlight Archive» (Wikidata) e i libri nuovi di Brandon Sanderson") throw new Error("il tasto non dice cosa guarda");
      const quante = chieste.length;
      await p.getByRole("button", { name: /Tutte le raccolte/ }).click();
      await p.getByRole("button", { name: /^Cosmoverse/ }).first().click();
      await finche(() => p.getByText(/Su Wikidata: «The Stormlight Archive»/).count(), 5000, "riaperta, la raccolta non dice piu' la serie");
      if (chieste.length !== quante) throw new Error("riaperta la raccolta, la saga si e' cercata di nuovo");
      await p.getByRole("button", { name: /^Impostazioni/ }).first().click();
      await finche(() => p.getByText("volumi nuovi di «The Stormlight Archive» · Wikidata; libri nuovi di Brandon Sanderson · Open Library").count(), 5000, "le Impostazioni non dicono la serie seguita");
      return { guasti: d.guasti };
    },
  },
];

// OGNI ATTESA HA UN TETTO, anche quelle delle prove: una scena che non
// finisce, o un server che non si chiude perche' il browser tiene ancora
// una connessione aperta, teneva la CI appesa per ore senza dire dove
// (successo sulla PR della conversione dei CBR: `npm run e2e` fermo da
// venti minuti, e il log arriva solo a corsa finita).
const TETTO_SCENA = 180_000;
const TETTO_CHIUSURA = 10_000;
const TETTO_TUTTO = 12 * 60_000;
const entro = (p, ms, perche) => {
  let t;
  return Promise.race([p, new Promise((_, ko) => (t = setTimeout(() => ko(new Error(`${perche} (dopo ${ms / 1000} s)`)), ms)))]).finally(() => clearTimeout(t));
};

async function principale() {
  setTimeout(() => {
    console.log(`✗ le prove non finiscono in ${TETTO_TUTTO / 60_000} minuti`);
    process.exit(1);
  }, TETTO_TUTTO).unref();
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
  // `SCENA=parola npm run e2e` fa girare solo le scene che la contengono
  for (const scena of SCENE.filter((x) => !process.env.SCENA || x.nome.includes(process.env.SCENA))) {
    // ogni scena col suo cloud vuoto: una non eredita i libri dell'altra
    const db = await avviaSupabase(PORTA_DB);
    const t0 = Date.now();
    try {
      const { guasti = [], nota = "" } = await entro(scena.fai({ browser, db }), TETTO_SCENA, "la scena non finisce");
      if (guasti.length) throw new Error(`guasti nella pagina: ${guasti.join(" | ")}`);
      console.log(`✓ ${scena.nome} (${((Date.now() - t0) / 1000).toFixed(1)} s)${nota ? ` — ${nota}` : ""}`);
    } catch (e) {
      cadute += 1;
      console.log(`✗ ${scena.nome} — ${e.message.split("\n")[0]}`);
    } finally {
      // prima i browser, che tengono aperte le connessioni; poi il server
      for (const c of browser.contexts()) await entro(c.close(), TETTO_CHIUSURA, "un browser non si chiude").catch((e) => console.log(`  ${e.message}`));
      await entro(db.chiudi(), TETTO_CHIUSURA, "il Supabase finto non si chiude").catch((e) => console.log(`  ${e.message}`));
    }
  }
  await entro(browser.close(), TETTO_CHIUSURA, "il browser non si chiude").catch((e) => console.log(e.message));
  server.httpServer.closeAllConnections?.();
  await entro(new Promise((ok) => server.httpServer.close(ok)), TETTO_CHIUSURA, "il server dell'app non si chiude").catch((e) => console.log(e.message));
  console.log(cadute ? `\n${cadute} ${cadute === 1 ? "scena caduta" : "scene cadute"}` : `\n${SCENE.length} scene, tutte in piedi`);
  process.exit(cadute ? 1 : 0);
}

await principale();
