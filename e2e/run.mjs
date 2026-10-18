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
import { fumetto, fumettoGrosso, fumettoLungo, epub, pdf, wav, FRASE, mondoDisco, png } from "./libri.mjs";
import { rar4 } from "../test/rar-finto.mjs";
import { lexicanumFinto, fandomFinto } from "./lexicanumFinto.mjs";

// le richieste del service worker passano dalle rotte del contesto solo
// cosi' (Chromium): servono alla scena della melodia che suona mentre scende
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = "1";

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
async function dispositivo(browser, { sessione = false, prima = null, catalogo = null, oracolo = null, misura = null, lexicanum = null, fandom = null } = {}) {
  const ctx = await browser.newContext(misura || { viewport: { width: 1280, height: 800 } });
  await ctx.route(
    (url) => !/^(localhost|127\.0\.0\.1)$/.test(url.hostname),
    async (route) => {
      const url = route.request().url();
      if (oracolo && /api\.anthropic\.com/.test(url)) return route.fulfill({ json: await oracolo(JSON.parse(route.request().postData() || "{}")) });
      if (lexicanum && /wh40k\.lexicanum\.com/.test(url)) return lexicanum(route);
      if (fandom && /warhammer40k\.fandom\.com/.test(url)) return fandom(route);
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
      // la raccolta e' una riga: il nome apre i brani, il resto sta in «⋯»
      if (await d.p.getByRole("button", { name: "Scegli i brani" }).count()) throw new Error("«Scegli i brani» sta in vista, non nel menu «⋯»");
      await d.p.getByRole("button", { name: "Altro per Notti" }).click();
      if (!(await d.p.getByRole("button", { name: "Scegli i brani" }).isVisible())) throw new Error("nel menu «⋯» manca «Scegli i brani»");
      await d.p.getByRole("button", { name: /^✧\s*Notti/ }).click();
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
    nome: "sul computer largo la colonna usa lo schermo, sul tablet resta com'era",
    async fai({ browser }) {
      const prima = () => {
        if (localStorage.getItem("bc_books")) return;
        localStorage.setItem("bc_books", JSON.stringify([{ id: "m", title: "Mort", author: "Terry Pratchett", fileType: "epub", addedAt: 1 }]));
        localStorage.setItem("bc_status_m", "reading");
      };
      const pc = await dispositivo(browser, { misura: { viewport: { width: 1920, height: 1040 } }, prima });
      await pc.p.goto(URL_APP);
      const larga = await finche(() => pc.p.evaluate(() => document.querySelector("main")?.getBoundingClientRect().width), 8000, "l'Ingresso non si vede");
      if (larga < 1400) throw new Error(`sul PC la colonna e' larga ${larga}`);
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
    // chiesto dal lettore, lasciato Drive: «pulizia su cose che non servono
    // piu'». Le chiavi di Drive sul dispositivo, l'elenco dei file in
    // IndexedDB e la riga col permesso a lungo termine di Google nel
    // Supabase se ne vanno da sole, e la biblioteca resta.
    nome: "quel che Google Drive ha lasciato se ne va da solo, e la biblioteca resta",
    async fai({ browser, db }) {
      await fetch(`http://localhost:${PORTA_DB}/rest/v1/google_refresh`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: "u1", token: "rt-vecchio" }) });
      if (db.permessi().length !== 1) throw new Error("la riga del permesso non c'e' nemmeno prima");
      const d = await dispositivo(browser, { sessione: true });
      await d.p.goto(`${URL_APP}?apri=libreria`);
      // i resti dei tempi di Drive, seminati dopo il primo avvio (il database
      // del browser lo crea l'app), poi si riapre
      await d.p.evaluate(
        () =>
          new Promise((ok, ko) => {
            for (const k of ["bc_drive_token", "bc_drive_on", "bc_drive_libri", "bc_drive_mai", "bc_google_vista"]) localStorage.setItem(k, "vecchio");
            localStorage.setItem("bc_books", JSON.stringify([{ id: "m", title: "Mort", author: "Terry Pratchett", fileType: "epub", addedAt: 1 }]));
            const r = indexedDB.open("bc_library");
            r.onsuccess = () => {
              const tx = r.result.transaction("aux", "readwrite");
              tx.objectStore("aux").put({ file: {} }, "drive_elenco");
              tx.oncomplete = () => (r.result.close(), ok());
              tx.onerror = () => ko(tx.error);
            };
            r.onerror = () => ko(r.error);
          })
      );
      await d.p.reload();
      await finche(() => db.permessi().length === 0, 20000, "la riga col permesso di Google resta nel Supabase");
      const rimaste = await finche(
        () => d.p.evaluate(() => Object.keys(localStorage).filter((k) => /^bc_(drive|google)_/.test(k) && k !== "bc_google_riga_tolta").join()) .then((x) => (x === "" ? "nessuna" : "")),
        10000,
        "le chiavi di Drive restano sul dispositivo"
      );
      const elenco = await d.p.evaluate(
        () =>
          new Promise((ok) => {
            const r = indexedDB.open("bc_library");
            r.onsuccess = () => {
              const g = r.result.transaction("aux").objectStore("aux").get("drive_elenco");
              g.onsuccess = () => ok(g.result === undefined ? "via" : "resta");
              g.onerror = () => ok("?");
            };
            r.onerror = () => ok("?");
          })
      );
      if (elenco !== "via") throw new Error(`l'elenco dei file di Drive in IndexedDB: ${elenco}`);
      if (!(await libriDi(d.p)).some((b) => b.title === "Mort")) throw new Error("la pulizia si e' portata via la biblioteca");
      return { guasti: d.guasti, nota: `chiavi di Drive: ${rimaste}, elenco in IndexedDB via, riga di Google tolta, «Mort» al suo posto` };
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
      await pc.p.getByPlaceholder("Incolla un link YouTube (video o playlist)…").fill("https://www.youtube.com/watch?v=abcdefghijk");
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
      // e un link YouTube si suona dal riquadro di «＋ Da YouTube»
      await d.p.getByRole("button", { name: "＋ Da YouTube" }).click();
      if (!(await d.p.getByRole("button", { name: "▶ Suona ora" }).isVisible())) throw new Error("nel riquadro di YouTube manca «▶ Suona ora»");
      return { guasti: d.guasti, nota: `⏭ ⏮ e il riavvolgimento (${riavvolto.toFixed(1)} s), barra a ${meta.toFixed(0)} s, «Arpa» dai prossimi, timer «${orologio.trim()}»` };
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
      if (!(await d.p.getByRole("button", { name: "🖼 Ritrova 3 copertine" }).count())) throw new Error("«Ritrova» ha preso il conto del disco");
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
    nome: "alla voltata del fumetto la pagina dopo (e tornando, quella prima) era gia' li', e quella di prima svanisce da se'",
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
      await p.keyboard.press("Escape");

      const frase = "I was there, the day that Horus slew the Emperor. Garviel Loken watched the Warmaster from the deck. 'Two hundred and fifty,' came the answer.";
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
      return { guasti: d.guasti, nota: `${chieste.length} richieste a Lexicanum, ${veli.length} veli` };
    },
  },
  {
    nome: "Lexicanum interrotto da un ricaricamento riparte da solo da dove era arrivato, e quello fermato dal lettore resta fermo",
    async fai({ browser }) {
      const chieste = [];
      // l'ultima pagina tarda: il ricaricamento la coglie a meta'
      const d = await dispositivo(browser, { misura: TABLET, lexicanum: lexicanumFinto(chieste, { attesa: (i) => (i === 2 ? 4000 : 600) }) });
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
      await p.keyboard.press("Escape");
      const frase = "I was there, the day that Horus slew the Emperor. Garviel Loken watched the Warmaster from the deck.";
      await importa(p, "Horus Rising.epub", await epub({ titolo: "Horus Rising", autore: "Dan Abnett", frase, lingua: "en" }), "application/epub+zip");
      await p.getByText("Horus Rising").first().click();
      await p.getByRole("button", { name: /Apri il libro|Comincia/ }).first().click();
      await definisci(p, "Loken");
      // le due schede; la prima e' Lexicanum
      await finche(() => p.getByRole("tab", { name: /Fandom/ }).count(), 8000, "la scheda di Fandom non compare");
      await p.getByRole("tab", { name: /Fandom/ }).click();
      const avviso = await finche(async () => (await p.getByText(/Questa voce può spoilerare/).count()) && p.getByText(/Questa voce può spoilerare/).first().locator("..").textContent(), 5000, "l'avviso di Fandom non compare");
      if (!/False Gods/.test(avviso) || /left for dead/.test(await p.locator("body").textContent())) throw new Error(`avviso sbagliato o testo gia' in vista: ${avviso}`);
      await p.getByText(/Questa voce può spoilerare/).first().click();
      await finche(() => p.getByText(/originally the Captain/).count(), 5000, "toccato l'avviso, l'incipit non compare");
      // la voce intera si apre gia' letta: l'avviso si accetta una volta
      await p.getByRole("button", { name: "Leggi la voce ▸" }).click();
      await finche(() => p.getByText(/left for dead/).count(), 5000, "la voce intera di Fandom non si apre");
      await finche(() => p.getByText("Fandom · sul dispositivo").count(), 5000, "la voce non dice da quale wiki viene");
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
