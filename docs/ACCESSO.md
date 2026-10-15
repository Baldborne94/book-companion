# L'accesso alla biblioteca: email e password

Si entra nella biblioteca (Supabase) con email e password. «Entra con Google» è stato tolto dall'app (chiesto dal lettore: «voglio cancellare l'accesso a google per la mia applicazione»).

## Chi entrava con Google

L'account resta lo stesso, con la stessa email. Se non ha ancora una password:

1. Nel pannello della nuvola scrivi l'email e tocca **«Password dimenticata?»**.
2. Arriva l'email di **reimpostazione della password**. Il pannello resta aperto e chiede il **codice** che c'è dentro: scrivilo e tocca **Conferma**. Si resta nell'app (l'APK sul tablet, la finestra sul computer): un link nella posta aprirebbe sempre il browser.
3. Il pannello passa a **«Scegli la nuova password»**. Scrivila due volte e tocca **Salva**. Da lì si entra con email e password.

Il codice vale una volta sola, ed è buono solo quello dell'ultima email chiesta.

### Il modello dell'email (una volta, a mano)

Il modello di partenza di Supabase manda solo il link. Perché porti il codice: **Supabase → Authentication → Emails → Templates → Reset Password** (in certe versioni **Reset password** sotto *Email Templates*), e al posto del testo:

- **Subject**: `Il codice per la nuova password`
- **Body** (lascia anche il link: serve a chi apre la mail sul computer, e alle altre app dello stesso progetto, se ce ne sono):

```html
<h2>La nuova password</h2>
<p>Scrivi questo codice nell'app, nel pannello della nuvola:</p>
<p style="font-size:28px;letter-spacing:4px"><strong>{{ .Token }}</strong></p>
<p>Vale una volta sola. Se non l'hai chiesto tu, ignora questa email.</p>
<p style="color:#888">Oppure, dal browser: <a href="{{ .ConfirmationURL }}">scegli la password nuova</a>.</p>
```

Il link riporta alla radice dell'app (l'indirizzo che Supabase accetta già come Site URL): niente da aggiungere fra i Redirect URLs. L'app, tornata dal link, chiede la password nello stesso riquadro; un link scaduto o già usato riporta con l'errore nell'indirizzo, e l'app lo dice nel pannello, dove se ne chiede un altro.

## Spegnere Google fuori dall'app (una volta, a mano)

- **Supabase → Authentication → Sign In / Providers → Google**: togli **Enable** e salva. Senza, una vecchia pagina o un link diretto potrebbero ancora far entrare con Google.
- **Google Cloud → API e servizi → Credenziali**: l'ID client OAuth dell'app non serve più e si può cancellare (col suo Client secret).
- **myaccount.google.com → Sicurezza → App e servizi di terze parti**: si toglie all'app ogni accesso dato a suo tempo (anche quello a Google Drive).
- **Vercel**: le variabili `GOOGLE_CLIENT_SECRET`, `VITE_GOOGLE_CLIENT_ID` e `VITE_GOOGLE_API_KEY`, se ci sono ancora, non servono più.

## Quel che restava dei tempi di Google Drive

L'app toglie da sola, a ogni dispositivo, le chiavi di Drive e l'elenco dei file, e dal Supabase la riga col permesso a lungo termine di Google (tabella `google_refresh`). Rieseguendo `supabase/schema.sql` la tabella se ne va. Su Google Cloud le API **Google Drive** e **Google Picker** e la **chiave API** non servono più.
