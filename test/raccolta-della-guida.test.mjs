// LA RACCOLTA DEL LETTORE PER UNA GUIDA (`raccoltaDellaGuida` in
// `lib/sagaBooks.js`, usata da `ripassa` e dall'import, `completaSaga`): un
// libro nuovo che una guida riconosce va nella raccolta dove il lettore tiene
// i libri di quella guida o del suo universo («raccoglie tutte le saghe»),
// non in una raccolta col nome della guida accanto.
import { raccoltaDellaGuida, ripassa } from "../src/lib/sagaBooks.js";
import { completaSaga } from "../src/lib/importBook.js";

export default async (t) => {
  const scaffale = [
    { id: "1", title: "Xenos", author: "Dan Abnett", saga: "Warhammer 40K", series: "Eisenhorn" },
    { id: "2", title: "Horus Rising", author: "Dan Abnett", saga: "Warhammer 40K", series: "The Horus Heresy" },
    { id: "3", title: "Ship of Magic", author: "Robin Hobb", saga: "Liveship Traders" },
    { id: "4", title: "Unico", author: "Qualcuno", saga: "Altro" },
  ];
  t.eq("un'altra guida dello stesso universo porta la raccolta (Gaunt's Ghosts va nel 40K)", raccoltaDellaGuida("Gaunt's Ghosts", scaffale), "Warhammer 40K");
  t.eq("una raccolta col nome di un ciclo non e' la casa del mondo intero", raccoltaDellaGuida("The Realm of the Elderlings", scaffale), null);
  t.eq("senza libri di quella guida, nessuna raccolta", raccoltaDellaGuida("Discworld", scaffale), null);
  t.eq("una guida che non c'e'", raccoltaDellaGuida("Nessuna", scaffale), null);
  const piu = [...scaffale, { title: "Legion", author: "Dan Abnett", saga: "40K vecchi" }, { title: "First and Only", author: "Dan Abnett", saga: "40K vecchi" }, { title: "Ghostmaker", author: "Dan Abnett", saga: "40K vecchi" }];
  t.eq("fra due raccolte, la piu' piena", raccoltaDellaGuida("Gaunt's Ghosts", piu), "40K vecchi");

  // il giro automatico sui libri sciolti
  const r = ripassa({ title: "Ghostmaker", author: "Dan Abnett" }, scaffale);
  t.eq("ripassato: nel 40K del lettore, la serie e il numero della guida", `${r?.campi.saga} | ${r?.campi.series} | ${r?.campi.sagaOrder}`, "Warhammer 40K | Gaunt's Ghosts | 2");
  t.eq("…e senza il 40K sullo scaffale, il nome della guida come prima", ripassa({ title: "Ghostmaker", author: "Dan Abnett" }, [])?.campi.saga, "Gaunt's Ghosts");

  // l'import
  const meta = { title: "Malleus", author: "Dan Abnett" };
  t.c("all'import si riconosce", completaSaga(meta, null, "Malleus.epub", scaffale));
  t.eq("…e va nel 40K del lettore", `${meta.saga} | ${meta.series} | ${meta.sagaOrder}`, "Warhammer 40K | Eisenhorn | 2");
  const solo = { title: "Malleus", author: "Dan Abnett" };
  completaSaga(solo, null, "Malleus.epub", []);
  t.eq("…e senza, nella raccolta della guida", solo.saga, "Eisenhorn");
};
