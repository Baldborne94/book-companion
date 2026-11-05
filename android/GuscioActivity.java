package it.bookcompanion.app;

import androidx.browser.customtabs.CustomTabsCallback;

import com.google.androidbrowserhelper.trusted.LauncherActivityMetadata;
import com.google.androidbrowserhelper.trusted.SessionStore;
import com.google.androidbrowserhelper.trusted.SharedPreferencesTokenStore;
import com.google.androidbrowserhelper.trusted.TwaLauncher;

// IL GUSCIO CHE PARLA CON LA PAGINA. Bubblewrap genera `LauncherActivity`
// sopra quella della libreria; `scripts/apk.mjs cuci` la fa estendere
// questa, che sovrascrive i due soli punti lasciati aperti: il callback con
// cui Chrome ci parla e la creazione del lanciatore. Tutto il resto — file
// «Apri con», splash, ripieghi — resta quello della libreria.
public class GuscioActivity extends com.google.androidbrowserhelper.trusted.LauncherActivity {
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
}
