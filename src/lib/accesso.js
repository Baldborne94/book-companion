// COSA E' ANDATO STORTO ENTRANDO, detto in italiano.
//
// Sta qui e non dentro il pannello per la ragione di sempre: senza JSX un
// test lo puo' chiamare. E c'e' bisogno di un test, perche' un accesso che
// fallisce dicendo «Invalid login credentials» — o peggio, «non ha
// funzionato» — lascia il lettore senza niente da fare: non sa se ha
// sbagliato la password, se l'indirizzo non e' mai stato registrato, o se
// e' solo caduta la rete.
//
// I codici sono quelli che Supabase manda davvero (`error.code`); il
// `status` e il testo restano come ripiego per le versioni che il codice
// non lo mandano ancora.
export const MIN_PASSWORD = 6;

// Password e password sbagliata sono la STESSA risposta, ed e' voluto da
// Supabase: dire «quest'indirizzo non esiste» racconterebbe a chiunque
// provi chi e' registrato e chi no. Quindi qui non si inventa una
// distinzione che il server non fa.
const VOCI = {
  invalid_credentials: "Email o password non corrispondono.",
  email_not_confirmed:
    "L'indirizzo non è ancora confermato: apri il messaggio che ti ho mandato, poi torna qui.",
  user_already_exists: "Quest'email è già registrata: entra con la sua password.",
  email_exists: "Quest'email è già registrata: entra con la sua password.",
  weak_password: `Password troppo corta: almeno ${MIN_PASSWORD} caratteri.`,
  same_password: "È la password che hai già.",
  over_request_rate_limit: "Troppi tentativi ravvicinati: aspetta un minuto e riprova.",
  over_email_send_rate_limit:
    "Ho già mandato parecchie mail a quest'indirizzo: aspetta qualche minuto.",
  validation_failed: "Controlla l'indirizzo email.",
  signup_disabled: "Su questo progetto le registrazioni sono chiuse.",
};

export function spiegaAccesso(err) {
  if (!err) return null;
  const codice = err.code || "";
  if (VOCI[codice]) return VOCI[codice];
  const testo = String(err.message || "");
  // LA RETE CHE MANCA NON E' UNA PASSWORD SBAGLIATA. `fetch` che cade
  // arriva qui come un TypeError con un messaggio del browser, senza ne'
  // codice ne' stato: trattarlo come una credenziale rifiutata manderebbe
  // il lettore a riscrivere una password giusta all'infinito.
  if (err.status === 0 || /fetch|network|failed to fetch|load failed/i.test(testo)) {
    return "Non riesco a raggiungere il cloud: controlla la rete e riprova.";
  }
  if (err.status === 400 && /credential/i.test(testo)) return VOCI.invalid_credentials;
  // Quello che non sappiamo tradurre si mostra com'e': una frase in
  // inglese e' brutta, ma nasconderla lascerebbe senza appigli chi deve
  // capire cosa e' successo davvero.
  return testo ? `Non ha funzionato: ${testo}` : "Non ha funzionato, riprova.";
}

// Il controllo che si puo' fare senza chiedere niente a nessuno: dirlo
// prima del viaggio e' piu' gentile che farlo dire al server.
export function passwordCorta(pw) {
  return (pw || "").length < MIN_PASSWORD;
}
