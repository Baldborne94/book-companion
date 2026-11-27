// LA MUSICA DI BALDMUSIC DAL NAS (`lib/navidrome.js`), chiesta dal lettore:
// «agganciare la mia applicazione baldmusic già presente sul nas», «raccolte
// e playlist», «una volta date le credenziali non me le chieda ogni volta».
// Un Navidrome finto che risponde come l'API Subsonic.
import { createHash } from "node:crypto";
import { md5 } from "../src/lib/md5.js";
import { normalizzaServer, credenziali, salvaCollegamento, collegato, CHIAVE_NAVIDROME, indirizzo, chiama, raccolteNavidrome, braniNavidrome, streamDi, fraseNavidrome, provaServer } from "../src/lib/navidrome.js";
import { chiaveMelodia, legameMusica, comeRiprendere, stessaMelodia } from "../src/lib/music.js";

const memoria = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m };
};
const risposta = (corpo, status = 200) => ({ ok: status < 400, status, json: async () => corpo });
const ok = (dati) => risposta({ "subsonic-response": { status: "ok", version: "1.16.1", ...dati } });

export default async (t) => {
  for (const s of ["", "abc", "sesame" + "c19b2d", "è più già 🎵", "x".repeat(55), "y".repeat(56), "z".repeat(130)])
    t.eq(`md5 di ${JSON.stringify(s.slice(0, 12))} (${s.length})`, md5(s), createHash("md5").update(s).digest("hex"));

  t.eq("l'indirizzo senza schema è https", normalizzaServer("nas.tail1234.ts.net"), "https://nas.tail1234.ts.net");
  t.eq("…senza «/rest» né la pagina dell'app", normalizzaServer("https://nas.tail1234.ts.net/app/#/album"), "https://nas.tail1234.ts.net");
  t.eq("…e uno che non è un indirizzo no", normalizzaServer("ftp://x"), null);

  // LA PASSWORD NON SI SALVA: sale e gettone di Subsonic, e non si richiedono
  const st = memoria();
  const cred = credenziali("nas.tail1234.ts.net", " baldborne ", "segreta", "sale123");
  t.eq("il gettone è md5(password + sale)", cred.gettone, createHash("md5").update("segretasale123").digest("hex"));
  salvaCollegamento(cred, st);
  t.c("la password non è nella memoria del dispositivo", !st.getItem(CHIAVE_NAVIDROME).includes("segreta"));
  t.eq("riaperta l'app, il collegamento c'è ancora", JSON.stringify(collegato(st)), JSON.stringify({ base: "https://nas.tail1234.ts.net", utente: "baldborne", sale: "sale123", gettone: cred.gettone }));
  salvaCollegamento(null, st);
  t.eq("scollegato, non c'è più", collegato(st), null);
  t.eq("una memoria rovinata non è un collegamento", collegato({ getItem: () => "{" }), null);
  t.eq("…né una a metà, senza gettone", collegato({ getItem: () => JSON.stringify({ base: "https://x", utente: "u" }) }), null);

  const url = new URL(indirizzo(cred, "getPlaylists"));
  t.eq("la domanda porta utente, gettone, sale, versione, cliente e JSON", `${url.pathname} ${["u", "t", "s", "v", "c", "f"].map((k) => url.searchParams.get(k)).join(" ")}`, `/rest/getPlaylists baldborne ${cred.gettone} sale123 1.16.1 bookcompanion json`);
  t.c("…e mai la password", !url.href.includes("segreta") && !url.searchParams.has("p"));
  t.eq("lo streaming chiede il file com'è", new URL(streamDi(cred, "s9")).searchParams.get("format"), "raw");

  // le raccolte di BaldMusic sono playlist col commento della cartella
  const playlist = [
    { id: "p2", name: "Da correre", songCount: 12 },
    { id: "p1", name: "Movie Soundtracks", comment: "Raccolta della cartella «Movie Soundtracks» · BaldMusic", songCount: 40 },
    { id: "p3", name: "Disney Italia", comment: "Raccolta della cartella «Disney Italia» · BaldMusic", songCount: 2 },
    { id: "p4", name: "anime", songCount: 1 },
  ];
  const chieste = [];
  const nav = async (u) => {
    chieste.push(u);
    const m = new URL(u).pathname.split("/").pop();
    if (m === "getPlaylists") return ok({ playlists: { playlist } });
    if (m === "getPlaylist") return new URL(u).searchParams.get("id") === "p3"
      ? ok({ playlist: { id: "p3", entry: [{ id: "s1", title: "Il cerchio della vita", artist: "Ivana Spagna", duration: 290 }, { id: "s2", title: "Hakuna Matata", duration: 210 }] } })
      : ok({ playlist: { id: "p4", entry: { id: "s9", title: "Sola" } } });
    if (m === "ping") return ok({});
    return risposta({}, 404);
  };
  const rac = await raccolteNavidrome(cred, { chiedi: nav });
  t.eq("prima le raccolte delle cartelle, poi le playlist, ognuna per nome", rac.map((r) => `${r.tipo}:${r.name}`).join(", "), "raccolta:Disney Italia, raccolta:Movie Soundtracks, playlist:anime, playlist:Da correre");
  t.eq("la chiave non si confonde con le raccolte di qui", rac[0].id, "nd:p3");
  const brani = await braniNavidrome(cred, "nd:p3", { chiedi: nav });
  t.eq("i brani col titolo e l'artista", brani.map((b) => b.name).join(" | "), "Il cerchio della vita · Ivana Spagna | Hakuna Matata");
  t.eq("…e il loro id su Navidrome", brani.map((b) => b.nd).join(), "s1,s2");
  t.eq("una playlist con un brano solo (Subsonic lo manda senza elenco)", (await braniNavidrome(cred, "p4", { chiedi: nav })).map((b) => b.nd).join(), "s9");
  t.eq("ping", await provaServer(cred, { chiedi: nav }), true);

  // i guasti si dicono con la strada
  const motivo = async (chiedi) => (await chiama(cred, "ping", {}, { chiedi }).catch((e) => e)).motivo;
  t.eq("utente o password sbagliati", await motivo(async () => risposta({ "subsonic-response": { status: "failed", error: { code: 40, message: "Wrong username or password" } } })), "credenziali");
  t.eq("NAS spento o Tailscale spento", await motivo(async () => { throw new TypeError("Failed to fetch"); }), "rete");
  t.eq("un indirizzo che non è Navidrome", await motivo(async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError("<html>"); } })), "formato");
  t.c("la frase delle credenziali dice di riscriverle", fraseNavidrome({ motivo: "credenziali" }).includes("riscrivili"));
  t.c("quella della rete dice Tailscale", fraseNavidrome({ motivo: "rete" }).includes("Tailscale"));

  // LA MUSICA DI UN LIBRO SUONA ANCHE DA BALDMUSIC: il brano si ricorda per
  // il suo id, e «▶ Riprendi» riprende la raccolta del NAS da quel brano
  t.eq("il punto di un brano di BaldMusic ha la sua chiave", chiaveMelodia(brani[1]), "n:s2");
  const music = { current: { nd: "s2", name: "Hakuna Matata", src: "https://…" }, queue: { origine: "nd:p3", raccolta: "nd:p3", nome: "Disney Italia" } };
  const legame = legameMusica(music);
  t.eq("il libro ricorda il brano, la raccolta e il suo nome", `${legame.nd} ${legame.raccolta} ${legame.nomeRaccolta} ${legame.coda}`, "s2 nd:p3 Disney Italia true");
  const come = comeRiprendere(legame, { raccolte: [], favs: [], tutte: [] });
  t.eq("…e la riprende dal NAS", `${come.navidrome?.id} ${come.navidrome?.name}`, "nd:p3 Disney Italia");
  t.eq("lo stesso brano si ritrova fra quelli chiesti al NAS", brani.findIndex((b) => stessaMelodia(come.melodia, b)), 1);
  t.c("un brano di qui non è un brano di BaldMusic", !stessaMelodia({ trackId: "a" }, { nd: "a" }) && !stessaMelodia({ nd: "a" }, { trackId: "a" }));
};
