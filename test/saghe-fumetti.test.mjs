// LE SAGHE DEI FUMETTI DEL LETTORE (chiesto: «sistemami tutte le saghe che
// da solo non è riuscito a sistemare, tipo JoJo»). I nomi qui sono quelli
// dei suoi file su Drive, letti dalla cartella «book-companion».
import { sagaDalTitolo, pezziDalTitolo } from "../src/lib/sagaDalTitolo.js";
import { riconosci, deduciSaghe, unificaSaghe, saghePropose, fraseSaga, ripassa } from "../src/lib/sagaBooks.js";
import { titoloPulito } from "../src/lib/titoli.js";

export default async (t) => {
  const s = (title) => sagaDalTitolo({ title });
  const tre = (r) => `${r?.saga ?? "∅"}|${r?.ciclo ?? ""}|${r?.sagaOrder ?? ""}`;

  // i nomi scritti per un disco, con la parte come ciclo
  t.eq("JoJo coi trattini bassi: saga, parte, volume", tre(s("JoJo's_Bizarre_Adventure_Part_5_v16_The_Requiem_Plays_Quietly")), "JoJo's Bizarre Adventure|Parte 5|16");
  t.eq("e con gli spazi e il trattino", tre(s("JoJo's Bizarre Adventure Part 2 v05 - The Crimson Bubble")), "JoJo's Bizarre Adventure|Parte 2|5");
  t.eq("il titolo che resta è il nome del volume", pezziDalTitolo("JoJo's_Bizarre_Adventure_Part_3_v13_D'arby_the_Player")?.resto, "D'arby the Player");
  // «Saga vNN - Titolo», con le targhe in coda
  t.eq("Locke & Key", tre(s("Locke & Key v06 - Alpha & Omega (2014) (digital-Empire)")), "Locke & Key||6");
  t.eq("Head Lopper", tre(s("Head Lopper v01 - The Island or A Plague Of Beasts (2016) (Digital) (DrDoom-Empire)")), "Head Lopper||1");
  t.eq("Invincible, non «The End of All Things»", tre(s("Invincible v25 - The End of All Things_2C Part 02 (2018) (Digital) (Zone-Empire)")), "Invincible||25");
  // l'edizione non è la saga
  t.eq("The Sandman, non «The Deluxe Edition Book»", tre(s("The Sandman - The Deluxe Edition Book 02 (2021) (digital) (Son of Ultron-Empire)")), "The Sandman||2");
  t.eq("anche coi trattini bassi", tre(s("The_Sandman_-_The_Deluxe_Edition_Book_03_(2021)_(digital)_(Son_of_Ultron-Empire)")), "The Sandman||3");
  // i pacchetti di capitoli
  t.eq("Solo Leveling c91-100", tre(s("Solo Leveling c91-100 (2020) (Digital) (LuCaZ)")), "Solo Leveling||100");
  t.eq("e senza la «c»", tre(s("Solo Leveling 131-140 (2020) (Digital) (LuCaZ)")), "Solo Leveling||140");
  t.eq("la parte anche dal nome del file", sagaDalTitolo({ title: "A Man Possessed", fileName: "JoJo's_Bizarre_Adventure_Part_3_v01_A_Man_Possessed.cbz" })?.ciclo, "Parte 3");
  // Kagurabachi dal capitolo 100 (segnalato: restavano sciolti)
  const f = (title) => sagaDalTitolo({ title, fileType: "cbz" });
  t.eq("Kagurabachi 100, capitolo senza zero davanti", tre(f("Kagurabachi 100 (2025) (Digital) (LuCaZ)")), "Kagurabachi||100");
  t.eq("e il mezzo capitolo", tre(f("Kagurabachi 112.1 (2026) (Digital) (LuCaZ)")), "Kagurabachi||112.1");
  t.eq("anche con lo zero davanti", tre(f("Kagurabachi 092.1 (2025) (Digital) (LuCaZ)")), "Kagurabachi||92.1");
  t.eq("il fumetto si riconosce anche dal nome del file", tre(sagaDalTitolo({ title: "Kagurabachi 101", fileName: "Kagurabachi 101.cbz" })), "Kagurabachi||101");
  t.eq("ma un romanzo col numero resta un titolo", sagaDalTitolo({ title: "Fahrenheit 451 (1953)", fileType: "epub" }), null);
  t.eq("e senza dire che è un fumetto, pure", sagaDalTitolo({ title: "Fahrenheit 451" }), null);
  t.eq("il giro della biblioteca passa il tipo", deduciSaghe([{ id: "k", title: "Kagurabachi 110 (2026) (Digital) (LuCaZ)", fileType: "cbz" }], { dallaBiblioteca: false }).campi.k?.saga, "Kagurabachi");
  t.eq("Monster - Volume_06", tre(s("Monster - Volume_06_[Mangascreener]")), "Monster||6");
  t.eq("«Volume 20 - Titolo» dice il posto, non la saga", tre(s("Volume 20 - Love Train - The World is One")), "∅||20");
  // e quel che non deve diventare saga
  t.eq("«Part 2 of 3» resta niente", s("Part 2 of 3"), null);
  t.eq("un romanzo non perde il titolo per la «v»", titoloPulito({ title: "Saga v03 - Titolo", fileType: "epub" }), null);

  // la tavola: i volumi che il nome non dice
  t.eq("JoJo parte 7 dalla tavola", tre(riconosci({ title: "Volume 20 - Love Train - The World is One" })), "JoJo's Bizarre Adventure|Parte 7|20");
  t.eq("anche coi trattini bassi", tre(riconosci({ title: "Volume_06_Tsurugi_Hogashikata's_Goal,_and_the_Architect" })), "JoJo's Bizarre Adventure|Parte 8|6");
  t.eq("ma «Escape» da solo non è JoJo", riconosci({ title: "Escape" }), null);

  // il giro dei titoli dà anche la parte, e la grafia storta si riunisce
  const libri = [
    { id: "a", title: "JoJo's_Bizzare_Adventure_Part_6_v01_Prisoner_FE40536_Jolyne_Cujoh" },
    { id: "b", title: "JoJo's_Bizarre_Adventure_Part_5_v16_The_Requiem_Plays_Quietly" },
    { id: "c", title: "JoJo's_Bizarre_Adventure_Part_5_v15_His_Name_is_Diavolo" },
    { id: "d", title: "JoJo's_Bizarre_Adventure_Part_3_v01_A_Man_Possessed", series: "Mia" },
  ];
  const d = deduciSaghe(libri, { dallaBiblioteca: false });
  t.eq("la parte va nel ciclo", d.campi.b?.series, "Parte 5");
  t.eq("un ciclo scritto non si copre", d.campi.d?.series, undefined);
  const dopo = libri.map((b) => ({ ...b, ...d.campi[b.id] }));
  const u = unificaSaghe(dopo);
  t.eq("«Bizzare» va con la grafia dei più", u.campi.a?.saga, "JoJo's Bizarre Adventure");
  t.c("e un nome corto con una lettera di differenza resta suo", !unificaSaghe([{ id: "x", saga: "Dune" }, { id: "y", saga: "Rune" }]).unificate);
  t.eq("il ripasso dà la parte", ripassa({ id: "b", title: libri[1].title }, libri)?.campi?.series, "Parte 5");

  // le proposte: le saghe scritte storte, e i cicli mancanti
  const scaffale = [
    { id: "s1", title: "The Sandman - The Deluxe Edition Book 01 (2020) (digital)", saga: "The Deluxe Edition Book" },
    { id: "s2", title: "Invincible v25 - The End of All Things_2C Part 02 (2018)", saga: "The End of All Things_2C Part" },
    { id: "s3", title: "JoJo's_Bizarre_Adventure_Part_4_v17_Another_One_Bites_The_Dust", saga: "JoJo's Bizarre Adventure" },
    { id: "s4", title: "Hellboy Omnibus v01 - Seed of Destruction", saga: "Hellboy" },
    { id: "s5", title: "Locke & Key v02 - Head Games", saga: "Locke & Key", sagaOrder: 2 },
    { id: "s6", title: "Head Lopper v03 - Knights", saga: "", sagaTolta: true },
    { id: "s7", title: "Head Lopper v02 - Crimson Tower", saga: "Mio Ciclo", sagaOrder: 9 },
  ];
  const p = Object.fromEntries(saghePropose(scaffale).map((x) => [x.id, x]));
  t.eq("Sandman nella sua saga", fraseSaga(p.s1?.dopo), "The Sandman · n. 1");
  t.eq("Invincible nella sua", fraseSaga(p.s2?.dopo), "Invincible · n. 25");
  t.eq("JoJo già giusto: si aggiungono parte e numero", fraseSaga(p.s3?.dopo), "JoJo's Bizarre Adventure · Parte 4 · n. 17");
  // prima restava com'era («Hellboy» contiene «Hellboy Omnibus»); da quando
  // Hellboy ha la sua guida, prende il numero della guida (`hellboy.test.mjs`)
  t.eq("Hellboy prende il numero della guida e la serie", fraseSaga(p.s4?.dopo), "Hellboy · Hellboy Omnibus · n. 1");
  t.c("chi è già a posto non si propone", !p.s5);
  t.c("la saga tolta a mano resta tolta", !p.s6);
  // una saga che il titolo non dice l'ha scritta qualcun altro (il lettore,
  // il catalogo): «Kokou no Hito» non si propone al posto di «The Climber»
  t.c("un'altra saga scritta, che il titolo non dice, non si propone", !p.s7);
  t.eq("si dice da dove parte", fraseSaga(p.s1?.prima), "The Deluxe Edition Book");

  // LA SIGLA DEL FILE NON E' UNA SAGA (segnalato: «Dragon Haven (trwc-2)»
  // proposto come «Trwc · n. 2»)
  t.eq("«(trwc-2)» non è una saga", s("Dragon Haven (trwc-2)"), null);
  t.eq("«(ttm-1)» nemmeno", s("Fool's Errand (ttm-1)"), null);
  t.eq("«(Discworld 4)» sì", s("Mort (Discworld 4)")?.saga, "Discworld");
  // «-017» dopo «Vol. 02» e' la copia che Drive numera, non i capitoli 2-17
  t.eq("«Vol. 02-017» è il volume 2", tre(s("Spawn Origins Collection Vol. 02-017")), "Spawn Origins Collection||2");
  t.eq("i capitoli restano capitoli", tre(s("Solo Leveling c91-100")), "Solo Leveling||100");
  const spawn = saghePropose([{ id: "sp", title: "Spawn Origins Collection Vol. 02-017", saga: "Spawn Origins Collection Vol", sagaOrder: 17 }])[0];
  t.eq("la saga che finisce con «Vol» si propone senza", fraseSaga(spawn?.dopo), "Spawn Origins Collection · n. 2");
  t.c("«Grendel» dentro «Grendel Omnibus» resta com'è", !saghePropose([{ id: "o", title: "Grendel v01 - Devil by the Deed", saga: "Grendel Omnibus", sagaOrder: 1 }]).length);

  // DUE GRAFIE SONO UNA SAGA SOLO DENTRO UNA PAROLA LUNGA (segnalato: «1st» e
  // «Last» di Thomas Covenant riuniti a ogni apertura della Libreria)
  const tc = unificaSaghe([
    { id: "a", saga: "The Last Chronicles of Thomas Covenant" },
    { id: "b", saga: "The Last Chronicles of Thomas Covenant" },
    { id: "c", saga: "The 1st Chronicles of Thomas Covenant" },
  ]);
  t.eq("1st e Last restano due saghe", tc.unificate, 0);
  const due = (x, y) => unificaSaghe([{ id: "a", saga: x }, { id: "b", saga: x }, { id: "c", saga: y }]).unificate;
  t.eq("una cifra fa un'altra saga", due("Warhammer 40000", "Warhammer 30000"), 0);
  t.eq("una parola corta fa un'altra saga", due("The Last Chronicles", "The Lost Chronicles"), 0);
  t.eq("una parola in più fa un'altra saga", due("Spawn Origins Collection", "Spawn Origin Collection Vol"), 0);
  t.eq("due parole storte: nel dubbio due ripiani", due("Black Jewels Trilogy", "Black Jewel Trilogie"), 0);
  t.eq("Bizzare e Bizarre una sola", unificaSaghe([{ id: "a", saga: "JoJo's Bizarre Adventure" }, { id: "b", saga: "JoJo's Bizarre Adventure" }, { id: "c", saga: "JoJo's Bizzare Adventure" }]).campi?.c?.saga, "JoJo's Bizarre Adventure");
  const hobb = [
    { id: "d", title: "Dragon Haven (trwc-2)", author: "Robin Hobb", saga: "The Realm of the Elderlings", series: "The Rain Wilds Chronicles", sagaOrder: 11 },
    { id: "f", title: "Fool's Errand (ttm-1)", author: "Robin Hobb", saga: "Ttm", series: "The Tawny Man", sagaOrder: 1 },
    { id: "g", title: "The Golden Fool (ttm-2)", author: "Robin Hobb", saga: "Ttm", sagaOrder: 2 },
    { id: "a", title: "Assassin's Apprentice", author: "Robin Hobb", saga: "The Realm of the Elderlings", sagaOrder: 1 },
    { id: "k", title: "Kokou no Hito - Volume_08", saga: "The Climber", sagaOrder: 8 },
  ];
  const ph = Object.fromEntries(saghePropose(hobb).map((x) => [x.id, x]));
  t.c("Dragon Haven resta nella sua saga", !ph.d);
  t.c("Kokou no Hito resta The Climber", !ph.k);
  t.eq("la sigla scritta come saga torna la saga dei fratelli, la serie resta", fraseSaga(ph.f?.dopo), "The Realm of the Elderlings · The Tawny Man");
  t.eq("senza fratelli d'accordo, niente", saghePropose([hobb[1], { ...hobb[2], saga: "Farseer" }, { ...hobb[0], id: "x" }]).length, 0);
  t.eq("senza saga si dice", fraseSaga({}), "senza saga");
};
