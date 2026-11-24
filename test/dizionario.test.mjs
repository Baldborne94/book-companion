// Il vocabolario con le due fonti SIMULATE: la rete non serve, e quello
// che conta e' come si TRATTA la risposta — e' li' che il dizionario si
// era rotto la prima volta, con un pezzo di romanzo spacciato per una
// traduzione.
import {
  lookup, lookupPhrase, formaDi, derivataDa, cleanWord, wordCount,
  resaItaliana, usaDizionarioLocale,
} from "../src/lib/dictionary.js";

// `strip()` in dictionary.js usa DOMParser, che in Node non c'e'. Invece di
// tirarsi dietro jsdom per otto righe, se ne mette una copia minima: qui
// serve solo a togliere i tag, ed e' proprio quello che fa.
function montaDOMParser() {
  if (globalThis.DOMParser) return;
  globalThis.DOMParser = class {
    parseFromString(html) {
      const testo = String(html)
        .replace(/<[^>]*>/g, "")
        .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
      return { body: { textContent: testo } };
    }
  };
}

export default async function (t) {
  montaDOMParser();
  // --- le risposte vere delle due fonti, copiate nella forma ---------------
  const WIKT = {
    fume: {
      en: [
        { partOfSpeech: "Noun", definitions: [{ definition: "A gas or vapour that <i>smells</i> strongly or is dangerous to inhale." }] },
        { partOfSpeech: "Verb", definitions: [{ definition: "To emit fumes." }, { definition: "To feel or express great anger." }] },
      ],
      it: [{ partOfSpeech: "Noun", definitions: [{ definition: "voce di un'altra lingua" }] }],
    },
    fuming: {
      en: [{ partOfSpeech: "Verb", definitions: [{ definition: "present participle of <a>fume</a>" }] }],
    },
    gutters: { en: [{ partOfSpeech: "Noun", definitions: [{ definition: "plural of gutter" }] }] },
    gutter: { en: [{ partOfSpeech: "Noun", definitions: [{ definition: "A prepared channel in a surface." }] }] },
    // la voce vera che ha fatto chiedere la cura: la sua UNICA definizione
    // e' un rimando a un'altra parola, e da sola non spiega niente
    gormlessness: {
      en: [{ partOfSpeech: "Noun", definitions: [{ definition: "The quality or state of being <a>gormless</a>." }] }],
    },
    gormless: {
      en: [
        { partOfSpeech: "Adjective", definitions: [{ definition: "Lacking intelligence or understanding; stupid." }] },
      ],
    },
    // una parola derivata la cui base e' a sua volta una forma flessa: il
    // rimando deve arrivare ai sensi VERI, non a un secondo rimando
    fuminess: {
      en: [{ partOfSpeech: "Noun", definitions: [{ definition: "The state of being fuming." }] }],
    },
  };

  // la risposta che aveva rovinato tutto: MyMemory pesca dalle sue memorie
  // di traduzione dei pezzi di romanzo, e li offre come se fossero voci
  const MYMEM = {
    fume: {
      responseData: { translatedText: "fumo" },
      matches: [
        { segment: "fume", translation: "fumare", quality: "74" },
        { segment: "fume", translation: "esalazione", quality: "70" },
        { segment: "he began to fume", translation: '"uniti", scherzò damien.', quality: "99" },
        { segment: "fume", translation: 'FUMO, "il gas".', quality: "80" },
      // E QUESTA E' LA PIU' INSIDIOSA: pulita, due parole, nessuna
      // punteggiatura — la respinge SOLO il controllo sul segmento di
      // partenza, che qui e' una frase e non la parola chiesta. Senza
      // questa riga il filtro sul `segment` non sarebbe coperto da niente
      // (verificato rompendolo apposta: i test restavano verdi).
      { segment: "the room filled with fume", translation: "la stanza", quality: "95" },
      ],
    },
  };

  global.fetch = async (url) => {
    const u = String(url);
    if (u.includes("/page/definition/")) {
      const w = decodeURIComponent(u.split("/page/definition/")[1]);
      return WIKT[w] ? { ok: true, json: async () => WIKT[w] } : { ok: false };
    }
    if (u.includes("mymemory")) {
      const w = decodeURIComponent(new URL(u).searchParams.get("q"));
      return MYMEM[w] ? { ok: true, json: async () => MYMEM[w] } : { ok: true, json: async () => ({ matches: [] }) };
    }
    if (u.includes("action=query")) {
      const titoli = decodeURIComponent(new URL(u).searchParams.get("titles")).split("|");
      return { ok: true, json: async () => ({ query: { pages: titoli.filter((t) => WIKT[t]).map((t) => ({ title: t })) } }) };
    }
    return { ok: false };
  };


  // --- 1. la voce arriva, e resta IN LINGUA -------------------------------
  const fume = await lookup("fume", "en");
  t.eq("la parola", fume.word, "fume");
  t.eq("quanti sensi", fume.entries.length, 3);
  t.eq("il primo e' il sostantivo", fume.entries[0].pos, "sostantivo");
  t.c("la definizione resta in inglese", /A gas or vapour/.test(fume.entries[0].text), fume.entries[0].text);
  t.c("l'HTML e' stato tolto", !/[<>]/.test(fume.entries[0].text), fume.entries[0].text);
  t.c("il verbo viene dopo il sostantivo", fume.entries[1].pos === "verbo");
  t.c("le voci di altre lingue restano fuori", !fume.entries.some((e) => /altra lingua/.test(e.text)));

  // --- 2. LA CURA: niente frammenti di romanzo nella resa italiana --------
  t.eq("la resa italiana", fume.translation, "fumare, esalazione");
  t.c("la memoria di una FRASE non entra fra le rese",
    !/stanza/.test(fume.translation), fume.translation);
  t.c("il frammento di romanzo non c'e'", !/scherzò|damien/i.test(fume.translation), fume.translation);
  // la virgola qui e' il separatore fra le rese, non punteggiatura dentro
  // una resa: si controlla voce per voce
  t.c("niente punteggiatura dentro le rese",
    fume.translation.split(", ").every((t) => !/["“”.;:!?\d]/.test(t)), fume.translation);

  // --- 3. la forma flessa segue il rimando --------------------------------
  const fuming = await lookup("fuming", "en");
  t.eq("«fuming» rimanda a «fume»", fuming.lemma, "fume");
  t.eq("e lo dice in italiano", fuming.forma, "participio presente di");
  t.c("e porta i sensi veri della base", fuming.entries.some((e) => /A gas or vapour/.test(e.text)));

  const gutters = await lookup("gutters", "en");
  t.eq("«gutters» → «gutter»", gutters.lemma, "gutter");
  t.eq("plurale", gutters.forma, "plurale di");
  t.c("coi significati di «gutter»", gutters.entries.some((e) => /prepared channel/i.test(e.text)));

  // --- 4. formaDi da solo --------------------------------------------------
  t.eq("formaDi participio", formaDi("present participle of fume")?.lemma, "fume");
  t.c("formaDi non inventa", formaDi("A gas or vapour that smells") === null);

  // --- 4-bis. UNA DEFINIZIONE CHE RIMANDA NON SPIEGA NIENTE ---------------
  // Segnalato dal lettore su «gormlessness», la cui unica definizione è
  // «The quality or state of being gormless»: chi non sa cosa vuol dire
  // «gormless» chiude la scheda esattamente dov'era.
  const gorm = await lookup("gormlessness", "en");
  t.eq("la definizione del vocabolario resta la sua", gorm.entries.length, 1);
  t.c("e resta scritta com'era", /quality or state of being/i.test(gorm.entries[0].text));
  t.eq("il rimando dice quale parola", gorm.entries[0].rimando?.parola, "gormless");
  t.c(
    "E PORTA LA SUA DEFINIZIONE",
    /Lacking intelligence/i.test(gorm.entries[0].rimando?.sensi?.[0]?.text || ""),
    JSON.stringify(gorm.entries[0].rimando)
  );
  t.eq("con la sua categoria grammaticale", gorm.entries[0].rimando?.sensi?.[0]?.pos, "aggettivo");
  // i sensi della parola base NON si mescolano ai sensi della parola
  // cercata: «gormlessness» non significa «stupido», e accodarli lì lo
  // direbbe
  t.c("i sensi della base non finiscono fra quelli della parola",
    !gorm.entries.some((e) => /Lacking intelligence/i.test(e.text)));

  // e se la base è a sua volta una forma flessa, si arriva ai sensi veri
  const fumi = await lookup("fuminess", "en");
  t.eq("la base di «fuminess»", fumi.entries[0].rimando?.parola, "fuming");
  t.c(
    "e il rimando scavalca il secondo rinvio",
    fumi.entries[0].rimando?.sensi?.some((s) => /A gas or vapour|great anger/i.test(s.text)),
    JSON.stringify(fumi.entries[0].rimando)
  );

  // una parola SENZA rimando non se ne inventa uno
  t.c("«fume» non ha rimandi", !(await lookup("fume", "en")).entries.some((e) => e.rimando));

  // --- 4-ter. derivataDa da sola ------------------------------------------
  t.eq("la qualità di essere X", derivataDa("The quality or state of being gormless."), "gormless");
  t.eq("lo stato di essere X", derivataDa("The state of being ready"), "ready");
  t.eq("in modo X", derivataDa("In a gormless manner."), "gormless");
  t.eq("relativo a X", derivataDa("Of or relating to woods."), "woods");
  t.eq("l'atto di X", derivataDa("The act of running."), "running");
  t.eq("caratterizzato da X", derivataDa("Characterized by gormlessness."), "gormlessness");
  // UNA GLOSSA CHE NOMINA UN'ALTRA PAROLA DI SFUGGITA NON È UN RIMANDO:
  // inseguirla riempirebbe la scheda di parole che nessuno ha chiesto
  t.eq("una definizione vera non è un rimando", derivataDa("A hat worn by wizards."), null);
  t.eq("nemmeno se contiene «of being»", derivataDa("A tale of being lost at sea."), null);
  t.eq("e nemmeno se nomina un altro termine", derivataDa("A gas or vapour that smells."), null);
  // una parola che rimanda a se stessa girerebbe in tondo
  t.eq("e non si rimanda a se stessa", derivataDa("The state of being ready", "ready"), null);
  t.eq("il niente non esplode", derivataDa(undefined), null);

  // --- 5. le due funzioni di testo, che non devono essere cambiate --------
  t.eq("cleanWord", cleanWord("«Fuming!»"), "Fuming");
  t.eq("wordCount", wordCount("take the mickey"), 3);

  // --- 6. la rete che cade non diventa una risposta -----------------------
  const vecchioFetch = global.fetch;
  global.fetch = async () => { throw new Error("niente rete"); };
  const buio = await lookup("zzzunknown", "en");
  t.c("senza rete lo dice", buio.offline === true);
  t.c("e non inventa voci", buio.entries.length === 0);
  global.fetch = vecchioFetch;
  // e la parola gia' cercata resta consultabile
  const dallaCache = await lookup("fume", "en");
  t.eq("dalla cache, ancora buona", dallaCache.entries.length, 3);

  // --- 7. PRIMA IL DISCO, POI LA RETE ---------------------------------------
  // Chiesto dal lettore («lentezza o risposte vuote», «le definizioni»): il
  // dizionario sul dispositivo risponde in pochi millisecondi con la resa
  // italiana, e la scheda lo mostra SUBITO; la rete arriva dopo. Qui il
  // disco è una mappa, nella stessa forma dei sacchi: [pos, glossa, resa].
  const DISCO = {
    gutter: [["n", "a channel along the eaves", "grondaia, doccia"], ["v", "flow in small streams"]],
    gutters: [],
    cat: [["n", "feline mammal", "gatto"], ["v", "eject the contents of the stomach", "vomitare, rigettare"]],
    "kick the bucket": [["v", "pass from physical life", "morire, crepare"]],
  };
  usaDizionarioLocale(async (p) => DISCO[p] || []);
  let mymemoryChiamate = 0;
  global.fetch = async (url) => {
    if (String(url).includes("mymemory")) mymemoryChiamate++;
    return vecchioFetch(url);
  };

  {
    // la risposta parziale arriva PRIMA che la rete abbia risposto, e porta
    // la resa italiana; la finale tiene i sensi di Wiktionary E la resa
    const tappe = [];
    const finale = await lookup("gutter", "en", { onParziale: (p) => tappe.push(p) });
    t.eq("il disco risponde per primo, una volta", tappe.length, 1);
    t.c("e dice che sta ancora cercando", tappe[0].cercando === true);
    t.c("con la resa italiana", tappe[0].italiano?.[0]?.parole.includes("grondaia"), JSON.stringify(tappe[0].italiano));
    t.c("dal disco", tappe[0].dalDisco === true);
    t.c("la finale ha i sensi di Wiktionary", /prepared channel/i.test(finale.entries[0]?.text || ""), JSON.stringify(finale.entries));
    t.c("e tiene la resa italiana del disco", finale.italiano?.[0]?.parole.includes("grondaia"), JSON.stringify(finale.italiano));
    t.eq("la resa e' per categoria", finale.italiano[0].pos, "sostantivo");
    // MYMEMORY NON SERVE PIU' quando il disco ha una resa vera: una parola
    // tradotta da una memoria di traduzione non batte un dizionario
    t.eq("MyMemory non si chiama", mymemoryChiamate, 0);
  }
  {
    // la forma flessa passa dal disco con la sua base («gutters» qui no:
    // e' gia' in cache dalla sezione 3, e dalla cache non c'e' nessuna
    // tappa parziale — la risposta e' gia' immediata)
    const tappe = [];
    await lookup("cats", "en", { onParziale: (p) => tappe.push(p) });
    t.eq("«cats» dal disco si spiega sotto «cat»", tappe[0]?.lemma, "cat");
    t.eq("e lo dice", tappe[0]?.forma, "forma di");
  }
  {
    // WIKTIONARY NON CONOSCE «cat» (nel finto): resta il disco, coi suoi
    // sensi e la resa per senso — e la scheda deve saperlo
    const finale = await lookup("cat", "en");
    t.c("senza Wiktionary vale il disco", finale.dalDisco === true);
    t.eq("coi sensi del disco", finale.entries.length, 2);
    t.eq("ognuno con la sua resa", finale.entries[1].ita.join(", "), "vomitare, rigettare");
    t.eq("e la resa raccolta per categoria, due categorie", finale.italiano.length, 2);
    t.eq("il verbo sotto il sostantivo", finale.italiano[1].pos, "verbo");
  }
  {
    // e senza resa dal disco MyMemory torna a servire
    await lookup("fumi", "en");
    const prima = mymemoryChiamate;
    await lookup("zzzaltra", "en");
    t.c("MyMemory si chiama quando il disco tace", mymemoryChiamate > prima);
  }
  {
    // IL MODO DI DIRE DAL DISCO: Wiktionary (finto) non lo ha, il disco sì
    const tappe = [];
    const finale = await lookupPhrase("he kicked the bucket", "en", { onParziale: (p) => tappe.push(p) });
    t.eq("la finestra buona arriva dal disco", tappe[0]?.word, "kick the bucket");
    t.c("come modo di dire", tappe[0]?.idiom === true);
    t.eq("e la finale tiene la voce del disco", finale.word, "kick the bucket");
    t.c("con la resa", finale.italiano?.[0]?.parole.includes("morire"), JSON.stringify(finale.italiano));
    t.c("senza dirsi offline: una risposta c'e'", finale.offline !== true);
  }

  // --- 7-bis. resaItaliana da sola ---------------------------------------
  const gruppi = resaItaliana([
    { pos: "sostantivo", ita: ["gatto", "micio"] },
    { pos: "verbo", ita: ["vomitare"] },
    { pos: "sostantivo", ita: ["gatto", "felino"] },
    { pos: "aggettivo", ita: [] },
  ]);
  t.eq("una categoria, un gruppo", gruppi.length, 2);
  t.eq("senza doppioni e nell'ordine dei sensi", gruppi[0].parole.join(","), "gatto,micio,felino");
  t.eq("una categoria senza resa non compare", gruppi.some((g) => g.pos === "aggettivo"), false);
  t.eq("il niente non esplode", resaItaliana(undefined).length, 0);

  usaDizionarioLocale(null);
  global.fetch = vecchioFetch;
}
