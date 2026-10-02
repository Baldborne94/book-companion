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
import { fumetto, fumettoGrosso, epub, pdf, wav, FRASE, mondoDisco } from "./libri.mjs";
import { avviaDrive, driveNelBrowser } from "./driveFinto.mjs";
import { rar4 } from "../test/rar-finto.mjs";

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
async function dispositivo(browser, { sessione = false, prima = null, catalogo = null, drive = null } = {}) {
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
      const cdp = await d.ctx.newCDPSession(d.p);
      cdp.send("Page.crash").catch(() => {});
      await aspetta(1000);
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
