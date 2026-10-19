// UN LEXICANUM FINTO per le scene: risponde come l'API MediaWiki di
// wh40k.lexicanum.com (siteinfo, poi `generator=allpages` a pagine con la
// continuazione), con le citazioni e le fonti come le scrive il wiki. Le
// voci sono poche ma hanno tutto quel che l'app deve saper leggere: un
// rinvio, un link a un rinvio, fonti da questo libro, da un volume dopo,
// da un codex.

// l'immagine di Fandom, come la serve il suo deposito (CORS aperto): un
// ritratto piccolo per Loken, l'immagine principale della sua voce
const RITRATTO = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAB4AAAAoCAIAAABmcd1FAAAAK0lEQVR4nO3MMQ0AAAgDsMmZROSjgoOkSe9m2iNRq9VqtVqtVqvVavX/egEV7KmuPVZ5ogAAAABJRU5ErkJggg==", "base64");
const W = {
  "Davin": `'''Davin''' is a [[Feral World]].{{Fn|1}}\n\n==Sources==\n*{{Endn|1}}: ''[[False Gods (Novel)|False Gods]]'' by [[Graham McNeill]]`,
  "Garviel Loken": `{{Character\n|name=Garviel Loken\n|image=[[Image:Loken.jpg|250px]]\n|allegiance=[[Imperium]]\n|legion=[[Sons of Horus|Luna Wolves]]\n|rank=Captain\n|status=Unknown\n}}\n{{Quote|I was never a Son of Horus.|Garviel Loken}}\n[[Image:Loken.jpg|thumb|Loken by [[Neil Roberts]]]]\n'''Garviel Loken''' was a Captain of the [[Sons of Horus|Luna Wolves]] and a member of the [[Mournival]].{{Fn|1}}\n\n==History==\n===The Great Crusade===\nLoken fought at [[Sixty-Three Nineteen]] and earned the respect of [[Horus Lupercal|Horus]].{{Fn|2}}\n\nOn [[Davin]]'s moon, Loken saw the first signs of corruption in the Warmaster.{{Fn|3}}\n\n===Isstvan III===\nLoken was betrayed and left for dead on [[Isstvan III]].{{Fn|4}}\n\n==Wargear==\n${"Loken carried a chainsword and a bolter into every battle of the Crusade. ".repeat(40)}\n\n==Personality==\nLoken was calm and thoughtful.\n\n==Sources==\n*{{Endn|1}}: ''[[The Horus Heresy: Collected Visions]]''\n*{{Endn|2}}: ''[[Horus Rising (Novel)|Horus Rising]]'' by [[Dan Abnett]], Chapter 3\n*{{Endn|3}}: ''[[False Gods (Novel)|False Gods]]'' by [[Graham McNeill]], Chapter 9\n*{{Endn|4}}: ''[[Galaxy in Flames (Novel)|Galaxy in Flames]]'' by [[Ben Counter]]\n\n==See also==\n* [[Tarik Torgaddon]]\n\n[[Category:L]]`,
  "Kilometres": "A unit of distance used by the [[Imperium]].",
  "Loken": "#REDIRECT [[Garviel Loken]]",
  "Luna Wolves": "#REDIRECT [[Sons of Horus]]",
  "Mournival": `The '''Mournival''' was an informal council of four captains of the Luna Wolves.{{Fn|1}}\n\n==Sources==\n*{{Endn|1}}: ''[[Horus Rising (Novel)|Horus Rising]]''`,
  "Two Hundred": `The '''Two Hundred''' refers to a group of 200 Terran-recruited Emperor's Children.{{Fn|1}}\n\n==Sources==\n*{{Endn|1}}: ''[[Fulgrim (Novel)|Fulgrim]]''`,
  "Sons of Horus": `The '''Sons of Horus''', first known as the '''Luna Wolves''', were the XVI Legion.{{Fn|1}}\n{| class="wikitable"\n! Name !! Rank !! Company !! Fate during the Heresy and long after it\n|-\n| [[Garviel Loken]] || Captain || 10th || Fought on [[Isstvan III]] against his own brothers in the Choral City\n|-\n| Tarik Torgaddon || Captain || 2nd || Fell on Isstvan III\n|}\n\n==Sources==\n*{{Endn|1}}: ''[[Codex: Chaos Space Marines]]''`,
};
const TITOLI = Object.keys(W).sort();
const PAGINE = [TITOLI.slice(0, 2), TITOLI.slice(2, 4), TITOLI.slice(4)];

