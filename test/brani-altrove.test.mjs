// I BRANI DELL'ALTRO DISPOSITIVO (`music.js`): chiesto dal lettore, con le
// raccolte del tablet vuote sul PC: «c'è modo di allineare i due dispositivi
// senza però usare il cloud?». I nomi dei brani viaggiano, i byte no; il
// file portato a mano (cavo, Quick Share) si riconosce dalla voce che c'e'
// gia' e prende la SUA chiave, cosi' le raccolte restano quelle.
import { voceDaAdottare, braniAltrove, pianoDaCartella, nomeMelodia } from "../src/lib/music.js";

const f = (name, size = 1000, type = "audio/mpeg") => ({ name, size, type });
const v = (percorso, file) => ({ percorso: percorso.split("/"), file: file || f(percorso.split("/").pop()) });

export default async function (t) {
  // ---- QUALI MANCANO QUI ---------------------------------------------------
  const favs = [
    { id: "m1", name: "Cadia", file: "02 - Cadia.mp3", size: 1000, mime: "audio/mpeg", trackId: "t1" },
    { id: "m2", name: "Night", size: 500, mime: "audio/ogg", trackId: "t2" },
    { id: "m3", name: "Tolto", size: 700, mime: "audio/mpeg", trackId: "t3", deleted: true },
    { id: "m4", name: "Pioggia", url: "https://youtu.be/abcdefgh" },
    { id: "m5", name: "Gia' qui", size: 1000, mime: "audio/mpeg", trackId: "t5" },
  ];
  const qui = new Set(["t5"]);
  t.eq("mancano qui i brani da file senza byte, non i link né le lapidi", braniAltrove(favs, qui).map((x) => x.id).join(), "m1,m2");
  t.eq("finché non si sa cosa c'è qui, niente manca", braniAltrove(favs, null).length, 0);

  // ---- IL FILE PORTATO SI RICONOSCE ----------------------------------------
  t.eq("dal nome della melodia e dal peso", voceDaAdottare(f("Night.ogg", 500, "audio/ogg"), favs, qui)?.id, "m2");
  t.eq("o dal nome del file, se la melodia è stata rinominata", voceDaAdottare(f("02 - Cadia.mp3", 1000), [...favs, { id: "m6", name: "Altro", size: 1000, mime: "audio/mpeg", trackId: "t6" }], qui)?.id, "m1");
  t.eq("con lo stesso nome ma un altro peso è un altro file", voceDaAdottare(f("Night.ogg", 501, "audio/ogg"), favs, qui), null);
  t.eq("un brano che qui ha già i byte non si adotta", voceDaAdottare(f("Gia' qui.mp3", 1000), [favs[4]], qui), null);
  t.eq("un brano tolto non si adotta", voceDaAdottare(f("Tolto.mp3", 700), favs, qui), null);
  // rinominato prima che si ricordasse il nome del file: basta il peso, se è uno solo
  const rinominato = [{ id: "r1", name: "Il mio preferito", size: 4321, mime: "audio/mpeg", trackId: "x1" }];
  t.eq("senza un nome uguale basta il peso, se è uno solo fra quelli che mancano", voceDaAdottare(f("track07.mp3", 4321), rinominato, new Set())?.id, "r1");
  t.eq("…e del tipo giusto", voceDaAdottare(f("track07.ogg", 4321, "audio/ogg"), rinominato, new Set()), null);
  const due = [...rinominato, { id: "r2", name: "Altro", size: 4321, mime: "audio/mpeg", trackId: "x2" }];
  t.eq("due col peso uguale: nel dubbio niente", voceDaAdottare(f("track07.mp3", 4321), due, new Set()), null);
  t.eq("e il nome della melodia dal file è quello di sempre", nomeMelodia("Night.ogg"), "Night");

  // ---- LA CARTELLA PORTATA DAL TABLET --------------------------------------
  const raccolte = [
    { id: "rw", name: "WARHAMMER 40k", brani: ["m1"] },
    { id: "rh", name: "Horror playlist", brani: ["m2"] },
  ];
  const cartella = [
    v("WARHAMMER 40k/02 - Cadia.mp3"),
    v("Horror playlist/Night.ogg", f("Night.ogg", 500, "audio/ogg")),
    v("Horror playlist/Nuovo.mp3", f("Nuovo.mp3", 1234)),
  ];
  const piano = pianoDaCartella("Music", cartella, { raccolte, favs, qui });
  t.eq("i brani dell'altro dispositivo prendono i byte sotto la loro chiave", piano.adottati.map((a) => `${a.voce.trackId}<${a.file.name}`).join(), "t1<02 - Cadia.mp3,t2<Night.ogg");
  t.eq("non diventano brani nuovi", piano.flatMap((p) => p.nuovi.map((x) => x.name)).join(), "Nuovo.mp3");
  t.eq("e le raccolte che li hanno già non cambiano", piano.find((p) => p.nome === "WARHAMMER 40k").sequenza.length, 0);
  t.eq("un file nuovo si aggiunge come prima", piano.find((p) => p.nome === "Horror playlist").sequenza.map((x) => x.id || x.file.name).join(), "Nuovo.mp3");
  const due_volte = pianoDaCartella("Music", [v("A/Night.ogg", f("Night.ogg", 500, "audio/ogg")), v("B/Night.ogg", f("Night.ogg", 500, "audio/ogg"))], { favs, qui });
  t.eq("lo stesso brano in due cartelle si adotta una volta", due_volte.adottati.length, 1);
  t.eq("…e sta in tutt'e due le raccolte", due_volte.map((p) => p.sequenza.map((x) => x.id).join()).join("|"), "m2|m2");
  const senzaQui = pianoDaCartella("Music", cartella, { raccolte, favs });
  t.eq("senza sapere cosa c'è qui non si adotta niente (come prima)", senzaQui.adottati.length, 0);
  t.eq("e un brano rinominato non si ricarica: il nome del file lo riconosce", senzaQui.find((p) => p.nome === "WARHAMMER 40k").nuovi.length, 0);
  // riconosciuto dal solo peso: si adotta e si rimette, non si ricarica accanto
  const perPeso = pianoDaCartella("Preferiti", [v("track07.mp3", f("track07.mp3", 4321))], { favs: rinominato, qui: new Set() });
  t.eq("un brano riconosciuto dal peso si adotta", perPeso.adottati.map((a) => a.voce.id).join(), "r1");
  t.eq("…e nella raccolta va lui, non un doppione", perPeso[0].sequenza.map((x) => x.id || x.file.name).join(), "r1");
}
