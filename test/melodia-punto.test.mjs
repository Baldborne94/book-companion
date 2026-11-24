// IL PUNTO DELLE MELODIE E IL BRANO DELLE RACCOLTE (chiesto dal lettore:
// «selezionare cosa riprodurre nelle raccolte e quando si ferma la melodia
// ripartire dal punto in cui si è interrotta»). Ogni funzione prende il suo
// deposito da fuori: niente stub lasciati su `globalThis`.
import {
  chiaveMelodia, puntoDi, segnaPunto, dimenticaPunto, daDoveRiprendere, segnaDove, doveDi, minuti, embedUrl, parseYouTube, PUNTI_TENUTI, MARGINE,
} from "../src/lib/music.js";

const deposito = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};

export default async function (t) {
  // ---- chi ha un punto ---------------------------------------------------------
  const file = { id: "a", trackId: "T1", name: "Pioggia" };
  const video = { id: "b", url: "https://www.youtube.com/watch?v=abcdefghijk", name: "Camino" };
  const lista = { id: "c", url: "https://www.youtube.com/playlist?list=PL123", name: "Arpe" };
  t.eq("un file per il suo brano", chiaveMelodia(file), "f:T1");
  t.eq("un video per il suo id", chiaveMelodia(video), "y:abcdefghijk");
  t.eq("lo stesso video da youtu.be e' lo stesso", chiaveMelodia({ url: "https://youtu.be/abcdefghijk" }), "y:abcdefghijk");
  t.eq("una playlist non ha un punto solo", chiaveMelodia(lista), null);

  // ---- si scrive, si rilegge ---------------------------------------------------
  const st = deposito();
  t.eq("niente punto, da capo", puntoDi(file, st), 0);
  segnaPunto(file, 52.7, 120, { st, ora: 1 });
  t.eq("ripresa al secondo intero", puntoDi(file, st), 52);
  t.eq("il player del file non vede quello del video", puntoDi(video, st), 0);
  segnaPunto(lista, 30, 300, { st, ora: 2 });
  t.eq("una playlist non si segna", Object.keys(JSON.parse(st.getItem("bc_melodia_punti"))).length, 1);
  segnaPunto(file, 2, 120, { st, ora: 3 });
  t.eq("i primi secondi non contano: da capo", puntoDi(file, st), 0);
  segnaPunto(file, 60, 120, { st, ora: 4 });
  segnaPunto(file, 117, 120, { st, ora: 5 });
  t.eq("sul finire non conta: la prossima volta da capo", puntoDi(file, st), 0);
  segnaPunto(file, 60, NaN, { st, ora: 6 });
  t.eq("senza durata (un flusso) si tiene", puntoDi(file, st), 60);
  segnaPunto(file, NaN, 120, { st, ora: 7 });
  t.eq("un tempo che non e' un numero non cancella", puntoDi(file, st), 60);
  dimenticaPunto(file, st);
  t.eq("arrivata in fondo: dimenticata", puntoDi(file, st), 0);

  // ---- se ne tengono le piu' recenti ---------------------------------------------
  const tanti = deposito();
  for (let i = 0; i < PUNTI_TENUTI + 3; i++) segnaPunto({ trackId: `T${i}` }, 30, 100, { st: tanti, ora: i });
  const punti = JSON.parse(tanti.getItem("bc_melodia_punti"));
  t.eq("al piu' PUNTI_TENUTI", Object.keys(punti).length, PUNTI_TENUTI);
  t.c("via le piu' vecchie", !("f:T0" in punti) && `f:T${PUNTI_TENUTI + 2}` in punti);
  const rotto = deposito();
  rotto.setItem("bc_melodia_punti", "5");
  t.eq("un deposito che non e' una mappa vale vuoto", puntoDi(file, rotto), 0);
  segnaPunto(file, 30, 100, { st: rotto, ora: 1 });
  t.eq("e ci si riscrive sopra", puntoDi(file, rotto), 30);
  rotto.setItem("bc_melodia_punti", "{rotto");
  t.eq("e anche uno rotto", puntoDi(file, rotto), 0);
  segnaPunto(file, 30, 100, { st: { getItem: () => null, setItem: () => { throw new Error("pieno"); } } });
  t.c("un disco pieno non ferma la musica", true);

  // ---- dove riprendere, a file caricato ----------------------------------------
  t.eq("dal punto", daDoveRiprendere(52, 120), 52);
  t.eq("niente punto, da capo", daDoveRiprendere(0, 120), 0);
  t.eq("un punto oltre la fine (il file e' cambiato): da capo", daDoveRiprendere(200, 120), 0);
  t.eq("un punto a ridosso della fine: da capo", daDoveRiprendere(120 - MARGINE + 1, 120), 0);
  t.eq("durata ancora ignota: dal punto", daDoveRiprendere(52, NaN), 52);

  // ---- la raccolta ricorda il brano --------------------------------------------
  const r = { id: "R" };
  const brani = [{ id: "p" }, { id: "c" }, { id: "a" }];
  const sr = deposito();
  t.eq("mai suonata: dal primo", doveDi(r, brani, sr), 0);
  segnaDove("R", "c", sr);
  t.eq("dal brano a cui si era", doveDi(r, brani, sr), 1);
  segnaDove("altra", "a", sr);
  t.eq("ogni raccolta il suo", doveDi(r, brani, sr), 1);
  t.eq("un brano tolto dalla raccolta: dal primo", doveDi(r, [{ id: "p" }, { id: "a" }], sr), 0);

  // ---- il tempo detto -----------------------------------------------------------
  t.eq("minuti e secondi", minuti(133), "2:13");
  t.eq("i secondi a due cifre", minuti(62), "1:02");
  t.eq("le ore", minuti(3725), "1:02:05");

  // ---- YouTube riparte dal punto --------------------------------------------------
  t.c("il video dal suo punto", /[?&]start=52(&|$)/.test(embedUrl(parseYouTube(video.url), { inizio: 52.9 })), embedUrl(parseYouTube(video.url), { inizio: 52.9 }));
  t.c("senza punto niente start", !/start=/.test(embedUrl(parseYouTube(video.url))));
  t.c("una playlist non salta", !/start=/.test(embedUrl(parseYouTube(lista.url), { inizio: 52 })));
}
