package it.bookcompanion.app;

import android.net.Uri;

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
