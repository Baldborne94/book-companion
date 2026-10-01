# Book Companion

App local-first per la biblioteca personale: EPUB, PDF, CBZ/CBR caricati dall'utente, reader curato, musica di sottofondo. Tema «Biblioteca Magica» (notte, candele, pergamena). UI in italiano.

**Il lettore usa Chrome Android su un tablet 1280×800 a densità 1**, con l'app installata come APK (guscio TWA, cioè Chrome) — non Firefox, come per molto tempo si è creduto. Le prove in Chromium valgono quindi per il suo dispositivo.

Questo file tiene le **regole vive**, in breve. Il **perché** di ogni regola — il difetto segnalato, come si è riprodotto, le mutazioni provate — sta in **`docs/STORIA.md`**: cerca lì il nome della funzione o del file. Piano e stato delle fasi in `docs/PIANO.md`, guscio Android in `docs/TWA.md`, privacy in `PRIVACY.md`.

## Come si lavora

- `npm test` **e** `npm run build` verdi prima di ogni commit. La CI (`.github/workflows/prova.yml`) li rifà.
- **Ogni test nuovo si prova con le mutazioni**: si rompe apposta la cosa che difende e si guarda che caschi. Un test che passa sul codice rotto non vale niente. Una guardia che nessuna mutazione fa cascare si toglie (codice che non guarda niente è codice che il prossimo crede vivo).
- **Si riproduce prima di curare**, nel browser vero sull'app intera (`npm run dev` o `vite preview`, Playwright col Chromium in `PLAYWRIGHT_BROWSERS_PATH`). Una scena costruita apposta non è una diagnosi del caso del lettore: non si raccontano come suoi i libri di un banco.
- Si misura: tempi, byte, fotogrammi. «Dovrebbe essere più veloce» non è un risultato.
- Branch `claude/*` → PR in bozza → squash/merge su `main`. Dopo il merge si aspetta la build di produzione di Vercel, poi si riallinea il branch (spingere subito lo stesso commit ha lasciato la produzione indietro, una volta).
- Ogni cambiamento che introduce una regola nuova aggiunge **un paragrafo in `docs/STORIA.md`** (il racconto) e, se è una regola che il prossimo deve rispettare, **una riga qui**.
- Per fermare un server di prova: `fuser -k PORTA/tcp`, mai `pkill -f` (uccide anche la shell che lo lancia).
- `npm i --no-save <pacchetto>` pota ciò che non sta in `package.json` (ha fatto sparire Playwright una volta).
- Niente commenti nel codice salvo il PERCHÉ non ovvio. Nessuna libreria UI. Stato con `useState`/`useEffect`.

## I test

