# Informativa sulla privacy — Book Companion

Ultimo aggiornamento: 10 novembre 2026

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
si cancellano cancellando i dati del sito dal browser o disinstallando
l'app. Il tasto **«Esporta biblioteca»** ne fa un archivio `.zip` che resta
tuo: dove lo salvi lo decidi tu, l'app non lo vede più.

L'app installata dallo store Android è **la stessa pagina web** dentro un
guscio (Trusted Web Activity): i dati stanno nel profilo del browser del
dispositivo, esattamente come nella versione installata da Chrome, e il
guscio non aggiunge nessun accesso, nessun permesso e nessun servizio.
Quando apri un file EPUB o PDF «con» Book Companion, il sistema passa
all'app quel solo file, che entra in biblioteca come se l'avessi caricato
dal tasto.

## 2. Quello che esce solo se lo accendi tu

Tre funzioni, tutte facoltative, tutte spente finché non le attivi.

### 2.1 La sincronizzazione fra dispositivi (Supabase)

Se crei un account e accendi la sincronizzazione, salgono su un database
[Supabase](https://supabase.com) — in una riga che è **solo tua**, protetta
da Row Level Security — questi dati:

- **le copertine dei libri**, in un bucket privato (i file dei libri no:
  stanno sui tuoi dispositivi e sul tuo disco; nel bucket resta solo quel
  che c'era da prima);
- i metadati della biblioteca e i segni di lettura elencati al punto 1;
- le preferenze, le raccolte musicali, i **link YouTube** salvati, i
  **nomi** delle melodie caricate come file (col loro peso) e il glossario
  che hai scritto;
- il tuo **indirizzo e-mail** e la password (gestiti da Supabase Auth: la
  password è conservata da loro sotto forma di hash, l'app non la vede mai
  e non la salva).

**I file delle melodie NON salgono**: i byte restano sul dispositivo dove
li hai caricati. Viaggiano i loro nomi, perché le raccolte siano le stesse
ovunque; per sentirle su un altro dispositivo ci porti tu i file (col
cavo, con Quick Share, da una chiavetta), senza passare dal cloud.

Puoi non accenderla mai: l'app funziona identica senza. Se la spegni e
cancelli l'account, quei dati vanno via con lui.

### 2.1 bis Niente Google

Nella biblioteca si entra con email e password: «Entra con Google» è stato
tolto, e Google Drive non è più usato dall'app. Quel che ne restava (le
chiavi sul dispositivo, l'elenco dei file e, nel tuo Supabase, la riga col
permesso a lungo termine di Google) l'app lo cancella da sola. Gli accessi
dati a Google a suo tempo si ritirano da myaccount.google.com → Sicurezza →
App e servizi di terze parti (i passi in `docs/ACCESSO.md`).

### 2.2 L'Oracolo (Anthropic)

Le funzioni «Chi è costui?», «Dove eravamo rimasti» e «Prima di
cominciare» chiedono a un modello di Anthropic. **Funzionano solo se
incolli una chiave API tua**: la chiave sta sul dispositivo e, se hai
acceso la sincronizzazione, anche nella tua riga delle preferenze su
Supabase, da cui arriva sugli altri tuoi dispositivi (vedi 2.1); non passa
da nessun nostro server, e la spesa la vedi in fondo alla scheda.

Quando fai una di queste domande, escono dal dispositivo verso
`api.anthropic.com`:

- **i passaggi del libro** che servono a rispondere — paragrafi interi,
  scelti fra quelli che hai già letto;
- il nome del personaggio, quando è una scheda-personaggio.

**Non escono i titoli dei libri né i nomi delle saghe**: i volumi vengono
numerati («Volume 2»), e i titoli veri li rimette lo schermo. È una scelta
tecnica contro gli spoiler, ma vale anche qui.

**L'eccezione sono i consigli di lettura** («Consigli dell'Oracolo», nella
pagina «Da prendere»), che partono solo quando li chiedi: lì il modello
riceve l'elenco della tua biblioteca — titolo, autore, saga col numero,
stato di lettura, voto e cuore dei preferiti — perché consigliare libri
senza sapere quali hai letto non si può. Nessuna pagina dei libri. I titoli
che propone vengono poi cercati su Open Library (`openlibrary.org`) per
controllare che esistano.

