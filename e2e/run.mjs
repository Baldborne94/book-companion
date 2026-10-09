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
import { fumetto, fumettoGrosso, fumettoLungo, epub, pdf, wav, FRASE, mondoDisco } from "./libri.mjs";
import { avviaDrive, driveNelBrowser } from "./driveFinto.mjs";
import { rar4 } from "../test/rar-finto.mjs";

// le richieste del service worker passano dalle rotte del contesto solo
// cosi' (Chromium): servono alla scena della melodia che suona mentre scende
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = "1";

const PORTA_DB = 4599;
const PORTA_APP = 4190;
const PORTA_DRIVE = 4598;
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
async function dispositivo(browser, { sessione = false, prima = null, catalogo = null, drive = null, oracolo = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.route(
    (url) => !/^(localhost|127\.0\.0\.1)$/.test(url.hostname),
    async (route) => {
      const url = route.request().url();
      if (oracolo && /api\.anthropic\.com/.test(url)) return route.fulfill({ json: await oracolo(JSON.parse(route.request().postData() || "{}")) });
      if (catalogo && /openlibrary\.org/.test(url)) {
        const json = await catalogo(url);
        if (json) return route.fulfill({ json });
      }
      return route.abort();
    }
  );
  if (sessione) await ctx.addInitScript(sessioneFinta);
  if (prima) await ctx.addInitScript(prima);
  if (drive) await ctx.addInitScript(driveNelBrowser, { porta: PORTA_DRIVE, ...drive });
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
      if (ep.da !== "tablet" || !("pagina" in ep.f) || !("byte" in ep.f)) throw new Error(`apertura dell'ePub misurata male: ${JSON.stringify(ep)}`);
      const registro = await d.p.evaluate(() => JSON.parse(localStorage.getItem("bc_errori") || "[]"));
      return { guasti: [...d.guasti, ...registro.map((e) => `registro: ${e.m}`)], nota: tempi.map((x) => `${x.c} ${Object.values(x.f).reduce((a, b) => a + b, 0)} ms`).join(" · ") };
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
      if (ap.da !== "tablet" || !["codice", "byte", "libro", "pagina"].every((k) => k in ap.f)) throw new Error(`apertura del PDF misurata male: ${JSON.stringify(ap)}`);
      const registro = await d.p.evaluate(() => JSON.parse(localStorage.getItem("bc_errori") || "[]"));
      return { guasti: [...d.guasti, ...registro.map((e) => `registro: ${e.m}`)], nota: Object.entries(ap.f).map(([k, ms]) => `${k} ${ms} ms`).join(" + ") };
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
      for (const nome of ["Pioggia", "Camino", "Arpa"]) await d.p.setInputFiles('input[accept="audio/*"]', { name: `${nome}.wav`, mimeType: "audio/wav", buffer: wav() });
      await finche(() => d.p.getByText("Arpa", { exact: true }).count(), 10000, "le melodie non entrano");
      await d.p.getByRole("button", { name: "＋ Nuova raccolta" }).click();
      await d.p.getByPlaceholder(/Come la chiami/).fill("Notti");
      await d.p.getByRole("button", { name: "✧ Crea" }).click();
      for (const nome of ["Pioggia", "Camino", "Arpa"]) await d.p.getByRole("button", { name: nome }).first().click();
      await d.p.getByRole("button", { name: "Fatto" }).first().click();

      // il brano scelto dalla raccolta suona, e la raccolta lo ricorda
      await d.p.getByRole("button", { name: "≡ Brani" }).click();
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
      await pc.p.getByRole("button", { name: "＋ Da YouTube" }).click();
      await pc.p.getByPlaceholder("Link YouTube della melodia…").fill("https://www.youtube.com/watch?v=abcdefghijk");
      await pc.p.getByPlaceholder(/Nome/).fill("Pioggia e camino");
      await pc.p.getByRole("button", { name: "☆ Custodisci" }).click();
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
    // chiesto dal lettore: «la musica la devi scaricare prima di
    // riprodurla?». Si': la melodia di Drive scendeva intera, e solo dopo
    // suonava. Ora il service worker gira a Drive le richieste a pezzi
    // dell'<audio> (`public/melodia-sw.js`), e la copia per il dispositivo
    // scende dopo, quando gia' suona. Drive finto e lento: 2,4 MB a 200 KB/s
    nome: "una melodia di Drive suona mentre scende, e poi resta sul dispositivo",
    async fai({ browser }) {
      const bytes = wav(300);
      const banda = 200_000;
      const drv = await avviaDrive(PORTA_DRIVE, { m1: bytes, m2: wav(20) }, { banda });
      try {
        const d = await dispositivo(browser, { drive: { libri: [], mappa: {} } });
        await d.ctx.addInitScript((n) => {
          if (localStorage.getItem("bc_music_favs")) return;
          localStorage.setItem("bc_drive_client", "123-abc.apps.googleusercontent.com");
          localStorage.setItem("bc_drive_melodie", JSON.stringify({ T1: { id: "m1" }, T2: { id: "m2" } }));
          localStorage.setItem(
            "bc_music_favs",
            JSON.stringify([
              { id: "f1", name: "Pioggia lontana", trackId: "T1", drive: true, size: n, addedAt: 1, updatedAt: 1 },
              { id: "f2", name: "Camino", trackId: "T2", drive: true, size: 160044, addedAt: 2, updatedAt: 2 },
            ])
          );
        }, bytes.length);
        // anche il service worker chiede a googleapis: lo si gira al Drive finto
        const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "*" };
        await d.ctx.route(/^https:\/\/www\.googleapis\.com\/drive\/v3\//, (r) =>
          r.request().method() === "OPTIONS"
            ? r.fulfill({ status: 204, headers: cors })
            : r.fulfill({ status: 307, headers: { ...cors, Location: r.request().url().replace("https://www.googleapis.com", `http://localhost:${PORTA_DRIVE}`) } })
        );
        await d.p.goto(`${URL_APP}?apri=musica`);
        // il service worker comanda la pagina solo dalla seconda apertura
        await d.p.evaluate(() => navigator.serviceWorker.ready);
        await d.p.goto(`${URL_APP}?apri=musica`);
        await finche(() => d.p.evaluate(() => !!navigator.serviceWorker.controller), 10000, "il service worker non comanda la pagina");
        await finche(() => d.p.getByText("Pioggia lontana", { exact: true }).count(), 10000, "la melodia di Drive non c'e'");
        const t0 = Date.now();
        await d.p.getByText("Pioggia lontana", { exact: true }).first().click();
        await finche(() => d.p.evaluate(() => (document.querySelector("audio")?.currentTime || 0) > 0.3), 30000, "la melodia non suona");
        const parte = (Date.now() - t0) / 1000;
        const intera = bytes.length / banda;
        const src = await d.p.evaluate(() => document.querySelector("audio").getAttribute("src") || "");
        if (!src.startsWith("/__melodia/m1")) throw new Error(`la melodia non suona a pezzi da Drive (src ${src.slice(0, 40)})`);
        if (parte > intera / 3) throw new Error(`la melodia parte dopo ${parte.toFixed(1)} s: intera scende in ${intera.toFixed(1)} s`);
        // salto avanti: un pezzo lontano, chiesto da li' e non da capo
        const t1 = Date.now();
        await d.p.evaluate(() => (document.querySelector("audio").currentTime = 250));
        await finche(() => d.p.evaluate(() => document.querySelector("audio").currentTime > 250.3), 15000, "il salto nel brano non suona");
        const salto = (Date.now() - t1) / 1000;
        if (salto > intera / 3) throw new Error(`il salto a 250 s suona dopo ${salto.toFixed(1)} s: il brano si rilegge da capo`);
        // la copia per il dispositivo, scesa dopo
        const copia = () =>
          d.p.evaluate(
            () =>
              new Promise((ok) => {
                const r = indexedDB.open("bc_library");
                r.onsuccess = () => {
                  const db = r.result;
                  if (!db.objectStoreNames.contains("tracks")) return ok(0);
                  const g = db.transaction("tracks").objectStore("tracks").get("T1");
                  g.onsuccess = () => ok(g.result?.size || 0);
                  g.onerror = () => ok(0);
                };
                r.onerror = () => ok(0);
              })
          );
        const tenuta = await finche(copia, 40000, "la melodia non resta sul dispositivo");
        if (tenuta !== bytes.length) throw new Error(`sul dispositivo ${tenuta} byte, su Drive ${bytes.length}`);
        // Drive che non risponde ai pezzi: la melodia scende intera, come prima
        await d.ctx.unrouteAll({ behavior: "ignoreErrors" });
        await d.ctx.route(/^https:\/\/www\.googleapis\.com\//, (r) => r.abort());
        await d.p.getByText("Camino", { exact: true }).first().click();
        await finche(
          () => d.p.evaluate(() => /^blob:/.test(document.querySelector("audio")?.getAttribute("src") || "") && document.querySelector("audio").currentTime > 0.3),
          30000,
          "senza i pezzi la melodia non scende intera"
        );
        return { guasti: d.guasti, nota: `suona dopo ${parte.toFixed(1)} s (intera: ${intera.toFixed(1)} s), salto a 250 s in ${salto.toFixed(1)} s, copia di ${(tenuta / 1e6).toFixed(1)} MB sul dispositivo; senza pezzi scende intera` };
      } finally {
        await drv.chiudi();
      }
    },
  },
  {
    // chiesto dal lettore insieme a quella sopra: «Scarica la raccolta»
    // porta sul dispositivo le melodie di Drive che mancano, una alla volta,
    // e dopo suonano anche senza Drive
    nome: "«Scarica la raccolta» porta qui le melodie di Drive, e suonano senza rete",
    async fai({ browser }) {
      const uno = wav(60);
      const due = wav(40);
      const drv = await avviaDrive(PORTA_DRIVE, { m1: uno, m2: due });
      let chiuso = false;
      try {
        const d = await dispositivo(browser, { drive: { libri: [], mappa: {} } });
        await d.ctx.addInitScript((misure) => {
          if (localStorage.getItem("bc_music_favs")) return;
          localStorage.setItem("bc_drive_client", "123-abc.apps.googleusercontent.com");
          localStorage.setItem("bc_drive_melodie", JSON.stringify({ T1: { id: "m1" }, T2: { id: "m2" } }));
          localStorage.setItem(
            "bc_music_favs",
            JSON.stringify([
              { id: "f1", name: "Pioggia lontana", trackId: "T1", drive: true, size: misure[0], addedAt: 1, updatedAt: 1 },
              { id: "f2", name: "Camino", trackId: "T2", drive: true, size: misure[1], addedAt: 2, updatedAt: 2 },
            ])
          );
          localStorage.setItem("bc_music_lists", JSON.stringify([{ id: "r1", name: "Taverna", brani: ["f1", "f2"], addedAt: 1, updatedAt: 1 }]));
        }, [uno.length, due.length]);
        await d.p.goto(`${URL_APP}?apri=musica`);
        await finche(() => testoAvviso(d.p, /2 brani solo su Google Drive/), 10000, "la raccolta non dice cosa sta solo su Drive");
        await d.p.getByRole("button", { name: "⬇ Scarica la raccolta" }).click();
        await finche(() => testoAvviso(d.p, /Scarico la raccolta: \d di 2/), 5000, "la barra del lavoro non dice a che punto e'");
        await finche(() => testoAvviso(d.p, /2 melodie ora stanno sul dispositivo/), 20000, "le melodie non scendono");
        await finche(async () => !(await d.p.getByRole("button", { name: "⬇ Scarica la raccolta" }).count()), 5000, "il tasto resta dopo che e' tutto qui");
        // Drive spento: la raccolta suona lo stesso
        await drv.chiudi();
        chiuso = true;
        await d.p.getByRole("button", { name: "▶ In ordine" }).click();
        await finche(() => d.p.evaluate(() => (document.querySelector("audio")?.currentTime || 0) > 0.3), 10000, "senza Drive la raccolta scaricata non suona");
        return { guasti: d.guasti, nota: "2 melodie scese una alla volta, il tasto sparisce, e con Drive spento la raccolta suona" };
      } finally {
        if (!chiuso) await drv.chiudi();
      }
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
      for (const nome of ["Pioggia", "Camino", "Arpa"]) await d.p.setInputFiles('input[accept="audio/*"]', { name: `${nome}.wav`, mimeType: "audio/wav", buffer: wav(200) });
      await finche(() => d.p.getByText("Arpa", { exact: true }).count(), 10000, "le melodie non entrano");
      await d.p.getByRole("button", { name: "▶ Tutte", exact: true }).click();
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
      await d.p.getByRole("button", { name: "Arpa" }).first().click();
      await dove(3);
      return { guasti: d.guasti, nota: `⏭ ⏮ e il riavvolgimento (${riavvolto.toFixed(1)} s), barra a ${meta.toFixed(0)} s, «Arpa» dai prossimi` };
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
      for (const nome of ["D&D Dark Ambient Campaign Music", "Camino"]) await p.setInputFiles('input[accept="audio/*"]', { name: `${nome}.wav`, mimeType: "audio/wav", buffer: wav(200) });
      await finche(() => p.getByText("Camino", { exact: true }).count(), 10000, "le melodie non entrano");
      await p.getByRole("button", { name: "▶ Tutte", exact: true }).click();
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
        await p.getByRole("button", { name: "Chiudi il libro" }).click();
        await finche(async () => !(await p.locator('[aria-label="Chiudi il libro"]').count()), 5000, `«${titolo}» non si chiude`);
      }
      await ctx.close();
      return { guasti, nota: `due righe: ${note.join(", ")}` };
    },
  },
  {
    // segnalato dal lettore dal PC: «la sincronizzazione è ancora molto
    // lenta», ferma su «Guardo i libri su Google Drive». L'elenco di Drive
    // teneva ogni file con un'estensione — il suo Drive ha 1,5 TB di foto e
    // altro — e a ogni giro si rileggeva e si riscriveva intero. Ora tiene
    // solo libri, musica e cartelle, e il giro si misura per il rapporto
    nome: "il giro di Drive tiene solo libri, musica e cartelle, e si misura",
    async fai({ browser }) {
      const elenco = [
        { id: "L1", name: "Mort.epub", size: "1000", mimeType: "application/epub+zip", parents: ["C1"] },
        { id: "L2", name: "Hush.cbz", size: "2000", mimeType: "application/zip", parents: ["C1"] },
        { id: "C1", name: "book-companion", mimeType: "application/vnd.google-apps.folder" },
        ...Array.from({ length: 3000 }, (_, i) => ({ id: `F${i}`, name: `IMG_${i}.jpg`, size: "3000000", mimeType: "image/jpeg", parents: ["P"] })),
      ];
      const drv = await avviaDrive(PORTA_DRIVE, {}, { elenco });
      try {
        const d = await dispositivo(browser, {
          drive: { libri: [{ id: "m", title: "Mort", fileType: "epub", addedAt: 1 }], mappa: {} },
          prima: () => localStorage.setItem("bc_drive_client", "123-abc.apps.googleusercontent.com"),
        });
        await d.p.goto(URL_APP);
        // senza sessione il giro di solo Drive parte al ritorno della rete
        await d.p.waitForTimeout(500);
        await d.p.evaluate(() => window.dispatchEvent(new Event("online")));
        const giro = await finche(
          () => d.p.evaluate(() => JSON.parse(localStorage.getItem("bc_tempi") || "[]").find((x) => x.c === "drive")),
          20000,
          "il giro di Drive non e' misurato"
        );
        if (!("elenco" in giro.f) || !("riconosce" in giro.f)) throw new Error(`giro misurato male: ${JSON.stringify(giro)}`);
        if (giro.voci > 10) throw new Error(`l'elenco di Drive tiene ${giro.voci} file: le foto non servono`);
        const tenuti = await d.p.evaluate(
          () =>
            new Promise((ok) => {
              const r = indexedDB.open("bc_library");
              r.onsuccess = () => {
                const g = r.result.transaction("aux").objectStore("aux").get("drive_elenco");
                g.onsuccess = () => ok(Object.keys(g.result?.file || {}).length);
                g.onerror = () => ok(-1);
              };
            })
        );
        if (tenuti !== 3) throw new Error(`sul dispositivo l'elenco di Drive ha ${tenuti} file, non i 3 che servono`);
        return { guasti: d.guasti, nota: `elenco di ${giro.voci} file su ${elenco.length}, ${giro.da}, ${Object.entries(giro.f).map(([k, v]) => `${k} ${v} ms`).join(" + ")}` };
      } finally {
        await drv.chiudi();
      }
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
    nome: "l'Ingresso propone il volume rimesso «Da leggere» e l'inizio del ciclo dopo",
    async fai({ browser }) {
      const d = await dispositivo(browser, { prima: mondoDisco });
      await d.p.goto(URL_APP);
      const nota = await finche(() => testoAvviso(d.p, /Discworld n° 10 · inizia Industrial Revolution · già al 12%/), 15000, "Moving Pictures non e' fra i seguiti");
      await finche(() => testoAvviso(d.p, /^Discworld n° 11 · già al 30%$/), 5000, "Reaper Man, rimesso «Da leggere», non e' fra i seguiti");
      return { guasti: d.guasti, nota };
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
    // segnalato dal lettore: «ci mette parecchi secondi per passare da una
    // pagina all'altra… o tornare indietro». Si tenevano quattro pagine
    // dietro quella a schermo, e da Drive tornarci era un viaggio a voltata.
    nome: "un fumetto letto da Drive torna indietro senza chiedere di nuovo le pagine",
    async fai({ browser }) {
      const bytes = await fumettoGrosso();
      const drv = await avviaDrive(PORTA_DRIVE, { fg: bytes });
      try {
        const d = await dispositivo(browser, {
          drive: { libri: [{ id: "fg", title: "Tavole", fileType: "cbz", addedAt: 1 }], mappa: { fg: { id: "fg", byte: bytes.length } } },
        });
        await d.p.goto(`${URL_APP}?apri=libreria`);
        await d.p.getByText("Tavole").first().click();
        await d.p.getByRole("button", { name: /Apri il libro/ }).first().click();
        // le pagine a schermo, finite e visibili
        const vista = () =>
          d.p.evaluate(() => {
            const ims = [...document.querySelectorAll("img")].filter((x) => /pagina \d+\.png$/.test(x.alt));
            if (!ims.length || ims.some((im) => !im.complete || !im.naturalWidth)) return "";
            return ims.map((x) => x.alt.match(/(\d+)\.png$/)[1]).join("+");
          });
        let ora = await finche(vista, 20000, "il fumetto non si apre");
        const volta = async (tasto) => {
          const prima = ora;
          await d.p.keyboard.press(tasto);
          ora = await finche(async () => {
            const v = await vista();
            return v && v !== prima ? v : "";
          }, 15000, `la voltata da ${prima} non arriva`);
        };
        for (let i = 0; i < 30 && !ora.includes("23"); i++) await volta("ArrowRight");
        if (!ora.includes("23")) throw new Error(`avanti non arriva a pagina 23 (ferma su ${ora})`);
        // ferme anche le pagine preparate avanti, si contano le richieste
        let conti = drv.conti();
        await finche(async () => {
          await aspetta(1000);
          const c = drv.conti();
          const fermo = c.pezzi === conti.pezzi && c.interi === conti.interi;
          conti = c;
          return fermo;
        }, 20000, "Drive non smette di scendere");
        let voltate = 0;
        for (; voltate < 30 && !ora.startsWith("02"); voltate++) await volta("ArrowLeft");
        if (!ora.startsWith("02")) throw new Error(`indietro non arriva a pagina 2 (ferma su ${ora})`);
        const dopo = drv.conti();
        const nuove = dopo.pezzi - conti.pezzi + dopo.interi - conti.interi;
        if (nuove) throw new Error(`tornando indietro di ${voltate} voltate si sono chieste ${nuove} pagine a Drive`);
        return { guasti: d.guasti, nota: `indietro di ${voltate} voltate, nessuna richiesta a Drive` };
      } finally {
        await drv.chiudi();
      }
    },
  },
  {
    // dal rapporto delle voltate del lettore: pagine tutte in memoria, e
    // 108 ms su 111 a DISEGNARLE. La pagina dopo aspetta sotto quella a
    // schermo, e alla voltata dev'essere LO STESSO elemento: un <img> nuovo
    // si rilegge e si ridecodifica (misurato: nessun guadagno). E la pagina
    // che se ne va svanisce col suo elemento, non con una foto su canvas.
    nome: "alla voltata del fumetto la pagina dopo (e tornando, quella prima) era gia' li', e quella di prima svanisce da se'",
    async fai({ browser }) {
      const bytes = await fumettoGrosso();
      const drv = await avviaDrive(PORTA_DRIVE, { fg: bytes });
      try {
        const d = await dispositivo(browser, {
          drive: { libri: [{ id: "fg", title: "Tavole", fileType: "cbz", addedAt: 1 }], mappa: { fg: { id: "fg", byte: bytes.length } } },
        });
        await d.p.goto(`${URL_APP}?apri=libreria`);
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
        await d.p.keyboard.press("ArrowRight");
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
        if (e.via.join() !== "prima") throw new Error(`la pagina di prima non svanisce col suo elemento (${esito})`);
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
        return { guasti: d.guasti, nota: `pagina ${num(pronta)} → ${num(e.pagina)} → ${num(ind.pagina)}: ogni volta la <img> preparata sotto, e quella di prima svanisce da se'` };
      } finally {
        await drv.chiudi();
      }
    },
  },
  {
    // segnalato dal lettore coi Dragonriders of Pern: ogni volume due volte
    // sullo scaffale, una scheda col file e una col triangolo «né qui né nel
    // cloud», e la Manutenzione che non li vedeva («non dovrebbe
    // riconoscermi i doppioni? o anche solo quando reimporto i libri»)
    nome: "un libro reimportato da Drive torna nella scheda che l'aveva perso, e i doppioni dei libri si uniscono",
    async fai({ browser }) {
      const volo = await epub({ titolo: "Dragonflight", autore: "Anne McCaffrey" });
      const quest = await epub({ titolo: "Dragonquest", autore: "Anne McCaffrey" });
      const elenco = [
        { id: "dr", name: "Anne McCaffrey - Dragonflight.epub", size: String(volo.length), mimeType: "application/epub+zip", parents: ["P"] },
        { id: "dq", name: "Dragonquest.epub", size: String(quest.length), mimeType: "application/epub+zip", parents: ["P"], appProperties: { bcId: "q2" } },
      ];
      const drv = await avviaDrive(PORTA_DRIVE, { dr: volo, dq: quest }, { elenco });
      try {
        const autore = "Anne McCaffrey";
        const d = await dispositivo(browser, {
          drive: {
            libri: [
              // l'ebook tolto apposta: reimportandolo, il libro si riapre subito
              { id: "pern", title: "Dragonflight", author: autore, fileType: "epub", addedAt: 1, fileTolto: true },
              { id: "q1", title: "Dragonquest", author: autore, fileType: "epub", addedAt: 2 },
              { id: "q2", title: "Dragonquest", author: autore, fileType: "epub", addedAt: 3 },
            ],
            mappa: { q2: { id: "dq", byte: quest.length } },
            scelta: [elenco[0]],
          },
        });
        await d.p.goto(`${URL_APP}?apri=libreria`);
        await d.p.getByRole("button", { name: /Scegli su Drive/ }).first().click();
        await finche(() => testoAvviso(d.p, /ritrovato il suo file|nuovo tomo|tomi sullo scaffale/), 30000, "l'importazione da Drive non finisce");
        const voli = (await libriDi(d.p)).filter((b) => b.title === "Dragonflight");
        if (voli.length !== 1) throw new Error(`«Dragonflight» sullo scaffale ${voli.length} volte`);
        const mappa = await d.p.evaluate(() => JSON.parse(localStorage.getItem("bc_drive_libri") || "{}"));
        if (mappa.pern?.id !== "dr") throw new Error(`il file non e' tornato nella scheda di prima: ${JSON.stringify(mappa)}`);
        // il segno «ebook tolto» si spegne all'import, non al giro dopo:
        // un avviso solo, non due uno sopra l'altro
        await aspetta(2500);
        if (await testoAvviso(d.p, /ritrovato il suo ebook su Google Drive/)) throw new Error("il segno «ebook tolto» si spegne solo al giro dopo, con un secondo avviso");
        // scelto di nuovo, si dice con quale scheda e' stato riconosciuto
        await d.p.getByRole("button", { name: /Scegli su Drive/ }).first().click();
        await finche(() => testoAvviso(d.p, /«Anne McCaffrey - Dragonflight» \(sullo scaffale come «Dragonflight»\) era già sullo scaffale/), 15000, "scelto di nuovo, non dice con quale scheda e' stato riconosciuto");
        // la coppia che c'era gia': la Manutenzione la vede e la unisce
        await d.p.getByRole("button", { name: /Manutenzione/ }).first().click();
        await d.p.getByRole("button", { name: /Un volume ha una copia in più/ }).first().click({ timeout: 15000 });
        await d.p.getByRole("button", { name: /Unisci i doppioni/ }).first().click();
        const quests = await finche(async () => {
          const q = (await libriDi(d.p)).filter((b) => b.title === "Dragonquest");
          return q.length === 1 && q;
        }, 10000, "i due «Dragonquest» non si uniscono");
        if (quests[0].id !== "q2") throw new Error(`dei due «Dragonquest» e' rimasto quello senza file (${quests[0].id})`);
        return { guasti: d.guasti, nota: "«Dragonflight» ha ritrovato il suo file; dei due «Dragonquest» resta quello col file" };
      } finally {
        await drv.chiudi();
      }
    },
  },
  {
    // segnalato dal lettore con «Batman - Hush (2019)…cbr», 458 MB sul PC
    // e «il file è vuoto» importandolo: l'elenco di Drive lo portava con
    // misura zero (appena caricato), e un file lontano di misura zero si
    // legge vuoto. Si chiede a Drive la misura vera.
    nome: "un file da Drive elencato con misura zero si importa con la misura vera",
    async fai({ browser }) {
      const cbz = Buffer.from(await fumetto());
      const elenco = [
        { id: "B", name: "Batman", mimeType: "application/vnd.google-apps.folder", parents: ["R"] },
        { id: "R", name: "Book-Companion", mimeType: "application/vnd.google-apps.folder", parents: ["root"] },
        { id: "hush", name: "Batman - Hush (2019).cbr", size: "0", mimeType: "application/octet-stream", parents: ["B"] },
      ];
      const drv = await avviaDrive(PORTA_DRIVE, { hush: cbz }, { elenco, misureVere: { hush: String(cbz.length) } });
      try {
        const d = await dispositivo(browser, {
          drive: { libri: [{ id: "x", title: "Un libro di prima", fileType: "epub", addedAt: 1 }], mappa: {}, scelta: [{ id: "B", name: "Batman", mimeType: "application/vnd.google-apps.folder" }] },
        });
        await d.p.goto(`${URL_APP}?apri=libreria`);
        await d.p.getByRole("button", { name: /Scegli su Drive/ }).first().click();
        const libro = await finche(async () => (await libriDi(d.p)).find((b) => /Hush/.test(b.title)), 30000, "«Hush» non entra in biblioteca").catch(async (e) => {
          throw new Error(`${e.message}: ${await testoAvviso(d.p, /Hush/)}`);
        });
        return { guasti: d.guasti, nota: `«${libro.title}» entrato come ${libro.fileType}` };
      } finally {
        await drv.chiudi();
      }
    },
  },
  {
    // segnalato dal lettore coi Walking Dead: «ho navigato un po' ed è
    // sparito il caricamento, poi ci mette davvero troppo a convertire».
    // Nella cartella, accanto a ogni CBR, il CBZ che Colab ha lasciato.
    nome: "una cartella da Drive si importa fuori dalla Libreria, e dei gemelli di Colab entra il CBZ",
    async fai({ browser }) {
      const cbz = Buffer.from(await fumetto());
      const cbr = rar4([["p1.png", Buffer.from("89504e47" + "00".repeat(200), "hex")], ["p2.png", Buffer.from("89504e47" + "11".repeat(200), "hex")]]);
      const vol = (n) => `The Walking Dead Deluxe Vol. 0${n}`;
      const cartella = (id, name, su) => ({ id, name, mimeType: "application/vnd.google-apps.folder", parents: [su] });
      const voce = (id, name, b) => ({ id, name, size: String(b.length), mimeType: "application/octet-stream", parents: ["W"] });
      const elenco = [
        cartella("R", "Book-Companion", "root"),
        cartella("W", "The Walking Dead", "R"),
        voce("r1", `${vol(1)}.cbr`, cbr),
        voce("z1", `${vol(1)}.cbz`, cbz),
        voce("r2", `${vol(2)}.cbr`, cbr),
        voce("z2", `${vol(2)}.cbz`, cbz),
        voce("r3", `${vol(3)}.cbr`, cbr),
      ];
      const drv = await avviaDrive(PORTA_DRIVE, { r1: cbr, z1: cbz, r2: cbr, z2: cbz, r3: cbr }, { elenco, latenza: 400 });
      try {
        const d = await dispositivo(browser, {
          drive: {
            libri: [{ id: "vecchio", title: "Un libro di prima", fileType: "epub", addedAt: 1 }],
            mappa: {},
            scelta: [{ id: "W", name: "The Walking Dead", mimeType: "application/vnd.google-apps.folder" }],
          },
        });
        await d.p.goto(`${URL_APP}?apri=libreria`);
        await d.p.getByRole("button", { name: /Scegli su Drive/ }).first().click();
        // a meta' importazione si esce dalla Libreria: il lavoro si vede ancora
        const riga = await finche(() => testoAvviso(d.p, /Da Google Drive/), 15000, "l'importazione non si vede");
        await d.p.getByRole("button", { name: /Ingresso/ }).first().click();
        await finche(() => testoAvviso(d.p, /Da Google Drive/), 5000, "uscendo dalla Libreria l'importazione sparisce");
        // e intanto la biblioteca cambia: alla fine quel che e' arrivato resta
        await d.p.evaluate(() => {
          const b = JSON.parse(localStorage.getItem("bc_books"));
          localStorage.setItem("bc_books", JSON.stringify([...b, { id: "intruso", title: "Arrivato intanto", fileType: "epub", addedAt: 2 }]));
        });
        const titoli = () => libriDi(d.p).then((l) => l.map((b) => `${b.title} [${b.fileType}]`).sort());
        const tutti = await finche(async () => {
          const t = await titoli();
          return t.filter((x) => /Walking/.test(x)).length >= 3 && t;
        }, 60000, "l'importazione non finisce");
        await aspetta(1500);
        const fine = (await titoli()).join(" · ");
        const atteso = ["Arrivato intanto [epub]", "The Walking Dead Deluxe Vol. 01 [cbz]", "The Walking Dead Deluxe Vol. 02 [cbz]", "The Walking Dead Deluxe Vol. 03 [cbr]", "Un libro di prima [epub]"].join(" · ");
        if (fine !== atteso) throw new Error(`la biblioteca alla fine: ${fine}`);
        if (drv.scesi().some((id) => id === "r1" || id === "r2")) throw new Error(`si sono letti i CBR che hanno il gemello: ${drv.scesi()}`);
        return { guasti: d.guasti, nota: `${tutti.length} libri, «${riga}»` };
      } finally {
        await drv.chiudi();
      }
    },
  },
  {
    // chiesto dal lettore: il login «non mi convince» — due accessi separati,
    // Google che chiede di nuovo ogni ora, il pannello confuso
    nome: "si entra con Google una volta sola, e la chiave di Drive si rinnova senza finestre",
    async fai({ browser, db }) {
      const d = await dispositivo(browser);
      let rinnovi = 0;
      await d.ctx.route("**/api/google-token", (route) => {
        rinnovi += 1;
        const auth = route.request().headers().authorization;
        return route.fulfill({ json: auth === "Bearer a.b.c" ? { chiave: "ya29.dal-server", scade: Date.now() + 3_600_000 } : { motivo: "sessione" }, status: auth === "Bearer a.b.c" ? 200 : 401 });
      });
      const finestre = [];
      d.p.on("request", (r) => /accounts\.google\.com/.test(r.url()) && finestre.push(r.url()));
      const chiave = () => d.p.evaluate(() => JSON.parse(localStorage.getItem("bc_drive_token") || "null")?.chiave || "");
      await d.p.goto(URL_APP);
      await d.p.locator("button[aria-label=Sincronizzazione]:visible").first().click();
      await d.p.getByRole("button", { name: "Entra con Google" }).first().click();
      // da Google (il Supabase finto) e ritorno, gia' dentro
      await finche(async () => (await chiave()) === "ya29.dal-google", 20000, "tornando da Google la chiave di Drive non arriva");
      await finche(() => db.permessi().some((r) => r.user_id === "u1" && r.token === "rt-google"), 10000, "il permesso a lungo termine non si salva nel Supabase");
      const a = db.accessi()[0] || {};
      if (a.provider !== "google" || !/auth\/drive/.test(a.scopes || "") || a.access_type !== "offline" || a.prompt !== "consent") throw new Error(`l'accesso chiesto a Google non e' quello giusto: ${JSON.stringify(a)}`);

      // un'ora dopo: la chiave e' scaduta, e si riapre l'app
      await d.p.evaluate(() => localStorage.setItem("bc_drive_token", JSON.stringify({ chiave: "ya29.dal-google", scade: Date.now() - 1000 })));
      await d.p.goto(URL_APP);
      await finche(async () => (await chiave()) === "ya29.dal-server", 15000, "la chiave scaduta non si rinnova da sola");
      if (finestre.length) throw new Error(`si e' aperta la finestra di Google: ${finestre[0]}`);
      await d.p.locator("button[aria-label=Sincronizzazione]:visible").first().click();
      const stato = await finche(() => testoAvviso(d.p, /Google Drive collegato · si rinnova da solo/), 10000, "il pannello non dice che Drive si rinnova da solo");
      return { guasti: d.guasti, nota: `${rinnovi} ${rinnovi === 1 ? "rinnovo" : "rinnovi"} dal server, nessuna finestra · «${stato}»` };
    },
  },
  {
    // segnalato da un amico del lettore: entrato con Google SENZA spuntare
    // la casella di Drive, «le varie interazioni con Drive vanno in errore
    // (forse sarebbe meglio che a quel punto chiedessero nuovamente di
    // autenticarsi con Google Drive)»
    nome: "entrato con Google senza la casella di Drive, l'app lo dice e rimanda da Google",
    async fai({ browser, db }) {
      const d = await dispositivo(browser, { prima: () => localStorage.setItem("bc_drive_client", "123-abc.apps.googleusercontent.com") });
      const negate = [];
      // Google come risponde a una chiave senza il permesso di Drive; dopo il
      // secondo ingresso (la casella spuntata) Drive risponde
      await d.ctx.route("https://www.googleapis.com/drive/**", (route) => {
        const chiave = route.request().headers().authorization || "";
        if (chiave === "Bearer ya29.dal-google") {
          negate.push(route.request().url());
          return route.fulfill({
            status: 403,
            json: { error: { code: 403, message: "Request had insufficient authentication scopes.", errors: [{ message: "Insufficient Permission", domain: "global", reason: "insufficientPermissions" }], status: "PERMISSION_DENIED", details: [{ "@type": "type.googleapis.com/google.rpc.ErrorInfo", reason: "ACCESS_TOKEN_SCOPE_INSUFFICIENT" }] } },
          });
        }
        const u = new URL(route.request().url());
        if (u.pathname.endsWith("/changes/startPageToken")) return route.fulfill({ json: { startPageToken: "1" } });
        if (u.pathname.endsWith("/about")) return route.fulfill({ json: { storageQuota: { limit: "1000", usage: "10" } } });
        return route.fulfill({ json: { files: [], changes: [], newStartPageToken: "1" } });
      });
      const rinnovi = [];
      await d.ctx.route("**/api/google-token", (route) => (rinnovi.push(1), route.fulfill({ json: { chiave: "ya29.dal-server-senza-drive", scade: Date.now() + 3_600_000 } })));
      await d.p.goto(URL_APP);
      await d.p.locator("button[aria-label=Sincronizzazione]:visible").first().click();
      await d.p.getByRole("button", { name: "Entra con Google" }).first().click();
      await finche(() => d.p.evaluate(() => localStorage.getItem("bc_drive_permesso") === "1"), 20000, "la chiave senza Drive non si riconosce");
      if (!negate.length) throw new Error("Drive non e' mai stato chiesto");
      // il pannello lo dice, col tasto per rientrare
      await d.p.locator("button[aria-label=Sincronizzazione]:visible").first().click();
      const avviso = await finche(() => testoAvviso(d.p, /ha dato l'ingresso ma non Drive/), 15000, "il pannello non dice che manca il permesso di Drive");
      const errori = await d.p.evaluate(() => localStorage.getItem("bc_errori") || "");
      if (/403|insufficient/i.test(errori)) throw new Error(`il permesso mancante finisce fra i guasti: ${errori.slice(0, 200)}`);
      if (rinnovi.length) throw new Error("si e' chiesta al server una chiave nuova, che sarebbe di nuovo senza Drive");
      // la biblioteca e' vuota, come la sua: la prima cosa che si tocca e'
      // «Scegli su Drive», e rimanda da Google invece di andare in errore
      await d.p.goto(`${URL_APP}?apri=libreria`);
      await d.p.getByRole("button", { name: /Scegli su Drive/ }).first().click();
      await finche(() => d.p.evaluate(() => JSON.parse(localStorage.getItem("bc_drive_token") || "null")?.chiave === "ya29.dal-google-2"), 20000, "«Scegli su Drive» non rimanda da Google");
      const a = db.accessi()[1] || {};
      if (!/auth\/drive/.test(a.scopes || "") || a.prompt !== "consent") throw new Error(`il secondo accesso non chiede Drive: ${JSON.stringify(a)}`);
      await finche(() => d.p.evaluate(() => localStorage.getItem("bc_drive_permesso") === null), 10000, "con la casella spuntata l'avviso resta");
      await d.p.locator("button[aria-label=Sincronizzazione]:visible").first().click();
      await finche(() => testoAvviso(d.p, /Google Drive collegato · si rinnova da solo/), 10000, "con la casella spuntata il pannello non dice Drive collegato");
      return { guasti: d.guasti, nota: `${negate.length} domande a Drive negate, poi «${avviso.slice(0, 70)}…», e un secondo ingresso con Drive` };
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
