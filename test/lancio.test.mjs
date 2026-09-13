// L'APP SI APRE DA FUORI: le scorciatoie dell'icona e «Apri con». Le due
// letture sbagliano in silenzio — una sezione che non esiste lascia
// l'ingresso senza dire niente, un handle non letto è un libro che non
// entra — quindi si provano con dei finti.
import { sezioneDaUrl, fileDaLancio, pulisciUrl } from "../src/lib/lancio.js";

const SEZIONI = [{ id: "home" }, { id: "library" }, { id: "music" }];

export default async function (t) {
  // ---- LA SEZIONE DALL'URL ---------------------------------------------------
  t.eq("«libreria» apre la Libreria", sezioneDaUrl("?apri=libreria", SEZIONI), "library");
  t.eq("«musica» apre la sala", sezioneDaUrl("?apri=musica", SEZIONI), "music");
  t.eq("«ingresso» apre l'ingresso", sezioneDaUrl("?apri=ingresso", SEZIONI), "home");
  t.eq("e anche l'id nudo passa", sezioneDaUrl("?apri=library", SEZIONI), "library");
  t.eq("le maiuscole non contano", sezioneDaUrl("?apri=Libreria", SEZIONI), "library");
  t.eq("in mezzo ad altri parametri", sezioneDaUrl("?x=1&apri=musica&y=2", SEZIONI), "music");
  // una sezione che non esiste NON apre niente: un URL storto (una
  // scorciatoia di una versione vecchia) deve lasciare l'ingresso
  t.eq("una sezione sconosciuta → null", sezioneDaUrl("?apri=giardino", SEZIONI), null);
  t.eq("senza parametro → null", sezioneDaUrl("", SEZIONI), null);
  t.eq("senza search → null", sezioneDaUrl(undefined, SEZIONI), null);
  t.eq("parametro vuoto → null", sezioneDaUrl("?apri=", SEZIONI), null);
  t.eq("e senza l'elenco delle sezioni non si apre niente", sezioneDaUrl("?apri=libreria"), null);
  // l'elenco che comanda e' quello passato: una sezione tolta dall'app
  // smette di aprirsi anche se il nome sta nella mappa
  t.eq("una sezione tolta dall'app non si apre", sezioneDaUrl("?apri=musica", [{ id: "home" }]), null);

  // ---- I FILE DAL LANCIO -------------------------------------------------------
  {
    const handle = (nome, esplode = false) => ({
      getFile: async () => {
        if (esplode) throw new Error("handle rotto");
        return { name: nome };
      },
    });
    const files = await fileDaLancio({ files: [handle("a.epub"), handle("b.pdf")] });
    t.eq("due handle, due file", files.map((f) => f.name).join(","), "a.epub,b.pdf");
    // l'handle che non si apre si salta e non porta via gli altri
    const conRotto = await fileDaLancio({ files: [handle("a.epub"), handle("x", true), handle("c.pdf")] });
    t.eq("l'handle rotto si salta", conRotto.map((f) => f.name).join(","), "a.epub,c.pdf");
    t.eq("un handle senza getFile si salta", (await fileDaLancio({ files: [{}] })).length, 0);
    t.eq("un handle che torna niente si salta", (await fileDaLancio({ files: [{ getFile: async () => null }] })).length, 0);
    t.eq("senza files → vuoto", (await fileDaLancio({})).length, 0);
    t.eq("senza params → vuoto", (await fileDaLancio(null)).length, 0);
    t.eq("files che non e' un elenco → vuoto", (await fileDaLancio({ files: "a.epub" })).length, 0);
  }

  // ---- L'URL SI RIPULISCE TENENDO LO STATE -------------------------------------
  // e' li' che `indietro.js` segna la sua guardia: cancellarlo le farebbe
  // perdere il segno (mutazione provata: `replaceState(null, …)`)
  {
    const scritti = [];
    const win = {
      history: { state: { bc: "guardia" }, replaceState: (s, _t, u) => scritti.push([s, u]) },
      location: { search: "?apri=libreria", pathname: "/" },
    };
    pulisciUrl(win);
    t.eq("si riscrive una volta", scritti.length, 1);
    t.eq("sul solo percorso, senza il parametro", scritti[0][1], "/");
    t.eq("e lo state resta quello che c'era", scritti[0][0], win.history.state);
    // senza parametri non si tocca la storia: un replaceState in piu' a
    // ogni avvio non rompe niente, ma non e' lavoro da fare
    const fermo = { history: { state: null, replaceState: () => scritti.push("no") }, location: { search: "", pathname: "/" } };
    pulisciUrl(fermo);
    t.eq("senza parametri non si riscrive", scritti.length, 1);
    // senza history non esplode
    pulisciUrl({ location: { search: "?apri=x" } });
    pulisciUrl(null);
    t.c("senza history non esplode", true);
  }
}
