package it.bookcompanion.app;

import android.app.NotificationManager;
import android.app.job.JobScheduler;
import android.content.Context;
import android.os.Build;
import android.util.Log;

// GLI AVANZI DEGLI AVVISI DEI CAPITOLI. La parte manga e' stata tolta
// (chiesto dal lettore), e con lei il lavoro periodico che controllava
// MangaDex: chi aveva l'APK 1160 o 1162 ha ancora quel lavoro programmato,
// persistente anche al riavvio, la sua memoria e il canale delle notifiche
// nelle impostazioni. Se ne vanno a ogni apertura (costa niente se non c'e'
// niente), come gli avanzi di Drive nella pagina.
final class AvanziAvvisi {
    private static final String TAG = "Grimorio";
    static final int LAVORO = 4401;
    static final String PREFS = "avvisi";
    static final String CANALE = "capitoli";

    private AvanziAvvisi() {}

    static void togli(Context app) {
        try {
            JobScheduler js = (JobScheduler) app.getSystemService(Context.JOB_SCHEDULER_SERVICE);
            if (js != null) js.cancel(LAVORO);
        } catch (Throwable e) {
            Log.w(TAG, "il lavoro dei capitoli non si toglie: " + e);
        }
        try {
            app.deleteSharedPreferences(PREFS);
        } catch (Throwable e) {
            Log.w(TAG, "la memoria degli avvisi non si toglie: " + e);
        }
        if (Build.VERSION.SDK_INT >= 26) {
            try {
                NotificationManager nm = (NotificationManager) app.getSystemService(Context.NOTIFICATION_SERVICE);
                if (nm != null && nm.getNotificationChannel(CANALE) != null) nm.deleteNotificationChannel(CANALE);
            } catch (Throwable e) {
                Log.w(TAG, "il canale dei capitoli non si toglie: " + e);
            }
        }
    }
}
