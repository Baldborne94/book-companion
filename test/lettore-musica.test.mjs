// IL LETTORE DELLA MUSICA COME QUELLI CHE SI CONOSCONO (chiesto dal lettore:
// «un mini player fatto come si deve, come se avessi YouTube o Spotify»):
// «⏮» che riavvolge o torna indietro, i brani che vengono dopo, la faccia di
// una melodia senza copertina, il punto toccato sulla barra.
import { indietroDa, prossimi, facciaDi, tempoAl, RIAVVOLGE_DOPO } from "../src/lib/music.js";

export default async function (t) {
  // ---- ⏮ -------------------------------------------------------------------
  t.c("a brano avviato riavvolge", indietroDa({ i: 2, t: RIAVVOLGE_DOPO + 1 }).riavvolgi);
  t.eq("nei primi secondi torna al brano prima", indietroDa({ i: 2, t: 1 }).i, 1);
  t.c("proprio al confine torna ancora indietro", indietroDa({ i: 2, t: RIAVVOLGE_DOPO }).i === 1);
  t.c("al primo brano riavvolge e basta", indietroDa({ i: 0, t: 1 }).riavvolgi);
  t.c("fuori da una coda (sempre al primo) non c'e' un prima", indietroDa({ i: 0, t: 1 }).riavvolgi);

  // ---- i prossimi -------------------------------------------------------------
  const coda = ["a", "b", "c", "d"].map((id) => ({ id, name: id.toUpperCase() }));
  t.eq("quelli dopo, in ordine", prossimi(coda, 1, 5).map((x) => x.id).join(""), "cda");
  t.eq("col loro posto nella coda", prossimi(coda, 1, 5).map((x) => x.indice).join(""), "230");
  t.eq("in fondo si ricomincia", prossimi(coda, 3, 2).map((x) => x.id).join(""), "ab");
  t.eq("al piu' quanti se ne chiedono", prossimi(coda, 0, 2).length, 2);
  t.eq("mai quello che suona", prossimi(coda, 0, 10).some((x) => x.id === "a"), false);
  t.eq("un brano solo non ha prossimi", prossimi([coda[0]], 0, 5).length, 0);
  t.eq("niente coda, niente prossimi", prossimi(undefined, 0).length, 0);

  // ---- la faccia ----------------------------------------------------------------
  const a = facciaDi("Pioggia sul tetto");
  t.eq("lo stesso nome, la stessa faccia", JSON.stringify(facciaDi("Pioggia sul tetto")), JSON.stringify(a));
  const facce = new Set(["Pioggia", "Camino", "Arpa", "Vento", "Taverna", "Mare", "Bosco", "Notte"].map((n) => JSON.stringify(facciaDi(n))));
  t.c("nomi diversi, facce diverse", facce.size >= 7, `${facce.size} facce su 8`);
  t.c("l'angolo sta nel giro", a.angolo >= 0 && a.angolo < 360);
  const angoli = new Set(Array.from({ length: 20 }, (_, i) => facciaDi(`brano ${i}`).angolo));
  t.c("e cambia col nome", angoli.size >= 15, `${angoli.size} angoli su 20`);
  t.c("un nome vuoto ha una faccia", typeof facciaDi("").glifo === "string" && facciaDi("").glifo.length > 0);
  const glifi = new Set(Array.from({ length: 200 }, (_, i) => facciaDi(`brano ${i}`).glifo));
  t.c("i glifi si usano tutti", glifi.size === 8, `${glifi.size}`);
  const versi = new Set(Array.from({ length: 50 }, (_, i) => facciaDi(`brano ${i}`).verso));
  t.c("i colori si scambiano", versi.size === 2);

  // ---- il punto toccato -------------------------------------------------------
  t.eq("a meta' barra, a meta' brano", tempoAl(0.5, 200), 100);
  t.eq("oltre la fine, la fine", tempoAl(1.4, 200), 200);
  t.eq("prima dell'inizio, l'inizio", tempoAl(-0.2, 200), 0);
  t.eq("durata ignota: dall'inizio", tempoAl(0.5, NaN), 0);
  t.eq("un flusso senza fine: dall'inizio", tempoAl(0.5, Infinity), 0);
}
