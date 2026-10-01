// PERCHE' UN «.cbr» NON SI APRE (`cheArchivio`): «archivio non leggibile»
// diceva solo che non era ne' uno zip ne' un rar. I primi byte dicono
// quasi sempre cos'e', e un PDF rinominato si apre come PDF.
import { cheArchivio } from "../src/lib/fumetto.js";
import { importaDaDrive } from "../src/lib/importBook.js";

const byte = (...x) => new Uint8Array(x);
const testo = (s) => new TextEncoder().encode(s);

export default async (t) => {
  t.eq("uno zip e' un CBZ", cheArchivio(byte(0x50, 0x4b, 0x03, 0x04)).formato, "cbz");
  t.eq("un rar e' un CBR", cheArchivio(testo("Rar!\x1a\x07")).formato, "cbr");
  t.eq("un PDF rinominato si apre come PDF", cheArchivio(testo("%PDF-1.7")).formato, "pdf");
  t.c("un 7-Zip rinominato si dice, con cosa farne", /7-Zip.*ZIP/.test(cheArchivio(byte(0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c, 0, 4)).perche));
  t.c("…e i primi quattro byte di un 7-Zip non bastano", !/7-Zip/.test(cheArchivio(byte(0x37, 0x7a, 0xbc, 0xaf, 0, 0)).perche));
  t.c("un autoestraente", /autoestraente/.test(cheArchivio(testo("MZ\x90\x00")).perche));
  t.c("un gzip", /gzip/.test(cheArchivio(byte(0x1f, 0x8b, 8, 0)).perche));
  t.c("un bzip2", /bzip2/.test(cheArchivio(testo("BZh9")).perche));
  t.c("una pagina web al posto del file", /pagina web/.test(cheArchivio(testo("<!DOCTYPE html>")).perche));
  t.eq("un file vuoto", cheArchivio(byte()).perche, "il file è vuoto");
  t.eq("e senza byte nemmeno", cheArchivio(undefined).perche, "il file è vuoto");
  t.eq("il resto si dice coi primi byte", cheArchivio(byte(0xca, 0xfe, 0xba, 0xbe, 1)).perche, "non è né un CBZ né un CBR (comincia con ca fe ba be)");

  // da Drive: il perche' arriva fino all'elenco degli errori
  const remoto = (u8) => ({ slice: () => ({ arrayBuffer: async () => u8.buffer }) });
  const segna = async () => true;
  const sette = await importaDaDrive([{ id: "h", name: "Batman - Hush.cbr", size: 10 }], [], { apri: () => remoto(byte(0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c, 0, 4)), segna });
  t.c("un 7-Zip da Drive dice perche' non entra", /7-Zip/.test(sette.errors[0]?.reason || ""), sette.errors[0]?.reason);
  const rotto = await importaDaDrive([{ id: "h", name: "Batman - Hush.cbr", size: 10 }], [], { apri: () => ({ slice: () => ({ arrayBuffer: async () => { throw new Error("rete"); } }) }), segna });
  t.c("un file che Drive non da' non e' «non leggibile»: si dice che Drive non l'ha dato", /Drive non ha dato/.test(rotto.errors[0]?.reason || ""), rotto.errors[0]?.reason);
  const pdf = await importaDaDrive([{ id: "p", name: "Rinominato.cbr", size: 10 }], [], { apri: () => remoto(testo("%PDF-1.4")), segna, leggi: async () => ({ titolo: true }) });
  t.eq("un PDF rinominato da Drive entra come PDF", pdf.added[0]?.fileType, "pdf");

  // LA MISURA ZERO DELL'ELENCO (Hush: 458 MB sul PC, «il file è vuoto»
  // qui): prima di leggere si chiede a Drive la misura vera
  const zip = byte(0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0);
  const viste = [];
  const apriMisura = (v) => {
    viste.push(v.size);
    return v.size > 0 ? remoto(zip) : remoto(byte());
  };
  const rimisurato = await importaDaDrive([{ id: "h", name: "Batman - Hush.cbr", size: 0 }], [], { apri: apriMisura, segna, rimisura: async () => "480000000", leggi: async () => ({ titolo: true }) });
  t.eq("con la misura zero si chiede a Drive, e il file si legge con quella vera", `${rimisurato.added[0]?.fileType}/${viste.at(-1)}`, "cbz/480000000");
  const ancoraVuoto = await importaDaDrive([{ id: "h", name: "Batman - Hush.cbr", size: 0 }], [], { apri: apriMisura, segna, rimisura: async () => 0 });
  t.c("se anche Drive dice zero, si dice che sta forse ancora salendo", /ancora salendo/.test(ancoraVuoto.errors[0]?.reason || ""), ancoraVuoto.errors[0]?.reason);
  const giuDrive = await importaDaDrive([{ id: "h", name: "Batman - Hush.cbr", size: 0 }], [], { apri: apriMisura, segna, rimisura: async () => { throw new Error("rete"); } });
  t.c("una domanda a Drive che non torna non ferma il giro", /ancora salendo/.test(giuDrive.errors[0]?.reason || ""));
  const conMisura = [];
  await importaDaDrive([{ id: "h", name: "X.cbz", size: 20 }], [], { apri: apriMisura, segna, rimisura: async () => (conMisura.push(1), 99), leggi: async () => ({ titolo: true }) });
  t.eq("con una misura vera non si chiede niente", conMisura.length, 0);
};
