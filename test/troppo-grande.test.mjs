// UN FILE TROPPO GRANDE, E UNA COPERTINA CHE NON SCENDE PIÙ.
//
// Due difetti della stessa specie, tutt'e due muti. Il primo ALZAVA: il
// secchio rifiuta un tomo oltre il suo tetto per oggetto, e quell'errore
// si portava via il giro intero — i libri dopo di lui, le copertine, le
// preferenze, gli scaricamenti — a ogni sincronizzazione, con l'errore
// nudo nel pannello e senza dire di quale libro parlasse. Il secondo
// TACEVA: le copertine scendevano solo dentro il giro di `pull`, e una
// riga già in pari lì non ci ripassa mai più.
//
// Qui si prova quel che sbaglia in silenzio: riconoscere l'errore giusto,
// non rispedire megabyte già rifiutati, non accusare un libro che non c'è
// più, e sapere quali copertine andare a riprendere.
import {
  eTroppoGrande,
  giaBocciato,
  troppoGrandiInBiblioteca,
  fraseTroppoGrandi,
  copertineDaScaricare,
  contaSpazio,
  nonCeLassu,
} from "../src/lib/syncCore.js";

const oggetto = (name, size = 10) => ({ name, metadata: { size } });
const mb = (n) => `${n} MB`;

