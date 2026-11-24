// LA MAPPA DELLE FUNZIONI: nessuna voce muta, nessun luogo che non esiste.
//
// Chiesto dal lettore («c'è modo di rendere più user friendly
// l'applicazione?») dopo sei segnalazioni che dicevano tutte la stessa
// cosa: l'app non dice quello che sa fare, e le funzioni si scoprono per
// caso o chiedendole a qualcun altro.
//
// QUI NON CASCA NIENTE DA SÉ. Una voce senza il «dove» non alza nessun
// errore: si legge, dice che una funzione esiste, e lascia il lettore
// esattamente dov'era — cioè il difetto da cui questa pagina nasce. È la
// stessa regola di `GUAI` e di `ESITI_CONTROLLO`: un esito muto non passa.
//
// E IL PERICOLO VERO È L'INVECCHIAMENTO: una mappa che nomina una funzione
// tolta è PEGGIO di nessuna mappa, perché il lettore le crede e va a
// cercare un tasto che non c'è. Una parte si difende qui — le voci che
// nominano una levetta del reader portano la sua `chiave`, e quella deve
// esistere davvero in `deviceDefaults` — il resto no, ed è dichiarato in
// fondo.
import { MAPPA, LUOGHI, vociDi } from "../src/data/mappa.js";
import { SECTIONS } from "../src/data/constants.js";
import { deviceDefaults } from "../src/lib/readerSettings.js";

export default async function (t) {
  // ---- NESSUNA VOCE MUTA -------------------------------------------------
  {
    for (const v of MAPPA) {
      const chi = v.nome || "(senza nome)";
      t.c(`«${chi}» ha un nome`, typeof v.nome === "string" && v.nome.trim().length > 2, JSON.stringify(v.nome));
      // COSA FA: senza, la voce è un titolo che non spiega niente
      t.c(`«${chi}» dice cosa fa`, typeof v.cosa === "string" && v.cosa.trim().length > 10, v.cosa);
      // DOVE SI TOCCA: è la metà che serve. Sapere che una funzione esiste
      // senza sapere da dove si apre lascia dove si era — ed è esattamente
      // il difetto che questa pagina viene a curare.
      t.c(`«${chi}» dice dove si tocca`, typeof v.dove === "string" && v.dove.trim().length > 5, v.dove);
      t.c(`«${chi}» non scrive «undefined»`, !/undefined|null|\[object/.test(`${v.cosa} ${v.dove}`));
    }
    t.c("la mappa non è vuota", MAPPA.length > 20, String(MAPPA.length));
  }

  // ---- OGNI VOCE STA IN UN LUOGO CHE ESISTE ------------------------------
  {
    const ids = new Set(LUOGHI.map((l) => l.id));
    for (const v of MAPPA)
      t.c(`«${v.nome}» sta in un luogo vero`, ids.has(v.luogo), `luogo: ${v.luogo}`);
    // e nessun luogo resta vuoto: un'intestazione senza niente sotto è
    // due righe di schermo per non dire niente, come un ripiano da un
    // libro solo
    for (const l of LUOGHI)
      t.c(`il luogo «${l.nome}» ha delle voci`, vociDi(l.id).length > 0, `${vociDi(l.id).length} voci`);
  }
  {
    // i luoghi che dichiarano una sezione devono nominarne una VERA, o la
    // mappa manderebbe in una stanza che non c'è
    for (const l of LUOGHI.filter((x) => x.sezione))
      t.c(
        `la sezione di «${l.nome}» esiste`,
        SECTIONS.some((s) => s.id === l.sezione),
        l.sezione
      );
    for (const l of LUOGHI) t.c(`il luogo «${l.id}» ha un nome`, !!l.nome && l.nome.length > 2);
  }

  // ---- LA GUARDIA CONTRO L'INVECCHIAMENTO --------------------------------
  {
    // Le voci che nominano una levetta del reader portano la sua chiave, e
    // quella deve esistere in `deviceDefaults`: se un giorno una levetta
    // viene tolta, la mappa continuerebbe a prometterla e il lettore
    // andrebbe a cercare un tasto che non c'è. È l'unico pezzo
    // dell'invecchiamento che un test in Node possa vedere.
    const chiavi = new Set(Object.keys(deviceDefaults(800)));
    const conChiave = MAPPA.filter((v) => v.chiave);
    t.c("qualche voce nomina una levetta vera", conChiave.length >= 5, String(conChiave.length));
    for (const v of conChiave)
      t.c(`la levetta «${v.chiave}» di «${v.nome}» esiste ancora`, chiavi.has(v.chiave), v.chiave);
  }

  // ---- NIENTE DOPPIONI ---------------------------------------------------
  {
    // la stessa funzione scritta due volte in due posti diversi si
    // aggiorna in uno solo, e da lì in poi la mappa dice due cose
    const nomi = MAPPA.map((v) => v.nome.toLowerCase());
    const doppi = nomi.filter((n, i) => nomi.indexOf(n) !== i);
    t.c("nessuna voce scritta due volte", doppi.length === 0, doppi.join(", "));
  }

  // ---- L'ORDINE È UNA SCELTA ---------------------------------------------
  {
    // le voci di un luogo escono nell'ordine in cui sono scritte, non in
    // alfabetico: prima quel che si usa sempre. Se un giorno qualcuno ci
    // mette un `sort`, questo casca.
    const primo = MAPPA.find((v) => v.luogo === "libro");
    t.eq("il primo luogo è il libro", LUOGHI[0].id, "libro");
    t.eq("e la prima voce è quella scritta per prima", vociDi("libro")[0].nome, primo.nome);
  }

  // DICHIARATO, non dimenticato: questo test NON sa se un tasto è ancora
  // sullo schermo. Difende le voci mute, i luoghi inventati, i doppioni e
  // le levette tolte; una funzione cancellata dalla UI senza una `chiave`
  // continuerebbe a essere promessa qui. **Chi toglie una funzione la
  // toglie anche da `data/mappa.js`** — non c'è modo di provarlo da Node,
  // e per questo sta scritto in tutt'e due i file.
}
