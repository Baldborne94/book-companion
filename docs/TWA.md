# Il guscio Android (Trusted Web Activity)

L'app resta la PWA che gira su `book-companion-ruddy.vercel.app`: il guscio
è un APK di poche centinaia di kilobyte che apre quel sito a schermo intero
dentro Chrome, senza barra degli indirizzi, e lo fa comparire come app fra
le app — nel launcher, nel menu «Apri con» degli EPUB e dei PDF, nel foglio
di condivisione. **Niente viene riscritto**: ogni aggiornamento del sito
arriva al guscio dal service worker, come oggi, e lo store si rifà solo
quando cambia il guscio stesso (icona, nome, permessi).

Quello che il repository fornisce già:

| Cosa | Dove | A che serve |
| --- | --- | --- |
| `id`, `scope`, `launch_handler` | `public/manifest.json` | identità stabile dell'app e seconda apertura sulla stessa finestra |
| `file_handlers` | `public/manifest.json` + `launchQueue` in `App.jsx` | «Apri con» per `.epub` e `.pdf` |
| `shortcuts` | `public/manifest.json` + `sezioneDaUrl` | tenere premuta l'icona → Libreria / Musica |
| icona monocroma | `public/icons/icon-mono-512.png` | temi di Android 13 |
| `assetlinks.json` | `public/.well-known/` | dice ad Android che sito e APK sono la stessa cosa |
| pagina della privacy | `public/privacy.html`, generata da `PRIVACY.md` a ogni build | lo store la vuole a un URL pubblico |
| versione | `package.json` → timbro in fondo alla Libreria | quale rilascio del sito gira |

## Costruire l'APK

