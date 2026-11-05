package it.bookcompanion.app;

import android.app.Activity;
import android.app.WallpaperManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.ContextWrapper;
import android.content.Intent;
import android.content.ServiceConnection;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.browser.customtabs.CustomTabsClient;
import androidx.browser.customtabs.CustomTabsServiceConnection;
import androidx.browser.customtabs.CustomTabsSession;
import androidx.browser.trusted.TokenStore;

import com.google.androidbrowserhelper.trusted.LauncherActivityMetadata;
import com.google.androidbrowserhelper.trusted.QualityEnforcer;
import com.google.androidbrowserhelper.trusted.TwaLauncher;

import org.json.JSONObject;

import java.lang.reflect.Field;
import java.util.HashMap;
import java.util.Map;

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
public final class SchermataDiBlocco {
    private static final String TAG = "Grimorio";
    static final String SALUTO = "grimorio:pronto";
    static final String OK = "grimorio:sfondo:ok";
    static final String ERRORE = "grimorio:sfondo:errore:";
    private static final int PEZZI_MAX = 64;

    private static Lanciatore lanciatore;
    private static Uri origine;
    private static CustomTabsClient scaldato;
    private static boolean scaldando;
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
        return lanciatore;
    }

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

        @Nullable
        CustomTabsSession sessione() {
            try {
                Field f = TwaLauncher.class.getDeclaredField("mSession");
                f.setAccessible(true);
                return (CustomTabsSession) f.get(this);
            } catch (Throwable e) {
                Log.w(TAG, "la sessione di Chrome non si legge: " + e);
                return null;
            }
        }
    }

    @Nullable
    private static CustomTabsSession sessione() {
        return lanciatore == null ? null : lanciatore.sessione();
    }

    // Quel che Chrome ci dice. Sopra `QualityEnforcer`, che e' il callback
    // di sempre della libreria: i suoi controlli restano.
    static final class Ascolto extends QualityEnforcer {
        private final Context app;

        Ascolto(Context app) {
            this.app = app;
        }

        @Override
        public void onNavigationEvent(int evento, @Nullable Bundle extras) {
            super.onNavigationEvent(evento, extras);
            // a ogni pagina caricata (anche dopo un aggiornamento dell'app,
            // che la ricarica): il canale di prima e' morto con lei
            if (evento == NAVIGATION_FINISHED) apriCanale(app);
        }

        @Override
        public void onMessageChannelReady(@Nullable Bundle extras) {
            super.onMessageChannelReady(extras);
            CustomTabsSession s = sessione();
            if (s != null) s.postMessage(SALUTO, null);
        }

        @Override
        public void onPostMessage(@NonNull String messaggio, @Nullable Bundle extras) {
            super.onPostMessage(messaggio, extras);
            ricevi(app, messaggio);
        }

        @Override
        public void onRelationshipValidationResult(int relazione, @NonNull Uri richiesta, boolean esito,
                @Nullable Bundle extras) {
            super.onRelationshipValidationResult(relazione, richiesta, esito, extras);
            Log.d(TAG, "origine " + richiesta + " verificata: " + esito);
        }
    }

    // Chrome apre il canale solo a browser «scaldato» (`warmup`), e la
    // libreria non lo scalda piu' sui Chrome recenti: una presa a parte,
    // del processo, lo fa una volta sola
    private static void apriCanale(Context app) {
        if (origine == null || lanciatore == null) return;
        if (scaldato != null) {
            richiedi();
            return;
        }
        if (scaldando) return;
        String provider = lanciatore.getProviderPackage();
        if (provider == null) return;
        scaldando = true;
        CustomTabsClient.bindCustomTabsService(app, provider, new CustomTabsServiceConnection() {
            @Override
            public void onCustomTabsServiceConnected(@NonNull ComponentName nome, @NonNull CustomTabsClient client) {
                client.warmup(0);
                scaldato = client;
                scaldando = false;
                richiedi();
            }

            @Override
            public void onServiceDisconnected(ComponentName nome) {
                scaldato = null;
                scaldando = false;
            }
        });
    }

    private static void richiedi() {
        CustomTabsSession s = sessione();
        if (s == null) return;
        // l'origine e' quella del sito: Chrome la verifica con
        // `use_as_origin` in assetlinks.json, e la pagina la ritrova in
        // `event.origin`
        boolean ok = s.requestPostMessageChannel(origine, origine, new Bundle());
        Log.d(TAG, "canale chiesto: " + ok);
    }

    // {"sfondo":{"id":"…","i":0,"n":4,"dati":"<base64>"}}: la copertina
    // arriva a pezzi perche' un messaggio solo da mezzo megabyte non passa
    // dal binder di Android
    private static void ricevi(Context app, String messaggio) {
        JSONObject sfondo;
        try {
            sfondo = new JSONObject(messaggio).optJSONObject("sfondo");
        } catch (Throwable e) {
            return;
        }
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

    private static void metti(Context app, String base64) {
        new Thread(() -> {
            String esito;
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    byte[] byteDellImmagine = Base64.decode(base64, Base64.DEFAULT);
                    Bitmap immagine = BitmapFactory.decodeByteArray(byteDellImmagine, 0, byteDellImmagine.length);
                    if (immagine == null) throw new IllegalStateException("immagine illeggibile");
                    WallpaperManager wm = WallpaperManager.getInstance(app);
                    if (!wm.isSetWallpaperAllowed()) throw new IllegalStateException("non permesso su questo dispositivo");
                    wm.setBitmap(immagine, null, true, WallpaperManager.FLAG_LOCK);
                    esito = OK;
                } else {
                    esito = ERRORE + "serve Android 7 o piu' recente";
                }
            } catch (Throwable e) {
                esito = ERRORE + e.getMessage();
            }
            final String risposta = esito;
            new Handler(Looper.getMainLooper()).post(() -> {
                CustomTabsSession s = sessione();
                if (s != null) s.postMessage(risposta, null);
            });
        }, "sfondo").start();
    }
}
