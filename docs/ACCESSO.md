# Entra con Google: i passi da fare una volta

Con «Entra con Google» si entra nella biblioteca (Supabase) col proprio account Google, senza password. Google Drive non c'entra più: l'app non chiede a Google nessun permesso sui tuoi file. Servono due posti, Google Cloud e Supabase, e si fa una volta.

## 1. Supabase: dove tornare dopo Google

**Authentication → URL Configuration**:
- **Site URL**: l'indirizzo dell'app, per esempio `https://book-companion-….vercel.app`.
- **Redirect URLs**: aggiungi lo stesso indirizzo con `/**` in fondo.

Poi apri **Authentication → Sign In / Providers → Google**. Lascia la pagina aperta: in alto c'è la **Callback URL**, del tipo `https://<progetto>.supabase.co/auth/v1/callback`. Copiala, serve al passo 2.

## 2. Google Cloud: il client

Su console.cloud.google.com, nel progetto dell'app:

1. **API e servizi → Credenziali** → l'ID client OAuth di tipo «Applicazione web».
   - In **URI di reindirizzamento autorizzati** aggiungi la Callback URL del passo 1.
   - In **Origini JavaScript autorizzate** l'indirizzo dell'app.
2. Copia il **Client secret**: va solo su Supabase (passo 3), mai nell'app.

## 3. Supabase: accendere Google

**Authentication → Sign In / Providers → Google**: **Enable**, incolla **Client ID** e **Client Secret**, **Save**.

## 4. Nell'app

Apri la nuvola in alto a destra e tocca **Entra con Google**. Con la stessa email di prima ritrovi la stessa biblioteca: Supabase unisce da solo l'accesso con Google a quello con email e password.

## Se qualcosa non va

- **«L'accesso con Google non è ancora acceso su Supabase»**: manca il passo 3.
- **Google dice «redirect_uri_mismatch»**: la Callback URL del passo 1 non è fra gli URI del passo 2, oppure è scritta diversa (anche una `/` in più conta).

## Quel che restava dei tempi di Google Drive

- L'app toglie da sola, a ogni dispositivo, le chiavi di Drive e l'elenco dei file, e dal Supabase la riga col permesso a lungo termine di Google (tabella `google_refresh`). Rieseguendo `supabase/schema.sql` la tabella se ne va.
- Su Vercel le variabili `GOOGLE_CLIENT_SECRET`, `VITE_GOOGLE_CLIENT_ID` e `VITE_GOOGLE_API_KEY` non servono più e si possono cancellare.
- Su myaccount.google.com → **Sicurezza → App e servizi di terze parti** si può togliere all'app l'accesso a Google Drive dato allora.
- Su Google Cloud le API **Google Drive** e **Google Picker** e la **chiave API** non servono più: si possono disattivare e cancellare.
