// UN MANGADEX FINTO per le scene: risponde come l'API vera (ricerca, feed
// dei capitoli, nodo delle pagine, deposito delle copertine, rapporto delle
// pagine), nella forma che `lib/mangadex.js` sa leggere. Una serie sola,
// Berserk, con tre capitoli ospitati e uno che e' solo un rimando.
import { png } from "./libri.mjs";

const MANGA = {
  id: "b1",
  type: "manga",
  attributes: { title: { en: "Berserk" }, altTitles: [], year: 1989, status: "ongoing", originalLanguage: "ja", availableTranslatedLanguages: ["en", "it"] },
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
const CAPITOLI = [
  capitolo("c4", "4", 0, { esterno: "https://mangaplus.shueisha.co.jp/viewer/4", gruppo: "MangaPlus" }),
  capitolo("c3", "3", 2, { title: "The Guardians of Desire" }),
  capitolo("c2", "2", 2),
  capitolo("c1", "1", 2, { title: "The Black Swordsman" }),
];
export const PAGINE_PER_CAPITOLO = 2;

// `chieste` raccoglie gli indirizzi (e i rapporti delle pagine), per guardare
// cosa ha chiesto l'app
export const mangadexFinto = (chieste = []) => async (route) => {
  const req = route.request();
  const u = new URL(req.url());
  chieste.push(`${req.method()} ${u.href}`);
  const headers = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
  if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
  if (u.hostname === "api.mangadex.org") {
    if (u.pathname === "/manga") {
      const t = (u.searchParams.get("title") || "").toLowerCase();
      return route.fulfill({ headers, json: { result: "ok", response: "collection", data: "berserk".includes(t) ? [MANGA] : [], total: 1 } });
    }
    if (u.pathname === "/manga/b1/feed") return route.fulfill({ headers, json: { result: "ok", response: "collection", data: CAPITOLI, total: CAPITOLI.length } });
    const cap = u.pathname.match(/^\/at-home\/server\/(c\d)$/);
    if (cap) return route.fulfill({ headers, json: { result: "ok", baseUrl: "https://nodo.mangadex.network", chapter: { hash: `h${cap[1]}`, data: Array.from({ length: PAGINE_PER_CAPITOLO }, (_, i) => `${i + 1}-${cap[1]}.png`), dataSaver: [] } } });
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
