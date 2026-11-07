package it.bookcompanion.app;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

// GLI AVVISI DEI CAPITOLI NUOVI, ANCHE AD APP CHIUSA. Chiesti dal lettore:
// «mi avvisi ogni volta che c'e' un capitolo nuovo e mi tieni aggiornato»,
// per le serie che legge online (One Piece su MANGA Plus, Gachiakuta su
// K MANGA). La pagina non vive ad app chiusa, il guscio si': la pagina gli
// manda le serie seguite (`{"seguite":[…]}`), lui le tiene e ogni `OGNI` ore
// chiede a MangaDex gli ultimi capitoli di ognuna, col nome dell'app come
// la rete del guscio. Un numero piu' alto dell'ultimo noto e' una notifica;
// toccata, apre la stanza delle serie seguite (`/?serie=<id>`). La prima
// volta che una serie entra niente e' nuovo: si parte da dove si e'.
public class Avvisi extends JobService {
    private static final String TAG = "Grimorio";
    static final String PREFS = "avvisi";
    private static final String CHIAVE = "seguite";
    private static final String CHIESTO = "permesso_chiesto";
    static final int LAVORO = 4401;
    static final long OGNI = 3L * 60 * 60 * 1000;
    static final String CANALE = "capitoli";
    // la risposta alla pagina: «grimorio:avvisi:si|no|chiedo»
    static final String STATO = "grimorio:avvisi:";
    static final String DA_AVVISI = "da_avvisi";
    private static final String SITO = "https://book-companion.vercel.app";
    private static final String FEED = "https://api.mangadex.org/manga/";
    private static final String[] CONTENUTI = { "safe", "suggestive", "erotica", "pornographic" };

    // ---- DALLA PAGINA ---------------------------------------------------------

    // le serie seguite arrivano a ogni saluto e a ogni cambio: si tengono,
    // e l'ultimo capitolo noto resta il piu' alto fra quello della pagina e
    // quello del guscio (una lingua cambiata riparte da quello della pagina)
    static String seguite(Context c, JSONArray dallaPagina) {
        Context app = c.getApplicationContext();
        JSONObject prima = leggi(app);
        JSONObject dopo = new JSONObject();
        try {
            for (int k = 0; k < dallaPagina.length(); k++) {
                JSONObject s = dallaPagina.optJSONObject(k);
                if (s == null) continue;
                String id = s.optString("id", "");
                if (id.isEmpty()) continue;
                JSONObject vecchia = prima.optJSONObject(id);
                String lingua = s.optString("lingua", "en");
                double ultimo = s.optDouble("ultimo", Double.NaN);
                if (vecchia != null && lingua.equals(vecchia.optString("lingua"))) {
                    double suo = vecchia.optDouble("ultimo", Double.NaN);
                    if (Double.isNaN(ultimo) || (!Double.isNaN(suo) && suo > ultimo)) ultimo = suo;
                }
                JSONObject nuova = new JSONObject();
                nuova.put("titolo", s.optString("titolo", ""));
                nuova.put("lingua", lingua);
                if (!Double.isNaN(ultimo)) nuova.put("ultimo", ultimo);
                dopo.put(id, nuova);
            }
        } catch (Throwable e) {
            Log.w(TAG, "le serie seguite non si leggono: " + e);
            return stato(app);
        }
        scrivi(app, dopo);
        // un rifiuto di Android al lavoro periodico si dice alla pagina, e il
        // resto del guscio va avanti
        try {
            if (dopo.length() > 0) programma(app);
            else togli(app);
        } catch (Throwable e) {
            Log.w(TAG, "il controllo periodico non parte: " + e);
            return STATO + "guasto";
        }
        if (dopo.length() > 0 && daChiedere(app)) chiedi(app);
        return stato(app);
    }

    // ---- IL PERMESSO DELLE NOTIFICHE ------------------------------------------

    static boolean daChiedere(Context c) {
        return Build.VERSION.SDK_INT >= 33
                && c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
                && !prefs(c).getBoolean(CHIESTO, false);
    }

