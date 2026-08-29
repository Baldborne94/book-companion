// COSA SI DICE A CHI NON RIESCE A ENTRARE.
//
// La trappola vera e' una sola e la copre il terzo blocco: un buco di rete
// arriva qui come un `TypeError` senza codice e senza stato, e se lo si
// tratta come una credenziale rifiutata si manda il lettore a riscrivere
// all'infinito una password che era giusta.
import { spiegaAccesso, passwordCorta, MIN_PASSWORD } from "../src/lib/accesso.js";

// come li manda supabase-js: un oggetto con `code`, `status` e `message`
const errore = (code, message = "", status = 400) => ({ code, message, status });

export default async function (t) {
  // ---- i codici che arrivano davvero ------------------------------------
  {
    const m = spiegaAccesso(errore("invalid_credentials", "Invalid login credentials"));
    t.c("la credenziale rifiutata si dice in italiano", /password/i.test(m) && !/invalid/i.test(m), m);
    // Supabase risponde uguale per password sbagliata e indirizzo mai
    // registrato, ed e' voluto: dire «quest'email non esiste» racconterebbe
    // a chiunque provi chi e' registrato. Qui non si inventa la differenza.
    t.c("e non promette di sapere se l'indirizzo esiste", !/non esiste|mai registrat/i.test(m), m);
  }
  {
    const m = spiegaAccesso(errore("email_not_confirmed"));
    t.c("la conferma mancante dice cosa fare", /messaggio|conferma/i.test(m), m);
  }
  {
    const m = spiegaAccesso(errore("user_already_exists"));
    t.c("l'email gia' registrata manda a entrare", /già registrata/i.test(m), m);
  }
  {
    const m = spiegaAccesso(errore("weak_password"));
    t.c("la password debole dice quanto dev'essere lunga", m.includes(String(MIN_PASSWORD)), m);
  }
  {
    const m = spiegaAccesso(errore("over_request_rate_limit"));
    t.c("il troppo-in-fretta dice di aspettare", /aspetta|minuto/i.test(m), m);
  }

  // ---- la rete che manca NON e' una password sbagliata ------------------
  {
    // e' esattamente com'e' fatto un fetch caduto: nessun codice, nessuno
    // stato utile, solo il messaggio del browser
    const m = spiegaAccesso(new TypeError("Failed to fetch"));
    t.c("un buco di rete si riconosce", /rete|raggiungere/i.test(m), m);
    t.c("e non viene scambiato per una password sbagliata", !/password/i.test(m), m);
  }
  {
    const m = spiegaAccesso(new TypeError("NetworkError when attempting to fetch resource."));
    t.c("anche detto alla maniera di Firefox", /rete|raggiungere/i.test(m), m);
  }

  // ---- il ripiego sul testo, per le versioni senza codice ---------------
  {
    const m = spiegaAccesso({ status: 400, message: "Invalid login credentials" });
    t.c("senza codice, il testo basta a riconoscere la credenziale", /password/i.test(m), m);
  }
  {
    const m = spiegaAccesso({ status: 500, message: "Database is unavailable" });
    t.c("quello che non sappiamo tradurre si mostra com'e'", m.includes("Database is unavailable"), m);
    t.c("ma non si spaccia per una diagnosi", /Non ha funzionato/i.test(m), m);
  }
  {
    const m = spiegaAccesso({});
    t.c("un errore muto non lascia il pannello vuoto", !!m && m.length > 5, m);
  }
  t.eq("niente errore, niente da dire", spiegaAccesso(null), null);

  // ---- il controllo che si fa senza chiedere niente al server -----------
  t.c("una password corta si ferma qui", passwordCorta("abc") === true);
  t.c("al pelo della soglia passa", passwordCorta("a".repeat(MIN_PASSWORD)) === false);
  t.c("un carattere sotto no", passwordCorta("a".repeat(MIN_PASSWORD - 1)) === true);
  t.c("e il campo vuoto e' corto, non un errore", passwordCorta("") === true);
  t.c("nemmeno se la password non c'e' proprio", passwordCorta(undefined) === true);
}
