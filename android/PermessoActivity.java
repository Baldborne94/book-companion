package it.bookcompanion.app;

import android.app.Activity;
import android.content.pm.PackageManager;
import android.os.Bundle;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

// LA FINESTRA DEL PERMESSO, SOPRA CHROME. Il permesso di leggere lo sfondo
// si chiedeva nella `LauncherActivity`, ma quella a tablet acceso non si
// raggiunge: se l'app e' gia' viva la libreria la chiude in `onCreate`
// prima di arrivare a `shouldLaunchImmediately` («la finestra non era
// comparsa»). Un'attivita' trasparente a parte, avviata dal lanciatore in
// ogni caso, chiede il permesso sopra la pagina e si chiude con la
// risposta. E' nel manifest grazie a `apk.mjs cuci`.
public class PermessoActivity extends Activity {
    private static final int PERMESSO = 1;

    @Override
    protected void onCreate(@Nullable Bundle stato) {
        super.onCreate(stato);
        if (stato != null) return;
        if (!SchermataDiBlocco.permessoDaChiedere(this)) {
            finish();
            return;
        }
        requestPermissions(new String[] { SchermataDiBlocco.PERMESSO_LETTURA }, PERMESSO);
    }

    @Override
    public void onRequestPermissionsResult(int codice, @NonNull String[] permessi, @NonNull int[] esiti) {
        super.onRequestPermissionsResult(codice, permessi, esiti);
        if (codice != PERMESSO) return;
        SchermataDiBlocco.permessoRisposto(this, esiti.length > 0 && esiti[0] == PackageManager.PERMISSION_GRANTED);
        setResult(RESULT_OK);
        finish();
    }
}