    static String stato(Context c) {
        boolean concesso = Build.VERSION.SDK_INT < 33
                || c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        boolean accese = nm == null || nm.areNotificationsEnabled();
        if (concesso && accese) return STATO + "si";
        return STATO + (daChiedere(c) ? "chiedo" : "no");
    }

    // la finestra di Android si apre sopra la pagina, come quella dello
    // sfondo (`PermessoActivity`), una volta sola: un no si rispetta, e la
    // stanza dice dove riaccenderle
    private static void chiedi(Context app) {
        try {
            Intent i = new Intent(app, PermessoActivity.class);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            i.putExtra(DA_AVVISI, true);
            app.startActivity(i);
        } catch (Throwable e) {
            Log.w(TAG, "la finestra delle notifiche non parte: " + e);
        }
    }

    static void chiesto(Context c) {
        prefs(c).edit().putBoolean(CHIESTO, true).apply();
    }

    // ---- IL GIRO PERIODICO ----------------------------------------------------

    private static void programma(Context app) {
        JobScheduler js = (JobScheduler) app.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        if (js == null) return;
        if (Build.VERSION.SDK_INT >= 24 && js.getPendingJob(LAVORO) != null) return;
        JobInfo info = new JobInfo.Builder(LAVORO, new ComponentName(app, Avvisi.class))
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                .setPeriodic(OGNI)
                .setPersisted(true)
                .build();
        js.schedule(info);
    }

    private static void togli(Context app) {
        JobScheduler js = (JobScheduler) app.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        if (js != null) js.cancel(LAVORO);
    }

    @Override
    public boolean onStartJob(JobParameters params) {
        final Context app = getApplicationContext();
        new Thread(() -> {
            try {
                controlla(app);
            } catch (Throwable e) {
                Log.w(TAG, "il controllo dei capitoli: " + e);
            }
            jobFinished(params, false);
        }).start();
        return true;
    }

    @Override
    public boolean onStopJob(JobParameters params) {
        return true;
    }

    // una serie alla volta, una richiesta alla volta: un intoppo e' di quella
    // serie, e le altre si controllano lo stesso
    static void controlla(Context app) throws Exception {
        JSONObject tutte = leggi(app);
        JSONArray ids = tutte.names();
        if (ids == null) return;
        for (int k = 0; k < ids.length(); k++) {
            String id = ids.getString(k);
            JSONObject s = tutte.optJSONObject(id);
            if (s == null) continue;
            try {
                JSONObject ultimo = ultimoCapitolo(app, id, s.optString("lingua", "en"));
                if (ultimo == null) continue;
                double numero = ultimo.getDouble("numero");
                double noto = s.optDouble("ultimo", Double.NaN);
                if (!Double.isNaN(noto) && numero > noto) avvisa(app, id, s.optString("titolo", ""), numero, ultimo.optString("titolo", ""));
                if (Double.isNaN(noto) || numero > noto) s.put("ultimo", numero);
            } catch (Throwable e) {
                Log.w(TAG, "la serie " + id + " non si controlla: " + e);
            }
            Thread.sleep(400);
        }
        // si riscrive su quel che c'e' adesso: una serie tolta nel frattempo
        // resta tolta
        JSONObject ora = leggi(app);
        JSONArray restano = ora.names();
        if (restano != null) {
            for (int k = 0; k < restano.length(); k++) {
                String id = restano.getString(k);
                JSONObject controllata = tutte.optJSONObject(id);
                JSONObject s = ora.optJSONObject(id);
                if (controllata == null || s == null || !controllata.optString("lingua").equals(s.optString("lingua"))) continue;
                double a = controllata.optDouble("ultimo", Double.NaN);
                double b = s.optDouble("ultimo", Double.NaN);
                if (!Double.isNaN(a) && (Double.isNaN(b) || a > b)) s.put("ultimo", a);
            }
        }
        scrivi(app, ora);
    }