export const VOCI_FINTE = TITOLI.filter((t) => !W[t].startsWith("#REDIRECT")).length;

// `chieste` raccoglie gli indirizzi, per guardare cosa ha chiesto l'app;
// `attesa` dice quanto tarda ogni pagina (per interrompere a meta')
export const lexicanumFinto = (chieste = [], { attesa = () => 600 } = {}) => async (route) => {
  const u = new URL(route.request().url());
  chieste.push(u.href);
  const p = Object.fromEntries(u.searchParams);
  const headers = { "access-control-allow-origin": "*" };
  if (u.pathname !== "/mediawiki/api.php") return route.fulfill({ status: 404, headers, body: "non qui" });
  // come il Lexicanum vero: nessuna voce dichiara l'immagine principale
  if (p.prop === "pageimages") return route.fulfill({ headers, json: { query: { pages: TITOLI.slice(0, 3).map((title) => ({ ns: 0, title })) } } });
  if (p.meta === "siteinfo") return route.fulfill({ headers, json: { query: { general: { sitename: "Lexicanum" }, statistics: { articles: VOCI_FINTE } } } });
  const i = Number(p.gapcontinue || 0);
  // un po' di attesa: la riga del lavoro deve farsi vedere
  await new Promise((r) => setTimeout(r, attesa(i)));
  const corpo = { query: { pages: PAGINE[i].map((title) => ({ ns: 0, title, revisions: [{ slots: { main: { content: W[title] } } }] })) } };
  if (i + 1 < PAGINE.length) corpo.continue = { gapcontinue: String(i + 1), continue: "gapcontinue||" };
  return route.fulfill({ headers, json: corpo });
};

// E UN FANDOM FINTO, nel formato vero del Warhammer 40k Wiki: niente
// citazioni per paragrafo, le fonti tutte in fondo, il titolo del libro in
// corsivo e il link sull'autore.
const F = {
  "Garviel Loken": `{{Quote|I was never a Son of Horus.| Garviel Loken}}
[[File:Loken.jpg|thumb|250px|Garviel Loken.]]
'''Garviel Loken''' was originally the [[Captain]] of the [[Luna Wolves]] during the [[Great Crusade]].

After Horus' fall to [[Chaos]] on [[Davin]], Loken was betrayed and left for dead on [[Isstvan III]].

==Sources==
*''Horus Rising'' (Novel) by [[Dan Abnett]]
*''False Gods'' (Novel) by [[Graham McNeill]]
*''Galaxy In Flames'' (Novel) by Ben Counter
[[Category:Characters]]`,
  "Loken": "#REDIRECT [[Garviel Loken]]",
};

const IMMAGINI = "https://static.wikia.nocookie.net/warhammer40k/images";

// `lento`: quanto tarda la seconda pagina delle immagini (per interromperla)
export const fandomFinto = (chieste = [], { lento = 0 } = {}) => async (route) => {
  const u = new URL(route.request().url());
  chieste.push(u.href);
  const p = Object.fromEntries(u.searchParams);
  const headers = { "access-control-allow-origin": "*" };
  if (u.hostname === "static.wikia.nocookie.net") return route.fulfill({ headers: { ...headers, "content-type": "image/png" }, body: RITRATTO });
  if (u.pathname !== "/api.php") return route.fulfill({ status: 404, headers, body: "non qui" });
  if (p.prop === "pageimages") {
    if (lento && p.gapcontinue === "1") {
      await new Promise((r) => setTimeout(r, lento));
      return route.fulfill({ headers, json: { query: { pages: [{ ns: 0, title: "Horus", thumbnail: { source: `${IMMAGINI}/horus.png` } }] } } });
    }
    const pages = [{ ns: 0, title: "Garviel Loken", thumbnail: { source: `${IMMAGINI}/loken.png`, width: 30, height: 40 } }];
    return route.fulfill({ headers, json: { query: { pages }, ...(lento ? { continue: { gapcontinue: "1", continue: "gapcontinue||" } } : {}) } });
  }
  if (p.meta === "siteinfo") return route.fulfill({ headers, json: { query: { general: { sitename: "Warhammer 40k Wiki" }, statistics: { articles: 1 } } } });
  const pages = Object.keys(F).map((title) => ({ ns: 0, title, revisions: [{ slots: { main: { content: F[title] } } }] }));
  return route.fulfill({ headers, json: { query: { pages } } });
};
