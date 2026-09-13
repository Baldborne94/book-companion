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
`npm` o `bubblewrap` risultano «non riconosciuti».

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
  `assetlinks.json`; se lo cambi, cambialo anche lì.
- **Display mode**: `standalone`. **Orientation**: `default`.
- **Status bar color / splash**: lascia quelli del manifest (`#0f0d1a`).
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