Serve **Node** (LTS, da <https://nodejs.org> o `winget install
OpenJS.NodeJS.LTS`); il JDK 17 e l'SDK Android li scarica Bubblewrap da sé
alla prima chiamata. Si lavora in una cartella tua (`cd ~`), in una
PowerShell **normale**, non da amministratore — quella si apre in
`C:\WINDOWS\system32` e non è un posto dove tenere un progetto. Dopo aver
installato Node, e di nuovo dopo `npm i -g`, apri una finestra nuova: il
percorso dei comandi si legge solo all'apertura, e finché non lo fai
`npm` o `bubblewrap` risultano «non riconosciuti». E se `npm -v` risponde
«L'esecuzione di script è disabilitata nel sistema in uso», è la politica
di esecuzione di PowerShell (`npm` è uno script `.ps1`): si sblocca una
volta sola con `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`,
oppure si chiama la versione `.cmd` (`npm.cmd`, `bubblewrap.cmd`), che
non passa da PowerShell.

```sh
npm i -g @bubblewrap/cli
mkdir book-companion-twa && cd book-companion-twa
bubblewrap init --manifest https://book-companion-ruddy.vercel.app/manifest.json
```

Su **Windows PowerShell** (5.1, quella di sistema) il `&&` non esiste: i
comandi vanno uno per riga.

```powershell
npm i -g @bubblewrap/cli
mkdir book-companion-twa
cd book-companion-twa
bubblewrap init --manifest https://book-companion-ruddy.vercel.app/manifest.json
```

Alle domande di `init`:

- **Application ID**: `it.bookcompanion.app` — è quello scritto in
  `assetlinks.json`; se lo cambi, cambialo anche lì. Il valore proposto
  è il dominio di Vercel rovesciato: NON accettarlo.
- **Short name**: `Companion` (massimo 12 caratteri: «Book Companion» ne
  ha 14 e Bubblewrap propone «BkC»). È l'etichetta sotto l'icona.
- Una risposta sbagliata si corregge dopo, senza rifare `init`: in
  `twa-manifest.json`, poi `bubblewrap update` e `bubblewrap build`. I campi
  non si chiamano come le domande: il nome corto è **`launcherName`**,
  l'icona `iconUrl` (che dev'essere il PNG), l'ID `packageId`. Vale la pena
  mettere anche `"enableNotifications": false`: l'app non manda notifiche,
  e acceso l'APK dichiara un permesso che non usa.
- **Display mode**: `standalone`. **Orientation**: `default`.
- **Status bar color / splash**: lascia quelli del manifest (`#0f0d1a`).
- **Icon URL**: dev'essere il PNG (`/icons/icon-512.png`), non `icon.svg`:
  Bubblewrap rasterizza con una libreria che l'SVG non lo legge, e il
  `build` si ferma su «could not load icon». Il manifest tiene i PNG per
  primi apposta, e `init` propone il primo.
- **Signing key**: lascialo creare un keystore nuovo e **conserva il file e
  le due password**: perdere il keystore vuol dire non poter più aggiornare
  l'app sullo store, mai. Non va nel repository.
- **Start URL**: `/`.

Poi:

```sh
bubblewrap build
```

produce `app-release-signed.apk` (per provarlo sul tablet: `adb install`) e
`app-release-bundle.aab` (per lo store).

Le due password le chiede PRIMA di guardare se il keystore esiste: se non
esiste, con quelle lo crea. Vanno scelte lì e segnate fuori dal PC: non
stanno scritte in nessun file, e non si recuperano. Nel certificato
(nome, organizzazione) va `Baldborne94`, non il nome vero: chiunque abbia
l'APK lo può leggere.

Se il `build` cade su «Failed to load signer» e «android.keystore
(Impossibile trovare il file specificato)», il keystore non è mai stato
creato: `build` firma soltanto, la creazione sta nel giro di `init`. Si
fa a mano dalla cartella del progetto, col `keytool` del JDK scaricato da
Bubblewrap:

```powershell
& "$env:USERPROFILE\.bubblewrap\jdk\jdk-17.0.11+9\bin\keytool.exe" -genkeypair -v -keystore android.keystore -alias android -keyalg RSA -keysize 2048 -validity 10000
```

**E se il `build` fallisce nella firma, la password finisce IN CHIARO a
schermo**: l'errore riporta l'intera riga di comando di `apksigner`,
`--ks-pass pass:"…"` compreso. Una password vista in un terminale (o in
uno screenshot) è da considerare bruciata: si rifà il keystore con
un'altra, finché non ha firmato niente che sia uscito di casa.

Se il `build` cade su «Could not reserve enough space for … object heap»,
Gradle vuole 1,5 GB per il suo processo e Windows non glieli dà: in
`gradle.properties` del progetto abbassa `org.gradle.jvmargs=-Xmx1536m`
a `-Xmx1024m` (o `768m`) e rilancia. **La modifica va fatta DOPO
`bubblewrap update`**: l'update rigenera il progetto Android, e con lui
`gradle.properties`, quindi una modifica fatta prima sparisce e l'errore
torna identico.

## Collegare il guscio al sito

Finché Android non trova il collegamento, l'app parte con la barra di Chrome
in cima: non è un errore del guscio, è che manca la firma.

1. L'impronta del certificato:

   ```sh
   keytool -list -v -keystore android.keystore -alias android | grep SHA256
   ```

   Su PowerShell `grep` non c'è: `… | Select-String SHA256`. Se `keytool`
   non si trova, sta nel JDK che Bubblewrap ha scaricato
   (`~\.bubblewrap\jdk\…\bin\keytool.exe`), oppure usa
   `bubblewrap fingerprint list`, che lo cerca da sé. Se pubblichi sul Play Store con
   la firma gestita da Google, l'impronta giusta è quella in Play Console →
   *Integrità dell'app* → *Certificato della chiave di firma dell'app*, e
   di norma vanno messe **tutt'e due**, la tua e quella di Google.
2. Scrivila in `public/.well-known/assetlinks.json` al posto del segnaposto
   (forma `AA:BB:…`, 32 coppie). Il test `test/manifest.test.mjs` accetta
   il segnaposto o un'impronta nella forma giusta, niente in mezzo.
3. Merge e deploy. Verifica da un terminale:

   ```sh
   curl https://book-companion-ruddy.vercel.app/.well-known/assetlinks.json
   ```

   Su PowerShell `curl` è un alias di `Invoke-WebRequest` e chiede
   conferma con un avviso sugli script: rispondi `S`, oppure scrivi
   `curl.exe`, che è il curl vero. Deve tornare il JSON, non l'HTML
   dell'app (il service worker lo esclude apposta dal ripiego,
   `navigateFallbackDenylist`).
4. Reinstalla l'APK: al primo avvio dopo il deploy la barra sparisce.

## Aggiornare

- **Il sito**: come sempre, merge su `main`. Il guscio non c'entra.
- **Il guscio** (nuova icona, nuovo nome, `file_handlers` cambiati): alza
  `version` in `package.json`, poi `bubblewrap update && bubblewrap build`
  e carica il nuovo `.aab`. Bubblewrap aggiorna `versionCode` da sé.

## Quel che il guscio NON cambia

- **La musica a schermo spento**: YouTube si mette in pausa da solo in
  secondo piano e dentro la TWA è lo stesso; i file audio reggono già da
  PWA. Servirebbe un servizio in primo piano, cioè Capacitor e codice
  nativo — fuori da questo giro, e non per YouTube.
- **Lo storage**: è il profilo di Chrome, lo stesso della PWA installata.
  Se sul tablet c'è già la PWA con la biblioteca dentro, il guscio la vede.
- **La condivisione di file** verso l'app (`share_target` con POST) non
  è dichiarata: vorrebbe un service worker scritto a mano al posto di
  quello generato. «Apri con» copre lo stesso gesto per gli EPUB e i PDF.
