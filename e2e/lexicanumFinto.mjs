// UN LEXICANUM FINTO per le scene: risponde come l'API MediaWiki di
// wh40k.lexicanum.com (siteinfo, poi `generator=allpages` a pagine con la
// continuazione), con le citazioni e le fonti come le scrive il wiki. Le
// voci sono poche ma hanno tutto quel che l'app deve saper leggere: un
// rinvio, un link a un rinvio, fonti da questo libro, da un volume dopo,
// da un codex.
const W = {
  "Davin": `'''Davin''' is a [[Feral World]].{{Fn|1}}\n\n==Sources==\n*{{Endn|1}}: ''[[False Gods (Novel)|False Gods]]'' by [[Graham McNeill]]`,
  "Garviel Loken": `{{Character|name=Garviel Loken}}\n[[Image:Loken.jpg|thumb|Loken by [[Neil Roberts]]]]\n'''Garviel Loken''' was a Captain of the [[Sons of Horus|Luna Wolves]] and a member of the [[Mournival]].{{Fn|1}}\n\n==History==\n===The Great Crusade===\nLoken fought at [[Sixty-Three Nineteen]] and earned the respect of [[Horus Lupercal|Horus]].{{Fn|2}}\n\nOn [[Davin]]'s moon, Loken saw the first signs of corruption in the Warmaster.{{Fn|3}}\n\n===Isstvan III===\nLoken was betrayed and left for dead on [[Isstvan III]].{{Fn|4}}\n\n==Sources==\n*{{Endn|1}}: ''[[The Horus Heresy: Collected Visions]]''\n*{{Endn|2}}: ''[[Horus Rising (Novel)|Horus Rising]]'' by [[Dan Abnett]], Chapter 3\n*{{Endn|3}}: ''[[False Gods (Novel)|False Gods]]'' by [[Graham McNeill]], Chapter 9\n*{{Endn|4}}: ''[[Galaxy in Flames (Novel)|Galaxy in Flames]]'' by [[Ben Counter]]\n\n==See also==\n* [[Tarik Torgaddon]]\n\n[[Category:L]]`,
  "Loken": "#REDIRECT [[Garviel Loken]]",
  "Luna Wolves": "#REDIRECT [[Sons of Horus]]",
  "Mournival": `The '''Mournival''' was an informal council of four captains of the Luna Wolves.{{Fn|1}}\n\n==Sources==\n*{{Endn|1}}: ''[[Horus Rising (Novel)|Horus Rising]]''`,
  "Sons of Horus": `The '''Sons of Horus''', first known as the '''Luna Wolves''', were the XVI Legion.{{Fn|1}}\n\n==Sources==\n*{{Endn|1}}: ''[[Codex: Chaos Space Marines]]''`,
};
const TITOLI = Object.keys(W).sort();
const PAGINE = [TITOLI.slice(0, 2), TITOLI.slice(2, 4), TITOLI.slice(4)];

export const VOCI_FINTE = TITOLI.filter((t) => !W[t].startsWith("#REDIRECT")).length;

// `chieste` raccoglie gli indirizzi, per guardare cosa ha chiesto l'app
export const lexicanumFinto = (chieste = []) => async (route) => {
  const u = new URL(route.request().url());
  chieste.push(u.href);
  const p = Object.fromEntries(u.searchParams);
  const headers = { "access-control-allow-origin": "*" };
  if (u.pathname !== "/mediawiki/api.php") return route.fulfill({ status: 404, headers, body: "non qui" });
  if (p.meta === "siteinfo") return route.fulfill({ headers, json: { query: { general: { sitename: "Lexicanum" }, statistics: { articles: VOCI_FINTE } } } });
  const i = Number(p.gapcontinue || 0);
  // un po' di attesa: la riga del lavoro deve farsi vedere
  await new Promise((r) => setTimeout(r, 600));
  const corpo = { query: { pages: PAGINE[i].map((title) => ({ ns: 0, title, revisions: [{ slots: { main: { content: W[title] } } }] })) } };
  if (i + 1 < PAGINE.length) corpo.continue = { gapcontinue: String(i + 1), continue: "gapcontinue||" };
  return route.fulfill({ headers, json: corpo });
};
