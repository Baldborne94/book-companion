package it.bookcompanion.app;

import android.Manifest;
import android.app.Activity;
import android.app.WallpaperManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.ContextWrapper;
import android.content.Intent;
import android.content.ServiceConnection;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelFileDescriptor;
import android.util.Base64;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.browser.customtabs.CustomTabsClient;
import androidx.browser.customtabs.CustomTabsService;
import androidx.browser.customtabs.CustomTabsServiceConnection;
import androidx.browser.customtabs.CustomTabsSession;
import androidx.browser.trusted.TokenStore;

import com.google.androidbrowserhelper.trusted.LauncherActivityMetadata;
import com.google.androidbrowserhelper.trusted.QualityEnforcer;
import com.google.androidbrowserhelper.trusted.TwaLauncher;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.lang.reflect.Field;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

// LA COPERTINA SULLA SCHERMATA DI BLOCCO, come il Kindle.
//
// Chiesto dal lettore: a tablet spento, la copertina di quel che sta
// leggendo. Uno schermo spento e' nero per tutti, ma lo sfondo della
// schermata di blocco lo puo' cambiare un'app nativa: questa. La pagina
// manda la copertina gia' composta per lo schermo (`lib/sfondo.js`), a
// pezzi, sul canale postMessage che Chrome offre alle Trusted Web Activity;
// qui si ricompone e si mette come sfondo di blocco.
//
// IL CANALE VIVE QUANTO IL PROCESSO, NON QUANTO L'ATTIVITA'. La
// `LauncherActivity` della libreria lancia Chrome e si chiude subito
// (`finish()` appena il browser e' partito), e chiudendosi distrugge il
// lanciatore e con lui la presa sul servizio di Chrome, cioe' la sessione
// su cui viaggiano i messaggi. Quindi il lanciatore qui sotto lega il
// servizio col contesto dell'APPLICAZIONE (`Contesto`) e non si distrugge
// con l'attivita': la pagina ci parla finche' Android non uccide il
// processo. Dopo, al prossimo avvio dall'icona, si ricomincia.
//
// LA SESSIONE SI LEGGE PER RIFLESSIONE: la libreria la tiene privata e non
// la da' a nessuno. Il campo si chiama `mSession` nella 2.7.4 che
// Bubblewrap 1.25 porta con se', e la regola ProGuard che `apk.mjs cuci`
// scrive gli conserva il nome. Se un giorno non si legge, lo sfondo non si
// mette e si scrive nel log: l'app va come prima.
//
// IL SALUTO SI RIPETE finche' la pagina non risponde (`CIAO`): il primo
// messaggio porta la porta alla pagina, e se arriva prima che la pagina
// abbia messo il suo ascolto va perso con la porta. Dopo un po' senza
// risposta si richiede un canale nuovo, tre volte al piu'.
//
// E SI RISALUTA OGNI VOLTA CHE LA SCHEDA TORNA DAVANTI (`TAB_SHOWN`): riaperta
// l'app dall'icona a processo vivo, la `LauncherActivity` rifa' il
// lanciatore e la sessione di Chrome cambia, ma la pagina — la stessa, non
// ricaricata — tiene la porta della sessione di prima, che e' morta senza
// dirlo: il tablet mostrava sulla schermata di blocco il libro di prima
// mentre la pagina mandava quello nuovo nel vuoto. Al ritorno davanti si
// saluta sul canale che c'e'; se Chrome rifiuta il messaggio o il canale
// non c'e', se ne chiede uno nuovo. La pagina, a ogni saluto, rimanda la
// copertina che non ha avuto l'ok.
//
// E OGNI PASSO SI SEGNA (`Diagnosi`): al prossimo avvio dall'icona
// l'indirizzo di apertura porta alla pagina com'e' andata l'ultima volta —
// sessione letta, browser scaldato, canale chiesto, origine verificata,
// canale pronto, risposta della pagina — perche' quando il canale non si
// apre e' l'unica strada che resta per dirlo a chi non ha `adb`.
public final class SchermataDiBlocco {
    private static final String TAG = "Grimorio";
    static final String SALUTO = "grimorio:pronto";
    // LA RETE DEL GUSCIO. MangaDex mette davanti alla sua API una sfida
    // anti-bot che lascia passare le app e respinge le pagine web: dal
    // browser la stanza «Serie seguite» non poteva leggerlo («la rete non
    // risponde», sul tablet). Il guscio e' un'app: la pagina gli chiede
    // l'indirizzo (`{"rete":{id,url}}`), il guscio lo chiede col nome
    // dell'app e rimanda il corpo a pezzi in base64, come la copertina ma al
    // contrario. Solo indirizzi di MangaDex, solo https: il guscio non e' un
    // proxy per chiunque. Dopo il saluto dice che sa farlo (`SA_RETE`): un
    // guscio vecchio tace, e la pagina lo sa.
    static final String SA_RETE = "grimorio:sa:rete";
    private static final int PEZZO_RETE = 48000;
    private static final int RETE_MAX = 20 * 1024 * 1024;
    private static final ExecutorService fila = Executors.newFixedThreadPool(2);
    static final String CIAO = "grimorio:ciao";
    static final String OK = "grimorio:sfondo:ok";
    // MESSA, MA SENZA LO SFONDO DI PRIMA: il permesso di leggerlo e' stato
    // negato (o la finestra non e' mai comparsa, come sul tablet con quattro
    // APK di fila) e la copertina si mette lo stesso — il lettore la vuole —
    // dicendolo, con lo stato del permesso in coda, cosi' la pagina spiega
    // la strada delle impostazioni Android senza aspettare un riavvio
    static final String OK_SENZA_PRIMA = "grimorio:sfondo:ok:senzaprima";
    static final String ERRORE = "grimorio:sfondo:errore:";
    // SPEGNENDO L'INTERRUTTORE LO SFONDO SI TOGLIE: il lettore ha spento e
    // ha trovato sulla schermata di blocco il libro di prima, «ed e' anche
    // sbagliato». Android non ha un «rimetti quello di prima» (lo sfondo che
    // c'era non si puo' leggere), ma `clear(FLAG_LOCK)` toglie quello messo
    // qui e la schermata di blocco torna a quello della schermata iniziale
    static final String TOGLI = "grimorio:sfondo:togli";
    static final String TOLTO = "grimorio:sfondo:tolto";
    // E QUELLO DI PRIMA SI RIMETTE: sul Samsung del lettore `clear` non
    // torna allo sfondo della schermata iniziale ma a quello predefinito
    // («mi mette lo sfondo default e non l'ultimo che c'era prima»). Allora
    // lo sfondo che c'e' si salva PRIMA di coprirlo, la prima volta, e
    // spegnendo si rimette quello. Per leggerlo Android (fino al 12) vuole
    // il permesso di lettura della memoria, che il lanciatore chiede una
    // volta al prossimo avvio; dal 13 non si puo' piu' leggere e si va
    // come prima. Senza permesso la copertina non si mette: metterla
    // coprirebbe per sempre quel che si voleva salvare.
    static final String RIMESSO = "grimorio:sfondo:rimesso";
    // IL PERMESSO GIUSTO PER L'ANDROID CHE C'E'. Fino ad Android 12 lo sfondo
    // si legge con READ_EXTERNAL_STORAGE (una finestra). Da Android 13
    // `StorageManager.checkPermissionReadImages`, che il servizio degli sfondi
    // chiama per chi non e' di sistema, guarda PRIMA l'«accesso a tutti i
    // file» (MANAGE_EXTERNAL_STORAGE) e POI READ_EXTERNAL_STORAGE — che a
    // un'app compilata per Android 13+ (questa: targetSdk 36) non si
    // concede piu'. «Foto e video» (READ_MEDIA_IMAGES, APK 1138) non basta:
    // il tablet ha risposto «Permission READ_EXTERNAL_STORAGE denied» col
    // permesso delle foto concesso. L'accesso a tutti i file non e' una
    // finestra ma un interruttore nelle impostazioni: `PermessoActivity` ci
    // porta e aspetta il ritorno. Il tablet del lettore e' un Android 14; lo
    // user agent di Chrome scrive «Android 10» su ogni dispositivo.
    static boolean tuttiIFile() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU;
    }
    static String permessoLettura() {
        return Manifest.permission.READ_EXTERNAL_STORAGE;
    }
    static Intent intentoTuttiIFile(Context c) {
        Intent i = new Intent(android.provider.Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION, Uri.parse("package:" + c.getPackageName()));
        if (i.resolveActivity(c.getPackageManager()) == null) i = new Intent(android.provider.Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION);
        return i;
    }
    // IL TABLET SDRAIATO: Android ritaglia lo sfondo per lo schermo com'e' nel
    // momento in cui lo mette, e un'immagine in piedi messa a tablet sdraiato
    // torna in piedi ingrandita tre volte («non si capisce niente»). Si mette
    // e si rimette solo a tablet in piedi; la pagina aspetta il verso giusto.
    static boolean sdraiato(Context c) {
        try {
            android.util.DisplayMetrics m = new android.util.DisplayMetrics();
            c.getSystemService(android.hardware.display.DisplayManager.class).getDisplay(android.view.Display.DEFAULT_DISPLAY).getRealMetrics(m);
            return m.widthPixels > m.heightPixels;
        } catch (Throwable e) {
            return false;
        }
    }
    static final String SDRAIATO = "il tablet è sdraiato: Android ritaglia lo sfondo per lo schermo com'è adesso. Rimettilo in piedi e riprova";
    private static String ultimoGuastoLettura;
    private static final String PREFS_SFONDO = "grimorio_sfondo";
    private static final String CHIEDI_LETTURA = "chiedi_lettura";
    // UN NO VALE PER QUESTA APERTURA DELL'APP, NON PER SEMPRE: gli APK 1126
    // e 1132 scrivevano il diniego su disco e da li' non chiedevano piu',
    // e un «no» arrivato senza finestra (Samsung risponde subito «negato»
    // dopo un «non chiedere piu'») chiudeva la porta per sempre. Ora un no
    // ferma le richieste finche' il processo vive, e al prossimo avvio si
    // richiede; a chi ha detto «non chiedere piu'» Android non mostra
    // niente, e allora si apre la pagina dell'app nelle impostazioni.
    private static boolean negataQui;
    // c'e' gia' stata una richiesta con risposta: serve a distinguere il
    // «non chiedere piu'» (nessuna finestra, e nessuna spiegazione dovuta)
    // dalla primissima richiesta, che Android tratta allo stesso modo
    private static final String LETTURA_CHIESTA = "lettura_chiesta";
    static final String DA_COPERTINA = "da_copertina";
    private static final String FILE_PRIMA = "sfondo_prima";
    // LA COPERTINA CHE ASPETTA IL PERMESSO. Gli APK 1126-1132 chiedevano il
    // permesso solo al prossimo avvio dall'icona, e sul tablet la finestra
    // non e' mai comparsa («no stessa cosa»). Ora si chiede NEL MOMENTO in
    // cui serve: la copertina arrivata si mette da parte, la finestra si
    // apre sopra Chrome (il guscio puo', perche' Chrome in primo piano e'
    // legato al suo PostMessageService), e concesso il permesso la
    // copertina messa da parte si mette da sola. L'avvio dall'icona resta
    // come seconda strada.
    private static final String FILE_ATTESA = "sfondo_attesa";
    private static final int PEZZI_MAX = 64;
    private static final long[] RITENTA_DOPO = { 1500, 4000, 10000 };
    // IL CANALE CHIESTO E MAI PRONTO: con la pagina ricaricata nella stessa
    // sessione (l'aggiornamento dell'app) Chrome accetta la richiesta
    // (`r=1`, origine verificata `v=1`) e non dice mai «pronto» (`p=`): la
    // pagina nuova non ha porta e il guscio aspettava per sempre. Chrome
    // chiude il canale a ogni documento nuovo e lo riapre solo a richiesta,
    // e la prima richiesta puo' cadere nel buco fra lo sgancio e il
    // riaggancio del servizio. Si richiede a scadenze finche' non e' pronto.
    private static final long[] RICHIEDI_DOPO = { 2000, 5000, 12000 };
    private static int richieste;
    private static int finestreChieste;

    private static Lanciatore lanciatore;
    private static String ultimoGuasto;
    private static Uri origine;
    private static CustomTabsClient scaldato;
    private static boolean scaldando;
    private static boolean ciao;
    // il canale di questa sessione e' pronto (`onMessageChannelReady`)
    private static boolean canale;
    // quando si e' chiesto l'ultimo canale: una richiesta ancora in volo non si ripete
    private static long chiestoA;
    private static final long RICHIESTA_IN_VOLO = 10000;
    private static int tentativi;
    private static final Handler mano = new Handler(Looper.getMainLooper());
    private static final Map<String, String[]> pezzi = new HashMap<>();

    private SchermataDiBlocco() {}

    static TwaLauncher lanciatore(Activity attivita, LauncherActivityMetadata meta, Integer idSessione,
            TokenStore store) {
        if (lanciatore != null) lanciatore.chiudi();
        if (meta.defaultUrl != null) {
            Uri u = Uri.parse(meta.defaultUrl);
            origine = Uri.parse(u.getScheme() + "://" + u.getAuthority());
        }
        lanciatore = new Lanciatore(new Contesto(attivita), meta.launchingBrowser, idSessione, store);
        // una sessione nuova non ha canale ne' saluto
        ciao = false;
        canale = false;
        chiestoA = 0;
        Diagnosi.segna(attivita, "l", origine != null);
        return lanciatore;
    }

    // ---- LA DIAGNOSI ---------------------------------------------------------

    private static final class Diagnosi {
        private static final String NOME = "grimorio";

        static void segna(Context c, String chiave, String valore) {
            try {
                // `commit` e non `apply`: un processo in secondo piano senza
                // attivita' Android lo puo' uccidere da un momento all'altro,
                // e la diagnosi deve essere gia' su disco
                c.getSharedPreferences(NOME, Context.MODE_PRIVATE).edit().putString(chiave, valore).commit();
            } catch (Throwable e) {
                /* senza memoria la diagnosi manca, non il resto */
            }
        }

        static void segna(Context c, String chiave, boolean valore) {
            segna(c, chiave, valore ? "1" : "0");
        }

        // «s=1;c=1;r=1;v=0;p=0;a=0;f=0;e=…»: una lettera per passo, nell'ordine
        // in cui i passi avvengono, cosi' la pagina dice dove ci si e' fermati
        static String leggiEAzzera(Context c) {
            try {
                SharedPreferences p = c.getSharedPreferences(NOME, Context.MODE_PRIVATE);
                if (p.getAll().isEmpty()) return null;
                StringBuilder s = new StringBuilder();
                for (String k : new String[] { "l", "k", "n", "u", "s", "c", "r", "q", "v", "p", "a", "f", "e", "z" }) {
                    if (s.length() > 0) s.append(';');
                    s.append(k).append('=').append(p.getString(k, ""));
                }
                p.edit().clear().apply();
                // e lo stato del permesso di leggere lo sfondo, che non si azzera
                s.append(';').append(statoPermesso(c));
                return s.toString();
            } catch (Throwable e) {
                return null;
            }
        }
    }

    static Uri conDiagnosi(Activity attivita, Uri indirizzo) {
        if (indirizzo == null) return null;
        try {
            Uri.Builder b = indirizzo.buildUpon().appendQueryParameter("guscio", String.valueOf(versione(attivita)))
                    .appendQueryParameter("android", String.valueOf(Build.VERSION.SDK_INT));
            String esito = Diagnosi.leggiEAzzera(attivita);
            if (esito != null) b.appendQueryParameter("esito", esito);
            return b.build();
        } catch (Throwable e) {
            return indirizzo;
        }
    }

    private static long versione(Context c) {
        try {
            PackageInfo info = c.getPackageManager().getPackageInfo(c.getPackageName(), 0);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) return info.getLongVersionCode();
            @SuppressWarnings("deprecation")
            long v = info.versionCode;
            return v;
        } catch (Throwable e) {
            return 0;
        }
    }

    // ---- IL LANCIATORE -------------------------------------------------------

    // la presa sul servizio e' dell'applicazione, l'avvio dell'attivita' e'
    // dell'attivita' (da un contesto che non e' un'attivita' Android vuole
    // FLAG_ACTIVITY_NEW_TASK, e la pagina finirebbe in un'altra finestra)
    private static final class Contesto extends ContextWrapper {
        private final Context app;

        Contesto(Activity attivita) {
            super(attivita);
            app = attivita.getApplicationContext();
        }

        @Override
        public boolean bindService(Intent servizio, ServiceConnection conn, int flags) {
            return app.bindService(servizio, conn, flags);
        }

        @Override
        public void unbindService(ServiceConnection conn) {
            app.unbindService(conn);
        }
    }

    private static final class Lanciatore extends TwaLauncher {
        Lanciatore(Context contesto, @Nullable String provider, @Nullable Integer idSessione, TokenStore store) {
            super(contesto, provider, idSessione, store);
        }

        // la libreria lo chiama quando l'attivita' muore: la sessione invece
        // deve restare, vedi in testa. Il prezzo e' l'attivita' trampolino
        // tenuta in memoria dal `Contesto` finche' un lancio nuovo non
        // sostituisce questo lanciatore (`chiudi`): una sola alla volta.
        @Override
        public void destroy() {}

        void chiudi() {
            super.destroy();
        }

        // PER NOME, E SE NO PER TIPO: l'APK 1104 ha detto «la sessione non si
        // e' letta» — R8 aveva toccato il campo nonostante la regola sul
        // nome. Il tipo invece non si nasconde: fra i campi della classe (e
        // delle sue madri) uno solo e' una `CustomTabsSession`.
        @Nullable
        CustomTabsSession sessione() {
            try {
                Field f = TwaLauncher.class.getDeclaredField("mSession");
                f.setAccessible(true);
                return (CustomTabsSession) f.get(this);
            } catch (Throwable perNome) {
                for (Class<?> c = getClass(); c != null && c != Object.class; c = c.getSuperclass()) {
                    for (Field f : c.getDeclaredFields()) {
                        if (f.getType() != CustomTabsSession.class) continue;
                        try {
                            f.setAccessible(true);
                            return (CustomTabsSession) f.get(this);
                        } catch (Throwable perTipo) {
                            Log.w(TAG, "la sessione non si legge per tipo: " + perTipo);
                        }
                    }
                }
                Log.w(TAG, "la sessione di Chrome non si legge: " + perNome);
                ultimoGuasto = String.valueOf(perNome);
                return null;
            }
        }
    }

    @Nullable
    private static CustomTabsSession sessione() {
        return lanciatore == null ? null : lanciatore.sessione();
    }

    // ---- QUEL CHE CHROME CI DICE ----------------------------------------------

    // Sopra `QualityEnforcer`, che e' il callback di sempre della libreria: i
    // suoi controlli restano.
    static final class Ascolto extends QualityEnforcer {
        private final Context app;

        Ascolto(Context app) {
            this.app = app;
            Diagnosi.segna(app, "k", true);
        }

        @Override
        public void onNavigationEvent(int evento, @Nullable Bundle extras) {
            super.onNavigationEvent(evento, extras);
            // l'ultimo evento visto (`u`), e il segno che la pagina si e'
            // caricata almeno una volta (`n`), che resta: l'APK 1108 diceva
            // «ultimo evento 6» (scheda nascosta) perche' chiudere l'app
            // copriva il 2 di prima
            Diagnosi.segna(app, "u", String.valueOf(evento));
            // a ogni pagina caricata (anche dopo un aggiornamento dell'app,
            // che la ricarica): il canale di prima e' morto con lei
            if (evento == NAVIGATION_FINISHED) {
                Diagnosi.segna(app, "n", true);
                ciao = false;
                canale = false;
                chiestoA = 0;
                tentativi = 0;
                richieste = 0;
                apriCanale(app);
            } else if (evento == TAB_SHOWN) {
                // la scheda torna davanti: si risaluta, e la pagina rimanda
                // quel che non ha avuto l'ok (vedi in testa)
                ciao = false;
                tentativi = 0;
                richieste = 0;
                if (canale) saluta(app);
                else if (System.currentTimeMillis() - chiestoA > RICHIESTA_IN_VOLO) apriCanale(app);
            }
        }

        @Override
        public void onMessageChannelReady(@Nullable Bundle extras) {
            super.onMessageChannelReady(extras);
            Diagnosi.segna(app, "p", true);
            canale = true;
            chiestoA = 0;
            saluta(app);
        }

        @Override
        public void onPostMessage(@NonNull String messaggio, @Nullable Bundle extras) {
            super.onPostMessage(messaggio, extras);
            if (CIAO.equals(messaggio)) {
                ciao = true;
                Diagnosi.segna(app, "a", true);
                return;
            }
            if (TOGLI.equals(messaggio)) {
                togli(app);
                return;
            }
            // NIENTE CHE ARRIVA DALLA PAGINA PUO' FAR CADERE IL GUSCIO: con l'APK
            // 1160 un errore negli avvisi (Android 14 voleva un permesso in
            // piu' per il lavoro periodico) usciva da qui e chiudeva il
            // processo, a ogni apertura; e con lui la rete di MangaDex
            try {
                ricevi(app, messaggio);
            } catch (Throwable e) {
                Log.w(TAG, "messaggio della pagina: " + e);
                Diagnosi.segna(app, "e", "messaggio: " + e);
            }
        }

        @Override
        public void onRelationshipValidationResult(int relazione, @NonNull Uri richiesta, boolean esito,
                @Nullable Bundle extras) {
            super.onRelationshipValidationResult(relazione, richiesta, esito, extras);
            Log.d(TAG, "origine " + richiesta + " verificata: " + esito);
            Diagnosi.segna(app, "v", esito);
        }
    }

    // Chrome apre il canale solo a browser «scaldato» (`warmup`), e la
    // libreria non lo scalda piu' sui Chrome recenti: una presa a parte,
    // del processo, lo fa una volta sola
    private static void apriCanale(Context app) {
        if (origine == null || lanciatore == null) {
            Diagnosi.segna(app, "e", origine == null ? "origine mancante" : "lanciatore mancante");
            return;
        }
        boolean letta = sessione() != null;
        Diagnosi.segna(app, "s", letta);
        if (!letta && ultimoGuasto != null) Diagnosi.segna(app, "e", ultimoGuasto);
        if (scaldato != null) {
            richiedi(app);
            return;
        }
        if (scaldando) return;
        String provider = lanciatore.getProviderPackage();
        if (provider == null) {
            Diagnosi.segna(app, "e", "nessun browser");
            return;
        }
        scaldando = true;
        boolean legato = CustomTabsClient.bindCustomTabsService(app, provider, new CustomTabsServiceConnection() {
            @Override
            public void onCustomTabsServiceConnected(@NonNull ComponentName nome, @NonNull CustomTabsClient client) {
                client.warmup(0);
                scaldato = client;
                scaldando = false;
                Diagnosi.segna(app, "c", true);
                richiedi(app);
            }

            @Override
            public void onServiceDisconnected(ComponentName nome) {
                scaldato = null;
                scaldando = false;
            }
        });
        if (!legato) {
            scaldando = false;
            Diagnosi.segna(app, "c", false);
        }
    }

    private static void richiedi(Context app) {
        CustomTabsSession s = sessione();
        if (s == null) return;
        // l'origine e' quella del sito: Chrome la verifica con
        // `use_as_origin` in assetlinks.json, e la pagina la ritrova in
        // `event.origin`
        boolean ok;
        chiestoA = System.currentTimeMillis();
        try {
            ok = s.requestPostMessageChannel(origine, origine, new Bundle());
        } catch (Throwable e) {
            ok = false;
            Diagnosi.segna(app, "e", String.valueOf(e));
        }
        Log.d(TAG, "canale chiesto: " + ok);
        Diagnosi.segna(app, "r", ok);
        // e se non diventa pronto, si richiede: ogni richiesta rifa' la
        // verifica dell'origine e riapre il canale sulla pagina di adesso
        if (!ok || richieste >= RICHIEDI_DOPO.length) return;
        final int mia = ++richieste;
        Diagnosi.segna(app, "q", String.valueOf(mia));
        mano.postDelayed(() -> {
            if (!canale && !ciao && richieste == mia) richiedi(app);
        }, RICHIEDI_DOPO[mia - 1]);
    }

    private static void saluta(Context app) {
        CustomTabsSession s = sessione();
        if (s == null) return;
        // Chrome dice subito se il canale non c'e' piu': allora se ne chiede
        // un altro, senza aspettare
        if (s.postMessage(SALUTO, null) != CustomTabsService.RESULT_SUCCESS) {
            canale = false;
            richiedi(app);
            return;
        }
        s.postMessage(SA_RETE, null);
        // senza risposta si riprova con un canale nuovo: il primo messaggio
        // puo' essere arrivato prima dell'ascolto della pagina
        if (tentativi >= RITENTA_DOPO.length) return;
        long fra = RITENTA_DOPO[tentativi++];
        mano.postDelayed(() -> {
            if (!ciao) richiedi(app);
        }, fra);
    }

    // ---- LA COPERTINA ---------------------------------------------------------

    // {"sfondo":{"id":"…","i":0,"n":4,"dati":"<base64>"}}: la copertina
    // arriva a pezzi perche' un messaggio solo da mezzo megabyte non passa
    // dal binder di Android
    private static void ricevi(Context app, String messaggio) {
        JSONObject radice;
        try {
            radice = new JSONObject(messaggio);
        } catch (Throwable e) {
            return;
        }
        JSONObject rete = radice.optJSONObject("rete");
        if (rete != null) {
            chiediAllaRete(app, rete);
            return;
        }
        // le serie seguite, per gli avvisi ad app chiusa (`Avvisi.java`): il
        // guscio risponde con lo stato delle notifiche
        org.json.JSONArray seguite = radice.optJSONArray("seguite");
        if (seguite != null) {
            mandaAllaPagina(Avvisi.seguite(app, seguite));
            return;
        }
        JSONObject sfondo = radice.optJSONObject("sfondo");
        if (sfondo == null) return;
        String id = sfondo.optString("id", "");
        int i = sfondo.optInt("i", -1);
        int n = sfondo.optInt("n", 0);
        String dati = sfondo.optString("dati", null);
        if (id.isEmpty() || dati == null || n < 1 || n > PEZZI_MAX || i < 0 || i >= n) return;
        synchronized (pezzi) {
            // una copertina nuova che comincia manda via quella rimasta a meta'
            if (i == 0 && !pezzi.containsKey(id)) pezzi.clear();
            String[] parti = pezzi.get(id);
            if (parti == null || parti.length != n) {
                parti = new String[n];
                pezzi.put(id, parti);
            }
            parti[i] = dati;
            StringBuilder intero = new StringBuilder();
            for (String p : parti) {
                if (p == null) return;
                intero.append(p);
            }
            pezzi.remove(id);
            metti(app, intero.toString());
        }
    }

    private static int sfondiMessi;

    // ---- LA RETE DEL GUSCIO -------------------------------------------------

    static boolean ospitePermesso(String host) {
        String h = String.valueOf(host).toLowerCase(Locale.ROOT);
        return h.equals("api.mangadex.org") || h.equals("uploads.mangadex.org") || h.equals("api.mangadex.network") || h.endsWith(".mangadex.network");
    }

    static String nomeDellApp(Context c) {
        return "BookCompanion/" + versione(c) + " (Android " + Build.VERSION.RELEASE + "; +https://book-companion.vercel.app)";
    }

    private static void chiediAllaRete(Context app, JSONObject r) {
        final long id = r.optLong("id", -1);
        final String indirizzo = r.optString("url", "");
        final String metodo = "POST".equalsIgnoreCase(r.optString("metodo", "GET")) ? "POST" : "GET";
        final String corpo = r.has("corpo") ? r.optString("corpo", "") : null;
        final String tipoCorpo = r.optString("tipoCorpo", "application/json");
        if (id < 0) return;
        fila.execute(() -> {
            HttpURLConnection c = null;
            try {
                URL u = new URL(indirizzo);
                if (!"https".equals(u.getProtocol()) || !ospitePermesso(u.getHost())) throw new IllegalArgumentException("indirizzo non permesso: " + u.getHost());
                c = (HttpURLConnection) u.openConnection();
                c.setConnectTimeout(20000);
                c.setReadTimeout(60000);
                c.setInstanceFollowRedirects(true);
                c.setRequestMethod(metodo);
                c.setRequestProperty("User-Agent", nomeDellApp(app));
                c.setRequestProperty("Accept", "*/*");
                if ("POST".equals(metodo) && corpo != null) {
                    byte[] b = corpo.getBytes(StandardCharsets.UTF_8);
                    c.setDoOutput(true);
                    c.setRequestProperty("Content-Type", tipoCorpo);
                    c.setFixedLengthStreamingMode(b.length);
                    try (OutputStream o = c.getOutputStream()) {
                        o.write(b);
                    }
                }
                int stato = c.getResponseCode();
                byte[] dati = leggiTutto(stato >= 400 ? c.getErrorStream() : c.getInputStream());
                rispondiRete(id, stato, c.getContentType(), c.getHeaderField("X-Cache"), dati);
            } catch (Throwable e) {
                try {
                    JSONObject dentro = new JSONObject();
                    dentro.put("id", id);
                    dentro.put("errore", String.valueOf(e.getMessage()));
                    JSONObject m = new JSONObject();
                    m.put("rete", dentro);
                    mandaAllaPagina(m.toString());
                } catch (Throwable ignora) {
                    /* senza risposta la pagina smette di aspettare da sola */
                }
            } finally {
                if (c != null) c.disconnect();
            }
        });
    }

    private static byte[] leggiTutto(InputStream in) throws Exception {
        if (in == null) return new byte[0];
        try (InputStream dentro = in; ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] b = new byte[64 * 1024];
            for (int n; (n = dentro.read(b)) > 0; ) {
                if (out.size() + n > RETE_MAX) throw new IllegalStateException("risposta troppo grande");
                out.write(b, 0, n);
            }
            return out.toByteArray();
        }
    }

    private static void rispondiRete(long id, int stato, String tipo, String cache, byte[] dati) throws Exception {
        String b64 = Base64.encodeToString(dati, Base64.NO_WRAP);
        int n = Math.max(1, (b64.length() + PEZZO_RETE - 1) / PEZZO_RETE);
        for (int k = 0; k < n; k++) {
            JSONObject dentro = new JSONObject();
            dentro.put("id", id);
            dentro.put("i", k);
            dentro.put("n", n);
            dentro.put("stato", stato);
            if (tipo != null) dentro.put("tipo", tipo);
            if (cache != null) dentro.put("cache", cache);
            dentro.put("dati", b64.substring(k * PEZZO_RETE, Math.min(b64.length(), (k + 1) * PEZZO_RETE)));
            JSONObject m = new JSONObject();
            m.put("rete", dentro);
            mandaAllaPagina(m.toString());
        }
    }

    static void mandaAllaPagina(String testo) {
        mano.post(() -> {
            CustomTabsSession s = sessione();
            if (s != null) s.postMessage(testo, null);
        });
    }

    // ---- LO SFONDO DI PRIMA -------------------------------------------------

    private static SharedPreferences prefsSfondo(Context c) {
        return c.getSharedPreferences(PREFS_SFONDO, Context.MODE_PRIVATE);
    }

    private static boolean leggibile(Context c) {
        if (tuttiIFile()) return android.os.Environment.isExternalStorageManager();
        return c.checkSelfPermission(permessoLettura()) == PackageManager.PERMISSION_GRANTED;
    }

    // il permesso si chiede solo se una copertina l'ha chiesto e in questa
    // apertura dell'app il lettore non ha gia' detto di no
    static boolean permessoDaChiedere(Context c) {
        return !leggibile(c) && prefsSfondo(c).getBoolean(CHIEDI_LETTURA, false) && !negataQui;
    }

    static boolean permessoChiestoGia(Context c) {
        return prefsSfondo(c).getBoolean(LETTURA_CHIESTA, false);
    }

    // `esiti` vuoto e' una finestra chiusa senza risposta: si richiedera'
    static void permessoRisposto(Context c, int[] esiti) {
        if (esiti == null || esiti.length == 0) return;
        permessoRisposto(c, esiti[0] == PackageManager.PERMISSION_GRANTED);
    }

    // tornati dalle impostazioni dell'accesso a tutti i file: la risposta e'
    // quel che c'e' scritto li'
    static void permessoRispostoDalleImpostazioni(Context c) {
        permessoRisposto(c, leggibile(c));
    }

    private static void permessoRisposto(Context c, boolean concesso) {
        negataQui = !concesso;
        prefsSfondo(c).edit().putBoolean(CHIEDI_LETTURA, false).putBoolean(LETTURA_CHIESTA, true).commit();
    }

    // lo stato del permesso, per la diagnosi: letto (w), da chiedere (x),
    // negato in questa apertura (y)
    static String statoPermesso(Context c) {
        SharedPreferences p = prefsSfondo(c);
        return "w=" + (leggibile(c) ? "1" : "0") + ";x=" + (p.getBoolean(CHIEDI_LETTURA, false) ? "1" : "0")
                + ";y=" + (negataQui ? "1" : "0") + (ultimoGuastoLettura != null ? ";g=" + ultimoGuastoLettura : "");
    }

    // La pagina dell'app nelle impostazioni di Android, dove il permesso si
    // concede a mano: e' la strada per chi ha detto «non chiedere piu'», a
    // cui Android non mostra piu' nessuna finestra
    static void apriImpostazioniApp(Activity a) {
        try {
            Intent i = new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + a.getPackageName()));
            a.startActivity(i);
        } catch (Throwable e) {
            Log.w(TAG, "le impostazioni dell'app non si aprono: " + e);
        }
    }

    private static File filePrima(Context app) {
        return new File(app.getFilesDir(), FILE_PRIMA);
    }

    private static File fileAttesa(Context app) {
        return new File(app.getFilesDir(), FILE_ATTESA);
    }

    private static void scrivi(File f, byte[] dati) throws Exception {
        File provvisorio = new File(f.getPath() + ".tmp");
        try (OutputStream out = new FileOutputStream(provvisorio)) {
            out.write(dati);
        }
        if (!provvisorio.renameTo(f)) throw new IllegalStateException("non si e' scritto " + f.getName());
    }

    private static byte[] leggi(File f) throws Exception {
        try (InputStream in = new FileInputStream(f); java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream()) {
            byte[] b = new byte[64 * 1024];
            for (int n; (n = in.read(b)) > 0; ) out.write(b, 0, n);
            return out.toByteArray();
        }
    }

    // La finestra del permesso sopra Chrome, da fuori da ogni attivita'.
    // Android 10 lascia partire un'attivita' da dietro le quinte a chi ha
    // un servizio legato dall'app in primo piano: Chrome e' legato al
    // PostMessageService finche' il canale e' aperto. Se non la lascia
    // partire non succede niente, e resta la strada dell'icona (`z` dice
    // quante volte si e' provato).
    static void chiediPermesso(Context app) {
        try {
            Intent i = new Intent(app, PermessoActivity.class);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            i.putExtra(DA_COPERTINA, true);
            app.startActivity(i);
            Diagnosi.segna(app, "z", String.valueOf(++finestreChieste));
        } catch (Throwable e) {
            Log.w(TAG, "la finestra del permesso non parte: " + e);
            Diagnosi.segna(app, "e", "finestra del permesso: " + e.getMessage());
        }
    }

    // Risposto il permesso, la copertina messa da parte si mette da sola e
    // la pagina riceve l'ok come se fosse appena arrivata: con lo sfondo di
    // prima salvato se e' stato concesso, senza (e dicendolo) se negato
    static void dopoIlPermesso(Context c) {
        Context app = c.getApplicationContext();
        // senza una risposta (finestra chiusa sotto) non si rimette, o la
        // copertina richiederebbe la finestra in un giro senza fine
        if (!fileAttesa(app).exists() || !(leggibile(app) || negataQui)) return;
        try {
            metti(app, leggi(fileAttesa(app)));
        } catch (Throwable e) {
            Log.w(TAG, "la copertina messa da parte non si legge: " + e);
        }
    }

    // Salva lo sfondo della schermata di blocco (o, se e' lo stesso della
    // iniziale, quello) la prima volta. Torna false se serve il permesso:
    // allora la copertina NON si mette, e al prossimo avvio si chiede.
    private static boolean salvaPrima(Context app, WallpaperManager wm) throws Exception {
        File f = filePrima(app);
        if (f.exists()) return true;
        SharedPreferences p = prefsSfondo(app);
        if (!leggibile(app)) {
            p.edit().putBoolean(CHIEDI_LETTURA, true).commit();
            return false;
        }
        ParcelFileDescriptor pfd;
        try {
            pfd = wm.getWallpaperFile(WallpaperManager.FLAG_LOCK);
            if (pfd == null) pfd = wm.getWallpaperFile(WallpaperManager.FLAG_SYSTEM);
        } catch (SecurityException e) {
            // il permesso c'e' ma Android vuole dell'altro: si dice quale
            ultimoGuastoLettura = String.valueOf(e.getMessage());
            Diagnosi.segna(app, "e", "lettura dello sfondo: " + e.getMessage());
            p.edit().putBoolean(CHIEDI_LETTURA, true).commit();
            return false;
        }
        // nessun file: sono i predefiniti, e per tornarci basta `clear`
        if (pfd == null) return true;
        File provvisorio = new File(app.getFilesDir(), FILE_PRIMA + ".tmp");
        try (InputStream in = new ParcelFileDescriptor.AutoCloseInputStream(pfd); OutputStream out = new FileOutputStream(provvisorio)) {
            byte[] b = new byte[64 * 1024];
            for (int n; (n = in.read(b)) > 0; ) out.write(b, 0, n);
        }
        if (!provvisorio.renameTo(f)) throw new IllegalStateException("lo sfondo di prima non si e' salvato");
        return true;
    }

    private static void togli(Context app) {
        new Thread(() -> {
            String esito;
            try {
                WallpaperManager wm = WallpaperManager.getInstance(app);
                if (!wm.isSetWallpaperAllowed()) throw new IllegalStateException("non permesso su questo dispositivo");
                File prima = filePrima(app);
                if (prima.exists() && sdraiato(app)) throw new IllegalStateException(SDRAIATO);
                if (prima.exists()) {
                    try (InputStream in = new FileInputStream(prima)) {
                        wm.setStream(in, null, true, WallpaperManager.FLAG_LOCK);
                    }
                    prima.delete();
                    esito = RIMESSO;
                } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    wm.clear(WallpaperManager.FLAG_LOCK);
                    esito = TOLTO;
                } else {
                    esito = ERRORE + "serve Android 9 o piu' recente per togliere lo sfondo";
                }
            } catch (Throwable e) {
                esito = ERRORE + e.getMessage();
                Diagnosi.segna(app, "e", String.valueOf(e.getMessage()));
            }
            final String risposta = esito;
            mano.post(() -> {
                CustomTabsSession s = sessione();
                if (s != null) s.postMessage(risposta, null);
            });
        }, "sfondo").start();
    }

    private static void metti(Context app, String base64) {
        byte[] byteDellImmagine;
        try {
            byteDellImmagine = Base64.decode(base64, Base64.DEFAULT);
        } catch (Throwable e) {
            byteDellImmagine = new byte[0];
        }
        metti(app, byteDellImmagine);
    }

    private static void metti(Context app, byte[] byteDellImmagine) {
        new Thread(() -> {
            String esito;
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    Bitmap immagine = BitmapFactory.decodeByteArray(byteDellImmagine, 0, byteDellImmagine.length);
                    if (immagine == null) throw new IllegalStateException("immagine illeggibile");
                    WallpaperManager wm = WallpaperManager.getInstance(app);
                    if (!wm.isSetWallpaperAllowed()) throw new IllegalStateException("non permesso su questo dispositivo");
                    if (sdraiato(app)) throw new IllegalStateException(SDRAIATO);
                    boolean salvato = salvaPrima(app, wm);
                    if (!salvato && !leggibile(app) && !negataQui) {
                        scrivi(fileAttesa(app), byteDellImmagine);
                        mano.post(() -> chiediPermesso(app));
                        esito = ERRORE + "per rimettere lo sfondo di prima quando spegni, serve il permesso di leggerlo: concedilo nella finestra che compare; se non compare, chiudi l'app del tutto e riaprila dall'icona";
                    } else {
                        wm.setBitmap(immagine, null, true, WallpaperManager.FLAG_LOCK);
                        fileAttesa(app).delete();
                        esito = salvato ? OK : OK_SENZA_PRIMA + " " + statoPermesso(app);
                        Diagnosi.segna(app, "f", String.valueOf(++sfondiMessi));
                    }
                } else {
                    esito = ERRORE + "serve Android 7 o piu' recente";
                }
            } catch (Throwable e) {
                esito = ERRORE + e.getMessage();
                Diagnosi.segna(app, "e", String.valueOf(e.getMessage()));
            }
            final String risposta = esito;
            mano.post(() -> {
                CustomTabsSession s = sessione();
                if (s != null) s.postMessage(risposta, null);
            });
        }, "sfondo").start();
    }
}
