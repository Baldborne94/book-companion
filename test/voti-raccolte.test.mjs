// IL VOTO DELLE RACCOLTE E «TUTTI LETTI» (`lib/votiRaccolte.js`): il voto
// della saga o la media dei volumi votati, quali volumi cambiano, e il voto
// che viaggia nella colonna del cuore senza toccare lo schema.
import {
  segnaVoto, votoMio, mediaDeiVolumi, votoDaMostrare, dettoVoto, daSegnare, inViaggio, dalViaggio, fondiVoti, puoEssereVotata,
} from "../src/lib/votiRaccolte.js";
import { mergePrefs } from "../src/lib/syncCore.js";

export default async function (t) {
  // ---- il voto --------------------------------------------------------------------
  let v = segnaVoto([], "saga:berserk", 4.5, { nome: "Berserk", ora: 10 });
  t.eq("il voto si segna", votoMio(v, "saga:berserk"), 4.5);
  t.eq("col nome della raccolta", v[0].nome, "Berserk");
  t.eq("a mezze stelle", votoMio(segnaVoto([], "saga:x", 3.3, { ora: 1 }), "saga:x"), 3.5);
  t.eq("mai oltre cinque", votoMio(segnaVoto([], "saga:x", 9, { ora: 1 }), "saga:x"), 5);
  v = segnaVoto(v, "saga:berserk", 0, { ora: 20 });
  t.eq("zero lo toglie", votoMio(v, "saga:berserk"), 0);
  t.c("e lascia la lapide, perche' non risorga dall'altro dispositivo", v.find((x) => x.id === "saga:berserk")?.deleted === true);
  t.eq("tolto, resta il nome", v[0].nome, "Berserk");
  t.eq("un genere non si vota", segnaVoto([], "genere:horror", 4, { ora: 1 }).length, 0);
  t.c("saghe e autori si'", puoEssereVotata("saga:akira") && puoEssereVotata("autore:otomo katsuhiro"));

  // ---- la media dei volumi -----------------------------------------------------------
  const libri = [{ rating: 5 }, { rating: 4.5 }, { rating: 4 }, { rating: 0 }, {}];
  const m = mediaDeiVolumi(libri);
  t.eq("media dei soli votati", m.media, 4.5);
  t.eq("quanti votati", m.votati, 3);
  t.eq("su quanti", m.di, 5);
  t.eq("a un decimale", mediaDeiVolumi([{ rating: 4 }, { rating: 4.5 }, { rating: 5 }, { rating: 3.5 }]).media, 4.3);
  t.eq("nessun voto, nessuna media", mediaDeiVolumi([{}, { rating: 0 }]), null);
  t.eq("il voto tuo vince sulla media", JSON.stringify(votoDaMostrare(segnaVoto([], "saga:b", 3, { ora: 1 }), "saga:b", libri)), JSON.stringify({ voto: 3, mio: true }));
  t.c("senza il tuo, la media detta come tale", votoDaMostrare([], "saga:b", libri)?.media === true && votoDaMostrare([], "saga:b", libri).voto === 4.5);
  t.eq("senza niente, niente", votoDaMostrare([], "saga:b", [{}]), null);
  t.eq("detto all'italiana", dettoVoto(4.5), "4,5");

  // ---- tutti letti, tutti da leggere --------------------------------------------------
  const stati = { a: "read", b: "unread", c: "reading", d: "abandoned" };
  const vol = ["a", "b", "c", "d"].map((id) => ({ id }));
  const quali = (stato) => daSegnare(vol, stato, (id) => stati[id]).map((x) => x.id).join("");
  t.eq("«tutti letti» tocca solo chi non lo e'", quali("read"), "bc");
  t.eq("un abbandonato non diventa letto", quali("read").includes("d"), false);
  t.eq("«tutti da leggere» rimette anche gli abbandonati", quali("unread"), "acd");

  // ---- il viaggio nella colonna del cuore -----------------------------------------------
  const cuori = [{ id: "saga:akira", nome: "Akira", updatedAt: 5 }];
  const voti = segnaVoto([], "saga:berserk", 4.5, { nome: "Berserk", ora: 7 });
  const viaggio = inViaggio(cuori, voti);
  t.c("i voti hanno la loro chiave", viaggio.some((x) => x.id === "voto|saga:berserk") && !viaggio.some((x) => x.id === "saga:berserk"));
  const tornati = dalViaggio(viaggio);
  t.eq("tornano i cuori", JSON.stringify(tornati.preferite), JSON.stringify(cuori));
  t.eq("e i voti, con la chiave di prima", JSON.stringify(tornati.voti), JSON.stringify(voti));
  t.eq("una voce senza chiave non passa", dalViaggio([{ nome: "x" }, null]).preferite.length, 0);

  // ---- due dispositivi: i voti si fondono nel giro delle preferenze ----------------------------
  const pc = { raccolte_fav: inViaggio(cuori, segnaVoto([], "saga:berserk", 4.5, { ora: 100 })), updated_at: 100 };
  const tab = { raccolte_fav: inViaggio([], segnaVoto([], "saga:akira", 4, { ora: 50 })), updated_at: 200 };
  const { merged, applyLocal, pushRemote } = mergePrefs(pc, tab);
  const fusi = dalViaggio(merged.raccolte_fav);
  t.eq("il voto del PC resta", votoMio(fusi.voti, "saga:berserk"), 4.5);
  t.eq("arriva quello del tablet", votoMio(fusi.voti, "saga:akira"), 4);
  t.eq("e il cuore resta un cuore", fusi.preferite.map((x) => x.id).join(), "saga:akira");
  t.c("il PC scrive il voto arrivato", applyLocal);
  t.c("e manda su il suo", pushRemote);
  const tolto = { raccolte_fav: inViaggio([], segnaVoto(segnaVoto([], "saga:berserk", 4.5, { ora: 100 }), "saga:berserk", 0, { ora: 300 })) };
  const dopo = dalViaggio(mergePrefs(tolto, pc).merged.raccolte_fav);
  t.eq("un voto tolto dopo non risorge", votoMio(dopo.voti, "saga:berserk"), 0);
  t.eq("fondere due volte non cambia niente", JSON.stringify(fondiVoti(voti, voti)), JSON.stringify(voti));
}
