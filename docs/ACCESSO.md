# Entra con Google: i passi da fare una volta

Con «Entra con Google» si entra una volta sola, per la biblioteca (Supabase) e per Google Drive insieme. La chiave di Drive poi si rinnova da sola, senza finestre. Per farlo servono tre posti: Google Cloud, Supabase e Vercel. Si fa una volta, e dopo non si tocca più.

Tieni aperte due cose:
- il tuo progetto su **Supabase**;
- il progetto su **Google Cloud** dove hai creato l'ID client di Drive, quello che finisce in `.apps.googleusercontent.com`.

## 1. Supabase: la tabella del permesso

**SQL Editor** → nuova query → incolla il blocco `google_refresh` in fondo a `supabase/schema.sql` → **Run**.

Puoi anche rieseguire lo schema intero: è fatto per poterlo rieseguire.

La tabella tiene una riga sola: il permesso a lungo termine che Google consegna all'ingresso. Le regole la lasciano leggere solo a te.

## 2. Supabase: dove tornare dopo Google

**Authentication → URL Configuration**:
- **Site URL**: l'indirizzo dell'app, per esempio `https://book-companion-….vercel.app`.
- **Redirect URLs**: aggiungi lo stesso indirizzo con `/**` in fondo.

Poi apri **Authentication → Sign In / Providers → Google**. Lascia la pagina aperta: in alto c'è la **Callback URL**, del tipo `https://<progetto>.supabase.co/auth/v1/callback`. Copiala, serve al passo 3.

## 3. Google Cloud: il client e la pubblicazione

Vai su console.cloud.google.com, nello stesso progetto di prima.

1. **API e servizi → Credenziali** → apri l'ID client OAuth dell'app, quello di tipo «Applicazione web».
   - In **URI di reindirizzamento autorizzati** aggiungi la Callback URL copiata al passo 2.
   - Lascia com'è l'**Origine JavaScript** con l'indirizzo dell'app.
   - Salva.
2. Nella stessa pagina copia il **Client secret**. Se non c'è, «Aggiungi secret». È l'unica cosa segreta di tutta la faccenda: non va incollata nell'app, solo su Supabase (passo 4) e su Vercel (passo 5).
3. **Google Auth Platform → Pubblico** (o «Schermata consenso OAuth»): in **Stato di pubblicazione** premi **Pubblica app**, così passa **In produzione**.

   È il passo che fa durare il permesso. Un'app lasciata «In prova» perde il permesso ogni **7 giorni**, e Google tornerebbe a chiedere.

   In cambio, la prima volta che entri Google mostra «Google non ha verificato questa app». Per un'app tua è normale: **Avanzate → Vai a … (non sicuro)**. Lo vedi una volta sola.

## 4. Supabase: accendere Google

Torna su **Authentication → Sign In / Providers → Google** (la pagina del passo 2):
- **Enable**;
- incolla **Client ID** (quello `.apps.googleusercontent.com`) e **Client Secret**;
- **Save**.

## 5. Vercel: le variabili

Apri il progetto su Vercel → **Settings → Environment Variables**. Aggiungi queste variabili, per **Production** e **Preview**:

| Nome | Valore |
|---|---|
| `GOOGLE_CLIENT_SECRET` | il Client secret del passo 3. Solo qui: la funzione `api/google-token` lo usa per rinnovare la chiave |
| `VITE_GOOGLE_CLIENT_ID` | l'ID client `.apps.googleusercontent.com`. Così dal pannello spariscono i campi da incollare |
| `VITE_GOOGLE_API_KEY` | la chiave API che comincia con `AIza`, per «Scegli su Drive» |

`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` ci sono già. Poi **Deployments → Redeploy** dell'ultima versione.

## 6. Nell'app

Apri la nuvola in alto a destra e tocca **Entra con Google**. Scegli il tuo account, accetta il permesso per Drive, e torni nell'app già dentro.

Con la stessa email di prima ritrovi la stessa biblioteca: Supabase unisce da solo l'accesso con Google a quello con email e password.

Da dentro, il pannello deve dire: «🗂 Google Drive collegato: la chiave si rinnova da sola».

## Se qualcosa non va

- **«L'accesso con Google non è ancora acceso su Supabase»**: manca il passo 4.
- **Google dice «redirect_uri_mismatch»**: la Callback URL del passo 2 non è fra gli URI del passo 3, oppure è scritta diversa (anche una `/` in più conta).
- **«Google Drive collegato, ma solo per un'ora: … manca la tabella google_refresh»**: manca il passo 1.
- **Dopo una settimana Google chiede di nuovo**: l'app è rimasta «In prova» (passo 3, punto 3). Pubblicala e rientra con Google.
- **Il pannello dice «Google ha ritirato il permesso»**: l'hai tolto da myaccount.google.com, oppure è scaduto. Tocca «Entra con Google» e torna come prima.

Email e password restano, sotto «Entra con email e password». Con quelle Drive si collega a parte, come prima, e la chiave dura un'ora.
