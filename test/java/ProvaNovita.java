package it.bookcompanion.app;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

// la regola delle novita' del guscio, sui casi veri di Open Library
// (Brandon Sanderson, novembre 2026). Stampa una riga per controllo:
// «ok …» o «NO …», e `test/novita-guscio.test.mjs` le legge
public class ProvaNovita {
    static int no = 0;

    static void c(String nome, boolean vero) {
        System.out.println((vero ? "ok " : "NO ") + nome);
        if (!vero) no++;
    }

    static List<String> l(String... x) {
        return x.length == 0 ? null : Arrays.asList(x);
    }

    public static void main(String[] a) {
        int ora = 2026;
        c("la traduzione turca senza lingua non e' un libro nuovo", !RegoleNovita.candidato("Rüzgar ve Hakikat", 2026, null, ora));
        c("…e nemmeno con la sola lingua turca", !RegoleNovita.candidato("Rüzgar ve Hakikat", 2026, l("tur"), ora));
        c("un segnaposto senza edizioni non e' un libro nuovo", !RegoleNovita.candidato("Elantris 3", 2030, null, ora));
        c("l'edizione in due lingue no", !RegoleNovita.candidato("Mistborn. Historia Secreta / Mistborn", 2026, l("spa"), ora));
        c("…nemmeno con l'inglese dentro", !RegoleNovita.candidato("Ritmo de la Guerra / Rhythm of War", 2026, l("spa", "eng"), ora));
        c("il cofanetto no", !RegoleNovita.candidato("Skyward 4-Book Boxed Set", 2025, l("eng"), ora));
        c("…ne' l'omnibus", !RegoleNovita.candidato("The Mistborn Omnibus", 2026, l("eng"), ora));
        c("…ne' un'edizione", !RegoleNovita.candidato("Warbreaker Leatherbound Edition", 2026, l("eng"), ora));
        c("un libro in inglese di quest'anno si'", RegoleNovita.candidato("Blightfall", 2026, l("eng"), ora));
        c("…anche dell'anno scorso", RegoleNovita.candidato("Blightfall", 2025, l("eng"), ora));
        c("…anche in italiano", RegoleNovita.candidato("Vento e verità", 2026, l("ita"), ora));
        c("…anche con altre lingue accanto", RegoleNovita.candidato("The Fires of December", 2026, l("spa", "eng"), ora));
        c("uno di due anni fa no", !RegoleNovita.candidato("Wind and Truth", 2024, l("eng"), ora));
        c("senza titolo no", !RegoleNovita.candidato(" ", 2026, l("eng"), ora));

        List<String[]> sunlit = new ArrayList<>();
        sunlit.add(new String[] { "The Sunlit Man", "2023" });
        sunlit.add(new String[] { "Sunlit Man", "2025" });
        c("la ristampa con un anno nuovo si riconosce, anche senza l'articolo", RegoleNovita.ristampa("Sunlit Man", sunlit, ora));
        List<String[]> elantris = new ArrayList<>();
        elantris.add(new String[] { "Elantris", "2005" });
        elantris.add(new String[] { "The Hope of Elantris [Dramatized Adaptation]", "2020" });
        elantris.add(new String[] { "Elantris", "2025" });
        c("…e Elantris del 2025 e' quella del 2005", RegoleNovita.ristampa("Elantris", elantris, ora));
        List<String[]> blight = new ArrayList<>();
        blight.add(new String[] { "Blightfall", "2026" });
        c("un libro che c'e' solo adesso non e' una ristampa", !RegoleNovita.ristampa("Blightfall", blight, ora));
        List<String[]> lopen = new ArrayList<>();
        lopen.add(new String[] { "Elsecaller / King Lopen the First of Alethkar", "2025" });
        lopen.add(new String[] { "King Lopen the First", "2026" });
        c("un titolo che ne contiene un altro non e' lo stesso libro", !RegoleNovita.ristampa("King Lopen the First", lopen, ora));
        List<String[]> storto = new ArrayList<>();
        storto.add(new String[] { "Songs of the Dead (Duplicate of OL45746319W)", "" });
        storto.add(new String[] { "Songs of the Dead", "2026" });
        c("un anno che non c'e' non fa una ristampa", !RegoleNovita.ristampa("Songs of the Dead", storto, ora));
        c("senza risposta nessuna ristampa", !RegoleNovita.ristampa("Blightfall", null, ora));
        List<String[]> senzaAnno = new ArrayList<>();
        senzaAnno.add(new String[] { "Blightfall", "0" });
        c("un'opera senza data (il guscio scrive 0) non fa una ristampa", !RegoleNovita.ristampa("Blightfall", senzaAnno, ora));
        List<String[]> dentro = new ArrayList<>();
        dentro.add(new String[] { "Tress of the Emerald Sea: The Companion", "2020" });
        c("un titolo vecchio che contiene quello nuovo non e' lo stesso libro", !RegoleNovita.ristampa("Tress", dentro, ora));

        System.out.println(no == 0 ? "TUTTO BENE" : no + " NO");
    }
}
