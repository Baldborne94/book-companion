// LA MUSICA SU GOOGLE DRIVE: sale come i libri, scende quando la suoni
// (chiesto dal lettore: «si fallo, scaricali solo quando li suono»).
//
// Tutto quel che decide sbaglia in silenzio: un brano abbinato al file
// sbagliato suona un'altra canzone, uno non riconosciuto sale due volte, una
// voce che viaggia senza stare su Drive torna a essere il nome che non suona
// — il rumore per cui la musica si era fermata sul suo dispositivo.
import { abbinaMelodie, melodieDaCaricare, melodieFile, nomeMelodiaSuDrive, segnaSuDrive, CARTELLE, scegliCartella } from "../src/lib/driveCore.js";
import { mergePrefs } from "../src/lib/syncCore.js";
import { portaQuiMelodia } from "../src/lib/music.js";

const m = (trackId, extra = {}) => ({ id: `v-${trackId}`, trackId, name: `Brano ${trackId}`, size: 1000, mime: "audio/mpeg", addedAt: 100, updatedAt: 100, ...extra });
const file = (id, extra = {}) => ({ id, name: `${id}.mp3`, size: "1", ...extra });
const chiavi = (mappa) => [...mappa.entries()].map(([k, f]) => `${k}=${f.id}`).sort().join(",");