export default async function (t) {
  // ---- RICONOSCERE IL RIFIUTO PER MISURA -----------------------------------
  {
    // le tre forme in cui arriva il codice, come per il 404
    t.c("statusCode stringa", eTroppoGrande({ statusCode: "413" }));
    t.c("status numero", eTroppoGrande({ status: 413 }));
    t.c(
      "le parole di Supabase",
      eTroppoGrande({ message: "The object exceeded the maximum allowed size" })
    );
    t.c("«payload too large»", eTroppoGrande({ error: "Payload too large" }));
    t.c("«request entity too large»", eTroppoGrande({ message: "Request Entity Too Large" }));
    t.c("maiuscole indifferenti", eTroppoGrande({ message: "MAXIMUM ALLOWED SIZE" }));

    // e quel che NON è: qui un «sì» di troppo vuol dire segnare come
    // bocciato per sempre un tomo che lassù poteva andarci benissimo
    t.c("un 404 non è troppo grande", !eTroppoGrande({ statusCode: "404" }));
    t.c("un 500 non è troppo grande", !eTroppoGrande({ status: 500, message: "boom" }));
    t.c("la rete caduta non è troppo grande", !eTroppoGrande(new TypeError("Failed to fetch")));
    t.c("niente non è troppo grande", !eTroppoGrande(null));
    // IL CODICE SI CONFRONTA INTERO: cercato per contenimento, un 4130
    // passerebbe — stessa lezione del 404.
    t.c("4130 non è 413", !eTroppoGrande({ statusCode: "4130" }));
    t.c("un 413 non è un 404", !nonCeLassu({ statusCode: "413" }));
  }

  // ---- IL SEGNO PORTA LA MISURA --------------------------------------------
  {
    const reg = { a: 60_000_000 };
    t.c("stessi byte: non si rispedisce", giaBocciato("a", 60_000_000, reg));
    // LA MISURA È IL MODO DI RIPROVARE: cambiati i byte (una ricucitura, un
    // file sostituito) quel «no» non vale più. Senza il confronto sarebbe
    // un rifiuto per sempre su un file che non è più quello.
    t.c("byte diversi: si riprova", !giaBocciato("a", 59_000_000, reg));
    t.c("mai bocciato: si prova", !giaBocciato("b", 10, reg));
    t.c("senza registro si prova", !giaBocciato("a", 10, null));
    t.c("senza id non si decide", !giaBocciato("", 10, reg));
    // una misura che non è un numero non deve pareggiare con niente
    t.c("misura ignota: si prova", !giaBocciato("a", undefined, reg));
    t.c("misura NaN: si prova", !giaBocciato("a", NaN, reg));
  }

  // ---- CHI È BOCCIATO FRA I LIBRI DI ADESSO --------------------------------
  {
    const books = [
      { id: "a", title: "Il malloppo" },
      { id: "b", title: "Un libretto" },
    ];
    // il registro si porta dietro un tomo cancellato: un avviso su un libro
    // che non c'è più è rumore
    const fuori = troppoGrandiInBiblioteca(books, { a: 60_000_000, sparito: 99 });
    t.eq("solo i libri che ci sono", fuori.length, 1);
    t.eq("col titolo", fuori[0].title, "Il malloppo");
    t.eq("e con la misura", fuori[0].byte, 60_000_000);
    t.eq("registro vuoto: nessuno", troppoGrandiInBiblioteca(books, {}).length, 0);
    t.eq("senza registro: nessuno", troppoGrandiInBiblioteca(books, null).length, 0);
  }

  // ---- LE PAROLE -----------------------------------------------------------
  {
    t.eq("nessuno: nessuna riga", fraseTroppoGrandi([], mb), null);
    t.eq("niente: nessuna riga", fraseTroppoGrandi(null, mb), null);

    const uno = fraseTroppoGrandi([{ title: "Il malloppo", byte: 62 }], mb);
    t.c("il titolo c'è", uno.includes("«Il malloppo»"));
    // SENZA IL NUMERO «troppo grande» non dice di quanto, ed è l'unica cosa
    // che rende la riga utile
    t.c("e la misura anche", uno.includes("(62 MB)"));
    t.c("singolare", uno.includes("è troppo grande") && uno.includes("resta"));
    // non promette una cura che non c'è: dice dove il libro RESTA
    t.c("dice dove resta", uno.includes("questo dispositivo"));

    const tre = fraseTroppoGrandi(
      [
        { title: "A", byte: 1 },
        { title: "B", byte: 2 },
      ],
      mb
    );
    t.c("plurale", tre.includes("sono troppo grandi") && tre.includes("restano"));

    // tre nomi e poi il conto, come per i perduti: un elenco intero in una
    // riga di servizio diventa un muro
    const molti = fraseTroppoGrandi(
      Array.from({ length: 5 }, (_, i) => ({ title: `T${i}`, byte: i })),
      mb
    );
    t.c("tre nomi", molti.includes("«T0»") && molti.includes("«T2»") && !molti.includes("«T3»"));
    t.c("e il resto contato", molti.includes("e altri 2"));

    // un titolo che manca non deve scrivere «undefined» in una riga italiana
    t.c(
      "senza titolo",
      fraseTroppoGrandi([{ byte: 3 }], mb).includes("«senza titolo»") &&
        !fraseTroppoGrandi([{ byte: 3 }], mb).includes("undefined")
    );
    // e senza formattatore la riga si scrive lo stesso, senza misura
    const nuda = fraseTroppoGrandi([{ title: "A", byte: 3 }], null);
    t.c("senza formattatore niente misura", !nuda.includes("(") && nuda.includes("«A»"));
  }

  // ---- LE COPERTINE DA RIPRENDERE ------------------------------------------
  {
    const books = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const lassu = new Set(["a", "b"]);

    const mancanti = copertineDaScaricare(books, { qui: new Set(["a"]), lassu });
    t.eq("una sola da riprendere", mancanti.length, 1);
    t.eq("quella che manca qui", mancanti[0].id, "b");

    // «c» lassù non c'è: bussare sarebbe un 404 a ogni sincronizzazione
    t.c("chi non c'è lassù non si chiede", !mancanti.some((b) => b.id === "c"));

    // casa vuota (la memoria del browser sfrattata): si riprende tutto
    // quello che il secchio ha
    t.eq("casa vuota: tutte", copertineDaScaricare(books, { qui: new Set(), lassu }).length, 2);
    t.eq("senza elenco di casa: tutte", copertineDaScaricare(books, { lassu }).length, 2);

    // SENZA L'ELENCO DEL SECCHIO non si chiede niente: è il lato sicuro —
    // un giro saltato si rifà, una raffica di 404 su centocinquanta libri no
    t.eq("senza elenco lassù: nessuna", copertineDaScaricare(books, { qui: new Set() }).length, 0);
    t.eq("niente libri: nessuna", copertineDaScaricare(null, { lassu }).length, 0);
    // un libro senza id non è un libro
    t.eq("senza id si salta", copertineDaScaricare([{}], { lassu }).length, 0);
  }

  // ---- E L'ELENCO DELLE COPERTINE VIENE DALLO STESSO GIRO -------------------
  {
    const c = contaSpazio(
      [
        oggetto("aaa.epub", 100),
        oggetto("aaa.cover", 5),
        oggetto("bbb.pdf", 200),
        { name: "melodie" }, // una cartella: niente metadati
      ],
      []
    );
    t.eq("due libri", c.libri.quanti, 2);
    t.eq("una copertina", c.copertine.quanti, 1);
    t.c("l'id della copertina è quello del libro", c.idCopertine.has("aaa"));
    // il `.cover` non deve finire fra i libri e viceversa: sono due domande
    // diverse fatte allo stesso elenco
    t.c("chi ha la copertina non è un libro in più", !c.idLibri.has("aaa.cover"));
    t.c("un libro senza copertina non ne ha una", !c.idCopertine.has("bbb"));
    t.eq("una cartella non è una copertina", c.idCopertine.size, 1);
  }
}
