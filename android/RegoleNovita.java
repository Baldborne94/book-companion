package it.bookcompanion.app;

import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

// QUANDO UN'OPERA DI OPEN LIBRARY E' UN LIBRO NUOVO (il lettore, con la
// notifica sullo schermo: «Nuovo libro di Brandon Sanderson: Rüzgar ve
// Hakikat (2026)… mi sembra una lingua straniera e non mi sembra neanche un
// libro ufficiale»). Fra le opere «piu' nuove» di un autore Open Library
// mette anche le traduzioni come opere a se' (quella e' «Wind and Truth» in
// turco, senza lingua dichiarata), le ristampe con un anno nuovo («Elantris»
// 2025, «Sunlit Man» 2025), i cofanetti, le edizioni a due lingue e i
// segnaposto senza edizioni («Elantris 3», 2030). Guardato sui dati veri
// dell'autore. Qui niente Android: la regola si prova col solo JDK
// (`test/java/ProvaNovita.java`, `test/novita-guscio.test.mjs`).
final class RegoleNovita {
    private RegoleNovita() {}

    // le lingue che il lettore legge: un'opera senza nessuna di queste
    // (anche senza lingua: i segnaposto e la traduzione turca) non e' sua
    static final String[] LINGUE = { "eng", "ita" };

    // non un libro nuovo ma un modo di venderne di vecchi; e « / » e' il
    // titolo di un'edizione in due lingue
    static final Pattern NON_LIBRO = Pattern.compile(
            "(?iu)\\bbox(?:ed)?[ -]?set\\b|\\bomnibus\\b|\\bdeluxe\\b|\\bedition\\b|\\bedizione\\b|\\bedici[oó]n\\b|\\b\\d+[- ]books?\\b|\\bcollection set\\b| / ");

    // il primo filtro, sui soli campi della ricerca per autore
    static boolean candidato(String titolo, int uscito, List<String> lingue, int annoOra) {
        if (titolo == null || titolo.trim().isEmpty()) return false;
        if (uscito < annoOra - 1) return false;
        if (NON_LIBRO.matcher(titolo).find()) return false;
        if (lingue == null) return false;
        for (String l : LINGUE) if (lingue.contains(l)) return true;
        return false;
    }

    // lo stesso titolo, a meno di maiuscole, segni e articolo davanti
    // («Sunlit Man» e' «The Sunlit Man»)
    static String chiave(String t) {
        if (t == null) return "";
        String s = t.toLowerCase(Locale.ROOT).trim().replaceFirst("^(the|a|an|il|lo|la|i|gli|le|l')\\s+", "");
        return s.replaceAll("[^\\p{L}\\p{N}]+", "");
    }

    // UNA RISTAMPA: lo stesso titolo dello stesso autore era gia' uscito
    // prima dell'anno scorso. `altre` sono le coppie [titolo, anno] di una
    // ricerca per titolo e autore
    static boolean ristampa(String titolo, List<String[]> altre, int annoOra) {
        String k = chiave(titolo);
        if (k.isEmpty() || altre == null) return false;
        for (String[] a : altre) {
            if (a == null || a.length < 2 || !k.equals(chiave(a[0]))) continue;
            int anno;
            try {
                anno = Integer.parseInt(a[1]);
            } catch (NumberFormatException e) {
                continue;
            }
            if (anno > 0 && anno < annoOra - 1) return true;
        }
        return false;
    }
}
