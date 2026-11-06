package it.bookcompanion.app;

import android.app.Activity;
import android.os.Bundle;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

// LA FINESTRA DEL PERMESSO, SOPRA CHROME. Il permesso di leggere lo sfondo
// si chiedeva nella `LauncherActivity`, ma quella a tablet acceso non si
// raggiunge: se l'app e' gia' viva la libreria la chiude in `onCreate`
// prima di arrivare a `shouldLaunchImmediately` («la finestra non era
// comparsa»). Un'attivita' trasparente a parte, avviata dal lanciatore in
// ogni caso, chiede il permesso sopra la pagina e si chiude con la
// risposta. E' nel manifest grazie a `apk.mjs cuci`. E la apre anche il
// guscio stesso, sopra Chrome, nel momento in cui una copertina arriva senza
// permesso (`chiediPermesso`): sul tablet la strada dell'icona non ha mai
// mostrato la finestra. Concesso, la copertina messa da parte si mette da
// sola (`dopoIlPermesso`).
public class PermessoActivity extends Activity {
    private static final int PERMESSO = 1;
    private static final int TUTTI_I_FILE = 2;

    @Override
    protected void onCreate(@Nullable Bundle stato) {
        super.onCreate(stato);
        if (stato != null) return;
        if (!SchermataDiBlocco.permessoDaChiedere(this)) {
            finish();
            return;
        }
        // DA ANDROID 13 non c'e' una finestra: l'«accesso a tutti i file» e' un
        // interruttore nelle impostazioni, si va li' e si aspetta il ritorno
        if (SchermataDiBlocco.tuttiIFile()) {
            try {
                startActivityForResult(SchermataDiBlocco.intentoTuttiIFile(this), TUTTI_I_FILE);
            } catch (Throwable e) {
                SchermataDiBlocco.permessoRispostoDalleImpostazioni(this);
                finish();
            }
            return;
        }
        // «NON CHIEDERE PIU'»: Android non mostra piu' la finestra e risponde
        // «negato» da solo. Si riconosce perche' una richiesta c'e' gia' stata
        // e la spiegazione non e' piu' dovuta; allora, aperta per una
        // copertina (non dal lanciatore, che poi mette Chrome davanti), si
        // apre la pagina dell'app nelle impostazioni, dove il permesso si
        // concede a mano, e la copertina si mette senza lo sfondo di prima
        if (getIntent().getBooleanExtra(SchermataDiBlocco.DA_COPERTINA, false)
                && SchermataDiBlocco.permessoChiestoGia(this)
                && !shouldShowRequestPermissionRationale(SchermataDiBlocco.permessoLettura())) {
            SchermataDiBlocco.permessoRisposto(this, new int[] { android.content.pm.PackageManager.PERMISSION_DENIED });
            SchermataDiBlocco.apriImpostazioniApp(this);
            SchermataDiBlocco.dopoIlPermesso(this);
            finish();
            return;
        }
        requestPermissions(new String[] { SchermataDiBlocco.permessoLettura() }, PERMESSO);
    }

    @Override
    protected void onActivityResult(int codice, int esito, android.content.Intent dati) {
        super.onActivityResult(codice, esito, dati);
        if (codice != TUTTI_I_FILE) return;
        SchermataDiBlocco.permessoRispostoDalleImpostazioni(this);
        SchermataDiBlocco.dopoIlPermesso(this);
        setResult(RESULT_OK);
        finish();
    }

    @Override
    public void onRequestPermissionsResult(int codice, @NonNull String[] permessi, @NonNull int[] esiti) {
        super.onRequestPermissionsResult(codice, permessi, esiti);
        if (codice != PERMESSO) return;
        SchermataDiBlocco.permessoRisposto(this, esiti);
        SchermataDiBlocco.dopoIlPermesso(this);
        setResult(RESULT_OK);
        finish();
    }
}