export default async function (t) {
  // ---- CHI E' UNA MELODIA DA FILE -------------------------------------------
  {
    const l = melodieFile([m("a"), { id: "y", url: "https://youtu.be/x" }, m("b", { deleted: true }), null]);
    t.eq("solo i file vivi, non i link e non le lapidi", l.map((x) => x.trackId).join(","), "a");
  }

  // ---- RICONOSCERE PRIMA DI MANDARE ----------------------------------------
  {
    // il segno nostro vince su tutto, anche su un nome e una misura diversi
    const r = abbinaMelodie([m("a", { size: 5 })], [file("f1", { size: "9", name: "altro.mp3", appProperties: { bcTrack: "a" } })]);
    t.eq("il segno bcTrack abbina", chiavi(r.mappa), "a=f1");
    t.eq("e chi ha gia' il segno non si risegna", r.daSegnare.length, 0);
  }
  {
    // caricata a mano su Drive: stessa misura al byte, nome qualunque
    const r = abbinaMelodie([m("a", { size: 4242 })], [file("f1", { size: "4242", name: "01 - traccia.mp3" }), file("f2", { size: "1" })]);
    t.eq("la misura unica abbina", chiavi(r.mappa), "a=f1");
    t.eq("e si segna, per il prossimo dispositivo", r.daSegnare.map((x) => `${x.trackId}>${x.fileId}`).join(","), "a>f1");
  }
  {
    // due file con la stessa misura: decide il nome
    const r = abbinaMelodie(
      [m("a", { size: 7, name: "Pioggia" })],
      [file("f1", { size: "7", name: "Vento.mp3" }), file("f2", { size: "7", name: "pioggia.mp3" })]
    );
    t.eq("stessa misura, decide il nome", chiavi(r.mappa), "a=f2");
    // e qui il nome da solo NON basterebbe (ce n'e' un secondo, di misura
    // diversa): e' la misura a scegliere fra i due con lo stesso nome
    const r2 = abbinaMelodie(
      [m("a", { size: 7, name: "Pioggia" })],
      [file("f1", { size: "7", name: "Vento.mp3" }), file("f2", { size: "7", name: "pioggia.mp3" }), file("f3", { size: "9", name: "Pioggia.ogg" })]
    );
    t.eq("misura e nome insieme sciolgono il doppio", chiavi(r2.mappa), "a=f2");
    // stessa misura E stesso nome: due copie, non si sceglie a caso
    const r3 = abbinaMelodie([m("a", { size: 7, name: "Neve" })], [file("f1", { size: "7", name: "Neve.mp3" }), file("f2", { size: "7", name: "neve.mp3" })]);
    t.eq("due copie identiche: niente", r3.mappa.size, 0);
  }
  {
    // due file con la stessa misura e nessun nome che decide: NON si abbina
    const r = abbinaMelodie([m("a", { size: 7, name: "Neve" })], [file("f1", { size: "7" }), file("f2", { size: "7" })]);
    t.eq("nel dubbio non si abbina", r.mappa.size, 0);
    t.eq("e si conta come ambiguo", r.ambigui, 1);
  }
  {
    // senza misura, il nome unico
    const r = abbinaMelodie([m("a", { size: 0, name: "Notturno" })], [file("f1", { name: "Notturno (1).mp3", size: "3" })]);
    t.eq("il nome unico abbina", chiavi(r.mappa), "a=f1");
    const d = abbinaMelodie([m("a", { size: 0, name: "Notturno" })], [file("f1", { name: "notturno.mp3" }), file("f2", { name: "Notturno.ogg" })]);
    t.eq("due nomi uguali: niente", d.mappa.size, 0);
  }
  {
    // un file non si da' a due melodie
    const r = abbinaMelodie([m("a", { size: 7 }), m("b", { size: 7 })], [file("f1", { size: "7" })]);
    t.eq("un file, una melodia", r.mappa.size, 1);
  }
  {
    // il segno di un'ALTRA melodia non si prende per sbaglio con la misura
    const r = abbinaMelodie([m("a", { size: 7 }), m("b", { size: 7 })], [file("f1", { size: "7", appProperties: { bcTrack: "b" } })]);
    t.eq("il file segnato resta di chi lo porta", chiavi(r.mappa), "b=f1");
  }

  // ---- COSA SALE -------------------------------------------------------------
  {
    const favs = [m("a"), m("b"), m("c"), m("d", { deleted: true })];
    const qui = new Set(["a", "b", "d"]);
    t.eq("sale chi ha i byte qui e Drive no", melodieDaCaricare(favs, { qui, lassu: new Set(["b"]) }).map((x) => x.trackId).join(","), "a");
    t.eq("al buio non sale niente", melodieDaCaricare(favs, { qui, lassu: null }).length, 0);
    t.eq("senza byte qui non sale niente", melodieDaCaricare(favs, { qui: null, lassu: new Set() }).length, 0);
  }

  // ---- IL NOME E LA CARTELLA -------------------------------------------------
  t.eq("nome con l'estensione del tipo", nomeMelodiaSuDrive({ name: "Pioggia: notte", mime: "audio/mp4" }), "Pioggia notte.m4a");
  t.eq("tipo che non conosciamo: mp3", nomeMelodiaSuDrive({ name: "X", mime: "audio/strano" }), "X.mp3");
  t.eq("senza nome", nomeMelodiaSuDrive({}), "Melodia senza nome.mp3");
  t.eq("la cartella della musica si chiama Musica", CARTELLE.musica, "Musica");
  t.eq("si trova per nome se c'e' gia'", scegliCartella("musica", { cartelle: [{ id: "L", name: "Libri" }, { id: "M", name: "Musica" }] }), "M");

  // ---- IL SEGNO SULLA VOCE ---------------------------------------------------
  {
    const favs = [m("a"), m("b"), m("c", { drive: true, updatedAt: 50 }), m("d", { deleted: true }), { id: "y", url: "u" }];
    const { lista, cambiate } = segnaSuDrive(favs, new Set(["a", "c", "d"]), 999);
    const per = Object.fromEntries(lista.map((f) => [f.id, f]));
    t.eq("si segnano quelle su Drive, lapidi comprese", cambiate, 2);
    t.c("la a porta il segno col timbro nuovo", per["v-a"].drive === true && per["v-a"].updatedAt === 999);
    t.c("la b no", !per["v-b"].drive && per["v-b"].updatedAt === 100);
    t.c("la c gia' segnata non si ritimbra", per["v-c"].updatedAt === 50);
    t.c("la lapide si segna", per["v-d"].drive === true && per["v-d"].deleted === true);
    t.c("il link non si tocca", per.y === favs[4]);
    t.eq("senza elenco non cambia niente", segnaSuDrive(favs, null).cambiate, 0);
  }

  // ---- LA VOCE VIAGGIA SOLO DA QUANDO STA SU DRIVE ---------------------------
  {
    const locale = { music_favs: [m("a"), m("b", { drive: true, updatedAt: 200 })], music_lists: [], updated_at: 1 };
    const r = mergePrefs(locale, null);
    t.eq("sale solo la voce segnata", r.merged.music_favs.map((f) => f.trackId).join(","), "b");
    t.eq("qui restano tutt'e due", r.favsLocali.map((f) => f.trackId).sort().join(","), "a,b");
  }
  {
    // l'altro dispositivo la riceve, e la suonera' scaricandola
    const remoto = { music_favs: [m("b", { drive: true, updatedAt: 200 }), m("z", { updatedAt: 300 })], music_lists: [], updated_at: 5 };
    const r = mergePrefs({ music_favs: [], music_lists: [], updated_at: 1 }, remoto);
    t.eq("dal cloud entra la voce segnata, non quella senza segno", r.favsLocali.map((f) => f.trackId).join(","), "b");
  }
  {
    // la lapide di un brano che viaggiava arriva di la'
    const remoto = { music_favs: [m("b", { drive: true, deleted: true, updatedAt: 300 })], music_lists: [], updated_at: 5 };
    const r = mergePrefs({ music_favs: [m("b", { drive: true, updatedAt: 200 })], music_lists: [], updated_at: 1 }, remoto);
    t.c("la cancellazione arriva", r.favsLocali.find((f) => f.trackId === "b")?.deleted === true);
  }
  {
    // la stessa voce, qui ancora senza segno e lassu' segnata: resta una
    const remoto = { music_favs: [m("a", { drive: true, updatedAt: 200 })], music_lists: [], updated_at: 5 };
    const r = mergePrefs({ music_favs: [m("a")], music_lists: [], updated_at: 1 }, remoto);
    t.eq("una voce sola, non due", r.favsLocali.length, 1);
    t.c("ed e' quella segnata", r.favsLocali[0].drive === true);
  }

  // ---- SCENDE QUANDO LA SUONI ------------------------------------------------
  {
    const chiesti = [];
    const blob = { size: 3 };
    const r = await portaQuiMelodia(m("a"), { prendi: async (id) => (chiesti.push(id), blob) });
    t.c("si chiede il suo trackId e torna i byte", chiesti.join() === "a" && r === blob);
    t.eq("su Drive non c'e': null", await portaQuiMelodia(m("a"), { prendi: async () => null }), null);
    t.eq("un link non si chiede a Drive", await portaQuiMelodia({ id: "y", url: "u" }, { prendi: async () => blob }), null);
    let esploso = false;
    try {
      await portaQuiMelodia(m("a"), { prendi: async () => { throw new Error("rete"); } });
    } catch {
      esploso = true;
    }
    t.c("un guasto si alza, non diventa «non c'e'»", esploso);
  }
}
