package it.bookcompanion.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

import androidx.browser.customtabs.CustomTabsCallback;

import com.google.androidbrowserhelper.trusted.LauncherActivityMetadata;
import com.google.androidbrowserhelper.trusted.SessionStore;
import com.google.androidbrowserhelper.trusted.SharedPreferencesTokenStore;
import com.google.androidbrowserhelper.trusted.TwaLauncher;

// IL GUSCIO CHE PARLA CON LA PAGINA. Bubblewrap genera `LauncherActivity`
// sopra quella della libreria; `scripts/apk.mjs cuci` la fa estendere
// questa, che sovrascrive i soli punti lasciati aperti: il callback con cui
// Chrome ci parla, la creazione del lanciatore e l'indirizzo di avvio. Tutto
// il resto — file «Apri con», splash, ripieghi — resta quello della libreria.
public class GuscioActivity extends com.google.androidbrowserhelper.trusted.LauncherActivity {
    private static final int PERMESSO = 1;

    // IL PERMESSO DI LEGGERE LO SFONDO lo chiede `PermessoActivity`, sopra
    // Chrome, e si avvia QUI DOPO `super.onCreate`, in ogni caso: a tablet
    // acceso la libreria chiude questa attivita' in `onCreate` («la TWA e'
    // gia' viva») prima di `shouldLaunchImmediately`, e la finestra non
    // compariva mai. A freddo `shouldLaunchImmediately` torna false e
    // Chrome parte alla risposta (`onActivityResult` → `launchTwa()`).
    @Override
    protected void onCreate(Bundle stato) {
        super.onCreate(stato);
        AvanziAvvisi.togli(getApplicationContext());
        if (stato == null && SchermataDiBlocco.permessoDaChiedere(this)) {
            startActivityForResult(new Intent(this, PermessoActivity.class), PERMESSO);
        }
    }

    @Override
    protected boolean shouldLaunchImmediately() {
        return !SchermataDiBlocco.permessoDaChiedere(this);
    }

    @Override
    protected void onActivityResult(int codice, int esito, Intent dati) {
        super.onActivityResult(codice, esito, dati);
        if (codice == PERMESSO && !isFinishing()) launchTwa();
    }

    @Override
    protected CustomTabsCallback getCustomTabsCallback() {
        return new SchermataDiBlocco.Ascolto(getApplicationContext());
    }

    @Override
    protected TwaLauncher createTwaLauncher() {
        LauncherActivityMetadata meta = LauncherActivityMetadata.parse(this);
        return SchermataDiBlocco.lanciatore(this, meta, SessionStore.makeSessionId(getTaskId()),
                new SharedPreferencesTokenStore(this));
    }

    // la pagina sa quale guscio l'ha aperta e com'e' andato l'ultimo
    // tentativo di parlarle: e' l'unica strada che non passa dal canale,
    // e serve proprio quando il canale non si apre
    @Override
    protected Uri getLaunchingUrl() {
        return SchermataDiBlocco.conDiagnosi(this, super.getLaunchingUrl());
    }
}
