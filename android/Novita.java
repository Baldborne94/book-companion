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
import android.os.Build;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.util.Calendar;

// LE NOVITA' DELLE RACCOLTE SCELTE, ANCHE AD APP CHIUSA (`lib/novita.js`).
// Chiesto dal lettore: «inviarmi notifiche quando esce un nuovo libro, un
// nuovo capitolo, delle mie serie e dei miei autori preferiti». La pagina
// manda la lista (`{"novita":[…]}`), il guscio la tiene e ogni `OGNI` ore
// guarda, una raccolta alla volta:
// - «autori»: i libri piu' nuovi di ogni autore su Open Library; un libro
//   mai visto, di quest'anno o dell'anno scorso, e' una notifica;
// - «manga»: l'ultimo capitolo su MangaDex (inglese e italiano, rimandi
//   compresi); un numero piu' alto dell'ultimo noto e' una notifica;
// - «serie»: i membri della serie su Wikidata (riconosciuta dalla pagina,
//   `lib/serieWikidata.js`); un libro mai visto che esce quest'anno, dopo o
//   e' uscito l'anno scorso e' una notifica.
// La prima volta niente e' nuovo: si parte da quel che c'e'. Solo avvisi:
// dove leggere o prendere la novita' lo decide il lettore.
public class Novita extends JobService {
    private static final String TAG = "Grimorio";
    static final String PREFS = "novita";
    private static final String CHIAVE = "seguite";
    private static final String CHIESTO = "permesso_chiesto";
    static final int LAVORO = 4402;
    static final long OGNI = 4L * 60 * 60 * 1000;
    static final String CANALE = "novita";
    // la risposta alla pagina: «grimorio:novita:si|no|chiedo|guasto»
    static final String STATO = "grimorio:novita:";
    static final String DA_NOVITA = "da_novita";
    private static final String[] CONTENUTI = { "safe", "suggestive", "erotica", "pornographic" };
    // i libri gia' visti di un autore che si ricordano: Open Library ne da'
    // venti per domanda, e piu' di cosi' sono solo vecchi; i membri di una
    // serie si ricordano tutti (l'Eresia di Horus ne ha piu' di sessanta)
    private static final int VISTI_MAX = 1000;
    static final String WIKIDATA = "https://www.wikidata.org/w/api.php";
    // quel che e' parte di una serie ma non e' un volume nuovo da leggere:
    // edizioni, audiolibri e radiodrammi (GraphicAudio ha le sue «parti»
    // dello Stormlight), film, serie tv e d'animazione, giochi
    static final String[] NON_VOLUMI = {
        "Q3331189", "Q106833", "Q2635894", "Q11424", "Q5398426", "Q581714", "Q63952888", "Q7889", "Q1643932", "Q131436",
    };

    // ---- DALLA PAGINA ---------------------------------------------------------

