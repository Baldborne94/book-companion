// LE COPERTINE DEI LIBRI CHE NON HAI. Quel che sbaglia in silenzio: una
// copertina di un altro libro, una domanda rifatta a ogni apertura, un buco
// di rete ricordato come «non ce l'ha», trenta richieste in parallelo, e la
// copertina che si perde tenendo il consiglio nella lista.
import {
  copertinaNota,
  ricorda,
  cercaCopertina,
  nuovoCercatore,
  chiaveCopertina,
  RIPROVA,
  MAX_TENUTE,
} from "../src/lib/copertineRete.js";
import { tieni } from "../src/lib/daPrendere.js";

const memoria = (iniziale = {}) => {
  let m = JSON.parse(JSON.stringify(iniziale));
  return { leggi: () => JSON.parse(JSON.stringify(m)), scrivi: (x) => (m = x), vedi: () => m };
};
const risposta = (docs) => ({ ok: true, json: async () => ({ docs }) });
const doc = (title, autore, cover, key = `/w/${title}`) => ({ key, title, author_name: [autore], ...(cover ? { cover_i: cover } : {}) });
const attendi = () => new Promise((ok) => setTimeout(ok, 0));

export default async (t) => {
  // ---- quel che si sa senza rete -------------------------------------------
  const v = { id: "x", titolo: "Tigana", autore: "Guy Gavriel Kay" };
  const k = chiaveCopertina(v);
  t.eq("la copertina della voce vince", copertinaNota({ ...v, copertina: 12 }, { mem: memoria({ [k]: { c: 99, t: 0 } }) }), 12);
  t.eq("una voce senza titolo non si cerca", copertinaNota({ id: "n", numero: 3 }, { mem: memoria() }), 0);
  t.eq("mai chiesta: da chiedere", copertinaNota(v, { mem: memoria() }), undefined);
  t.eq("ricordata col numero", copertinaNota(v, { mem: memoria({ [k]: { c: 55, t: 0 } }), ora: 10 * RIPROVA }), 55);
  t.eq("«non ce l'ha» si ricorda", copertinaNota(v, { mem: memoria({ [k]: { c: 0, t: 1000 } }), ora: 1000 + RIPROVA - 1 }), 0);
  t.eq("… ma dopo un mese si richiede", copertinaNota(v, { mem: memoria({ [k]: { c: 0, t: 1000 } }), ora: 1000 + RIPROVA + 1 }), undefined);
  t.eq("un numero storto nella voce non vale", copertinaNota({ ...v, copertina: -1 }, { mem: memoria() }), undefined);

  const piena = memoria();
  for (let i = 0; i < MAX_TENUTE + 5; i++) ricorda(`k${i}`, i, { mem: piena, ora: i });
  const chiavi = Object.keys(piena.vedi());
  t.eq("la memoria ha un tetto", chiavi.length, MAX_TENUTE);
  t.c("… e se ne vanno le piu' vecchie", !chiavi.includes("k0") && chiavi.includes(`k${MAX_TENUTE + 4}`));

  // ---- la domanda al catalogo -----------------------------------------------
  const urls = [];
  const cat = (docs) => async (u) => {
    urls.push(u);
    return risposta(docs);
  };
  t.eq(
    "la copertina dell'opera giusta, non del primo risultato",
    await cercaCopertina(v, cat([doc("Tigana: A Study", "Someone Else", 1), doc("Tigana", "Guy Gavriel Kay", 42)])),
    42
  );
  const q = new URL(urls.at(-1)).searchParams;
  t.c("si chiede anche il numero della copertina", q.get("fields").split(",").includes("cover_i"));
  t.eq("… e con l'autore", q.get("author"), "Guy Gavriel Kay");
  t.eq("un'opera che non c'e': null", await cercaCopertina(v, cat([doc("Altro libro", "Guy Gavriel Kay", 7)])), null);
  t.eq(
    "scheda scelta nuda: vale la gemella con lo stesso titolo",
    await cercaCopertina(v, cat([doc("Tigana", "Guy Gavriel Kay", null, "/w/a"), doc("Tigana", "Guy Gavriel Kay", 8, "/w/b")])),
    8
  );
  t.eq(
    "… ma non la copertina di un altro libro",
    await cercaCopertina(v, cat([doc("Tigana", "Guy Gavriel Kay", null, "/w/a"), doc("Ysabel", "Guy Gavriel Kay", 9)])),
    null
  );
  let esploso = false;
  try {
    await cercaCopertina(v, async () => ({ ok: false, status: 500 }));
  } catch {
    esploso = true;
  }
  t.c("un catalogo che non risponde ESPLODE, non e' «non c'e'»", esploso);

  // ---- il cercatore della pagina --------------------------------------------
  let chiamate = 0;
  const mem = memoria();
  const cerca = nuovoCercatore({
    mem,
    fetcher: async () => {
      chiamate++;
      await attendi();
      return risposta([doc("Tigana", "Guy Gavriel Kay", 42)]);
    },
  });
  const [a, b] = await Promise.all([cerca(v), cerca({ ...v, id: "y" })]);
  t.eq("due voci uguali, una domanda sola", chiamate, 1);
  t.c("… e la risposta arriva a tutt'e due", a === 42 && b === 42);
  t.eq("trovata si ricorda", await cerca(v), 42);
  t.eq("… e non si richiede", chiamate, 1);

  let rete = 0;
  const memRete = memoria();
  const cadente = nuovoCercatore({
    mem: memRete,
    fetcher: async () => {
      rete++;
      throw new TypeError("Failed to fetch");
    },
  });
  t.eq("senza rete: niente copertina", await cadente(v), null);
  t.eq("… e niente scritto in memoria", Object.keys(memRete.vedi()).length, 0);
  await cadente(v);
  t.eq("… quindi la volta dopo si richiede", rete, 2);

  const memVuota = memoria();
  let vuote = 0;
  const senza = nuovoCercatore({
    mem: memVuota,
    fetcher: async () => {
      vuote++;
      return risposta([]);
    },
  });
  await senza(v);
  await senza(v);
  t.eq("«non ce l'ha» non si richiede subito", vuote, 1);

  let insieme = 0;
  let massimo = 0;
  const lenta = nuovoCercatore({
    mem: memoria(),
    insieme: 3,
    fetcher: async () => {
      insieme++;
      massimo = Math.max(massimo, insieme);
      await attendi();
      await attendi();
      insieme--;
      return risposta([]);
    },
  });
  await Promise.all(Array.from({ length: 10 }, (_, i) => lenta({ id: `v${i}`, titolo: `Libro ${i}`, autore: "A" })));
  t.eq("mai piu' di tre domande alla volta", massimo, 3);

  // ---- la lista si tiene la copertina ---------------------------------------
  const lista = tieni([], { id: "c1", titolo: "Tigana", autore: "Guy Gavriel Kay", copertina: 42 }, 1);
  t.eq("tenendo un consiglio la copertina resta", lista[0].copertina, 42);
  t.eq("… e ritenendolo senza non si perde", tieni(lista, { id: "c1", titolo: "Tigana" }, 2)[0].copertina, 42);
  t.eq("un numero storto non entra", tieni([], { id: "c2", titolo: "X", copertina: "abc" }, 1)[0].copertina, null);
};
