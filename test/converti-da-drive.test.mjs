// IL CBR COMPRESSO TROPPO GRANDE CHE ARRIVA DA DRIVE (`importaDaDrive` con
// `converti` e `sostituisci`; scelto dal lettore: «fai la 1», il CBZ al
// posto del CBR su Drive). Le scelte che sbagliano in silenzio: convertire
// chi non serve (un giga di Drive per niente), segnare il CBR invece di
// sostituirlo (il libro resterebbe un file che il browser non apre), e un
// libro che entra anche quando la conversione e' caduta.
import { importaDaDrive } from "../src/lib/importBook.js";
import { CBR_MAX } from "../src/lib/fumetto.js";
import { nuovoZip } from "../src/lib/zipScritto.js";

// un RAR compresso vero (vedi `rar-in-cbz.test.mjs`), che dice di pesare
// quanto un omnibus: il file lontano si legge a pezzi, e oltre la sua coda
// sono zeri, come farebbe un file vero di quella misura
const RAR = Buffer.from("UmFyIRoHAQDz4YLrCwEFBwAGAQGAgIAAVwRVzykCAwuoAASUFaSDAsOQTZKABQELVG9tby9wMS5wbmcKAxOKD71qVfS9JMW6JTQEL7InmxARRBSFCzEFFGEmIaX+GevldavmHMkLqvNpWUG8CRDFi55jKgIDC6gABJQVpIMCrPmA+4AFAQxUb21vL3AxMC5wbmcKAxOKD71qz8m+JMW6JTQEL7InmxARRByECzEFFGEmIaX+GevldavmHMkLqvNpWUG8CRDdmTXgLAIDC5YABKwCpIMCmMdkTIAFAQ5Ub21vL1RodW1icy5kYgoDE4oPvWo7CL8kxI0TIzP8Mm1vMYKGf6XqEnEdh7iMmG0lfAApAgMLqAAElBWkgwI7zt4igAUBC1RvbW8vcDIucG5nCgMTig+9avJ/viTFuiU0BC+yJ5sQEUQYhIsxBRRhJiGl/hnr5XWr5hzJC6rzaVlBvAkQohU1ySsCAwu8AAS+AKSDAma924qABQENQ29taWNJbmZvLnhtbAoDE4oPvWpWjr8kwKM5JVQy+jPJGhthKWppaVwJRQlEeBR3+uUwHHvdwfynx7LikFTE96BlXPEz07BQUHwVPLdkcW5csPqAcxsgHhwCAwsAAQDtgwGAAAEEVG9tbwoDE4oPvWrPyb4kHXdWUQMFBAA=", "base64");
const lontano = (bytes, misura) => {
  const pezzo = (da, a) => ({
    size: a - da,
    slice: (x = 0, y = a - da) => pezzo(da + x, da + Math.min(y, a - da)),
    arrayBuffer: async () => {
      const b = new Uint8Array(a - da);
      b.set(bytes.subarray(da, Math.min(a, bytes.length)));
      return b.buffer;
    },
  });
  return pezzo(0, misura);
};
const unCbz = () => {
  const z = nuovoZip();
  z.aggiungi("Tomo/p1.png", new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]));
  return z.chiudi();
};

export default async (t) => {
  const prova = async ({ misura, converti, conSostituisci = true }) => {
    const chiamate = { converti: 0, segna: [], sostituisci: [] };
    const esito = await importaDaDrive([{ id: "f1", name: "Lobster Johnson.cbr", size: String(misura) }], [], {
      apri: () => lontano(RAR, misura),
      leggi: async () => ({ titolo: true, copertina: true }),
      segna: async (fileId, bookId) => {
        chiamate.segna.push(fileId);
        return true;
      },
      converti: converti
        ? async (v, onProgress) => {
            chiamate.converti += 1;
            onProgress({ letti: 1, misura: 2, pagine: 1 });
            return converti();
          }
        : undefined,
      sostituisci: conSostituisci
        ? async (v, bookId, cbz) => {
            chiamate.sostituisci.push([v.id, bookId, cbz.size]);
            return true;
          }
        : undefined,
    });
    return { esito, chiamate };
  };

  const grande = await prova({ misura: CBR_MAX + 1, converti: unCbz });
  const b = grande.esito.added[0];
  t.eq("grande e compresso: si converte", grande.chiamate.converti, 1);
  t.eq("…ed entra come CBZ", b?.fileType, "cbz");
  t.c("…col posto del CBR preso su Drive dal libro nuovo", grande.chiamate.sostituisci.length === 1 && grande.chiamate.sostituisci[0][0] === "f1" && grande.chiamate.sostituisci[0][1] === b?.id);
  t.eq("…e il CBR non si segna", grande.chiamate.segna.length, 0);
  t.c("…con l'impronta dei byte nuovi", /^[0-9a-f]{64}$/.test(b?.impronta || ""), b?.impronta);

  const piccolo = await prova({ misura: RAR.length, converti: unCbz });
  t.eq("piccolo e compresso: non si converte, la libreria lo apre", piccolo.chiamate.converti, 0);
  t.eq("…ed entra CBR, segnato come sempre", piccolo.esito.added[0]?.fileType + piccolo.chiamate.segna.join(), "cbrf1");

  const caduta = await prova({
    misura: CBR_MAX + 1,
    converti: () => {
      throw new Error("rete caduta");
    },
  });
  t.eq("conversione caduta: il libro non entra", caduta.esito.added.length, 0);
  t.c("…e si dice perche'", /conversione in CBZ non è riuscita \(rete caduta\)/.test(caduta.esito.errors[0]?.reason || ""), caduta.esito.errors[0]?.reason);
  t.eq("…e su Drive non si tocca niente", caduta.chiamate.segna.length + caduta.chiamate.sostituisci.length, 0);

  const senza = await prova({ misura: CBR_MAX + 1, converti: null, conSostituisci: false });
  t.eq("senza chi converte entra com'e': la conversione la offre il lettore", senza.esito.added[0]?.fileType, "cbr");
};
