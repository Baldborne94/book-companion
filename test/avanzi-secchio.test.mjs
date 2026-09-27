// GLI AVANZI DEL SECCHIO: i file che non sono di nessun libro vivo.
//
// Segnalato a giro finito, con Drive collegato: «come mai dice che ci sono
// ancora 5 libri su supabase». `daTogliereDalSecchio` toglie solo quel che
// Drive ha, e un libro cancellato (sgombero andato storto, lapide tolta lo
// stesso) o un ebook tolto dalla scheda su Drive non ci vanno mai — quindi
// restavano lassu' per sempre.
import { avanziDelSecchio } from "../src/lib/driveCore.js";

export default async (t) => {
  const secchio = new Set(["qui", "lassu", "morto", "tolto", "orfano", "canc"]);
  const libri = [{ id: "qui" }, { id: "tolto", fileTolto: true }, { id: "canc" }];
  const righe = [
    { id: "qui" },
    { id: "lassu" }, // importato altrove, non ancora sceso
    { id: "morto", deleted: true },
    { id: "tolto", file_tolto: true },
  ];
  const via = (o) => avanziDelSecchio(secchio, o).sort().join(",");

  t.eq(
    "via i cancellati, gli ebook tolti e gli orfani",
    via({ libri, righe, inUscita: ["canc"] }),
    "canc,morto,orfano,tolto"
  );
  t.c("un libro solo lassu' e' vivo", !via({ libri, righe }).includes("lassu"));
  t.c("un libro solo qui e' vivo", !via({ libri: [{ id: "orfano" }], righe }).includes("orfano"));
  t.c("chi ha una lapide non e' vivo", via({ libri: [{ id: "qui" }, { id: "orfano" }], righe: [], lapidi: ["orfano"] }).includes("orfano"));
  // un ebook tolto qui ma ancora vivo nella riga di lassu' (non ancora
  // salita): nel dubbio il file resta, si toglie al giro dopo
  t.c("tolto qui e vivo lassu': resta", !via({ libri: [{ id: "tolto", fileTolto: true }], righe: [{ id: "tolto" }] }).includes("tolto"));

  // NEL DUBBIO NON SI TOGLIE: una biblioteca vuota da tutt'e due i lati e'
  // piu' spesso una lettura storta
  t.eq("senza nessun vivo non si toglie niente", via({ libri: [], righe: [] }), "");
  t.eq("senza l'elenco del secchio niente", avanziDelSecchio(null, { libri }).length, 0);
  // ma un solo ebook tolto basta a sapere che la biblioteca c'e'
  t.eq("solo ebook tolti: si tolgono", avanziDelSecchio(new Set(["tolto"]), { libri: [{ id: "tolto", fileTolto: true }] }).join(","), "tolto");
};