L'uso dei dati da parte di Anthropic è regolato dal contratto fra te e
loro, non da noi: vedi la [privacy policy di
Anthropic](https://www.anthropic.com/legal/privacy).

### 2.3 Le serie da Hardcover

In «📥 Senza file», le saghe e le saghe di un autore si cercano anche su
Hardcover (`api.hardcover.app`), **solo se incolli una chiave tua** nelle
Impostazioni («Le serie da Hardcover»). Basta una chiave col solo permesso
`read:catalog`: non legge e non tocca la tua libreria su Hardcover. La
chiave sta sul dispositivo e, con la sincronizzazione accesa, nella tua
riga delle preferenze su Supabase, come quella dell'Oracolo; fuori va solo
a Hardcover, nella richiesta.

Cosa esce, e solo quando tocchi «Cerca i libri» o «Le sue saghe»: il nome
della saga o dell'autore che hai scritto, poi il numero della serie o
dell'autore su Hardcover, per leggerne i libri. Quali libri hai e come si
chiamano le tue raccolte non partono: il confronto si fa sul dispositivo.
Con la chiave, anche **le copertine che mancano**: per un libro senza
copertina che sta per comparire sullo schermo partono il suo titolo e il suo
autore, e se Hardcover ha la copertina l'app la mostra caricandola da
`assets.hardcover.app` (che vede la richiesta, come per ogni immagine). Non
si salva e non viaggia: si ricorda solo il suo indirizzo, sul dispositivo.
Siccome la chiave è tua, Hardcover sa che quelle ricerche vengono dal tuo
account. L'uso dei dati da parte di Hardcover è regolato dalle sue
condizioni e dalla sua privacy policy, su hardcover.app.

### 2.4 La musica da YouTube

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
| Un libro non dichiara la saga né nel file né nel titolo | `openlibrary.org` | titolo e autore di quel libro |
| Apri «Da prendere» (al massimo una volta a settimana, o col tasto «Cerca di nuovo») | `openlibrary.org` | il nome degli autori delle saghe che hai cominciato e dei tuoi autori preferiti (per trovarne di simili), i generi dei libri che hai amato, e il titolo e l'autore di quei libri e dei volumi delle saghe — una domanda per volta, mai l'elenco della biblioteca |
| Una voce di «Da prendere» (consiglio o lista) non ha ancora la copertina | `openlibrary.org` | titolo e autore di quel libro, una volta sola |
| ...e i consigli del catalogo hanno una copertina | `covers.openlibrary.org` | il numero della copertina di quel libro (l'immagine), niente di tuo |
| Scarichi il dizionario offline dalle Impostazioni (WordNet o Wiktionary) | `raw.githubusercontent.com` (GitHub, dove sta il codice dell'app) | niente: sono file statici del repository pubblico dell'app, scaricati una volta; GitHub vede la richiesta come per ogni pagina |
| Scarichi Lexicanum dalle Impostazioni | `wh40k.lexicanum.com` | niente di tuo: si chiedono le pagine del wiki, tutte, in ordine alfabetico. Le voci poi si cercano sul dispositivo |
| Tocchi «Apri su Lexicanum» nella voce | `wh40k.lexicanum.com` | il nome della voce (apri tu il link) |
| Scarichi Fandom dalle Impostazioni | `warhammer40k.fandom.com` | niente di tuo: si chiedono le pagine del Warhammer 40k Wiki, tutte, in ordine alfabetico. Le voci poi si cercano sul dispositivo |
| Scarichi le immagini di un wiki dalle Impostazioni | `warhammer40k.fandom.com` e `static.wikia.nocookie.net` (Fandom), `wh40k.lexicanum.com` (Lexicanum) | niente di tuo: si chiede quale sia l'immagine principale di ogni voce, tutte in ordine alfabetico, e si scaricano quelle |
| Scarichi le altre illustrazioni di Fandom dalle Impostazioni | `warhammer40k.fandom.com` e `static.wikia.nocookie.net` | niente di tuo: si chiede quali file contiene ogni voce, tutte in ordine alfabetico, poi le miniature di quei file alla misura che scegli |
| Tocchi «Apri su Fandom» nella voce | `warhammer40k.fandom.com` | il nome della voce (apri tu il link) |
| Quando cominci a seguire le novità di una saga di libri o di fumetti, aperta la sua raccolta, una volta | `www.wikidata.org` | il nome della raccolta e i titoli dei suoi primi volumi, per trovare la serie di cui sono parte. Niente altro: né chi sei né cosa hai letto |
| Cerchi una saga per nome in «📥 Senza file», se non è una delle guide dell'app | `www.wikidata.org` | il nome della saga che hai scritto, per trovare la serie e i suoi libri. Quali libri hai non parte: il confronto si fa sul dispositivo |
| Cerchi le saghe di un autore in «📥 Senza file» | `www.wikidata.org` | il nome dell'autore che hai scritto, per trovare i suoi libri e le loro serie; poi, se ne tocchi una, il numero di quella serie |
| Tocchi «🔍 Di che saga è?» per un libro solo in «📥 Senza file», se le guide dell'app e i tuoi libri non bastano | `www.wikidata.org` | il titolo che hai scritto, per trovare il libro e la sua serie; poi il numero della serie, per leggerne i libri. Il nome delle tue raccolte e quali libri hai non partono: il confronto si fa sul dispositivo |
| Aggiungi schede senza file | `openlibrary.org`, `covers.openlibrary.org` (che rimanda ad `archive.org`) | titolo e autore di ogni libro aggiunto, per trovarne la copertina, e la richiesta dell'immagine |
| Apri l'app, se in biblioteca hai libri del 40K (al più una volta ogni sei ore) | `wh40k.lexicanum.com` | niente di tuo: si chiede l'elenco delle pagine aperte di recente sul wiki, e i libri si scelgono sul dispositivo |
| Ad app chiusa, ogni quattro ore, se segui le novità di almeno una raccolta (solo nell'app Android) | `openlibrary.org`, `api.mangadex.org`, `www.wikidata.org` | per una saga riconosciuta su Wikidata, il suo numero lì (i libri che ne fanno parte) e il nome dei suoi autori a Open Library (i loro libri più nuovi); per un autore o una saga che Wikidata non conosce, il nome degli autori (i loro libri più nuovi); per una saga di manga, il suo titolo una volta e poi il suo numero su MangaDex (gli ultimi capitoli). Le raccolte seguite stanno sul dispositivo; la notifica la manda Android, niente passa da un nostro server |
| Sempre, per i caratteri della pagina | `fonts.googleapis.com`, `fonts.gstatic.com` | niente, oltre alla richiesta stessa |

Due avvertenze oneste:

- **MyMemory è una memoria di traduzione condivisa.** Le richieste
  anonime possono finire nel loro archivio pubblico. Esce una parola
  singola alla volta, mai una frase del libro, ma vale la pena saperlo.
- **La ricerca del retro di copertina e della saga fa uscire titolo e
  autore** di quel libro verso un catalogo bibliografico. Sono gli unici
  punti in cui un titolo esce dal dispositivo, e sono dichiarati nell'app
  («Dal catalogo in rete» sotto il testo trovato, «saga letta dal
  catalogo» nel resoconto).

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
