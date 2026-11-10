// I MONDI DI GUIDE: il Cosmere, Malazan, The First Law, le Banished Lands
// (`data/cosmereStandalones.js`, `data/malazanMondo.js`, `data/firstLaw.js`,
// `data/banishedLands.js`) e le saghe grandi a se' (`data/wheelOfTime.js`,
// `data/shadowsOfTheApt.js`). Chiesto dal lettore: «fai le guide di
// Cosmoverso e Malazan e altre se vedi che contengono molti libri». Ogni
// serie tiene i suoi numeri (quelli dei file), e un mondo si chiede intero.
import { riconosci, TAVOLE } from "../src/lib/sagaBooks.js";
import { guidaDalNome, sagaDalNome, guideDellAutore, saghePerAutore, libriDellaSaga } from "../src/lib/sagaDaNome.js";
import { completaSaga } from "../src/lib/importBook.js";

const chi = (title, author) => {
  const r = riconosci({ title, author });
  return r ? `${r.saga} · ${r.sagaOrder}` : null;
};

export default async (t) => {
  const nuove = ["Cosmere Standalones", "Novels of the Malazan Empire", "Path to Ascendancy", "The Kharkanas Trilogy", "Witness", "The Wheel of Time", "Shadows of the Apt", "The First Law Trilogy", "The First Law Standalones", "The Age of Madness", "The Faithful and the Fallen", "Of Blood and Bone", "The Bloodsworn Saga", "The Bound and the Broken"];
  for (const s of nuove) {
    const tav = TAVOLE.find((x) => x.saga === s);
    t.c(`la guida «${s}» c'e'`, !!tav);
    for (const v of tav?.libri || []) t.eq(`«${v.t}» si riconosce in «${s}»`, riconosci({ title: v.t, author: v.a })?.saga, s);
  }
  // i numeri restano quelli delle serie
  t.eq("Toll the Hounds resta l'ottavo del Libro dei Caduti", chi("Malazan 08 - Toll the Hounds", ""), "Malazan Book of the Fallen · 8");
  t.eq("Night of Knives e' il primo dell'Impero di Esslemont", chi("Night of Knives", "Ian C. Esslemont"), "Novels of the Malazan Empire · 1");
  t.eq("la Ruota: gli ultimi tre scritti con Sanderson", chi("The Gathering Storm", "Robert Jordan, Brandon Sanderson"), "The Wheel of Time · 12");
  t.eq("…anche col titolo italiano", chi("Presagi di tempesta", "Robert Jordan"), "The Wheel of Time · 12");
  t.eq("The First Law col titolo italiano", chi("Il richiamo delle spade", "Joe Abercrombie"), "The First Law Trilogy · 1");
  t.eq("…e il prequel dopo il quattordicesimo", chi("New Spring", "Robert Jordan"), "The Wheel of Time · 15");
  t.eq("Tress e' dei Secret Projects del Cosmere", riconosci({ title: "Tress of the Emerald Sea", author: "Brandon Sanderson" })?.ciclo, "Secret Projects");
  // quel che non e' della guida resta fuori
  t.eq("il Secret Project che non e' del Cosmere no", chi("The Frugal Wizard's Handbook for Surviving Medieval England", "Brandon Sanderson"), null);
  t.eq("il terzo di Kharkanas, non uscito, no", chi("Walk in Shadow", "Steven Erikson"), null);
  t.eq("i Bloodsworn sono un altro mondo, con la loro guida", chi("The Shadow of the Gods", "John Gwynne"), "The Bloodsworn Saga · 1");
  t.eq("«Bloodsworn» per nome", guidaDalNome("Bloodsworn")?.saga, "The Bloodsworn Saga");
  t.eq("…e non sta nelle Banished Lands", TAVOLE.find((x) => x.saga === "The Bloodsworn Saga")?.universo, undefined);
  t.eq("«The Heroes» di un altro autore no", chi("The Heroes", "Joe Bloggs"), null);
  // THE BOUND AND THE BROKEN (il lettore: «perché non mi trovi nulla?»):
  // Wikidata non ha né la serie né i libri, le edizioni di Open Library sì
  t.eq("«the bound and the broken» per nome, scritto come il lettore", guidaDalNome("the bound and the broken")?.saga, "The Bound and the Broken");
  const bound = await sagaDalNome("the bound and the broken", { libri: [] });
  t.eq("i quattro romanzi in ordine, senza le due novelle", bound?.volumi.map((v) => `${v.numero} ${v.titolo}`).join(" | "), "1 Of Blood and Fire | 2 Of Darkness and Light | 3 Of War and Ruin | 4 Of Empires and Dust");
  t.eq("«Of Blood and Fire» di un altro autore (Keri Arthur) no", chi("Of Blood and Fire", "Keri Arthur"), null);
  t.eq("le novelle restano fuori", chi("The Fall", "Ryan Cahill"), null);
  t.eq("…e fra le saghe di Ryan Cahill c'e' la sua guida", guideDellAutore("Ryan Cahill").map((g) => g.saga).join(), "The Bound and the Broken");

  // un mondo si chiede intero, col suo nome o col nome del lettore
  t.eq("«Cosmoverso» e' il Cosmere", guidaDalNome("Cosmoverso")?.universo, "Cosmere");
  t.eq("«Malazan» e' il mondo intero", guidaDalNome("Malazan")?.universo, "Malazan");
  t.eq("…«Il libro dei caduti di Malazan» la sua serie", guidaDalNome("Il libro dei Caduti di Malazan")?.saga, "Malazan Book of the Fallen");
  const cosmo = await sagaDalNome("Cosmoverso", { libri: [{ title: "Elantris", author: "Brandon Sanderson", saga: "Cosmoverse" }] });
  t.eq("il Cosmere: le sue diciotto guide in fila, nella raccolta del lettore", `${cosmo.volumi.length} ${cosmo.saga} ${cosmo.universo}`, "18 Cosmoverse true");
  t.c("…ognuna coi suoi numeri e la sua serie", cosmo.volumi.some((v) => v.titolo === "The Well of Ascension" && v.numero === 2 && v.serie === "Era One") && cosmo.volumi.some((v) => v.titolo === "Words of Radiance" && v.numero === 2));
  t.c("…e quel che hai e' segnato", cosmo.volumi.find((v) => v.titolo === "Elantris")?.gia === true);
  const mz = await sagaDalNome("Malazan", { libri: [] });
  t.eq("Malazan: i dieci di Erikson e i quindici del resto del mondo", mz.volumi.length, 25);
  const fl = await sagaDalNome("First Law", { libri: [] });
  t.eq("The First Law: tre guide, nove romanzi", fl.volumi.length, 9);

  // fra le saghe di un autore, prima il suo mondo
  t.eq("Erikson: il mondo di Malazan per primo", `${guideDellAutore("Steven Erikson")[0]?.universo} ${guideDellAutore("Steven Erikson")[0]?.quanti}`, "Malazan 25");
  t.eq("Esslemont anche (due guide sue)", guideDellAutore("Ian C. Esslemont")[0]?.universo, "Malazan");
  t.eq("chi scrive in una guida sola di un mondo non ha il mondo (Dembski-Bowden: solo l'Eresia)", guideDellAutore("Aaron Dembski-Bowden").filter((g) => g.universo).length, 0);
  const tocco = await libriDellaSaga(guideDellAutore("Steven Erikson")[0], { libri: [] });
  t.eq("toccato il mondo, tutte le sue guide", `${tocco.volumi.length} ${tocco.universo}`, "25 true");
  const tipo = (...q) => q.map((id) => ({ mainsnak: { datavalue: { value: { id } } } }));
  const E = {
    Q1: { labels: { en: { value: "Steven Erikson" } }, claims: { P106: tipo("Q6625963") } },
    Q10: { labels: { en: { value: "The Tales of Witness" } }, claims: { P31: tipo("Q1667921") } },
    Q11: { labels: { en: { value: "Malazan Book of the Fallen" } }, claims: { P31: tipo("Q1667921") } },
    Q12: { labels: { en: { value: "Malazan" } }, claims: { P31: tipo("Q1667921") } },
    Q22: { labels: { en: { value: "Some Malazan Book" } }, claims: { P31: tipo("Q7725634"), P50: tipo("Q1"), P179: [{ mainsnak: { datavalue: { value: { id: "Q12" } } }, qualifiers: { P1545: [{ datavalue: { value: "1" } }] } }] } },
    Q20: { labels: { en: { value: "The God is Not Willing" } }, claims: { P31: tipo("Q7725634"), P50: tipo("Q1"), P179: [{ mainsnak: { datavalue: { value: { id: "Q10" } } }, qualifiers: { P1545: [{ datavalue: { value: "1" } }] } }] } },
    Q21: { labels: { en: { value: "Gardens of the Moon" } }, claims: { P31: tipo("Q7725634"), P50: tipo("Q1"), P179: [{ mainsnak: { datavalue: { value: { id: "Q11" } } }, qualifiers: { P1545: [{ datavalue: { value: "1" } }] } }] } },
  };
  const prendi = async (url) => {
    const q = new URL(url).searchParams;
    if (q.get("action") === "wbsearchentities") return { search: [{ id: "Q1" }] };
    if (q.get("action") === "query") return { query: { search: [{ title: "Q20" }, { title: "Q21" }, { title: "Q22" }] } };
    return { entities: Object.fromEntries(q.get("ids").split("|").filter((i) => E[i]).map((i) => [i, E[i]])) };
  };
  const er = await saghePerAutore("Steven Erikson", { prendi });
  t.c("le sue serie di Wikidata che hanno una guida, o che si chiamano come il suo mondo, non si ripetono (anche «The Tales of Witness»)", !er.saghe.some((s) => s.fonte === "wikidata"), er.saghe.map((s) => s.nome).join(" | "));

  // l'import: nella raccolta dove il lettore tiene il suo Malazan
  const meta = { title: "Night of Knives", author: "Ian C. Esslemont" };
  completaSaga(meta, null, "Night of Knives.epub", [{ title: "Gardens of the Moon", author: "Steven Erikson", saga: "Malazan universe" }]);
  t.eq("Esslemont entra nel Malazan del lettore, con la sua serie e il suo numero", `${meta.saga} | ${meta.series} | ${meta.sagaOrder}`, "Malazan universe | Novels of the Malazan Empire | 1");
};
