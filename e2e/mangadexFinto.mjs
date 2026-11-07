// UN MANGADEX FINTO per le scene: risponde come l'API vera (ricerca, feed
// dei capitoli, nodo delle pagine, deposito delle copertine, rapporto delle
// pagine), nella forma che `lib/mangadex.js` sa leggere. Una serie sola,
// Berserk, con tre capitoli ospitati e uno che e' solo un rimando.
import { png } from "./libri.mjs";

const MANGA = {
  id: "b1",
  type: "manga",
  attributes: { title: { en: "Berserk" }, altTitles: [], year: 1989, status: "ongoing", originalLanguage: "ja", availableTranslatedLanguages: ["en", "it"], links: { engtl: "https://www.darkhorse.com/Books/Berserk" } },
  relationships: [
    { type: "author", attributes: { name: "Miura Kentarou" } },
    { type: "cover_art", attributes: { fileName: "cop.jpg" } },
  ],
};
const capitolo = (id, chapter, pages, extra = {}) => ({
  id,
  type: "chapter",
  attributes: { chapter, title: extra.title || "", pages, translatedLanguage: "en", publishAt: "2025-03-01T00:00:00+00:00", externalUrl: extra.esterno || null },
  relationships: [{ type: "scanlation_group", attributes: { name: extra.gruppo || "TAMT" } }],
});
// gli id come quelli veri (UUID): la scheda del capitolo scaricato tiene il
// suo, e la stanza lo riconosce da quello
export const idCapitolo = (n) => `cccccccc-0000-4000-8000-00000000000${n}`;
const CAPITOLI = [
  capitolo(idCapitolo(4), "4", 0, { esterno: "https://mangaplus.shueisha.co.jp/viewer/4", gruppo: "MangaPlus" }),
  capitolo(idCapitolo(3), "3", 2, { title: "The Guardians of Desire" }),
  capitolo(idCapitolo(2), "2", 2),
  capitolo(idCapitolo(1), "1", 2, { title: "The Black Swordsman" }),
];
export const PAGINE_PER_CAPITOLO = 2;

// `chieste` raccoglie gli indirizzi (e i rapporti delle pagine), per guardare
// cosa ha chiesto l'app. `soloGuscio`: come MangaDex vero, la sfida
// anti-bot respinge le pagine web («Bot challenge not passed») e lascia
// passare l'app — qui, chi porta il segno del guscio finto (`x-dal-guscio`)
export const mangadexFinto = (chieste = [], { soloGuscio = false } = {}) => async (route) => {
  const req = route.request();
  const u = new URL(req.url());
  const headers = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
  if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
  const dalGuscio = !!req.headers()["x-dal-guscio"];
  chieste.push(`${req.method()} ${u.href}${dalGuscio ? " (guscio)" : ""}`);
  if (soloGuscio && !dalGuscio) return route.fulfill({ status: 403, headers: { ...headers, "content-type": "text/plain" }, body: "Bot challenge not passed, refresh this page." });
  if (u.hostname === "api.mangadex.org") {
    if (u.pathname === "/manga") {
      const t = (u.searchParams.get("title") || "").toLowerCase();
      return route.fulfill({ headers, json: { result: "ok", response: "collection", data: "berserk".includes(t) ? [MANGA] : [], total: 1 } });
    }
    if (u.pathname === "/manga/b1/feed") return route.fulfill({ headers, json: { result: "ok", response: "collection", data: CAPITOLI, total: CAPITOLI.length } });
    // una serie seguita da prima che la stanza tenesse l'edizione ufficiale:
    // la sua scheda la porta, il feed e' vuoto
    if (u.pathname === "/manga/g1/feed") return route.fulfill({ headers, json: { result: "ok", response: "collection", data: [], total: 0 } });
    if (u.pathname === "/manga/g1") return route.fulfill({ headers, json: { result: "ok", data: { id: "g1", type: "manga", attributes: { title: { en: "Gachiakuta" }, links: { engtl: "https://kmanga.kodansha.com/title/10044" } }, relationships: [] } } });
    const cap = u.pathname.match(/^\/at-home\/server\/cccccccc-0000-4000-8000-00000000000(\d)$/);
    if (cap) return route.fulfill({ headers, json: { result: "ok", baseUrl: "https://nodo.mangadex.network", chapter: { hash: `hc${cap[1]}`, data: Array.from({ length: PAGINE_PER_CAPITOLO }, (_, i) => `${i + 1}-c${cap[1]}.png`), dataSaver: [] } } });
    return route.fulfill({ status: 404, headers, json: { result: "error", errors: [{ detail: "non qui" }] } });
  }
  if (u.hostname === "nodo.mangadex.network") {
    const m = u.pathname.match(/^\/data\/h(c\d)\/(\d)-/);
    if (!m) return route.fulfill({ status: 404, headers, body: "" });
    const n = Number(m[1][1]) * 10 + Number(m[2]);
    return route.fulfill({ headers: { ...headers, "content-type": "image/png", "x-cache": "HIT" }, body: png(120, 180, [(n * 37) % 256, (n * 91) % 256, (n * 53) % 256]) });
  }
  if (u.hostname === "uploads.mangadex.org") return route.fulfill({ headers: { ...headers, "content-type": "image/png" }, body: png(32, 48, [40, 60, 90]) });
  if (u.hostname === "api.mangadex.network") return route.fulfill({ headers, json: {} });
  return route.fulfill({ status: 404, headers, body: "" });
};