    // gli ultimi capitoli della serie nella lingua scelta (anche i rimandi:
    // il capitolo di One Piece su MANGA Plus e' un capitolo uscito): il
    // numero piu' alto e il suo titolo
    private static JSONObject ultimoCapitolo(Context app, String id, String lingua) throws Exception {
        StringBuilder u = new StringBuilder(FEED).append(URLEncoder.encode(id, "UTF-8")).append("/feed?limit=20&order%5Bchapter%5D=desc");
        u.append("&translatedLanguage%5B%5D=").append(URLEncoder.encode(lingua, "UTF-8"));
        for (String c : CONTENUTI) u.append("&contentRating%5B%5D=").append(c);
        HttpURLConnection c = (HttpURLConnection) new URL(u.toString()).openConnection();
        try {
            c.setConnectTimeout(20000);
            c.setReadTimeout(30000);
            c.setRequestProperty("User-Agent", SchermataDiBlocco.nomeDellApp(app));
            if (c.getResponseCode() != 200) return null;
            JSONObject json = new JSONObject(leggiTesto(c.getInputStream()));
            JSONArray dati = json.optJSONArray("data");
            if (dati == null) return null;
            double max = Double.NaN;
            String titolo = "";
            for (int k = 0; k < dati.length(); k++) {
                JSONObject a = dati.getJSONObject(k).optJSONObject("attributes");
                if (a == null) continue;
                double n;
                try {
                    n = Double.parseDouble(a.optString("chapter", "").replace(',', '.'));
                } catch (NumberFormatException e) {
                    continue;
                }
                if (Double.isNaN(max) || n > max) {
                    max = n;
                    titolo = a.optString("title", "");
                    if ("null".equals(titolo)) titolo = "";
                }
            }
            if (Double.isNaN(max)) return null;
            JSONObject r = new JSONObject();
            r.put("numero", max);
            r.put("titolo", titolo);
            return r;
        } finally {
            c.disconnect();
        }
    }

    static String numeroScritto(double n) {
        return n == Math.floor(n) ? String.valueOf((long) n) : String.valueOf(n);
    }

    private static void avvisa(Context app, String id, String serie, double numero, String titolo) {
        NotificationManager nm = (NotificationManager) app.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CANALE) == null) {
            nm.createNotificationChannel(new NotificationChannel(CANALE, "Capitoli nuovi", NotificationManager.IMPORTANCE_DEFAULT));
        }
        Intent apri = app.getPackageManager().getLaunchIntentForPackage(app.getPackageName());
        if (apri == null) return;
        apri.setData(Uri.parse(SITO + "/?serie=" + Uri.encode(id)));
        apri.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        PendingIntent tocco = PendingIntent.getActivity(app, id.hashCode(), apri, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        String testo = "Capitolo " + numeroScritto(numero) + (titolo.isEmpty() ? "" : " · " + titolo);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(app, CANALE) : new Notification.Builder(app);
        b.setSmallIcon(app.getApplicationInfo().icon)
                .setContentTitle(serie.isEmpty() ? "Capitolo nuovo" : serie)
                .setContentText(testo)
                .setAutoCancel(true)
                .setContentIntent(tocco);
        try {
            nm.notify(id.hashCode(), b.build());
        } catch (SecurityException e) {
            Log.w(TAG, "notifica negata: " + e);
        }
    }

    // ---- LA MEMORIA -----------------------------------------------------------

    private static SharedPreferences prefs(Context c) {
        return c.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static JSONObject leggi(Context c) {
        try {
            return new JSONObject(prefs(c).getString(CHIAVE, "{}"));
        } catch (Throwable e) {
            return new JSONObject();
        }
    }

    private static void scrivi(Context c, JSONObject tutte) {
        prefs(c).edit().putString(CHIAVE, tutte.toString()).apply();
    }

    private static String leggiTesto(InputStream in) throws Exception {
        try (InputStream dentro = in; ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] b = new byte[16 * 1024];
            for (int n; (n = dentro.read(b)) > 0; ) {
                if (out.size() + n > 4 * 1024 * 1024) throw new IllegalStateException("risposta troppo grande");
                out.write(b, 0, n);
            }
            return new String(out.toByteArray(), StandardCharsets.UTF_8);
        }
    }
}
