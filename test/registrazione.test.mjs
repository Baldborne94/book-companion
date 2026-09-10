// «REGISTRATI» SU UN'EMAIL CHE ESISTE GIA'.
//
// Segnalato dal lettore: «avevo già fatto accesso, perché mi chiede di
// nuovo di registrarmi e inoltre non funziona la password che ho scelto».
// Era entrato col link — un account senza password — e ha premuto
// «Registrati» con la password che voleva. Supabase su un'email già
// presente NON risponde con un errore: risponde con un utente finto, senza
// sessione, e la password non viene salvata. Noi leggevamo «nessuna
// sessione» e dicevamo «controlla la posta».
//
// È la specie di difetto che sbaglia in silenzio per costruzione: il
// server lo fa apposta per non raccontare chi è registrato, quindi l'unico
// posto dove distinguere è qui, e l'unico segno è `identities: []`.
import { esitoRegistrazione, GIA_REGISTRATA } from "../src/lib/accesso.js";

export default async function (t) {
  // ---- i tre esiti, nella forma in cui supabase-js li manda davvero ------
  t.eq(
    "con la sessione si è dentro",
    esitoRegistrazione({ user: { id: "u", identities: [{ id: "i" }] }, session: { access_token: "x" } }),
    "dentro"
  );
  t.eq(
    "senza sessione ma con un'identità vera si aspetta la conferma",
    esitoRegistrazione({ user: { id: "u", identities: [{ id: "i", provider: "email" }] }, session: null }),
    "conferma"
  );
  // L'UTENTE FINTO: nessuna sessione e un elenco di identità VUOTO — non
  // mancante, vuoto. È l'unico segno che Supabase lascia.
  t.eq(
    "senza sessione e con identità VUOTE l'email esiste già",
    esitoRegistrazione({ user: { id: "u", identities: [] }, session: null }),
    "esiste"
  );

  // ---- le trappole ai bordi ---------------------------------------------
  // `identities` che MANCA non è «vuoto»: una versione della libreria che
  // non lo manda non deve far dire «esiste già» a ogni registrazione nuova
  t.eq(
    "identità assenti non sono identità vuote",
    esitoRegistrazione({ user: { id: "u" }, session: null }),
    "conferma"
  );
  t.eq("nessun utente e nessuna sessione: si aspetta", esitoRegistrazione({ user: null, session: null }), "conferma");
  t.eq("il niente non esplode", esitoRegistrazione(undefined), "conferma");
  // e la sessione comanda anche sopra un'identità vuota: se il server ci ha
  // fatti entrare, siamo dentro
  t.eq(
    "la sessione vince su tutto",
    esitoRegistrazione({ user: { identities: [] }, session: { access_token: "x" } }),
    "dentro"
  );

  // ---- e la frase dice le DUE cose che il lettore deve sapere ------------
  // che la password appena scritta non è stata salvata (o la riproverà
  // all'infinito), e che la strada è il link seguito da «Cambia la password»
  t.c("la frase dice che la password non è stata salvata", /non è stata salvata/i.test(GIA_REGISTRATA), GIA_REGISTRATA);
  t.c("e indica la strada del link", /link/i.test(GIA_REGISTRATA) && /cambia la password/i.test(GIA_REGISTRATA), GIA_REGISTRATA);
}
