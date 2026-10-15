# L'accesso alla biblioteca: email e password

Si entra nella biblioteca (Supabase) con email e password. «Entra con Google» è stato tolto dall'app (chiesto dal lettore: «voglio cancellare l'accesso a google per la mia applicazione»).

## Chi entrava con Google

L'account resta lo stesso, con la stessa email. Se non ha ancora una password:

1. Nel pannello della nuvola scrivi l'email e tocca **«Password dimenticata? Mandami il link per email»**.
2. Apri il link nella mail: entri nella biblioteca, e il pannello si apre su **«Scegli la nuova password»**.
3. Scrivila e tocca **Salva**. Da lì si entra con email e password.

Il link torna all'app con `?nuova-password` nell'indirizzo: su Supabase, in **Authentication → URL Configuration → Redirect URLs**, deve esserci l'indirizzo dell'app con `/**` in fondo, o Supabase riporta al solo indirizzo e la password non si chiede (si entra lo stesso, e la si sceglie da «Altro → Cambia la password»).

## Spegnere Google fuori dall'app (una volta, a mano)

- **Supabase → Authentication → Sign In / Providers → Google**: togli **Enable** e salva. Senza, una vecchia pagina o un link diretto potrebbero ancora far entrare con Google.
- **Google Cloud → API e servizi → Credenziali**: l'ID client OAuth dell'app non serve più e si può cancellare (col suo Client secret).
- **myaccount.google.com → Sicurezza → App e servizi di terze parti**: si toglie all'app ogni accesso dato a suo tempo (anche quello a Google Drive).
- **Vercel**: le variabili `GOOGLE_CLIENT_SECRET`, `VITE_GOOGLE_CLIENT_ID` e `VITE_GOOGLE_API_KEY`, se ci sono ancora, non servono più.

## Quel che restava dei tempi di Google Drive

L'app toglie da sola, a ogni dispositivo, le chiavi di Drive e l'elenco dei file, e dal Supabase la riga col permesso a lungo termine di Google (tabella `google_refresh`). Rieseguendo `supabase/schema.sql` la tabella se ne va. Su Google Cloud le API **Google Drive** e **Google Picker** e la **chiave API** non servono più.