    // la lista arriva a ogni saluto e a ogni cambio: si tiene, e quel che il
    // guscio sa gia' di una raccolta (libri visti, ultimo capitolo, l'id su
    // MangaDex) resta finche' la raccolta guarda le stesse cose
    static String seguite(Context c, JSONArray dallaPagina) {
        Context app = c.getApplicationContext();
        JSONObject prima = leggi(app);
        JSONObject dopo = new JSONObject();
        try {
            for (int k = 0; k < dallaPagina.length(); k++) {
                JSONObject s = dallaPagina.optJSONObject(k);
                if (s == null) continue;
                String id = s.optString("id", "");
                String tipo = s.optString("tipo", "");
                if (id.isEmpty() || !("autori".equals(tipo) || "manga".equals(tipo) || "serie".equals(tipo))) continue;
                JSONObject nuova = new JSONObject();
                nuova.put("nome", s.optString("nome", ""));
                nuova.put("tipo", tipo);
                if ("manga".equals(tipo)) nuova.put("titolo", s.optString("titolo", s.optString("nome", "")));
                else if ("serie".equals(tipo)) nuova.put("wikidata", soloQ(s.optJSONArray("wikidata")));
                else nuova.put("autori", s.optJSONArray("autori") != null ? s.optJSONArray("autori") : new JSONArray());
                JSONObject vecchia = prima.optJSONObject(id);
                if (vecchia != null && stessaCosa(vecchia, nuova)) {
                    for (String campo : new String[] { "visti", "pronta", "mangadex", "ultimo" }) {
                        if (vecchia.has(campo)) nuova.put(campo, vecchia.get(campo));
                    }
                }
                dopo.put(id, nuova);
            }
        } catch (Throwable e) {
            Log.w(TAG, "le raccolte seguite non si leggono: " + e);
            return stato(app);
        }
        scrivi(app, dopo);
        // un rifiuto di Android al lavoro periodico si dice alla pagina, e il
        // resto del guscio va avanti (l'APK 1160 cadeva per questo)
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

    private static boolean stessaCosa(JSONObject a, JSONObject b) {
        if (!a.optString("tipo").equals(b.optString("tipo"))) return false;
        if ("manga".equals(a.optString("tipo"))) return a.optString("titolo").equals(b.optString("titolo"));
        if ("serie".equals(a.optString("tipo"))) return String.valueOf(a.optJSONArray("wikidata")).equals(String.valueOf(b.optJSONArray("wikidata")));
        return String.valueOf(a.optJSONArray("autori")).equals(String.valueOf(b.optJSONArray("autori")));
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
    // sfondo (`PermessoActivity`), una volta sola: un no si rispetta
    private static void chiedi(Context app) {
        try {
            Intent i = new Intent(app, PermessoActivity.class);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            i.putExtra(DA_NOVITA, true);
            app.startActivity(i);
        } catch (Throwable e) {
            Log.w(TAG, "la finestra delle notifiche non parte: " + e);
        }
    }

    static void chiesto(Context c) {
        prefs(c).edit().putBoolean(CHIESTO, true).apply();
    }

    // ---- IL GIRO PERIODICO ----------------------------------------------------

    // da Android 14 un lavoro con la rete vuole `ACCESS_NETWORK_STATE` nel
    // manifest, o `schedule` lancia una SecurityException
    private static void programma(Context app) {
        JobScheduler js = (JobScheduler) app.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        if (js == null) return;
        if (js.getPendingJob(LAVORO) != null) return;
        JobInfo info = new JobInfo.Builder(LAVORO, new ComponentName(app, Novita.class))
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
                Log.w(TAG, "il controllo delle novita': " + e);
            }
            jobFinished(params, false);
        }).start();
        return true;
    }

    @Override
    public boolean onStopJob(JobParameters params) {
        return true;
    }

    // una raccolta alla volta, una richiesta alla volta: un intoppo e' di
    // quella raccolta, e le altre si guardano lo stesso
    static void controlla(Context app) throws Exception {
        JSONObject tutte = leggi(app);
        JSONArray ids = tutte.names();
        if (ids == null) return;
        for (int k = 0; k < ids.length(); k++) {
            String id = ids.getString(k);
            JSONObject s = tutte.optJSONObject(id);
            if (s == null) continue;
            try {
                if ("manga".equals(s.optString("tipo"))) controllaManga(app, id, s);
                else if ("serie".equals(s.optString("tipo"))) controllaSerie(app, id, s);
                else controllaAutori(app, id, s);
            } catch (Throwable e) {
                Log.w(TAG, "la raccolta " + id + " non si guarda: " + e);
            }
        }
        // si riscrive su quel che c'e' adesso: una raccolta tolta nel
        // frattempo resta tolta, una cambiata riparte da capo
        JSONObject ora = leggi(app);
        JSONArray restano = ora.names();
        if (restano != null) {
            for (int k = 0; k < restano.length(); k++) {
                String id = restano.getString(k);
                JSONObject guardata = tutte.optJSONObject(id);
                JSONObject s = ora.optJSONObject(id);
                if (guardata == null || s == null || !stessaCosa(guardata, s)) continue;
                for (String campo : new String[] { "visti", "pronta", "mangadex", "ultimo" }) {
                    if (guardata.has(campo)) s.put(campo, guardata.get(campo));
                }
            }
        }
        scrivi(app, ora);
    }

    // I LIBRI NUOVI DI UN AUTORE: Open Library, dal piu' nuovo. Un libro mai
    // visto di quest'anno o dell'anno scorso (le date delle uscite annunciate
    // ci sono gia'); i piu' vecchi si segnano visti senza dire niente
    private static void controllaAutori(Context app, String id, JSONObject s) throws Exception {
        JSONArray autori = s.optJSONArray("autori");
        if (autori == null) return;
        JSONArray visti = s.optJSONArray("visti");
        if (visti == null) visti = new JSONArray();
        java.util.HashSet<String> giaVisti = new java.util.HashSet<>();
        for (int k = 0; k < visti.length(); k++) giaVisti.add(visti.optString(k));
        boolean pronta = s.optBoolean("pronta", false);
        int anno = Calendar.getInstance().get(Calendar.YEAR);
        for (int a = 0; a < autori.length(); a++) {
            String autore = autori.optString(a, "");
            if (autore.isEmpty()) continue;
            String u = "https://openlibrary.org/search.json?author=" + URLEncoder.encode(autore, "UTF-8") + "&sort=new&limit=20&fields=key,title,first_publish_year";
            JSONObject json = chiedi(app, u);
            JSONArray docs = json == null ? null : json.optJSONArray("docs");
            if (docs == null) continue;
            for (int k = 0; k < docs.length(); k++) {
                JSONObject d = docs.optJSONObject(k);
                if (d == null) continue;
                String chiave = d.optString("key", "");
                if (chiave.isEmpty() || giaVisti.contains(chiave)) continue;
                giaVisti.add(chiave);
                visti.put(chiave);
                int uscito = d.optInt("first_publish_year", 0);
                if (uscito >= anno - 1) {
                    if (pronta) avvisa(app, id, "📚 Nuovo libro di " + autore, d.optString("title", "") + " (" + uscito + ")");
                }
            }
            Thread.sleep(1000);
        }
        while (visti.length() > VISTI_MAX) visti.remove(0);
        s.put("visti", visti);
        s.put("pronta", true);
    }

    // I VOLUMI NUOVI DI UNA SERIE: Wikidata, cio' che dichiara di essere
    // parte della serie (P179), dell'opera (P361) o del suo universo (P1434).
    // La prima volta tutto e' visto; poi un membro mai visto si guarda: un
    // volume (non un'edizione, un audiolibro, un film) con una data di
    // quest'anno, dopo o dell'anno scorso e' una notifica. Senza data si
    // riguarda al giro dopo: un annuncio la data spesso l'ha dopo.
    private static void controllaSerie(Context app, String id, JSONObject s) throws Exception {
        JSONArray serie = soloQ(s.optJSONArray("wikidata"));
        if (serie.length() == 0) return;
        StringBuilder cerca = new StringBuilder("haswbstatement:");
        for (int k = 0; k < serie.length(); k++) {
            String q = serie.getString(k);
            cerca.append(k == 0 ? "" : "|").append("P179=" + q + "|P361=" + q + "|P1434=" + q);
        }
        JSONObject json = chiedi(app, WIKIDATA + "?action=query&format=json&list=search&srnamespace=0&srlimit=500&srsearch=" + URLEncoder.encode(cerca.toString(), "UTF-8"));
        JSONArray trovati = json == null || json.optJSONObject("query") == null ? null : json.optJSONObject("query").optJSONArray("search");
        if (trovati == null) return;
        JSONArray visti = s.optJSONArray("visti");
        if (visti == null) visti = new JSONArray();
        java.util.HashSet<String> giaVisti = new java.util.HashSet<>();
        for (int k = 0; k < visti.length(); k++) giaVisti.add(visti.optString(k));
        boolean pronta = s.optBoolean("pronta", false);
        java.util.ArrayList<String> nuovi = new java.util.ArrayList<>();
        for (int k = 0; k < trovati.length(); k++) {
            String m = trovati.optJSONObject(k) == null ? "" : trovati.optJSONObject(k).optString("title", "");
            if (!m.matches("Q[0-9]+") || giaVisti.contains(m)) continue;
            if (pronta) nuovi.add(m);
            else visti.put(m);
        }
        int anno = Calendar.getInstance().get(Calendar.YEAR);
        for (int i = 0; i < nuovi.size(); i += 50) {
            Thread.sleep(1000);
            String ids = android.text.TextUtils.join("|", nuovi.subList(i, Math.min(i + 50, nuovi.size())));
            JSONObject e = chiedi(app, WIKIDATA + "?action=wbgetentities&format=json&props=labels%7Cclaims&languages=it%7Cen&ids=" + URLEncoder.encode(ids, "UTF-8"));
            JSONObject entita = e == null ? null : e.optJSONObject("entities");
            if (entita == null) continue;
            JSONArray chiavi = entita.names();
            for (int k = 0; chiavi != null && k < chiavi.length(); k++) {
                String m = chiavi.getString(k);
                JSONObject voce = entita.optJSONObject(m);
                if (voce == null) continue;
                JSONObject claims = voce.optJSONObject("claims");
                int uscita = annoDi(claims);
                if (uscita == 0) continue;
                visti.put(m);
                if (!eUnVolume(claims) || uscita < anno - 1) continue;
                String titolo = etichetta(voce.optJSONObject("labels"));
                if (titolo.isEmpty()) continue;
                avvisa(app, id, "📚 Nuovo volume: " + s.optString("nome", ""), titolo + (uscita > anno ? " · esce nel " + uscita : " (" + uscita + ")"));
            }
        }
        while (visti.length() > VISTI_MAX) visti.remove(0);
        s.put("visti", visti);
        s.put("pronta", true);
    }

    // gli id di Wikidata e nient'altro: finiscono in un indirizzo
    static JSONArray soloQ(JSONArray ids) {
        JSONArray out = new JSONArray();
        for (int k = 0; ids != null && k < ids.length() && out.length() < 3; k++) {
            String q = ids.optString(k, "");
            if (q.matches("Q[0-9]+")) out.put(q);
        }
        return out;
    }

    // l'anno di uscita (P577), il piu' vecchio se ce n'e' piu' d'uno: la
    // ristampa non e' un libro nuovo
    static int annoDi(JSONObject claims) {
        JSONArray date = claims == null ? null : claims.optJSONArray("P577");
        int anno = 0;
        for (int k = 0; date != null && k < date.length(); k++) {
            try {
                String t = date.getJSONObject(k).getJSONObject("mainsnak").getJSONObject("datavalue").getJSONObject("value").getString("time");
                int a = Integer.parseInt(t.substring(1, 5));
                if (anno == 0 || a < anno) anno = a;
            } catch (Throwable e) {
                /* una data scritta male non e' una data */
            }
        }
        return anno;
    }

    static boolean eUnVolume(JSONObject claims) {
        JSONArray tipi = claims == null ? null : claims.optJSONArray("P31");
        for (int k = 0; tipi != null && k < tipi.length(); k++) {
            try {
                String t = tipi.getJSONObject(k).getJSONObject("mainsnak").getJSONObject("datavalue").getJSONObject("value").getString("id");
                for (String no : NON_VOLUMI) if (no.equals(t)) return false;
            } catch (Throwable e) {
                /* un tipo senza valore non dice niente */
            }
        }
        return true;
    }

    private static String etichetta(JSONObject labels) {
        if (labels == null) return "";
        JSONObject l = labels.optJSONObject("it");
        if (l == null) l = labels.optJSONObject("en");
        return l == null ? "" : l.optString("value", "");
    }

    // I CAPITOLI NUOVI DI UN MANGA: l'id su MangaDex si cerca una volta dal
    // titolo, poi l'ultimo capitolo in inglese o italiano, rimandi compresi
    private static void controllaManga(Context app, String id, JSONObject s) throws Exception {
        String md = s.optString("mangadex", "");
        if (md.isEmpty()) {
            String u = "https://api.mangadex.org/manga?title=" + URLEncoder.encode(s.optString("titolo", ""), "UTF-8") + "&limit=1&order%5Brelevance%5D=desc";
            JSONObject json = chiedi(app, u);
            JSONArray data = json == null ? null : json.optJSONArray("data");
            if (data == null || data.length() == 0) return;
            md = data.getJSONObject(0).optString("id", "");
            if (md.isEmpty()) return;
            s.put("mangadex", md);
            Thread.sleep(500);
        }
        StringBuilder u = new StringBuilder("https://api.mangadex.org/manga/").append(URLEncoder.encode(md, "UTF-8"))
                .append("/feed?limit=20&order%5Bchapter%5D=desc&translatedLanguage%5B%5D=en&translatedLanguage%5B%5D=it");
        for (String c : CONTENUTI) u.append("&contentRating%5B%5D=").append(c);
        JSONObject json = chiedi(app, u.toString());
        JSONArray dati = json == null ? null : json.optJSONArray("data");
        if (dati == null) return;
        double numero = Double.NaN;
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
            if (Double.isNaN(numero) || n > numero) {
                numero = n;
                titolo = "null".equals(a.optString("title", "")) ? "" : a.optString("title", "");
            }
        }
        if (Double.isNaN(numero)) return;
        double noto = s.optDouble("ultimo", Double.NaN);
        if (!Double.isNaN(noto) && numero > noto) avvisa(app, id, "📖 " + s.optString("nome", "Capitolo nuovo"), "Capitolo " + numeroScritto(numero) + (titolo.isEmpty() ? "" : " · " + titolo));
        if (Double.isNaN(noto) || numero > noto) s.put("ultimo", numero);
        Thread.sleep(500);
    }

    static String numeroScritto(double n) {
        return n == Math.floor(n) ? String.valueOf((long) n) : String.valueOf(n);
    }

    static String nomeDellApp(Context c) {
        String v = "?";
        try {
            v = String.valueOf(c.getPackageManager().getPackageInfo(c.getPackageName(), 0).versionCode);
        } catch (Throwable e) {
            /* senza versione si va col punto di domanda */
        }
        return "BookCompanion/" + v + " (Android " + Build.VERSION.RELEASE + "; +https://book-companion.vercel.app)";
    }

    private static JSONObject chiedi(Context app, String indirizzo) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(indirizzo).openConnection();
        try {
            c.setConnectTimeout(20000);
            c.setReadTimeout(30000);
            c.setRequestProperty("User-Agent", nomeDellApp(app));
            c.setRequestProperty("Accept", "application/json");
            if (c.getResponseCode() != 200) return null;
            return new JSONObject(leggiTesto(c.getInputStream()));
        } finally {
            c.disconnect();
        }
    }

    private static void avvisa(Context app, String id, String titolo, String testo) {
        NotificationManager nm = (NotificationManager) app.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CANALE) == null) {
            nm.createNotificationChannel(new NotificationChannel(CANALE, "Novità delle tue serie", NotificationManager.IMPORTANCE_DEFAULT));
        }
        Intent apri = app.getPackageManager().getLaunchIntentForPackage(app.getPackageName());
        PendingIntent tocco = apri == null ? null : PendingIntent.getActivity(app, id.hashCode(), apri, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(app, CANALE) : new Notification.Builder(app);
        b.setSmallIcon(app.getApplicationInfo().icon)
                .setContentTitle(titolo)
                .setContentText(testo)
                .setStyle(new Notification.BigTextStyle().bigText(testo))
                .setAutoCancel(true);
        if (tocco != null) b.setContentIntent(tocco);
        try {
            nm.notify((id + testo).hashCode(), b.build());
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
            return new String(out.toByteArray(), "UTF-8");
        }
    }
}