- `test/run.mjs` è un corridore di trenta righe: un file per argomento, `export default async (t) => {}`, aiuti in `test/aiuto.mjs`.
- Gira su Node puro. `test/tema.test.mjs` vuole un browser vero: senza Playwright si dichiara **saltato**, e saltare non è passare.
- Un test che dipende da chi gira prima non difende niente (stub lasciati su `globalThis` da un altro file).
- La logica sta in `src/lib/` (niente JSX) proprio perché Node non importa un `.jsx`: una decisione dentro un componente è fuori dalla portata di ogni test.
- `npm run e2e` (`e2e/run.mjs`): l'app costruita su un Supabase finto, in Chromium — saga fra due dispositivi, ePub che si apre, Ingresso. La CI la rifà. Un difetto trovato col banco a mano diventa una scena qui. Ogni scena ha un tetto (`TETTO_SCENA`), e si chiudono prima i browser, poi i server finti.
- Guardiani che non si toccano: `identificatori.test.mjs` (un nome che non esiste più: la build resta verde e l'app muore solo in quel ramo), `scala.test.mjs` e `misura-ui.test.mjs` (la scala dei corpi), `palette.test.mjs`, `tasti-barra.test.mjs`, `manifest.test.mjs`, `giro-sync.test.mjs` (convergenza della sincronizzazione), `lapidi.test.mjs` (`EMPTY_ROW` copre ogni colonna di `rowFromLocal`), `pdf-chiudi.test.mjs`.

## Architettura

- React 18 + Vite 5, niente router: la sezione attiva è uno `useState` in `App.jsx`. Le stanze usate di rado (cammino, da prendere, quaderno, mappa, diario, giardino, musica, nuvola) sono lazy e si precaricano a riposo (`precaricaStanze`).
- Stili **100% inline**. `src/index.css` tiene solo reset, font, keyframes, `.textLayer` di pdf.js, pseudo-classi (`:active`, `:focus-visible`) e pseudo-elementi delle View Transitions.
- `src/lib/`: moduli senza JSX. `src/components/`: sezioni e pannelli. `src/data/`: tavole (saghe, generi, mappa delle funzioni, costanti).
- `epubjs`, `pdfjs-dist`, `jszip` si importano solo lazy.
- Un solo pezzo di server: `api/google-token.js` (funzione di Vercel), logica in `src/lib/rinnovoGoogle.js` con la rete iniettata. Nient'altro gira fuori dal browser.
- PWA con `vite-plugin-pwa` in modalità **prompt**: mai reload automatico a libro aperto. Guscio Android: `docs/TWA.md`, `public/.well-known/assetlinks.json`, «Apri con» via `launchQueue` (`lib/lancio.js`).
- L'APK lo costruisce e pubblica la CI (`apk.yml`, `scripts/apk.mjs`): `twa-manifest.json` generato dal manifest del sito, versionCode = numero di commit, chiave solo nei segreti (`TWA_KEYSTORE*`), e si pubblica solo se la firma è quella di `assetlinks.json`.

### Storage

- Byte dei libri, copertine, miniature, tracce audio e dati calcolati in **IndexedDB** (`bookStore.js`: store `files`, `covers`, `aux`, `tracks`). Metadati, progressi e preferenze in **localStorage** con prefisso `bc_`.
- Progresso **sempre frazione 0–1**. Punto di lettura in `bc_cfi_<id>` (CFI nell'ePub, pagina nel PDF e nei fumetti).
- In `aux`: `loc_<id>` (pagine di epub.js, legate alla misura del file), `salute_<id>` (verdetto sulla spezzatura), `testo_<id>` (testo estratto per ricerca e Oracolo), `min_<id>` (miniatura della copertina), `collana_<id>`/`catalogo_<id>` (memorie del riconoscimento saghe), `drive_elenco`. **Chi cambia i byte di un libro butta ciò che era calcolato su di essi** (ricucitura, ritorno a casa di un file).
- La persistenza si chiede all'avvio e si **guarda** in Libreria; l'avviso solo su `negata`, mai su `sconosciuta`.
- Una scrittura IndexedDB è fatta quando la **transazione** si chiude (`attendi`), non su `onsuccess`.

### La scala

- Corpi `F` e raggi `R` in `constants.js`, un valore solo per gradino, nessun numero a mano nei componenti. La scala si moltiplica con `SCALE_UI` (automatica su tablet a densità 1): si moltiplica sempre la BASE. `px(n)` per altezze e glifi che seguono la scrittura; una `maxWidth` che tiene del testo passa per `px`. I margini della pagina del reader (`HEAD`/`FOOT`) non si scalano mai.
- Palette e scala si leggono **quando si disegna**, mai a caricamento del modulo.
- Bersagli attaccati da 44px. Ogni pannello sta dentro lo schermo (`maxHeight` + scorrimento).

### Il reader ePub (`components/Reader.jsx`)

- **Niente meccanica nuova senza il consenso del lettore**, una alla volta e misurata. Il reader è stato spogliato fino a epub.js e ricostruito un pezzo per volta: prima di aggiungere, leggi la sua sezione in `docs/STORIA.md`.
- Tipografia sugli **elementi** del capitolo, inchiostro su `body *`, interlinea su `body` con `!important` e sulla prosa senza. I paragrafi vuoti si spengono sugli elementi (`spegniVuoti`), mai con `:has()`. Paragrafi: tre modi (`curaParagrafi`: rientrati / staccati / come nel libro).
- `forceEvenPages` spento in `started`. I 20px sopra e sotto di epub.js si battono con `PAGINA_SU_GIU`. In scorrimento il gestore è `continuous` con `overflow-anchor: none`.
- Avanzo di riga: mai mentre epub.js monta, una volta per libro (ricordato per geometria), misurato sull'altezza senza ritaglio, candela accesa finché non ha finito. **Ogni attesa ha un tetto** (candela, voltata, misura delle pagine): un'attesa senza tetto è un difetto in attesa.
- Voltata: tre modi, partenza **dissolvenza**. Dentro `startViewTransition` si chiama `manager.next()` diretto (con `r.next()` la coda di epub.js non gira mai). I veli del caldo e della luminosità vivono dentro l'elemento fotografato.
- Il tocco ha tre canali (`pointerup`, `touchend`, `click`) con un solo guardiano (`ditoRef`); un tocco breve fa sempre qualcosa. C'è la linguetta come comando che non dipende da euristiche.
- Il segno non si perde per un'apertura andata storta: `cfiLeggibile` prima di consegnarlo a epub.js, il flush non scrive finché il lettore non si sposta apposta, ripiego sull'ultimo segnalibro, e il ripiego si dice.
- Ricucitura dei libri spezzati (`unisciEpub`, `ricuci.js`): all'import, e alla prima apertura se il libro non ha segni. Un libro letto da Drive si ricuce **in memoria** a ogni apertura (deterministico: i CFI restano validi).
- Leggi ad alta voce (`lib/voce.js`): la pagina a schermo, **a frasi**, girata con la voltata di sempre; la frase che scavalca il bordo aspetta la pagina dopo. Solo a pagine. La musica si abbassa con un fattore suo (`sottovoce`), mai col volume salvato.
- Leggi ad alta voce nei PDF (`lib/vocePdf.js`): stesse regole, testo da pdf.js ricucito in paragrafi sul passo della pagina, **lingua dal testo** (quella dichiarata dal PDF mente), voltate della voce ricordate (`girate`), tre pagine mute fermano la voce.
- Note a piè di pagina lette sul posto (`lib/nota.js`), mappe ingrandibili (`lib/tavola.js`), glossario con annotazioni di epub.js (mai `<span>` nel testo: cambierebbero i CFI).

### PDF e fumetti

- PDF: livello testo di pdf.js, evidenziazioni in **frazioni di pagina** (i rettangoli che arrivano non si toccano), ritaglio dei margini misurato una volta per libro. Si chiude sempre da `chiudiPdf`.
- Fumetti CBZ/CBR: formato dai **byte**, ordine naturale delle pagine, ComicInfo letto a mano. Si leggono **a fette** (`zipAFette`, `rarAFette` per i RAR memorizzati): mai l'intero volume in memoria. Manga = verso da destra; il tipo si sceglie nella scheda.
- Un CBR compresso oltre `CBR_MAX` **si converte in CBZ**, mai si rifiuta: all'import dal tablet, da «Aggiungi da Drive» e dal lettore (`rarInCbz` in un worker, archivio letto a finestre con letture sincrone, zip scritto pagina per pagina). Stessi nomi di pagina, quindi stesso ordine e stesso segno. Su Drive il CBZ **prende il posto** del CBR (`sostituisciSuDrive`: prima sale il CBZ col segno, poi il CBR nel cestino col segno tolto).
- Anche i CBR che si aprono si convertono, a richiesta: «🔁 Converti in CBZ» nella scheda e in Manutenzione tutti in fila (`convertiCbr.js`: uno alla volta, un intoppo è di quel libro, chiave scaduta ferma il giro senza aprire Google). Dopo la conversione, la copertina che mancava si prende dal CBZ.
- **Un lavoro lungo vive in App, non in una sezione** (il giro dei CBR: `convertiICbr`; l'importazione da Drive: `importaDaDriveQui`, che alla fine si aggiunge alla biblioteca di **adesso**, `loadBooks()`): uno solo alla volta, visibile da ogni sezione (`BarraLavoro`), schermo acceso (come in tutta l'app), e i libri chiesti si ricordano (`bc_lavoro_cbr`) per riprendere ad app riaperta. Cosa fare di un libro si decide sul **formato vero dei byte** qui e su Drive (`pianoConversione`), mai sulla scheda.
- I CBR si convertono anche **su Colab** (`strumenti/cbr-in-cbz.ipynb`, codice in `strumenti/cbr_in_cbz.py`, uguali per `colab.test.mjs`): il CBZ nasce accanto al CBR, stesso nome. Scegliendo da Drive, di una coppia CBR e CBZ con lo stesso nome nella stessa cartella entra solo il CBZ, e il CBZ di un CBR già in biblioteca non entra (`daAggiungere`). Dopo ogni giro l'app **adotta** il gemello esatto (`cbzDaAdottare`: stessa cartella, stesso nome, nessun segno di un altro libro; `adottaCbzConvertiti`): segno sul CBZ, CBR nel cestino, scheda CBZ, copertina. Ogni libro cambia appena è adottato, e un'adozione a metà si finisce dallo **stato** (`cbzGiaAdottati`: file su Drive `.cbz` col segno del libro, scheda ancora CBR).
- I doppioni si riconoscono dal **titolo** (`doppioniInBiblioteca`: il CBR e il suo CBZ hanno byte diversi, e l'impronta non li vede); per i libri anche lo **stesso autore** scritto e lo stesso formato. Si uniscono dalla Manutenzione, prima l'elenco e poi il tasto. Si tiene la scheda **col file**, poi quella letta, poi quella coi segnalibri, poi il CBZ, poi quella con la copertina; i file su Drive restano.
- Un file reimportato (dal tablet o da Drive) **torna nella scheda che l'aveva perso** (`ritornaACasa`; da Drive `senzaFile`/`segnato` in `importaDaDrive`), mai una scheda nuova accanto a lei. «Già sullo scaffale» dice quale file e con quale scheda (`giaSulloScaffale`, `fraseGia`). Un CBR col suo gemello CBZ su Drive non si riconverte mai (`gemelloCbzDi`): si adotta, o si dice doppione.
- Lo stesso file da Drive **scende una volta** anche se lo chiedono in due (`unaPerChiave` in `inVolo.js`: il lettore e il giro dei libri in lettura).
- Un CBR su Drive si guarda **dalla prima pagina** (`primaPaginaRar`, una o due richieste): la copertina all'import e in «Ritrova copertine», e un CBR compresso oltre `CBR_MAX` si ferma **prima** di scendere (`fermaCbrCompresso`) e il lettore offre «Converti in CBZ». Un file che scende intero dice a che punto è (`fraseDiscesa`, una volta per MB).
- Da Drive ogni lettura è un viaggio in rete: una voce dello zip si legge in **una** richiesta (`leggiVoce`: testata e dati insieme), la misura dei bordi chiede le sue pagine in parallelo e ha un tetto (`MISURA_MAX`), la prima pagina si chiede subito. Dopo la pagina a schermo si preparano le pagine avanti (`pagineAvanti`: 10 da Drive, 3 a consumo, 2 dal tablet), tre in volo alla volta (`IN_VOLO`): una alla volta ogni richiesta aspetta la sua latenza con la banda ferma.
- Doppia pagina dei fumetti (`coppie` in `fumetto.js`): copertina sola, poi 2-3, 4-5; una tavola larga sta da sola e le coppie ripartono dopo di lei. Si calcolano da capo, così la coppia di una pagina è la stessa da ogni strada. Doppia o singola si sceglie **per orientamento**; senza scelta, doppia a schermo sdraiato. Solo a pagina intera. Fra le due pagine c'è la piega (`PIEGA`), e una pagina che non si apre non spegne l'altra: si riprova una volta, poi si mostra quella che c'è e si dice quale manca.
- Le pagine di un fumetto già aperte restano in memoria fino a `MEMORIA_PAGINE` (`daLasciare`: via la più lontana): da Drive tornare indietro non è un viaggio in rete.
- La voltata dei fumetti **sfuma** (`sfumaDa`, `SFUMA_MS`): il foglio di prima resta finché il nuovo è pronto, poi le sue pagine — **gli stessi elementi `<img>`**, con la loro chiave — svaniscono sopra il nuovo quando è decodificato. Mai copie `<img>` (si ridecodificano: fotogrammi neri), mai foto su canvas (`drawImage` ridecodifica sul filo principale). Non nel nastro, spegnibile, rispetta «meno animazioni».
- Il foglio dopo **e quello prima** aspettano sotto quello a schermo, all'1% (`daDecodificare`: `avanti`/`indietro`, ognuno solo intero), e pagine a schermo, uscenti e dopo stanno in **una lista sola con la chiave della pagina** (`fogliInScena`): alla voltata è lo stesso elemento, già decodificato. Un `<img>` nuovo con lo stesso indirizzo si rilegge e si ridecodifica da capo, e due `map` sono due liste.
- Il nastro dei fumetti («Scorri», `altezzeNastro`): pagine una sotto l'altra larghe quanto lo schermo (al massimo 1280), la pagina segue lo scorrimento, immagini montate solo attorno a quella che guardi. Una pagina non ancora aperta vale la proporzione mediana delle viste, e quando arriva la sua misura vera lo scorrimento si corregge (l'ancora) perché la pagina a schermo non salti. Nel nastro si va avanti **col dito**: un tocco non scorre (solo barre), e `pointercancel` — il browser che si prende lo scorrimento — non è mai un tocco (`annulla`).

### Dizionario e Oracolo

- Dizionario: disco (WordNet + MultiWordNet, scaricabile) che risponde per primo, poi Wiktionary. **Le definizioni non si traducono a macchina**; MyMemory solo per la parola, solo da memorie che traducono esattamente quella. Una risposta nata da un buco di rete non va in cache.
- Oracolo (API Anthropic con chiave del lettore in `bc_ai_key`, mai su un nostro server): **al modello non si mandano i titoli** (riconoscerebbe il libro e risponderebbe a memoria, spoiler compresi) — eccezioni dichiarate: la spiegazione di un passaggio e i consigli di lettura. Ogni domanda passa da `chiedi()`, che segna la spesa e applica il tetto del mese **prima** del `fetch`.
- «Chi è costui?» e «Dove eravamo rimasti» vedono solo la **frontiera** (`frontiera.js`): volumi dopo il corrente mai, anche se letti. Si decide sul numero di lettura; senza numero un volume resta fuori.

### Saghe

- Strade in ordine: tavola (`TAVOLE`: Mondo Disco, Eresia di Horus, Seconda Apocalisse), collana nel file (`collana.js`), titolo (`sagaDalTitolo.js`, forme nella tavola del test), catalogo Open Library (`sagaDalCatalogo.js`, due voti), e **per ultima** la deduzione dai fratelli (`sagaDaBiblioteca`, vetata da `tracce: 0`). La saga vuota è uno stato legittimo; una saga tolta a mano resta tolta (`sagaTolta`).
- Quel che il lettore ha scritto a mano non si tocca. Si **propone** riga per riga (titoli, numeri del cammino, parti), mai si riscrive in silenzio. Un giro automatico rimette i suoi tocchi solo sui libri rimasti com'erano quando li ha guardati (`tocchiAncoraBuoni`): una risposta del catalogo che arriva dopo la mano non la copre.
- Il prossimo volume è `nextInSaga`/`passoDentro` (in `saga.js`): il filo è la **serie**, si apre dopo un volume finito, i contorni di una guida non sono passi, e chi tace dice perché (`perchePassoTace`). «Da leggere» conta lo **stato** (un volume aperto e rimesso lì a mano torna seguito, «già al 12%»), e in una saga cominciata si propone anche l'inizio del primo ciclo non cominciato (`iniziDeiCicli`, uno per saga). Una regola sul «prossimo volume» va nella funzione che risponde a quella domanda, non in un chiamante.
- Eresia di Horus: percorso CD8D, il numero di lettura si chiede alla tavola (`postiDelCammino`), prologo e letture di sfondo non sono tappe.

### Sincronizzazione

- Supabase (opzionale, `VITE_SUPABASE_*`) per schede, progressi, annotazioni, preferenze e copertine. **I file dei libri e delle melodie stanno su Google Drive** (`drive.js` rete, `driveCore.js` decisioni), non nel secchio.
- Decisioni pure in `syncCore.js`/`driveCore.js`, rete iniettata: si provano in Node. **Si decide sullo STATO**, mai su un registro o su un passaggio che capita una volta sola; un intoppo su un elemento è di quell'elemento (nessun `throw` nei cicli per-elemento).
- Last-write-wins per riga (`bc_upd_<id>`), ma **la scheda ha un orologio suo** (`bc_sch_<id>`, colonna `scheda_at`, `fondiSchede`): i campi di `CAMPI_SCHEDA` vanno a chi ha cambiato la scheda per ultimo, la lettura a chi ha letto per ultimo. Chi scrive la scheda chiama `timbraScheda`, e solo se un campo che viaggia è cambiato (`schedaDiversa`): la quarta di copertina non timbra. **Una saga vuota non cancella mai una saga** (`riempiSaga`), qualunque orologio vinca: vuota è una scelta solo se è stata tolta a mano (`saga_tolta`), e quella vince come ogni scheda più nuova. Segnalibri ed evidenziazioni sono **insiemi** fusi per id con lapidi. Il timbro lo mette chi salva, non chi riceve. Anche un giro automatico che cambia una scheda la timbra (`schedeCambiate`), e ogni `updateBooks` fa partire la sincronizzazione da sola poco dopo (`lib/presto.js`): la finestra del PC resta visibile per ore.
- Il giro si racconta libro per libro (`raccontaGiro`): riga di prima contro riga di dopo, e un campo che manca da una parte non si racconta.
- Copertine: scende quella che qui manca **o pesa diversamente** da quella lassù (`copertineDaScaricare` con le misure); una cambiata qui e non ancora partita (`bc_cov_attesa`) sale e non si copre.
- **Dal cloud si legge a pagine** (`aPagine`, ordinate per id): Supabase dà al più mille righe per richiesta, e una lettura sola taglia la biblioteca senza errori. Il Supabase finto delle prove ha lo stesso tetto (`MAX_RIGHE`) e senza `order` un ordine a caso.
- Le schede ricevute si **mostrano subito** (`onLibri`), le copertine scendono dopo, a gruppi (`aGruppi`, `COPERTINE_INSIEME`), dicendo a che punto sono (`fraseCopertine`): mai una richiesta per volta dentro il ciclo delle schede.
- Scala di rinuncia `DEGRADE` per gli schemi non migrati; gli errori di Postgres si traducono (`spiegaSync`) e il grezzo si ripiega.
- La musica si prende da Drive come i libri: «☁ Da Google Drive» nella Musica apre il selettore sulla cartella «Musica» di «book-companion», file e cartelle intere (`sceltaMusicaDalPicker`, `audioSotto`, `melodieDaAggiungere`); i brani non scendono, diventano melodie `drive: true` segnate `bcTrack` (`adottaMelodie`) e scendono quando le suoni. I nomi dei brani e delle raccolte musicali non si troncano.
- Ogni melodia **riprende da dove si era fermata** (`segnaPunto`/`puntoDi` in `music.js`, `bc_melodia_punti`, del dispositivo): il punto si scrive mentre suona (ogni 5 s: l'app uccisa in secondo piano non avvisa) e a ogni fermata, mai nei primi né negli ultimi 5 s; arrivata in fondo si dimentica. Una raccolta ricorda il suo brano (`segnaDove`/`doveDi`) e si suona da un brano scelto (`playQueue` con `da`); in casuale non ricorda.
- L'archivio si fa da solo (`archiviaSuDrive`): una volta al giorno, dopo il giro di Drive e solo con la chiave in mano, lo zip dell'«Esporta» **senza byte** va in «book-companion/Archivi»; se ne tengono dieci, i vecchi nel cestino. Si ripristina dalla strada di sempre.
- **Entra con Google** (`accessoGoogle.js`, passi in `docs/ACCESSO.md`): un ingresso solo per Supabase e Drive, col permesso a lungo termine nel Supabase del lettore (`google_refresh`, RLS). La chiave di Drive si rinnova dal **solo pezzo di server** dell'app, `api/google-token` su Vercel (`rinnovoGoogle.js`), che legge la riga con la sessione di chi chiede e tiene il segreto del client solo nelle variabili di Vercel. `collegaDrive` e `chiama` provano prima il rinnovo in silenzio (`rinnovaInSilenzio`, una richiesta anche se chiedono in tanti), e l'app tiene la chiave fresca. «nessuno»/«revocato» fermano i tentativi fino al prossimo ingresso con Google. Uscendo si smette **qui**, la riga resta (è dell'account). La chiave che arriva all'ingresso si prende una volta (`bc_google_vista`).
- Drive: si riconosce prima di mandare (`abbina`: segno, impronta, misura, nome; nel dubbio non si abbina). Un segno `bcId` di una scheda che qui non c'è ferma un file solo finché la biblioteca può ancora arrivare dal cloud (`schedeInArrivo`): dopo un giro è orfano, e il file si aggiunge. La chiave dura un'ora e si rinnova solo da un tocco. I libri si leggono **da Drive** senza scriverli sul tablet (`prendiFile`); restano sul tablet solo quel che il lettore chiede («Tieni sul tablet»), i libri «in lettura» (`daTenereInLettura`, cinque al massimo) e il seguito della saga al 70%, con la scelta di rete di `bc_anticipo`.

### Ingresso e Libreria

- Ingresso su una colonna: libro in mano, riga di oggi, «Stai leggendo anche» e «Il seguito delle tue saghe» in due file (`inCorsoESeguiti`: un libro in lettura non è un seguito), appena arrivati (`appenaArrivati`: 14 giorni, niente libri chiusi, niente doppioni sopra), stanze 2×2. I preferiti NON stanno sull'Ingresso (tolti dal lettore: ridondanti): stanno in Libreria. Una sezione che si chiama come un filtro contiene ciò che contiene il filtro.
- Libreria a «Scaffale» o a «Raccolte» (`inRaccolte`, `copertinaDi`): ogni ripiano una cartella con la copertina del volume da cui ripartire e il **nome intero** (mai troncato), i volumi soli sciolti sotto; con una ricerca in corso niente cartelle. La scelta si ricorda in `bc_vista` (`aspetto`); la raccolta aperta sta in App, perché è un livello del tasto indietro. Le raccolte col cuore (`lib/raccoltePreferite.js`, solo saghe e autori, chiave = quella del ripiano) viaggiano in `prefs.raccolte_fav`, voce per voce con lapidi; si vedono nel filtro «♥ Preferiti» e salgono in cima **solo con l'ordine «Preferiti prima»** (`nellOrdineScelto`): un ordine si sceglie, non lo impone lo scaffale.
- Scaffale a ripiani (`disponi` in `ripiani.js`): saga o autore, cicli e capitoli come sotto-ripiani, ripiani lontani non costruiti (`useVicino`), miniature e non copertine intere.
- «Ripulisci i titoli» propone, mai riscrive. Nei fumetti toglie anche le etichette **in coda** (`senzaEtichette`: anno, digital, gruppo, sito) e «v03 -»; il numero esce dal titolo solo se la scheda ce l'ha, e mai due fumetti diventano omonimi (sarebbero doppioni).
- Un tasto non promette ciò che non può dare; gli zeri non si dicono; un avviso sta accanto al tasto che lo risolve.

### Schermo

- Lo schermo non si spegne finché l'app è davanti (Wake Lock in `App.jsx`). La presa si dimentica al suo `release` (il sistema la toglie in secondo piano) e si richiede al ritorno e a ogni tocco, una richiesta alla volta.

### Guasti

- Le voltate dei fumetti si misurano (`lib/voltate.js`, `bc_voltate`, 200): byte e disegno separati, stato delle pagine (pronte / in arrivo / chieste), Drive o tablet; il riassunto in coda al rapporto dei guasti. Solo numeri, mai titoli.
- Anche avvio, Libreria aperta dal menu, apertura di ePub e PDF si misurano (`lib/tempi.js`, `bc_tempi`, 120): tappe dal tocco (`parti` → `partenza`) alla pagina disegnata, provenienza e peso, in coda al rapporto. Solo numeri. Si cura una lentezza solo dopo che il rapporto del lettore l'ha mostrata.
- I guasti si annotano in `bc_errori` (`lib/registro.js`: disegno, pagina, promesse, sincronizzazione) e il rapporto lo copia il lettore dalle Impostazioni. Niente telemetria; chi aggiunge un segreto che può finire in un messaggio aggiunge la sua regola in `pulisci`.

## Lezioni vincolanti (non re-impararle)

1. Tipografia del reader sugli elementi, inchiostro su `body *`, mai l'interlinea su `body *`.
2. I paragrafi senza testo si spengono leggendo il testo, non in CSS.
3. Doppia pagina: unica fonte di verità l'evento `layout` di epub.js.
4. Progresso sempre 0–1.
5. `MusicPlayer` mai smontato.
6. `navigator.onLine` mente: sempre ripiego su cache/IndexedDB.
7. Service worker `prompt`, mai reload durante la lettura.
8. CFI: flush sincrono alla chiusura; il segno non si perde per un'apertura andata storta.
9. Default del dispositivo **sotto** le preferenze salvate.
10. Animazioni solo `opacity`/`transform`.
11. Persistere i **byte**, mai gli object URL.
