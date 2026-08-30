# Informativa sulla privacy — Book Companion

Ultimo aggiornamento: 30 agosto 2026

Book Companion è un lettore di ebook **local-first**: i tuoi libri, i tuoi
segni di lettura e le tue annotazioni stanno sul tuo dispositivo, e ci
restano. Non esiste un nostro server che li riceva, non c'è un account
obbligatorio, non c'è telemetria e non c'è pubblicità.

Questo documento dice, in concreto, **quali dati esistono, dove stanno, e
in quali momenti precisi qualcosa esce dal dispositivo**. La regola che
attraversa tutto è una sola: *niente esce se non lo accendi tu*.

---

## 1. Quello che resta sul dispositivo, sempre

Appena installata e senza toccare nient'altro, l'app conserva **solo in
locale**, dentro il browser:

- i **file dei libri** che carichi (EPUB e PDF) e le loro copertine, in
  IndexedDB;
- i **metadati** che li descrivono: titolo, autore, saga, ciclo, genere,
  voto, note tue, stato di lettura, date di inizio e fine;
- i **segni di lettura**: punto in cui sei arrivato, segnalibri,
  evidenziazioni, citazioni, voci di glossario che hai scritto tu;
- le **preferenze** del reader e del tema;
- le **melodie** che carichi come file, e le raccolte musicali.

Questi dati non vengono inviati da nessuna parte, non li legge nessuno, e
si cancellano cancellando i dati del sito dal browser o disinstallando la
PWA. Il tasto **«Esporta biblioteca»** ne fa un archivio `.zip` che resta
tuo: dove lo salvi lo decidi tu, l'app non lo vede più.

## 2. Quello che esce solo se lo accendi tu

Tre funzioni, tutte facoltative, tutte spente finché non le attivi.

### 2.1 La sincronizzazione fra dispositivi (Supabase)

Se crei un account e accendi la sincronizzazione, salgono su un database
[Supabase](https://supabase.com) — in una riga che è **solo tua**, protetta
da Row Level Security — questi dati:

- **i file dei libri e le loro copertine**, in un bucket privato;
- i metadati della biblioteca e i segni di lettura elencati al punto 1;
- le preferenze, le raccolte musicali, il glossario che hai scritto;
- **le melodie che hai caricato come file**;
- il tuo **indirizzo e-mail** e la password (gestiti da Supabase Auth: la
  password è conservata da loro sotto forma di hash, l'app non la vede mai
  e non la salva).

Puoi non accenderla mai: l'app funziona identica senza. Se la spegni e
cancelli l'account, quei dati vanno via con lui.

### 2.2 L'Oracolo (Anthropic)

Le funzioni «Chi è costui?», «Dove eravamo rimasti» e «Prima di
cominciare» chiedono a un modello di Anthropic. **Funzionano solo se
incolli una chiave API tua**: la chiave resta sul dispositivo, non passa
da nessun nostro server, e la spesa la vedi in fondo alla scheda.

Quando fai una di queste domande, escono dal dispositivo verso
`api.anthropic.com`:

- **i passaggi del libro** che servono a rispondere — paragrafi interi,
  scelti fra quelli che hai già letto;
- il nome del personaggio, quando è una scheda-personaggio.

**Non escono i titoli dei libri né i nomi delle saghe**: i volumi vengono
numerati («Volume 2»), e i titoli veri li rimette lo schermo. È una scelta
tecnica contro gli spoiler, ma vale anche qui.

L'uso dei dati da parte di Anthropic è regolato dal contratto fra te e
loro, non da noi: vedi la [privacy policy di
Anthropic](https://www.anthropic.com/legal/privacy).

### 2.3 La musica da YouTube

Se aggiungi un brano tramite un link YouTube, la riproduzione avviene in
un iframe `youtube-nocookie.com`. È la modalità «privacy avanzata» di
YouTube: non registra la visualizzazione nella cronologia e non piazza
cookie di profilazione **prima** che tu prema play. Da quel momento in poi
vale la [privacy policy di Google](https://policies.google.com/privacy).
Le melodie caricate come file non contattano nessuno.

## 3. Quello che esce quando usi una funzione, senza account

Alcune funzioni interrogano servizi pubblici. Nessuna manda un
identificatore tuo: vanno solo la parola o il titolo, e l'indirizzo IP che
qualunque richiesta web porta con sé.

| Quando | Dove va | Cosa esce |
| --- | --- | --- |
| Cerchi una parola nel dizionario | `en.wiktionary.org` | la parola |
| ...e serve la traduzione della parola | `api.mymemory.translated.net` | la parola |
| Tocchi «cerca su Google» nella scheda del dizionario | `www.google.com` | la parola (apri tu il link) |
| Un termine ha la voce sul wiki del Mondo Disco | `discworld.fandom.com` | il termine (apri tu il link) |
| Un libro non ha la quarta di copertina nel file | `www.googleapis.com/books`, `openlibrary.org` | titolo e autore di quel libro |
| Sempre, per i caratteri della pagina | `fonts.googleapis.com`, `fonts.gstatic.com` | niente, oltre alla richiesta stessa |

Due avvertenze oneste:

- **MyMemory è una memoria di traduzione condivisa.** Le richieste
  anonime possono finire nel loro archivio pubblico. Esce una parola
  singola alla volta, mai una frase del libro, ma vale la pena saperlo.
- **La ricerca del retro di copertina fa uscire titolo e autore** di quel
  libro verso un catalogo bibliografico. È l'unico punto in cui un titolo
  esce dal dispositivo, ed è dichiarato nell'app sotto il testo trovato
  («Dal catalogo in rete»).

## 4. Quello che non c'è

Per essere espliciti su ciò che spesso si dà per scontato:

- **nessuna analitica**, nessun SDK di tracciamento, nessun crash
  reporter: quando qualcosa si rompe, l'errore finisce nella console del
  tuo browser e basta;
- **nessuna pubblicità** e nessun profilo pubblicitario;
- **nessun cookie nostro**: l'app usa `localStorage` e IndexedDB, che
  restano sul dispositivo e non viaggiano in nessuna richiesta;
- **nessuna vendita o cessione di dati** a terzi;
- **nessun accesso** ai tuoi libri da parte nostra, neanche con la
  sincronizzazione accesa: le regole del database non permettono a nessun
  altro utente di leggere la tua riga.

## 5. Minori

L'app non è rivolta ai minori di 13 anni e non raccoglie
consapevolmente i loro dati. Non chiede l'età perché, senza account, non
raccoglie nulla.

## 6. I tuoi diritti sui dati

- **Vederli**: sono sul tuo dispositivo; «Esporta biblioteca» te ne dà una
  copia completa in un `.zip`.
- **Correggerli**: ogni campo della scheda di un libro è modificabile.
- **Cancellarli**: cancella il singolo libro, oppure i dati del sito dal
  browser, oppure — con la sincronizzazione accesa — l'account, che porta
  via anche quello che sta nel cloud.
- **Portarli altrove**: l'archivio `.zip` contiene i file originali dei
  tuoi libri, non un formato nostro.

Per esercitarli non serve chiedere il permesso a nessuno: sono tutti tasti
dentro l'app.

## 7. Modifiche e contatti

Se questa informativa cambia, la data in cima cambia con lei, e la storia
delle modifiche resta pubblica nel repository.

Per domande: [github.com/Baldborne94/book-companion](https://github.com/Baldborne94/book-companion)
